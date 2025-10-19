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
    const baseWidth = 1024;
    const baseHeight = 1536;
    const scale = window.devicePixelRatio > 1 ? 0.75 : 0.6;
    const width = Math.round(baseWidth * scale);
    const height = Math.round(baseHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

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
    texture.anisotropy = 4;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    return texture;
}

function createCardBackTexture(card) {
    const baseWidth = 1024;
    const baseHeight = 1536;
    const scale = window.devicePixelRatio > 1 ? 0.6 : 0.5;
    const width = Math.round(baseWidth * scale);
    const height = Math.round(baseHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    const gradient = ctx.createLinearGradient(0, 0, baseWidth, baseHeight);
    gradient.addColorStop(0, '#051225');
    gradient.addColorStop(1, '#0d1f35');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, baseWidth, baseHeight);

    const glow = ctx.createRadialGradient(baseWidth * 0.5, baseHeight * 0.2, 120, baseWidth * 0.5, baseHeight * 0.2, 520);
    glow.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
    glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, baseWidth, baseHeight);

    ctx.save();
    ctx.strokeStyle = 'rgba(148, 239, 255, 0.24)';
    ctx.lineWidth = 6;
    roundedRect(ctx, 60, 60, baseWidth - 120, baseHeight - 120, 72);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = 'rgba(224, 244, 255, 0.8)';
    ctx.font = 'bold 96px "Poppins", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(card.title.toUpperCase(), baseWidth / 2, 200, baseWidth - 220);

    ctx.fillStyle = 'rgba(148, 239, 255, 0.75)';
    ctx.font = '48px "Poppins", sans-serif';
    ctx.textAlign = 'left';
    wrapText(ctx, card.subtitle || '', 140, 420, baseWidth - 280, 58);

    ctx.fillStyle = 'rgba(249, 115, 22, 0.65)';
    ctx.font = '38px "Poppins", sans-serif';
    const summary = card.summary || card.detail || '';
    wrapText(ctx, summary, 140, 620, baseWidth - 280, 56);

    const tags = Array.isArray(card.tags) ? card.tags : [];
    if (tags.length) {
        ctx.save();
        ctx.font = '34px "Poppins", sans-serif';
        let x = 150;
        const y = baseHeight - 260;
        tags.forEach((tag) => {
            const label = `#${tag}`;
            const w = ctx.measureText(label).width + 80;
            const h = 72;
            ctx.fillStyle = 'rgba(8, 47, 73, 0.68)';
            roundedRect(ctx, x, y, w, h, 40);
            ctx.fill();
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.fillStyle = 'rgba(224, 244, 255, 0.85)';
            ctx.fillText(label, x + 40, y + 20);
            x += w + 26;
        });
        ctx.restore();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 4;
    texture.generateMipmaps = true;
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

    material.userData.targetRimStrength = 1.4;
    material.onBeforeCompile = (shader) => {
        shader.uniforms.rimWarm = { value: new THREE.Color(0xffa361) };
        shader.uniforms.rimCool = { value: new THREE.Color(0x52d0ff) };
        shader.uniforms.rimStrength = { value: material.userData.targetRimStrength };
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
    renderer.shadowMap.enabled = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030510);

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
    const cameraBaseOffset = new THREE.Vector3(0, 1.5, 8.5);
    camera.position.copy(cameraBaseOffset);
    scene.add(camera);

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.85, 0.5);
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
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 480;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 120;
        positions[i * 3 + 1] = Math.random() * 40 - 12;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.18,
        sizeAttenuation: true,
        transparent: true,
        depthWrite: false,
        opacity: 0.85
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
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
    const interactableMeshes = [];
    const cardRadius = 4.1;
    const cardHeight = 3.0;
    const cardWidth = 2.05;
    const cardDepth = 0.14;

    const bodyGeometry = new THREE.BoxGeometry(cardWidth, cardHeight, cardDepth, 1, 1, 1);
    const faceGeometry = new THREE.PlaneGeometry(cardWidth * 0.94, cardHeight * 0.92, 1, 1);

    cards.forEach((card, index) => {
        const cardRoot = new THREE.Group();
        cardRoot.name = card.title;
        const pivot = new THREE.Group();
        const visual = new THREE.Group();
        pivot.add(visual);
        cardRoot.add(pivot);

        const rimMaterial = createRimMaterial({ color: 0x0d1828 });
        const frame = new THREE.Mesh(bodyGeometry, rimMaterial);
        frame.castShadow = false;
        frame.receiveShadow = false;

        const frontTexture = createCardTexture(card);
        const frontMaterial = new THREE.MeshStandardMaterial({
            map: frontTexture,
            roughness: 0.32,
            metalness: 0.25,
            transparent: true,
            emissive: new THREE.Color(0x0b2842),
            emissiveIntensity: 0.32
        });
        const frontFace = new THREE.Mesh(faceGeometry, frontMaterial);
        frontFace.position.z = cardDepth * 0.55;
        frontFace.castShadow = false;
        frontFace.userData.parentGroup = cardRoot;

        const backTexture = createCardBackTexture(card);
        const backMaterial = new THREE.MeshStandardMaterial({
            map: backTexture,
            roughness: 0.45,
            metalness: 0.12,
            transparent: true,
            emissive: new THREE.Color(0x08121f),
            emissiveIntensity: 0.18
        });
        const backFace = new THREE.Mesh(faceGeometry, backMaterial);
        backFace.position.z = -cardDepth * 0.55;
        backFace.rotation.y = Math.PI;
        backFace.userData.parentGroup = cardRoot;

        const glow = createGlowPlane(0x4ed0ff, 0.7);
        glow.position.z = -cardDepth * 0.95;
        glow.material.opacity = 0.7;

        visual.add(frame, frontFace, backFace, glow);
        cardRoot.userData = {
            card,
            pivot,
            visual,
            frame,
            frontFace,
            backFace,
            glow,
            rimMaterial,
            frontTexture,
            backTexture,
            isActive: false,
            isHover: false
        };

        const angle = (index / cards.length) * Math.PI * 2;
        cardRoot.userData.baseAngle = angle;
        const x = Math.cos(angle) * cardRadius;
        const z = Math.sin(angle) * cardRadius;
        const y = Math.sin(angle * 2.0) * 0.35;
        cardRoot.position.set(x, y, z);
        cardRoot.lookAt(0, 0, 0);

        carouselGroup.add(cardRoot);
        cardGroups.push(cardRoot);
        interactableMeshes.push(frontFace, backFace);

        gsap.fromTo(cardRoot.position, { y: y + 1.2 }, {
            y,
            duration: 1.05,
            delay: 0.2 + index * 0.07,
            ease: 'power4.out'
        });
        gsap.fromTo(visual.scale, { x: 0.4, y: 0.4, z: 0.4 }, {
            x: 1,
            y: 1,
            z: 1,
            duration: 1.1,
            delay: 0.2 + index * 0.07,
            ease: 'power4.out'
        });
    });

    // -----------------------------
    //  Stato interazione e animazioni
    // -----------------------------
    let pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    let hoveredGroup = null;
    let activeGroup = null;
    let needsRaycast = false;
    let isPointerDown = false;
    let dragStartX = 0;
    let rotationVelocity = 0;
    let currentRotation = 0;
    let targetRotation = 0;
    let rotationTween = null;
    let autoRotate = true;
    let animationFrame = null;
    let overlayHovered = false;
    let isClosing = false;

    const focusTimeline = gsap.timeline({ paused: true });
    focusTimeline.to(lutPass.uniforms.mulRGB.value, { x: 1.26, y: 1.04, z: 1.32, duration: 1.2, ease: 'power4.inOut' }, 0);
    focusTimeline.to(lutPass.uniforms.powRGB.value, { x: 1.4, y: 1.1, z: 1.6, duration: 1.2, ease: 'power4.inOut' }, 0);

    function animateRimStrength(material, value) {
        material.userData.targetRimStrength = value;
        const shader = material.userData.shader;
        if (shader && shader.uniforms?.rimStrength) {
            gsap.to(shader.uniforms.rimStrength, { value, duration: 0.6, ease: 'power2.out' });
        }
    }

    function refreshCardVisual(group) {
        if (!group) return;
        const { visual, glow, rimMaterial, isActive, isHover } = group.userData;
        const scaleTarget = isActive ? 1.08 : isHover ? 1.04 : 1;
        const tiltX = isActive ? THREE.MathUtils.degToRad(-4) : isHover ? THREE.MathUtils.degToRad(-6) : 0;
        const tiltZ = isActive ? THREE.MathUtils.degToRad(3) : isHover ? THREE.MathUtils.degToRad(4) : 0;
        const glowOpacity = isActive ? 1.35 : isHover ? 1.1 : 0.7;
        gsap.to(visual.scale, { x: scaleTarget, y: scaleTarget, z: scaleTarget, duration: 0.5, ease: 'power4.out' });
        gsap.to(visual.rotation, { x: tiltX, y: 0, z: tiltZ, duration: 0.6, ease: 'power4.out' });
        gsap.to(glow.material, { opacity: glowOpacity, duration: 0.45, ease: 'power2.out' });
        animateRimStrength(rimMaterial, isActive ? 2.8 : isHover ? 2.1 : 1.4);
    }

    function flipCard(group, showBack) {
        if (!group) return;
        const { pivot } = group.userData;
        gsap.to(pivot.rotation, {
            y: showBack ? Math.PI : 0,
            duration: 0.8,
            ease: 'power4.inOut'
        });
    }

    function releaseActiveCard() {
        if (!activeGroup) return;
        activeGroup.userData.isActive = false;
        flipCard(activeGroup, false);
        refreshCardVisual(activeGroup);
        animatePanelOut(detailPanel);
        detailPanel.style.pointerEvents = 'none';
        focusTimeline.reverse();
        rotationTween?.kill?.();
        rotationTween = null;
        activeGroup = null;
        autoRotate = !overlayHovered;
    }

    function activateCard(group) {
        if (!group) return;
        if (activeGroup === group) {
            releaseActiveCard();
            autoRotate = !overlayHovered;
            return;
        }
        if (activeGroup) {
            activeGroup.userData.isActive = false;
            refreshCardVisual(activeGroup);
        }
        activeGroup = group;
        activeGroup.userData.isActive = true;
        refreshCardVisual(activeGroup);
        flipCard(activeGroup, true);
        rotationTween?.kill?.();
        const desiredBase = -group.userData.baseAngle;
        const twoPi = Math.PI * 2;
        let desiredRotation = desiredBase;
        let current = targetRotation;
        while (desiredRotation - current > Math.PI) desiredRotation -= twoPi;
        while (desiredRotation - current < -Math.PI) desiredRotation += twoPi;
        const rotationProxy = { value: targetRotation };
        rotationTween = gsap.to(rotationProxy, {
            value: desiredRotation,
            duration: 1.1,
            ease: 'power4.inOut',
            onUpdate: () => { targetRotation = rotationProxy.value; },
            onComplete: () => { rotationTween = null; }
        });
        populateDetailPanel(detailPanel, group.userData.card);
        detailPanel.style.pointerEvents = 'auto';
        animatePanelIn(detailPanel);
        focusTimeline.play();
        autoRotate = false;
    }

    // -----------------------------
    //  Eventi
    // -----------------------------
    function onPointerMove(event) {
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        pointer.set(x * 2 - 1, -(y * 2 - 1));
        needsRaycast = true;
    }

    function onPointerDown(event) {
        isPointerDown = true;
        autoRotate = false;
        rotationVelocity = 0;
        dragStartX = event.clientX || (event.touches && event.touches[0].clientX) || 0;
        overlay.classList.add('is-dragging');
        rotationTween?.kill?.();
        rotationTween = null;
        needsRaycast = true;
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
        needsRaycast = true;
    }

    function onCanvasClick() {
        if (!hoveredGroup) return;
        activateCard(hoveredGroup);
    }

    function onOverlayEnter() {
        overlayHovered = true;
        autoRotate = false;
        needsRaycast = true;
    }

    function onOverlayLeave() {
        overlayHovered = false;
        if (!isPointerDown) {
            autoRotate = true;
        }
        if (hoveredGroup && !hoveredGroup.userData.isActive) {
            hoveredGroup.userData.isHover = false;
            refreshCardVisual(hoveredGroup);
        }
        hoveredGroup = null;
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
    function handleOverlayClick(event) {
        if (event.target === exitButton) return;
        onCanvasClick(event);
    }
    overlay.addEventListener('click', handleOverlayClick);
    // Auto-rotation + pausa su hover (desktop e mobile)
    overlay.addEventListener('mouseenter', onOverlayEnter);
    overlay.addEventListener('mouseleave', onOverlayLeave);
    window.addEventListener('keydown', handleKey);

    function closeOverlay() {
        if (isClosing) return;
        isClosing = true;
        overlay.classList.remove('is-dragging');
        releaseActiveCard();
        rotationTween?.kill?.();
        rotationTween = null;
        if (hoveredGroup) {
            hoveredGroup.userData.isHover = false;
            refreshCardVisual(hoveredGroup);
            hoveredGroup = null;
        }
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
            const y = Math.sin(angle * 2.0) * 0.35;
            group.position.set(x, y, z);
            group.lookAt(0, 0, 0);
        });
    }

    function updateHover() {
        if (!needsRaycast) return;
        needsRaycast = false;
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(interactableMeshes, true);
        const newGroup = intersects.length ? intersects[0].object.userData.parentGroup : null;
        if (hoveredGroup === newGroup) return;

        if (hoveredGroup) {
            hoveredGroup.userData.isHover = false;
            refreshCardVisual(hoveredGroup);
        }

        hoveredGroup = newGroup;
        if (hoveredGroup) {
            hoveredGroup.userData.isHover = true;
            refreshCardVisual(hoveredGroup);
        }
    }

    let previousTime = performance.now();
    function animate() {
        const now = performance.now();
        const delta = (now - previousTime) / 1000;
        previousTime = now;

        galaxyMat.uniforms.time.value += delta;
        stars.rotation.y += delta * 0.03;
        starMaterial.opacity = 0.75 + Math.sin(now * 0.0018) * 0.08;
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
        releaseActiveCard();
        rotationTween?.kill?.();
        rotationTween = null;
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
        overlay.removeEventListener('click', handleOverlayClick);
        window.removeEventListener('keydown', handleKey);
        overlay.remove();
        renderer.dispose();
        composer.dispose();
        scene.remove(stars, galaxy, carouselGroup, sunMesh, moonMesh);
        cardGroups.forEach(({ userData }) => {
            userData.frontTexture?.dispose?.();
            userData.backTexture?.dispose?.();
            userData.frontFace?.material?.dispose?.();
            userData.backFace?.material?.dispose?.();
            userData.glow?.material?.dispose?.();
            userData.rimMaterial?.dispose?.();
        });
        bodyGeometry.dispose();
        faceGeometry.dispose();
        starGeometry.dispose();
        starMaterial.dispose();
        sunMesh.material?.dispose?.();
        moonMesh.material?.dispose?.();
        galaxyGeo.dispose();
        galaxyMat.dispose();
    }

    return { destroy: closeOverlay, overlay, renderer, composer };
}
