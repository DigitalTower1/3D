import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { ColorCorrectionShader } from 'three/examples/jsm/shaders/ColorCorrectionShader.js';
import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm';

// ---------------------------------------------------------------------------
//  Utility: gestione lazy per il caricamento di framer-motion (UMD globale)
// ---------------------------------------------------------------------------
let framerMotionPromise = null;
function ensureFramerMotion() {
    if (typeof window === 'undefined') return Promise.resolve(null);
    if (window.framerMotion) return Promise.resolve(window.framerMotion);
    if (!framerMotionPromise) {
        framerMotionPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/framer-motion@11/dist/framer-motion.umd.min.js';
            script.async = true;
            script.onload = () => resolve(window.framerMotion || null);
            script.onerror = () => reject(new Error('Impossibile caricare framer-motion'));
            document.head.appendChild(script);
        });
    }
    return framerMotionPromise;
}

// ---------------------------------------------------------------------------
//  Utility: generazione texture 2D per le card (Canvas2D => Texture Three.js)
// ---------------------------------------------------------------------------
function createCardTexture(card) {
    const width = 1024;
    const height = 1536;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#09203f');
    gradient.addColorStop(1, '#537895');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(48, 48, width - 96, height - 96);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px \"Poppins\", sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(card.title.toUpperCase(), 80, 120, width - 160);

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '48px \"Poppins\", sans-serif';
    const subtitle = card.subtitle || '';
    wrapText(ctx, subtitle, 80, 260, width - 160, 52);

    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '36px \"Poppins\", sans-serif';
    wrapText(ctx, card.summary || '', 80, 420, width - 160, 46);

    const tags = Array.isArray(card.tags) ? card.tags : [];
    if (tags.length) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '32px \"Poppins\", sans-serif';
        let y = height - 280;
        tags.forEach((tag) => {
            ctx.fillText(`#${tag}`, 80, y, width - 160);
            y += 48;
        });
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    if (!text) return;
    const words = text.split(' ');
    let line = '';
    let cursorY = y;
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, x, cursorY);
            line = words[n] + ' ';
            cursorY += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line.trim(), x, cursorY);
}

// ---------------------------------------------------------------------------
//  Utility: crea materiale con rim light caldo/freddo
// ---------------------------------------------------------------------------
function createRimMaterial({ color = 0x1b2a41 } = {}) {
    const material = new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.42,
        metalness: 0.4,
        transmission: 0,
        clearcoat: 0.2,
        sheen: 0.6,
        sheenColor: new THREE.Color(0x9ad6ff),
        side: THREE.DoubleSide
    });

    material.onBeforeCompile = (shader) => {
        shader.uniforms.rimWarm = { value: new THREE.Color(0xffa361) };
        shader.uniforms.rimCool = { value: new THREE.Color(0x52d0ff) };
        shader.uniforms.rimStrength = { value: 1.4 };
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>
             vec3 viewDir = normalize(vViewPosition);
             float rimTerm = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.0);
             vec3 rimMix = mix(rimWarm, rimCool, clamp(normal.y * 0.5 + 0.5, 0.0, 1.0));
             totalEmissiveRadiance += rimMix * rimTerm * rimStrength;
            `
        );
        material.userData.shader = shader;
    };
    material.customProgramCacheKey = () => 'cosmic-rim';
    return material;
}

// ---------------------------------------------------------------------------
//  Utility: crea glow planare per bordo card
// ---------------------------------------------------------------------------
function createGlowPlane(color = 0x64caff, intensity = 1.6) {
    const glowMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: intensity,
        depthWrite: false
    });
    const geometry = new THREE.PlaneGeometry(2.4, 3.6);
    const mesh = new THREE.Mesh(geometry, glowMaterial);
    mesh.renderOrder = -1;
    return mesh;
}

// ---------------------------------------------------------------------------
//  Utility: crea pannello dettagli tailwind e anima con framer-motion
// ---------------------------------------------------------------------------
function createDetailPanel(name) {
    const panel = document.createElement('div');
    panel.className = 'cosmic-carousel__detail pointer-events-auto';
    panel.setAttribute('data-portal', name);
    panel.innerHTML = `
        <div class="bg-black/70 backdrop-blur-xl rounded-3xl border border-cyan-500/40 shadow-[0_0_30px_rgba(56,189,248,0.45)] text-white w-full max-w-xl mx-auto p-8 space-y-6">
            <div class="space-y-2">
                <h3 class="cosmic-carousel__detail-title text-3xl font-semibold tracking-wide"></h3>
                <p class="cosmic-carousel__detail-subtitle text-cyan-200 text-lg"></p>
            </div>
            <p class="cosmic-carousel__detail-text text-base leading-relaxed text-slate-200"></p>
            <ul class="cosmic-carousel__detail-highlights grid gap-2"></ul>
        </div>`;
    panel.style.opacity = '0';
    panel.style.pointerEvents = 'none';
    return panel;
}

function populateDetailPanel(panel, card) {
    const title = panel.querySelector('.cosmic-carousel__detail-title');
    const subtitle = panel.querySelector('.cosmic-carousel__detail-subtitle');
    const text = panel.querySelector('.cosmic-carousel__detail-text');
    const highlights = panel.querySelector('.cosmic-carousel__detail-highlights');
    title.textContent = card.title;
    subtitle.textContent = card.subtitle || '';
    text.textContent = card.detail || card.summary || '';
    highlights.innerHTML = '';
    if (Array.isArray(card.highlights) && card.highlights.length) {
        highlights.classList.add('grid-cols-1', 'md:grid-cols-2');
        card.highlights.forEach((item) => {
            const li = document.createElement('li');
            li.className = 'flex items-center gap-2 text-sky-200 text-sm font-medium';
            li.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-sky-400"></span><span>${item}</span>`;
            highlights.appendChild(li);
        });
    }
}

async function animatePanelIn(panel) {
    const framer = await ensureFramerMotion().catch(() => null);
    if (!framer || !framer.animate) {
        gsap.to(panel, { opacity: 1, duration: 0.5, ease: 'power2.out' });
        return;
    }
    panel.style.opacity = '1';
    panel.style.pointerEvents = 'auto';
    framer.animate(panel, { opacity: [0, 1], y: [-16, 0] }, { duration: 0.55, ease: 'easeOut' });
}

async function animatePanelOut(panel) {
    const framer = await ensureFramerMotion().catch(() => null);
    if (!framer || !framer.animate) {
        gsap.to(panel, { opacity: 0, duration: 0.4, ease: 'power1.in' });
        return;
    }
    panel.style.pointerEvents = 'none';
    framer.animate(panel, { opacity: [panel.style.opacity || 1, 0], y: [0, -12] }, { duration: 0.45, ease: 'easeIn' });
}

// ---------------------------------------------------------------------------
//  Funzione principale: crea carosello cosmico orbitante
// ---------------------------------------------------------------------------
export function createCosmicCarousel({
    name,
    title,
    description,
    cards,
    onReady,
    onRequestClose
}) {
    const overlay = document.createElement('div');
    overlay.className = 'cosmic-carousel-overlay';
    overlay.dataset.portal = name;

    const hud = document.createElement('div');
    hud.className = 'cosmic-carousel__hud pointer-events-none text-slate-100 space-y-2';
    hud.innerHTML = `
        <div class="flex items-center gap-3 justify-center text-sm uppercase tracking-[0.35em] text-cyan-200">
            <span class="w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.8)]"></span>
            <span>${name}</span>
            <span class="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.8)]"></span>
        </div>
        <h2 class="text-center text-4xl md:text-5xl font-semibold text-white drop-shadow-[0_8px_30px_rgba(14,116,144,0.55)]">${title}</h2>
        <p class="max-w-3xl mx-auto text-center text-base md:text-lg text-sky-100/80">${description || ''}</p>
    `;

    const exitButton = document.createElement('button');
    exitButton.type = 'button';
    exitButton.className = 'cosmic-carousel__exit absolute top-8 right-8 z-50 bg-black/40 border border-cyan-400/50 text-cyan-200 font-semibold tracking-wide rounded-full px-6 py-2 hover:bg-cyan-500/20 focus:ring-4 focus:ring-cyan-400/60 transition';
    exitButton.textContent = 'Esci dal portale';

    const canvas = document.createElement('canvas');
    canvas.className = 'cosmic-carousel__canvas';

    const detailPanel = createDetailPanel(name);

    overlay.appendChild(canvas);
    overlay.appendChild(hud);
    overlay.appendChild(exitButton);
    overlay.appendChild(detailPanel);
    document.body.appendChild(overlay);

    if (typeof onReady === 'function') {
        onReady({ overlay });
    }

    // -----------------------------
    //  Setup Three.js
    // -----------------------------
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030510);

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
    const cameraBaseOffset = new THREE.Vector3(0, 1.5, 8.5);
    camera.position.copy(cameraBaseOffset);
    scene.add(camera);

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.8, 0.85, 0.55);
    composer.addPass(bloomPass);
    const lutPass = new ShaderPass(ColorCorrectionShader);
    lutPass.uniforms.powRGB.value.set(1.2, 1.05, 1.25);
    lutPass.uniforms.mulRGB.value.set(1.12, 1.04, 1.26);
    lutPass.uniforms.addRGB.value.set(0.02, 0.01, -0.02);
    composer.addPass(lutPass);

    // -----------------------------
    //  Luci: sole e luna + rim ambient
    // -----------------------------
    const ambient = new THREE.AmbientLight(0x123040, 0.6);
    scene.add(ambient);

    const sunLight = new THREE.DirectionalLight(0xffc27c, 1.8);
    sunLight.position.set(8, 12, 6);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    scene.add(sunLight);

    const moonLight = new THREE.DirectionalLight(0x6bd4ff, 1.2);
    moonLight.position.set(-9, 6, -4);
    moonLight.castShadow = false;
    scene.add(moonLight);

    const rimBackLight = new THREE.PointLight(0x1e88ff, 0.6, 30);
    rimBackLight.position.set(0, 3.4, -6);
    scene.add(rimBackLight);

    // -----------------------------
    //  Background cosmico animato
    // -----------------------------
    const galaxyGeo = new THREE.SphereGeometry(90, 64, 64);
    const galaxyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
            time: { value: 0 },
            colorA: { value: new THREE.Color(0x08153b) },
            colorB: { value: new THREE.Color(0x1c2b64) },
            colorC: { value: new THREE.Color(0x0f2f4b) }
        },
        vertexShader: `
            varying vec2 vUv;
            void main(){
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
            }
        `,
        fragmentShader: `
            varying vec2 vUv;
            uniform float time;
            uniform vec3 colorA;
            uniform vec3 colorB;
            uniform vec3 colorC;
            float noise(vec2 p){
                return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453);
            }
            void main(){
                float n = noise(vUv * 25.0 + time * 0.05);
                float nebula = smoothstep(0.2, 0.9, n);
                float stars = step(0.985, noise(vUv * 450.0 + time * 0.15));
                vec3 base = mix(colorA, colorB, nebula);
                base = mix(base, colorC, sin((vUv.x + time * 0.04) * 3.1415));
                vec3 starCol = mix(vec3(1.0,0.76,0.4), vec3(0.4,0.8,1.0), fract(vUv.x + time * 0.2));
                gl_FragColor = vec4(base + starCol * stars, 1.0);
            }
        `
    });
    const galaxy = new THREE.Mesh(galaxyGeo, galaxyMat);
    galaxy.frustumCulled = false;
    scene.add(galaxy);

    // -----------------------------
    //  Stelle instanziate (performance)
    // -----------------------------
    const starGeometry = new THREE.SphereGeometry(0.03, 6, 6);
    const starMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const starCount = 900;
    const stars = new THREE.InstancedMesh(starGeometry, starMaterial, starCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < starCount; i++) {
        dummy.position.set((Math.random() - 0.5) * 80, Math.random() * 30 - 10, (Math.random() - 0.5) * 80);
        dummy.updateMatrix();
        stars.setMatrixAt(i, dummy.matrix);
    }
    stars.instanceMatrix.needsUpdate = true;
    stars.frustumCulled = true;
    scene.add(stars);

    // -----------------------------
    //  Sole & luna emissivi con bloom
    // -----------------------------
    const sunMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1.4, 36, 36),
        new THREE.MeshBasicMaterial({ color: 0xffdd99 })
    );
    sunMesh.position.copy(sunLight.position);
    scene.add(sunMesh);

    const moonMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 32, 32),
        new THREE.MeshPhongMaterial({ color: 0xbfd9ff, emissive: 0x7aa6ff, emissiveIntensity: 0.6 })
    );
    moonMesh.position.copy(moonLight.position).multiplyScalar(0.6);
    scene.add(moonMesh);

    // -----------------------------
    //  Carosello 3D orbitante
    // -----------------------------
    const carouselGroup = new THREE.Group();
    scene.add(carouselGroup);

    const cardGroups = [];
    const cardRadius = 4.2;
    const cardHeight = 3.2;
    const cardWidth = 2.1;
    const cardDepth = 0.18;

    const cardGeometry = new THREE.BoxGeometry(cardWidth, cardHeight, cardDepth, 1, 1, 1);

    cards.forEach((card, index) => {
        const cardGroup = new THREE.Group();
        cardGroup.name = card.title;
        const rimMaterial = createRimMaterial({ color: 0x0d1828 });
        const mesh = new THREE.Mesh(cardGeometry, rimMaterial);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.card = card;
        const texture = createCardTexture(card);
        const textureMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            color: 0xffffff,
            roughness: 0.38,
            metalness: 0.35,
            emissive: new THREE.Color(0x062442),
            emissiveIntensity: 0.25
        });
        const front = new THREE.Mesh(new THREE.PlaneGeometry(cardWidth * 0.96, cardHeight * 0.95), textureMaterial);
        front.position.z = cardDepth * 0.51;
        front.userData.card = card;
        front.castShadow = true;

        const glow = createGlowPlane(0x4ed0ff, 0.85);
        glow.position.z = -cardDepth * 0.8;

        cardGroup.add(mesh);
        cardGroup.add(front);
        cardGroup.add(glow);
        cardGroup.userData = { card, mesh, front, glow, texture, rimMaterial };

        const angle = (index / cards.length) * Math.PI * 2;
        cardGroup.userData.baseAngle = angle;
        carouselGroup.add(cardGroup);
        cardGroups.push(cardGroup);
    });

    // -----------------------------
    //  Stato interazione e animazioni
    // -----------------------------
    let pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    let hoveredCard = null;
    let activeCard = null;
    let isPointerDown = false;
    let dragStartX = 0;
    let rotationVelocity = 0;
    let currentRotation = 0;
    let targetRotation = 0;
    let autoRotate = true;
    let animationFrame = null;
    let overlayHovered = false;
    let isClosing = false;

    const focusTimeline = gsap.timeline({ paused: true });
    focusTimeline.to(lutPass.uniforms.mulRGB.value, { x: 1.26, y: 1.04, z: 1.32, duration: 1.2, ease: 'power4.inOut' }, 0);
    focusTimeline.to(lutPass.uniforms.powRGB.value, { x: 1.4, y: 1.1, z: 1.6, duration: 1.2, ease: 'power4.inOut' }, 0);

    // -----------------------------
    //  Eventi
    // -----------------------------
    function onPointerMove(event) {
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        pointer.set(x * 2 - 1, -(y * 2 - 1));
    }

    function onPointerDown(event) {
        isPointerDown = true;
        autoRotate = false;
        dragStartX = event.clientX || (event.touches && event.touches[0].clientX) || 0;
    }

    function onPointerMoveDrag(event) {
        if (!isPointerDown) return;
        const clientX = event.clientX || (event.touches && event.touches[0].clientX) || 0;
        const deltaX = clientX - dragStartX;
        dragStartX = clientX;
        targetRotation += deltaX * 0.005;
    }

    function onPointerUp() {
        isPointerDown = false;
        rotationVelocity = 0;
        autoRotate = !overlayHovered;
    }

    function onCanvasClick() {
        if (!hoveredCard) return;
        const cardGroup = hoveredCard.parent;
        if (activeCard === cardGroup) {
            activeCard = null;
            animatePanelOut(detailPanel);
            gsap.to(cardGroup.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'power2.out' });
            gsap.to(cardGroup.rotation, { x: 0, y: 0, z: 0, duration: 0.6, ease: 'power4.inOut' });
            focusTimeline.reverse();
            detailPanel.style.pointerEvents = 'none';
            return;
        }
        if (activeCard) {
            gsap.to(activeCard.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'power2.out' });
            gsap.to(activeCard.rotation, { x: 0, y: 0, z: 0, duration: 0.6, ease: 'power4.inOut' });
        }
        activeCard = cardGroup;
        populateDetailPanel(detailPanel, cardGroup.userData.card);
        detailPanel.style.pointerEvents = 'auto';
        animatePanelIn(detailPanel);
        gsap.to(cardGroup.scale, { x: 1.08, y: 1.08, z: 1.08, duration: 0.65, ease: 'power4.out' });
        gsap.to(cardGroup.rotation, { x: THREE.MathUtils.degToRad(-5), y: 0, z: THREE.MathUtils.degToRad(3), duration: 0.8, ease: 'power4.inOut' });
        focusTimeline.play();
    }

    function onOverlayEnter() {
        overlayHovered = true;
        autoRotate = false;
    }

    function onOverlayLeave() {
        overlayHovered = false;
        if (!isPointerDown) {
            autoRotate = true;
        }
    }

    function handleKey(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeOverlay();
        }
    }

    overlay.addEventListener('pointermove', onPointerMove);
    overlay.addEventListener('mousemove', onPointerMove);
    overlay.addEventListener('touchmove', (event) => {
        if (event.touches && event.touches.length) {
            onPointerMove(event.touches[0]);
        }
        onPointerMoveDrag(event);
    }, { passive: true });
    overlay.addEventListener('pointerdown', onPointerDown);
    overlay.addEventListener('touchstart', (event) => {
        if (event.touches && event.touches.length) {
            onPointerDown(event.touches[0]);
        }
    }, { passive: true });
    overlay.addEventListener('pointermove', onPointerMoveDrag);
    overlay.addEventListener('pointerup', onPointerUp);
    overlay.addEventListener('pointerleave', onPointerUp);
    overlay.addEventListener('touchend', onPointerUp);
    overlay.addEventListener('click', (event) => {
        if (event.target === exitButton) return;
        onCanvasClick(event);
    });
    // Auto-rotation + pausa su hover (desktop e mobile)
    overlay.addEventListener('mouseenter', onOverlayEnter);
    overlay.addEventListener('mouseleave', onOverlayLeave);
    window.addEventListener('keydown', handleKey);

    function closeOverlay() {
        if (isClosing) return;
        isClosing = true;
        gsap.to(overlay, {
            opacity: 0,
            duration: 0.6,
            ease: 'power4.in',
            onComplete: () => {
                destroy();
                if (typeof onRequestClose === 'function') {
                    onRequestClose();
                }
            }
        });
    }

    exitButton.addEventListener('click', closeOverlay);

    // -----------------------------
    //  Layout responsive
    // -----------------------------
    function updateRendererSize() {
        const width = overlay.clientWidth;
        const height = overlay.clientHeight;
        renderer.setSize(width, height, false);
        composer.setSize(width, height);
        if (composer.setPixelRatio) {
            composer.setPixelRatio(renderer.getPixelRatio());
        }
        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        const mobile = width < 720;
        const desiredZ = mobile ? 9.8 : 8.2;
        const desiredY = mobile ? 1.2 : 1.6;
        gsap.to(camera.position, { z: desiredZ, y: desiredY, duration: 0.8, ease: 'power2.out' });
    }
    updateRendererSize();
    const resizeObserver = new ResizeObserver(updateRendererSize);
    resizeObserver.observe(overlay);

    // -----------------------------
    //  Aggiornamento carosello
    // -----------------------------
    function updateCarousel(delta) {
        if (autoRotate) {
            targetRotation += delta * 0.1;
        }
        currentRotation = THREE.MathUtils.lerp(currentRotation, targetRotation, 0.12);

        cardGroups.forEach((group, index) => {
            const angle = group.userData.baseAngle + currentRotation;
            const x = Math.cos(angle) * cardRadius;
            const z = Math.sin(angle) * cardRadius;
            const y = Math.sin(angle * 2.0) * 0.4;
            group.position.set(x, y, z);
            group.lookAt(0, 0, 0);
        });
    }

    function updateHover() {
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(cardGroups.flatMap((group) => [group.children[1]]), true);
        const newHovered = intersects.length ? intersects[0].object : null;
        if (hoveredCard === newHovered) return;

        if (hoveredCard) {
            const parent = hoveredCard.parent;
            gsap.to(parent.scale, { x: parent === activeCard ? 1.08 : 1, y: parent === activeCard ? 1.08 : 1, z: parent === activeCard ? 1.08 : 1, duration: 0.35, ease: 'power2.out' });
            gsap.to(parent.children[2].material, { opacity: parent === activeCard ? 1.2 : 0.85, duration: 0.4, ease: 'power2.out' });
        }

        hoveredCard = newHovered;
        if (hoveredCard) {
            const parent = hoveredCard.parent;
            gsap.to(parent.scale, { x: 1.04, y: 1.04, z: 1.04, duration: 0.45, ease: 'power4.out' });
            gsap.to(parent.children[2].material, { opacity: 1.5, duration: 0.45, ease: 'power4.out' });
        }
    }

    let previousTime = performance.now();
    function animate() {
        const now = performance.now();
        const delta = (now - previousTime) / 1000;
        previousTime = now;

        galaxyMat.uniforms.time.value += delta;
        updateCarousel(delta);
        updateHover();

        composer.render();
        animationFrame = requestAnimationFrame(animate);
    }
    animationFrame = requestAnimationFrame(animate);

    gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'power4.out' });
    gsap.fromTo(camera.position, { z: camera.position.z + 6, y: camera.position.y - 0.6 }, { z: camera.position.z, y: camera.position.y, duration: 1.2, ease: 'power4.out' });

    function destroy() {
        cancelAnimationFrame(animationFrame);
        resizeObserver.disconnect();
        overlay.removeEventListener('pointermove', onPointerMove);
        overlay.removeEventListener('mousemove', onPointerMove);
        overlay.removeEventListener('pointerdown', onPointerDown);
        overlay.removeEventListener('pointermove', onPointerMoveDrag);
        overlay.removeEventListener('pointerup', onPointerUp);
        overlay.removeEventListener('pointerleave', onPointerUp);
        overlay.removeEventListener('mouseenter', onOverlayEnter);
        overlay.removeEventListener('mouseleave', onOverlayLeave);
        window.removeEventListener('keydown', handleKey);
        overlay.remove();
        renderer.dispose();
        composer.dispose();
        cardGroups.forEach(({ userData }) => {
            userData.texture?.dispose?.();
            userData.rimMaterial?.dispose?.();
        });
        cardGeometry.dispose();
        starGeometry.dispose();
        starMaterial.dispose();
        galaxyGeo.dispose();
        galaxyMat.dispose();
    }

    return { destroy: closeOverlay, overlay, renderer, composer };
}
