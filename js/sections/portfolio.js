export function showPortfolio(scene, camera, renderer) {
    const text = document.createElement('div');
    text.className = 'section-text';
    text.innerHTML = '<h1>Portfolio</h1><p>Ecco alcuni dei nostri migliori progetti e successi.</p>';
    document.body.appendChild(text);
}
