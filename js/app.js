    // ========================================================
    //   AGENZIA DIGITALE 3D SCENE – INTERSTELLAR WARP EDITION
    //   Portale dorato attorno al pulsante + Warp postprocess
    //   (tutti gli effetti, click robusto, nessuna rimozione)
    // ========================================================
    import * as THREE from 'three';
    import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js';
    import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/GLTFLoader.js';
    import { DRACOLoader } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/DRACOLoader.js';
    import { RGBELoader } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/RGBELoader.js';
    import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/postprocessing/EffectComposer.js';
    import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/postprocessing/RenderPass.js';
    import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/postprocessing/UnrealBloomPass.js';
    import { SSAOPass } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/postprocessing/SSAOPass.js';
    import { BokehPass } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/postprocessing/BokehPass.js';
    import { FilmPass } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/postprocessing/FilmPass.js';
    import { ShaderPass } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/postprocessing/ShaderPass.js';
    import gsap from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/index.js';

    // -------------------------
    // DEBUG SWITCH (true/false)
    // -------------------------
const DEBUG_LOG = false;
const log = (...a)=>{ if(DEBUG_LOG) console.log('[3D]',...a); };

// easing personalizzati per i movimenti "wormhole"
const wormholeEase = (t) => {
    const accelerated = Math.pow(t, 1.45);
    return THREE.MathUtils.clamp(accelerated, 0, 1);
};

const wormholeReturnEase = (t) => {
    const eased = 1 - Math.pow(1 - t, 1.85);
    return THREE.MathUtils.clamp(eased, 0, 1);
};

    // --------------------------------------------------------
    //  RENDERER + SCENA
    // --------------------------------------------------------
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 2.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Assicura che il canvas riceva i click
    const container = document.getElementById('canvas-container');
    container.style.position = 'fixed';
    container.style.inset = '0';
    container.style.zIndex = '1';
    container.style.pointerEvents = 'auto';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a0a, 0.00025);

    // --------------------------------------------------------
    //  CAMERA + CONTROLLI
    // --------------------------------------------------------
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 8000);
    camera.position.set(16.89, 282.66, -1406.02);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.minPolarAngle = THREE.MathUtils.degToRad(55);
    controls.maxPolarAngle = THREE.MathUtils.degToRad(85);

    // --------------------------------------------------------
    //  LUCI
    // --------------------------------------------------------
    const hemi = new THREE.HemisphereLight(0xfff8e5, 0x222222, 2.2);
    const sunLight = new THREE.DirectionalLight(0xffe6b0, 3.5);
    sunLight.position.set(1000, 2000, 1000);
    sunLight.castShadow = true;
    const ambient = new THREE.AmbientLight(0xfff4d2, 2.4);
    scene.add(hemi, sunLight, ambient);

    // --------------------------------------------------------
    //  HDRI
    // --------------------------------------------------------
    const rgbeLoader = new RGBELoader();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    rgbeLoader.load('./assets/3d/env/sunset.hdr', (tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        const envMap = pmremGenerator.fromEquirectangular(tex).texture;
        scene.environment = envMap;
        scene.background = envMap;
    });

    // --------------------------------------------------------
    //  AUDIO
    // --------------------------------------------------------
    const warpSound   = new Audio('./assets/audio/warp.mp3');        warpSound.volume = 0.8; warpSound.playbackRate = 0.8;
    const portalSound = new Audio('./assets/audio/portal-open.mp3'); portalSound.volume = 0.9;
    const clickSound  = new Audio('./assets/audio/click.mp3');       clickSound.volume = 0.8;

    // --------------------------------------------------------
    //  MODELLO PRINCIPALE
    // --------------------------------------------------------
    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://unpkg.com/three@0.161.0/examples/jsm/libs/draco/');
    gltfLoader.setDRACOLoader(dracoLoader);
    gltfLoader.load('./assets/3d/scene.gltf', (gltf) => {
        const model = gltf.scene;
        model.traverse(o => {
            if (o.isMesh && o.material) {
                o.castShadow = true;
                o.receiveShadow = true;
                o.material.envMapIntensity = 1.2;
                o.material.metalness = 0.8;
                o.material.roughness = 0.3;
            }
        });
        scene.add(model);
    });

    // --------------------------------------------------------
    //  PULSANTI 3D + FLARE INTERSTELLAR
    // --------------------------------------------------------
    const mixers = [];
    const clickableRoots = [];   // i root (3 pulsanti)
    const clickableMeshes = [];  // TUTTE le mesh discendenti dei pulsanti (per raycast)

    const btnPositions = [
        { name: 'Portfolio',  pos: new THREE.Vector3(-900, 180, -400) },
        { name: 'Consulenza', pos: new THREE.Vector3(0,    180, -250) },
        { name: 'Chi Siamo',  pos: new THREE.Vector3( 900, 180, -400) }
    ];

    const flareMat = new THREE.ShaderMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        uniforms: {
            time:  { value: 0 },
            color: { value: new THREE.Color(1.0, 0.8, 0.3) }
        },
        vertexShader: `
        varying vec2 vUv;
        void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
      `,
        fragmentShader: `
        varying vec2 vUv;
        uniform float time;
        uniform vec3 color;
        void main(){
          float d = abs(vUv.y - 0.5);
          float glow = smoothstep(0.5, 0.0, d) * (0.8 + 0.3*sin(time*2.0));
          gl_FragColor = vec4(color * glow, glow);
        }
      `
    });

    function collectMeshes(node, out) {
        node.traverse(n=>{
            if (n.isMesh) out.push(n);
        });
    }

    btnPositions.forEach(({ name, pos }) => {
        gltfLoader.load('./assets/3d/ui/scene.gltf', (gltf) => {
            const root = gltf.scene;
            root.position.copy(pos);
            root.scale.set(200, 200, 200);
            root.userData.name = name;

            root.traverse(o => {
                if (o.isMesh && o.material) {
                    o.material.transparent = true;
                    o.material.emissive = new THREE.Color(0xffbb66);
                    o.material.emissiveIntensity = 1.3;
                }
            });

            // flare interstellare orizzontale
            const flare = new THREE.Mesh(new THREE.PlaneGeometry(400, 15), flareMat.clone());
            flare.rotation.x = Math.PI / 2;
            flare.position.set(0, 150, 0);
            root.add(flare);
            root.userData.flare = flare;

            // animazioni GLTF sempre ON
            if (gltf.animations && gltf.animations.length > 0) {
                const mixer = new THREE.AnimationMixer(root);
                gltf.animations.forEach(a => {
                    const act = mixer.clipAction(a);
                    act.play(); act.loop = THREE.LoopRepeat;
                });
                mixers.push(mixer);
            }

            scene.add(root);

            // registra root + tutte le mesh discendenti per il raycast
            clickableRoots.push(root);
            collectMeshes(root, clickableMeshes);

            log('Pulsante caricato:', name, 'meshes:', clickableMeshes.length);
        });
    });

    // Utility: risale la gerarchia fino a trovare il root pulsante
    function findRootButton(obj) {
        let cur = obj;
        while (cur) {
            if (clickableRoots.includes(cur)) return cur;
            cur = cur.parent;
        }
        return null;
    }

    // --------------------------------------------------------
    //  POST-PROCESSING (manteniamo tutto) + WARP SHADER PASS
    // --------------------------------------------------------
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const ssao = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
    ssao.kernelRadius = 16;
    composer.addPass(ssao);
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.25, 0.4, 0.9);
    composer.addPass(bloom);
    const bokeh = new BokehPass(scene, camera, { focus: 800, aperture: 1.5, maxblur: 0.002 });
    composer.addPass(bokeh);
    const film = new FilmPass(0.2, 0.08, 648, false);
    composer.addPass(film);

    // Warp ripple/chroma centrato sul pulsante (screen-space)
    const WarpShader = {
        uniforms: {
            tDiffuse: { value: null },
            time: { value: 0 },
            strength: { value: 0.0 },      // 0..1 durante il warp
            chroma: { value: 0.0 },        // aberrazione cromatica
            center: { value: new THREE.Vector2(0.5, 0.5) }, // centro portale in NDC [0..1]
            radius: { value: 0.25 }        // raggio dell'effetto
        },
        vertexShader: `
        varying vec2 vUv;
        void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
      `,
        fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float time, strength, chroma, radius;
        uniform vec2 center;
        varying vec2 vUv;
    
        void main(){
          vec2 uv = vUv;
          // distanza dal centro del portale
          vec2 d = uv - center;
          float dist = length(d);
    
          // maschera radiale morbida
          float mask = smoothstep(radius, 0.0, dist);
    
          // distorsione radiale + onda
          float ripple = sin(dist*40.0 - time*10.0) * 0.02 * strength;
          vec2 dir = normalize(d + 1e-6);
          uv += dir * ripple * (1.0 - mask);
    
          // aberrazione cromatica
          vec2 off = dir * chroma * (1.0 - mask);
          vec4 col;
          col.r = texture2D(tDiffuse, uv + off).r;
          col.g = texture2D(tDiffuse, uv).g;
          col.b = texture2D(tDiffuse, uv - off).b;
          col.a = 1.0;
    
          gl_FragColor = col;
        }
      `
    };
    const warpPass = new ShaderPass(WarpShader);
    composer.addPass(warpPass);

    // --------------------------------------------------------
    //  PORTALE DORATO ATTORNO AL PULSANTE (mesh/shader 3D)
    // --------------------------------------------------------
    const portalGroups = new Set(); // per pulire al termine

    function spawnPortalAt(target) {
        const g = new THREE.Group();
        camera.add(g);
        scene.add(camera);
        g.position.set(0, 0, -250);

        const ringGeo = new THREE.RingGeometry(0, 1, 96);
        const ringMat = new THREE.ShaderMaterial({
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            uniforms: {
                time: { value: 0 },
                alpha: { value: 0.0 },
                expand: { value: 0.0 },
                tint: { value: new THREE.Color(1.3, 1.0, 0.6) }
            },
            vertexShader: `
      varying vec2 vUv;
      uniform float expand;
      void main(){
        vec3 p = position;
        p.xy *= expand;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
            fragmentShader: `
      varying vec2 vUv;
      uniform float time, alpha;
      uniform vec3 tint;
      void main(){
        float r = length(vUv - 0.5);
        float pulse = 0.5 + 0.5*sin(time*4.0);
        float glow = smoothstep(0.4, 0.0, r);
        vec3 col = tint * (1.2 + pulse*0.3);
        gl_FragColor = vec4(col, alpha * glow);
      }`
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        g.add(ring);

        // tunnel interno
        const cylGeo = new THREE.CylinderGeometry(100, 100, 800, 64, 1, true);
        const cylMat = new THREE.ShaderMaterial({
            transparent: true,
            side: THREE.BackSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: {
                time: { value: 0 },
                alpha: { value: 0.0 },
                head: { value: 0.0 },
                glow: { value: 0.6 }
            },
            vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
            fragmentShader: `
      varying vec2 vUv;
      uniform float time, alpha, head, glow;
      void main(){
        float spiral = sin((vUv.y * 28.0 - time * 10.0) + vUv.x * 12.0);
        float wave = sin(vUv.y * 60.0 - time * 15.0) * 0.5 + 0.5;
        float reveal = clamp((head - vUv.y) * 8.0 + 0.5, 0.0, 1.0);
        float entry = smoothstep(0.0, 0.12, vUv.y);
        float tail = 1.0 - smoothstep(0.85, 1.0, vUv.y);
        float mask = reveal * entry * tail;
        vec3 col = vec3(1.0, 0.92, 0.7) * (0.6 + glow * wave + 0.25 * spiral);
        gl_FragColor = vec4(col, alpha * mask);
      }`
        });
        const cyl = new THREE.Mesh(cylGeo, cylMat);
        cyl.rotation.x = Math.PI / 2;
        cyl.position.z = -400;
        cyl.scale.set(1, 1, 0.25);
        g.add(cyl);

        const light = new THREE.PointLight(0xffe7b0, 2.0, 1000);
        g.add(light);

        ring.scale.set(0.35, 0.35, 0.35);
        const ringExpand = gsap.to(ringMat.uniforms.expand, { value: 100, duration: 2.4, ease: "power3.out" });
        const ringScale = gsap.to(ring.scale, { x: 1, y: 1, z: 1, duration: 2.6, ease: "expo.out" });
        const alphaTween = gsap.to([ringMat.uniforms.alpha, cylMat.uniforms.alpha], {
            value: 1.0,
            duration: 1.8,
            ease: "sine.out"
        });
        const headTween = gsap.to(cylMat.uniforms.head, { value: 1.05, duration: 3.2, ease: wormholeEase });
        const glowTween = gsap.to(cylMat.uniforms.glow, { value: 1.35, duration: 2.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
        const stretchTween = gsap.to(cyl.scale, { z: 1, duration: 2.8, ease: "expo.out" });
        const swirlTween = gsap.to(g.rotation, { y: "+=6.283", duration: 18, ease: "none", repeat: -1 });

        return {
            update(dt) {
                ringMat.uniforms.time.value += dt;
                cylMat.uniforms.time.value += dt;
                light.intensity = 2.1 + cylMat.uniforms.glow.value * 0.9 + Math.sin(performance.now() / 480) * 0.6;
            },
            fadeAndRemove(onDone) {
                glowTween.pause();
                swirlTween.pause();
                gsap.to(cylMat.uniforms.glow, { value: 0.4, duration: 0.6, ease: "sine.in" });
                gsap.to([ringMat.uniforms.alpha, cylMat.uniforms.alpha], {
                    value: 0.0, duration: 1.2, ease: "power2.inOut",
                    onComplete: () => {
                        ringExpand.kill();
                        ringScale.kill();
                        alphaTween.kill();
                        headTween.kill();
                        stretchTween.kill();
                        glowTween.kill();
                        swirlTween.kill();
                        camera.remove(g);
                        if (onDone) onDone();
                    }
                });
            }
        };
    }


    // --------------------------------------------------------
    //  CLICK HANDLER (robusto)
    // --------------------------------------------------------
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let warpActive = false;
    let activePortal = null;       // { update(), fadeAndRemove(), group }
    let portalTarget = null;       // root pulsante corrente
    let warpTimer = 0;             // per animare pass e portal

    window.addEventListener('click', (event) => {
        // evita i click sulla card
        const topEl = document.elementFromPoint(event.clientX, event.clientY);
        if (topEl && topEl.closest && topEl.closest('.warp-card')) return;

        if (clickableMeshes.length === 0) return;

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        const hits = raycaster.intersectObjects(clickableMeshes, true);
        if (hits.length > 0) {
            const hit = hits[0].object;
            const root = findRootButton(hit);
            if (root && !warpActive) {
                try { clickSound.currentTime = 0; clickSound.play(); } catch {}
                triggerWarp(root, root.userData.name);
            }
        }
    });

    // --------------------------------------------------------
    //  WARP + CARD (portale attorno al pulsante)
    // --------------------------------------------------------
    function triggerWarp(target, name) {
        warpActive = true;
        portalTarget = target;
        warpTimer = 0;

        try {
            warpSound.currentTime = 0;
            warpSound.play();
        } catch {
        }

        activePortal = spawnPortalAt(target);

        gsap.to(warpPass.uniforms.strength, { value: 0.35, duration: 1.2, ease: 'sine.inOut' });
        gsap.to(warpPass.uniforms.chroma, { value: 0.02, duration: 1.2, ease: 'sine.inOut' });
        gsap.to(bloom, { strength: 0.45, duration: 1.2, ease: 'power1.inOut' });

        const wp = new THREE.Vector3();
        target.getWorldPosition(wp);

        const camStart = camera.position.clone();
        const lookAhead = new THREE.Vector3();
        const camEnd = wp.clone().add(new THREE.Vector3(0, 140, 140));
        const ctrlA = camStart.clone().lerp(wp, 0.25).add(new THREE.Vector3(0, 200, -240));
        const ctrlB = camStart.clone().lerp(wp, 0.68).add(new THREE.Vector3(0, 160, 220));
        const curve = new THREE.CatmullRomCurve3([camStart, ctrlA, ctrlB, camEnd], false, 'catmullrom', 0.55);
        const travel = { t: 0 };
        const duration = 6.2;

        gsap.to(travel, {
            t: 1,
            duration,
            ease: wormholeEase,
            onUpdate: () => {
                const pos = curve.getPoint(travel.t);
                const tangent = curve.getTangent(travel.t).normalize();
                lookAhead.copy(pos).addScaledVector(tangent, 160);

                camera.position.copy(pos);
                camera.lookAt(lookAhead);

                const phase = travel.t;
                warpPass.uniforms.strength.value = THREE.MathUtils.lerp(0.35, 1.1, phase);
                warpPass.uniforms.chroma.value = THREE.MathUtils.lerp(0.02, 0.065, phase);
                bloom.strength = THREE.MathUtils.lerp(0.45, 0.95, phase);

                if (!document.querySelector('.warp-card') && phase >= 0.82) showCard(name);
            },
            onComplete: () => {
                gsap.to(warpPass.uniforms.strength, { value: 0.55, duration: 0.9, ease: 'sine.out' });
                gsap.to(warpPass.uniforms.chroma, { value: 0.04, duration: 0.9, ease: 'sine.out' });
                if (activePortal) activePortal.fadeAndRemove(() => activePortal = null);
            }
        });
    }

    function showCard(name) {
        try { portalSound.currentTime = 0; portalSound.play(); } catch {}

        const overlay = document.createElement('div');
        overlay.className = 'warp-card';
        overlay.innerHTML = `
        <div class="card-inner">
          <h1>${name}</h1>
          <p>${
            name === 'Portfolio'  ? 'Ecco alcuni esempi del nostro lavoro.'
                : name === 'Consulenza' ? 'Richiedi una consulenza personalizzata.'
                    : 'Scopri la nostra storia e la nostra missione.'
        }</p>
          <button class="close-card">Chiudi</button>
        </div>`;
        document.body.appendChild(overlay);

        const card = overlay.querySelector('.card-inner');
        gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 1.0, ease: 'power2.out' });
        gsap.fromTo(card, { y: 36, scale: 0.82, rotateY: 18 }, { y: 0, scale: 1, rotateY: 0, duration: 1.2, ease: 'power3.out' });

        overlay.querySelector('.close-card').addEventListener('click', () => {
            try { clickSound.currentTime = 0; clickSound.play(); } catch {}

            const boostStrength = gsap.to(warpPass.uniforms.strength, { value: 1.25, duration: 0.6, ease: 'power2.in' });
            const boostChroma = gsap.to(warpPass.uniforms.chroma, { value: 0.07, duration: 0.6, ease: 'power2.in' });
            const boostBloom = gsap.to(bloom, { strength: 0.9, duration: 0.6, ease: 'sine.in' });

            gsap.to(overlay, { opacity: 0, duration: 0.8, ease: 'power2.in', onComplete: () => overlay.remove() });

            const startPos = camera.position.clone();
            const targetPos = new THREE.Vector3(16.89, 282.66, -1406.02);
            const ctrl1 = startPos.clone().add(new THREE.Vector3(0, 210, 220));
            const ctrl2 = targetPos.clone().add(new THREE.Vector3(0, 180, -260));
            const retreatCurve = new THREE.CatmullRomCurve3([startPos, ctrl1, ctrl2, targetPos], false, 'catmullrom', 0.6);
            const retreat = { t: 0 };
            const lookAhead = new THREE.Vector3();

            gsap.delayedCall(0.25, () => {
                boostStrength.progress(1);
                boostChroma.progress(1);
                boostBloom.progress(1);
                gsap.to(retreat, {
                    t: 1,
                    duration: 6.0,
                    ease: wormholeEase,
                    onUpdate: () => {
                        const pos = retreatCurve.getPoint(retreat.t);
                        const tangent = retreatCurve.getTangent(retreat.t).normalize();
                        lookAhead.copy(pos).addScaledVector(tangent, 220);

                        camera.position.copy(pos);
                        camera.lookAt(lookAhead);

                        const fade = THREE.MathUtils.clamp(retreat.t, 0, 1);
                        warpPass.uniforms.strength.value = THREE.MathUtils.lerp(1.25, 0.0, fade);
                        warpPass.uniforms.chroma.value = THREE.MathUtils.lerp(0.07, 0.0, fade);
                        bloom.strength = THREE.MathUtils.lerp(0.9, 0.25, fade);
                    },
                    onComplete: () => {
                        warpPass.uniforms.strength.value = 0.0;
                        warpPass.uniforms.chroma.value = 0.0;
                        bloom.strength = 0.25;
                        warpActive = false;
                        portalTarget = null;
                        camera.lookAt(0, 180, 0);
                    }
                });
            });
        });
    }

    // --------------------------------------------------------
    //  LOOP
    // --------------------------------------------------------
    const clock = new THREE.Clock();
    const tmpV = new THREE.Vector3(); // reuse

    function updateWarpCenterUniform() {
        if (!portalTarget) return;
        // proietta la posizione del target in NDC e poi in UV [0..1]
        portalTarget.getWorldPosition(tmpV);
        tmpV.project(camera);
        const u = ( tmpV.x * 0.5 + 0.5 );
        const v = (-tmpV.y * 0.5 + 0.5 );
        warpPass.uniforms.center.value.set(u, v);
    }

    function animate() {
        const dt = clock.getDelta();
        const t  = clock.elapsedTime;

        // animazioni fiamme GLTF
        mixers.forEach(m => m.update(dt));

        // aggiorna portal meshes / light
        if (activePortal) activePortal.update(dt);

        // aggiorna warp shader time & center (segue il pulsante mentre zoommi)
        if (warpActive) {
            warpTimer += dt;
            warpPass.uniforms.time.value = warpTimer;
            updateWarpCenterUniform();
        }

        // anima flare sui pulsanti
        clickableRoots.forEach(b => {
            const f = b.userData.flare;
            if (f) f.material.uniforms.time.value = t;
        });

        composer.render();
        requestAnimationFrame(animate);
    }
    animate();

    // --------------------------------------------------------
    //  RESPONSIVE
    // --------------------------------------------------------
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
    });
