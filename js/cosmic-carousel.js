import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { AdaptiveToneMappingPass } from 'three/examples/jsm/postprocessing/AdaptiveToneMappingPass.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm';

const CARD_COUNT = 10;
const CARD_WIDTH = 1.15;
const CARD_HEIGHT = CARD_WIDTH * 1.45;
const CARD_THICKNESS = 0.05;
const CAROUSEL_RADIUS = 3.6;
const DEFAULT_ROTATION_SPEED = 0.22;

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
            metalness: 0.68,
            roughness: 0.22,
            clearcoat: 1,
            clearcoatRoughness: 0.08,
            transmission: 0.12,
            thickness: 0.48,
            ior: 1.52,
            reflectivity: 0.82,
            sheen: 0.55,
            sheenRoughness: 0.32,
            iridescence: 0.68,
            iridescenceIOR: 1.32,
            iridescenceThicknessRange: [180, 420],
            envMapIntensity: 1.35,
            side: THREE.FrontSide,
            transparent: true,
            opacity: 1
        };

        this.frontMaterial = new THREE.MeshPhysicalMaterial({
            ...sharedPhysicalProps,
            map: frontTexture,
            emissive: new THREE.Color(0x1a385b),
            emissiveIntensity: 0.18,
            specularIntensity: 0.65,
            specularColor: new THREE.Color(0x9bd4ff),
            attenuationColor: new THREE.Color(0x7fd3ff),
            attenuationDistance: 1.2
        });

        this.backMaterial = new THREE.MeshPhysicalMaterial({
            ...sharedPhysicalProps,
            map: backTexture,
            emissive: new THREE.Color(0x0a1e30),
            emissiveIntensity: 0.14,
            sheenColor: new THREE.Color(0x244a74),
            envMapIntensity: 0.95,
            attenuationColor: new THREE.Color(0x4d6c94),
            attenuationDistance: 1.35
        });

        this.edgeMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x090f1a,
            metalness: 0.92,
            roughness: 0.18,
            clearcoat: 1,
            clearcoatRoughness: 0.06,
            envMapIntensity: 1.15,
            specularIntensity: 0.9,
            sheen: 0.35,
            sheenColor: new THREE.Color(0x7aa0ff),
            emissive: new THREE.Color(0x0d1b2f)
        });

        this.glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x99e0ff,
            transparent: true,
            opacity: 0.28,
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
        this._frontSheenColor = new THREE.Color(0x9bd4ff);
        this._edgeSheenColor = new THREE.Color(0x7aa0ff);
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
        const fresnel = Math.pow(1 - Math.max(TEMP_NORMAL.dot(this._cameraVector), 0), 2.6);

        const breathing = 0.5 + Math.sin(elapsed * 0.8) * 0.1;

        this.frontMaterial.clearcoatRoughness = THREE.MathUtils.lerp(0.03, 0.16, fresnel);
        this.frontMaterial.iridescence = THREE.MathUtils.lerp(0.45, 1, fresnel * 1.2);
        this.frontMaterial.iridescenceThicknessRange = [180, 380 + fresnel * 260];
        this.frontMaterial.emissiveIntensity = 0.16 + fresnel * 0.7;
        this.frontMaterial.envMapIntensity = 1.25 + fresnel * 0.45;
        this.frontMaterial.sheen = THREE.MathUtils.lerp(0.5, 0.9, fresnel);
        this._frontSheenColor.setHSL(0.58, 0.56, 0.72 + fresnel * 0.12);
        this.frontMaterial.sheenColor.copy(this._frontSheenColor);

        if (this.backMaterial && this.backMesh) {
            this.backMesh.getWorldQuaternion(this._worldQuaternion);
            TEMP_NORMAL.copy(BACK_NORMAL).applyQuaternion(this._worldQuaternion);
            const backFresnel = Math.pow(1 - Math.max(TEMP_NORMAL.dot(this._cameraVector), 0), 2.2);
            this.backMaterial.envMapIntensity = 0.85 + backFresnel * 0.3;
            this.backMaterial.iridescence = THREE.MathUtils.lerp(0.35, 0.72, backFresnel + breathing * 0.12);
            this.backMaterial.emissiveIntensity = 0.12 + backFresnel * 0.4;
        }

        if (this.edgeMaterial) {
            const pulse = 0.82 + Math.sin(elapsed * 1.6) * 0.08;
            this.edgeMaterial.metalness = 0.88 + fresnel * 0.1;
            this.edgeMaterial.roughness = THREE.MathUtils.lerp(0.12, 0.26, 1 - fresnel);
            this.edgeMaterial.envMapIntensity = 1.05 + fresnel * 0.35;
            this.edgeMaterial.sheen = 0.28 + fresnel * 0.22;
            this._edgeSheenColor.setHSL(0.6, 0.4, 0.6 + fresnel * 0.2);
            this.edgeMaterial.sheenColor.copy(this._edgeSheenColor);
            this.edgeMaterial.emissiveIntensity = pulse * 0.2;
        }

        if (this.glowMaterial && this.glowMesh) {
            const glowBase = 0.18 + fresnel * 0.55;
            this.glowMaterial.opacity = THREE.MathUtils.clamp(glowBase + breathing * 0.08, 0.1, 0.85);
            this.glowMesh.scale.setScalar(1.12 + fresnel * 0.22);
        }
    }

    dispose() {
        this.materials.forEach((material) => material?.dispose?.());
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

        this.ambient = new THREE.HemisphereLight(0x1d283c, 0x010206, 0.38);

        this.keyLight = new THREE.DirectionalLight(0xffad72, 2.25);
        this.keyLight.position.set(4.2, 6.5, 6.8);
        this.keyLight.target.position.set(0, 1.2, 0);

        this.fillLight = new THREE.DirectionalLight(0xcbd7e6, 0.9);
        this.fillLight.position.set(-3.2, 3.4, 2.2);
        this.fillLight.target.position.set(0, 1.1, 0);

        this.rimLight = new THREE.DirectionalLight(0x74c8ff, 2.65);
        this.rimLight.position.set(-5.8, 4.2, -6.4);
        this.rimLight.target.position.set(0, 1.4, 0);

        [
            this.ambient,
            this.keyLight,
            this.keyLight.target,
            this.fillLight,
            this.fillLight.target,
            this.rimLight,
            this.rimLight.target
        ].forEach((light) => this.scene.add(light));

        this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        this.pmremGenerator.compileEquirectangularShader();

        this.loadEnvironment('./assets/3d/env/solitude_night_4k.hdr', onEnvironmentLoaded);
    }

    loadEnvironment(path, onEnvironmentLoaded) {
        new RGBELoader().setDataType(THREE.FloatType).load(
            path,
            (hdr) => {
                const envMap = this.pmremGenerator.fromEquirectangular(hdr).texture;
                envMap.name = 'SolitudeNightHDR';
                this.scene.environment = envMap;
                onEnvironmentLoaded?.(envMap);
                hdr.dispose?.();
            },
            undefined,
            () => {
                new RGBELoader().load(
                    'https://cdn.jsdelivr.net/gh/pmndrs/drei-assets@master/hdri/night_sky.hdr',
                    (fallbackHdr) => {
                        const envMap = this.pmremGenerator.fromEquirectangular(fallbackHdr).texture;
                        envMap.name = 'NightSkyFallback';
                        this.scene.environment = envMap;
                        onEnvironmentLoaded?.(envMap);
                        fallbackHdr.dispose?.();
                    }
                );
            }
        );
    }

    update(camera, elapsed = 0) {
        const oscillation = Math.sin(elapsed * 0.6) * 0.1;
        this.keyLight.intensity = 2.15 + oscillation * 0.6;
        this.fillLight.intensity = 0.85 + Math.sin(elapsed * 0.8 + 1.4) * 0.12;

        this.tempVector.copy(camera.position).normalize().multiplyScalar(-7.2);
        this.tempVector.y += 4.6;
        this.rimLight.position.lerp(this.tempVector, 0.12);
        this.rimLight.intensity = 2.45 + Math.abs(Math.sin(elapsed * 1.1)) * 0.35;
    }

    dispose() {
        this.pmremGenerator?.dispose?.();
    }
}

class CinematicPostFX {
    constructor(renderer, scene, camera, size) {
        const width = size.clientWidth || window.innerWidth;
        const height = size.clientHeight || window.innerHeight;

        this.composer = new EffectComposer(renderer);
        this.renderPass = new RenderPass(scene, camera);
        this.composer.addPass(this.renderPass);

        this.bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.85, 0.6, 0.18);
        this.bloomPass.threshold = 0.22;
        this.bloomPass.radius = 0.68;
        this.composer.addPass(this.bloomPass);

        this.bokehPass = new BokehPass(scene, camera, {
            focus: 3.2,
            aperture: 0.00018,
            maxblur: 0.012,
            width,
            height
        });
        this.composer.addPass(this.bokehPass);

        this.toneMappingPass = new AdaptiveToneMappingPass(true, width);
        this.toneMappingPass.setAdaptionRate(2.4);
        this.toneMappingPass.setMaxLuminance(32);
        this.toneMappingPass.setMiddleGrey(0.9);
        this.toneMappingPass.setAverageLuminance(0.8);
        this.composer.addPass(this.toneMappingPass);

        this.vignettePass = new ShaderPass(VignetteShader);
        this.vignettePass.uniforms.offset.value = 1.22;
        this.vignettePass.uniforms.darkness.value = 1.18;
        this.composer.addPass(this.vignettePass);

        this.defaultFocus = this.bokehPass.uniforms.focus.value;
        this.defaultAperture = this.bokehPass.uniforms.aperture.value;
        this.defaultMaxBlur = this.bokehPass.uniforms.maxblur.value;
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

    resetFocus(duration = 0.7) {
        this.transitionFocus({
            focus: this.defaultFocus,
            aperture: this.defaultAperture,
            maxblur: this.defaultMaxBlur,
            duration
        });
        ctx.restore();
    }

    render(delta) {
        this.composer.render(delta);
    }

    dispose() {
        this.composer?.dispose?.();
        this.bokehPass?.renderTargetDepth?.dispose?.();
        this.bokehPass?.renderTargetColor?.dispose?.();
    }
}

function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, Math.min(width, height) / 2);
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
    if (!text) return y;
    const words = String(text).split(/\s+/).filter(Boolean);
    let line = '';
    let cursorY = y;
    words.forEach((word, index) => {
        const testLine = line ? `${line} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line) {
            ctx.fillText(line, x, cursorY);
            line = word;
            cursorY += lineHeight;
        } else {
            line = testLine;
        }
        if (index === words.length - 1 && line) {
            ctx.fillText(line, x, cursorY);
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
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    ctx.clearRect(0, 0, baseWidth, baseHeight);

    const background = ctx.createLinearGradient(0, 0, baseWidth, baseHeight);
    if (side === 'front') {
        background.addColorStop(0, '#050f1e');
        background.addColorStop(0.55, '#061b38');
        background.addColorStop(1, '#04101f');
    } else {
        background.addColorStop(0, '#041120');
        background.addColorStop(0.55, '#08223b');
        background.addColorStop(1, '#05121f');
    }
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, baseWidth, baseHeight);

    const glowA = ctx.createRadialGradient(baseWidth * 0.2, baseHeight * 0.2, 10, baseWidth * 0.2, baseHeight * 0.2, baseWidth * 0.9);
    glowA.addColorStop(0, 'rgba(124, 224, 255, 0.42)');
    glowA.addColorStop(1, 'rgba(12, 32, 60, 0)');
    const glowB = ctx.createRadialGradient(baseWidth * 0.84, baseHeight * 0.78, 16, baseWidth * 0.84, baseHeight * 0.78, baseWidth * 0.7);
    glowB.addColorStop(0, 'rgba(255, 188, 136, 0.36)');
    glowB.addColorStop(1, 'rgba(34, 46, 68, 0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glowA;
    ctx.fillRect(0, 0, baseWidth, baseHeight);
    ctx.fillStyle = glowB;
    ctx.fillRect(0, 0, baseWidth, baseHeight);
    ctx.restore();

    ctx.save();
    ctx.shadowColor = 'rgba(98, 210, 255, 0.35)';
    ctx.shadowBlur = 48;
    roundedRect(ctx, 80, 110, baseWidth - 160, baseHeight - 220, 120);
    ctx.fillStyle = 'rgba(6, 16, 30, 0.95)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(150, 230, 255, 0.42)';
    ctx.lineWidth = 3.6;
    ctx.stroke();
    ctx.restore();

    const innerGradient = ctx.createLinearGradient(160, 180, baseWidth - 160, baseHeight - 260);
    innerGradient.addColorStop(0, 'rgba(16, 40, 72, 0.88)');
    innerGradient.addColorStop(0.5, 'rgba(14, 32, 60, 0.94)');
    innerGradient.addColorStop(1, 'rgba(12, 26, 48, 0.92)');
    ctx.save();
    roundedRect(ctx, 160, 190, baseWidth - 320, baseHeight - 340, 90);
    ctx.fillStyle = innerGradient;
    ctx.fill();
    ctx.strokeStyle = 'rgba(124, 220, 255, 0.45)';
    ctx.lineWidth = 2.8;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const sheen = ctx.createLinearGradient(180, 210, baseWidth - 200, 360);
    sheen.addColorStop(0, 'rgba(126, 224, 255, 0.45)');
    sheen.addColorStop(1, 'rgba(255, 186, 130, 0.4)');
    roundedRect(ctx, 200, 240, baseWidth - 400, 220, 60);
    ctx.fillStyle = sheen;
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#e9f7ff';
    ctx.font = '700 110px "Poppins", sans-serif';
    ctx.textBaseline = 'top';
    const title = String(card.title || '').toUpperCase();
    wrapText(ctx, title, 240, 300, baseWidth - 480, 118);

    ctx.fillStyle = 'rgba(191, 226, 255, 0.9)';
    ctx.font = '600 64px "Poppins", sans-serif';
    wrapText(ctx, card.subtitle || '', 240, 520, baseWidth - 480, 82);

    ctx.fillStyle = 'rgba(212, 235, 255, 0.86)';
    ctx.font = '400 52px "Poppins", sans-serif';
    const body = side === 'front' ? (card.summary || card.detail || '') : (card.detail || card.summary || '');
    const textEnd = wrapText(ctx, body, 240, 660, baseWidth - 480, 68);

    const list = Array.isArray(card.highlights) ? card.highlights.slice(0, side === 'front' ? 2 : 4) : [];
    if (list.length) {
        ctx.save();
        ctx.font = '500 50px "Poppins", sans-serif';
        ctx.fillStyle = 'rgba(168, 228, 255, 0.92)';
        let y = textEnd + 30;
        list.forEach((item) => {
            roundedRect(ctx, 240, y - 20, baseWidth - 480, 84, 42);
            const glow = ctx.createLinearGradient(240, y - 20, baseWidth - 240, y + 64);
            glow.addColorStop(0, 'rgba(70, 140, 220, 0.25)');
            glow.addColorStop(1, 'rgba(240, 190, 120, 0.18)');
            ctx.fillStyle = glow;
            ctx.fill();
            ctx.fillStyle = 'rgba(214, 238, 255, 0.96)';
            ctx.fillText(item, 280, y + 12, baseWidth - 520);
            y += 110;
        });
        ctx.restore();
    }

    const tags = Array.isArray(card.tags) ? card.tags.slice(0, 4) : [];
    if (tags.length) {
        ctx.save();
        ctx.font = '500 46px "Poppins", sans-serif';
        let x = 260;
        const y = baseHeight - 280;
        tags.forEach((tag) => {
            const label = `#${tag}`;
            const metrics = ctx.measureText(label).width;
            const pillWidth = metrics + 120;
            roundedRect(ctx, x, y, pillWidth, 92, 46);
            const gradient = ctx.createLinearGradient(x, y, x + pillWidth, y + 92);
            gradient.addColorStop(0, 'rgba(66, 140, 220, 0.85)');
            gradient.addColorStop(1, 'rgba(236, 176, 130, 0.68)');
            ctx.fillStyle = gradient;
            ctx.fill();
            ctx.strokeStyle = 'rgba(160, 228, 255, 0.45)';
            ctx.lineWidth = 2.6;
            ctx.stroke();
            ctx.fillStyle = '#f4fbff';
            ctx.fillText(label, x + 40, y + 28);
            x += pillWidth + 32;
        });
        ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 180; i += 1) {
        const sx = Math.random() * baseWidth;
        const sy = Math.random() * baseHeight;
        const radius = Math.random() * 2 + 0.6;
        ctx.fillStyle = `rgba(140, 230, 255, ${0.05 + Math.random() * 0.2})`;
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

    const hud = document.createElement('div');
    hud.className = 'cosmic-carousel__hud';

    const hudInfo = document.createElement('div');
    hudInfo.className = 'cosmic-carousel__hud-info';
    hudInfo.innerHTML = `
        <span class="cosmic-carousel__hud-badge">${name || 'Carosello 3D'}</span>
        <h2>${title || 'Orbita Creativa'}</h2>
        ${description ? `<p>${description}</p>` : ''}
    `;

    const hudActions = document.createElement('div');
    hudActions.className = 'cosmic-carousel__hud-actions';

    const instructions = document.createElement('span');
    instructions.className = 'cosmic-carousel__hud-instructions';
    instructions.textContent = 'Clicca una card per approfondire · Drag per orbitare';

    const exitButton = document.createElement('button');
    exitButton.type = 'button';
    exitButton.className = 'cosmic-carousel__exit';
    exitButton.innerHTML = `
        <span>
            <span class="cosmic-carousel__exit-icon">↩</span>
            <span>Chiudi portale</span>
        </span>
    `;
    exitButton.setAttribute('aria-label', 'Chiudi il carosello e torna alla scena');

    hudActions.appendChild(exitButton);
    hudActions.appendChild(instructions);
    hud.appendChild(hudInfo);
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
    renderer.toneMappingExposure = 1.0;
    renderer.physicallyCorrectLights = true;
    renderer.useLegacyLights = false;
    renderer.shadowMap.enabled = false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020712, 0.012);

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

    const starFieldGeometry = new THREE.SphereGeometry(22, 32, 32);
    const starMaterial = new THREE.MeshBasicMaterial({
        color: 0x0a1930,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.65
    });
    const starField = new THREE.Mesh(starFieldGeometry, starMaterial);
    scene.add(starField);

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
            mesh.userData.materialController?.setEnvironment(scene.environment);
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
    const focusBloom = 1.22;

    const defaultCameraPosition = camera.position.clone();
    const defaultCameraTarget = cameraTarget.clone();
    const focusCameraPosition = new THREE.Vector3(0, 1.55, 3.6);
    const focusCameraTarget = new THREE.Vector3(0, 1.2, 0);
    const focusPoint = new THREE.Vector3(0, 1.25, 0);

    const clock = new THREE.Clock();

    function updateEnvMap(envMap) {
        allCards.forEach((card) => {
            card.userData.materialController?.setEnvironment(envMap);
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
        instructions.textContent = 'Card focalizzata · Clicca di nuovo per tornare al carosello';
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

        instructions.textContent = 'Clicca una card per approfondire · Drag per orbitare';
        targetRotationSpeed = DEFAULT_ROTATION_SPEED;
    }

    function handleSelection(event) {
        createRayFromEvent(event, canvas, camera, pointer);
        raycaster.setFromCamera(pointer, camera);
        const intersections = raycaster.intersectObjects(selectable, false);
        if (intersections.length > 0) {
            const top = intersections[0].object?.userData?.cardGroup;
            if (top) {
                focusCard(top);
            }
        }
    }

    function handlePointerDown(event) {
        if (event.target !== canvas) return;
        isPointerDown = true;
        dragDistance = 0;
        overlay.classList.add('is-dragging');
    }

    function handlePointerMove(event) {
        if (!isPointerDown) return;
        dragDistance += Math.abs(event.movementX) + Math.abs(event.movementY);
        const delta = event.movementX * 0.0045;
        carouselGroup.rotation.y += delta;
        targetRotationSpeed = 0;
    }

    function handlePointerUp(event) {
        if (!isPointerDown) return;
        overlay.classList.remove('is-dragging');
        isPointerDown = false;
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

        allCards.forEach((card) => {
            card.userData.materialController?.update(camera, elapsed);
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
        if (postFX.bokehPass?.uniforms) {
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
            lighting.dispose?.();
            renderer.dispose();
            carouselGroup.traverse((child) => {
                if (child.isMesh) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach((mat) => mat?.dispose?.());
                }
                if (child.userData?.textures) {
                    child.userData.textures.forEach((texture) => texture?.dispose?.());
                }
                if (child.userData?.materialController) {
                    child.userData.materialController.dispose();
                }
            });
            starFieldGeometry.dispose();
            starMaterial.dispose();
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

