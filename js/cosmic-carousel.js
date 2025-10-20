import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { ColorCorrectionShader } from 'three/examples/jsm/shaders/ColorCorrectionShader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm';

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

    ctx.clearRect(0, 0, baseWidth, baseHeight);

    const background = ctx.createLinearGradient(0, 0, baseWidth, baseHeight);
    background.addColorStop(0, '#01050f');
    background.addColorStop(0.45, '#08152a');
    background.addColorStop(1, '#01030b');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, baseWidth, baseHeight);

    ctx.save();
    ctx.shadowColor = 'rgba(94, 211, 255, 0.35)';
    ctx.shadowBlur = 48;
    ctx.fillStyle = 'rgba(9, 17, 32, 0.92)';
    roundedRect(ctx, 48, 48, baseWidth - 96, baseHeight - 96, 88);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(146, 223, 255, 0.45)';
    ctx.stroke();
    ctx.restore();

    ctx.save();
    roundedRect(ctx, 96, 112, baseWidth - 192, baseHeight - 256, 76);
    const glassGradient = ctx.createLinearGradient(96, 112, baseWidth - 96, baseHeight - 220);
    glassGradient.addColorStop(0, 'rgba(28, 46, 72, 0.92)');
    glassGradient.addColorStop(0.5, 'rgba(14, 28, 48, 0.8)');
    glassGradient.addColorStop(1, 'rgba(6, 15, 30, 0.94)');
    ctx.fillStyle = glassGradient;
    ctx.fill();
    const innerSheen = ctx.createLinearGradient(96, 112, baseWidth - 96, baseHeight - 256);
    innerSheen.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
    innerSheen.addColorStop(0.35, 'rgba(255, 255, 255, 0.05)');
    innerSheen.addColorStop(0.78, 'rgba(255, 255, 255, 0.22)');
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = innerSheen;
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.beginPath();
    roundedRect(ctx, 120, 160, baseWidth - 240, 260, 60);
    const headerGradient = ctx.createLinearGradient(120, 160, baseWidth - 120, 420);
    headerGradient.addColorStop(0, 'rgba(18, 34, 58, 0.92)');
    headerGradient.addColorStop(1, 'rgba(10, 20, 36, 0.86)');
    ctx.fillStyle = headerGradient;
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = 'rgba(99, 193, 255, 0.5)';
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const streakGradient = ctx.createLinearGradient(120, 160, baseWidth - 120, 380);
    streakGradient.addColorStop(0, 'rgba(128, 222, 255, 0.12)');
    streakGradient.addColorStop(0.55, 'rgba(255, 255, 255, 0.18)');
    streakGradient.addColorStop(1, 'rgba(255, 182, 123, 0.08)');
    ctx.fillStyle = streakGradient;
    ctx.fillRect(120, 160, baseWidth - 240, 260);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(140, 213, 255, 0.8)';
    ctx.shadowColor = 'rgba(140, 213, 255, 0.9)';
    ctx.shadowBlur = 24;
    ctx.fillRect(142, 190, 12, 180);
    ctx.restore();

    ctx.fillStyle = '#f4fbff';
    ctx.font = '600 88px "Poppins", sans-serif';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(5, 12, 25, 0.65)';
    ctx.shadowBlur = 14;
    wrapText(ctx, card.title.toUpperCase(), 190, 190, baseWidth - 360, 94);
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(201, 229, 255, 0.94)';
    ctx.font = '500 48px "Poppins", sans-serif';
    wrapText(ctx, card.subtitle || '', 190, 360, baseWidth - 360, 60);

    ctx.save();
    ctx.strokeStyle = 'rgba(80, 180, 255, 0.55)';
    ctx.shadowBlur = 18;
    ctx.shadowColor = 'rgba(56, 189, 248, 0.65)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(170, 470);
    ctx.lineTo(baseWidth - 170, 470);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = 'rgba(218, 236, 255, 0.92)';
    ctx.font = '400 40px "Poppins", sans-serif';
    wrapText(ctx, card.summary || card.detail || '', 170, 520, baseWidth - 340, 58);

    const highlights = Array.isArray(card.highlights) ? card.highlights.slice(0, 3) : [];
    if (highlights.length) {
        ctx.font = '500 36px "Poppins", sans-serif';
        let hy = 780;
        highlights.forEach((item) => {
            ctx.save();
            ctx.fillStyle = 'rgba(74, 182, 255, 0.72)';
            ctx.shadowColor = 'rgba(74, 182, 255, 0.75)';
            ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.arc(180, hy + 18, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            ctx.fillStyle = 'rgba(219, 235, 255, 0.95)';
            wrapText(ctx, item, 220, hy, baseWidth - 380, 50);
            hy += 86;
        });
    }

    const tags = Array.isArray(card.tags) ? card.tags : [];
    if (tags.length) {
        ctx.save();
        const footerY = baseHeight - 260;
        roundedRect(ctx, 150, footerY, baseWidth - 300, 190, 56);
        const footerGradient = ctx.createLinearGradient(150, footerY, baseWidth - 150, footerY + 190);
        footerGradient.addColorStop(0, 'rgba(12, 26, 46, 0.88)');
        footerGradient.addColorStop(1, 'rgba(22, 42, 68, 0.82)');
        ctx.fillStyle = footerGradient;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'rgba(112, 205, 255, 0.4)';
        ctx.stroke();
        ctx.restore();

        ctx.font = '500 34px "Poppins", sans-serif';
        ctx.fillStyle = 'rgba(214, 234, 255, 0.95)';
        let x = 200;
        const y = baseHeight - 210;
        tags.forEach((tag) => {
            const label = `#${tag}`;
            const textWidth = ctx.measureText(label).width;
            const pillWidth = textWidth + 72;
            const pillHeight = 68;
            ctx.save();
            const pillGradient = ctx.createLinearGradient(x, y, x + pillWidth, y + pillHeight);
            pillGradient.addColorStop(0, 'rgba(45, 94, 160, 0.8)');
            pillGradient.addColorStop(1, 'rgba(28, 67, 122, 0.7)');
            roundedRect(ctx, x, y, pillWidth, pillHeight, 40);
            ctx.fillStyle = pillGradient;
            ctx.fill();
            ctx.strokeStyle = 'rgba(133, 208, 255, 0.55)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
            ctx.fillText(label, x + 32, y + 18);
            x += pillWidth + 32;
        });
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 90; i++) {
        const sx = Math.random() * baseWidth;
        const sy = Math.random() * baseHeight;
        const radius = Math.random() * 1.8 + 0.6;
        ctx.fillStyle = `rgba(138, 220, 255, ${0.08 + Math.random() * 0.25})`;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

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
    gradient.addColorStop(0, '#020814');
    gradient.addColorStop(1, '#0a1a33');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, baseWidth, baseHeight);

    ctx.save();
    ctx.shadowColor = 'rgba(90, 198, 255, 0.28)';
    ctx.shadowBlur = 36;
    ctx.strokeStyle = 'rgba(150, 226, 255, 0.45)';
    ctx.lineWidth = 6;
    roundedRect(ctx, 64, 64, baseWidth - 128, baseHeight - 128, 76);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    roundedRect(ctx, 120, 200, baseWidth - 240, baseHeight - 360, 68);
    const panelGradient = ctx.createLinearGradient(120, 200, baseWidth - 120, baseHeight - 220);
    panelGradient.addColorStop(0, 'rgba(18, 32, 54, 0.92)');
    panelGradient.addColorStop(0.5, 'rgba(11, 24, 44, 0.84)');
    panelGradient.addColorStop(1, 'rgba(7, 14, 28, 0.94)');
    ctx.fillStyle = panelGradient;
    ctx.fill();
    const panelSheen = ctx.createLinearGradient(120, 200, baseWidth - 120, baseHeight - 360);
    panelSheen.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
    panelSheen.addColorStop(0.4, 'rgba(255, 255, 255, 0.04)');
    panelSheen.addColorStop(0.8, 'rgba(255, 255, 255, 0.16)');
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = panelSheen;
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#f3f9ff';
    ctx.font = '600 92px "Poppins", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(4, 12, 22, 0.7)';
    ctx.shadowBlur = 18;
    ctx.fillText(card.title.toUpperCase(), baseWidth / 2, 230, baseWidth - 240);
    ctx.shadowBlur = 0;

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(184, 220, 255, 0.95)';
    ctx.font = '500 48px "Poppins", sans-serif';
    wrapText(ctx, card.subtitle || '', 180, 440, baseWidth - 360, 58);

    ctx.fillStyle = 'rgba(249, 168, 109, 0.92)';
    ctx.font = '400 40px "Poppins", sans-serif';
    const summary = card.summary || card.detail || '';
    wrapText(ctx, summary, 180, 600, baseWidth - 360, 56);

    const tags = Array.isArray(card.tags) ? card.tags : [];
    if (tags.length) {
        ctx.save();
        const badgeY = baseHeight - 300;
        roundedRect(ctx, 180, badgeY, baseWidth - 360, 180, 54);
        const badgeGradient = ctx.createLinearGradient(180, badgeY, baseWidth - 180, badgeY + 180);
        badgeGradient.addColorStop(0, 'rgba(22, 42, 70, 0.85)');
        badgeGradient.addColorStop(1, 'rgba(12, 26, 46, 0.88)');
        ctx.fillStyle = badgeGradient;
        ctx.fill();
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = 'rgba(118, 204, 255, 0.45)';
        ctx.stroke();
        ctx.restore();

        ctx.font = '500 34px "Poppins", sans-serif';
        ctx.fillStyle = 'rgba(215, 236, 255, 0.96)';
        let x = 220;
        const y = baseHeight - 250;
        tags.forEach((tag) => {
            const label = `#${tag}`;
            const widthLabel = ctx.measureText(label).width + 76;
            const heightLabel = 68;
            ctx.save();
            const pillGradient = ctx.createLinearGradient(x, y, x + widthLabel, y + heightLabel);
            pillGradient.addColorStop(0, 'rgba(43, 96, 158, 0.78)');
            pillGradient.addColorStop(1, 'rgba(27, 64, 118, 0.72)');
            roundedRect(ctx, x, y, widthLabel, heightLabel, 40);
            ctx.fillStyle = pillGradient;
            ctx.fill();
            ctx.strokeStyle = 'rgba(138, 214, 255, 0.55)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
            ctx.fillText(label, x + 34, y + 18);
            x += widthLabel + 30;
        });
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 60; i++) {
        const sx = Math.random() * baseWidth;
        const sy = Math.random() * baseHeight;
        const radius = Math.random() * 1.6 + 0.6;
        ctx.fillStyle = `rgba(140, 216, 255, ${0.08 + Math.random() * 0.22})`;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

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
        roughness: 0.18,
        metalness: 0.18,
        transmission: 0.45,
        thickness: 0.42,
        ior: 1.42,
        envMapIntensity: 1.35,
        clearcoat: 0.65,
        clearcoatRoughness: 0.18,
        sheen: 0.55,
        sheenColor: new THREE.Color(0xa9e3ff),
        transparent: true,
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
function createGlowPlane(color = 0x64caff, intensity = 0.9) {
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

let cachedShadowTexture = null;

function getShadowTexture() {
    if (cachedShadowTexture) return cachedShadowTexture;
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.15, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.38)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    cachedShadowTexture = texture;
    return texture;
}

function createShadowPlane(width, height) {
    const geometry = new THREE.PlaneGeometry(width * 1.8, height * 0.68, 1, 1);
    const material = new THREE.MeshBasicMaterial({
        map: getShadowTexture(),
        transparent: true,
        opacity: 0.32,
        depthWrite: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = -3;
    return mesh;
}

// ---------------------------------------------------------------------------
//  Utility: gestore audio procedurale (ambiente + effetti)
// ---------------------------------------------------------------------------
function createAudioController() {
    const state = {
        context: null,
        ambient: null,
        hoverBuffer: null,
        focusBuffer: null,
        isEnabled: false
    };

    function ensureContext() {
        if (state.context || typeof window === 'undefined') return state.context;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return null;
        state.context = new AudioContext();
        return state.context;
    }

    function createNoiseBuffer(type = 'brown') {
        const ctx = state.context;
        if (!ctx) return null;
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < data.length; i++) {
            const white = Math.random() * 2 - 1;
            if (type === 'brown') {
                lastOut = (lastOut + 0.02 * white) / 1.02;
                data[i] = lastOut * 3.5;
            } else {
                data[i] = white;
            }
        }
        return buffer;
    }

    function createHoverBuffer() {
        const ctx = state.context;
        if (!ctx) return null;
        const length = ctx.sampleRate * 0.35;
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            const t = i / length;
            const env = Math.pow(1 - t, 2.2);
            data[i] = Math.sin(440 * t * 6.2831) * env * 0.45;
        }
        return buffer;
    }

    function createFocusBuffer() {
        const ctx = state.context;
        if (!ctx) return null;
        const length = ctx.sampleRate * 0.6;
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            const t = i / length;
            const sweep = 220 + 340 * t * t;
            const env = Math.pow(1 - t, 3.4);
            data[i] = Math.sin(sweep * t * 6.2831) * env * 0.65;
        }
        return buffer;
    }

    function startAmbient() {
        if (!state.context || state.ambient) return;
        const noise = createNoiseBuffer('brown');
        if (!noise) return;
        const filter = state.context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 480;
        const gain = state.context.createGain();
        gain.gain.value = 0.18;
        const source = state.context.createBufferSource();
        source.buffer = noise;
        source.loop = true;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(state.context.destination);
        source.start(0);
        state.ambient = { source, gain };
    }

    function triggerBuffer(buffer, detune = 0) {
        if (!state.context || !buffer) return;
        const source = state.context.createBufferSource();
        source.buffer = buffer;
        source.detune.value = detune;
        const gain = state.context.createGain();
        gain.gain.value = 0.35;
        source.connect(gain);
        gain.connect(state.context.destination);
        source.start(0);
    }

    return {
        ensure() {
            const ctx = ensureContext();
            if (!ctx || state.isEnabled) return;
            state.isEnabled = true;
            state.hoverBuffer = createHoverBuffer();
            state.focusBuffer = createFocusBuffer();
            startAmbient();
        },
        playHover() {
            if (!state.context) return;
            triggerBuffer(state.hoverBuffer, Math.random() * 80 - 40);
        },
        playFocus() {
            if (!state.context) return;
            triggerBuffer(state.focusBuffer, Math.random() * 40 - 20);
        },
        fadeOut() {
            if (state.ambient?.gain) {
                state.ambient.gain.gain.cancelScheduledValues(state.context.currentTime);
                state.ambient.gain.gain.linearRampToValueAtTime(0, state.context.currentTime + 0.6);
            }
        },
        dispose() {
            if (state.ambient?.source) {
                try { state.ambient.source.stop(); } catch (e) { /* noop */ }
            }
            state.ambient = null;
            if (state.context) {
                try { state.context.close(); } catch (e) { /* noop */ }
            }
            state.context = null;
        }
    };
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
    instructions.textContent = 'Drag per orbitare • Hover per mettere in pausa • Clic per flip & focus';
    instructions.style.opacity = '0';

    hudActions.appendChild(exitButton);
    hudActions.appendChild(instructions);
    hud.appendChild(hudInfo);
    hud.appendChild(hudActions);

    chrome.appendChild(hud);

    overlay.appendChild(canvas);
    overlay.appendChild(chrome);
    document.body.appendChild(overlay);

    const audio = createAudioController();

    if (typeof onReady === 'function') {
        onReady({ overlay });
    }

    // -----------------------------
    //  Setup Three.js
    // -----------------------------
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.useLegacyLights = false;
    renderer.physicallyCorrectLights = true;
    renderer.shadowMap.enabled = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    const scene = new THREE.Scene();
    scene.background = null;

    RectAreaLightUniformsLib.init();

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    let environmentTexture = null;
    let environmentRenderTarget = null;
    new RGBELoader()
        .setPath('./assets/3d/env/')
        .load(
            'solitude_night_4k.hdr',
            (hdr) => {
                environmentRenderTarget = pmremGenerator.fromEquirectangular(hdr);
                environmentTexture = environmentRenderTarget.texture;
                scene.environment = environmentTexture;
                scene.background = environmentTexture;
                hdr.dispose();
                pmremGenerator.dispose();
            },
            undefined,
            () => {
                pmremGenerator.dispose();
                scene.background = new THREE.Color(0x05070d);
            }
        );

    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 200);
    const cameraIdleOffset = new THREE.Vector3(0.1, 1.6, 8.2);
    const cameraFocusOffset = new THREE.Vector3(-0.15, 1.2, 5.1);
    camera.position.copy(cameraIdleOffset);
    scene.add(camera);
    const cameraLookTarget = new THREE.Vector3(0, 1.05, 0);
    let cameraLookBaseY = 1.05;

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.75, 0.62);
    composer.addPass(bloomPass);
    const lutPass = new ShaderPass(ColorCorrectionShader);
    lutPass.uniforms.powRGB.value.set(1.08, 1.02, 1.12);
    lutPass.uniforms.mulRGB.value.set(1.06, 1.02, 1.18);
    lutPass.uniforms.addRGB.value.set(0.008, 0.006, -0.01);
    composer.addPass(lutPass);

    // -----------------------------
    //  Illuminazione fisica
    // -----------------------------
    const lightRig = new THREE.Group();
    scene.add(lightRig);

    const ambient = new THREE.AmbientLight(0x101b2c, 0.38);
    lightRig.add(ambient);

    const hemi = new THREE.HemisphereLight(0x1a3658, 0x05070c, 0.22);
    hemi.position.set(0, 6, 0);
    lightRig.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffd6aa, 2.1);
    keyLight.position.set(6.4, 7.2, 4.6);
    keyLight.target.position.set(0, 1.2, 0);
    lightRig.add(keyLight);
    lightRig.add(keyLight.target);

    const rimLight = new THREE.DirectionalLight(0x7abfff, 1.6);
    rimLight.position.set(-5.6, 3.9, -4.8);
    rimLight.target.position.set(0, 1.3, 0);
    lightRig.add(rimLight);
    lightRig.add(rimLight.target);

    const coolRect = new THREE.RectAreaLight(0x76d4ff, 1.55, 4.6, 2.6);
    coolRect.position.set(-2.6, 3.5, 4.2);
    coolRect.lookAt(0, 1.2, 0);
    lightRig.add(coolRect);

    const warmRect = new THREE.RectAreaLight(0xffa475, 1.1, 3.6, 2.2);
    warmRect.position.set(2.8, 2.7, -3.8);
    warmRect.lookAt(0, 1.1, 0);
    lightRig.add(warmRect);

    const crystalSpot = new THREE.SpotLight(0x9bdcff, 1.25, 28, Math.PI / 5.2, 0.45, 1.3);
    crystalSpot.position.set(-3.2, 6.1, 3.6);
    crystalSpot.target.position.set(0, 1.05, 0);
    lightRig.add(crystalSpot);
    lightRig.add(crystalSpot.target);

    const warmSpot = new THREE.SpotLight(0xff9966, 0.95, 24, Math.PI / 5.5, 0.55, 1.2);
    warmSpot.position.set(4.1, 5.2, -2.8);
    warmSpot.target.position.set(0, 1.0, 0);
    lightRig.add(warmSpot);
    lightRig.add(warmSpot.target);

    const fillLight = new THREE.PointLight(0x1a3b5e, 0.7, 36, 2.4);
    fillLight.position.set(-2.8, 2.0, 6.4);
    lightRig.add(fillLight);

    const bounceLight = new THREE.PointLight(0x0d192f, 0.6, 32, 2.3);
    bounceLight.position.set(2.6, -0.8, -5.2);
    lightRig.add(bounceLight);

    const glintLight = new THREE.PointLight(0x3f6dff, 0.45, 18, 1.6);
    glintLight.position.set(0, 3.5, -6.4);
    lightRig.add(glintLight);

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
    const lowFaceGeometry = new THREE.PlaneGeometry(cardWidth * 0.9, cardHeight * 0.9, 1, 1);

    const introTimeline = gsap.timeline({ delay: 0.22, defaults: { ease: 'power4.out' } });

    const CARD_VISUAL_PRESETS = {
        idle: {
            scale: 1,
            tiltX: 0,
            tiltZ: 0,
            glow: 0.55,
            rim: 1.35,
            shadow: 0.26
        },
        hover: {
            scale: 1.07,
            tiltX: THREE.MathUtils.degToRad(-4.2),
            tiltZ: THREE.MathUtils.degToRad(4.6),
            glow: 0.85,
            rim: 2.1,
            shadow: 0.36
        },
        active: {
            scale: 1.18,
            tiltX: THREE.MathUtils.degToRad(-6.2),
            tiltZ: THREE.MathUtils.degToRad(6.8),
            glow: 1.15,
            rim: 3,
            shadow: 0.48
        }
    };

    cards.forEach((card, index) => {
        const cardRoot = new THREE.Group();
        cardRoot.name = card.title;
        const pivot = new THREE.Group();
        const lod = new THREE.LOD();
        const visual = new THREE.Group();
        const lowVisual = new THREE.Group();
        lod.addLevel(visual, 0);
        lod.addLevel(lowVisual, 5.4);
        pivot.add(lod);
        cardRoot.add(pivot);

        const shadow = createShadowPlane(cardWidth, cardHeight);
        shadow.position.y = -cardHeight * 0.62;
        shadow.material.opacity = CARD_VISUAL_PRESETS.idle.shadow;
        cardRoot.add(shadow);

        const rimMaterial = createRimMaterial({ color: 0x0d1828 });
        const frame = new THREE.Mesh(bodyGeometry, rimMaterial);
        frame.castShadow = false;
        frame.receiveShadow = false;

        const frontTexture = createCardTexture(card);
        const frontMaterial = new THREE.MeshPhysicalMaterial({
            map: frontTexture,
            roughness: 0.18,
            metalness: 0.06,
            transmission: 0.32,
            thickness: 0.38,
            envMapIntensity: 1.45,
            clearcoat: 0.75,
            clearcoatRoughness: 0.2,
            sheen: 0.18,
            sheenColor: new THREE.Color(0xc5e8ff),
            emissive: new THREE.Color(0x0b2036),
            emissiveIntensity: 0.22,
            iridescence: 0.12,
            iridescenceIOR: 1.25,
            transparent: true,
            opacity: 1
        });
        const frontFace = new THREE.Mesh(faceGeometry, frontMaterial);
        frontFace.position.z = cardDepth * 0.55;
        frontFace.castShadow = false;
        frontFace.userData.parentGroup = cardRoot;

        const lowMaterial = new THREE.MeshBasicMaterial({
            map: frontTexture,
            transparent: true,
            depthWrite: false,
            opacity: 0.9
        });
        const lowPlane = new THREE.Mesh(lowFaceGeometry, lowMaterial);
        lowPlane.position.z = cardDepth * 0.52;
        lowVisual.add(lowPlane);

        const backTexture = createCardBackTexture(card);
        const backMaterial = new THREE.MeshPhysicalMaterial({
            map: backTexture,
            roughness: 0.24,
            metalness: 0.08,
            transmission: 0.18,
            thickness: 0.28,
            envMapIntensity: 1.25,
            clearcoat: 0.6,
            clearcoatRoughness: 0.22,
            sheen: 0.14,
            sheenColor: new THREE.Color(0x8bc8ff),
            emissive: new THREE.Color(0x071120),
            emissiveIntensity: 0.16,
            transparent: true,
            opacity: 1
        });
        const backFace = new THREE.Mesh(faceGeometry, backMaterial);
        backFace.position.z = -cardDepth * 0.55;
        backFace.rotation.y = Math.PI;
        backFace.userData.parentGroup = cardRoot;

        const glow = createGlowPlane(0x70d8ff, 0.65);
        glow.position.z = -cardDepth * 0.95;
        glow.material.opacity = CARD_VISUAL_PRESETS.idle.glow;

        visual.add(frame, frontFace, backFace, glow);
        cardRoot.userData = {
            card,
            pivot,
            visual,
            lod,
            lowVisual,
            lowMaterial,
            lowPlane,
            frame,
            frontFace,
            backFace,
            glow,
            shadow,
            rimMaterial,
            frontTexture,
            backTexture,
            frontMaterial,
            backMaterial,
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
        syncCardVisual(cardRoot, { immediate: true });
        introTimeline.fromTo(cardRoot.position, { y: y + 1.4, x: x * 1.08, z: z * 1.08 }, { y, x, z, duration: 1.2 }, index * 0.08);
        introTimeline.fromTo(visual.scale, { x: 0.3, y: 0.3, z: 0.3 }, { x: 1, y: 1, z: 1, duration: 1.05 }, index * 0.08);
        introTimeline.fromTo(glow.material, { opacity: 0 }, { opacity: glow.material.opacity, duration: 0.8 }, index * 0.08 + 0.1);
    });

    // -----------------------------
    //  Stato interazione e animazioni
    // -----------------------------
    let pointer = new THREE.Vector2();
    const parallaxTarget = new THREE.Vector2();
    const parallaxCurrent = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    let hoveredGroup = null;
    let activeGroup = null;
    let needsRaycast = false;
    let isPointerDown = false;
    let dragStartX = 0;
    const rotationState = { current: 0, target: 0, velocity: 0 };
    let rotationTween = null;
    let autoRotate = true;
    let animationFrame = null;
    let overlayHovered = false;
    let isClosing = false;
    let hasInteracted = false;
    const tmpCameraDir = new THREE.Vector3();
    const tmpCameraOffset = new THREE.Vector3();
    const tmpDesiredCamera = new THREE.Vector3();
    const tmpLookBase = new THREE.Vector3();
    const tmpLookBlend = new THREE.Vector3();
    const focusAnchor = new THREE.Vector3();

    const autoRotateStrength = { value: 1 };

    const focusState = { value: 0 };
    const focusTimeline = gsap.timeline({ paused: true });
    focusTimeline.to(lutPass.uniforms.mulRGB.value, { x: 1.18, y: 1.05, z: 1.28, duration: 1.2, ease: 'power4.inOut' }, 0);
    focusTimeline.to(lutPass.uniforms.powRGB.value, { x: 1.28, y: 1.08, z: 1.42, duration: 1.2, ease: 'power4.inOut' }, 0);
    focusTimeline.to(lutPass.uniforms.addRGB.value, { x: 0.02, y: 0.012, z: -0.018, duration: 1.2, ease: 'power4.inOut' }, 0);
    focusTimeline.to(bloomPass, { strength: 0.52, radius: 0.82, threshold: 0.6, duration: 1.15, ease: 'power4.inOut' }, 0);
    focusTimeline.to(focusState, { value: 1, duration: 1.15, ease: 'power4.inOut' }, 0);
    focusTimeline.eventCallback('onReverseComplete', () => {
        focusState.value = 0;
    });

    function handleFirstInteraction() {
        if (hasInteracted) return;
        hasInteracted = true;
        audio.ensure();
    }

    function setAutoRotateStrength(value) {
        gsap.to(autoRotateStrength, { value, duration: 0.6, ease: 'power2.out' });
    }

    function animateRimStrength(material, value, { duration = 0.6, ease = 'power2.out' } = {}) {
        material.userData.targetRimStrength = value;
        const shader = material.userData.shader;
        if (shader && shader.uniforms?.rimStrength) {
            gsap.to(shader.uniforms.rimStrength, { value, duration, ease });
        }
    }

    function applyCardPreset(group, presetKey, { immediate = false } = {}) {
        const preset = CARD_VISUAL_PRESETS[presetKey] || CARD_VISUAL_PRESETS.idle;
        const { visual, glow, rimMaterial, shadow, frontMaterial, backMaterial } = group.userData;
        const duration = immediate ? 0.001 : (presetKey === 'active' ? 0.58 : 0.42);
        gsap.killTweensOf(visual.scale);
        gsap.killTweensOf(visual.rotation);
        gsap.killTweensOf(glow.material);
        gsap.to(visual.scale, {
            x: preset.scale,
            y: preset.scale,
            z: preset.scale,
            duration,
            ease: 'power3.out'
        });
        gsap.to(visual.rotation, {
            x: preset.tiltX,
            y: 0,
            z: preset.tiltZ,
            duration,
            ease: 'power3.out'
        });
        gsap.to(glow.material, {
            opacity: preset.glow,
            duration: Math.max(0.3, duration * 0.75),
            ease: 'power2.out'
        });
        if (shadow) {
            gsap.to(shadow.material, {
                opacity: preset.shadow,
                duration: Math.max(0.28, duration * 0.65),
                ease: 'power2.out'
            });
        }
        if (frontMaterial) {
            const targetEmissive = presetKey === 'active' ? 0.36 : presetKey === 'hover' ? 0.28 : 0.22;
            const targetEnv = presetKey === 'active' ? 1.75 : presetKey === 'hover' ? 1.55 : 1.45;
            const targetTransmission = presetKey === 'active' ? 0.38 : presetKey === 'hover' ? 0.34 : 0.32;
            const targetClearcoat = presetKey === 'active' ? 0.9 : presetKey === 'hover' ? 0.82 : 0.75;
            gsap.to(frontMaterial, {
                emissiveIntensity: targetEmissive,
                envMapIntensity: targetEnv,
                transmission: targetTransmission,
                clearcoat: targetClearcoat,
                duration: Math.max(0.32, duration * 0.9),
                ease: 'power2.out'
            });
        }
        if (backMaterial) {
            const targetEmissive = presetKey === 'active' ? 0.24 : presetKey === 'hover' ? 0.2 : 0.16;
            const targetEnv = presetKey === 'active' ? 1.45 : presetKey === 'hover' ? 1.32 : 1.25;
            gsap.to(backMaterial, {
                emissiveIntensity: targetEmissive,
                envMapIntensity: targetEnv,
                duration: Math.max(0.32, duration * 0.9),
                ease: 'power2.out'
            });
        }
        animateRimStrength(rimMaterial, preset.rim, { duration: Math.max(0.28, duration * 0.85) });
    }

    function syncCardVisual(group, { immediate = false } = {}) {
        if (!group) return;
        const presetKey = group.userData.isActive ? 'active' : group.userData.isHover ? 'hover' : 'idle';
        applyCardPreset(group, presetKey, { immediate });
    }

    function flipCard(group, showBack, { immediate = false } = {}) {
        if (!group) return;
        const { pivot } = group.userData;
        gsap.killTweensOf(pivot.rotation);
        gsap.killTweensOf(pivot.position);
        if (immediate) {
            pivot.rotation.y = showBack ? Math.PI : 0;
            pivot.position.z = showBack ? -0.04 : 0;
            return;
        }
        gsap.to(pivot.rotation, {
            y: showBack ? Math.PI : 0,
            duration: 0.88,
            ease: 'expo.inOut',
            overwrite: true
        });
        gsap.to(pivot.position, {
            z: showBack ? -0.04 : 0,
            duration: 0.68,
            ease: 'power3.out'
        });
    }

    function releaseActiveCard({ immediate = false } = {}) {
        if (!activeGroup) return;
        activeGroup.userData.isActive = false;
        flipCard(activeGroup, false, { immediate });
        syncCardVisual(activeGroup, { immediate });
        if (focusTimeline.progress() > 0) {
            if (immediate) {
                focusTimeline.pause(0);
                focusState.value = 0;
            } else {
                focusTimeline.timeScale(1).reverse();
            }
        } else {
            focusState.value = 0;
        }
        rotationTween?.kill?.();
        rotationTween = null;
        rotationState.velocity = 0;
        activeGroup = null;
        if (!isPointerDown) {
            autoRotate = true;
        }
        setAutoRotateStrength(overlayHovered ? 0.18 : 1);
        focusAnchor.set(0, cameraLookBaseY, 0);
    }

    function activateCard(group) {
        if (!group) return;
        if (activeGroup === group) {
            releaseActiveCard();
            return;
        }
        if (activeGroup) {
            flipCard(activeGroup, false);
            activeGroup.userData.isActive = false;
            syncCardVisual(activeGroup);
        }
        activeGroup = group;
        activeGroup.userData.isActive = true;
        syncCardVisual(activeGroup);
        focusAnchor.copy(activeGroup.position);
        flipCard(activeGroup, true);
        rotationTween?.kill?.();
        rotationState.velocity = 0;
        const desiredBase = -group.userData.baseAngle;
        const twoPi = Math.PI * 2;
        let desiredRotation = desiredBase;
        let current = rotationState.target;
        while (desiredRotation - current > Math.PI) desiredRotation -= twoPi;
        while (desiredRotation - current < -Math.PI) desiredRotation += twoPi;
        const rotationProxy = { value: rotationState.target };
        rotationTween = gsap.to(rotationProxy, {
            value: desiredRotation,
            duration: 1.1,
            ease: 'power4.inOut',
            onUpdate: () => { rotationState.target = rotationProxy.value; },
            onComplete: () => { rotationTween = null; rotationState.velocity = 0; }
        });
        focusTimeline.timeScale(1).restart(true);
        autoRotate = false;
        setAutoRotateStrength(0.02);
        audio.playFocus();
    }

    // -----------------------------
    //  Eventi
    // -----------------------------
    function updatePointerFromEvent(event) {
        const rect = canvas.getBoundingClientRect();
        const coords = extractClientCoords(event);
        const x = rect.width ? (coords.clientX - rect.left) / rect.width : 0.5;
        const y = rect.height ? (coords.clientY - rect.top) / rect.height : 0.5;
        pointer.set(x * 2 - 1, -(y * 2 - 1));
        const px = THREE.MathUtils.clamp(x - 0.5, -0.6, 0.6);
        const py = THREE.MathUtils.clamp(y - 0.5, -0.6, 0.6);
        parallaxTarget.set(px, py);
        needsRaycast = true;
    }

    function extractClientCoords(event) {
        if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
            return { clientX: event.clientX, clientY: event.clientY };
        }
        if (event && event.touches && event.touches.length) {
            return { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY };
        }
        if (event && event.changedTouches && event.changedTouches.length) {
            return { clientX: event.changedTouches[0].clientX, clientY: event.changedTouches[0].clientY };
        }
        const rect = canvas.getBoundingClientRect();
        return { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    }

    function onPointerMove(event) {
        updatePointerFromEvent(event);
    }

    function onPointerDown(event) {
        updatePointerFromEvent(event);
        handleFirstInteraction();
        isPointerDown = true;
        autoRotate = false;
        rotationState.velocity = 0;
        const { clientX } = extractClientCoords(event);
        dragStartX = clientX || 0;
        overlay.classList.add('is-dragging');
        rotationTween?.kill?.();
        rotationTween = null;
        setAutoRotateStrength(0.06);
        needsRaycast = true;
        if (event.pointerId !== undefined && overlay.setPointerCapture) {
            try { overlay.setPointerCapture(event.pointerId); } catch (err) { /* ignore */ }
        }
    }

    function onPointerMoveDrag(event) {
        if (!isPointerDown) return;
        const clientX = event.clientX || (event.touches && event.touches[0].clientX) || 0;
        const deltaX = clientX - dragStartX;
        dragStartX = clientX;
        rotationState.velocity = THREE.MathUtils.clamp(deltaX * 0.0035, -0.25, 0.25);
        rotationState.target += rotationState.velocity;
    }

    function onPointerUp(event) {
        isPointerDown = false;
        if (Math.abs(rotationState.velocity) < 0.01) {
            rotationState.velocity = 0;
        }
        if (!activeGroup) {
            autoRotate = true;
            setAutoRotateStrength(overlayHovered ? 0.18 : 1);
        }
        overlay.classList.remove('is-dragging');
        needsRaycast = true;
        if (event && event.pointerId !== undefined && overlay.releasePointerCapture) {
            try { overlay.releasePointerCapture(event.pointerId); } catch (err) { /* ignore */ }
        }
    }

    function onCanvasClick() {
        if (!hoveredGroup) return;
        activateCard(hoveredGroup);
    }

    function onOverlayEnter() {
        overlayHovered = true;
        if (!activeGroup && !isPointerDown) {
            autoRotate = true;
        }
        setAutoRotateStrength(0.18);
        needsRaycast = true;
    }

    function onOverlayLeave() {
        overlayHovered = false;
        if (!activeGroup && !isPointerDown) {
            autoRotate = true;
        }
        setAutoRotateStrength(1);
        parallaxTarget.set(0, 0);
        if (hoveredGroup && !hoveredGroup.userData.isActive) {
            hoveredGroup.userData.isHover = false;
            syncCardVisual(hoveredGroup);
        }
        hoveredGroup = null;
        needsRaycast = true;
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
        handleFirstInteraction();
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
            syncCardVisual(hoveredGroup);
            hoveredGroup = null;
        }
        audio.fadeOut();
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

    const handleExitHover = () => { if (hasInteracted) audio.playHover(); };
    exitButton.addEventListener('click', closeOverlay);
    exitButton.addEventListener('mouseenter', handleExitHover);
    exitButton.addEventListener('focus', handleExitHover);

    // -----------------------------
    //  Layout responsive
    // -----------------------------
    function updateRendererSize() {
        const width = overlay.clientWidth;
        const height = overlay.clientHeight;
        renderer.setSize(width, height, false);
        const ratioCap = width < 720 ? 1.2 : 1.6;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ratioCap));
        composer.setSize(width, height);
        if (composer.setPixelRatio) {
            composer.setPixelRatio(renderer.getPixelRatio());
        }
        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        const mobile = width < 720;
        const idleTarget = mobile
            ? { x: 0.06, y: 1.35, z: 9.3 }
            : { x: 0.12, y: 1.62, z: 8.0 };
        const focusTarget = mobile
            ? { x: -0.04, y: 1.05, z: 5.6 }
            : { x: -0.18, y: 1.18, z: 5.05 };
        gsap.to(cameraIdleOffset, { ...idleTarget, duration: 0.8, ease: 'power2.out' });
        gsap.to(cameraFocusOffset, { ...focusTarget, duration: 0.8, ease: 'power2.out' });
        cameraLookBaseY = mobile ? 0.94 : 1.05;
    }
    updateRendererSize();
    camera.position.set(cameraIdleOffset.x, cameraIdleOffset.y - 0.5, cameraIdleOffset.z + 5.2);
    cameraLookTarget.set(0, cameraLookBaseY, 0);
    focusAnchor.set(0, cameraLookBaseY, 0);
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
            rotationState.target += delta * 0.12 * autoRotateStrength.value;
        }
        if (!isPointerDown && Math.abs(rotationState.velocity) > 0.0001) {
            rotationState.target += rotationState.velocity;
            rotationState.velocity = THREE.MathUtils.damp(rotationState.velocity, 0, 6, delta);
        }
        rotationState.current = THREE.MathUtils.damp(rotationState.current, rotationState.target, 6, delta);

        const focusAmount = focusState.value;
        const cameraBaseOffset = tmpCameraOffset.copy(cameraIdleOffset).lerp(cameraFocusOffset, focusAmount);
        const cameraDir = tmpCameraDir.copy(cameraBaseOffset).normalize();
        tmpDesiredCamera.copy(cameraBaseOffset);
        if (!activeGroup) {
            focusAnchor.set(0, cameraLookBaseY, 0);
        }

        cardGroups.forEach((group) => {
            const angle = group.userData.baseAngle + rotationState.current;
            const focus = group === activeGroup ? focusAmount : 0;
            const orbitRadius = cardRadius - focus * 0.95;
            const baseX = Math.cos(angle) * orbitRadius;
            const baseZ = Math.sin(angle) * orbitRadius;
            const baseY = Math.sin(angle * 2.0) * 0.35;
            const pull = focus * 1.35;
            const x = baseX + cameraDir.x * pull;
            const y = baseY + cameraDir.y * pull + focus * 0.3;
            const z = baseZ + cameraDir.z * pull;
            group.position.set(x, y, z);
            const lookY = THREE.MathUtils.lerp(0.18, 0.52, focus);
            group.lookAt(tmpDesiredCamera.x, lookY, tmpDesiredCamera.z);
            if (group === activeGroup) {
                group.getWorldPosition(focusAnchor);
            }
            group.userData.lod?.update(camera);
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
            syncCardVisual(hoveredGroup);
        }

        hoveredGroup = newGroup;
        if (hoveredGroup) {
            hoveredGroup.userData.isHover = true;
            syncCardVisual(hoveredGroup);
            audio.playHover();
        }
    }

    let previousTime = performance.now();
    function animate() {
        const now = performance.now();
        const delta = (now - previousTime) / 1000;
        previousTime = now;

        updateCarousel(delta);
        updateHover();

        const parallaxEase = overlayHovered ? 6 : 4;
        parallaxCurrent.x = THREE.MathUtils.damp(parallaxCurrent.x, parallaxTarget.x, parallaxEase, delta);
        parallaxCurrent.y = THREE.MathUtils.damp(parallaxCurrent.y, parallaxTarget.y, parallaxEase, delta);
        const focusAmount = focusState.value;
        const baseOffset = tmpDesiredCamera.copy(cameraIdleOffset).lerp(cameraFocusOffset, focusAmount);
        const desiredX = baseOffset.x + parallaxCurrent.x * 1.25;
        const desiredY = baseOffset.y + parallaxCurrent.y * 0.75;
        const desiredZ = baseOffset.z + parallaxCurrent.y * -0.38;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredX, 7, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredY, 7, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredZ, 7, delta);
        tmpLookBase.set(0, cameraLookBaseY, 0);
        tmpLookBlend.copy(tmpLookBase);
        if (activeGroup) {
            tmpLookBlend.lerp(focusAnchor, focusAmount);
        }
        tmpLookBlend.x += parallaxCurrent.x * 0.85;
        tmpLookBlend.y += parallaxCurrent.y * 0.35;
        tmpLookBlend.z += parallaxCurrent.y * -0.25;
        cameraLookTarget.x = THREE.MathUtils.damp(cameraLookTarget.x, tmpLookBlend.x, 6, delta);
        cameraLookTarget.y = THREE.MathUtils.damp(cameraLookTarget.y, tmpLookBlend.y, 6, delta);
        cameraLookTarget.z = THREE.MathUtils.damp(cameraLookTarget.z, tmpLookBlend.z, 6, delta);
        camera.lookAt(cameraLookTarget);

        composer.render();
        animationFrame = requestAnimationFrame(animate);
    }
    animationFrame = requestAnimationFrame(animate);

    gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'power4.out' });
    gsap.fromTo(hud, { y: -40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'power4.out', delay: 0.2 });
    gsap.fromTo(exitButton, { y: -24, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power4.out', delay: 0.35 });
    gsap.fromTo(instructions, { opacity: 0 }, { opacity: 0.85, duration: 1.2, ease: 'power2.out', delay: 0.6 });

    function destroy() {
        releaseActiveCard({ immediate: true });
        focusTimeline.pause(0);
        focusState.value = 0;
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
        overlay.removeEventListener('touchend', onPointerUp);
        overlay.removeEventListener('mouseenter', onOverlayEnter);
        overlay.removeEventListener('mouseleave', onOverlayLeave);
        overlay.removeEventListener('touchcancel', onPointerUp);
        overlay.removeEventListener('click', handleOverlayClick);
        window.removeEventListener('keydown', handleKey);
        exitButton.removeEventListener('click', closeOverlay);
        exitButton.removeEventListener('mouseenter', handleExitHover);
        exitButton.removeEventListener('focus', handleExitHover);
        overlay.remove();
        renderer.dispose();
        composer.dispose();
        scene.remove(carouselGroup, ambient, keyLight, keyLight.target, rimLight, rimLight.target, fillLight, bounceLight);
        scene.environment = null;
        scene.background = null;
        environmentRenderTarget?.dispose?.();
        environmentRenderTarget = null;
        environmentTexture = null;
        cardGroups.forEach(({ userData }) => {
            userData.frontTexture?.dispose?.();
            userData.backTexture?.dispose?.();
            userData.frontFace?.material?.dispose?.();
            userData.backFace?.material?.dispose?.();
            userData.glow?.material?.dispose?.();
            userData.rimMaterial?.dispose?.();
            userData.lowMaterial?.dispose?.();
        });
        bodyGeometry.dispose();
        faceGeometry.dispose();
        lowFaceGeometry.dispose();
        audio.dispose();
    }

    return { destroy: closeOverlay, overlay, renderer, composer };
}
