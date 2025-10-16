// particles.js
// Generatore di particelle cinematografiche dorate/azzurre per la transizione

export function createParticles(count = 45, isNight = false) {
    const container = document.getElementById('particles');
    if (!container) return;

    container.innerHTML = '';
    container.style.opacity = 1;

    const colorDay = '255,210,127';   // dorato
    const colorNight = '150,180,255'; // azzurro tenue

    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.classList.add('particle');
        const size = Math.random() * 4 + 2;
        const left = Math.random() * 100;
        const delay = Math.random() * 0.8;
        const duration = 3 + Math.random() * 1.5;
        const color = isNight ? colorNight : colorDay;
        p.style.background = `radial-gradient(circle, rgba(${color},1) 0%, rgba(${color},0.1) 70%)`;
        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        p.style.left = `${left}%`;
        p.style.bottom = `${Math.random() * 40}px`;
        p.style.animationDelay = `${delay}s`;
        p.style.animationDuration = `${duration}s`;
        container.appendChild(p);
    }

    // dissolvenza automatica dopo qualche secondo
    setTimeout(() => {
        gsap.to(container, {
            opacity: 0,
            duration: 2,
            onComplete: () => (container.innerHTML = '')
        });
    }, 4500);
}
