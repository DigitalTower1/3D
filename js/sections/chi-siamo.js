export function showChiSiamo(scene, camera, renderer) {
    const text = document.createElement('div');
    text.className = 'section-text';
    text.innerHTML = '<h1>Chi Siamo</h1><p>Benvenuto nella biografia dell’agenzia. Qui scoprirai la nostra storia e filosofia.</p>';
    document.body.appendChild(text);
}
