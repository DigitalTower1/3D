export function showConsulenza(scene, camera, renderer) {
    const text = document.createElement('div');
    text.className = 'section-text';
    text.innerHTML = '<h1>Consulenza Strategica</h1><p>Compila il modulo contatti per iniziare una collaborazione.</p>';
    document.body.appendChild(text);
}
