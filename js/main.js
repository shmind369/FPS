import * as THREE from "three";

// ---------- Basic scene setup ----------
const canvas = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 20, 90);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);

const player = {
  yaw: 0,
  pitch: 0,
  height: 1.6,
  position: new THREE.Vector3(0, 1.6, 8),
  speed: 5,
};

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Lighting ----------
const hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(20, 30, 10);
scene.add(sun);

// ---------- Arena ----------
const ARENA_SIZE = 40;

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE),
  new THREE.MeshStandardMaterial({ color: 0x556b2f })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const obstacles = [];
const obstacleMat = new THREE.MeshStandardMaterial({ color: 0x8a7a66 });
function addObstacle(x, z, w, d, h) {
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), obstacleMat);
  box.position.set(x, h / 2, z);
  scene.add(box);
  obstacles.push({
    min: new THREE.Vector3(x - w / 2, 0, z - d / 2),
    max: new THREE.Vector3(x + w / 2, h, z + d / 2),
  });
}
addObstacle(6, 2, 3, 3, 2.2);
addObstacle(-7, -4, 4, 2, 2.2);
addObstacle(0, -10, 6, 2, 2.2);
addObstacle(-4, 8, 2, 5, 2.2);
addObstacle(9, -8, 2, 6, 2.2);

// boundary walls (invisible-ish, just to block movement)
const halfArena = ARENA_SIZE / 2 - 1;

// ---------- Targets (enemies) ----------
const targetGeo = new THREE.BoxGeometry(0.7, 1.3, 0.3);
const targetMatAlive = new THREE.MeshStandardMaterial({ color: 0xdd2222 });
const targetMatHit = new THREE.MeshStandardMaterial({ color: 0x333333 });

const TARGET_COUNT = 8;
const targets = [];

function randomTargetPosition() {
  const x = (Math.random() - 0.5) * (ARENA_SIZE - 6);
  const z = (Math.random() - 0.5) * (ARENA_SIZE - 6);
  return new THREE.Vector3(x, 1 + Math.random() * 1.2, z);
}

for (let i = 0; i < TARGET_COUNT; i++) {
  const mesh = new THREE.Mesh(targetGeo, targetMatAlive.clone());
  mesh.position.copy(randomTargetPosition());
  scene.add(mesh);
  targets.push({ mesh, alive: true, respawnAt: 0 });
}

function hitTarget(target) {
  target.alive = false;
  target.mesh.material.color.set(0x333333);
  target.mesh.scale.setScalar(0.001);
  target.respawnAt = performance.now() + 1500;
  score += 1;
  updateScoreHUD();
}

function updateTargets(now) {
  for (const t of targets) {
    if (!t.alive && now >= t.respawnAt) {
      t.mesh.position.copy(randomTargetPosition());
      t.mesh.scale.setScalar(1);
      t.mesh.material.color.set(0xdd2222);
      t.alive = true;
    } else if (t.alive) {
      t.mesh.rotation.y += 0.01;
    }
  }
}

// ---------- HUD ----------
const scoreEl = document.getElementById("score");
const hintEl = document.getElementById("hint");
let score = 0;
function updateScoreHUD() {
  scoreEl.textContent = `SCORE: ${score}`;
}
updateScoreHUD();

// ---------- Movement input state ----------
const moveInput = { x: 0, y: 0 }; // x: strafe, y: forward(+)/back(-)
const keys = {};

// ---------- Virtual joystick (touch) ----------
const joystickZone = document.getElementById("joystickZone");
const joystickBase = document.getElementById("joystickBase");
const joystickKnob = document.getElementById("joystickKnob");
const JOYSTICK_RADIUS = 44;
let joystickPointerId = null;
let joystickOrigin = { x: 0, y: 0 };

function joystickStart(e) {
  if (joystickPointerId !== null) return;
  joystickPointerId = e.pointerId;
  const rect = joystickBase.getBoundingClientRect();
  joystickOrigin.x = rect.left + rect.width / 2;
  joystickOrigin.y = rect.top + rect.height / 2;
  joystickMove(e);
}
function joystickMove(e) {
  if (e.pointerId !== joystickPointerId) return;
  let dx = e.clientX - joystickOrigin.x;
  let dy = e.clientY - joystickOrigin.y;
  const dist = Math.min(Math.hypot(dx, dy), JOYSTICK_RADIUS);
  const angle = Math.atan2(dy, dx);
  dx = Math.cos(angle) * dist;
  dy = Math.sin(angle) * dist;
  joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  moveInput.x = dx / JOYSTICK_RADIUS;
  moveInput.y = -dy / JOYSTICK_RADIUS;
}
function joystickEnd(e) {
  if (e.pointerId !== joystickPointerId) return;
  joystickPointerId = null;
  joystickKnob.style.transform = `translate(-50%, -50%)`;
  moveInput.x = 0;
  moveInput.y = 0;
}
joystickZone.addEventListener("pointerdown", joystickStart);
joystickZone.addEventListener("pointermove", joystickMove);
joystickZone.addEventListener("pointerup", joystickEnd);
joystickZone.addEventListener("pointercancel", joystickEnd);

// ---------- Look control (touch drag on right half) ----------
const lookZone = document.getElementById("lookZone");
let lookPointerId = null;
let lastLook = { x: 0, y: 0 };
const LOOK_SENSITIVITY = 0.0035;

function lookStart(e) {
  if (lookPointerId !== null) return;
  lookPointerId = e.pointerId;
  lastLook.x = e.clientX;
  lastLook.y = e.clientY;
  hideHint();
}
function lookMove(e) {
  if (e.pointerId !== lookPointerId) return;
  const dx = e.clientX - lastLook.x;
  const dy = e.clientY - lastLook.y;
  lastLook.x = e.clientX;
  lastLook.y = e.clientY;
  player.yaw -= dx * LOOK_SENSITIVITY;
  player.pitch -= dy * LOOK_SENSITIVITY;
  const limit = Math.PI / 2 - 0.05;
  player.pitch = Math.max(-limit, Math.min(limit, player.pitch));
}
function lookEnd(e) {
  if (e.pointerId !== lookPointerId) return;
  lookPointerId = null;
}
lookZone.addEventListener("pointerdown", lookStart);
lookZone.addEventListener("pointermove", lookMove);
lookZone.addEventListener("pointerup", lookEnd);
lookZone.addEventListener("pointercancel", lookEnd);

// ---------- Desktop fallback: WASD + mouse (pointer lock) ----------
window.addEventListener("keydown", (e) => (keys[e.code] = true));
window.addEventListener("keyup", (e) => (keys[e.code] = false));

canvas.addEventListener("click", () => {
  if (!isTouchDevice()) canvas.requestPointerLock();
});
document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement === canvas) {
    player.yaw -= e.movementX * LOOK_SENSITIVITY;
    player.pitch -= e.movementY * LOOK_SENSITIVITY;
    const limit = Math.PI / 2 - 0.05;
    player.pitch = Math.max(-limit, Math.min(limit, player.pitch));
    hideHint();
  }
});

function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

function hideHint() {
  hintEl.classList.add("hidden");
}

// ---------- Shooting ----------
const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);

function shoot() {
  raycaster.setFromCamera(center, camera);
  const aliveMeshes = targets.filter((t) => t.alive).map((t) => t.mesh);
  const hits = raycaster.intersectObjects(aliveMeshes);
  if (hits.length > 0) {
    const hitMesh = hits[0].object;
    const target = targets.find((t) => t.mesh === hitMesh);
    if (target) hitTarget(target);
  }
  hideHint();
}

const fireButton = document.getElementById("fireButton");
fireButton.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  shoot();
});
window.addEventListener("mousedown", (e) => {
  if (document.pointerLockElement === canvas) shoot();
});

// ---------- Movement / collision ----------
function collides(pos) {
  for (const ob of obstacles) {
    if (
      pos.x > ob.min.x - 0.4 &&
      pos.x < ob.max.x + 0.4 &&
      pos.z > ob.min.z - 0.4 &&
      pos.z < ob.max.z + 0.4
    ) {
      return true;
    }
  }
  return false;
}

function updateMovement(dt) {
  let ix = moveInput.x;
  let iy = moveInput.y;

  // keyboard fallback
  if (keys["KeyW"]) iy += 1;
  if (keys["KeyS"]) iy -= 1;
  if (keys["KeyD"]) ix += 1;
  if (keys["KeyA"]) ix -= 1;

  const len = Math.hypot(ix, iy);
  if (len > 1) {
    ix /= len;
    iy /= len;
  }
  if (len < 0.001) return;

  const forward = new THREE.Vector3(
    -Math.sin(player.yaw),
    0,
    -Math.cos(player.yaw)
  );
  const right = new THREE.Vector3(
    Math.sin(player.yaw + Math.PI / 2),
    0,
    Math.cos(player.yaw + Math.PI / 2)
  );

  const move = new THREE.Vector3();
  move.addScaledVector(forward, iy);
  move.addScaledVector(right, ix);
  if (move.lengthSq() > 0) move.normalize();
  move.multiplyScalar(player.speed * dt);

  const next = player.position.clone().add(move);
  next.x = Math.max(-halfArena, Math.min(halfArena, next.x));
  next.z = Math.max(-halfArena, Math.min(halfArena, next.z));

  if (!collides(new THREE.Vector3(next.x, 0, player.position.z))) {
    player.position.x = next.x;
  }
  if (!collides(new THREE.Vector3(player.position.x, 0, next.z))) {
    player.position.z = next.z;
  }
}

// ---------- Camera sync ----------
function updateCamera() {
  camera.position.set(player.position.x, player.height, player.position.z);
  camera.rotation.order = "YXZ";
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

// ---------- Main loop ----------
let lastTime = performance.now();
function tick(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  updateMovement(dt);
  updateCamera();
  updateTargets(now);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
