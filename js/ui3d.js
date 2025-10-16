// ui3d.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';

/**
 * Crea un container HTML per i pulsanti fluttuanti.
 */
export function initUIOverlay() {
    const container = document.createElement('div');
    container.id = 'ui-buttons';
    Object.assign(container.style, {
        position: 'absolute',
        inset: '0',
        pointerEvents: 'none',
        zIndex: '50'
    });
    document.body.appendChild(container);
    return container;
}

/**
 * Crea un pulsante fluttuante ancorato a un punto 3D.
 */
export function createFloatingButton(label, position3D, camera, renderer, container, onClick) {
    const btn = document.createElement('button');
    btn.className = 'floating-btn';
    btn.innerText = label;
    Object.assign(btn.style, {
        position: 'absolute',
        pointerEvents: 'auto'
    });
    container.appendChild(btn);

    const vector = new THREE.Vector3();
    const canvas = renderer.domElement;

    function update() {
        vector.copy(position3D);
        vector.project(camera);
        const x = (vector.x * 0.5 + 0.5) * canvas.clientWidth;
        const y = (-vector.y * 0.5 + 0.5) * canvas.clientHeight;
        btn.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
        btn.style.display = vector.z < 1 ? 'block' : 'none';
    }

    renderer.setAnimationLoop(update);
    btn.addEventListener('click', onClick);
    return btn;
}
