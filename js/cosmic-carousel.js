import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { AdaptiveToneMappingPass } from './vendor/AdaptiveToneMappingPass.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm';

const CARD_COUNT = 10;
const CARD_WIDTH = 1.15;
const CARD_HEIGHT = CARD_WIDTH * 1.45;
const CARD_THICKNESS = 0.05;
const CAROUSEL_RADIUS = 3.6;
const DEFAULT_ROTATION_SPEED = 0.22;

const HDRI_LOCAL_URL = new URL('../assets/3d/env/solitude_night_4k.hdr', import.meta.url).href;
const HDRI_FALLBACK_URL = 'https://cdn.jsdelivr.net/gh/pmndrs/drei-assets@master/hdri/night_sky.hdr';

const TEMP_NORMAL = new THREE.Vector3();
const FRONT_NORMAL = new THREE.Vector3(0, 0, 1);
const BACK_NORMAL = new THREE.Vector3(0, 0, -1);

const VignetteShader = {
    uniforms: {
        tDiffuse: { value: null },
        offset: { value: 1.18 },
        darkness: { value: 1.32 }
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
        void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            vec2 pos = vUv - vec2(0.5);
            float len = length(pos);
            float vignette = smoothstep(0.6, offset, len);
            float strength = clamp(1.0 - vignette * darkness, 0.0, 1.0);
            gl_FragColor = vec4(texel.rgb * strength, texel.a);
        }
    `
};

class RealisticCardMaterial {
    constructor({ frontTexture, backTexture }) {
        const sharedPhysicalProps = {
            metalness: 0.28,
            roughness: 0.42,
            clearcoat: 0.58,
            clearcoatRoughness: 0.2,
            transmission: 0.08,
            thickness: 0.32,
            attenuationDistance: 1.6,
            ior: 1.5,
            reflectivity: 0.48,
            sheen: 0.38,
            sheenRoughness: 0.38,
            iridescence: 0.26,
            iridescenceIOR: 1.32,
            iridescenceThicknessRange: [140, 320],
            envMapIntensity: 0.58,
            side: THREE.FrontSide,
            transparent: true,
            opacity: 1,
            toneMapped: true
        };

        this.frontMaterial = new THREE.MeshPhysicalMaterial({
            ...sharedPhysicalProps,
            map: frontTexture,
            color: new THREE.Color(0xf4f9ff),
            emissive: new THREE.Color(0x172434),
            emissiveIntensity: 0.12,
            specularIntensity: 0.46,
            specularColor: new THREE.Color(0x8cbdf2),
            attenuationColor: new THREE.Color(0x7fb4e0)
        });

        this.backMaterial = new THREE.MeshPhysicalMaterial({
            ...sharedPhysicalProps,
            map: backTexture,
            color: new THREE.Color(0xdee9f5),
            emissive: new THREE.Color(0x0f1c2a),
            emissiveIntensity: 0.08,
            sheenColor: new THREE.Color(0x244163),
            envMapIntensity: 0.46,
            attenuationColor: new THREE.Color(0x416a8e)
        });

        this.edgeMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x0b1524,
            metalness: 0.52,
            roughness: 0.33,
            clearcoat: 0.52,
            clearcoatRoughness: 0.16,
            envMapIntensity: 0.58,
            specularIntensity: 0.52,
            sheen: 0.26,
            sheenColor: new THREE.Color(0x6890c3),
            emissive: new THREE.Color(0x0c1828),
            emissiveIntensity: 0.06
        });

        this.glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x7fc3ff,
            transparent: true,
            opacity: 0.14,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: false,
            side: THREE.DoubleSide
        });

        this.materials = [this.frontMaterial, this.backMaterial, this.edgeMaterial, this.glowMaterial];
        this.frontMesh = null;
        this.backMesh = null;
        this.edgeMesh = null;
        this.glowMesh = null;
        this.group = null;
        this._cameraVector = new THREE.Vector3();
        this._worldPosition = new THREE.Vector3();
        this._worldQuaternion = new THREE.Quaternion();
        this._frontSheenColor = new THREE.Color(0x7fa7c6);
        this._frontBaseColor = this.frontMaterial.color.clone();
        this._edgeSheenColor = new THREE.Color(0x5a7caa);
        this._edgeBaseColor = this.edgeMaterial.color.clone();
    }

    bind({ group, front, back, edge, glow }) {
        this.group = group;
        this.frontMesh = front;
        this.backMesh = back;
        this.edgeMesh = edge;
        this.glowMesh = glow;
    }

    setEnvironment(envMap) {
        this.materials.forEach((material) => {
            if (material && 'envMap' in material) {
                material.envMap = envMap;
                material.needsUpdate = true;
            }
        });
    }

    update(camera, elapsed = 0) {
        if (!this.group || !this.frontMesh) return;
        this.group.getWorldPosition(this._worldPosition);
        this._cameraVector.copy(camera.position).sub(this._worldPosition).normalize();

        this.frontMesh.getWorldQuaternion(this._worldQuaternion);
        TEMP_NORMAL.copy(FRONT_NORMAL).applyQuaternion(this._worldQuaternion);
        const fresnel = Math.pow(1 - Math.max(TEMP_NORMAL.dot(this._cameraVector), 0), 2.2);

        const breathing = 0.4 + Math.sin(elapsed * 0.8) * 0.08;

        this.frontMaterial.clearcoatRoughness = THREE.MathUtils.lerp(0.16, 0.28, fresnel);
        this.frontMaterial.iridescence = THREE.MathUtils.lerp(0.18, 0.46, fresnel);
        this.frontMaterial.iridescenceThicknessRange = [130, 260 + fresnel * 110];
        this.frontMaterial.emissiveIntensity = 0.1 + fresnel * 0.22;
        this.frontMaterial.envMapIntensity = 0.52 + fresnel * 0.24;
        this.frontMaterial.sheen = THREE.MathUtils.lerp(0.32, 0.5, fresnel);
        this._frontSheenColor.setHSL(0.55, 0.36, 0.7 + fresnel * 0.08);
        this.frontMaterial.sheenColor.copy(this._frontSheenColor);
        this.frontMaterial.transmission = THREE.MathUtils.lerp(0.06, 0.12, fresnel);
        this.frontMaterial.ior = THREE.MathUtils.lerp(1.48, 1.52, fresnel * 0.6);
        this.frontMaterial.color.lerpColors(this._frontBaseColor, this._frontSheenColor, fresnel * 0.22);

        if (this.backMaterial && this.backMesh) {
            this.backMesh.getWorldQuaternion(this._worldQuaternion);
            TEMP_NORMAL.copy(BACK_NORMAL).applyQuaternion(this._worldQuaternion);
            const backFresnel = Math.pow(1 - Math.max(TEMP_NORMAL.dot(this._cameraVector), 0), 1.8);
            this.backMaterial.envMapIntensity = 0.42 + backFresnel * 0.18;
            this.backMaterial.iridescence = THREE.MathUtils.lerp(0.14, 0.38, backFresnel + breathing * 0.08);
            this.backMaterial.emissiveIntensity = 0.08 + backFresnel * 0.18;
        }

        if (this.edgeMaterial) {
            const pulse = 0.72 + Math.sin(elapsed * 1.4) * 0.05;
            this.edgeMaterial.metalness = 0.5 + fresnel * 0.1;
            this.edgeMaterial.roughness = THREE.MathUtils.lerp(0.3, 0.44, 1 - fresnel);
            this.edgeMaterial.envMapIntensity = 0.48 + fresnel * 0.16;
            this.edgeMaterial.sheen = 0.22 + fresnel * 0.12;
            this._edgeSheenColor.setHSL(0.58, 0.34, 0.55 + fresnel * 0.1);
            this.edgeMaterial.sheenColor.copy(this._edgeSheenColor);
            this.edgeMaterial.color.lerpColors(this._edgeBaseColor, this._edgeSheenColor, fresnel * 0.18);
            this.edgeMaterial.emissiveIntensity = pulse * 0.09;
        }

        if (this.glowMaterial && this.glowMesh) {
            const glowBase = 0.06 + fresnel * 0.22;
            this.glowMaterial.opacity = THREE.MathUtils.clamp(glowBase + breathing * 0.05, 0.05, 0.32);
            this.glowMesh.scale.setScalar(1.05 + fresnel * 0.12);
        }
    }

    dispose() {
        this.materials.forEach((material) => {
            if (material && typeof material.dispose === 'function') {
                material.dispose();
            }
        });
        this.frontMesh = null;
        this.backMesh = null;
        this.edgeMesh = null;
        this.glowMesh = null;
        this.group = null;
    }
}

class RealisticLighting {
    constructor(scene, renderer, { onEnvironmentLoaded } = {}) {
        this.scene = scene;
        this.renderer = renderer;
        this.tempVector = new THREE.Vector3();

        this.ambient = new THREE.HemisphereLight(0x24344a, 0x010306, 0.45);

        this.keyLight = new THREE.DirectionalLight(0xffa76a, 1.32);
        this.keyLight.position.set(4.4, 6.3, 6.4);
        this.keyLight.target.position.set(0, 1.15, 0);

        this.fillLight = new THREE.DirectionalLight(0xb7d9ff, 0.82);
        this.fillLight.position.set(-3.8, 3.6, 2.8);
        this.fillLight.target.position.set(0, 1.05, 0);

        this.rimLight = new THREE.DirectionalLight(0x78cfff, 1.55);
        this.rimLight.position.set(-5.6, 4.4, -6.6);
        this.rimLight.target.position.set(0, 1.35, 0);

        this.glowFill = new THREE.PointLight(0x7ab4ff, 0.68, 18, 2.4);
        this.glowFill.position.set(0, 2.6, 2.2);
        this._glowTarget = new THREE.Vector3(0, 2.5, 2.4);

        [
            this.ambient,
            this.keyLight,
            this.keyLight.target,
            this.fillLight,
            this.fillLight.target,
            this.rimLight,
            this.rimLight.target,
            this.glowFill
        ].forEach((light) => this.scene.add(light));

        this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        this.pmremGenerator.compileEquirectangularShader();
        this.environmentRenderTarget = null;

        this.loadEnvironment(HDRI_LOCAL_URL, onEnvironmentLoaded);
    }

    loadEnvironment(url, onEnvironmentLoaded, hasRetried = false) {
        const loader = new RGBELoader().setDataType(THREE.FloatType);
        loader.load(
            url,
            (hdr) => {
                if (this.environmentRenderTarget && typeof this.environmentRenderTarget.dispose === 'function') {
                    this.environmentRenderTarget.dispose();
                }

                this.environmentRenderTarget = this.pmremGenerator.fromEquirectangular(hdr);
                const envMap = this.environmentRenderTarget.texture;
                envMap.name = hasRetried ? 'NightSkyFallback' : 'SolitudeNightHDR';
                this.scene.environment = envMap;
                this.scene.background = envMap;
                if (typeof onEnvironmentLoaded === 'function') {
                    onEnvironmentLoaded(envMap);
                }
                if (hdr && typeof hdr.dispose === 'function') {
                    hdr.dispose();
                }
            },
            undefined,
            (error) => {
                console.warn(
                    `[CosmicCarousel] Unable to load HDR environment from ${url}.`,
                    error
                );
                if (!hasRetried) {
                    this.loadEnvironment(HDRI_FALLBACK_URL, onEnvironmentLoaded, true);
                } else {
                    console.error('[CosmicCarousel] Fallback HDR environment failed to load.', error);
                }
            }
        );
    }

    update(camera, elapsed = 0) {
        const oscillation = Math.sin(elapsed * 0.55) * 0.08;
        this.keyLight.intensity = 1.25 + oscillation * 0.28;
        this.fillLight.intensity = 0.75 + Math.sin(elapsed * 0.82 + 1.2) * 0.11;

        this.keyLight.position.x = 4.4 + Math.sin(elapsed * 0.32) * 0.6;
        this.keyLight.position.y = 6.1 + Math.sin(elapsed * 0.42) * 0.4;

        this.tempVector.copy(camera.position).normalize().multiplyScalar(-6.1);
        this.tempVector.y += 4.4;
        this.rimLight.position.lerp(this.tempVector, 0.1);
        this.rimLight.intensity = 1.48 + Math.abs(Math.sin(elapsed * 1.05)) * 0.24;

        this.glowFill.intensity = 0.58 + Math.sin(elapsed * 1.3 + 0.6) * 0.12;
        this._glowTarget.y = 2.5 + oscillation * 2.2;
        this.glowFill.position.lerp(this._glowTarget, 0.08);
    }

    dispose() {
        if (this.scene) {
            this.scene.environment = null;
            this.scene.background = null;
        }
        if (this.environmentRenderTarget && typeof this.environmentRenderTarget.dispose === 'function') {
            this.environmentRenderTarget.dispose();
            this.environmentRenderTarget = null;
        }
        if (this.pmremGenerator && typeof this.pmremGenerator.dispose === 'function') {
            this.pmremGenerator.dispose();
        }
        if (this.glowFill) {
            if (this.scene && typeof this.scene.remove === 'function') {
                this.scene.remove(this.glowFill);
            }
            if (typeof this.glowFill.dispose === 'function') {
                this.glowFill.dispose();
            }
            this.glowFill = null;
        }
        this._glowTarget = null;
    }
}

class CinematicPostFX {
    constructor(renderer, scene, camera, size) {
        const width = size.clientWidth || window.innerWidth;
        const height = size.clientHeight || window.innerHeight;

        this.composer = new EffectComposer(renderer);
        this.renderPass = new RenderPass(scene, camera);
        this.composer.addPass(this.renderPass);

        this.bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.78, 0.58, 0.16);
        this.bloomPass.threshold = 0.18;
        this.bloomPass.radius = 0.74;
        this.composer.addPass(this.bloomPass);

        this.bokehPass = new BokehPass(scene, camera, {
            focus: 3.05,
            aperture: 0.00022,
            maxblur: 0.014,
            width,
            height
        });
        this.composer.addPass(this.bokehPass);

        this.toneMappingPass = new AdaptiveToneMappingPass(true, width);
        this.toneMappingPass.setAdaptionRate(2.1);
        this.toneMappingPass.setMaxLuminance(38);
        this.toneMappingPass.setMiddleGrey(0.85);
        this.toneMappingPass.setAverageLuminance(0.78);
        this.composer.addPass(this.toneMappingPass);

        this.vignettePass = new ShaderPass(VignetteShader);
        this.vignettePass.uniforms.offset.value = 1.24;
        this.vignettePass.uniforms.darkness.value = 1.08;
        this.composer.addPass(this.vignettePass);

        this.defaultFocus = this.bokehPass.uniforms.focus.value;
        this.defaultAperture = this.bokehPass.uniforms.aperture.value;
        this.defaultMaxBlur = this.bokehPass.uniforms.maxblur.value;

        this.resetFocus = (duration = 0.7) => {
            this.transitionFocus({
                focus: this.defaultFocus,
                aperture: this.defaultAperture,
                maxblur: this.defaultMaxBlur,
                duration
            });
        };
    }

    setSize(width, height) {
        this.composer.setSize(width, height);
        this.bloomPass.setSize(width, height);
        if (this.bokehPass) {
            this.bokehPass.setSize(width, height);
        }
        if (typeof this.toneMappingPass.setSize === 'function') {
            this.toneMappingPass.setSize(width, height);
        }
    }

    transitionFocus({ focus, aperture, maxblur, duration = 0.9 }) {
        if (!this.bokehPass) return;
        const time = Math.max(duration ?? 0.9, 0);
        const animateUniform = (uniform, value) => {
            if (!uniform || value === undefined) return;
            if (time === 0) {
                uniform.value = value;
            } else {
                gsap.to(uniform, { value, duration: time, ease: 'sine.inOut' });
            }
        };
        animateUniform(this.bokehPass.uniforms.focus, focus);
        animateUniform(this.bokehPass.uniforms.aperture, aperture);
        animateUniform(this.bokehPass.uniforms.maxblur, maxblur);
    }

    render(delta) {
        this.composer.render(delta);
    }

    dispose() {
        if (this.composer && typeof this.composer.dispose === 'function') {
            this.composer.dispose();
        }
        if (this.bokehPass && this.bokehPass.renderTargetDepth && typeof this.bokehPass.renderTargetDepth.dispose === 'function') {
            this.bokehPass.renderTargetDepth.dispose();
        }
        if (this.bokehPass && this.bokehPass.renderTargetColor && typeof this.bokehPass.renderTargetColor.dispose === 'function') {
            this.bokehPass.renderTargetColor.dispose();
        }
    }
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
    if (!text) return y;
    const words = String(text).split(/\s+/).filter(Boolean);
    let line = '';
    let cursorY = y;
    words.forEach((word, index) => {
        const testLine = line ? `${line} ${word}` : word;
        const metrics = context.measureText(testLine);
        if (metrics.width > maxWidth && line) {
            context.fillText(line, x, cursorY);
            line = word;
            cursorY += lineHeight;
        } else {
            line = testLine;
        }
        if (index === words.length - 1 && line) {
            context.fillText(line, x, cursorY);
        }
    });
    return cursorY + lineHeight;
}

function drawCardFace(card, side = 'front') {
    const baseWidth = 1024;
    const baseHeight = 1536;
    const dpr = window.devicePixelRatio || 1;
    const scale = dpr > 1.5 ? 0.68 : 0.56;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(baseWidth * scale);
    canvas.height = Math.round(baseHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) {
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;
        return texture;
    }
    context.scale(scale, scale);

    context.clearRect(0, 0, baseWidth, baseHeight);

    const drawRoundedRect = (ctx, x, y, width, height, radius) => {
        const r = Math.min(radius, width / 2, height / 2);
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
    };

    const background = context.createLinearGradient(0, 0, baseWidth, baseHeight);
    if (side === 'front') {
        background.addColorStop(0, '#0a1d32');
        background.addColorStop(0.38, '#0f2841');
        background.addColorStop(0.72, '#102a46');
        background.addColorStop(1, '#0c1e30');
    } else {
        background.addColorStop(0, '#0b1a2b');
        background.addColorStop(0.5, '#0f2337');
        background.addColorStop(1, '#0a1828');
    }
    context.fillStyle = background;
    context.fillRect(0, 0, baseWidth, baseHeight);

    const glassSheen = context.createLinearGradient(0, 0, baseWidth, baseHeight);
    glassSheen.addColorStop(0, 'rgba(144, 201, 255, 0.18)');
    glassSheen.addColorStop(0.45, 'rgba(248, 230, 194, 0.14)');
    glassSheen.addColorStop(1, 'rgba(70, 140, 220, 0.12)');
    context.fillStyle = glassSheen;
    context.globalCompositeOperation = 'lighter';
    context.fillRect(0, 0, baseWidth, baseHeight);
    context.globalCompositeOperation = 'source-over';

    context.save();
    drawRoundedRect(context, 36, 36, baseWidth - 72, baseHeight - 72, 42);
    context.clip();

    const rimGlow = context.createRadialGradient(baseWidth * 0.18, baseHeight * 0.18, 0, baseWidth * 0.18, baseHeight * 0.18, baseWidth * 0.75);
    rimGlow.addColorStop(0, 'rgba(150, 220, 255, 0.2)');
    rimGlow.addColorStop(1, 'rgba(10, 22, 40, 0)');
    context.fillStyle = rimGlow;
    context.fillRect(0, 0, baseWidth, baseHeight);

    context.save();
    context.globalAlpha = 0.32;
    context.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 80; i += 1) {
        const sx = Math.random() * baseWidth;
        const sy = Math.random() * baseHeight;
        const radius = Math.random() * 1.6 + 0.4;
        context.fillStyle = `rgba(160, 220, 255, ${0.04 + Math.random() * 0.08})`;
        context.beginPath();
        context.arc(sx, sy, radius, 0, Math.PI * 2);
        context.fill();
    }
    context.restore();

    const auroraGradient = context.createLinearGradient(0, baseHeight * 0.3, baseWidth, baseHeight * 0.9);
    auroraGradient.addColorStop(0, 'rgba(110, 207, 255, 0.08)');
    auroraGradient.addColorStop(0.45, 'rgba(92, 148, 255, 0.12)');
    auroraGradient.addColorStop(1, 'rgba(18, 42, 72, 0.02)');
    context.fillStyle = auroraGradient;
    context.fillRect(0, 0, baseWidth, baseHeight);

    context.restore();

    const grainCanvas = document.createElement('canvas');
    grainCanvas.width = Math.round(baseWidth / 2);
    grainCanvas.height = Math.round(baseHeight / 2);
    const grainContext = grainCanvas.getContext('2d');
    if (grainContext) {
        const grainData = grainContext.createImageData(grainCanvas.width, grainCanvas.height);
        for (let i = 0; i < grainData.data.length; i += 4) {
            const value = 235 + Math.random() * 15;
            grainData.data[i] = value;
            grainData.data[i + 1] = value;
            grainData.data[i + 2] = value;
            grainData.data[i + 3] = Math.random() * 18;
        }
        grainContext.putImageData(grainData, 0, 0);
        context.globalCompositeOperation = 'overlay';
        context.drawImage(grainCanvas, 0, 0, baseWidth, baseHeight);
        context.globalCompositeOperation = 'source-over';
    }

    const paddingX = 160;
    const contentWidth = baseWidth - paddingX * 2;
    let cursorY = 260;

    context.shadowColor = 'rgba(6, 12, 24, 0.45)';
    context.shadowBlur = 24;
    context.fillStyle = '#f6fbff';
    context.font = '800 116px "Poppins", sans-serif';
    context.textBaseline = 'top';
    const title = card.title || card.summary || 'Card';
    cursorY = wrapText(context, title, paddingX, cursorY, contentWidth, 124);

    if (card.subtitle) {
        context.fillStyle = 'rgba(214, 235, 255, 0.92)';
        context.font = '600 74px "Poppins", sans-serif';
        cursorY = wrapText(context, card.subtitle, paddingX, cursorY + 16, contentWidth, 96);
    }

    const body = card.detail || card.summary || '';
    if (body) {
        context.fillStyle = 'rgba(224, 238, 255, 0.92)';
        context.font = '400 60px "Poppins", sans-serif';
        cursorY = wrapText(context, body, paddingX, cursorY + 32, contentWidth, 82);
    }

    if (Array.isArray(card.highlights) && card.highlights.length) {
        context.fillStyle = 'rgba(210, 230, 250, 0.95)';
        context.font = '500 58px "Poppins", sans-serif';
        const maxItems = Math.min(card.highlights.length, 3);
        let y = cursorY + 44;
        for (let i = 0; i < maxItems; i += 1) {
            const item = card.highlights[i];
            context.fillText(`• ${item}`, paddingX, y);
            y += 88;
        }
        cursorY = y;
    }

    const tags = Array.isArray(card.tags) ? card.tags.slice(0, 4) : [];
    if (tags.length) {
        context.font = '500 52px "Poppins", sans-serif';
        let x = paddingX;
        const y = baseHeight - 240;
        tags.forEach((tag) => {
            const label = `#${tag}`;
            const textWidth = context.measureText(label).width;
            const tagPaddingX = 36;
            const tagPaddingY = 18;
            drawRoundedRect(context, x - tagPaddingX, y - tagPaddingY, textWidth + tagPaddingX * 2, 68, 34);
            const gradient = context.createLinearGradient(x, y - 20, x + textWidth, y + 20);
            gradient.addColorStop(0, 'rgba(120, 176, 240, 0.32)');
            gradient.addColorStop(1, 'rgba(66, 120, 200, 0.26)');
            context.fillStyle = gradient;
            context.fill();
            context.strokeStyle = 'rgba(198, 224, 255, 0.4)';
            context.lineWidth = 2;
            context.stroke();
            context.fillStyle = 'rgba(222, 238, 255, 0.95)';
            context.fillText(label, x, y + 6);
            x += textWidth + tagPaddingX * 2 + 32;
        });
    }

    context.shadowBlur = 0;
    context.shadowColor = 'transparent';

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
}

function createCardMesh(card) {
    const group = new THREE.Group();
    group.userData.cardData = card;

    const frontTexture = drawCardFace(card, 'front');
    const backTexture = drawCardFace(card, 'back');

    const materialController = new RealisticCardMaterial({ frontTexture, backTexture });
    const [frontMaterial, backMaterial, edgeMaterial, glowMaterial] = materialController.materials;

    const bodyGeometry = new THREE.BoxGeometry(CARD_WIDTH, CARD_HEIGHT, CARD_THICKNESS, 8, 8, 2);
    const body = new THREE.Mesh(bodyGeometry, edgeMaterial);
    group.add(body);

    const faceGeometry = new THREE.PlaneGeometry(CARD_WIDTH * 0.96, CARD_HEIGHT * 0.96, 1, 1);
    const front = new THREE.Mesh(faceGeometry, frontMaterial);
    front.position.z = CARD_THICKNESS / 2 + 0.001;
    group.add(front);

    const back = new THREE.Mesh(faceGeometry, backMaterial);
    back.position.z = -CARD_THICKNESS / 2 - 0.001;
    back.rotation.y = Math.PI;
    group.add(back);

    const glow = new THREE.Mesh(new THREE.PlaneGeometry(CARD_WIDTH * 1.25, CARD_HEIGHT * 1.25), glowMaterial);
    glow.position.z = -CARD_THICKNESS;
    glow.renderOrder = -5;
    group.add(glow);

    materialController.bind({ group, front, back, edge: body, glow });

    [body, front, back].forEach((mesh) => {
        mesh.userData.cardGroup = group;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
    });

    group.userData.materials = [frontMaterial, backMaterial, edgeMaterial, glowMaterial];
    group.userData.textures = [frontTexture, backTexture];
    group.userData.front = front;
    group.userData.back = back;
    group.userData.basePosition = new THREE.Vector3();
    group.userData.idleRotation = new THREE.Euler();
    group.userData.floatOffset = Math.random() * Math.PI * 2;
    group.userData.isFocused = false;
    group.userData.isReturning = false;
    group.userData.materialController = materialController;

    return group;
}

function prepareDeck(cards) {
    const incoming = Array.isArray(cards) ? cards.filter(Boolean) : [];
    if (!incoming.length) {
        return Array.from({ length: CARD_COUNT }).map((_, index) => ({
            key: `card-${index + 1}`,
            title: `Progetto ${index + 1}`,
            subtitle: 'In arrivo',
            summary: 'Nuovo concept orbitale in fase di caricamento.',
            detail: 'Aggiornamento imminente dal laboratorio creativo.',
            highlights: ['XR prototipo', 'Render fisico', 'Storyliving'],
            tags: ['Preview']
        }));
    }
    const normalized = incoming.slice(0, CARD_COUNT).map((card, index) => ({
        key: card.key || `card-${index + 1}`,
        title: card.title || `Card ${index + 1}`,
        subtitle: card.subtitle || '',
        summary: card.summary || card.detail || '',
        detail: card.detail || card.summary || '',
        highlights: Array.isArray(card.highlights) ? card.highlights : [],
        tags: Array.isArray(card.tags) ? card.tags : []
    }));
    while (normalized.length < CARD_COUNT) {
        const cloneIndex = normalized.length % incoming.length;
        const base = normalized[cloneIndex];
        normalized.push({ ...base, key: `${base.key || 'card'}-echo-${normalized.length}` });
    }
    return normalized;
}

function animateCamera(camera, cameraTarget, toPosition, toTarget) {
    gsap.to(camera.position, {
        x: toPosition.x,
        y: toPosition.y,
        z: toPosition.z,
        duration: 0.9,
        ease: 'power2.inOut'
    });
    gsap.to(cameraTarget, {
        x: toTarget.x,
        y: toTarget.y,
        z: toTarget.z,
        duration: 0.9,
        ease: 'power2.inOut'
    });
}

function createRayFromEvent(event, domElement, camera, target) {
    const rect = domElement.getBoundingClientRect();
    const pointer = target;
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    return pointer;
}

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

    const canvas = document.createElement('canvas');
    canvas.className = 'cosmic-carousel__canvas';
    overlay.appendChild(canvas);

    const chrome = document.createElement('div');
    chrome.className = 'cosmic-carousel__chrome';

    const exitButton = document.createElement('button');
    exitButton.type = 'button';
    exitButton.className = 'cosmic-carousel__exit';
    exitButton.innerHTML = `
        <span class="cosmic-carousel__exit-core" aria-hidden="true">×</span>
        <span class="cosmic-carousel__exit-label" aria-hidden="true">Esci dal portale</span>
    `;
    exitButton.setAttribute('aria-label', 'Esci dal portale');

    const hud = document.createElement('div');
    hud.className = 'cosmic-carousel__hud';

    const hudActions = document.createElement('div');
    hudActions.className = 'cosmic-carousel__hud-actions';
    hudActions.appendChild(exitButton);

    hud.appendChild(hudActions);
    chrome.appendChild(hud);
    overlay.appendChild(chrome);

    document.body.appendChild(overlay);

    if (typeof onReady === 'function') {
        onReady({ overlay });
    }

    requestAnimationFrame(() => overlay.classList.add('is-active'));

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.physicallyCorrectLights = true;
    renderer.shadowMap.enabled = false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x040b16, 0.015);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
    camera.position.set(0, 1.4, 6.4);
    const cameraTarget = new THREE.Vector3(0, 1.1, 0);

    const postFX = new CinematicPostFX(renderer, scene, camera, overlay);
    const bloomPass = postFX.bloomPass;

    const lighting = new RealisticLighting(scene, renderer, {
        onEnvironmentLoaded: (envMap) => {
            updateEnvMap(envMap);
        }
    });

    const starFieldGeometry = new THREE.SphereGeometry(24, 48, 48);
    const starMaterial = new THREE.MeshBasicMaterial({
        color: 0x0a1930,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.62
    });
    const starField = new THREE.Mesh(starFieldGeometry, starMaterial);
    scene.add(starField);

    const auroraGeometry = new THREE.PlaneGeometry(18, 10, 1, 1);
    const auroraMaterial = new THREE.MeshBasicMaterial({
        color: 0x5ea8ff,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const auroraPlane = new THREE.Mesh(auroraGeometry, auroraMaterial);
    auroraPlane.position.set(0, 2.8, -6.2);
    auroraPlane.rotation.x = -Math.PI * 0.16;
    scene.add(auroraPlane);

    const deck = prepareDeck(cards);
    const carouselGroup = new THREE.Group();
    const focusGroup = new THREE.Group();
    scene.add(carouselGroup);
    scene.add(focusGroup);

    const selectable = [];
    const allCards = [];

    deck.forEach((card, index) => {
        const mesh = createCardMesh(card);
        const angle = (index / deck.length) * Math.PI * 2;
        const x = Math.cos(angle) * CAROUSEL_RADIUS;
        const z = Math.sin(angle) * CAROUSEL_RADIUS;
        const y = 1 + Math.sin(index) * 0.12;
        mesh.position.set(x, y, z);
        mesh.lookAt(0, 1.1, 0);
        mesh.userData.basePosition.copy(mesh.position);
        mesh.userData.idleRotation.copy(mesh.rotation);
        carouselGroup.add(mesh);
        selectable.push(mesh.children[0], mesh.children[1], mesh.children[2]);
        allCards.push(mesh);
        if (scene.environment) {
            if (mesh.userData.materialController && typeof mesh.userData.materialController.setEnvironment === 'function') {
                mesh.userData.materialController.setEnvironment(scene.environment);
            }
        }
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    let focusedCard = null;
    let rotationSpeed = DEFAULT_ROTATION_SPEED;
    let targetRotationSpeed = DEFAULT_ROTATION_SPEED;
    let isPointerDown = false;
    let dragDistance = 0;
    const defaultBloom = bloomPass.strength;
    const focusBloom = 1.12;

    const defaultCameraPosition = camera.position.clone();
    const defaultCameraTarget = cameraTarget.clone();
    const focusCameraPosition = new THREE.Vector3(0, 1.55, 3.6);
    const focusCameraTarget = new THREE.Vector3(0, 1.2, 0);
    const focusPoint = new THREE.Vector3(0, 1.25, 0);

    const clock = new THREE.Clock();

    function updateEnvMap(envMap) {
        allCards.forEach((card) => {
            if (card.userData.materialController && typeof card.userData.materialController.setEnvironment === 'function') {
                card.userData.materialController.setEnvironment(envMap);
            }
        });
    }

    function focusCard(cardGroup) {
        if (!cardGroup || cardGroup === focusedCard) {
            if (cardGroup) releaseFocus();
            return;
        }
        if (focusedCard) {
            releaseFocus();
        }
        focusedCard = cardGroup;
        cardGroup.userData.isFocused = true;
        cardGroup.userData.isReturning = false;

        focusGroup.attach(cardGroup);

        targetRotationSpeed = 0;
        gsap.killTweensOf(cardGroup.position);
        gsap.killTweensOf(cardGroup.rotation);
        gsap.killTweensOf(cardGroup.scale);

        gsap.to(cardGroup.position, {
            x: 0,
            y: 1.25,
            z: 0,
            duration: 0.85,
            ease: 'power3.inOut'
        });
        gsap.to(cardGroup.rotation, {
            x: 0,
            y: Math.PI,
            z: 0,
            duration: 0.95,
            ease: 'power2.inOut'
        });
        gsap.to(cardGroup.scale, {
            x: 1.12,
            y: 1.12,
            z: 1.12,
            duration: 0.8,
            ease: 'power2.out'
        });

        animateCamera(camera, cameraTarget, focusCameraPosition, focusCameraTarget);
        gsap.to(bloomPass, { strength: focusBloom, duration: 0.9, ease: 'sine.out' });
        postFX.transitionFocus({
            focus: focusCameraPosition.distanceTo(focusPoint),
            aperture: 0.00032,
            maxblur: 0.02,
            duration: 0.95
        });
    }

    function releaseFocus({ immediate = false } = {}) {
        if (!focusedCard) return;
        const cardGroup = focusedCard;
        focusedCard = null;

        carouselGroup.attach(cardGroup);

        gsap.killTweensOf(cardGroup.position);
        gsap.killTweensOf(cardGroup.rotation);
        gsap.killTweensOf(cardGroup.scale);

        if (immediate) {
            cardGroup.position.copy(cardGroup.userData.basePosition);
            cardGroup.rotation.copy(cardGroup.userData.idleRotation);
            cardGroup.scale.set(1, 1, 1);
            cardGroup.userData.isReturning = false;
            cardGroup.userData.isFocused = false;
            camera.position.copy(defaultCameraPosition);
            cameraTarget.copy(defaultCameraTarget);
            bloomPass.strength = defaultBloom;
            postFX.resetFocus(0);
        } else {
            cardGroup.userData.isReturning = true;
            gsap.to(cardGroup.position, {
                x: cardGroup.userData.basePosition.x,
                y: cardGroup.userData.basePosition.y,
                z: cardGroup.userData.basePosition.z,
                duration: 0.9,
                ease: 'power3.inOut',
                onComplete: () => {
                    cardGroup.userData.isReturning = false;
                    cardGroup.userData.isFocused = false;
                }
            });
            gsap.to(cardGroup.rotation, {
                x: cardGroup.userData.idleRotation.x,
                y: cardGroup.userData.idleRotation.y,
                z: cardGroup.userData.idleRotation.z,
                duration: 0.9,
                ease: 'power3.inOut'
            });
            gsap.to(cardGroup.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'power2.out' });
            animateCamera(camera, cameraTarget, defaultCameraPosition, defaultCameraTarget);
            gsap.to(bloomPass, { strength: defaultBloom, duration: 0.8, ease: 'sine.inOut' });
            postFX.resetFocus(0.75);
        }

        targetRotationSpeed = DEFAULT_ROTATION_SPEED;
    }

    function handleSelection(event) {
        createRayFromEvent(event, canvas, camera, pointer);
        raycaster.setFromCamera(pointer, camera);
        const intersections = raycaster.intersectObjects(selectable, false);
        if (intersections.length > 0) {
            const topObject = intersections[0].object;
            const topUserData = topObject ? topObject.userData : undefined;
            const top = topUserData ? topUserData.cardGroup : undefined;
            if (top) {
                focusCard(top);
            }
        }
    }

    let activePointerId = null;
    const lastPointerPosition = { x: 0, y: 0 };

    function handlePointerDown(event) {
        if (event.target !== canvas || isPointerDown) return;
        isPointerDown = true;
        dragDistance = 0;
        activePointerId = event.pointerId;
        lastPointerPosition.x = event.clientX;
        lastPointerPosition.y = event.clientY;
        overlay.classList.add('is-dragging');
    }

    function handlePointerMove(event) {
        if (!isPointerDown || event.pointerId !== activePointerId) return;

        let deltaX = event.movementX;
        let deltaY = event.movementY;

        const shouldRecalculateDelta =
            event.pointerType === 'touch' || (deltaX === 0 && deltaY === 0);

        if (shouldRecalculateDelta) {
            deltaX = event.clientX - lastPointerPosition.x;
            deltaY = event.clientY - lastPointerPosition.y;
        }

        lastPointerPosition.x = event.clientX;
        lastPointerPosition.y = event.clientY;

        if (deltaX === 0 && deltaY === 0) return;

        dragDistance += Math.abs(deltaX) + Math.abs(deltaY);
        const deltaRotation = deltaX * 0.0045;
        carouselGroup.rotation.y += deltaRotation;
        targetRotationSpeed = 0;
    }

    function handlePointerUp(event) {
        if (!isPointerDown || event.pointerId !== activePointerId) return;
        overlay.classList.remove('is-dragging');
        isPointerDown = false;
        activePointerId = null;
        if (dragDistance < 6) {
            handleSelection(event);
        } else if (!focusedCard) {
            targetRotationSpeed = DEFAULT_ROTATION_SPEED;
        }
    }

    function handleResize() {
        const width = overlay.clientWidth || window.innerWidth;
        const height = overlay.clientHeight || window.innerHeight;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        renderer.setSize(width, height, false);
        postFX.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }

    function animate() {
        const delta = clock.getDelta();
        const elapsed = clock.elapsedTime;
        rotationSpeed += (targetRotationSpeed - rotationSpeed) * 0.06;
        carouselGroup.rotation.y += delta * rotationSpeed;

        carouselGroup.children.forEach((child) => {
            if (!child.userData) return;
            if (child.userData.isFocused || child.userData.isReturning) return;
            const float = Math.sin(elapsed * 0.85 + child.userData.floatOffset) * 0.18;
            const sway = Math.sin(elapsed * 0.6 + child.userData.floatOffset) * 0.03;
            child.position.y = child.userData.basePosition.y + float;
            child.rotation.x = sway * 0.45;
            child.rotation.z = sway * 0.35;
        });

        starField.rotation.y += delta * 0.02;
        starField.rotation.z += delta * 0.01;
        auroraPlane.position.x = Math.sin(elapsed * 0.24) * 0.8;
        auroraPlane.material.opacity = 0.18 + Math.sin(elapsed * 0.6) * 0.05;

        allCards.forEach((card) => {
            const controller = card.userData ? card.userData.materialController : undefined;
            if (controller && typeof controller.update === 'function') {
                controller.update(camera, elapsed);
            }
        });

        lighting.update(camera, elapsed);
        camera.lookAt(cameraTarget);
        postFX.render(delta);
    }

    renderer.setAnimationLoop(animate);
    handleResize();

    window.addEventListener('resize', handleResize);
    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    exitButton.addEventListener('click', () => {
        cleanup(true);
    });

    function onKeydown(event) {
        if (event.key === 'Escape') {
            cleanup(true);
        }
    }
    window.addEventListener('keydown', onKeydown);

    function cleanup(triggerClose = false) {
        renderer.setAnimationLoop(null);
        releaseFocus({ immediate: true });
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
        window.removeEventListener('keydown', onKeydown);
        canvas.removeEventListener('pointerdown', handlePointerDown);

        carouselGroup.children.forEach((child) => {
            gsap.killTweensOf(child.position);
            gsap.killTweensOf(child.rotation);
            gsap.killTweensOf(child.scale);
        });
        gsap.killTweensOf(camera.position);
        gsap.killTweensOf(cameraTarget);
        gsap.killTweensOf(bloomPass);
        if (postFX.bokehPass && postFX.bokehPass.uniforms) {
            const { focus, aperture, maxblur } = postFX.bokehPass.uniforms;
            gsap.killTweensOf(focus);
            gsap.killTweensOf(aperture);
            gsap.killTweensOf(maxblur);
        }
        postFX.resetFocus(0.25);

        overlay.classList.remove('is-active');
        overlay.classList.add('is-closing');

        setTimeout(() => {
            postFX.dispose();
            if (lighting && typeof lighting.dispose === 'function') {
                lighting.dispose();
            }
            renderer.dispose();
            carouselGroup.traverse((child) => {
                if (child.isMesh) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach((mat) => {
                        if (mat && typeof mat.dispose === 'function') {
                            mat.dispose();
                        }
                    });
                }
                if (child.userData && child.userData.textures) {
                    child.userData.textures.forEach((texture) => {
                        if (texture && typeof texture.dispose === 'function') {
                            texture.dispose();
                        }
                    });
                }
                if (child.userData && child.userData.materialController) {
                    const controller = child.userData.materialController;
                    if (controller && typeof controller.dispose === 'function') {
                        controller.dispose();
                    }
                }
            });
            starFieldGeometry.dispose();
            starMaterial.dispose();
            auroraGeometry.dispose();
            auroraMaterial.dispose();
            overlay.remove();
        }, 520);

        if (triggerClose && typeof onRequestClose === 'function') {
            onRequestClose();
        }
    }

    return {
        overlay,
        close: () => cleanup(true)
    };
}

