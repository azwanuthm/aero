import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(100, 200, 50);
scene.add(dirLight);

const gridHelper = new THREE.GridHelper(400, 40, 0x888888, 0xdddddd);
scene.add(gridHelper);

// --- 3. Logik Matematik NACA 4-Digit PENUH (Simetri & Tak Simetri) ---
function generateNACAShape(chord, nacaCode, numPoints = 80) {
    const shape = new THREE.Shape();
    
    // Urai 4 Digit (Contoh: "4412")
    const m = parseInt(nacaCode.charAt(0)) / 100;         // Kamber maksimum
    const p = parseInt(nacaCode.charAt(1)) / 10;          // Posisi kamber
    const t = parseInt(nacaCode.substring(2, 4)) / 100;   // Ketebalan maksimum

    const upperPoints = [];
    const lowerPoints = [];

    // Pengiraan profil menggunakan taburan Kosinus untuk resolusi bucu yang lebih licin
    for (let i = 0; i <= numPoints; i++) {
        const beta = (i / numPoints) * Math.PI;
        const x = (1 - Math.cos(beta)) / 2; // Nilai x dari 0 (muncung) ke 1 (ekor)

        // Persamaan Ketebalan
        const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * Math.pow(x, 2) + 0.2843 * Math.pow(x, 3) - 0.1015 * Math.pow(x, 4));

        let yc = 0;
        let dyc_dx = 0;

        // Persamaan Kamber (Jika bukan simetri)
        if (p > 0) {
            if (x < p) {
                yc = (m / Math.pow(p, 2)) * (2 * p * x - Math.pow(x, 2));
                dyc_dx = (2 * m / Math.pow(p, 2)) * (p - x);
            } else {
                yc = (m / Math.pow(1 - p, 2)) * ((1 - 2 * p) + 2 * p * x - Math.pow(x, 2));
                dyc_dx = (2 * m / Math.pow(1 - p, 2)) * (p - x);
            }
        }

        const theta = Math.atan(dyc_dx);

        // Titik permukaan atas dan bawah
        const xu = x - yt * Math.sin(theta);
        const yu = yc + yt * Math.cos(theta);
        const xl = x + yt * Math.sin(theta);
        const yl = yc - yt * Math.cos(theta);

        upperPoints.push(new THREE.Vector2(xu * chord, yu * chord));
        lowerPoints.push(new THREE.Vector2(xl * chord, yl * chord));
    }

    // Susun titik untuk membentuk 1 pusingan tertutup yang sempurna (Ekor -> Muncung -> Ekor)
    const points = [];
    for (let i = numPoints; i >= 0; i--) points.push(upperPoints[i]);
    for (let i = 1; i <= numPoints; i++) points.push(lowerPoints[i]);

    // Lukis 2D Vector
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
    const taperTarget = parseFloat(document.getElementById('inpTaper').value);
    const twist = parseFloat(document.getElementById('inpTwist').value) * (Math.PI / 180);
    const sweep = parseFloat(document.getElementById('inpSweep').value) * (Math.PI / 180);
    const nacaCode = document.getElementById('inpNACA').value; // Ambil nilai dropdown

    const nacaShape = generateNACAShape(rootChord, nacaCode);
    const extrudeSettings = { depth: span, bevelEnabled: false, steps: 80 };
    const geometry = new THREE.ExtrudeGeometry(nacaShape, extrudeSettings);
    
    const positionAttribute = geometry.attributes.position;
    const vertex = new THREE.Vector3();
    const pitchAxisX = rootChord * 0.25; 

    for (let i = 0; i < positionAttribute.count; i++) {
        vertex.fromBufferAttribute(positionAttribute, i);
        
        const zFactor = vertex.z / span; 
        let x = vertex.x - pitchAxisX;
        let y = vertex.y;

        const taperAmount = 1.0 - (zFactor * (1.0 - taperTarget)); 
        x *= taperAmount;
        y *= taperAmount;

        const currentTwist = zFactor * twist;
        const newX = x * Math.cos(currentTwist) - y * Math.sin(currentTwist);
        const newY = x * Math.sin(currentTwist) + y * Math.cos(currentTwist);

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
const inputs = ['Span', 'Root', 'Taper', 'Twist', 'Sweep'];
inputs.forEach(id => {
    const slider = document.getElementById(`inp${id}`);
    const label = document.getElementById(`val${id}`);
    slider.addEventListener('input', (e) => {
        label.textContent = e.target.value;
        updateBladeGeometry();
    });
});

// Listener untuk Dropdown NACA
document.getElementById('inpNACA').addEventListener('change', updateBladeGeometry);

document.getElementById('btnReset').addEventListener('click', () => {
    document.getElementById('inpSpan').value = 150; document.getElementById('valSpan').textContent = 150;
    document.getElementById('inpRoot').value = 40;  document.getElementById('valRoot').textContent = 40;
    document.getElementById('inpTaper').value = 0.5; document.getElementById('valTaper').textContent = 0.5;
    document.getElementById('inpTwist').value = 15; document.getElementById('valTwist').textContent = 15;
    document.getElementById('inpSweep').value = 0;  document.getElementById('valSweep').textContent = 0;
    document.getElementById('inpNACA').value = "4412"; // Reset kepada profil 4412
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
