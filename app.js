import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- 1. Persediaan Pemandangan (Scene Setup) ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f2f5); // Latar belakang kelabu lembut

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(200, 150, 300);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// --- 2. Pencahayaan (Lighting) ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(100, 200, 50);
scene.add(dirLight);

const gridHelper = new THREE.GridHelper(400, 40, 0x888888, 0xdddddd);
scene.add(gridHelper);

// --- 3. Logik Penjanaan Bilah (Geometri Prototaip) ---
let bladeMesh;
const material = new THREE.MeshStandardMaterial({ 
    color: 0x3b82f6, // Biru Tailwind
    roughness: 0.4,
    metalness: 0.1,
    side: THREE.DoubleSide
});

function updateBladeGeometry() {
    if (bladeMesh) scene.remove(bladeMesh);

    // Ambil nilai dari UI
    const span = parseFloat(document.getElementById('inpSpan').value);
    const rootChord = parseFloat(document.getElementById('inpRoot').value);
    const twist = parseFloat(document.getElementById('inpTwist').value) * (Math.PI / 180);
    const thickness = parseFloat(document.getElementById('inpThick').value) / 100;

    // Untuk prototaip ini, kita bina bilah menggunakan kotak yang diubah suai bentuknya 
    // (Dalam versi penuh, bahagian ini diganti dengan persamaan titik-titik NACA)
    const geometry = new THREE.BoxGeometry(rootChord, thickness * 50, span, 10, 2, 10);
    
    // Proses mengubah suai bucu geometri (Twist & Taper)
    const positionAttribute = geometry.attributes.position;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < positionAttribute.count; i++) {
        vertex.fromBufferAttribute(positionAttribute, i);
        
        // Kira faktor kedudukan sepanjang rentang (z-axis: -span/2 to span/2)
        const zFactor = (vertex.z + span / 2) / span; // 0 di pangkal, 1 di hujung
        
        // A. Taper (Pengecilan hujung)
        const taperAmount = 1.0 - (zFactor * 0.5); // Hujung menjadi 50% lebih kecil
        vertex.x *= taperAmount;
        vertex.y *= taperAmount;

        // B. Twist (Piuhan)
        const currentTwist = zFactor * twist;
        const x = vertex.x;
        const y = vertex.y;
        vertex.x = x * Math.cos(currentTwist) - y * Math.sin(currentTwist);
        vertex.y = x * Math.sin(currentTwist) + y * Math.cos(currentTwist);

        positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    geometry.computeVertexNormals(); // Penting untuk pencahayaan licin

    bladeMesh = new THREE.Mesh(geometry, material);
    
    // Putar bilah supaya menegak (pilihan paparan)
    bladeMesh.rotation.x = Math.PI / 2;
    bladeMesh.position.y = span / 2;
    
    scene.add(bladeMesh);
}

// --- 4. Pendengar Acara UI (Event Listeners) ---
const inputs = ['Span', 'Root', 'Twist', 'Thick'];
inputs.forEach(id => {
    const slider = document.getElementById(`inp${id}`);
    const label = document.getElementById(`val${id}`);
    
    slider.addEventListener('input', (e) => {
        label.textContent = e.target.value;
        updateBladeGeometry(); // Bina semula model setiap kali gelangsar bergerak
    });
});

document.getElementById('btnReset').addEventListener('click', () => {
    document.getElementById('inpSpan').value = 150; document.getElementById('valSpan').textContent = 150;
    document.getElementById('inpRoot').value = 40;  document.getElementById('valRoot').textContent = 40;
    document.getElementById('inpTwist').value = 15; document.getElementById('valTwist').textContent = 15;
    document.getElementById('inpThick').value = 12; document.getElementById('valThick').textContent = 12;
    updateBladeGeometry();
});

// Penyesuaian Saiz Skrin Responsif
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- 5. Gelung Animasi (Render Loop) ---
updateBladeGeometry(); // Jalankan sekali semasa mula

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();
