import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import SimplexNoise from 'simplex-noise';

// --- DOM ELEMENTS ---
const loadingElement = document.getElementById('loading');
const progressElement = document.getElementById('progress');
const colorOptions = document.querySelectorAll('.color-option');

// --- BASIC SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 15;

const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('webglCanvas'),
    antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// --- CONTROLS ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// --- PARTICLE SETUP ---
const simplex = new SimplexNoise();
const PARTICLE_COUNT = 20000;
const particlesGeometry = new THREE.BufferGeometry();
const positions = new Float32Array(PARTICLE_COUNT * 3);
const colors = new Float32Array(PARTICLE_COUNT * 3);
const sizes = new Float32Array(PARTICLE_COUNT);
const randoms = new Float32Array(PARTICLE_COUNT * 3); // x: speed, y: noise offset, z: size multiplier

const colorSchemes = {
    fire: [new THREE.Color('#ff4500'), new THREE.Color('#ffcc00')],
    neon: [new THREE.Color('#ff00ff'), new THREE.Color('#00ffff')],
    nature: [new THREE.Color('#00ff00'), new THREE.Color('#66ffcc')],
    rainbow: [
        new THREE.Color('red'), new THREE.Color('orange'), new THREE.Color('yellow'),
        new THREE.Color('green'), new THREE.Color('blue'), new THREE.Color('indigo'),
        new THREE.Color('violet')
    ]
};
let activeColorScheme = 'fire';

function applyColorScheme(scheme) {
    const schemeColors = colorSchemes[scheme];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        let color;
        if (scheme === 'rainbow') {
            color = schemeColors[Math.floor((i / PARTICLE_COUNT) * schemeColors.length)];
        } else {
            color = new THREE.Color().lerpColors(schemeColors[0], schemeColors[1], Math.random());
        }
        colors[i3] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;
    }
    particlesGeometry.attributes.color.needsUpdate = true;
}


// --- INITIALIZE PARTICLES ---
function initParticles() {
    const scale = 8;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;

        // Position particles along an infinity shape (Lemniscate of Gerono)
        const t = Math.random() * Math.PI * 2;
        const x = scale * Math.sin(t);
        const y = scale * Math.sin(t) * Math.cos(t);

        positions[i3] = x;
        positions[i3 + 1] = y;
        positions[i3 + 2] = 0;

        // Store random values for animation
        randoms[i3] = 0.1 + Math.random() * 0.4; // speed
        randoms[i3 + 1] = Math.random() * 100;   // noise offset
        randoms[i3 + 2] = 0.5 + Math.random() * 0.5; // size multiplier

        sizes[i] = 1.0 + Math.random() * 2.0;
        
        // Update loading bar
        if (i % 100 === 0) {
            progressElement.style.width = `${(i / PARTICLE_COUNT) * 100}%`;
        }
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particlesGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    particlesGeometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 3));

    applyColorScheme(activeColorScheme);
    
    progressElement.style.width = '100%';
}

initParticles();

// --- SHADERS ---
const vertexShader = `
    attribute float aSize;
    attribute vec3 aRandom;
    attribute vec3 color;
    varying vec3 vColor;
    uniform float uTime;
    uniform float uScale;

    // Import simplex noise function
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise(vec3 v) { 
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0) * 2.0 + 1.0;
        vec4 s1 = floor(b1) * 2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
    }

    void main() {
        vColor = color;
        vec3 pos = position;
        float noise = snoise(vec3(pos.x * 0.1, pos.y * 0.1, uTime * aRandom.x));
        pos.z += noise * 2.0;
        vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
        vec4 viewPosition = viewMatrix * modelPosition;
        vec4 projectedPosition = projectionMatrix * viewPosition;
        gl_Position = projectedPosition;
        gl_PointSize = aSize * aRandom.z * uScale;
        gl_PointSize *= (1.0 / -viewPosition.z);
    }
`;

const fragmentShader = `
    varying vec3 vColor;
    void main() {
        float strength = distance(gl_PointCoord, vec2(0.5));
        if (strength > 0.5) discard;
        gl_FragColor = vec4(vColor, 1.0 - (strength * 2.0));
    }
`;

// --- MATERIAL & MESH ---
const particlesMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
        uTime: { value: 0.0 },
        uScale: { value: window.innerHeight / 2.0 }
    },
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    vertexColors: true
});

const particles = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particles);

// --- UI INTERACTION ---
colorOptions.forEach(option => {
    option.addEventListener('click', (e) => {
        activeColorScheme = e.target.dataset.scheme;
        applyColorScheme(activeColorScheme);
        document.querySelector('.color-option.active')?.classList.remove('active');
        e.target.classList.add('active');
    });
});
document.querySelector('.color-option[data-scheme="fire"]').classList.add('active');

// --- RESIZE HANDLER ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    particlesMaterial.uniforms.uScale.value = window.innerHeight / 2.0;
});

// --- ANIMATION LOOP ---
const clock = new THREE.Clock();

function animate() {
    const elapsedTime = clock.getElapsedTime();
    particlesMaterial.uniforms.uTime.value = elapsedTime;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

// --- START ---
requestAnimationFrame(() => {
    // A small delay to ensure the progress bar animation completes
    setTimeout(() => {
        loadingElement.classList.add('hidden');
        animate();
    }, 200); 
});