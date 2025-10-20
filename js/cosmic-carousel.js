import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { ColorCorrectionShader } from 'three/examples/jsm/shaders/ColorCorrectionShader.js';
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
//  Utility: volumetric cone per spotlight (effetto morbido)
// ---------------------------------------------------------------------------
function createVolumetricCone({ color, height = 6, radius = 2.4, opacity = 0.22 }) {
    const geometry = new THREE.ConeGeometry(radius, height, 32, 1, true);
    const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = -5;
    return mesh;
}

// ---------------------------------------------------------------------------
//  Utility: nebulose animate con shader leggero
// ---------------------------------------------------------------------------
function createNebulaField() {
    const group = new THREE.Group();
    const meshes = [];
    const geometry = new THREE.PlaneGeometry(18, 12, 32, 32);
    const palette = [
        [0x46d9ff, 0x0b1e3f, 0xff914d],
        [0x2dd4ff, 0x08122d, 0xffb36a],
        [0x88f2ff, 0x0b1744, 0xff7e39]
    ];

    for (let i = 0; i < 3; i++) {
        const [c1, c2, c3] = palette[i];
        const material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: {
                time: { value: 0 },
                colorA: { value: new THREE.Color(c1) },
                colorB: { value: new THREE.Color(c2) },
                colorC: { value: new THREE.Color(c3) },
                intensity: { value: 0.65 }
            },
            vertexShader: `
                varying vec2 vUv;
                uniform float time;
                void main(){
                    vUv = uv;
                    vec3 displaced = position;
                    displaced.z += sin((uv.x + uv.y + time * 0.15) * 6.2831) * 0.35;
                    displaced.x += sin((uv.y + time * 0.2) * 6.2831) * 0.1;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
                }
            `,
            fragmentShader: `
                varying vec2 vUv;
                uniform vec3 colorA;
                uniform vec3 colorB;
                uniform vec3 colorC;
                uniform float intensity;
                void main(){
                    float dist = distance(vUv, vec2(0.5));
                    float glow = smoothstep(0.6, 0.0, dist);
                    float pulse = 0.6 + 0.4 * sin((vUv.x + vUv.y) * 6.2831 + intensity * 3.1415);
                    vec3 base = mix(colorB, colorA, pow(glow, 0.6));
                    base = mix(base, colorC, vUv.x * 0.8);
                    float alpha = glow * pulse * intensity;
                    if(alpha < 0.01) discard;
                    gl_FragColor = vec4(base, alpha);
                }
            `
        });
        const mesh = new THREE.Mesh(geometry.clone(), material);
        mesh.position.set((i - 1) * 12, 2 - i * 0.6, -18 - i * 6);
        mesh.rotation.set(0, Math.PI * 0.08 * (i - 1), 0);
        group.add(mesh);
        meshes.push(mesh);
    }

    geometry.dispose();

    let elapsed = 0;
    return {
        group,
        update(delta) {
            elapsed += delta;
            meshes.forEach((mesh, idx) => {
                mesh.material.uniforms.time.value = elapsed * (0.4 + idx * 0.12);
                mesh.material.uniforms.intensity.value = 0.55 + Math.sin(elapsed * 1.4 + idx) * 0.08;
            });
        },
        dispose() {
            meshes.forEach((mesh) => {
                mesh.geometry.dispose();
                mesh.material.dispose();
            });
        }
    };
}

// ---------------------------------------------------------------------------
//  Utility: comete leggere animate
// ---------------------------------------------------------------------------
function createCometField(count = 12) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 40;
        positions[i * 3 + 1] = Math.random() * 12 + 4;
        positions[i * 3 + 2] = Math.random() * -40 - 12;
        velocities[i * 3] = 2 + Math.random() * 1.5;
        velocities[i * 3 + 1] = -0.4 - Math.random() * 0.3;
        velocities[i * 3 + 2] = 6 + Math.random() * 2.5;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const cometMaterial = new THREE.PointsMaterial({
        color: 0xffcbaa,
        size: 0.35,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.85
    });

    const points = new THREE.Points(geometry, cometMaterial);
    points.renderOrder = 10;

    return {
        points,
        update(delta) {
            const array = geometry.attributes.position.array;
            for (let i = 0; i < count; i++) {
                const idx = i * 3;
                array[idx] += velocities[idx] * delta;
                array[idx + 1] += velocities[idx + 1] * delta;
                array[idx + 2] += velocities[idx + 2] * delta;
                if (array[idx] > 28 || array[idx + 2] > 10) {
                    array[idx] = -30 - Math.random() * 10;
                    array[idx + 1] = Math.random() * 14 + 2;
                    array[idx + 2] = -30 - Math.random() * 18;
                }
            }
            geometry.attributes.position.needsUpdate = true;
        },
        dispose() {
            geometry.dispose();
            cometMaterial.dispose();
        }
    };
}

// ---------------------------------------------------------------------------
//  Utility: campo stellare multistrato realistico
// ---------------------------------------------------------------------------
function createStarField() {
    const group = new THREE.Group();
    const layersConfig = [
        { count: 680, radius: 120, size: 0.16, opacity: 0.58, twinkleSpeed: 0.35, tintA: 0x8fc5ff, tintB: 0xffb07d },
        { count: 260, radius: 72, size: 0.28, opacity: 0.88, twinkleSpeed: 0.6, tintA: 0xd7efff, tintB: 0xffe6a8 }
    ];

    const geometries = [];
    const materials = [];

    layersConfig.forEach((layer, index) => {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(layer.count * 3);
        const colors = new Float32Array(layer.count * 3);
        const colorA = new THREE.Color(layer.tintA);
        const colorB = new THREE.Color(layer.tintB);

        for (let i = 0; i < layer.count; i++) {
            const r = layer.radius * Math.pow(Math.random(), 0.52);
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
            const sinPhi = Math.sin(phi);
            const x = r * Math.cos(theta) * sinPhi;
            const y = r * Math.cos(phi) * 0.58;
            const z = r * Math.sin(theta) * sinPhi;
            const offset = i * 3;
            positions[offset] = x;
            positions[offset + 1] = y;
            positions[offset + 2] = z;

            const mix = Math.random();
            colors[offset] = THREE.MathUtils.lerp(colorA.r, colorB.r, mix);
            colors[offset + 1] = THREE.MathUtils.lerp(colorA.g, colorB.g, mix);
            colors[offset + 2] = THREE.MathUtils.lerp(colorA.b, colorB.b, mix);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            vertexColors: true,
            size: layer.size,
            sizeAttenuation: true,
            transparent: true,
            depthWrite: false,
            opacity: layer.opacity,
            blending: THREE.AdditiveBlending
        });

        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        points.renderOrder = 5 + index;
        group.add(points);
        geometries.push(geometry);
        materials.push(material);
    });

    group.rotation.x = 0.08;

    return {
        group,
        update(delta, now) {
            group.rotation.y += delta * 0.018;
            group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, 0.08, 0.02);
            materials.forEach((material, idx) => {
                const layer = layersConfig[idx];
                const pulse = Math.sin(now * 0.0012 * layer.twinkleSpeed + idx) * 0.12;
                material.opacity = THREE.MathUtils.clamp(layer.opacity + pulse, 0.22, 1);
            });
        },
        dispose() {
            geometries.forEach((geometry) => geometry.dispose());
            materials.forEach((material) => material.dispose());
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
    renderer.shadowMap.enabled = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010314);
    scene.fog = new THREE.FogExp2(0x010314, 0.012);

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
    const cameraRestOffset = new THREE.Vector3(0, 1.55, 8.3);
    const cameraFocusShift = new THREE.Vector3(0, -0.42, -1.55);
    camera.position.copy(cameraRestOffset);
    scene.add(camera);
    const cameraLookTarget = new THREE.Vector3(0, 1.1, 0);
    let cameraLookBaseY = 1.1;

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
    const ambient = new THREE.HemisphereLight(0x1a3556, 0x02030b, 0.55);
    scene.add(ambient);

    const sunLight = new THREE.SpotLight(0xffd3a4, 2.6, 68, Math.PI / 4.6, 0.32, 1.05);
    sunLight.position.set(8, 12, 7);
    sunLight.penumbra = 0.55;
    sunLight.target.position.set(-0.4, 1.2, 0);
    scene.add(sunLight);
    scene.add(sunLight.target);

    const moonLight = new THREE.SpotLight(0x7cd4ff, 1.5, 54, Math.PI / 5.2, 0.5, 1.05);
    moonLight.position.set(-10, 7.5, -5.5);
    moonLight.penumbra = 0.48;
    moonLight.target.position.set(0.2, 1.6, 0);
    scene.add(moonLight);
    scene.add(moonLight.target);

    const fillLight = new THREE.PointLight(0x0b1c33, 1.15, 38, 1.6);
    fillLight.position.set(-4.6, 2.8, 6.2);
    scene.add(fillLight);

    const sunCone = createVolumetricCone({ color: 0xffa76d, height: 14, radius: 6, opacity: 0.22 });
    sunCone.position.copy(sunLight.position.clone().multiplyScalar(0.82));
    sunCone.lookAt(sunLight.target.position);
    scene.add(sunCone);

    const moonCone = createVolumetricCone({ color: 0x69cfff, height: 12, radius: 5, opacity: 0.18 });
    moonCone.position.copy(moonLight.position.clone().multiplyScalar(0.76));
    moonCone.lookAt(moonLight.target.position);
    scene.add(moonCone);

    const rimBackLight = new THREE.DirectionalLight(0x1e88ff, 0.45);
    rimBackLight.position.set(4, 4.2, -7);
    rimBackLight.target.position.set(0, 1.8, 0);
    scene.add(rimBackLight);
    scene.add(rimBackLight.target);

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
            float hash(vec2 p){
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }
            float noise(vec2 p){
                vec2 i = floor(p);
                vec2 f = fract(p);
                float a = hash(i);
                float b = hash(i + vec2(1.0, 0.0));
                float c = hash(i + vec2(0.0, 1.0));
                float d = hash(i + vec2(1.0, 1.0));
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
            }
            float fbm(vec2 p){
                float value = 0.0;
                float amplitude = 0.5;
                float frequency = 1.0;
                for(int i = 0; i < 5; i++){
                    value += amplitude * noise(p * frequency);
                    frequency *= 2.3;
                    amplitude *= 0.52;
                }
                return value;
            }
            void main(){
                vec2 uv = vUv * 2.0 - 1.0;
                vec2 polar = vec2(length(uv), atan(uv.y, uv.x));
                float nebula = fbm(uv * 3.2 + time * 0.03);
                float swirl = fbm(vec2(polar.x * 5.0, polar.y * 1.3 + time * 0.05));
                float dust = fbm(uv * 6.5 - time * 0.015);
                float gradient = smoothstep(-0.15, 1.05, nebula + swirl * 0.6);
                vec3 base = mix(colorA, colorB, gradient);
                base = mix(base, colorC, clamp(dust * 1.3, 0.0, 1.0));
                float starNoise = noise(uv * 150.0 + time * 0.18);
                float stars = smoothstep(0.92, 1.0, starNoise) * (0.6 + dust * 0.4);
                vec3 starCol = mix(vec3(0.95, 0.76, 0.48), vec3(0.42, 0.8, 1.0), clamp(uv.y * 0.5 + 0.5, 0.0, 1.0));
                vec3 color = base + starCol * stars * 1.25;
                gl_FragColor = vec4(color, 1.0);
            }
        `
    });
    const galaxy = new THREE.Mesh(galaxyGeo, galaxyMat);
    galaxy.frustumCulled = false;
    scene.add(galaxy);

    const nebulaField = createNebulaField();
    scene.add(nebulaField.group);

    const cometField = createCometField(16);
    scene.add(cometField.points);

    // -----------------------------
    //  Stelle stratificate con twinkle realistico
    // -----------------------------
    const starField = createStarField();
    scene.add(starField.group);

    // -----------------------------
    //  Sole & luna emissivi con bloom
    // -----------------------------
    const sunMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1.4, 36, 36),
        new THREE.MeshPhysicalMaterial({
            color: 0xffd8a0,
            emissive: 0xffc27a,
            emissiveIntensity: 1.65,
            roughness: 0.42,
            metalness: 0.0,
            clearcoat: 0.35,
            clearcoatRoughness: 0.28
        })
    );
    sunMesh.position.copy(sunLight.position);
    scene.add(sunMesh);

    const moonMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 32, 32),
        new THREE.MeshPhysicalMaterial({
            color: 0xbfd4ff,
            emissive: 0x7aa6ff,
            emissiveIntensity: 0.48,
            roughness: 0.68,
            metalness: 0.05,
            transmission: 0,
            reflectivity: 0.18
        })
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
    const lowFaceGeometry = new THREE.PlaneGeometry(cardWidth * 0.9, cardHeight * 0.9, 1, 1);

    const introTimeline = gsap.timeline({ delay: 0.22, defaults: { ease: 'power4.out' } });

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
            lod,
            lowVisual,
            lowMaterial,
            lowPlane,
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
    let rotationVelocity = 0;
    let currentRotation = 0;
    let targetRotation = 0;
    let rotationTween = null;
    let autoRotate = true;
    let animationFrame = null;
    let overlayHovered = false;
    let isClosing = false;
    let hasInteracted = false;
    const tmpCameraDir = new THREE.Vector3();

    const autoRotateStrength = { value: 1 };

    const focusState = { value: 0 };
    const focusTimeline = gsap.timeline({ paused: true });
    focusTimeline.to(lutPass.uniforms.mulRGB.value, { x: 1.26, y: 1.04, z: 1.32, duration: 1.2, ease: 'power4.inOut' }, 0);
    focusTimeline.to(lutPass.uniforms.powRGB.value, { x: 1.4, y: 1.1, z: 1.6, duration: 1.2, ease: 'power4.inOut' }, 0);
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
        const scaleTarget = isActive ? 1.12 : isHover ? 1.05 : 1;
        const tiltX = isActive ? THREE.MathUtils.degToRad(-3) : isHover ? THREE.MathUtils.degToRad(-5) : 0;
        const tiltZ = isActive ? THREE.MathUtils.degToRad(4) : isHover ? THREE.MathUtils.degToRad(5.5) : 0;
        const glowOpacity = isActive ? 1.45 : isHover ? 1.12 : 0.72;
        gsap.to(visual.scale, { x: scaleTarget, y: scaleTarget, z: scaleTarget, duration: 0.55, ease: 'power4.out' });
        gsap.to(visual.rotation, { x: tiltX, y: 0, z: tiltZ, duration: 0.65, ease: 'power4.out' });
        gsap.to(glow.material, { opacity: glowOpacity, duration: 0.5, ease: 'power2.out' });
        animateRimStrength(rimMaterial, isActive ? 3.1 : isHover ? 2.2 : 1.4);
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
        if (focusTimeline.progress() > 0) {
            focusTimeline.timeScale(1).reverse();
        } else {
            focusState.value = 0;
        }
        rotationTween?.kill?.();
        rotationTween = null;
        activeGroup = null;
        if (!isPointerDown) {
            autoRotate = true;
        }
        setAutoRotateStrength(overlayHovered ? 0.18 : 1);
    }

    function activateCard(group) {
        if (!group) return;
        if (activeGroup === group) {
            releaseActiveCard();
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
        focusTimeline.timeScale(1).play();
        autoRotate = false;
        setAutoRotateStrength(0.02);
        audio.playFocus();
    }

    // -----------------------------
    //  Eventi
    // -----------------------------
    function onPointerMove(event) {
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        pointer.set(x * 2 - 1, -(y * 2 - 1));
        const px = THREE.MathUtils.clamp(x - 0.5, -0.6, 0.6);
        const py = THREE.MathUtils.clamp(y - 0.5, -0.6, 0.6);
        parallaxTarget.set(px, py);
        needsRaycast = true;
    }

    function onPointerDown(event) {
        handleFirstInteraction();
        isPointerDown = true;
        autoRotate = false;
        rotationVelocity = 0;
        dragStartX = event.clientX || (event.touches && event.touches[0].clientX) || 0;
        overlay.classList.add('is-dragging');
        rotationTween?.kill?.();
        rotationTween = null;
        setAutoRotateStrength(0.06);
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
        if (!activeGroup) {
            autoRotate = true;
            setAutoRotateStrength(overlayHovered ? 0.18 : 1);
        }
        overlay.classList.remove('is-dragging');
        needsRaycast = true;
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
            refreshCardVisual(hoveredGroup);
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
            refreshCardVisual(hoveredGroup);
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
        const ratioCap = width < 720 ? 1.3 : 1.6;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ratioCap));
        composer.setSize(width, height);
        if (composer.setPixelRatio) {
            composer.setPixelRatio(renderer.getPixelRatio());
        }
        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        const mobile = width < 720;
        const desiredZ = mobile ? 9.6 : 8.2;
        const desiredY = mobile ? 1.25 : 1.55;
        const desiredLookY = mobile ? 0.95 : 1.1;
        gsap.to(cameraRestOffset, { x: 0, y: desiredY, z: desiredZ, duration: 0.8, ease: 'power2.out' });
        cameraFocusShift.set(0, mobile ? -0.26 : -0.42, mobile ? -1.05 : -1.55);
        cameraLookBaseY = desiredLookY;
    }
    updateRendererSize();
    camera.position.set(cameraRestOffset.x, cameraRestOffset.y - 0.6, cameraRestOffset.z + 6);
    cameraLookTarget.set(0, cameraLookBaseY, 0);
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
            targetRotation += delta * 0.12 * autoRotateStrength.value;
        }
        if (!isPointerDown && Math.abs(rotationVelocity) > 0.0001) {
            targetRotation += rotationVelocity;
            rotationVelocity = THREE.MathUtils.lerp(rotationVelocity, 0, 0.08);
        }
        currentRotation = THREE.MathUtils.lerp(currentRotation, targetRotation, 0.12);

        const cameraDir = tmpCameraDir.copy(cameraRestOffset)
            .addScaledVector(cameraFocusShift, focusState.value)
            .normalize();

        cardGroups.forEach((group) => {
            const angle = group.userData.baseAngle + currentRotation;
            const focus = group === activeGroup ? focusState.value : 0;
            const orbitRadius = cardRadius - focus * 0.65;
            const baseX = Math.cos(angle) * orbitRadius;
            const baseZ = Math.sin(angle) * orbitRadius;
            const baseY = Math.sin(angle * 2.0) * 0.35;
            const pull = focus * 1.25;
            const x = baseX + cameraDir.x * pull;
            const y = baseY + cameraDir.y * pull + focus * 0.24;
            const z = baseZ + cameraDir.z * pull;
            group.position.set(x, y, z);
            group.lookAt(cameraDir.x * 4, 0.12 + focus * 0.18, cameraDir.z * 4);
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
            refreshCardVisual(hoveredGroup);
        }

        hoveredGroup = newGroup;
        if (hoveredGroup) {
            hoveredGroup.userData.isHover = true;
            refreshCardVisual(hoveredGroup);
            audio.playHover();
        }
    }

    let previousTime = performance.now();
    function animate() {
        const now = performance.now();
        const delta = (now - previousTime) / 1000;
        previousTime = now;

        galaxyMat.uniforms.time.value += delta * 0.4;
        nebulaField.update(delta);
        cometField.update(delta);
        starField.update(delta, now);
        sunMesh.rotation.y += delta * 0.2;
        moonMesh.rotation.y += delta * 0.15;
        sunCone.material.opacity = 0.18 + Math.sin(now * 0.00085) * 0.05;
        moonCone.material.opacity = 0.16 + Math.cos(now * 0.0009) * 0.04;

        updateCarousel(delta);
        updateHover();

        const parallaxLerp = overlayHovered ? 0.12 : 0.08;
        parallaxCurrent.lerp(parallaxTarget, parallaxLerp);
        const baseX = cameraRestOffset.x + cameraFocusShift.x * focusState.value;
        const baseY = cameraRestOffset.y + cameraFocusShift.y * focusState.value;
        const baseZ = cameraRestOffset.z + cameraFocusShift.z * focusState.value;
        const desiredX = baseX + parallaxCurrent.x * 1.35;
        const desiredY = baseY + parallaxCurrent.y * 0.8;
        const desiredZ = baseZ + parallaxCurrent.y * -0.4;
        camera.position.x += (desiredX - camera.position.x) * 0.08;
        camera.position.y += (desiredY - camera.position.y) * 0.08;
        camera.position.z += (desiredZ - camera.position.z) * 0.08;
        cameraLookTarget.x += ((parallaxCurrent.x * 0.8) - cameraLookTarget.x) * 0.08;
        const lookTargetY = cameraLookBaseY + parallaxCurrent.y * 0.35;
        cameraLookTarget.y += (lookTargetY - cameraLookTarget.y) * 0.08;
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
        releaseActiveCard();
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
        scene.remove(starField.group, galaxy, carouselGroup, sunMesh, moonMesh, nebulaField.group, cometField.points, sunCone, moonCone, sunLight, moonLight, sunLight.target, moonLight.target, ambient, fillLight, rimBackLight, rimBackLight.target);
        nebulaField.dispose();
        cometField.dispose();
        sunCone.geometry.dispose();
        sunCone.material.dispose();
        moonCone.geometry.dispose();
        moonCone.material.dispose();
        starField.dispose();
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
        sunMesh.material?.dispose?.();
        moonMesh.material?.dispose?.();
        galaxyGeo.dispose();
        galaxyMat.dispose();
        audio.dispose();
    }

    return { destroy: closeOverlay, overlay, renderer, composer };
}
