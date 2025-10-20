import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { ColorCorrectionShader } from 'three/examples/jsm/shaders/ColorCorrectionShader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm';

const VignetteShader = {
    uniforms: {
        tDiffuse: { value: null },
        offset: { value: 1.15 },
        darkness: { value: 1.35 },
        tint: { value: new THREE.Vector3(1.08, 0.98, 0.88) }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform float offset;
        uniform float darkness;
        uniform vec3 tint;
        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            vec2 position = vUv - vec2(0.5);
            float len = length(position);
            float vignette = smoothstep(0.5, offset, len);
            float vig = clamp(1.0 - vignette * darkness, 0.0, 1.0);
            vec3 graded = color.rgb * tint;
            gl_FragColor = vec4(graded * vig, color.a);
        }
    `
};

// ---------------------------------------------------------------------------
//  Utility: generazione texture 2D per le card (Canvas2D => Texture Three.js)
// ---------------------------------------------------------------------------

function createCardTexture(card) {
    const baseWidth = 1024;
    const baseHeight = 1536;
    const scale = window.devicePixelRatio > 1 ? 0.78 : 0.62;
    const width = Math.round(baseWidth * scale);
    const height = Math.round(baseHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    ctx.clearRect(0, 0, baseWidth, baseHeight);

    const cosmic = ctx.createLinearGradient(0, 0, baseWidth, baseHeight);
    cosmic.addColorStop(0, '#020613');
    cosmic.addColorStop(0.45, '#05152c');
    cosmic.addColorStop(1, '#0b1727');
    ctx.fillStyle = cosmic;
    ctx.fillRect(0, 0, baseWidth, baseHeight);

    const flareOne = ctx.createRadialGradient(baseWidth * 0.15, baseHeight * 0.12, 20, baseWidth * 0.15, baseHeight * 0.12, baseWidth * 0.9);
    flareOne.addColorStop(0, 'rgba(126, 240, 255, 0.45)');
    flareOne.addColorStop(0.4, 'rgba(76, 160, 255, 0.26)');
    flareOne.addColorStop(1, 'rgba(12, 34, 62, 0)');
    const flareTwo = ctx.createRadialGradient(baseWidth * 0.85, baseHeight * 0.82, 10, baseWidth * 0.85, baseHeight * 0.82, baseWidth * 0.75);
    flareTwo.addColorStop(0, 'rgba(255, 184, 130, 0.38)');
    flareTwo.addColorStop(0.6, 'rgba(160, 90, 30, 0.12)');
    flareTwo.addColorStop(1, 'rgba(24, 36, 52, 0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = flareOne;
    ctx.fillRect(0, 0, baseWidth, baseHeight);
    ctx.fillStyle = flareTwo;
    ctx.fillRect(0, 0, baseWidth, baseHeight);
    ctx.restore();

    ctx.save();
    ctx.shadowColor = 'rgba(130, 224, 255, 0.4)';
    ctx.shadowBlur = 72;
    roundedRect(ctx, 52, 58, baseWidth - 104, baseHeight - 116, 96);
    ctx.fillStyle = 'rgba(5, 12, 24, 0.92)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3.6;
    ctx.strokeStyle = 'rgba(164, 236, 255, 0.55)';
    ctx.stroke();
    ctx.restore();

    ctx.save();
    const innerGlass = ctx.createLinearGradient(120, 150, baseWidth - 120, baseHeight - 280);
    innerGlass.addColorStop(0, 'rgba(18, 40, 72, 0.92)');
    innerGlass.addColorStop(0.55, 'rgba(16, 34, 58, 0.82)');
    innerGlass.addColorStop(1, 'rgba(14, 24, 46, 0.94)');
    roundedRect(ctx, 120, 150, baseWidth - 240, baseHeight - 300, 78);
    ctx.fillStyle = innerGlass;
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = 'rgba(108, 210, 255, 0.38)';
    ctx.stroke();

    const verticalSheen = ctx.createLinearGradient(140, 160, baseWidth - 140, baseHeight - 320);
    verticalSheen.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
    verticalSheen.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
    verticalSheen.addColorStop(1, 'rgba(255, 255, 255, 0.26)');
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = verticalSheen;
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const topBand = ctx.createLinearGradient(160, 210, baseWidth - 160, 360);
    topBand.addColorStop(0, 'rgba(96, 170, 255, 0.55)');
    topBand.addColorStop(0.6, 'rgba(88, 214, 255, 0.36)');
    topBand.addColorStop(1, 'rgba(255, 176, 120, 0.4)');
    roundedRect(ctx, 160, 210, baseWidth - 320, 210, 56);
    ctx.fillStyle = topBand;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(126, 220, 255, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(200, 470);
    ctx.lineTo(baseWidth - 200, 470);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#f6fbff';
    ctx.font = '700 94px "Poppins", sans-serif';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(2, 8, 18, 0.7)';
    ctx.shadowBlur = 18;
    wrapText(ctx, card.title.toUpperCase(), 224, 214, baseWidth - 448, 102);
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(210, 234, 255, 0.94)';
    ctx.font = '600 56px "Poppins", sans-serif';
    wrapText(ctx, card.subtitle || '', 224, 392, baseWidth - 448, 72);

    ctx.fillStyle = 'rgba(208, 224, 245, 0.92)';
    ctx.font = '400 46px "Poppins", sans-serif';
    wrapText(ctx, card.summary || card.detail || '', 216, 568, baseWidth - 432, 64);
    ctx.restore();

    const highlights = Array.isArray(card.highlights) ? card.highlights.slice(0, 4) : [];
    if (highlights.length) {
        ctx.font = '500 42px "Poppins", sans-serif';
        let hy = 808;
        highlights.forEach((item) => {
            ctx.save();
            const pulse = ctx.createLinearGradient(206, hy, 246, hy + 58);
            pulse.addColorStop(0, 'rgba(118, 224, 255, 0.98)');
            pulse.addColorStop(1, 'rgba(255, 186, 134, 0.86)');
            roundedRect(ctx, 206, hy, 32, 58, 22);
            ctx.fillStyle = pulse;
            ctx.fill();
            ctx.restore();

            ctx.fillStyle = 'rgba(216, 236, 255, 0.96)';
            wrapText(ctx, item, 262, hy + 6, baseWidth - 480, 66);
            hy += 94;
        });
    }

    const tags = Array.isArray(card.tags) ? card.tags : [];
    if (tags.length) {
        ctx.save();
        const footerY = baseHeight - 280;
        roundedRect(ctx, 186, footerY, baseWidth - 372, 224, 68);
        const footerGradient = ctx.createLinearGradient(186, footerY, baseWidth - 186, footerY + 224);
        footerGradient.addColorStop(0, 'rgba(24, 54, 88, 0.9)');
        footerGradient.addColorStop(1, 'rgba(20, 40, 72, 0.88)');
        ctx.fillStyle = footerGradient;
        ctx.fill();
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = 'rgba(132, 214, 255, 0.48)';
        ctx.stroke();
        ctx.restore();

        ctx.font = '500 40px "Poppins", sans-serif';
        ctx.fillStyle = 'rgba(214, 236, 255, 0.96)';
        let x = 236;
        const y = baseHeight - 232;
        tags.forEach((tag) => {
            const label = `#${tag}`;
            const textWidth = ctx.measureText(label).width;
            const pillWidth = textWidth + 92;
            const pillHeight = 76;
            ctx.save();
            const pillGradient = ctx.createLinearGradient(x, y, x + pillWidth, y + pillHeight);
            pillGradient.addColorStop(0, 'rgba(74, 140, 210, 0.9)');
            pillGradient.addColorStop(1, 'rgba(56, 112, 198, 0.85)');
            roundedRect(ctx, x, y, pillWidth, pillHeight, 44);
            ctx.fillStyle = pillGradient;
            ctx.fill();
            ctx.strokeStyle = 'rgba(160, 228, 255, 0.6)';
            ctx.lineWidth = 2.6;
            ctx.stroke();
            ctx.restore();
            ctx.fillText(label, x + 38, y + 24);
            x += pillWidth + 32;
        });
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 160; i++) {
        const sx = Math.random() * baseWidth;
        const sy = Math.random() * baseHeight;
        const radius = Math.random() * 2 + 0.4;
        ctx.fillStyle = `rgba(140, 230, 255, ${0.05 + Math.random() * 0.22})`;
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
    const scale = window.devicePixelRatio > 1 ? 0.7 : 0.58;
    const width = Math.round(baseWidth * scale);
    const height = Math.round(baseHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    ctx.clearRect(0, 0, baseWidth, baseHeight);

    const background = ctx.createLinearGradient(0, 0, 0, baseHeight);
    background.addColorStop(0, '#020713');
    background.addColorStop(0.5, '#05152e');
    background.addColorStop(1, '#020712');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, baseWidth, baseHeight);

    const glowA = ctx.createRadialGradient(baseWidth * 0.18, baseHeight * 0.18, 16, baseWidth * 0.18, baseHeight * 0.18, baseWidth * 0.9);
    glowA.addColorStop(0, 'rgba(124, 232, 255, 0.42)');
    glowA.addColorStop(0.65, 'rgba(40, 110, 196, 0.16)');
    glowA.addColorStop(1, 'rgba(18, 38, 64, 0)');
    const glowB = ctx.createRadialGradient(baseWidth * 0.78, baseHeight * 0.82, 12, baseWidth * 0.78, baseHeight * 0.82, baseWidth * 0.8);
    glowB.addColorStop(0, 'rgba(255, 186, 134, 0.34)');
    glowB.addColorStop(1, 'rgba(30, 52, 82, 0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glowA;
    ctx.fillRect(0, 0, baseWidth, baseHeight);
    ctx.fillStyle = glowB;
    ctx.fillRect(0, 0, baseWidth, baseHeight);
    ctx.restore();

    ctx.save();
    ctx.shadowColor = 'rgba(126, 224, 255, 0.36)';
    ctx.shadowBlur = 56;
    roundedRect(ctx, 68, 72, baseWidth - 136, baseHeight - 144, 92);
    ctx.fillStyle = 'rgba(6, 16, 30, 0.9)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = 'rgba(150, 226, 255, 0.52)';
    ctx.stroke();
    ctx.restore();

    ctx.save();
    roundedRect(ctx, 136, 212, baseWidth - 272, baseHeight - 396, 80);
    const panelGradient = ctx.createLinearGradient(136, 212, baseWidth - 136, baseHeight - 256);
    panelGradient.addColorStop(0, 'rgba(24, 48, 80, 0.9)');
    panelGradient.addColorStop(0.55, 'rgba(18, 36, 66, 0.84)');
    panelGradient.addColorStop(1, 'rgba(14, 28, 52, 0.9)');
    ctx.fillStyle = panelGradient;
    ctx.fill();
    const sheen = ctx.createLinearGradient(136, 212, baseWidth - 136, baseHeight - 396);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
    sheen.addColorStop(0.3, 'rgba(255, 255, 255, 0.06)');
    sheen.addColorStop(0.78, 'rgba(255, 255, 255, 0.2)');
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = sheen;
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.fillStyle = '#f4fbff';
    ctx.font = '700 96px "Poppins", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(4, 10, 24, 0.72)';
    ctx.shadowBlur = 18;
    wrapText(ctx, card.title.toUpperCase(), baseWidth / 2, 240, baseWidth - 280, 104);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';

    ctx.fillStyle = 'rgba(214, 236, 255, 0.94)';
    ctx.font = '600 52px "Poppins", sans-serif';
    wrapText(ctx, card.subtitle || '', 208, 460, baseWidth - 416, 68);

    ctx.fillStyle = 'rgba(255, 190, 142, 0.9)';
    ctx.font = '400 44px "Poppins", sans-serif';
    const summary = card.detail || card.summary || '';
    wrapText(ctx, summary, 208, 640, baseWidth - 416, 62);

    const tags = Array.isArray(card.tags) ? card.tags : [];
    if (tags.length) {
        ctx.save();
        const badgeY = baseHeight - 324;
        roundedRect(ctx, 212, badgeY, baseWidth - 424, 216, 64);
        const badgeGradient = ctx.createLinearGradient(212, badgeY, baseWidth - 212, badgeY + 216);
        badgeGradient.addColorStop(0, 'rgba(26, 56, 92, 0.9)');
        badgeGradient.addColorStop(1, 'rgba(30, 64, 112, 0.86)');
        ctx.fillStyle = badgeGradient;
        ctx.fill();
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = 'rgba(146, 220, 255, 0.5)';
        ctx.stroke();
        ctx.restore();

        ctx.font = '500 38px "Poppins", sans-serif';
        ctx.fillStyle = 'rgba(214, 236, 255, 0.96)';
        let x = 252;
        const y = baseHeight - 272;
        tags.forEach((tag) => {
            const label = `#${tag}`;
            const textWidth = ctx.measureText(label).width;
            const pillWidth = textWidth + 96;
            const pillHeight = 76;
            ctx.save();
            const pillGradient = ctx.createLinearGradient(x, y, x + pillWidth, y + pillHeight);
            pillGradient.addColorStop(0, 'rgba(72, 138, 214, 0.92)');
            pillGradient.addColorStop(1, 'rgba(54, 116, 192, 0.86)');
            roundedRect(ctx, x, y, pillWidth, pillHeight, 46);
            ctx.fillStyle = pillGradient;
            ctx.fill();
            ctx.strokeStyle = 'rgba(160, 224, 255, 0.58)';
            ctx.lineWidth = 2.4;
            ctx.stroke();
            ctx.restore();
            ctx.fillText(label, x + 40, y + 24);
            x += pillWidth + 32;
        });
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 140; i++) {
        const sx = Math.random() * baseWidth;
        const sy = Math.random() * baseHeight;
        const radius = Math.random() * 2 + 0.35;
        ctx.fillStyle = `rgba(134, 224, 255, ${0.04 + Math.random() * 0.22})`;
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

function createRimMaterial({
    color = 0x06101c,
    rimColor = 0x7cd1ff,
    rimStrength = 1.1
} = {}) {
    const material = new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0.22,
        roughness: 0.36,
        transmission: 0.24,
        thickness: 0.28,
        envMapIntensity: 1.1,
        clearcoat: 0.72,
        clearcoatRoughness: 0.34,
        iridescence: 0.12,
        iridescenceIOR: 1.12,
        sheen: 0.18,
        sheenColor: new THREE.Color(0x7cb8ff),
        transparent: true,
        opacity: 0.95
    });

    material.userData.rimColor = new THREE.Color(rimColor);
    material.userData.targetRimStrength = rimStrength;

    material.onBeforeCompile = (shader) => {
        shader.uniforms.rimColor = { value: material.userData.rimColor };
        shader.uniforms.rimStrength = { value: material.userData.targetRimStrength };

        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <common>',
                `#include <common>\n                varying vec3 vWorldNormal;\n                varying vec3 vWorldPosition;`
            )
            .replace(
                '#include <beginnormal_vertex>',
                `#include <beginnormal_vertex>\n                vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
            )
            .replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>\n                vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;`
            );

        shader.fragmentShader = shader.fragmentShader
            .replace(
                '#include <common>',
                `#include <common>\n                varying vec3 vWorldNormal;\n                varying vec3 vWorldPosition;\n                uniform vec3 rimColor;\n                uniform float rimStrength;`
            )
            .replace(
                '#include <emissivemap_fragment>',
                `#include <emissivemap_fragment>\n                vec3 viewDir = normalize(cameraPosition - vWorldPosition);\n                float rimDot = clamp(dot(normalize(vWorldNormal), viewDir), 0.0, 1.0);\n                float rim = pow(1.0 - rimDot, 2.6);\n                totalEmissiveRadiance += rimColor * rim * rimStrength;`
            );

        material.userData.shader = shader;
    };

    material.customProgramCacheKey = () => 'cosmic-rim-material-v1';

    return material;
}

function animateRimStrength(material, target, { duration = 0.45, ease = 'power2.out' } = {}) {
    if (!material) return;
    material.userData.targetRimStrength = target;
    const shader = material.userData.shader;
    if (!shader?.uniforms?.rimStrength) return;
    if (material.userData.rimTween) {
        material.userData.rimTween.kill();
    }
    material.userData.rimTween = gsap.to(shader.uniforms.rimStrength, {
        value: target,
        duration,
        ease,
        onUpdate: () => {
            material.needsUpdate = true;
        }
    });
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
    renderer.physicallyCorrectLights = true;
    renderer.shadowMap.enabled = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.FogExp2(0x04070d, 0.018);

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

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 220);
    const cameraIdleOffset = new THREE.Vector3(0.04, 0.94, 12.4);
    const cameraFocusOffset = new THREE.Vector3(-0.12, 0.84, 6.5);
    camera.position.copy(cameraIdleOffset);
    scene.add(camera);
    const cameraLookTarget = new THREE.Vector3(0, 0.9, 0);
    let cameraLookBaseY = 0.9;

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.26, 0.78, 0.64);
    composer.addPass(bloomPass);
    const lutPass = new ShaderPass(ColorCorrectionShader);
    lutPass.uniforms.powRGB.value.set(1.12, 1.02, 1.18);
    lutPass.uniforms.mulRGB.value.set(1.08, 1.0, 1.24);
    lutPass.uniforms.addRGB.value.set(0.012, 0.004, -0.015);
    composer.addPass(lutPass);
    const vignettePass = new ShaderPass(VignetteShader);
    vignettePass.uniforms.offset.value = 1.05;
    vignettePass.uniforms.darkness.value = 1.4;
    vignettePass.uniforms.tint.value.set(1.08, 0.98, 0.9);
    composer.addPass(vignettePass);

    // -----------------------------
    //  Illuminazione fisica
    // -----------------------------
    const lightRig = new THREE.Group();
    scene.add(lightRig);

    const ambient = new THREE.AmbientLight(0x101b2c, 0.46);
    lightRig.add(ambient);

    const hemi = new THREE.HemisphereLight(0x1a3658, 0x05070c, 0.22);
    hemi.position.set(0, 6, 0);
    lightRig.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffd6aa, 2.3);
    keyLight.position.set(7.2, 7.6, 5.4);
    keyLight.target.position.set(0, 1.2, 0);
    lightRig.add(keyLight);
    lightRig.add(keyLight.target);

    const rimLight = new THREE.DirectionalLight(0x7abfff, 1.75);
    rimLight.position.set(-6.8, 4.4, -5.6);
    rimLight.target.position.set(0, 1.3, 0);
    lightRig.add(rimLight);
    lightRig.add(rimLight.target);

    const coolRect = new THREE.RectAreaLight(0x76d4ff, 1.65, 4.8, 2.8);
    coolRect.position.set(-3.1, 3.6, 4.6);
    coolRect.lookAt(0, 1.2, 0);
    lightRig.add(coolRect);

    const warmRect = new THREE.RectAreaLight(0xffa475, 1.28, 3.9, 2.4);
    warmRect.position.set(3.5, 2.8, -4.1);
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

    const amberLight = new THREE.PointLight(0xffb088, 0.52, 22, 1.9);
    amberLight.position.set(1.4, 4.6, 2.4);
    lightRig.add(amberLight);

    const tealLight = new THREE.PointLight(0x4ab8ff, 0.58, 24, 1.75);
    tealLight.position.set(-1.8, 3.9, -2.9);
    lightRig.add(tealLight);

    const hazePlane = new THREE.Mesh(
        new THREE.PlaneGeometry(18, 10),
        new THREE.MeshBasicMaterial({ color: 0x0c1626, transparent: true, opacity: 0.22, depthWrite: false })
    );
    hazePlane.position.set(0, 2.4, -7.8);
    hazePlane.lookAt(0, 2.2, 0);
    scene.add(hazePlane);

    
    // -----------------------------
    //  Carosello 3D orbitante
    // -----------------------------
    const carouselGroup = new THREE.Group();
    scene.add(carouselGroup);

    const interactableMeshes = [];
    const cardControllers = [];

    const CARD_METRICS = {
        width: 2.12,
        height: 3.08,
        depth: 0.14,
        orbitRadius: 5.9,
        focusRadius: 3.45
    };

    const bodyGeometry = new THREE.BoxGeometry(CARD_METRICS.width, CARD_METRICS.height, CARD_METRICS.depth, 1, 1, 1);
    const faceGeometry = new THREE.PlaneGeometry(CARD_METRICS.width * 0.94, CARD_METRICS.height * 0.92, 1, 1);
    const lowFaceGeometry = new THREE.PlaneGeometry(CARD_METRICS.width * 0.9, CARD_METRICS.height * 0.9, 1, 1);

    const introTimeline = gsap.timeline({ delay: 0.22, defaults: { ease: 'power4.out' } });

    const CARD_VISUAL_PRESETS = {
        idle: {
            scale: 1,
            tiltX: 0,
            tiltZ: 0,
            glow: 0.48,
            rim: 1.2,
            shadow: 0.22
        },
        hover: {
            scale: 1.1,
            tiltX: THREE.MathUtils.degToRad(-4.2),
            tiltZ: THREE.MathUtils.degToRad(4.8),
            glow: 0.85,
            rim: 2.1,
            shadow: 0.3
        },
        active: {
            scale: 1.24,
            tiltX: THREE.MathUtils.degToRad(-6.2),
            tiltZ: THREE.MathUtils.degToRad(6.8),
            glow: 1.18,
            rim: 3.0,
            shadow: 0.44
        },
        dim: {
            scale: 0.9,
            tiltX: THREE.MathUtils.degToRad(-1.1),
            tiltZ: THREE.MathUtils.degToRad(1.1),
            glow: 0.28,
            rim: 0.88,
            shadow: 0.16
        }
    };

    function createCardController(card, index) {
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

        const shadow = createShadowPlane(CARD_METRICS.width, CARD_METRICS.height);
        shadow.position.y = -CARD_METRICS.height * 0.62;
        shadow.material.opacity = CARD_VISUAL_PRESETS.idle.shadow;
        cardRoot.add(shadow);

        const rimMaterial = createRimMaterial({ color: 0x06101c });
        const frame = new THREE.Mesh(bodyGeometry, rimMaterial);
        frame.castShadow = false;
        frame.receiveShadow = false;

        const frontTexture = createCardTexture(card);
        const frontMaterial = new THREE.MeshPhysicalMaterial({
            map: frontTexture,
            roughness: 0.16,
            metalness: 0.08,
            transmission: 0.38,
            thickness: 0.32,
            envMapIntensity: 1.4,
            clearcoat: 0.82,
            clearcoatRoughness: 0.18,
            sheen: 0.2,
            sheenColor: new THREE.Color(0xb8e7ff),
            emissive: new THREE.Color(0x09172a),
            emissiveIntensity: 0.24,
            iridescence: 0.16,
            iridescenceIOR: 1.2,
            transparent: true,
            opacity: 1
        });
        const frontFace = new THREE.Mesh(faceGeometry, frontMaterial);
        frontFace.position.z = CARD_METRICS.depth * 0.55;
        frontFace.castShadow = false;

        const lowMaterial = new THREE.MeshBasicMaterial({
            map: frontTexture,
            transparent: true,
            depthWrite: false,
            opacity: 0.88
        });
        const lowPlane = new THREE.Mesh(lowFaceGeometry, lowMaterial);
        lowPlane.position.z = CARD_METRICS.depth * 0.5;
        lowVisual.add(lowPlane);

        const backTexture = createCardBackTexture(card);
        const backMaterial = new THREE.MeshPhysicalMaterial({
            map: backTexture,
            roughness: 0.22,
            metalness: 0.1,
            transmission: 0.22,
            thickness: 0.26,
            envMapIntensity: 1.25,
            clearcoat: 0.64,
            clearcoatRoughness: 0.22,
            sheen: 0.14,
            sheenColor: new THREE.Color(0x91c8ff),
            emissive: new THREE.Color(0x06101d),
            emissiveIntensity: 0.18,
            transparent: true,
            opacity: 1
        });
        const backFace = new THREE.Mesh(faceGeometry, backMaterial);
        backFace.position.z = -CARD_METRICS.depth * 0.55;
        backFace.rotation.y = Math.PI;

        const glow = createGlowPlane(0x74d4ff, 0.68);
        glow.position.z = -CARD_METRICS.depth * 0.96;
        glow.material.opacity = CARD_VISUAL_PRESETS.idle.glow;

        visual.add(frame, frontFace, backFace, glow);

        const baseAngle = cards.length ? (Math.PI * 2 * index) / cards.length : 0;
        const floatPhase = Math.random() * Math.PI * 2;

        const controller = {
            card,
            group: cardRoot,
            pivot,
            lod,
            visual,
            lowVisual,
            shadow,
            glow,
            rimMaterial,
            frontMaterial,
            backMaterial,
            lowMaterial,
            frontTexture,
            backTexture,
            baseAngle,
            floatPhase,
            isHover: false,
            isActive: false
        };

        frontFace.userData.controller = controller;
        backFace.userData.controller = controller;
        frame.userData.controller = controller;
        controller.interactables = [frontFace, backFace, frame];
        interactableMeshes.push(...controller.interactables);

        const initialRadius = CARD_METRICS.orbitRadius;
        const ix = Math.cos(baseAngle) * initialRadius;
        const iz = Math.sin(baseAngle) * initialRadius;
        const iy = Math.sin(baseAngle * 2) * 0.26;
        cardRoot.position.set(ix, iy, iz);

        carouselGroup.add(cardRoot);
        cardControllers.push(controller);
        applyCardPreset(controller, 'idle', { immediate: true });

        introTimeline.fromTo(cardRoot.position, { x: ix * 1.08, y: iy + 1.6, z: iz * 1.08 }, { x: ix, y: iy, z: iz, duration: 1.2 }, index * 0.08);
        introTimeline.fromTo(visual.scale, { x: 0.3, y: 0.3, z: 0.3 }, { x: 1, y: 1, z: 1, duration: 1.05 }, index * 0.08);
        introTimeline.fromTo(glow.material, { opacity: 0 }, { opacity: CARD_VISUAL_PRESETS.idle.glow, duration: 0.9 }, index * 0.08 + 0.12);

        return controller;
    }

    cards.forEach((card, index) => {
        createCardController(card, index);
    });

    const pointer = new THREE.Vector2();
    const parallaxTarget = new THREE.Vector2();
    const parallaxCurrent = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const tmpCameraDir = new THREE.Vector3();
    const tmpCameraOffset = new THREE.Vector3();
    const tmpDesiredCamera = new THREE.Vector3();
    const tmpLookBase = new THREE.Vector3();
    const tmpLookBlend = new THREE.Vector3();
    const focusAnchor = new THREE.Vector3();
    const tmpTangent = new THREE.Vector3();

    let needsRaycast = false;
    let overlayHovered = false;
    let isClosing = false;
    let hasInteracted = false;

    const interactionState = {
        hovered: null,
        active: null,
        pointerDown: false
    };

    const rotationController = {
        angle: 0,
        target: 0,
        velocity: 0,
        autoEnabled: true,
        autoSpeed: { value: 0.16 }
    };
    let rotationTween = null;
    const AUTO_SPEED_DEFAULT = 0.16;
    const AUTO_SPEED_SLOW = 0.02;

    const focusState = { value: 0 };
    const focusTimeline = gsap.timeline({ paused: true });
    focusTimeline.to(lutPass.uniforms.mulRGB.value, { x: 1.18, y: 1.05, z: 1.28, duration: 1.2, ease: 'power4.inOut' }, 0);
    focusTimeline.to(lutPass.uniforms.powRGB.value, { x: 1.28, y: 1.08, z: 1.42, duration: 1.2, ease: 'power4.inOut' }, 0);
    focusTimeline.to(lutPass.uniforms.addRGB.value, { x: 0.02, y: 0.012, z: -0.018, duration: 1.2, ease: 'power4.inOut' }, 0);
    focusTimeline.to(bloomPass, { strength: 0.48, radius: 0.74, threshold: 0.62, duration: 1.1, ease: 'power4.inOut' }, 0);
    focusTimeline.to(focusState, { value: 1, duration: 1.05, ease: 'power4.inOut' }, 0);
    focusTimeline.eventCallback('onReverseComplete', () => {
        focusState.value = 0;
    });

    let elapsedTime = 0;

    function handleFirstInteraction() {
        if (hasInteracted) return;
        hasInteracted = true;
        audio.ensure();
    }

    function setAutoSpeed(value, { immediate = false } = {}) {
        if (immediate) {
            rotationController.autoSpeed.value = value;
        } else {
            gsap.to(rotationController.autoSpeed, { value, duration: 0.5, ease: 'power2.out' });
        }
    }

    function updateAutoRotationState({ immediate = false } = {}) {
        const shouldRun = !interactionState.pointerDown && !interactionState.active;
        rotationController.autoEnabled = shouldRun;
        if (!shouldRun) {
            setAutoSpeed(0, { immediate: true });
            return;
        }
        const target = interactionState.hovered ? AUTO_SPEED_SLOW : AUTO_SPEED_DEFAULT;
        setAutoSpeed(target, { immediate });
    }

    function applyCardPreset(controller, presetKey, { immediate = false } = {}) {
        const preset = CARD_VISUAL_PRESETS[presetKey] || CARD_VISUAL_PRESETS.idle;
        const duration = immediate ? 0.001 : (presetKey === 'active' ? 0.6 : 0.4);
        const { pivot, visual, glow, shadow, rimMaterial, frontMaterial, backMaterial } = controller;
        if (immediate) {
            pivot.rotation.x = preset.tiltX;
            pivot.rotation.z = preset.tiltZ;
            visual.scale.set(preset.scale, preset.scale, preset.scale);
            glow.material.opacity = preset.glow;
            if (shadow) shadow.material.opacity = preset.shadow;
            rimMaterial.userData.targetRimStrength = preset.rim;
            if (rimMaterial.userData.shader?.uniforms?.rimStrength) {
                rimMaterial.userData.shader.uniforms.rimStrength.value = preset.rim;
            }
        } else {
            gsap.to(pivot.rotation, { x: preset.tiltX, z: preset.tiltZ, duration, ease: 'power3.out' });
            gsap.to(visual.scale, { x: preset.scale, y: preset.scale, z: preset.scale, duration, ease: 'power3.out' });
            gsap.to(glow.material, { opacity: preset.glow, duration: Math.max(0.28, duration * 0.75), ease: 'power2.out' });
            if (shadow) {
                gsap.to(shadow.material, { opacity: preset.shadow, duration: Math.max(0.28, duration * 0.75), ease: 'power2.out' });
            }
            animateRimStrength(rimMaterial, preset.rim, { duration: Math.max(0.3, duration * 0.85) });
        }
        const frontTargets = {
            idle: { emissive: 0.24, env: 1.4, transmission: 0.38, clearcoat: 0.82 },
            hover: { emissive: 0.3, env: 1.6, transmission: 0.42, clearcoat: 0.9 },
            active: { emissive: 0.38, env: 1.85, transmission: 0.46, clearcoat: 0.98 },
            dim: { emissive: 0.18, env: 1.18, transmission: 0.32, clearcoat: 0.7 }
        };
        const backTargets = {
            idle: { emissive: 0.18, env: 1.24 },
            hover: { emissive: 0.22, env: 1.36 },
            active: { emissive: 0.26, env: 1.52 },
            dim: { emissive: 0.12, env: 1.08 }
        };
        const front = frontTargets[presetKey] || frontTargets.idle;
        const back = backTargets[presetKey] || backTargets.idle;
        if (immediate) {
            frontMaterial.emissiveIntensity = front.emissive;
            frontMaterial.envMapIntensity = front.env;
            frontMaterial.transmission = front.transmission;
            frontMaterial.clearcoat = front.clearcoat;
            backMaterial.emissiveIntensity = back.emissive;
            backMaterial.envMapIntensity = back.env;
        } else {
            gsap.to(frontMaterial, {
                emissiveIntensity: front.emissive,
                envMapIntensity: front.env,
                transmission: front.transmission,
                clearcoat: front.clearcoat,
                duration: Math.max(0.32, duration * 0.9),
                ease: 'power2.out'
            });
            gsap.to(backMaterial, {
                emissiveIntensity: back.emissive,
                envMapIntensity: back.env,
                duration: Math.max(0.32, duration * 0.9),
                ease: 'power2.out'
            });
        }
    }

    function syncCardVisual(controller, options = {}) {
        if (!controller) return;
        let preset = 'idle';
        if (controller.isActive) {
            preset = 'active';
        } else if (controller.isHover) {
            preset = 'hover';
        } else if (interactionState.active && interactionState.active !== controller) {
            preset = 'dim';
        }
        applyCardPreset(controller, preset, options);
    }

    function flipController(controller, showBack, { immediate = false } = {}) {
        if (!controller) return;
        const { pivot } = controller;
        gsap.killTweensOf(pivot.rotation);
        gsap.killTweensOf(pivot.position);
        if (immediate) {
            pivot.rotation.y = showBack ? Math.PI : 0;
            pivot.position.z = showBack ? -0.04 : 0;
            return;
        }
        gsap.to(pivot.rotation, {
            y: showBack ? Math.PI : 0,
            duration: 0.9,
            ease: 'expo.inOut',
            overwrite: true
        });
        gsap.to(pivot.position, {
            z: showBack ? -0.04 : 0,
            duration: 0.68,
            ease: 'power3.out'
        });
    }

    function setHoveredController(controller) {
        if (interactionState.hovered === controller) return;
        if (interactionState.hovered && interactionState.hovered !== interactionState.active) {
            interactionState.hovered.isHover = false;
            syncCardVisual(interactionState.hovered);
        }
        interactionState.hovered = controller;
        if (controller && controller !== interactionState.active) {
            controller.isHover = true;
            syncCardVisual(controller);
            audio.playHover();
        }
        updateAutoRotationState();
    }

    function releaseActiveController({ immediate = false } = {}) {
        const active = interactionState.active;
        if (!active) return;
        active.isActive = false;
        if (interactionState.hovered === active) {
            active.isHover = true;
        }
        flipController(active, false, { immediate });
        syncCardVisual(active, { immediate });
        cardControllers.forEach((controller) => {
            if (controller !== active) {
                syncCardVisual(controller, { immediate });
            }
        });
        if (rotationTween) {
            rotationTween.kill();
            rotationTween = null;
        }
        rotationController.velocity = 0;
        interactionState.active = null;
        if (focusTimeline.progress() > 0) {
            if (immediate) {
                focusTimeline.pause(0);
                focusState.value = 0;
            } else {
                focusTimeline.timeScale(1).reverse();
            }
        }
        updateAutoRotationState({ immediate });
    }

    function focusController(controller) {
        if (!controller) {
            releaseActiveController();
            return;
        }
        if (interactionState.active === controller) {
            releaseActiveController();
            return;
        }
        releaseActiveController();
        interactionState.active = controller;
        controller.isActive = true;
        controller.isHover = false;
        flipController(controller, true, {});
        syncCardVisual(controller);
        cardControllers.forEach((entry) => {
            if (entry !== controller) {
                syncCardVisual(entry);
            }
        });
        rotationController.velocity = 0;
        const desired = -controller.baseAngle;
        let delta = desired - rotationController.target;
        delta = THREE.MathUtils.euclideanModulo(delta + Math.PI, Math.PI * 2) - Math.PI;
        const finalTarget = rotationController.target + delta;
        const proxy = { value: rotationController.target };
        if (rotationTween) {
            rotationTween.kill();
        }
        rotationTween = gsap.to(proxy, {
            value: finalTarget,
            duration: 1.05,
            ease: 'power4.inOut',
            onUpdate: () => {
                rotationController.target = proxy.value;
            },
            onComplete: () => {
                rotationTween = null;
                rotationController.velocity = 0;
            }
        });
        focusTimeline.timeScale(1).restart(true);
        updateAutoRotationState({ immediate: true });
        audio.playFocus();
    }

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

    const dragState = { lastX: 0 };

    function onPointerDown(event) {
        updatePointerFromEvent(event);
        handleFirstInteraction();
        interactionState.pointerDown = true;
        rotationController.velocity = 0;
        if (rotationTween) {
            rotationTween.kill();
            rotationTween = null;
        }
        setHoveredController(interactionState.hovered);
        updateAutoRotationState({ immediate: true });
        const { clientX } = extractClientCoords(event);
        dragState.lastX = clientX || 0;
        overlay.classList.add('is-dragging');
        if (event.pointerId !== undefined && overlay.setPointerCapture) {
            try { overlay.setPointerCapture(event.pointerId); } catch (err) { /* ignore */ }
        }
    }

    function onPointerMoveDrag(event) {
        if (!interactionState.pointerDown) return;
        const coords = extractClientCoords(event);
        const deltaX = coords.clientX - dragState.lastX;
        dragState.lastX = coords.clientX;
        const velocity = THREE.MathUtils.clamp(deltaX * 0.0035, -0.25, 0.25);
        rotationController.velocity = velocity;
        rotationController.target += velocity;
    }

    function onPointerUp(event) {
        if (!interactionState.pointerDown) return;
        interactionState.pointerDown = false;
        if (Math.abs(rotationController.velocity) < 0.01) {
            rotationController.velocity = 0;
        }
        overlay.classList.remove('is-dragging');
        updateAutoRotationState();
        needsRaycast = true;
        if (event && event.pointerId !== undefined && overlay.releasePointerCapture) {
            try { overlay.releasePointerCapture(event.pointerId); } catch (err) { /* ignore */ }
        }
    }

    function onCanvasClick() {
        if (!interactionState.hovered) return;
        focusController(interactionState.hovered);
    }

    function onOverlayEnter() {
        overlayHovered = true;
        needsRaycast = true;
    }

    function onOverlayLeave() {
        overlayHovered = false;
        parallaxTarget.set(0, 0);
        setHoveredController(null);
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
    overlay.addEventListener('mouseenter', onOverlayEnter);
    overlay.addEventListener('mouseleave', onOverlayLeave);
    window.addEventListener('keydown', handleKey);

    function closeOverlay() {
        if (isClosing) return;
        isClosing = true;
        overlay.classList.remove('is-dragging');
        setHoveredController(null);
        releaseActiveController({ immediate: true });
        if (rotationTween) {
            rotationTween.kill();
            rotationTween = null;
        }
        rotationController.velocity = 0;
        updateAutoRotationState({ immediate: true });
        audio.fadeOut();
        gsap.to(overlay, {
            opacity: 0,
            duration: 0.6,
            ease: 'power3.inOut',
            onComplete: destroy
        });
        gsap.to(hud, { y: -40, opacity: 0, duration: 0.4, ease: 'power2.in' });
        gsap.to(exitButton, { y: -24, opacity: 0, duration: 0.4, ease: 'power2.in' });
        gsap.to(instructions, { opacity: 0, duration: 0.4, ease: 'power2.in' });
        onRequestClose?.();
    }

    exitButton.addEventListener('click', closeOverlay);
    const handleExitHover = () => { if (hasInteracted) audio.playHover(); };
    exitButton.addEventListener('mouseenter', handleExitHover);
    exitButton.addEventListener('focus', handleExitHover);

    // -----------------------------
    //  Layout responsive
    // -----------------------------
    function updateRendererSize() {
        const width = overlay.clientWidth;
        const height = overlay.clientHeight;
        renderer.setSize(width, height, false);
        const ratioCap = width < 720 ? 1.2 : 1.5;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ratioCap));
        composer.setSize(width, height);
        if (composer.setPixelRatio) {
            composer.setPixelRatio(renderer.getPixelRatio());
        }
        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        const mobile = width < 720;
        const idleTarget = mobile
            ? { x: 0.02, y: 0.88, z: 13.1 }
            : { x: 0.04, y: 0.94, z: 12.4 };
        const focusTarget = mobile
            ? { x: -0.06, y: 0.82, z: 6.9 }
            : { x: -0.12, y: 0.84, z: 6.5 };
        gsap.to(cameraIdleOffset, { ...idleTarget, duration: 0.8, ease: 'power2.out' });
        gsap.to(cameraFocusOffset, { ...focusTarget, duration: 0.8, ease: 'power2.out' });
        cameraLookBaseY = mobile ? 0.82 : 0.9;
    }
    updateRendererSize();
    camera.position.set(cameraIdleOffset.x, cameraIdleOffset.y, cameraIdleOffset.z + 0.6);
    updateAutoRotationState({ immediate: true });
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
        if (rotationController.autoEnabled) {
            rotationController.target += delta * rotationController.autoSpeed.value;
        }
        if (!interactionState.pointerDown && Math.abs(rotationController.velocity) > 0.0001) {
            rotationController.target += rotationController.velocity;
            rotationController.velocity = THREE.MathUtils.damp(rotationController.velocity, 0, 6, delta);
        }
        rotationController.angle = THREE.MathUtils.damp(rotationController.angle, rotationController.target, 6, delta);

        const focusAmount = focusState.value;
        const activeController = interactionState.active;
        const activeAngle = activeController ? activeController.baseAngle + rotationController.angle : null;

        cardControllers.forEach((controller) => {
            const angle = controller.baseAngle + rotationController.angle;
            const isActive = controller === activeController;
            const focus = isActive ? focusAmount : 0;
            let radius = THREE.MathUtils.lerp(CARD_METRICS.orbitRadius, CARD_METRICS.focusRadius, focus);
            let x = Math.cos(angle) * radius;
            let z = Math.sin(angle) * radius;
            let y = Math.sin(angle * 2) * 0.26;
            const floatOffset = Math.sin(elapsedTime * 1.12 + controller.floatPhase) * (0.16 + focus * 0.1);
            y += floatOffset;

            if (activeController && !isActive && activeAngle !== null) {
                const diff = THREE.MathUtils.euclideanModulo(angle - activeAngle + Math.PI, Math.PI * 2) - Math.PI;
                const separation = 1 - THREE.MathUtils.clamp(Math.abs(diff) / (Math.PI / 2.4), 0, 1);
                const pushOut = separation * focusAmount * 2.1;
                const tangent = tmpTangent.set(-Math.sin(angle), 0, Math.cos(angle));
                x += tangent.x * pushOut;
                z += tangent.z * pushOut;
                radius += pushOut * 0.6;
                x = Math.cos(angle) * radius;
                z = Math.sin(angle) * radius;
                y += separation * focusAmount * 0.42;
            }

            controller.group.position.set(x, y, z);
            const lookHeight = THREE.MathUtils.lerp(0.14, 0.54, focus);
            controller.group.lookAt(tmpDesiredCamera.x, lookHeight, tmpDesiredCamera.z);
            controller.lod?.update?.(camera);
            if (isActive) {
                controller.group.getWorldPosition(focusAnchor);
            }
        });
    }

    function updateHover() {
        if (!needsRaycast) return;
        needsRaycast = false;
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(interactableMeshes, true);
        const newController = intersects.length ? intersects[0].object.userData.controller : null;
        setHoveredController(newController);
    }

    let previousTime = performance.now();
    function animate() {
        const now = performance.now();
        const delta = (now - previousTime) / 1000;
        previousTime = now;
        elapsedTime += delta;

        updateCarousel(delta);
        updateHover();

        const parallaxEase = overlayHovered ? 6 : 4;
        parallaxCurrent.x = THREE.MathUtils.damp(parallaxCurrent.x, parallaxTarget.x, parallaxEase, delta);
        parallaxCurrent.y = THREE.MathUtils.damp(parallaxCurrent.y, parallaxTarget.y, parallaxEase, delta);
        const focusAmount = focusState.value;
        const baseOffset = tmpDesiredCamera.copy(cameraIdleOffset).lerp(cameraFocusOffset, focusAmount);
        const desiredX = baseOffset.x + parallaxCurrent.x * 1.2;
        const desiredY = baseOffset.y + parallaxCurrent.y * 0.7;
        const desiredZ = baseOffset.z + parallaxCurrent.y * -0.35;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredX, 7, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredY, 7, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredZ, 7, delta);
        tmpLookBase.set(0, cameraLookBaseY, 0);
        tmpLookBlend.copy(tmpLookBase);
        if (interactionState.active) {
            tmpLookBlend.lerp(focusAnchor, focusAmount);
        }
        tmpLookBlend.x += parallaxCurrent.x * 0.82;
        tmpLookBlend.y += parallaxCurrent.y * 0.32;
        tmpLookBlend.z += parallaxCurrent.y * -0.22;
        cameraLookTarget.x = THREE.MathUtils.damp(cameraLookTarget.x, tmpLookBlend.x, 6, delta);
        cameraLookTarget.y = THREE.MathUtils.damp(cameraLookTarget.y, tmpLookBlend.y, 6, delta);
        cameraLookTarget.z = THREE.MathUtils.damp(cameraLookTarget.z, tmpLookBlend.z, 6, delta);
        camera.lookAt(cameraLookTarget);

        composer.render();
        animationFrame = requestAnimationFrame(animate);
    }
    let animationFrame = requestAnimationFrame(animate);

    gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'power4.out' });
    gsap.fromTo(hud, { y: -40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'power4.out', delay: 0.2 });
    gsap.fromTo(exitButton, { y: -24, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power4.out', delay: 0.35 });
    gsap.fromTo(instructions, { opacity: 0 }, { opacity: 0.85, duration: 1.2, ease: 'power2.out', delay: 0.6 });

    function destroy() {
        releaseActiveController({ immediate: true });
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
        overlay.removeEventListener('touchcancel', onPointerUp);
        overlay.removeEventListener('mouseenter', onOverlayEnter);
        overlay.removeEventListener('mouseleave', onOverlayLeave);
        overlay.removeEventListener('click', handleOverlayClick);
        window.removeEventListener('keydown', handleKey);
        exitButton.removeEventListener('click', closeOverlay);
        exitButton.removeEventListener('mouseenter', handleExitHover);
        exitButton.removeEventListener('focus', handleExitHover);
        overlay.remove();
        renderer.dispose();
        composer.dispose();
        scene.remove(
            carouselGroup,
            ambient,
            keyLight,
            keyLight.target,
            rimLight,
            rimLight.target,
            hemi,
            coolRect,
            warmRect,
            crystalSpot,
            crystalSpot.target,
            warmSpot,
            warmSpot.target,
            fillLight,
            bounceLight,
            glintLight,
            amberLight,
            tealLight,
            hazePlane
        );
        scene.environment = null;
        scene.background = null;
        environmentRenderTarget?.dispose?.();
        environmentRenderTarget = null;
        environmentTexture = null;
        cardControllers.forEach((controller) => {
            controller.frontTexture?.dispose?.();
            controller.backTexture?.dispose?.();
            controller.frontMaterial?.dispose?.();
            controller.backMaterial?.dispose?.();
            controller.glow?.material?.dispose?.();
            controller.rimMaterial?.dispose?.();
            controller.lowMaterial?.dispose?.();
        });
        bodyGeometry.dispose();
        faceGeometry.dispose();
        lowFaceGeometry.dispose();
        hazePlane.geometry.dispose();
        hazePlane.material.dispose();
        audio.dispose();
    }

    return { destroy: closeOverlay, overlay, renderer, composer };
}
