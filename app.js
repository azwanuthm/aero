import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- 1. Persediaan Pemandangan (Scene Setup) ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f2f5); 

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

// --- 3. Logik Matematik NACA 4-Digit (00XX) ---
function generateNACAShape(chord, thicknessRatio, numPoints = 60) {
    const shape = new THREE.Shape();
    const points = [];
    
    // Kira koordinat permukaan atas
    for (let i = 0; i <= numPoints; i++) {
        const x = i / numPoints; // Peratusan kord (0 hingga 1)
        // Persamaan ketebalan NACA
        const yt = 5 * thicknessRatio * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * Math.pow(x, 2) + 0.2843 * Math.pow(x, 3) - 0.1015 * Math.pow(x, 4));
        points.push(new THREE.Vector2(x * chord, yt * chord));
    }
    
    // Kira koordinat permukaan bawah (simetri, undur ke belakang)
    for (let i = numPoints; i >= 0; i--) {
        const x = i / numPoints;
        const yt = 5 * thicknessRatio * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * Math.pow(x, 2) + 0.2843 * Math.pow(x, 3) - 0.1015 * Math.pow(x, 4));
        points.push(new THREE.Vector2(x * chord, -yt * chord));
    }

    // Lukis profil 2D
    shape.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        shape.lineTo(points[i].x, points[i].y);
    }
    return shape;
}

// --- 4. Penjanaan Bilah 3D ---
let bladeMesh;
const material = new THREE.MeshStandardMaterial({ 
    color: 0x3b82f6, 
    roughness: 0.4,
    metalness: 0.1,
    side: THREE.DoubleSide
});

function updateBladeGeometry() {
    if (bladeMesh) scene.remove(bladeMesh);

    const span = parseFloat(document.getElementById('inpSpan').value);
    const rootChord = parseFloat(document.getElementById('inpRoot').value);
    const twist = parseFloat(document.getElementById('inpTwist').value) * (Math.PI / 180);
    const thickness = parseFloat(document.getElementById('inpThick').value) / 100;

    // 1. Dapatkan Profil NACA 2D
    const nacaShape = generateNACAShape(rootChord, thickness);
    
    // 2. Semperit (Extrude) profil menjadi pepejal 3D sepanjang paksi Z
    const extrudeSettings = { depth: span, bevelEnabled: false, steps: 30 };
    const geometry = new THREE.ExtrudeGeometry(nacaShape, extrudeSettings);
    
    // 3. Modifikasi Bucu (Taper & Twist)
    const positionAttribute = geometry.attributes.position;
    const vertex = new THREE.Vector3();
    const pitchAxisX = rootChord * 0.25; // Putaran pada 25% perentas (Aerodynamic Center)

    for (let i = 0; i < positionAttribute.count; i++) {
        vertex.fromBufferAttribute(positionAttribute, i);
        
        const zFactor = vertex.z / span; // 0 di pangkal, 1 di hujung
        
        // Anjakkan paksi X ke pusat putaran aerodinamik
        let x = vertex.x - pitchAxisX;
        let y = vertex.y;

        // A. Pengecilan Hujung (Taper Ratio 0.5)
        const taperAmount = 1.0 - (zFactor * 0.5); 
        x *= taperAmount;
        y *= taperAmount;

        // B. Piuhan Aerodinamik (Twist)
        const currentTwist = zFactor * twist;
        const newX = x * Math.cos(currentTwist) - y * Math.sin(currentTwist);
        const newY = x * Math.sin(currentTwist) + y * Math.cos(currentTwist);

        // Kembalikan ke kedudukan asal
        vertex.x = newX + (pitchAxisX * taperAmount); 
        vertex.y = newY;

        positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    geometry.computeVertexNormals();
    geometry.translate(-pitchAxisX, 0, -span/2); // Pusatkan kedudukan di grid tengah
    
    bladeMesh = new THREE.Mesh(geometry, material);
    bladeMesh.rotation.x = -Math.PI / 2; // Tegakkan bilah
    
    scene.add(bladeMesh);
}

// --- 5. Pendengar Acara UI (Event Listeners) ---
const inputs = ['Span', 'Root', 'Twist', 'Thick'];
inputs.forEach(id => {
    const slider = document.getElementById(`inp${id}`);
    const label = document.getElementById(`val${id}`);
    slider.addEventListener('input', (e) => {
        label.textContent = e.target.value;
        updateBladeGeometry();
    });
});

document.getElementById('btnReset').addEventListener('click', () => {
    document.getElementById('inpSpan').value = 150; document.getElementById('valSpan').textContent = 150;
    document.getElementById('inpRoot').value = 40;  document.getElementById('valRoot').textContent = 40;
    document.getElementById('inpTwist').value = 15; document.getElementById('valTwist').textContent = 15;
    document.getElementById('inpThick').value = 12; document.getElementById('valThick').textContent = 12;
    updateBladeGeometry();
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- 6. Gelung Animasi (Render Loop) ---
updateBladeGeometry();

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();
