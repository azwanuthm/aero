import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- 1. Persediaan Pemandangan ---
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

// --- 2. Pencahayaan ---
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
    
    for (let i = 0; i <= numPoints; i++) {
        const x = i / numPoints; 
        const yt = 5 * thicknessRatio * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * Math.pow(x, 2) + 0.2843 * Math.pow(x, 3) - 0.1015 * Math.pow(x, 4));
        points.push(new THREE.Vector2(x * chord, yt * chord));
    }
    
    for (let i = numPoints; i >= 0; i--) {
        const x = i / numPoints;
        const yt = 5 * thicknessRatio * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * Math.pow(x, 2) + 0.2843 * Math.pow(x, 3) - 0.1015 * Math.pow(x, 4));
        points.push(new THREE.Vector2(x * chord, -yt * chord));
    }

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

    // Ambil nilai dari antaramuka (UI)
    const span = parseFloat(document.getElementById('inpSpan').value);
    const rootChord = parseFloat(document.getElementById('inpRoot').value);
    const taperTarget = parseFloat(document.getElementById('inpTaper').value);
    const twist = parseFloat(document.getElementById('inpTwist').value) * (Math.PI / 180);
    const sweep = parseFloat(document.getElementById('inpSweep').value) * (Math.PI / 180);
    const thickness = parseFloat(document.getElementById('inpThick').value) / 100;

    const nacaShape = generateNACAShape(rootChord, thickness);
    
    const extrudeSettings = { depth: span, bevelEnabled: false, steps: 60 };
    const geometry = new THREE.ExtrudeGeometry(nacaShape, extrudeSettings);
    
    const positionAttribute = geometry.attributes.position;
    const vertex = new THREE.Vector3();
    const pitchAxisX = rootChord * 0.25; // Putaran aerodinamik

    for (let i = 0; i < positionAttribute.count; i++) {
        vertex.fromBufferAttribute(positionAttribute, i);
        
        const zFactor = vertex.z / span; 
        
        let x = vertex.x - pitchAxisX;
        let y = vertex.y;

        // A. Pengecilan Hujung (Taper)
        const taperAmount = 1.0 - (zFactor * (1.0 - taperTarget)); 
        x *= taperAmount;
        y *= taperAmount;

        // B. Piuhan Aerodinamik (Twist)
        const currentTwist = zFactor * twist;
        const newX = x * Math.cos(currentTwist) - y * Math.sin(currentTwist);
        const newY = x * Math.sin(currentTwist) + y * Math.cos(currentTwist);

        // C. Sudut Sapuan (Sweep)
        const sweepOffset = Math.tan(sweep) * vertex.z;

        vertex.x = newX + (pitchAxisX * taperAmount) - sweepOffset; 
        vertex.y = newY;

        positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    geometry.computeVertexNormals();
    geometry.translate(-pitchAxisX, 0, -span/2); 
    
    bladeMesh = new THREE.Mesh(geometry, material);
    bladeMesh.rotation.x = -Math.PI / 2; 
    
    scene.add(bladeMesh);
}

// --- 5. Pendengar Acara (Event Listeners) ---
const inputs = ['Span', 'Root', 'Taper', 'Twist', 'Sweep', 'Thick'];
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
    document.getElementById('inpTaper').value = 0.5; document.getElementById('valTaper').textContent = 0.5;
    document.getElementById('inpTwist').value = 15; document.getElementById('valTwist').textContent = 15;
    document.getElementById('inpSweep').value = 0;  document.getElementById('valSweep').textContent = 0;
    document.getElementById('inpThick').value = 12; document.getElementById('valThick').textContent = 12;
    updateBladeGeometry();
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- 6. Gelung Animasi ---
updateBladeGeometry();

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();
