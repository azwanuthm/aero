import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// Import modul Exporter STL
import { STLExporter } from 'three/addons/exporters/STLExporter.js';

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

let customAirfoilPoints = null;

function parseDatFile(content) {
    const lines = content.split('\n');
    const points = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.match(/^[a-zA-Z]/)) continue; 
        const parts = line.split(/\s+/); 
        if (parts.length >= 2) {
            const x = parseFloat(parts[0]);
            const y = parseFloat(parts[1]);
            if (!isNaN(x) && !isNaN(y)) points.push(new THREE.Vector2(x, y));
        }
    }
    return points;
}

function generateCustomShape(chord, pointsArray) {
    const shape = new THREE.Shape();
    if (pointsArray.length === 0) return shape;
    shape.moveTo(pointsArray[0].x * chord, pointsArray[0].y * chord);
    for (let i = 1; i < pointsArray.length; i++) shape.lineTo(pointsArray[i].x * chord, pointsArray[i].y * chord);
    shape.lineTo(pointsArray[0].x * chord, pointsArray[0].y * chord);
    return shape;
}

function generateNACAShape(chord, nacaCode, numPoints = 80) {
    const shape = new THREE.Shape();
    const m = parseInt(nacaCode.charAt(0)) / 100;
    const p = parseInt(nacaCode.charAt(1)) / 10;
    const t = parseInt(nacaCode.substring(2, 4)) / 100;

    const upperPoints = [];
    const lowerPoints = [];

    for (let i = 0; i <= numPoints; i++) {
        const beta = (i / numPoints) * Math.PI;
        const x = (1 - Math.cos(beta)) / 2; 

        const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * Math.pow(x, 2) + 0.2843 * Math.pow(x, 3) - 0.1015 * Math.pow(x, 4));
        let yc = 0;
        let dyc_dx = 0;

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
        upperPoints.push(new THREE.Vector2((x - yt * Math.sin(theta)) * chord, (yc + yt * Math.cos(theta)) * chord));
        lowerPoints.push(new THREE.Vector2((x + yt * Math.sin(theta)) * chord, (yc - yt * Math.cos(theta)) * chord));
    }

    const points = [];
    for (let i = numPoints; i >= 0; i--) points.push(upperPoints[i]);
    for (let i = 1; i <= numPoints; i++) points.push(lowerPoints[i]);

    shape.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) shape.lineTo(points[i].x, points[i].y);
    return shape;
}

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
    
    let shapeToExtrude;
    if (customAirfoilPoints && customAirfoilPoints.length > 0) {
        shapeToExtrude = generateCustomShape(rootChord, customAirfoilPoints);
    } else {
        const nacaCode = document.getElementById('inpNACA').value;
        shapeToExtrude = generateNACAShape(rootChord, nacaCode);
    }

    const extrudeSettings = { depth: span, bevelEnabled: false, steps: 80 };
    const geometry = new THREE.ExtrudeGeometry(shapeToExtrude, extrudeSettings);
    
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
    bladeMesh.position.y = span / 2;
    
    scene.add(bladeMesh);
}

// --- FUNGSI EKSPORT STL BAHARU ---
document.getElementById('btnExportSTL').addEventListener('click', () => {
    if (!bladeMesh) return;
    
    // Inisialisasi pengeksport
    const exporter = new STLExporter();
    // Proses mesh 3D menjadi format teks STL (ASCII)
    const stlString = exporter.parse(scene);
    
    // Cipta objek fail (Blob) secara maya
    const blob = new Blob([stlString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    // Trik pelayar untuk muat turun automatik
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    link.download = 'Bilah_Turbin_Aero.stl'; // Nama fail lalai
    document.body.appendChild(link);
    link.click();
    
    // Bersihkan memori
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
});

// --- Pendengar Acara (Event Listeners) ---
const inputs = ['Span', 'Root', 'Taper', 'Twist', 'Sweep'];
inputs.forEach(id => {
    const slider = document.getElementById(`inp${id}`);
    const label = document.getElementById(`val${id}`);
    slider.addEventListener('input', (e) => {
        label.textContent = e.target.value;
        updateBladeGeometry();
    });
});

document.getElementById('inpNACA').addEventListener('change', () => {
    customAirfoilPoints = null; 
    document.getElementById('inpFile').value = ''; 
    updateBladeGeometry();
});

document.getElementById('inpFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        customAirfoilPoints = parseDatFile(event.target.result);
        updateBladeGeometry();
    };
    reader.readAsText(file);
});

document.getElementById('btnReset').addEventListener('click', () => {
    document.getElementById('inpSpan').value = 150; document.getElementById('valSpan').textContent = 150;
    document.getElementById('inpRoot').value = 40;  document.getElementById('valRoot').textContent = 40;
    document.getElementById('inpTaper').value = 0.5; document.getElementById('valTaper').textContent = 0.5;
    document.getElementById('inpTwist').value = 15; document.getElementById('valTwist').textContent = 15;
    document.getElementById('inpSweep').value = 0;  document.getElementById('valSweep').textContent = 0;
    document.getElementById('inpNACA').value = "4412"; 
    
    customAirfoilPoints = null; 
    document.getElementById('inpFile').value = ''; 
    updateBladeGeometry();
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

updateBladeGeometry();

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();
