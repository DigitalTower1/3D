// ========================================================
//   AGENZIA DIGITALE 3D SCENE – INTERSTELLAR WARP EDITION
//   Portale dorato attorno al pulsante + Warp postprocess
//   (tutti gli effetti, click robusto, nessuna rimozione)
// ========================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm';
import { createEmbeddedAudio } from './audio-data.js';
import { createCosmicCarousel } from './cosmic-carousel.js';

const HDRI_LOCAL_URL = new URL('../assets/3d/env/solitude_night_4k.hdr', import.meta.url).href;
const HDRI_FALLBACK_URL = 'https://cdn.jsdelivr.net/gh/pmndrs/drei-assets@master/hdri/night_sky.hdr';

    // -------------------------
    // DEBUG SWITCH (true/false)
    // -------------------------
const DEBUG_LOG = false;
const log = (...a)=>{ if(DEBUG_LOG) console.log('[3D]',...a); };

const navInfo = typeof navigator === 'undefined'
    ? { maxTouchPoints: 0, msMaxTouchPoints: 0, userAgent: '' }
    : navigator;
const isTouchDevice = 'ontouchstart' in window || navInfo.maxTouchPoints > 0 || navInfo.msMaxTouchPoints > 0;
const isMobileUserAgent = /Mobi|Android|iPhone|iPad|iPod/i.test(navInfo.userAgent);
const isMobileViewport = window.innerWidth <= 900 || (window.matchMedia && window.matchMedia('(max-width: 900px)').matches);
const isMobileDevice = isMobileUserAgent || isTouchDevice || isMobileViewport;
const pixelRatioCap = isMobileDevice ? 1.25 : 1.75;

log('Mobile detection', { isTouchDevice, isMobileUserAgent, isMobileViewport, isMobileDevice });

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
    const renderer = new THREE.WebGLRenderer({
        antialias: !isMobileDevice,
        alpha: true,
        powerPreference: 'high-performance'
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 2.0;
    renderer.shadowMap.enabled = !isMobileDevice;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap));
    renderer.setSize(window.innerWidth, window.innerHeight);
    window.renderer = renderer;

    // Assicura che il canvas riceva i click
    const container = document.getElementById('canvas-container');
    container.style.position = 'fixed';
    container.style.inset = '0';
    container.style.zIndex = '1';
    container.style.pointerEvents = 'none';
    container.appendChild(renderer.domElement);

    let sceneInteractive = false;

    window.addEventListener('scene-ready', () => {
        sceneInteractive = true;
        container.style.pointerEvents = 'auto';
    });

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a0a, 0.00025);

    // --------------------------------------------------------
    //  CAMERA + CONTROLLI
    // --------------------------------------------------------
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 8000);
    const DEFAULT_FOV = camera.fov;
    const HOME_POSITION = new THREE.Vector3(16.89, 282.66, -1406.02);
    const HOME_LOOK_TARGET = new THREE.Vector3(0, 180, 0);
    camera.position.copy(HOME_POSITION);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.minPolarAngle = THREE.MathUtils.degToRad(55);
    controls.maxPolarAngle = THREE.MathUtils.degToRad(85);
    controls.target.copy(HOME_LOOK_TARGET);
    camera.lookAt(HOME_LOOK_TARGET);

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
    rgbeLoader.load(
        HDRI_LOCAL_URL,
        (tex) => {
            tex.mapping = THREE.EquirectangularReflectionMapping;
            const envMap = pmremGenerator.fromEquirectangular(tex).texture;
            scene.environment = envMap;
            scene.background = envMap;
            tex.dispose?.();
        },
        undefined,
        (error) => {
            console.warn('[MainScene] Unable to load HDRI from local path.', error);
            rgbeLoader.load(
                HDRI_FALLBACK_URL,
                (fallbackTex) => {
                    fallbackTex.mapping = THREE.EquirectangularReflectionMapping;
                    const envMap = pmremGenerator.fromEquirectangular(fallbackTex).texture;
                    scene.environment = envMap;
                    scene.background = envMap;
                    fallbackTex.dispose?.();
                },
                undefined,
                (fallbackError) => {
                    console.error('[MainScene] Fallback HDRI failed to load.', fallbackError);
                }
            );
        }
    );

    // --------------------------------------------------------
    //  AUDIO
    // --------------------------------------------------------
    const warpSound   = createEmbeddedAudio('./assets/audio/warp-ambient.mp3', { volume: 0.8, playbackRate: 0.8 });
    const portalSound = createEmbeddedAudio('./assets/audio/portal-whoosh.mp3', { volume: 0.9 });
    const clickSound  = createEmbeddedAudio('./assets/audio/click-select.mp3', { volume: 0.8 });

    function createPortalLoopingAudio(src) {
        return createEmbeddedAudio(src, { loop: true, volume: 0 });
    }

    const portalBackgroundMusic = {
        'Chi Siamo': {
            audio: createPortalLoopingAudio('./assets/audio/chi-siamo-background.mp3'),
            baseVolume: 0.38,
            title: '"Blank Audio" by anars (GitHub)'
        },
        Portfolio: {
            audio: createPortalLoopingAudio('./assets/audio/portfolio-background.mp3'),
            baseVolume: 0.34,
            title: '"Blank Audio" by anars (GitHub)'
        }
    };

    function stopPortalBackground(name, { immediate = false } = {}) {
        const track = portalBackgroundMusic[name];
        if (!track) return;
        const { audio } = track;
        gsap.killTweensOf(audio);
        const finish = () => {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = 0;
        };
        log('Portal music ⏹', name);
        if (immediate) {
            finish();
            return;
        }
        gsap.to(audio, {
            volume: 0,
            duration: 0.9,
            ease: 'sine.in',
            onComplete: finish
        });
    }

    function playPortalBackground(name) {
        const track = portalBackgroundMusic[name];
        Object.keys(portalBackgroundMusic).forEach((key) => {
            if (key !== name) {
                stopPortalBackground(key);
            }
        });
        if (!track) return;
        const { audio, baseVolume, title } = track;
        log('Portal music ▶', name, title || '');
        gsap.killTweensOf(audio);
        if (audio.paused) {
            audio.currentTime = 0;
            audio.volume = 0;
            const playPromise = audio.play();
            if (playPromise && typeof playPromise.then === 'function') {
                playPromise.catch(() => {});
            }
        }
        gsap.to(audio, {
            volume: baseVolume,
            duration: 1.6,
            ease: 'sine.out'
        });
    }

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

    const CONTACT_DECK = {
        layout: 'twin',
        cards: [
            {
                key: 'Consulenza-1',
                title: 'Consulenza Strategica',
                subtitle: 'Prenota un incontro',
                tagline: 'Parla con il nostro team',
                description: 'Raccontaci le tue esigenze per costruire un percorso su misura e attivare la nostra task force multidisciplinare.',
                form: {
                    submitLabel: 'Invia richiesta',
                    groups: [
                        { key: 'profile', title: 'Profilo', description: 'Chi sei e come possiamo ricontattarti', accent: '#9be7ff' },
                        { key: 'project', title: 'Progetto', description: 'Ambito dell’iniziativa e investimento', accent: '#ffd58a' },
                        { key: 'details', title: 'Dettagli', description: 'Raccontaci la tua visione', accent: '#f2a8ff', span: 'full' }
                    ],
                    fields: [
                        { type: 'text', name: 'full-name', label: 'Nome e cognome', placeholder: 'Es. Laura Bianchi', group: 'profile' },
                        { type: 'email', name: 'email', label: 'Email aziendale', placeholder: 'nome@azienda.com', group: 'profile' },
                        { type: 'select', name: 'interest', label: 'Area di interesse', options: ['Lancio prodotto', 'Evento immersivo', 'Digital twin', 'Formazione XR'], group: 'project' },
                        { type: 'select', name: 'budget', label: 'Budget indicativo', options: ['< 10K €', '10K € – 25K €', '25K € – 50K €', 'Oltre 50K €'], group: 'project' },
                        { type: 'text', name: 'business-sector', label: 'Settore attività', placeholder: 'Es. Retail, Automotive, Moda...', group: 'project' },
                        { type: 'textarea', name: 'message', label: 'Messaggio', placeholder: 'Descrivi obiettivi e tempistiche', group: 'details' }
                    ]
                },
                accent: '#9be7ff'
            },
            {
                key: 'Consulenza-2',
                title: 'Contatti Agenzia',
                subtitle: 'Parla con noi',
                tagline: 'Sempre connessi',
                description: 'Ti rispondiamo entro 24h con una proposta personalizzata e una prima call conoscitiva.',
                contact: {
                    items: [
                        { label: 'Email', value: 'hello@wormhole.studio', link: 'mailto:hello@wormhole.studio' },
                        { label: 'Telefono', value: '+39 02 1234 5678', link: 'tel:+390212345678' },
                        { label: 'HQ', value: 'Via delle Industrie 42, Milano' },
                        { label: 'Orari', value: 'Lun–Ven 09:00 › 19:00 CET' }
                    ],
                    cta: { label: 'Apri WhatsApp', link: 'https://wa.me/390212345678' }
                },
                highlights: ['Account manager dedicato', 'Reportistica trasparente', 'Supporto multilingua'],
                accent: '#ffd58a'
            }
        ]
    };

    const CARD_LIBRARY = {
        Portfolio: {
            layout: 'cosmic-carousel',
            title: 'Portfolio Orbitale',
            description: 'Esplora i progetti iconici sospesi nell’orbita dell’agenzia: esperienze immersive, installazioni interattive e campagne ibride.',
            cards: [
                {
                    key: 'portfolio-aurora',
                    title: 'Aurora Immersiva',
                    subtitle: 'Brand Experience Multisensoriale',
                    summary: 'Installazione XR con tracciamento volumetrico e reattività sonora per il lancio di un flagship store.',
                    detail: 'Un corridoio di luce olografica sincronizzato con sensori biometrici che adatta colori, audio e micro-narrazioni alla presenza del visitatore.',
                    highlights: ['Volumetric capture realtime', 'Audio spazializzato 7.1', 'Integrazione con CRM live'],
                    tags: ['XR', 'Retail', 'Realtime']
                },
                {
                    key: 'portfolio-zenith',
                    title: 'Zenith Atlas',
                    subtitle: 'Data Sculpture Interattiva',
                    summary: 'Visualizzazione olografica dei KPI aziendali con interazione gestuale e narrativa guidata.',
                    detail: 'Un atlante 3D che fonde arte e analytics: ogni pianeta rappresenta una business unit, esplorabile con gesture o controller aptici.',
                    highlights: ['AI narrative engine', 'Controller aptico', 'Raccolta insights live'],
                    tags: ['DataViz', 'Installation', 'AI']
                },
                {
                    key: 'portfolio-nova',
                    title: 'Nova Lab',
                    subtitle: 'Metaverse Collaboration',
                    summary: 'Spazio collaborativo persistente per workshop immersivi e onboarding globale.',
                    detail: 'Un ambiente multi-utente con avatar realistici, lavagne 3D e streaming volumetrico per sessioni creative distribuite.',
                    highlights: ['Avatar fotorealistici', 'Streaming volumetrico', 'Board 3D collaborativa'],
                    tags: ['Metaverse', 'Collaboration', 'WebRTC']
                },
                {
                    key: 'portfolio-voyager',
                    title: 'Voyager Pop-up',
                    subtitle: 'Esperienza Phygital Nomade',
                    summary: 'Evento itinerante con set olografico e NFT dinamici generati in loco.',
                    detail: 'Ogni tappa crea artefatti digitali unici legati alla location, con gamification e drops AR in tempo reale.',
                    highlights: ['NFT generativi', 'Tracking location aware', 'AR multi-device'],
                    tags: ['Event', 'NFT', 'AR']
                },
                {
                    key: 'portfolio-orion',
                    title: 'Orion Theatre',
                    subtitle: 'Storyliving Immersivo',
                    summary: 'Installazione narrativa con volumetria 8K e attori olografici sincronizzati con audience analytics.',
                    detail: 'Un teatro circolare dove storyline, luci e soundtrack cambiano in base al mood del pubblico rilevato da edge AI.',
                    highlights: ['Volumetria 8K', 'Edge sentiment AI', 'Soundtrack adattivo'],
                    tags: ['Storyliving', 'AI', 'Immersive']
                },
                {
                    key: 'portfolio-hyperlane',
                    title: 'Hyperlane Relay',
                    subtitle: 'Esperienza Drive-to-Store',
                    summary: 'Campagna DOOH interattiva che teletrasporta i prodotti in AR all’interno dell’auto del cliente.',
                    detail: 'Trigger geolocalizzati generano showroom AR personalizzati e coupon dinamici sincronizzati con il CRM.',
                    highlights: ['DOOH reattivo', 'CRM sync', 'AR personalizzata'],
                    tags: ['Retail', 'AR', 'Automation']
                },
                {
                    key: 'portfolio-elysium',
                    title: 'Elysium District',
                    subtitle: 'Metapolis Brandverse',
                    summary: 'Quartiere virtuale per lanci prodotto con eventi live, co-creazione NFT e streaming volumetrico.',
                    detail: 'Live concerti volumetrici, atelier digitali e loyalty gamificata collegata agli store fisici.',
                    highlights: ['Concerti volumetrici', 'Loyalty gamificata', 'NFT co-creation'],
                    tags: ['Metaverse', 'Community', 'Loyalty']
                },
                {
                    key: 'portfolio-halo',
                    title: 'Halo Resonance',
                    subtitle: 'Sonic Branding XR',
                    summary: 'Esperienza sonora multisensoriale con stanze vibro-acustiche e proiezioni 360° responsivi.',
                    detail: 'Ogni visitatore plasma la colonna sonora brand grazie a biometria, gesture tracking e AI generativa.',
                    highlights: ['Biometria live', 'AI generativa audio', 'Proiezioni 360°'],
                    tags: ['Sound', 'XR', 'Branding']
                },
                {
                    key: 'portfolio-pulsar',
                    title: 'Pulsar Labs',
                    subtitle: 'Innovation Sandbox',
                    summary: 'Programma pilota con prototipi XR, wearable haptics e digital twin in tempo reale.',
                    detail: 'Sprint mensili in cui stakeholder e utenti testano concept immersivi collegati al digital twin della sede.',
                    highlights: ['Wearable haptics', 'Digital twin', 'Sprint immersivi'],
                    tags: ['Innovation', 'XR', 'R&D']
                }
            ]
        },
        Consulenza: CONTACT_DECK,
        Contatti: CONTACT_DECK,
        'Chi Siamo': {
            layout: 'cosmic-carousel',
            title: 'Chi Siamo — Crew Stellare',
            description: 'Incontra l’equipaggio che guida l’agenzia tra strategie orbitanti e prototipi luminosi.',
            cards: [
                {
                    key: 'team-directors',
                    title: 'Creative Command',
                    subtitle: 'Direzione Creativa Orbitale',
                    summary: 'Un collettivo di art director e tecnologi che uniscono estetica cinematografica e prototipazione rapida.',
                    detail: 'Guidiamo ogni progetto con moodboard immersivi, storyboard volumetrici e sprint XR per trasformare intuizioni in esperienze tangibili.',
                    highlights: ['XR sprint studio', 'Moodboard volumetrici', 'Pipeline realtime'],
                    tags: ['Creative', 'XR', 'Direction']
                },
                {
                    key: 'team-strategy',
                    title: 'Strategy Orbital Lab',
                    subtitle: 'Strategia & Analisi Predittiva',
                    summary: 'Analisti, service designer e strategist che misurano ogni esperienza con metriche ibride.',
                    detail: 'Uniamo modelli predittivi, behavioural design e growth frameworks per trasformare insight in roadmap misurabili.',
                    highlights: ['Predictive analytics', 'Behavioural design', 'Growth framework'],
                    tags: ['Strategy', 'Data', 'Insights']
                },
                {
                    key: 'team-tech',
                    title: 'Hypertech Guild',
                    subtitle: 'Engineering & DevOps',
                    summary: 'Team full stack specializzato in grafica realtime, cloud 3D e integrazioni edge.',
                    detail: 'Costruiamo pipeline scalabili con cloud rendering, microservizi 3D e automazioni ML per esperienze always-on.',
                    highlights: ['Cloud rendering', 'Edge automation', 'Realtime pipelines'],
                    tags: ['Engineering', 'Cloud', 'Realtime']
                },
                {
                    key: 'team-care',
                    title: 'Client Stellar Care',
                    subtitle: 'Account & Produzione',
                    summary: 'Producers e account manager che mantengono l’orbita del progetto stabile e trasparente.',
                    detail: 'Utilizziamo dashboard interattive, rituali di co-creazione e supporto 24/7 per ogni missione.',
                    highlights: ['Dashboard immersive', 'Rituali co-creazione', 'Supporto 24/7'],
                    tags: ['Production', 'Account', 'Operations']
                },
                {
                    key: 'team-labs',
                    title: 'Speculative Labs',
                    subtitle: 'Futures & Prototyping',
                    summary: 'Ricercatori e futurist che testano materiali emergenti e scenari immersivi sperimentali.',
                    detail: 'Sviluppiamo concept provando sensori neuro, bioreattivi e mixed reality in cicli rapidi.',
                    highlights: ['Sensor prototyping', 'Futures research', 'Rapid iteration'],
                    tags: ['Research', 'Futures', 'Prototyping']
                },
                {
                    key: 'team-sparks',
                    title: 'Spark Studio',
                    subtitle: 'Content & Story Lab',
                    summary: 'Narrative designer, screenwriter e motion artist che costruiscono storyworld immersivi.',
                    detail: 'Dai teaser volumetrici ai documentari XR, attiviamo storytelling modulare e localizzato.',
                    highlights: ['Storyworld design', 'Volumetric motion', 'Localization XR'],
                    tags: ['Storytelling', 'Content', 'Motion']
                },
                {
                    key: 'team-scouts',
                    title: 'Talent Scouts',
                    subtitle: 'Culture & Partnership',
                    summary: 'Curatori, partnership manager e community builder che tessono alleanze globali.',
                    detail: 'Organizziamo residenze creative, programmi ambassador e partnership tech-culture.',
                    highlights: ['Creative residencies', 'Ambassador program', 'Partnership scouting'],
                    tags: ['Community', 'Partnership', 'Culture']
                },
                {
                    key: 'team-ops',
                    title: 'Orbit Ops',
                    subtitle: 'Program & Delivery',
                    summary: 'Project manager XR e PMO che garantiscono governance, compliance e rollout scalabili.',
                    detail: 'Adottiamo digital twin dei processi, orchestriamo vendor e misuriamo l’impatto in real time.',
                    highlights: ['XR PMO', 'Vendor orchestration', 'Impact analytics'],
                    tags: ['Operations', 'Governance', 'Analytics']
                },
                {
                    key: 'team-careers',
                    title: 'People & Growth',
                    subtitle: 'HR Orbitale',
                    summary: 'People strategist e coach che curano benessere, formazione e talent retention multi-country.',
                    detail: 'Programmi di mentorship immersiva, academy XR e percorsi di crescita personalizzati.',
                    highlights: ['Mentorship XR', 'Talent retention', 'Wellbeing program'],
                    tags: ['People', 'Growth', 'HR']
                }
            ]
        }
    };


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
    const createWarpUniforms = () => ({
        tDiffuse: { value: null },
        time: { value: 0 },
        strength: { value: 0.0 },
        chroma: { value: 0.0 },
        center: { value: new THREE.Vector2(0.5, 0.5) },
        radius: { value: 0.25 },
        streaks: { value: 0.0 },
        pulse: { value: 0.0 }
    });

    const warpShaderConfig = {
        uniforms: createWarpUniforms(),
        vertexShader: `
        varying vec2 vUv;
        void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
      `,
        fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time, strength, chroma, radius, streaks, pulse;
    uniform vec2 center;
    varying vec2 vUv;

    void main(){
      vec2 uv = vUv;
      // distanza dal centro del portale
      vec2 d = uv - center;
      float dist = length(d);

      // maschera radiale morbida
      float mask = smoothstep(radius, 0.0, dist);

      float angle = atan(d.y, d.x);
      float streakPattern = sin(angle * 14.0 - time * 6.0) * 0.5 + 0.5;
      float streakMask = smoothstep(0.6, 0.0, dist) * streaks * streakPattern;

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

      float breathing = 0.85 + pulse * 0.35;
      col.rgb *= breathing;
      col.rgb += vec3(1.2, 0.96, 0.7) * streakMask * (0.4 + pulse * 0.6);

      gl_FragColor = col;
    }
  `
    };

    let composer;
    let bloom;
    let warpPass;
    const useAdvancedPost = renderer.capabilities.isWebGL2 && !isMobileDevice;

    if (useAdvancedPost) {
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        const ssao = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
        ssao.kernelRadius = 16;
        composer.addPass(ssao);
        bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.25, 0.4, 0.9);
        composer.addPass(bloom);
        const bokeh = new BokehPass(scene, camera, { focus: 800, aperture: 1.5, maxblur: 0.002 });
        composer.addPass(bokeh);
        const film = new FilmPass(0.2, 0.08, 648, false);
        composer.addPass(film);
        warpPass = new ShaderPass(warpShaderConfig);
        composer.addPass(warpPass);
    } else {
        composer = {
            render: () => renderer.render(scene, camera),
            setSize: () => {}
        };
        bloom = { strength: 0.3 };
        warpPass = { uniforms: warpShaderConfig.uniforms };
        log('Using simplified renderer for mobile/low-power devices');
    }

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

        const streakCount = 360;
        const streakGeo = new THREE.BufferGeometry();
        const streakPos = new Float32Array(streakCount * 3);
        const streakPhase = new Float32Array(streakCount);
        for (let i = 0; i < streakCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = THREE.MathUtils.lerp(60, 220, Math.random());
            const y = THREE.MathUtils.lerp(-140, 140, Math.random());
            const z = -THREE.MathUtils.lerp(220, 1800, Math.random());
            streakPos[i * 3] = Math.cos(angle) * radius;
            streakPos[i * 3 + 1] = y;
            streakPos[i * 3 + 2] = z;
            streakPhase[i] = Math.random();
        }
        streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3));
        streakGeo.setAttribute('aPhase', new THREE.BufferAttribute(streakPhase, 1));
        const streakMat = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: {
                time: { value: 0 },
                stretch: { value: 1400 },
                opacity: { value: 0.0 }
            },
            vertexShader: `
      attribute float aPhase;
      uniform float time;
      uniform float stretch;
      varying float vAlpha;
      void main(){
        float travel = fract(time + aPhase);
        vec3 pos = position;
        pos.z -= travel * stretch;
        float head = smoothstep(0.0, 0.18, travel);
        float tail = 1.0 - smoothstep(0.55, 1.0, travel);
        vAlpha = head * tail;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = 16.0 * (tail + 0.35);
      }`,
            fragmentShader: `
      varying float vAlpha;
      uniform float opacity;
      void main(){
        vec2 c = gl_PointCoord - vec2(0.5);
        float falloff = smoothstep(0.5, 0.0, length(c));
        float alpha = opacity * vAlpha * falloff;
        if(alpha <= 0.001) discard;
        vec3 tint = vec3(1.1, 0.95, 0.75);
        gl_FragColor = vec4(tint, alpha);
      }`
        });
        const streaks = new THREE.Points(streakGeo, streakMat);
        streaks.rotation.x = Math.PI / 2;
        g.add(streaks);

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
        const streaksFade = gsap.to(streakMat.uniforms.opacity, { value: 1.0, duration: 1.6, ease: "sine.inOut" });
        const streakStretch = gsap.to(streakMat.uniforms.stretch, { value: 2100, duration: 3.2, ease: "sine.inOut" });

        return {
            update(dt) {
                ringMat.uniforms.time.value += dt;
                cylMat.uniforms.time.value += dt;
                streakMat.uniforms.time.value = (streakMat.uniforms.time.value + dt * 0.9) % 1.0;
                light.intensity = 2.1 + cylMat.uniforms.glow.value * 0.9 + Math.sin(performance.now() / 480) * 0.6;
            },
            fadeAndRemove(onDone) {
                glowTween.pause();
                swirlTween.pause();
                streakStretch.pause();
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
                        streaksFade.kill();
                        streakStretch.kill();
                        camera.remove(g);
                        if (onDone) onDone();
                    }
                });
                gsap.to(streakMat.uniforms.opacity, { value: 0.0, duration: 0.8, ease: "power2.in" });
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
    let warpReturnTimeline = null; // gestisce l'animazione di rientro

    window.addEventListener('click', (event) => {
        // evita i click sulla card
        const topEl = document.elementFromPoint(event.clientX, event.clientY);
        if (topEl && topEl.closest && topEl.closest('.warp-card, .cosmic-carousel-overlay')) return;

        if (!sceneInteractive) return;

        if (clickableMeshes.length === 0) return;

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        const hits = raycaster.intersectObjects(clickableMeshes, true);
        if (hits.length > 0) {
            const hit = hits[0].object;
            const root = findRootButton(hit);
            if (root && !warpActive) {
                try { clickSound.currentTime = 0; clickSound.play(); } catch (err) { /* noop */ }
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
        controls.enabled = false;

        try {
            warpSound.currentTime = 0;
            warpSound.play();
        } catch (err) { /* noop */ }

        activePortal = spawnPortalAt(target);

        gsap.to(bloom, { strength: 0.55, duration: 1.2, ease: 'power1.inOut' });

        const wp = new THREE.Vector3();
        target.getWorldPosition(wp);

        const camStart = camera.position.clone();
        const worldDir = wp.clone().sub(camStart);
        if (worldDir.lengthSq() < 1e-6) worldDir.set(0, 0, -1);
        worldDir.normalize();
        const camEnd = wp.clone().addScaledVector(worldDir, -220);
        const focus = wp.clone();
        const travel = { t: 0 };
        const duration = 5.2;
        const entryFov = Math.max(camera.fov, DEFAULT_FOV);
        camera.up.set(0, 1, 0);
        controls.target.copy(focus);

        const startQuat = camera.quaternion.clone();
        const targetMatrix = new THREE.Matrix4().lookAt(camEnd, focus, new THREE.Vector3(0, 1, 0));
        const endQuat = new THREE.Quaternion().setFromRotationMatrix(targetMatrix);
        const lateralAxis = new THREE.Vector3().crossVectors(worldDir, new THREE.Vector3(0, 1, 0));
        if (lateralAxis.lengthSq() < 1e-4) lateralAxis.set(1, 0, 0);
        lateralAxis.normalize();
        const verticalAxis = new THREE.Vector3().crossVectors(lateralAxis, worldDir).normalize();
        const lerpPos = new THREE.Vector3();
        const jitterVec = new THREE.Vector3();

        const exposureTarget = { value: renderer.toneMappingExposure };
        gsap.to(camera, {
            fov: entryFov + 12,
            duration: duration * 0.58,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: 1,
            onUpdate: () => camera.updateProjectionMatrix()
        });

        gsap.to(exposureTarget, {
            value: 3.2,
            duration: duration * 0.48,
            ease: 'power2.inOut',
            yoyo: true,
            repeat: 1,
            onUpdate: () => {
                renderer.toneMappingExposure = THREE.MathUtils.lerp(renderer.toneMappingExposure, exposureTarget.value, 0.4);
            }
        });

        gsap.to(travel, {
            t: 1,
            duration,
            ease: 'sine.inOut',
            onUpdate: () => {
                const phase = wormholeEase(travel.t);
                lerpPos.lerpVectors(camStart, camEnd, phase);
                const turbulence = Math.sin(phase * Math.PI) ** 1.2;
                const wobble = THREE.MathUtils.lerp(0, 18, turbulence);
                jitterVec.copy(lateralAxis).multiplyScalar(Math.sin(phase * Math.PI * 4.0) * wobble);
                jitterVec.addScaledVector(verticalAxis, Math.cos(phase * Math.PI * 3.0) * wobble * 0.6);
                lerpPos.add(jitterVec);
                camera.position.copy(lerpPos);
                camera.quaternion.slerpQuaternions(startQuat, endQuat, phase);
                camera.updateMatrixWorld();
                controls.target.copy(focus);

                const strengthTarget = THREE.MathUtils.lerp(0.35, 1.35, phase);
                warpPass.uniforms.strength.value += (strengthTarget - warpPass.uniforms.strength.value) * 0.2;
                const chromaTarget = THREE.MathUtils.lerp(0.02, 0.09, phase);
                warpPass.uniforms.chroma.value += (chromaTarget - warpPass.uniforms.chroma.value) * 0.2;
                const radiusTarget = THREE.MathUtils.lerp(0.3, 0.1, phase);
                warpPass.uniforms.radius.value += (radiusTarget - warpPass.uniforms.radius.value) * 0.22;
                const streakTarget = THREE.MathUtils.lerp(0.25, 1.2, phase);
                warpPass.uniforms.streaks.value += (streakTarget - warpPass.uniforms.streaks.value) * 0.18;
                warpPass.uniforms.pulse.value = 0.55 + Math.sin(phase * Math.PI * 2.0) * 0.35;
                bloom.strength = THREE.MathUtils.lerp(0.55, 1.15, phase);

                if (!document.querySelector('.warp-card, .cosmic-carousel-overlay') && phase >= 0.75) showCard(name);
            },
            onComplete: () => {
                camera.position.copy(camEnd);
                camera.quaternion.copy(endQuat);
                camera.updateMatrixWorld();
                controls.target.copy(focus);
                gsap.to(warpPass.uniforms.strength, { value: 0.6, duration: 1.0, ease: 'sine.out' });
                gsap.to(warpPass.uniforms.chroma, { value: 0.045, duration: 1.0, ease: 'sine.out' });
                gsap.to(warpPass.uniforms.radius, { value: 0.2, duration: 1.0, ease: 'sine.out' });
                gsap.to(warpPass.uniforms.streaks, { value: 0.55, duration: 1.2, ease: 'power1.out' });
                gsap.to(bloom, { strength: 0.65, duration: 1.0, ease: 'sine.out' });
                gsap.to(camera, {
                    fov: DEFAULT_FOV + 2,
                    duration: 1.2,
                    ease: 'sine.out',
                    onUpdate: () => camera.updateProjectionMatrix()
                });
                renderer.toneMappingExposure = 2.0;
                if (activePortal) activePortal.fadeAndRemove(() => activePortal = null);
            }
        });
    }

    function animateReturnHome() {
        if (warpReturnTimeline) return warpReturnTimeline;

        const startPos = camera.position.clone();
        const startQuat = camera.quaternion.clone();
        const startFocus = controls.target.clone();
        const returnQuat = new THREE.Quaternion().setFromRotationMatrix(
            new THREE.Matrix4().lookAt(HOME_POSITION, HOME_LOOK_TARGET, new THREE.Vector3(0, 1, 0))
        );
        const retreat = { t: 0 };
        const returnPos = new THREE.Vector3();
        const returnJitter = new THREE.Vector3();
        const toHome = HOME_POSITION.clone().sub(startPos);
        if (toHome.lengthSq() < 1e-6) toHome.set(0, 0, 1);
        const forward = toHome.clone().normalize();
        const lateral = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
        if (lateral.lengthSq() < 1e-6) lateral.set(1, 0, 0); else lateral.normalize();
        const vertical = new THREE.Vector3().crossVectors(lateral, forward).normalize();
        const exposureProxy = { value: renderer.toneMappingExposure };
        const duration = 4.8;

        gsap.killTweensOf(warpPass.uniforms.strength);
        gsap.killTweensOf(warpPass.uniforms.chroma);
        gsap.killTweensOf(warpPass.uniforms.streaks);
        gsap.killTweensOf(warpPass.uniforms.radius);
        gsap.killTweensOf(bloom);
        gsap.killTweensOf(camera);

        controls.enabled = false;

        warpReturnTimeline = gsap.timeline({
            defaults: { ease: 'sine.inOut' },
            onComplete: () => {
                warpPass.uniforms.strength.value = 0.0;
                warpPass.uniforms.chroma.value = 0.0;
                warpPass.uniforms.streaks.value = 0.0;
                warpPass.uniforms.radius.value = 0.25;
                bloom.strength = 0.3;
                renderer.toneMappingExposure = 2.0;
                warpActive = false;
                portalTarget = null;
                controls.enabled = true;
                controls.target.copy(HOME_LOOK_TARGET);
                camera.position.copy(HOME_POSITION);
                camera.quaternion.copy(returnQuat);
                camera.up.set(0, 1, 0);
                camera.fov = DEFAULT_FOV;
                camera.updateProjectionMatrix();
                camera.lookAt(HOME_LOOK_TARGET);
                camera.updateMatrixWorld();
                warpReturnTimeline = null;
            }
        });

        warpReturnTimeline.to(warpPass.uniforms.strength, { value: 1.2, duration: 0.45, ease: 'power2.in' }, 0);
        warpReturnTimeline.to(warpPass.uniforms.chroma, { value: 0.075, duration: 0.45, ease: 'power2.in' }, 0);
        warpReturnTimeline.to(warpPass.uniforms.streaks, { value: 1.0, duration: 0.45, ease: 'power2.in' }, 0);
        warpReturnTimeline.to(bloom, { strength: 0.95, duration: 0.45, ease: 'sine.in' }, 0);

        warpReturnTimeline.to(exposureProxy, {
            value: 2.35,
            duration: 1.8,
            ease: 'power2.inOut',
            yoyo: true,
            repeat: 1,
            onUpdate: () => {
                renderer.toneMappingExposure += (exposureProxy.value - renderer.toneMappingExposure) * 0.25;
            }
        }, 0.15);

        warpReturnTimeline.to(camera, {
            fov: DEFAULT_FOV + 8,
            duration: 1.4,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: 1,
            onUpdate: () => camera.updateProjectionMatrix()
        }, 0.15);

        warpReturnTimeline.to(retreat, {
            t: 1,
            duration,
            ease: 'none',
            onUpdate: () => {
                const phase = wormholeReturnEase(retreat.t);
                returnPos.lerpVectors(startPos, HOME_POSITION, phase);
                const shake = Math.sin(phase * Math.PI) ** 1.3;
                const wobble = THREE.MathUtils.lerp(0, 14, shake);
                returnJitter.copy(lateral).multiplyScalar(Math.sin(phase * Math.PI * 3.15) * wobble);
                returnJitter.addScaledVector(vertical, Math.cos(phase * Math.PI * 2.45) * wobble * 0.55);
                returnPos.add(returnJitter);
                camera.position.copy(returnPos);
                camera.quaternion.slerpQuaternions(startQuat, returnQuat, phase);
                camera.updateMatrixWorld();
                controls.target.lerpVectors(startFocus, HOME_LOOK_TARGET, phase);

                warpPass.uniforms.strength.value = THREE.MathUtils.lerp(1.2, 0.0, phase);
                warpPass.uniforms.chroma.value = THREE.MathUtils.lerp(0.075, 0.0, phase);
                warpPass.uniforms.radius.value = THREE.MathUtils.lerp(0.18, 0.28, phase);
                warpPass.uniforms.streaks.value = THREE.MathUtils.lerp(1.0, 0.05, phase);
                bloom.strength = THREE.MathUtils.lerp(0.95, 0.3, phase);
            }
        }, 0.15);

        warpReturnTimeline.to(warpPass.uniforms.strength, { value: 0.0, duration: 1.4, ease: 'sine.out' }, '-=1.15');
        warpReturnTimeline.to(warpPass.uniforms.chroma, { value: 0.0, duration: 1.4, ease: 'sine.out' }, '-=1.15');
        warpReturnTimeline.to(warpPass.uniforms.streaks, { value: 0.0, duration: 1.4, ease: 'sine.out' }, '-=1.15');
        warpReturnTimeline.to(warpPass.uniforms.radius, { value: 0.26, duration: 1.4, ease: 'sine.out' }, '-=1.15');
        warpReturnTimeline.to(bloom, { strength: 0.3, duration: 1.4, ease: 'sine.out' }, '-=1.15');

        return warpReturnTimeline;
    }

    function showCard(name) {
        try { portalSound.currentTime = 0; portalSound.play(); } catch (err) { /* noop */ }

        const deckConfig = CARD_LIBRARY[name];
        if (!deckConfig) return;

        if (deckConfig.layout === 'cosmic-carousel') {
            playPortalBackground(name);
            const carousel = createCosmicCarousel({
                name,
                title: deckConfig.title,
                description: deckConfig.description,
                cards: deckConfig.cards,
                onRequestClose: () => {
                    try { clickSound.currentTime = 0; clickSound.play(); } catch (err) { /* noop */ }
                    try {
                        warpSound.pause();
                        warpSound.currentTime = 0;
                        warpSound.play();
                    } catch (err) { /* noop */ }
                    stopPortalBackground(name);
                    requestAnimationFrame(() => animateReturnHome());
                }
            });
            return carousel;
        }

        const deck = deckConfig?.cards ? [...deckConfig.cards] : [];
        if (!deck.length) return;

        const state = {
            layoutMode: deckConfig.layout || 'carousel',
            autoRotateSeconds: deckConfig.autoRotate,
            totalCards: deck.length,
            activeIndex: 0,
            autoRotateTimer: null,
            swipeStartX: null,
            swipeLock: false,
            wheelLock: false,
            navAnimating: false,
            dragEnabled: deckConfig?.dragReveal === true,
            dragCard: null,
            dragStartX: 0,
            dragActive: false,
            overlayClosed: false,
            stageResizeObserver: null
        };
        const isCarousel = () => state.layoutMode === 'carousel';

        const overlay = document.createElement('div');
        overlay.className = 'warp-card';
        overlay.innerHTML = `
        <div class="card-stage" data-deck="${name}">
          <div class="card-backdrop"></div>
          <div class="card-carousel"></div>
        </div>`;
        document.body.appendChild(overlay);
        playPortalBackground(name);

        const stage = overlay.querySelector('.card-stage');
        const carouselEl = overlay.querySelector('.card-carousel');
        const exitBindings = [];
        const navBindings = [];
        const interactiveSelector = '.card-form, .card-contact, button, input, textarea, select, a';
        const isInteractiveTarget = (target) => Boolean(target && target.closest?.(interactiveSelector));
        stage.dataset.layout = state.layoutMode;
        stage.style.setProperty('--pointer-x', '0');
        stage.style.setProperty('--pointer-y', '0');

        const detachActionListeners = () => {
            exitBindings.splice(0).forEach(({ btn, handler }) => btn.removeEventListener('click', handler));
            navBindings.splice(0).forEach(({ btn, handler }) => btn.removeEventListener('click', handler));
        };

        const updateStageMetrics = () => {
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const marginX = Math.max(18, Math.min(150, vw * 0.065));
            const marginY = Math.max(70, Math.min(220, vh * 0.16));
            const stageWidth = Math.max(360, Math.min(1200, vw - marginX * 2));
            const stageHeight = isCarousel()
                ? Math.max(420, Math.min(vh - marginY, 760))
                : Math.max(360, Math.min(vh - marginY, 640));
            const panelHeight = isCarousel()
                ? Math.max(420, Math.min(stageHeight - 24, 660))
                : Math.max(340, stageHeight - 36);
            const baseWidth = Math.max(320, Math.min(stageWidth * 0.9, 840));
            const stagePadding = Math.max(20, Math.min(52, stageWidth * 0.042));
            const sideOffset = Math.max(170, Math.min(stageWidth * 0.36, 340));
            stage.style.setProperty('--stage-width', `${stageWidth}px`);
            stage.style.setProperty('--stage-height', `${stageHeight}px`);
            stage.style.setProperty('--panel-height', `${panelHeight}px`);
            stage.style.setProperty('--panel-base-width', `${baseWidth}px`);
            stage.style.setProperty('--stage-padding', `${stagePadding}px`);
            stage.style.setProperty('--side-offset', `${sideOffset}px`);
            stage.classList.toggle('is-compact', stageWidth < 720);
        };

        if ('ResizeObserver' in window) {
            state.stageResizeObserver = new ResizeObserver(updateStageMetrics);
            state.stageResizeObserver.observe(stage);
        }
        window.addEventListener('resize', updateStageMetrics);
        updateStageMetrics();

        const stopAutoRotate = () => {
            if (state.autoRotateTimer) {
                clearInterval(state.autoRotateTimer);
                state.autoRotateTimer = null;
            }
        };

        const startAutoRotate = () => {
            if (!isCarousel() || !state.autoRotateSeconds || state.totalCards <= 1) return;
            stopAutoRotate();
            state.autoRotateTimer = setInterval(() => {
                if (state.overlayClosed || state.navAnimating) return;
                state.activeIndex = (state.activeIndex + 1) % state.totalCards;
                render('right');
            }, state.autoRotateSeconds * 1000);
        };

        const layoutFor = (index) => {
            if (!isCarousel()) {
                return deck.map((card, idx) => ({
                    role: deck.length === 1 ? 'center' : (idx === 0 ? 'left' : 'right'),
                    card
                }));
            }
            const total = state.totalCards;
            if (total === 1) {
                return [{ role: 'center', card: deck[0] }];
            }
            const prev = (index + total - 1) % total;
            const next = (index + 1) % total;
            return [
                { role: 'left', card: deck[prev] },
                { role: 'center', card: deck[index] },
                { role: 'right', card: deck[next] }
            ];
        };

        const renderHighlights = (card) => {
            if (!Array.isArray(card.highlights) || !card.highlights.length) return '';
            return `<ul class="card-highlights">${card.highlights.map(item => `<li>${item}</li>`).join('')}</ul>`;
        };

        const renderForm = (card) => {
            if (!card.form) return '';
            const submitLabel = card.form.submitLabel ?? 'Invia';
            const fields = Array.isArray(card.form.fields) ? card.form.fields : [];
            const groups = Array.isArray(card.form.groups) ? card.form.groups : [];

            const fieldMarkup = (field, idx) => {
                const id = `${card.key}-field-${idx}`;
                const base = `<span class="card-form__label-text">${field.label ?? ''}</span>`;
                if (field.type === 'textarea') {
                    return `<label class="card-form__label" for="${id}">${base}<textarea id="${id}" name="${field.name}" placeholder="${field.placeholder ?? ''}" rows="4"></textarea></label>`;
                }
                if (field.type === 'select') {
                    const options = field.options?.map(option => `<option value="${option}">${option}</option>`).join('') ?? '';
                    return `<label class="card-form__label" for="${id}">${base}<select id="${id}" name="${field.name}">${options}</select></label>`;
                }
                return `<label class="card-form__label" for="${id}">${base}<input id="${id}" type="${field.type || 'text'}" name="${field.name}" placeholder="${field.placeholder ?? ''}" /></label>`;
            };

            const grouped = new Map();
            groups.forEach(group => {
                grouped.set(group.key, { meta: group, fields: [] });
            });

            const ungrouped = [];
            fields.forEach((field, idx) => {
                const key = field.group && grouped.has(field.group) ? field.group : null;
                if (key) {
                    grouped.get(key).fields.push({ field, idx });
                } else {
                    ungrouped.push({ field, idx });
                }
            });

            const groupedEntries = Array.from(grouped.values()).filter(entry => entry.fields.length > 0);
            const microcardCount = groupedEntries.length + (ungrouped.length ? 1 : 0);
            const hasMicrocards = microcardCount > 0;

            const microMarkup = hasMicrocards
                ? `<div class="card-form__microgrid" data-microcards="${microcardCount}">${groupedEntries.map(({ meta, fields: items }) => {
                    const style = meta.accent ? ` style="--micro-accent:${meta.accent}"` : '';
                    const span = meta.span ? ` data-span="${meta.span}"` : '';
                    const description = meta.description ? `<p class="card-form__microcard-desc">${meta.description}</p>` : '';
                    const content = items.map(({ field, idx }) => fieldMarkup(field, idx)).join('');
                    return `<section class="card-form__microcard"${span}${style}><header class="card-form__microcard-head"><span class="card-form__microcard-title">${meta.title ?? ''}</span>${description}</header><div class="card-form__microcard-body">${content}</div></section>`;
                }).join('')}${ungrouped.length ? `<section class="card-form__microcard" data-span="full"><div class="card-form__microcard-body">${ungrouped.map(({ field, idx }) => fieldMarkup(field, idx)).join('')}</div></section>` : ''}</div>`
                : fields.map((field, idx) => fieldMarkup(field, idx)).join('');

            return `<form class="card-form${hasMicrocards ? ' card-form--micro' : ''}" data-card="${card.key}" novalidate>${microMarkup}<div class="card-form__actions"><button type="submit">${submitLabel}</button><p class="card-form__feedback" role="status" aria-live="polite"></p></div></form>`;
        };

        const renderContact = (card) => {
            if (!card.contact) return '';
            const items = card.contact.items?.map(item => {
                if (item.link) {
                    return `<li><span>${item.label}</span><a href="${item.link}" target="_blank" rel="noopener">${item.value}</a></li>`;
                }
                return `<li><span>${item.label}</span><span>${item.value}</span></li>`;
            }).join('') ?? '';
            const cta = card.contact.cta ? `<a class="card-contact__cta" href="${card.contact.cta.link}" target="_blank" rel="noopener">${card.contact.cta.label}</a>` : '';
            return `<div class="card-contact"><ul class="card-contact__list">${items}</ul>${cta}</div>`;
        };

        const renderActions = (role) => {
            if (isCarousel()) {
                if (role !== 'center') return '';
                const showNav = state.totalCards > 1;
                const prevButton = showNav ? `<button type="button" class="card-actions__nav is-prev" data-action="nav" data-direction="left" aria-label="Mostra precedente"><span class="chevron"></span></button>` : '';
                const nextButton = showNav ? `<button type="button" class="card-actions__nav is-next" data-action="nav" data-direction="right" aria-label="Mostra successiva"><span class="chevron"></span></button>` : '';
                return `<div class="card-actions" data-actions="carousel" data-has-nav="${showNav ? 'true' : 'false'}">${prevButton}<button type="button" class="card-actions__exit" data-action="exit">Esci dal portale</button>${nextButton}</div>`;
            }
            const shouldAttach = state.totalCards === 1 ? role === 'center' : role === 'left';
            if (!shouldAttach) return '';
            return `<div class="card-actions" data-actions="static" data-has-nav="false"><button type="button" class="card-actions__exit" data-action="exit">Esci dal portale</button></div>`;
        };

        const cardMarkup = ({ role, card }) => `
          <article class="card-panel is-${role}" data-role="${role}" data-key="${card.key}" style="--card-accent:${card.accent}">
            <div class="card-holo">
              <header class="card-header">
                <span class="card-title">${card.title}</span>
                ${card.subtitle ? `<span class="card-subtitle">${card.subtitle}</span>` : ''}
                ${card.tagline ? `<span class="card-tagline">${card.tagline}</span>` : ''}
              </header>
              ${card.description ? `<p class="card-description">${card.description}</p>` : ''}
              ${renderForm(card)}
              ${renderContact(card)}
              ${renderHighlights(card)}
            </div>
            ${renderActions(role)}
            <div class="card-nebula"></div>
          </article>`;

        function initFormHandlers() {
            carouselEl.querySelectorAll('.card-form').forEach(form => {
                form.addEventListener('submit', (ev) => {
                    ev.preventDefault();
                    const feedback = form.querySelector('.card-form__feedback');
                    if (feedback) {
                        feedback.textContent = 'Richiesta inviata! Ti ricontatteremo entro 24 ore.';
                    }
                    form.classList.add('is-submitted');
                });
            });
        }

        function enableSmoothScroll(node) {
            if (!node || node.dataset.smoothScroll === 'true') return;
            node.dataset.smoothScroll = 'true';
            node.addEventListener('wheel', (event) => {
                if (Math.abs(event.deltaY) < 1) return;
                const maxScroll = node.scrollHeight - node.clientHeight;
                if (maxScroll <= 0) return;
                event.preventDefault();
                event.stopPropagation();
                const next = Math.max(0, Math.min(maxScroll, node.scrollTop + event.deltaY));
                gsap.to(node, { scrollTop: next, duration: 0.45, ease: 'power2.out' });
            }, { passive: false });
        }

        function enableMicroStrip(node) {
            if (!node || node.dataset.microStrip === 'true') return;
            node.dataset.microStrip = 'true';
            const onWheel = (event) => {
                if (isInteractiveTarget(event.target)) return;
                const maxScroll = node.scrollWidth - node.clientWidth;
                if (maxScroll <= 0) return;
                if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
                event.preventDefault();
                event.stopPropagation();
                const next = Math.max(0, Math.min(maxScroll, node.scrollLeft + event.deltaY));
                gsap.to(node, { scrollLeft: next, duration: 0.45, ease: 'power2.out' });
            };
            node.addEventListener('wheel', onWheel, { passive: false });
        }

        function animateMicrocards(root) {
            const microcards = root.querySelectorAll('.card-form__microcard');
            if (!microcards.length) return;
            gsap.fromTo(microcards, {
                opacity: 0,
                y: 26,
                scale: 0.94,
                rotateX: -4
            }, {
                opacity: 1,
                y: 0,
                scale: 1,
                rotateX: 0,
                duration: 0.65,
                ease: 'expo.out',
                stagger: 0.06
            });
        }

        function bindPanelEvents() {
            if (!isCarousel()) return;
            carouselEl.querySelectorAll('.card-panel').forEach(panel => {
                panel.addEventListener('click', (ev) => {
                    if (isInteractiveTarget(ev.target)) return;
                    const role = panel.dataset.role;
                    if (role === 'center') return;
                    handleNav(role === 'left' ? 'left' : 'right', { fromPanel: panel });
                });
            });
        }

        const handleExit = (event) => {
            if (event) event.preventDefault();
            if (state.overlayClosed) return;
            try { clickSound.currentTime = 0; clickSound.play(); } catch (err) { /* noop */ }
            try {
                warpSound.pause();
                warpSound.currentTime = 0;
                warpSound.play();
            } catch (err) { /* noop */ }
            closeOverlay();
            requestAnimationFrame(() => animateReturnHome());
        };

        const handleNav = (direction, options = {}) => {
            if (state.overlayClosed || state.navAnimating) return;
            if (!isCarousel() || state.totalCards <= 1) return;
            state.navAnimating = true;
            stopAutoRotate();
            const nextIndex = direction === 'left'
                ? (state.activeIndex + state.totalCards - 1) % state.totalCards
                : (state.activeIndex + 1) % state.totalCards;
            const finalize = () => {
                state.activeIndex = nextIndex;
                render(direction);
                startAutoRotate();
                requestAnimationFrame(() => { state.navAnimating = false; });
            };
            const { viaDrag, preserveCard } = options;
            if (viaDrag && preserveCard) {
                preserveCard.classList.remove('is-dragging');
                gsap.to(preserveCard, {
                    xPercent: direction === 'left' ? 120 : -120,
                    rotateY: direction === 'left' ? 18 : -18,
                    rotateX: -4,
                    opacity: 0,
                    duration: 0.45,
                    ease: 'power2.in',
                    onComplete: finalize
                });
                return;
            }
            finalize();
        };

        const bindActions = () => {
            detachActionListeners();
            carouselEl.querySelectorAll('[data-action="exit"]').forEach(btn => {
                const handler = (ev) => handleExit(ev);
                btn.addEventListener('click', handler);
                exitBindings.push({ btn, handler });
            });
            carouselEl.querySelectorAll('[data-action="nav"]').forEach(btn => {
                const direction = btn.dataset.direction === 'left' ? 'left' : 'right';
                const handler = (ev) => {
                    ev.preventDefault();
                    handleNav(direction);
                };
                btn.addEventListener('click', handler);
                navBindings.push({ btn, handler });
            });
        };

        function render(direction = 'intro') {
            if (!isCarousel()) {
                const layout = layoutFor(state.activeIndex);
                stage.style.setProperty('--active-accent', layout[0]?.card.accent ?? '#ffd58a');
                carouselEl.innerHTML = layout.map(cardMarkup).join('');
                initFormHandlers();
                bindActions();
                carouselEl.querySelectorAll('.card-holo').forEach(enableSmoothScroll);
                carouselEl.querySelectorAll('.card-form__microgrid').forEach(enableMicroStrip);
                animateMicrocards(carouselEl);
                const panels = carouselEl.querySelectorAll('.card-panel');
                gsap.fromTo(panels, { opacity: 0, y: 60, filter: 'blur(16px)', clipPath: 'inset(0 0 100% 0 round 32px)' }, {
                    opacity: 1,
                    y: 0,
                    filter: 'blur(0px)',
                    clipPath: 'inset(0 0 0% 0 round 32px)',
                    duration: 1.0,
                    ease: 'expo.out',
                    stagger: 0.08
                });
                const actions = carouselEl.querySelectorAll('.card-actions');
                if (actions.length) {
                    gsap.fromTo(actions, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.75, ease: 'power3.out', stagger: 0.05 });
                }
                requestAnimationFrame(updateStageMetrics);
                return;
            }

            const layout = layoutFor(state.activeIndex);
            const centerCard = layout.find(item => item.role === 'center')?.card;
            if (centerCard) {
                stage.style.setProperty('--active-accent', centerCard.accent);
            }
            carouselEl.innerHTML = layout.map(cardMarkup).join('');
            bindPanelEvents();
            initFormHandlers();
            bindActions();
            carouselEl.querySelectorAll('.card-holo').forEach(enableSmoothScroll);
            carouselEl.querySelectorAll('.card-form__microgrid').forEach(enableMicroStrip);
            animateMicrocards(carouselEl);
            const panels = carouselEl.querySelectorAll('.card-panel');
            const centerHolo = carouselEl.querySelector('.card-panel.is-center .card-holo');

            if (direction === 'intro') {
                gsap.fromTo(panels, {
                    opacity: 0,
                    y: 120,
                    rotateX: 12,
                    filter: 'blur(22px)',
                    clipPath: 'inset(0 0 100% 0 round 32px)'
                }, {
                    opacity: (i) => panels.length === 1 ? 1 : (i === 1 ? 1 : 0.16),
                    y: 0,
                    rotateX: 0,
                    filter: 'blur(0px)',
                    clipPath: 'inset(0 0 0% 0 round 32px)',
                    duration: 1.1,
                    ease: 'expo.out',
                    stagger: 0.07
                });
            } else {
                const directionSign = direction === 'left' ? -1 : 1;
                gsap.fromTo(carouselEl, { rotateY: directionSign * 18, xPercent: directionSign * 6 }, {
                    rotateY: 0,
                    xPercent: 0,
                    duration: 1.05,
                    ease: 'power3.out'
                });
                gsap.fromTo(panels, {
                    opacity: 0.18,
                    scale: 0.9,
                    filter: 'blur(18px)',
                    clipPath: 'inset(0 14% 18% 14% round 32px)'
                }, {
                    opacity: (i) => panels.length === 1 ? 1 : (i === 1 ? 1 : 0.18),
                    scale: (i) => i === 1 ? 1 : 0.9,
                    filter: 'blur(0px)',
                    clipPath: 'inset(0 0 0 0 round 32px)',
                    duration: 0.9,
                    ease: 'power2.out',
                    stagger: 0.05
                });
            }

            if (centerHolo) {
                gsap.fromTo(centerHolo, { scale: 0.88 }, { scale: 1, duration: 1.05, ease: 'expo.out' });
            }

            const actions = carouselEl.querySelectorAll('.card-actions');
            if (actions.length) {
                gsap.fromTo(actions, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.05 });
            }

            requestAnimationFrame(updateStageMetrics);
        }

        const handlePointer = (ev) => {
            if (isInteractiveTarget(ev.target)) return;
            const rect = stage.getBoundingClientRect();
            const x = (ev.clientX - rect.left) / rect.width - 0.5;
            const y = (ev.clientY - rect.top) / rect.height - 0.5;
            stage.style.setProperty('--pointer-x', String(x));
            stage.style.setProperty('--pointer-y', String(y));
            const centerHolo = carouselEl.querySelector('.card-panel.is-center .card-holo');
            if (centerHolo) {
                gsap.to(centerHolo, {
                    rotateY: x * 16,
                    rotateX: -y * 10,
                    duration: 0.5,
                    ease: 'power2.out'
                });
            }
        };

        const handleLeave = () => {
            stage.style.setProperty('--pointer-x', '0');
            stage.style.setProperty('--pointer-y', '0');
            const centerHolo = carouselEl.querySelector('.card-panel.is-center .card-holo');
            if (centerHolo) {
                gsap.to(centerHolo, { rotateX: 0, rotateY: 0, duration: 0.6, ease: 'power2.out' });
            }
        };

        const handleWheel = (ev) => {
            if (!isCarousel() || state.totalCards <= 1) return;
            if (isInteractiveTarget(ev.target)) return;
            const scrollable = ev.target.closest('.card-holo');
            if (scrollable && scrollable.scrollHeight > scrollable.clientHeight) return;
            ev.preventDefault();
            ev.stopPropagation();
            if (state.wheelLock || state.navAnimating) return;
            state.wheelLock = true;
            const direction = ev.deltaY > 0 ? 'right' : 'left';
            handleNav(direction);
            gsap.delayedCall(0.65, () => { state.wheelLock = false; });
        };

        if (isCarousel()) {
            stage.addEventListener('pointermove', handlePointer);
            stage.addEventListener('pointerleave', handleLeave);
            stage.addEventListener('wheel', handleWheel, { passive: false });
        }

        const onPointerDown = (ev) => {
            if (!isCarousel()) return;
            if (isInteractiveTarget(ev.target)) return;
            state.swipeStartX = ev.clientX;
            state.swipeLock = false;
            if (typeof ev.pointerId === 'number' && stage.setPointerCapture) {
                try { stage.setPointerCapture(ev.pointerId); } catch (err) { /* noop */ }
            }
            if (!state.dragEnabled) return;
            const panel = ev.target.closest('.card-panel');
            if (!panel || panel.dataset.role !== 'center') return;
            state.dragCard = panel;
            state.dragStartX = ev.clientX;
            state.dragActive = true;
            panel.classList.add('is-dragging');
            gsap.to(panel, { scale: 1.03, boxShadow: '0 32px 70px rgba(0,0,0,0.45)', duration: 0.25, ease: 'power2.out' });
        };

        const onPointerMove = (ev) => {
            if (!isCarousel() || state.swipeStartX === null || state.totalCards <= 1) return;
            if (isInteractiveTarget(ev.target)) return;
            const delta = ev.clientX - (state.dragActive ? state.dragStartX : state.swipeStartX);
            if (state.dragActive && state.dragCard) {
                const rect = stage.getBoundingClientRect();
                const stageWidth = rect.width || 1;
                const progress = Math.max(-1, Math.min(1, delta / (stageWidth * 0.4)));
                const translate = progress * Math.min(stageWidth * 0.12, 120);
                gsap.to(state.dragCard, {
                    x: translate,
                    rotateY: progress * 12,
                    rotateX: -Math.abs(progress) * 3,
                    duration: 0.2,
                    ease: 'power2.out',
                    overwrite: 'auto'
                });
                if (!state.swipeLock && Math.abs(delta) > 110) {
                    state.swipeLock = true;
                    state.dragActive = false;
                    const preserved = state.dragCard;
                    state.dragCard = null;
                    handleNav(delta > 0 ? 'left' : 'right', { viaDrag: true, preserveCard: preserved });
                }
                return;
            }
            if (state.swipeLock) return;
            if (Math.abs(delta) < 60) return;
            state.swipeLock = true;
            handleNav(delta > 0 ? 'left' : 'right');
        };

        const onPointerUp = (ev) => {
            state.swipeStartX = null;
            state.swipeLock = false;
            if (state.dragCard) {
                state.dragCard.classList.remove('is-dragging');
                gsap.to(state.dragCard, { x: 0, rotateX: 0, rotateY: 0, scale: 1, duration: 0.5, ease: 'expo.out' });
                state.dragCard = null;
            }
            state.dragActive = false;
            if (ev && typeof ev.pointerId === 'number' && stage.releasePointerCapture) {
                try {
                    if (stage.hasPointerCapture?.(ev.pointerId)) {
                        stage.releasePointerCapture(ev.pointerId);
                    }
                } catch (err) { /* noop */ }
            }
        };

        stage.addEventListener('pointerdown', onPointerDown);
        stage.addEventListener('pointermove', onPointerMove);
        stage.addEventListener('pointerup', onPointerUp);
        stage.addEventListener('pointercancel', onPointerUp);
        stage.addEventListener('touchend', onPointerUp);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);

        gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: 'power2.out' });
        render('intro');
        if (isCarousel()) {
            startAutoRotate();
        }

        const closeOverlay = () => {
            if (state.overlayClosed) return;
            state.overlayClosed = true;
            stopAutoRotate();
            detachActionListeners();
            window.removeEventListener('resize', updateStageMetrics);
            if (state.stageResizeObserver) {
                state.stageResizeObserver.disconnect();
                state.stageResizeObserver = null;
            }
            stage.removeEventListener('pointermove', handlePointer);
            stage.removeEventListener('pointerleave', handleLeave);
            stage.removeEventListener('wheel', handleWheel);
            stage.removeEventListener('pointerdown', onPointerDown);
            stage.removeEventListener('pointermove', onPointerMove);
            stage.removeEventListener('pointerup', onPointerUp);
            stage.removeEventListener('pointercancel', onPointerUp);
            stage.removeEventListener('touchend', onPointerUp);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
            stopPortalBackground(name);
            gsap.to(overlay, {
                opacity: 0,
                duration: 0.8,
                ease: 'power2.in',
                onComplete: () => overlay.remove()
            });
        };
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
            warpPass.uniforms.pulse.value = 0.5 + 0.5 * Math.sin(warpTimer * 2.4);
            updateWarpCenterUniform();
        } else {
            warpPass.uniforms.pulse.value += (0.0 - warpPass.uniforms.pulse.value) * 0.12;
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
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap));
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
    });
