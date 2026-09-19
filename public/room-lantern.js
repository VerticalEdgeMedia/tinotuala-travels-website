/* ==========================================================================
   room-lantern.js - 311, The Lantern Room.

   A dark room with nine paper lanterns hanging on cords, a brazier of paper
   fire at the left, and a tall gold arch on the back wall with nothing in it.

   You carry a taper.  Hold it near a lantern and the lantern lights, and the
   picture that lantern has been keeping goes up large in the arch.  Move the
   taper about too fast and the draught puts it out: the brazier is where you
   relight it.  Light all nine and the room can finally see itself, and
   something turns up that has been up there all along.

   The lanterns are lit by the paper-fire shader standing inside the shade,
   which is what makes them flicker like paper rather than glow like a bulb.

   The same room exists as a flat SVG drawing plus the same ten buttons, and
   the logic below drives both: the buttons in .lost-list are the one route
   in.  With JavaScript off it is still a readable list of lanterns.
   ========================================================================== */

import * as THREE from './vendor/three.module.min.js';
import { getStage } from './gl.js';
import { makeFireMaterial } from './fire.js';
import { cnv, grainy, canvasTex, loadTex, paperGround, goldGrad, archPath,
         clamp, damp, Screen } from './roomkit.js';

const Hotel = window.Hotel;
const HOOKS = new URLSearchParams(location.search);
const LIT_HOOK = HOOKS.get('lit');       /* ?lit=all or ?lit=3, for screenshots */
const OUT_HOOK = HOOKS.get('taper') === 'out';

/* ------------------------------------------------------------ the lanterns
   Each one keeps a photograph.  These are the site's own place pictures, the
   same files the home page uses, with the same descriptions.  They are
   stand-ins for places: not pictures of anybody's trip. */

const LANTERNS = [
  { id: 'l1', x: -2.62, y: 2.92, z: -1.35, r: 0.23, h: 0.4, tint: 0xF0E2C0,
    img: 'krabi-phiphi-prows.jpg', w: 1600, h2: 985, place: 'Krabi',
    cap: 'Longtail prows, Ko Phi Phi',
    alt: 'Carved longtail boat prows strung with coloured ribbons resting in shallow green water below jungle cliffs.' },
  { id: 'l2', x: -1.92, y: 2.05, z: 0.35, r: 0.2, h: 0.5, tint: 0xEFD9AE,
    img: 'phuket-soi-rommanee.jpg', w: 1400, h2: 1050, place: 'Phuket',
    cap: 'Soi Rommanee, Phuket Old Town',
    alt: 'A narrow street of pink and yellow Sino-Portuguese shophouses in Phuket Old Town, red lanterns strung overhead after rain.' },
  { id: 'l3', x: -1.24, y: 3.22, z: -2.1, r: 0.26, h: 0.36, tint: 0xE7CFA0,
    img: 'bangkok-yaowarat-neon.jpg', w: 1400, h2: 933, place: 'Bangkok',
    cap: 'Yaowarat Road, Bangkok',
    alt: 'Yaowarat Road in Bangkok seen from above at night, lanes of traffic between tall neon signs.' },
  { id: 'l4', x: -0.52, y: 1.74, z: 1.05, r: 0.17, h: 0.38, tint: 0xF3E6C6,
    img: 'tokyo-lantern-facade.jpg', w: 1072, h2: 1300, place: 'Tokyo',
    cap: 'Chiyoda, Tokyo',
    alt: 'A three-storey Tokyo restaurant lit top to bottom with rows of red and gold paper lanterns at dusk.' },
  { id: 'l5', x: 0.42, y: 3.34, z: -0.95, r: 0.22, h: 0.44, tint: 0xEEDCB4,
    img: 'mykonos-windmills.jpg', w: 1500, h2: 939, place: 'Mykonos',
    cap: 'The windmills, Mykonos',
    alt: 'Two whitewashed Mykonos windmills with bare timber sails against a deep blue sky.' },
  { id: 'l6', x: 1.16, y: 1.92, z: 0.6, r: 0.19, h: 0.38, tint: 0xF0E0BC,
    img: 'barcelona-placa-reial.jpg', w: 1400, h2: 933, place: 'Barcelona',
    cap: 'Placa Reial, Barcelona',
    alt: 'Placa Reial in Barcelona at blue hour, strings of lights crossing above the palms and arcades.' },
  { id: 'l7', x: 1.96, y: 3.02, z: -1.7, r: 0.24, h: 0.42, tint: 0xE9D2A4,
    img: 'tokyo-golden-gai-alley.jpg', w: 1500, h2: 1000, place: 'Tokyo',
    cap: 'Golden Gai, Shinjuku',
    alt: 'A narrow Golden Gai alley in Shinjuku at night, hung with small hand-painted signs and lit by a line of paper lamps.' },
  { id: 'l8', x: 2.66, y: 2.18, z: -0.2, r: 0.18, h: 0.34, tint: 0xF2E4C2,
    img: 'mykonos-little-venice-sunset.jpg', w: 1500, h2: 996, place: 'Mykonos',
    cap: 'Little Venice, Mykonos',
    alt: 'Wooden balconies hanging over the water at Little Venice in Mykonos as the sun drops behind the hills.' },
  { id: 'l9', x: -0.06, y: 3.58, z: -2.55, r: 0.21, h: 0.36, tint: 0xE6CE9E,
    img: 'bangkok-wat-arun-sunset.jpg', w: 1600, h2: 1066, place: 'Bangkok',
    cap: 'Wat Arun and the Chao Phraya, Bangkok',
    alt: 'The spires of Wat Arun silhouetted against an orange sunset over the Chao Phraya, a long rowing barge crossing the water.' }
];
const BY_ID = {};
LANTERNS.forEach((l) => { BY_ID[l.id] = l; });

/* the room */
const WALL_Z = -3.0, ROOM_W = 13, CEIL = 4.5;
const EYE = { x: 0, y: 1.56, z: 3.40 };
const LOOK = { x: 0, y: 1.92, z: WALL_Z };
const ARCH = { x: 0, y: 2.02, w: 3.10, h: 2.55 };
const BRAZIER = { x: -1.34, y: 0, z: 0.90 };

/* ----------------------------------------------------------------- state */

let lit = {};            /* id -> true */
let taperLit = true;
let shown = null;        /* the lantern whose picture is in the arch */
let finished = false;

/* ------------------------------------------------------------------- DOM */

const stageEl = document.getElementById('roomStage');
const heldEl = document.getElementById('held');
const heldKick = document.getElementById('heldKick');
const heldName = document.getElementById('heldName');
const heldTag = document.getElementById('heldTag');
const heldAct = document.getElementById('heldAct');
const countEl = document.getElementById('lcNum');
const hintEl = document.getElementById('roomHint');
const archBox = document.getElementById('archBox');
const archImg = document.getElementById('archImg');
const archCap = document.getElementById('archCap');

function btn(id) { return document.querySelector('.lost-btn[data-obj="' + id + '"]'); }

/* =================================================================== boot */

Hotel.ready(async () => {
  if (!Hotel.gateRoom('lantern-room', { originX: 0.5, originY: 0.42 })) return;

  Hotel.say('311. Nine lanterns and one taper. The draught in here has beaten better people than you.',
    { for: 13000 });

  wire();
  if (LIT_HOOK) {
    const n = LIT_HOOK === 'all' ? 9 : Math.min(9, parseInt(LIT_HOOK, 10) || 0);
    for (let i = 0; i < n; i++) lit[LANTERNS[i].id] = true;
  }
  if (OUT_HOOK) taperLit = false;

  if (Hotel.mode() !== 'full') { flatMode(); return; }
  let stage = null;
  try { stage = await getStage(); } catch (e) { stage = null; }
  if (!stage) { flatMode(); return; }
  try { build3d(stage); }
  catch (e) { console.error(e); flatMode(); }
});

/* ------------------------------------------------------------- flat mode */

function flatMode() {
  document.documentElement.classList.add('room-flatmode');
  if (hintEl) hintEl.textContent = 'Light a lantern. Two in a rush and the taper goes out.';
  const ids = Object.keys(lit);
  if (ids.length) showPicture(BY_ID[ids[ids.length - 1]]);
  if (ids.length >= LANTERNS.length && !finished) finish();
  syncFlat();
  refresh();
  /* the same read-only handle the 3D path exposes, so a harness can play the
     flat room too */
  window.RoomLantern = {
    ids: LANTERNS.map((l) => l.id).concat(['brazier']),
    bounds: () => null,
    state: () => ({ lit: Object.keys(lit), taperLit, shown: shown && shown.id, finished }),
    light: (id) => tryLight(id, true),
    blowOut: () => blowOut()
  };
}

function syncFlat() {
  LANTERNS.forEach((l) => {
    const g = document.querySelector('[data-flat="' + l.id + '"]');
    if (g) g.classList.toggle('is-lit', !!lit[l.id]);
  });
  if (archBox) archBox.hidden = !shown;
  if (shown && archImg) {
    archImg.src = 'img/' + shown.img;
    archImg.width = shown.w; archImg.height = shown.h2;
    archImg.alt = shown.alt;
    archCap.textContent = shown.cap;
  }
}

/* ============================================================== the room */

let scene, camera, view, screen;
let taper, taperFlame, taperGlow, archMesh, archCanvas, archCtx, archTex;
let roomLight, braziers = [];
const lanternObjs = {};
let pointer = { x: 0, y: -0.15, tx: 0, ty: -0.15, speed: 0, lastT: 0, lastX: 0, lastY: 0 };
let dwell = { id: null, t: 0 };
let glowT = 0;

function build3d(stage) {
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x05100C, 5.0, 12.0);
  camera = new THREE.PerspectiveCamera(42, 1.7, 0.05, 40);
  camera.position.set(EYE.x, EYE.y, EYE.z);
  camera.lookAt(LOOK.x, LOOK.y, LOOK.z);

  /* --- the room ---------------------------------------------------------- */
  const wallMat = new THREE.MeshStandardMaterial({ map: texLacquer(), roughness: 0.86 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, CEIL * 1.6), wallMat);
  wall.position.set(0, CEIL * 0.55, WALL_Z);
  scene.add(wall);

  const side = (s) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(9, CEIL * 1.5), wallMat);
    m.position.set(s * 5.4, CEIL * 0.5, WALL_Z + 4.0);
    m.rotation.y = -s * Math.PI / 2;
    return m;
  };
  scene.add(side(-1), side(1));

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, 11),
    new THREE.MeshStandardMaterial({ map: texFloor(), roughness: 0.82 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, WALL_Z + 5.0);
  scene.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, 11),
    new THREE.MeshStandardMaterial({ color: 0x0A1712, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, CEIL, WALL_Z + 5.0);
  scene.add(ceil);

  /* --- the arch on the back wall ----------------------------------------- */
  [archCanvas, archCtx] = cnv(1024, 838);
  drawArch(null);
  archTex = canvasTex(archCanvas);
  archMesh = new THREE.Mesh(new THREE.PlaneGeometry(ARCH.w, ARCH.h),
    new THREE.MeshBasicMaterial({ map: archTex, transparent: true }));
  archMesh.position.set(ARCH.x, ARCH.y, WALL_Z + 0.02);
  scene.add(archMesh);

  /* --- light: almost none until you start lighting things ---------------- */
  scene.add(new THREE.AmbientLight(0x2A3A30, 0.30));
  roomLight = new THREE.HemisphereLight(0xC9A227, 0x0A1712, 0.14);
  scene.add(roomLight);

  /* --- the lanterns ------------------------------------------------------ */
  const shadeTex = texShade();
  LANTERNS.forEach((l) => {
    const g = new THREE.Group();
    g.position.set(l.x, l.y, l.z);
    scene.add(g);

    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, CEIL - l.y, 5),
      new THREE.MeshStandardMaterial({ color: 0x2A2118, roughness: 1 }));
    cord.position.y = (CEIL - l.y) / 2 + l.h * 0.55;
    g.add(cord);

    /* the paper shade: a slightly barrelled cylinder, lit from inside */
    const shade = new THREE.Mesh(barrel(l.r, l.h),
      new THREE.MeshStandardMaterial({
        map: shadeTex, color: l.tint, roughness: 0.95,
        transparent: true, opacity: 0.70, side: THREE.DoubleSide,
        emissive: new THREE.Color(0xC9791E), emissiveIntensity: 0
      }));
    shade.renderOrder = 3;
    g.add(shade);

    const capMat = new THREE.MeshStandardMaterial({ color: 0x2E2317, roughness: 0.8 });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(l.r * 0.62, l.r * 0.66, 0.035, 18), capMat);
    top.position.y = l.h * 0.52; g.add(top);
    const bot = new THREE.Mesh(new THREE.CylinderGeometry(l.r * 0.66, l.r * 0.60, 0.035, 18), capMat);
    bot.position.y = -l.h * 0.52; g.add(bot);
    const tassel = new THREE.Mesh(new THREE.ConeGeometry(l.r * 0.16, l.h * 0.30, 10),
      new THREE.MeshStandardMaterial({ color: 0x8A2E2E, roughness: 0.9 }));
    tassel.position.y = -l.h * 0.70;
    if (l.id !== 'l8') g.add(tassel);          /* l8 is the one missing its tassel */

    /* the flame, as paper, standing inside the shade */
    const flame = new THREE.Mesh(new THREE.PlaneGeometry(l.r * 1.95, l.h * 1.02),
      makeFireMaterial(THREE, { sheets: 5, base: 0.03, height: 0.80, licks: 1.0,
        taper: 1, embers: 0, intensity: 1.35, night: 1, aspect: 1.95 * l.r / (1.02 * l.h) }));
    flame.material.depthWrite = false;
    flame.renderOrder = 2;
    flame.position.y = -l.h * 0.06;
    flame.visible = false;
    g.add(flame);

    const light = new THREE.PointLight(0xFFB45A, 0, 6.0, 2.0);
    light.position.set(0, 0, 0);
    g.add(light);

    lanternObjs[l.id] = { def: l, group: g, shade, flame, light, bob: Math.random() * 6.28 };
  });

  /* --- the brazier -------------------------------------------------------- */
  const brass = new THREE.MeshStandardMaterial({ color: 0xB08A2E, roughness: 0.34, metalness: 0.8 });
  const bg = new THREE.Group();
  bg.position.set(BRAZIER.x, 0, BRAZIER.z);
  scene.add(bg);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.12, 1.46, 14), brass);
  stem.position.y = 0.73; bg.add(stem);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.30, 0.07, 18), brass);
  foot.position.y = 0.035; bg.add(foot);
  const knop = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10), brass);
  knop.position.y = 0.78; bg.add(knop);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.28, 22, 12, 0, 6.2832, Math.PI * 0.52, Math.PI * 0.48), brass);
  bowl.position.y = 1.50; bowl.scale.y = 0.70; bg.add(bowl);
  const bfire = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.56),
    makeFireMaterial(THREE, { sheets: 6, base: 0.02, height: 0.78, licks: 1.4, taper: 1,
      embers: 0.8, night: 1, intensity: 1.15, aspect: 0.96 }));
  bfire.material.depthWrite = false;
  bfire.position.y = 1.74;
  bg.add(bfire);
  const blight = new THREE.PointLight(0xFF9A3C, 2.6, 5.5, 2.0);
  blight.position.set(0, 1.82, 0);
  bg.add(blight);
  braziers.push({ group: bg, fire: bfire, light: blight, bowl });

  /* --- the taper ---------------------------------------------------------- */
  taper = new THREE.Group();
  scene.add(taper);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.010, 0.86, 7),
    new THREE.MeshStandardMaterial({ color: 0x6A5330, roughness: 0.95 }));
  stick.position.set(0.10, -0.43, 0);
  stick.rotation.z = 0.24;                  /* held from the bottom right */
  taper.add(stick);
  taperFlame = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.125),
    makeFireMaterial(THREE, { sheets: 5, base: 0.0, height: 0.88, licks: 0.9, taper: 1,
      embers: 0.4, night: 1, intensity: 1.3, aspect: 0.6 }));
  taperFlame.material.depthWrite = false;
  taperFlame.position.y = 0.055;
  taper.add(taperFlame);
  taperGlow = new THREE.PointLight(0xFFC070, 1.5, 2.4, 2.0);
  taperGlow.position.y = 0.055;
  taper.add(taperGlow);

  /* --- the accessible buttons, over the objects --------------------------- */
  screen = new Screen(camera, scene, stageEl, { occluders: [wall, floor, ceil] });
  LANTERNS.forEach((l) => {
    screen.add({ id: l.id, obj: lanternObjs[l.id].group, dy: 0, radius: l.r * 1.2 });
  });
  screen.add({ id: 'brazier', obj: bg, dy: 1.62, radius: 0.42 });

  /* --- the view ----------------------------------------------------------- */
  view = stage.addView({
    el: stageEl, scene, camera,
    resize(w, h) {
      const a = w / Math.max(1, h);
      camera.aspect = a;
      camera.fov = a < 0.95 ? 70 : (a < 1.3 ? 54 : 42);
      camera.updateProjectionMatrix();
      camera.lookAt(LOOK.x, LOOK.y, LOOK.z);
    },
    onFrame(dt, t) { frame(dt, t); }
  });

  bindPointer();
  document.documentElement.classList.add('room-3d');
  /* ?lit=n was set before the scene existed: make those lanterns actually lit */
  let last = null;
  Object.keys(lit).forEach((id) => {
    const o = lanternObjs[id];
    if (o) { o.flame.visible = true; o.shade.material.emissive.setHex(0xC9791E); }
    last = BY_ID[id];
  });
  if (last) showPicture(last);
  if (Object.keys(lit).length >= LANTERNS.length && !finished) finish();
  refresh();
  frame(0, 0);

  /* read-only, for the harness */
  window.RoomLantern = {
    ids: LANTERNS.map((l) => l.id).concat(['brazier']),
    bounds: (id) => screen.bounds(id),
    state: () => ({ lit: Object.keys(lit), taperLit, shown: shown && shown.id, finished }),
    light: (id) => tryLight(id, true),
    blowOut: () => blowOut()
  };
}

/* --------------------------------------------------------------- textures */

/** Dark green lacquer with faint gold panel lines. */
function texLacquer() {
  const [c, g] = cnv(512, 512);
  g.fillStyle = '#0B1D16'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = 60 + Math.random() * 150;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(29,90,63,.30)');
    gr.addColorStop(1, 'rgba(29,90,63,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
  }
  /* lacquered panels with a gold bead round each one */
  g.lineWidth = 2.6;
  for (let x = 24; x < 512; x += 128) {
    for (let y = 24; y < 512; y += 168) {
      g.strokeStyle = 'rgba(201,162,39,.34)';
      g.strokeRect(x, y, 96, 132);
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.4;
      g.strokeRect(x + 6, y + 6, 84, 120);
      g.lineWidth = 2.6;
    }
  }
  grainy(g, 512, 512, 20);
  return canvasTex(c, { repeat: [3.2, 2.2] });
}

function texFloor() {
  const [c, g] = cnv(512, 512);
  g.fillStyle = '#17120C'; g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 74) {
    g.fillStyle = `rgba(${28 + Math.random() * 30},${20 + Math.random() * 20},${12 + Math.random() * 12},.6)`;
    g.fillRect(0, y, 512, 72);
    g.strokeStyle = 'rgba(6,4,2,.9)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke();
  }
  grainy(g, 512, 512, 18);
  return canvasTex(c, { repeat: [4, 4] });
}

/** Paper for the shades: laid fibres and a rib every so often. */
function texShade() {
  const [c, g] = cnv(256, 256);
  g.fillStyle = '#EFE3C4'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(150,120,70,.16)'; g.lineWidth = 1;
  for (let i = 0; i < 700; i++) {
    const y = Math.random() * 256;
    g.beginPath(); g.moveTo(Math.random() * 256, y); g.lineTo(Math.random() * 256, y + (Math.random() - 0.5) * 6); g.stroke();
  }
  g.strokeStyle = 'rgba(110,84,24,.38)'; g.lineWidth = 3;
  for (let x = 16; x < 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  grainy(g, 256, 256, 14);
  return canvasTex(c, { repeat: [1, 1] });
}

/** A lantern shade: a cylinder pushed out in the middle. */
function barrel(r, h) {
  const geo = new THREE.CylinderGeometry(r * 0.70, r * 0.70, h, 24, 6, true);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.42 * Math.cos((y / h) * Math.PI);
    p.setX(i, x * k); p.setZ(i, z * k);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** The arch on the wall: gold keyline, and whatever picture is in it. */
function drawArch(img) {
  const W = 1024, H = 838, g = archCtx;
  g.clearRect(0, 0, W, H);
  const m = 14;
  g.save();
  archPath(g, m, m, W - m * 2, H - m * 2);
  g.clip();
  if (img && img.complete && img.naturalWidth) {
    /* cover-fit inside the arch */
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    g.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    const vg = g.createLinearGradient(0, H * 0.55, 0, H);
    vg.addColorStop(0, 'rgba(6,16,12,0)');
    vg.addColorStop(1, 'rgba(6,16,12,.55)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  } else {
    g.fillStyle = '#071410'; g.fillRect(0, 0, W, H);
    const vg = g.createRadialGradient(W / 2, H * 0.4, 10, W / 2, H * 0.4, W * 0.6);
    vg.addColorStop(0, 'rgba(201,162,39,.10)');
    vg.addColorStop(1, 'rgba(201,162,39,0)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }
  g.restore();
  g.lineWidth = 9;
  g.strokeStyle = goldGrad(g, 0, 0, W, H);
  archPath(g, m, m, W - m * 2, H - m * 2); g.stroke();
  g.lineWidth = 2.4;
  archPath(g, m + 17, m + 17, W - (m + 17) * 2, H - (m + 17) * 2); g.stroke();
  if (archTex) archTex.needsUpdate = true;
}

/* ------------------------------------------------------------ the pointer */

function bindPointer() {
  stageEl.addEventListener('pointermove', (e) => {
    const r = stageEl.getBoundingClientRect();
    pointer.tx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
    pointer.ty = clamp(-(((e.clientY - r.top) / r.height) * 2 - 1), -1, 1);
    const now = performance.now();
    if (pointer.lastT) {
      const dt = Math.max(16, now - pointer.lastT) / 1000;
      const d = Math.hypot(e.clientX - pointer.lastX, e.clientY - pointer.lastY);
      pointer.speed = damp(pointer.speed, d / dt, 0.02, dt);
    }
    pointer.lastT = now; pointer.lastX = e.clientX; pointer.lastY = e.clientY;
  }, { passive: true });

  stageEl.addEventListener('pointerleave', () => { pointer.speed = 0; });

  /* a tap works too: it is the same as holding the taper there */
  stageEl.addEventListener('pointerup', (e) => {
    if (e.target.closest('.lost-btn') || e.target.closest('.room-out') ||
        e.target.closest('.held')) return;
    const r = stageEl.getBoundingClientRect();
    pointer.tx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
    pointer.ty = clamp(-(((e.clientY - r.top) / r.height) * 2 - 1), -1, 1);
    pointer.x = pointer.tx; pointer.y = pointer.ty;
    const near = nearest();
    if (near) tryLight(near.id);
    else if (nearBrazier()) relight();
  });
}

/** Where the taper's tip is, in world space, one metre in front of the eye. */
const _dir = new THREE.Vector3(), _right = new THREE.Vector3(), _up = new THREE.Vector3();
function taperTarget() {
  const dist = 1.75;
  camera.getWorldDirection(_dir);
  _right.copy(_dir).cross(camera.up).normalize();
  _up.copy(_right).cross(_dir).normalize();
  const hh = Math.tan((camera.fov * Math.PI / 180) / 2) * dist;
  const hw = hh * camera.aspect;
  return camera.position.clone()
    .addScaledVector(_dir, dist)
    .addScaledVector(_right, pointer.x * hw * 0.92)
    .addScaledVector(_up, pointer.y * hh * 0.86);
}

/** The unlit lantern the taper is closest to on screen, if it is close. */
function nearest() {
  if (!screen) return null;
  const tip = screen.at(taper, 0.07);
  let best = null, bd = 1e9;
  for (const l of LANTERNS) {
    if (lit[l.id]) continue;
    const it = screen.items.filter((i) => i.id === l.id)[0];
    if (!it || !it.screen || !it.onScreen) continue;
    const d = Math.hypot(it.screen.x - tip.x, (it.screen.y - tip.y) * 0.62);
    if (d < bd) { bd = d; best = l; }
  }
  return bd < 5.6 ? best : null;
}

function nearBrazier() {
  const it = screen && screen.items.filter((i) => i.id === 'brazier')[0];
  if (!it || !it.screen) return false;
  const tip = screen.at(taper, 0.07);
  return Math.hypot(it.screen.x - tip.x, (it.screen.y - tip.y) * 0.62) < 7.5;
}

/* ------------------------------------------------------------- each frame */

function frame(dt, t) {
  if (!scene) return;
  const still = Hotel.stillFrame;
  pointer.x = still ? pointer.tx : damp(pointer.x, pointer.tx, 0.0008, dt);
  pointer.y = still ? pointer.ty : damp(pointer.y, pointer.ty, 0.0008, dt);

  /* the taper follows your hand, and leans the way it is travelling */
  const target = taperTarget();
  taper.position.copy(target);
  taper.lookAt(camera.position.x, camera.position.y, camera.position.z + 2);
  taper.rotation.z = clamp(-(pointer.tx - pointer.x) * 9, -0.5, 0.5);
  taperFlame.visible = taperLit;
  taperGlow.intensity = taperLit ? 1.5 + Math.sin(t * 7) * 0.2 : 0;

  /* a draught: swing it about and it goes out */
  if (taperLit && !still && pointer.speed > 1250) blowOut();

  /* hold it near an unlit lantern and the lantern takes the flame */
  if (taperLit) {
    const near = nearest();
    if (near) {
      dwell.t = dwell.id === near.id ? dwell.t + dt : 0;
      dwell.id = near.id;
      if (dwell.t > 0.17) { tryLight(near.id); dwell.t = 0; }
    } else { dwell.id = null; dwell.t = 0; }
  }

  /* the lanterns breathe on their cords */
  for (const id in lanternObjs) {
    const o = lanternObjs[id];
    if (!still) {
      o.group.rotation.z = Math.sin(t * 0.55 + o.bob) * 0.022;
      o.group.rotation.x = Math.cos(t * 0.43 + o.bob) * 0.016;
    }
    if (lit[id]) {
      const f = 0.86 + Math.sin(t * 5.3 + o.bob) * 0.10 + Math.sin(t * 11.7 + o.bob) * 0.04;
      o.light.intensity = 2.2 * f * (finished ? 1.45 : 1);
      o.shade.material.emissiveIntensity = 0.40 * f;
    }
  }

  /* the room itself comes up as more of them are lit */
  const n = Object.keys(lit).length;
  glowT = damp(glowT, n / LANTERNS.length, 0.02, dt);
  roomLight.intensity = 0.14 + glowT * 0.55 + (finished ? 0.35 : 0);
  if (screen) screen.place();
}

/* ---------------------------------------------------------- what it does */

function wire() {
  document.querySelectorAll('.lost-btn').forEach((b) => {
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      const id = b.dataset.obj;
      if (id === 'brazier') relight();
      else tryLight(id);
    });
  });
  if (heldAct) heldAct.addEventListener('click', () => relight());
}

let lastLightAt = 0;

function tryLight(id, force) {
  const l = BY_ID[id];
  if (!l) return false;
  if (lit[id]) { showPicture(l); return false; }
  if (!taperLit && !force) {
    Hotel.say('The taper is out. It is a brazier, not a decoration.', { for: 8000 });
    flashBrazier();
    return false;
  }
  /* In the flat version there is no pointer to swing, so haste is the tell:
     two lanterns inside a third of a second and the draught takes it. */
  const now = performance.now();
  if (!force && document.documentElement.classList.contains('room-flatmode') &&
      now - lastLightAt < 340 && lastLightAt) { blowOut(); return false; }
  lastLightAt = now;

  lit[id] = true;
  const o = lanternObjs[id];
  if (o) {
    o.flame.visible = true;
    o.shade.material.emissive.setHex(0xC9791E);
    if (window.gsap && !Hotel.stillFrame) {
      window.gsap.fromTo(o.group.scale, { x: 1.10, y: 0.92, z: 1.10 },
        { x: 1, y: 1, z: 1, duration: 0.8, ease: 'elastic.out(1, 0.5)' });
    }
  }
  if (Hotel.sound.isOn()) Hotel.sound.play('crackle');
  showPicture(l);
  refresh();
  syncFlat();

  if (Object.keys(lit).length >= LANTERNS.length && !finished) finish();
  return true;
}

function blowOut() {
  if (!taperLit) return;
  taperLit = false;
  pointer.speed = 0;
  if (taperFlame) taperFlame.visible = false;
  if (Hotel.sound.isOn()) Hotel.sound.play('rustle');
  Hotel.say('Out. There is a draught in here and you just found it. The brazier is by the door.',
    { for: 9000 });
  Hotel.announce('The taper has blown out. Relight it at the brazier.');
  flashBrazier();
  refresh();
}

function relight() {
  if (taperLit) {
    Hotel.say('Still lit. Take it to a lantern instead.', { for: 6000 });
    return;
  }
  taperLit = true;
  if (taperFlame) taperFlame.visible = true;
  if (Hotel.sound.isOn()) Hotel.sound.play('crackle');
  Hotel.say('Lit. Slower this time.', { for: 6000 });
  Hotel.announce('The taper is lit again.');
  refresh();
}

function flashBrazier() {
  const b = btn('brazier');
  if (b && !Hotel.stillFrame) {
    b.classList.remove('is-calling'); void b.offsetWidth; b.classList.add('is-calling');
  }
  if (heldAct) heldAct.hidden = taperLit;
  if (!taperLit) {
    heldEl.hidden = false;
    heldKick.textContent = 'The taper';
    heldName.textContent = 'Out';
    heldTag.textContent = 'A draught got it. Dip it in the brazier by the door.';
  }
}

function showPicture(l) {
  shown = l;
  heldEl.hidden = false;
  heldKick.textContent = 'On the wall';
  heldName.textContent = l.place;
  heldTag.textContent = l.cap;
  heldAct.hidden = taperLit;
  Hotel.announce(l.place + '. ' + l.cap + ' is now up on the wall.');
  document.querySelectorAll('.lost-btn').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.obj === l.id));
  });
  if (archMesh) {
    const img = new Image();
    img.onload = () => { drawArch(img); };
    img.src = 'img/' + l.img;
    if (window.gsap && !Hotel.stillFrame) {
      window.gsap.fromTo(archMesh.material, { opacity: 0.25 }, { opacity: 1, duration: 0.7 });
    }
  }
  syncFlat();
}

function refresh() {
  if (countEl) countEl.textContent = String(Object.keys(lit).length);
  document.querySelectorAll('.lost-btn').forEach((b) => {
    const id = b.dataset.obj;
    if (id === 'brazier') {
      b.classList.toggle('is-wanted', !taperLit);
      return;
    }
    b.classList.toggle('is-done', !!lit[id]);
  });
  if (heldAct) heldAct.hidden = taperLit;
}

/* ------------------------------------------------------------- the reward */

function finish() {
  finished = true;
  Hotel.addFound('lantern');
  const f = Hotel.FINDS.lantern;
  Hotel.say('All nine. The room can see itself now, and so can the thing that has been hanging up there the whole time.',
    { for: 15000 });
  if (Hotel.sound.isOn()) Hotel.sound.play('ding');
  if (archMesh) {
    const img = new Image();
    img.onload = () => { drawArch(img); };
    img.src = f.img;
  }
  if (archBox) {
    archImg.src = f.img; archImg.width = f.w; archImg.height = f.h;
    archImg.alt = f.alt; archCap.textContent = f.title;
    archBox.hidden = false;
  }
  heldEl.hidden = false;
  heldKick.textContent = 'Nine of nine';
  heldName.textContent = f.title;
  heldTag.textContent = 'In your passport. Public domain, from Wikimedia Commons, credited in full.';
  heldAct.hidden = true;
  if (hintEl) { hintEl.textContent = 'Lit.'; hintEl.style.animation = 'none'; hintEl.style.opacity = '0'; }
  document.documentElement.classList.add('lanterns-all-lit');
}
