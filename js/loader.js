import { gsap } from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm";

/* ---------- AUDIO ---------- */
const sounds = {
    wind: new Audio('./assets/audio/wind.mp3'),
    echo: new Audio('./assets/audio/echo.mp3'),
    pulse: new Audio('./assets/audio/pulse.mp3'),
    transition: new Audio('./assets/audio/transition.mp3')
};
Object.assign(sounds.wind, { volume: 0.4, loop: true });
Object.assign(sounds.echo, { volume: 0.5 });
Object.assign(sounds.pulse, { volume: 0.3 });
Object.assign(sounds.transition, { volume: 0.8 });

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
    .to(buttons, { autoAlpha: 1, y: 0, duration: 1 }, "+=0.8");

/* ---------- TRANSIZIONE SCENA ---------- */
function showScene(text) {
    buttons.style.pointerEvents = "none";
    gsap.to(buttons, { autoAlpha: 0, duration: 0.8 });
    gsap.to(l3, { autoAlpha: 0, duration: 0.8 });
    finalLine.innerHTML = text;
    gsap.to(finalLine, { autoAlpha: 1, y: 0, duration: 2, delay: 0.4 });

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
            if (c) gsap.fromTo(c, { opacity: 0 }, { opacity: 1, duration: 2 });
        }
    });
}

loader.querySelector('#btn-yes').onclick = () =>
    showScene("Ok, allora preparati a scalare insieme a noi la torre del successo.");

loader.querySelector('#btn-no').onclick = () =>
    showScene("È troppo tardi ormai per tirarti indietro. Preparati a scalare insieme a noi la torre del successo.");
