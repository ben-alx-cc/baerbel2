import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Scene setup
const dpr = Math.min(2, window.devicePixelRatio || 1);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9fd3ff, 50, 200);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(dpr);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// Camera (near top-down, slight perspective)
const fov = 20; // very low FOV to keep distortion small
const camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 30, 0.1); // almost top-down
camera.lookAt(0, 0, 0);

// Optional: disable user controls (keep code for debugging)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false;
controls.enablePan = false;
controls.enableZoom = false;

// Lighting
const hemi = new THREE.HemisphereLight(0xdfefff, 0x88aacc, 0.9);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(10, 20, 5);
scene.add(dir);

// Water plane with small waves (shader material)
const waterUniforms = {
  uTime: { value: 0 },
  uColorDeep: { value: new THREE.Color(0x2a6db3) },
  uColorShallow: { value: new THREE.Color(0x6fb7ff) },
  uLightDir: { value: new THREE.Vector3(0.4, 1.0, 0.2).normalize() },
  uRippleAmp: { value: 0.15 },
  uRippleFreq: { value: 6.0 },
  uFlow: { value: new THREE.Vector2(0.08, 0.02) }
};


const waterMat = new THREE.ShaderMaterial({
  uniforms: waterUniforms,
  vertexShader: `
    varying vec3 vWorldPos;
    uniform float uTime;
    uniform float uRippleAmp;
    uniform float uRippleFreq;
    uniform vec2 uFlow;
    
    float fbm(vec2 p){
      float a = 0.0;
      float w = 0.5;
      for(int i=0;i<4;i++){
        a += w * sin(p.x) * cos(p.y);
        p = mat2(1.6,1.2,-1.2,1.6) * p + 3.0;
        w *= 0.5;
      }
      return a;
    }
    
    void main(){
      vec3 pos = position;
      vec2 p = pos.xz * uRippleFreq + uFlow * uTime * 0.8;
      float h = fbm(p) * uRippleAmp;
      pos.y += h;
      vec4 world = modelMatrix * vec4(pos,1.0);
      vWorldPos = world.xyz;
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `,
  fragmentShader: `
    varying vec3 vWorldPos;
    uniform vec3 uColorDeep;
    uniform vec3 uColorShallow;
    uniform vec3 uLightDir;
    
    void main(){
      float depthMix = smoothstep(-1.0, 2.0, vWorldPos.y);
      vec3 base = mix(uColorDeep, uColorShallow, depthMix);
      vec3 dx = dFdx(vWorldPos);
      vec3 dy = dFdy(vWorldPos);
      vec3 n = normalize(cross(dx, dy));
      float nl = clamp(dot(n, normalize(uLightDir)), 0.0, 1.0);
      vec3 col = base * (0.7 + 0.5 * nl);
      float fres = pow(1.0 - abs(n.y), 2.0);
      col += vec3(0.10, 0.12, 0.14) * fres;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
  transparent: false,
  dithering: true
});
// Enable derivatives only on WebGL1 (WebGL2 has dFdx/dFdy core)
waterMat.extensions = {
  derivatives: !renderer.capabilities.isWebGL2,
  fragDepth: false,
  drawBuffers: false,
  shaderTextureLOD: false
};

const waterGeo = new THREE.PlaneGeometry(400, 400, 256, 256);
const water = new THREE.Mesh(waterGeo, waterMat);
water.rotation.x = -Math.PI / 2;
scene.add(water);

// Simple dove model (stylized): body + wings + tail
function createDove(){
  const dove = new THREE.Group();

  const white = new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.6, metalness: 0.0 });
  const gray = new THREE.MeshStandardMaterial({ color: 0xe1e6ee, roughness: 0.8, metalness: 0.0 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 16), white);
  body.scale.set(1.3, 1.0, 1.6);
  body.position.y = 1.4;
  dove.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 20, 14), white);
  head.position.set(0.0, 1.9, 0.4);
  dove.add(head);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 10), new THREE.MeshStandardMaterial({ color: 0xffc27d, roughness: 0.7 }));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0.0, 1.85, 0.78);
  dove.add(beak);

  const wingGeom = new THREE.CapsuleGeometry(0.15, 1.6, 6, 12);
  const leftWing = new THREE.Mesh(wingGeom, white);
  leftWing.rotation.z = Math.PI * 0.5;
  leftWing.position.set(0.9, 1.55, 0.0);
  leftWing.castShadow = false;
  dove.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeom, white);
  rightWing.rotation.z = -Math.PI * 0.5;
  rightWing.position.set(-0.9, 1.55, 0.0);
  dove.add(rightWing);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.8, 12), gray);
  tail.rotation.x = -Math.PI * 0.2;
  tail.position.set(0, 1.1, -0.9);
  dove.add(tail);

  const featherMat = new THREE.LineBasicMaterial({ color: 0xdfe6f2, transparent: true, opacity: 0.7 });
  function addFeatherLines(wing, side){
    const g = new THREE.BufferGeometry();
    const points = [];
    for(let i=0;i<6;i++){
      const t = i/5;
      const len = 0.5 + 0.6 * (1.0 - t);
      const x = side * (0.0 + 0.04*i);
      points.push(new THREE.Vector3(x, 0.08 - 0.03*i, 0.2 + len));
      points.push(new THREE.Vector3(x, 0.08 - 0.03*i, 0.0 + 0.1*i));
    }
    g.setFromPoints(points);
    const lines = new THREE.LineSegments(g, featherMat);
    wing.add(lines);
  }
  addFeatherLines(leftWing, +1);
  addFeatherLines(rightWing, -1);

  return { group: dove, leftWing, rightWing };
}

const dove = createDove();
scene.add(dove.group);
// Keep dove centered with slight forward offset for composition
dove.group.position.set(0, 0, 0);

// Motion parameters
let baseSpeed = 2.0; // glide speed (units per second)
let currentSpeed = baseSpeed;
let flapBoost = 0.0;
let isPressing = false;
let flapPhase = 0.0;

// Event handling (pointer + touch)
function onPress(){
  isPressing = true;
}
function onRelease(){
  isPressing = false;
}

window.addEventListener('pointerdown', onPress, { passive: true });
window.addEventListener('pointerup', onRelease, { passive: true });
window.addEventListener('pointercancel', onRelease, { passive: true });
window.addEventListener('touchstart', onPress, { passive: true });
window.addEventListener('touchend', onRelease, { passive: true });
window.addEventListener('touchcancel', onRelease, { passive: true });

// Resize
function onResize(){
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

// Animation loop
const clock = new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(0.033, clock.getDelta());

  // Update water time
  waterUniforms.uTime.value += dt;

  // Flap logic: press to flap → add boost; release → decay
  const boostTarget = isPressing ? 3.0 : 0.0; // extra speed
  flapBoost += (boostTarget - flapBoost) * (isPressing ? 0.18 : 0.04);
  currentSpeed = baseSpeed + flapBoost;

  // Advance the world backwards to simulate forward movement
  waterUniforms.uFlow.value.x = 0.08 + currentSpeed * 0.02;
  waterUniforms.uFlow.value.y = 0.02;

  // Wing animation: only when pressing; otherwise fixed glide pose
  const targetFlapSpeed = isPressing ? 10.0 : 0.0;
  flapPhase += targetFlapSpeed * dt;
  const wingAmp = isPressing ? 0.8 : 0.0;
  const wingAngle = isPressing ? (Math.sin(flapPhase) * wingAmp + 0.1) : -0.15;
  dove.leftWing.rotation.y = 0.2;
  dove.rightWing.rotation.y = -0.2;
  dove.leftWing.rotation.x = -wingAngle;
  dove.rightWing.rotation.x = -wingAngle;

  // Gentle bobbing during glide
  const bob = Math.sin(waterUniforms.uTime.value * 1.2) * 0.05;
  dove.group.position.y = 1.4 + bob;

  renderer.render(scene, camera);
}
animate();

// iOS audio-context unlock placeholder (no audio now, but keeps compatibility ready)
document.addEventListener('touchstart', () => {}, { passive: true });


