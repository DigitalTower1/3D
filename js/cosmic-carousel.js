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

    // Fondo principale con gradiente tridimensionale
    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#030b1f');
    background.addColorStop(0.45, '#0b1f3d');
    background.addColorStop(1, '#07263a');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    // Nebulose traslucide
    const nebula = ctx.createRadialGradient(width * 0.2, height * 0.25, 80, width * 0.2, height * 0.25, width * 0.8);
    nebula.addColorStop(0, 'rgba(56, 189, 248, 0.55)');
    nebula.addColorStop(0.45, 'rgba(56, 189, 248, 0.05)');
    nebula.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, width, height);

    const nebula2 = ctx.createRadialGradient(width * 0.85, height * 0.7, 60, width * 0.7, height * 0.8, width * 0.7);
    nebula2.addColorStop(0, 'rgba(249, 115, 22, 0.45)');
    nebula2.addColorStop(0.5, 'rgba(249, 115, 22, 0.08)');
    nebula2.addColorStop(1, 'rgba(249, 115, 22, 0)');
    ctx.fillStyle = nebula2;
    ctx.fillRect(0, 0, width, height);

    // Cornice glassy
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    roundedRect(ctx, 40, 40, width - 80, height - 80, 80);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(148, 239, 255, 0.25)';
    ctx.stroke();
    ctx.restore();

    // Fascia superiore con accent line
    ctx.save();
    ctx.beginPath();
    roundedRect(ctx, 80, 90, width - 160, 220, 60);
    const topGradient = ctx.createLinearGradient(80, 90, width - 80, 310);
    topGradient.addColorStop(0, 'rgba(10, 25, 64, 0.55)');
    topGradient.addColorStop(1, 'rgba(24, 58, 92, 0.75)');
    ctx.fillStyle = topGradient;
    ctx.fill();
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.4)';
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(125, 211, 252, 0.6)';
    ctx.shadowColor = 'rgba(125, 211, 252, 0.75)';
    ctx.shadowBlur = 28;
    ctx.fillRect(110, 120, 14, 140);
    ctx.restore();

    // Titolo principale
    ctx.fillStyle = '#f8fbff';
    ctx.font = 'bold 84px "Poppins", sans-serif';
    ctx.textBaseline = 'top';
    wrapText(ctx, card.title.toUpperCase(), 150, 132, width - 260, 86);

    // Sottotitolo
    ctx.fillStyle = 'rgba(185, 227, 255, 0.82)';
    ctx.font = '48px "Poppins", sans-serif';
    wrapText(ctx, card.subtitle || '', 150, 310, width - 260, 56);

    // Divider luminoso
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.shadowBlur = 22;
    ctx.shadowColor = 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(140, 420);
    ctx.lineTo(width - 140, 420);
    ctx.stroke();
    ctx.restore();

    // Testo descrizione
    ctx.fillStyle = 'rgba(230, 240, 255, 0.9)';
    ctx.font = '38px "Poppins", sans-serif';
    wrapText(ctx, card.summary || card.detail || '', 140, 470, width - 280, 52);

    // Evidenzia punti chiave
    const highlights = Array.isArray(card.highlights) ? card.highlights.slice(0, 3) : [];
    if (highlights.length) {
        ctx.font = '34px "Poppins", sans-serif';
        ctx.fillStyle = 'rgba(191, 219, 254, 0.9)';
        let hy = 760;
        highlights.forEach((item) => {
            ctx.save();
            ctx.fillStyle = 'rgba(56, 189, 248, 0.65)';
            ctx.shadowColor = 'rgba(56, 189, 248, 0.65)';
            ctx.shadowBlur = 18;
            ctx.beginPath();
            ctx.arc(150, hy + 20, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            wrapText(ctx, item, 190, hy, width - 320, 48);
            hy += 86;
        });
    }

    // Badge finale con tag
    const tags = Array.isArray(card.tags) ? card.tags : [];
    if (tags.length) {
        ctx.save();
        const badgeHeight = 180;
        const badgeY = height - badgeHeight - 120;
        roundedRect(ctx, 120, badgeY, width - 240, badgeHeight, 60);
        const badgeGradient = ctx.createLinearGradient(120, badgeY, width - 120, badgeY + badgeHeight);
        badgeGradient.addColorStop(0, 'rgba(8, 47, 73, 0.8)');
        badgeGradient.addColorStop(1, 'rgba(15, 118, 221, 0.55)');
        ctx.fillStyle = badgeGradient;
        ctx.fill();
        ctx.strokeStyle = 'rgba(125, 211, 252, 0.35)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        ctx.font = '32px "Poppins", sans-serif';
        ctx.fillStyle = 'rgba(224, 244, 255, 0.9)';
        let x = 170;
        const y = height - 220;
        tags.forEach((tag) => {
            const label = `#${tag}`;
            const textWidth = ctx.measureText(label).width;
            const pillWidth = textWidth + 60;
            const pillHeight = 64;

            ctx.save();
            ctx.fillStyle = 'rgba(30, 64, 175, 0.68)';
            roundedRect(ctx, x, y, pillWidth, pillHeight, 40);
            ctx.fill();
            ctx.strokeStyle = 'rgba(96, 165, 250, 0.65)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();

            ctx.fillText(label, x + 30, y + 18);
            x += pillWidth + 28;
        });
    }

    // Piccoli stelle decorative
    for (let i = 0; i < 120; i++) {
        const sx = Math.random() * width;
        const sy = Math.random() * height;
        const radius = Math.random() * 1.5;
        ctx.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.5})`;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}

function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, height / 2, width / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
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
        <article class="cosmic-carousel__detail-card">
            <header class="cosmic-carousel__detail-header">
                <p class="cosmic-carousel__detail-subtitle"></p>
                <h3 class="cosmic-carousel__detail-title"></h3>
            </header>
            <p class="cosmic-carousel__detail-text"></p>
            <ul class="cosmic-carousel__detail-highlights"></ul>
        </article>`;
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
        card.highlights.forEach((item) => {
            const li = document.createElement('li');
            li.innerHTML = `<span></span><p>${item}</p>`;
            highlights.appendChild(li);
        });
    }
    highlights.style.display = highlights.childElementCount ? 'grid' : 'none';
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

    const canvas = document.createElement('canvas');
    canvas.className = 'cosmic-carousel__canvas';

    const chrome = document.createElement('div');
    chrome.className = 'cosmic-carousel__chrome';

    const hud = document.createElement('div');
    hud.className = 'cosmic-carousel__hud';

    const hudInfo = document.createElement('div');
    hudInfo.className = 'cosmic-carousel__hud-info';
    hudInfo.innerHTML = `
        <span class="cosmic-carousel__hud-badge">${name}</span>
        <h2>${title}</h2>
        <p>${description || ''}</p>
    `;
    if (!description) {
        const descriptionEl = hudInfo.querySelector('p');
        if (descriptionEl) {
            descriptionEl.style.display = 'none';
        }
    }

    const hudActions = document.createElement('div');
    hudActions.className = 'cosmic-carousel__hud-actions';

    const exitButton = document.createElement('button');
    exitButton.type = 'button';
    exitButton.className = 'cosmic-carousel__exit';
    exitButton.setAttribute('aria-label', 'Chiudi il portale e torna indietro');
    exitButton.innerHTML = `
        <span>
            <span class="cosmic-carousel__exit-icon">↩</span>
            <span>Torna alla scena</span>
        </span>
    `;
    exitButton.style.pointerEvents = 'auto';

    const instructions = document.createElement('span');
    instructions.className = 'cosmic-carousel__hud-instructions';
    instructions.textContent = 'Drag per orbitare • Hover per mettere in pausa • Clic per approfondire';
    instructions.style.opacity = '0';

    hudActions.appendChild(exitButton);
    hudActions.appendChild(instructions);
    hud.appendChild(hudInfo);
    hud.appendChild(hudActions);

    const detailPanel = createDetailPanel(name);

    const chromeSpacer = document.createElement('div');
    chromeSpacer.className = 'cosmic-carousel__spacer';
    chromeSpacer.style.pointerEvents = 'none';

    chrome.appendChild(hud);
    chrome.appendChild(chromeSpacer);
    chrome.appendChild(detailPanel);

    overlay.appendChild(canvas);
    overlay.appendChild(chrome);
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
        const x = Math.cos(angle) * cardRadius;
        const z = Math.sin(angle) * cardRadius;
        const y = Math.sin(angle * 2.0) * 0.4;
        cardGroup.position.set(x, y, z);
        cardGroup.lookAt(0, 0, 0);
        carouselGroup.add(cardGroup);
        cardGroups.push(cardGroup);
    });

    cardGroups.forEach((group, index) => {
        gsap.from(group.scale, {
            x: 0.45,
            y: 0.45,
            z: 0.45,
            duration: 1.05,
            delay: 0.25 + index * 0.06,
            ease: 'power4.out'
        });
        gsap.from(group.position, {
            y: group.position.y + 1.2,
            duration: 1.2,
            delay: 0.25 + index * 0.06,
            ease: 'power4.out'
        });
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
        rotationVelocity = 0;
        dragStartX = event.clientX || (event.touches && event.touches[0].clientX) || 0;
        overlay.classList.add('is-dragging');
    }

    function onPointerMoveDrag(event) {
        if (!isPointerDown) return;
        const clientX = event.clientX || (event.touches && event.touches[0].clientX) || 0;
        const deltaX = clientX - dragStartX;
        dragStartX = clientX;
        rotationVelocity = THREE.MathUtils.clamp(deltaX * 0.0035, -0.25, 0.25);
        targetRotation += rotationVelocity;
    }

    function onPointerUp() {
        isPointerDown = false;
        if (Math.abs(rotationVelocity) < 0.01) {
            rotationVelocity = 0;
        }
        autoRotate = !overlayHovered;
        overlay.classList.remove('is-dragging');
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
            autoRotate = !overlayHovered;
            return;
        }
        if (activeCard) {
            gsap.to(activeCard.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'power2.out' });
            gsap.to(activeCard.rotation, { x: 0, y: 0, z: 0, duration: 0.6, ease: 'power4.inOut' });
        }
        activeCard = cardGroup;
        autoRotate = false;
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

    function onTouchMove(event) {
        if (event.touches && event.touches.length) {
            const touch = event.touches[0];
            onPointerMove(touch);
            onPointerMoveDrag(touch);
        }
    }

    function onTouchStart(event) {
        if (event.touches && event.touches.length) {
            onPointerDown(event.touches[0]);
        }
    }

    overlay.addEventListener('pointermove', onPointerMove);
    overlay.addEventListener('mousemove', onPointerMove);
    overlay.addEventListener('touchmove', onTouchMove, { passive: true });
    overlay.addEventListener('pointerdown', onPointerDown);
    overlay.addEventListener('touchstart', onTouchStart, { passive: true });
    overlay.addEventListener('pointermove', onPointerMoveDrag);
    overlay.addEventListener('pointerup', onPointerUp);
    overlay.addEventListener('pointerleave', onPointerUp);
    overlay.addEventListener('touchend', onPointerUp);
    overlay.addEventListener('touchcancel', onPointerUp);
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
        overlay.classList.remove('is-dragging');
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
    let resizeObserver = null;
    if ('ResizeObserver' in window) {
        resizeObserver = new ResizeObserver(updateRendererSize);
        resizeObserver.observe(overlay);
    } else {
        window.addEventListener('resize', updateRendererSize);
    }

    // -----------------------------
    //  Aggiornamento carosello
    // -----------------------------
    function updateCarousel(delta) {
        if (autoRotate) {
            targetRotation += delta * 0.12;
        }
        if (!isPointerDown && Math.abs(rotationVelocity) > 0.0001) {
            targetRotation += rotationVelocity;
            rotationVelocity = THREE.MathUtils.lerp(rotationVelocity, 0, 0.08);
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
    gsap.fromTo(hud, { y: -40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'power4.out', delay: 0.2 });
    gsap.fromTo(exitButton, { y: -24, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power4.out', delay: 0.35 });
    gsap.fromTo(instructions, { opacity: 0 }, { opacity: 0.85, duration: 1.2, ease: 'power2.out', delay: 0.6 });

    function destroy() {
        cancelAnimationFrame(animationFrame);
        resizeObserver?.disconnect?.();
        if (!resizeObserver) {
            window.removeEventListener('resize', updateRendererSize);
        }
        overlay.removeEventListener('pointermove', onPointerMove);
        overlay.removeEventListener('mousemove', onPointerMove);
        overlay.removeEventListener('pointerdown', onPointerDown);
        overlay.removeEventListener('pointermove', onPointerMoveDrag);
        overlay.removeEventListener('pointerup', onPointerUp);
        overlay.removeEventListener('pointerleave', onPointerUp);
        overlay.removeEventListener('touchmove', onTouchMove);
        overlay.removeEventListener('touchstart', onTouchStart);
        overlay.removeEventListener('mouseenter', onOverlayEnter);
        overlay.removeEventListener('mouseleave', onOverlayLeave);
        overlay.removeEventListener('touchcancel', onPointerUp);
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
