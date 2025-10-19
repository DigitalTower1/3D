import { gsap } from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm";
import { createEmbeddedAudio } from './audio-data.js';

/* ---------- AUDIO ---------- */
const sounds = {
    wind: createEmbeddedAudio('./assets/audio/warp-ambient.mp3', { loop: true, volume: 0.4 }),
    echo: createEmbeddedAudio('./assets/audio/portal-whoosh.mp3', { volume: 0.5 }),
    pulse: createEmbeddedAudio('./assets/audio/click-select.mp3', { volume: 0.3 }),
    transition: createEmbeddedAudio('./assets/audio/portfolio-background.mp3', { volume: 0.8 })
};

// sblocca audio al primo gesto
const primeAudio = () => {
    Object.values(sounds).forEach(a => a.play().then(()=>a.pause()).catch(()=>{}));
    window.removeEventListener('pointerdown', primeAudio);
    window.removeEventListener('keydown', primeAudio);
};
window.addEventListener('pointerdown', primeAudio);
window.addEventListener('keydown', primeAudio);

/* ---------- STRUTTURA DOM ---------- */
const loader = document.createElement('div');
loader.id = 'cinematic-loader';
loader.innerHTML = `
  <div class="loader-bg"></div>
  <div id="grain"></div>
  <div id="lens-dirt"></div>
  <div id="lens-flare"></div>
  <div class="loader-orbits">
    <div class="orbit orbit-one"></div>
    <div class="orbit orbit-two"></div>
    <div class="orbit orbit-three"></div>
  </div>
  <div class="loader-core"></div>
  <div class="loader-content">
    <h1 class="line" id="line1">Ti trovi sulla sommità della <span>Digital Tower</span></h1>
    <h1 class="line hidden" id="line2">Sei qui perché sai, che in fondo, <span>meriti di raggiungere il successo</span></h1>
    <h1 class="line hidden" id="line3">Sei pronto a parlarne?</h1>
    <div id="buttons" class="hidden">
      <button id="btn-yes">Sì</button>
      <button id="btn-no">No</button>
    </div>
    <h1 class="line hidden" id="final-line"></h1>
  </div>
`;
document.body.appendChild(loader);

// Flash overlay
const flash = document.createElement('div');
flash.id = 'flash-overlay';
flash.style.opacity = '0';
flash.style.background = '#000'; // parte da nero
document.body.appendChild(flash);

/* ---------- ELEMENTI ---------- */
const l1 = loader.querySelector('#line1');
const l2 = loader.querySelector('#line2');
const l3 = loader.querySelector('#line3');
const finalLine = loader.querySelector('#final-line');
const buttons = loader.querySelector('#buttons');
const buttonEls = buttons.querySelectorAll('button');
const loaderContent = loader.querySelector('.loader-content');
const orbitsWrap = loader.querySelector('.loader-orbits');
const orbits = loader.querySelectorAll('.orbit');
const loaderCore = loader.querySelector('.loader-core');
const lensFlare = loader.querySelector('#lens-flare');
const grain = loader.querySelector('#grain');
const loaderBg = loader.querySelector('.loader-bg');

gsap.set(buttonEls, { transformPerspective: 900, transformOrigin: '50% 50%' });
gsap.set(orbitsWrap, { transformStyle: 'preserve-3d', perspective: 1400 });
gsap.set(orbits, { transformOrigin: '50% 50%', scale: 0.6, opacity: 0 });

const orbitIntro = gsap.timeline({ defaults: { ease: 'power2.out' } });
orbitIntro.fromTo(orbits, { scale: 0.35, opacity: 0 }, { scale: 1, opacity: 0.65, duration: 2.2, stagger: 0.18, delay: 0.3 });
gsap.to('.orbit-one', { rotation: 360, duration: 34, ease: 'none', repeat: -1 });
gsap.to('.orbit-two', { rotation: -360, duration: 26, ease: 'none', repeat: -1 });
gsap.to('.orbit-three', { rotation: 360, duration: 42, ease: 'none', repeat: -1 });
gsap.to(orbits, { opacity: 0.85, duration: 3.8, yoyo: true, repeat: -1, ease: 'sine.inOut' });
if (loaderCore) {
    gsap.set(loaderCore, { opacity: 0.45 });
    gsap.to(loaderCore, { opacity: 0.85, duration: 2.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
}
gsap.to(lensFlare, { opacity: 0.4, duration: 2.6, ease: 'sine.inOut', repeat: -1, yoyo: true });
gsap.to(grain, { opacity: 0.04, duration: 2.2, ease: 'sine.inOut', repeat: -1, yoyo: true });
gsap.to(loaderBg, { filter: 'brightness(1.05)', duration: 3.2, ease: 'sine.inOut', repeat: -1, yoyo: true });

const handleParallax = (event) => {
    const x = event.clientX / window.innerWidth - 0.5;
    const y = event.clientY / window.innerHeight - 0.5;
    gsap.to(loaderContent, { x: x * 34, y: y * 24, duration: 0.8, ease: 'power3.out' });
    gsap.to(orbitsWrap, { rotationY: x * 24, rotationX: -y * 24, duration: 1.2, ease: 'power3.out' });
};
window.addEventListener('pointermove', handleParallax);

/* ---------- TIMELINE TESTO ---------- */
const tl = gsap.timeline({ defaults: { duration: 1.5, ease: "power3.inOut" } });
gsap.set(".hidden", { autoAlpha: 0 });
const playSafe = a => a.play().catch(()=>{});

tl.add(() => playSafe(sounds.wind), 0)
    .to(l1, { autoAlpha: 1, y: 0, duration: 2, onStart:()=>playSafe(sounds.echo) })
    .to(l1, { autoAlpha: 0, y: -50, delay: 2 })
    .to(l2, { autoAlpha: 1, y: 0, duration: 2, onStart:()=>playSafe(sounds.pulse) })
    .to(l2, { autoAlpha: 0, y: -50, delay: 2 })
    .to(l3, { autoAlpha: 1, y: 0, duration: 2, onStart:()=>playSafe(sounds.echo) })
    .to(buttons, { autoAlpha: 1, y: 0, duration: 1 }, "+=0.8")
    .fromTo(buttonEls, { opacity: 0, y: 34, rotateX: -18 }, { opacity: 1, y: 0, rotateX: 0, duration: 1.2, ease: "power4.out", stagger: 0.12 }, "<0.2");

/* ---------- TRANSIZIONE SCENA ---------- */
function showScene(text) {
    buttons.style.pointerEvents = "none";
    gsap.to(buttons, { autoAlpha: 0, duration: 0.8 });
    gsap.to(l3, { autoAlpha: 0, duration: 0.8 });
    finalLine.innerHTML = text;
    gsap.to(finalLine, { autoAlpha: 1, y: 0, duration: 2, delay: 0.4 });

    window.removeEventListener('pointermove', handleParallax);

    setTimeout(() => {
        playSafe(sounds.transition);

        const flashEl = document.getElementById('flash-overlay');
        const flare = document.getElementById('lens-flare');

        // imposta colore canvas su nero assoluto
        if (window.renderer) window.renderer.setClearColor(0x000000, 1);

        const tlFlash = gsap.timeline();
        tlFlash
            .fromTo(flashEl, { background: '#ffffff', opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power4.out" })
            .fromTo(flare, { opacity: 0, scaleX: 0.6 }, { opacity: 0.8, scaleX: 1.3, duration: 0.5 }, "<")
            // fade-to-black cinematografico
            .to(flashEl, {
                background: '#000',
                opacity: 1,
                duration: 0.25,
                delay: 1.6,
                onStart: () => flashEl.style.mixBlendMode = 'normal'
            })
            .to(flashEl, {
                opacity: 0,
                duration: 1.8,
                onComplete: () => {
                    flashEl.remove();
                    flare.remove();
                    if (window.renderer) {
                        window.renderer.setClearColor(0x000000, 1);
                        window.renderer.toneMappingExposure = 1.5;
                    }
                }
            });

        if (window.renderer)
            gsap.fromTo(window.renderer, { toneMappingExposure: 3.0 }, { toneMappingExposure: 1.5, duration: 2 });
    }, 3200);

    // dissolvenza suono + testo + scena
    gsap.to(sounds.wind, { volume: 0, duration: 2, onComplete:()=>sounds.wind.pause() });
    gsap.to('#final-line', { autoAlpha: 0, duration: 1, delay: 4.2, onComplete:()=> {
            finalLine.innerHTML = '';
            finalLine.style.display = 'none';
        }});

    gsap.to('.loader-bg', {
        delay: 4.3,
        opacity: 0,
        duration: 2,
        onComplete: () => {
            // elimina progress bar o residui
            document.querySelectorAll('#progress-bar, .progress, .loading-bar, progress')
                .forEach(el => el.remove());
            loader.remove();

            const c = document.getElementById('canvas-container');
            if (c) {
                gsap.fromTo(c, { opacity: 0 }, {
                    opacity: 1,
                    duration: 2,
                    onStart: () => {
                        c.style.pointerEvents = 'auto';
                        window.dispatchEvent(new Event('scene-ready'));
                    }
                });
            } else {
                window.dispatchEvent(new Event('scene-ready'));
            }
        }
    });
}

loader.querySelector('#btn-yes').onclick = () =>
    showScene("Ok, allora preparati a scalare insieme a noi la torre del successo.");

loader.querySelector('#btn-no').onclick = () =>
    showScene("È troppo tardi ormai per tirarti indietro. Preparati a scalare insieme a noi la torre del successo.");
