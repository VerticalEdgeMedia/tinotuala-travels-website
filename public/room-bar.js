/* ==========================================================================
   room-bar.js - 901, The Rooftop Bar.

   Night.  A long counter across the front, three paper-fire table lanterns
   on it, a cut-paper skyline standing behind in layers that slide against
   each other as you move, and a lot of stars.

   The menu is six drinks, one for each place on the site.  Order one and the
   bartender sends it down the bar.  STOP IT BEFORE IT REACHES THE END: press
   it, or press the Catch it button, or hit the space bar.  Miss and it goes
   off the end and breaks, a broom appears against the counter, and somebody
   sighs.  Catch all six and something comes out from under the till.

   Every drink and every description is INVENTED, in the hotel's voice, and
   marked as a draft for Tino to correct.  No brands, no real bars, no prices,
   and nothing that reads as his advice.

   The flat version has the same six buttons and the same catch, on a timer.
   ========================================================================== */

import * as THREE from './vendor/three.module.min.js';
import { getStage } from './gl.js';
import { makeFireMaterial } from './fire.js';
import { cnv, grainy, canvasTex, clamp, damp, Screen } from './roomkit.js';

const Hotel = window.Hotel;
const HOOKS = new URLSearchParams(location.search);
const CAUGHT_HOOK = HOOKS.get('caught');      /* ?caught=all or ?caught=3 */
const SLIDE_HOOK = HOOKS.get('slide');        /* ?slide=longtail  holds it mid-bar */
const SMASH_HOOK = HOOKS.get('smash') === '1';

/* -------------------------------------------------------------- the menu
   Invented drinks, invented descriptions, in the hotel's voice.  Each one is
   about what a day in that place might feel like, built out of the site's own
   lines about it.  Draft copy for Tino, not his advice, and not a promise. */

const DRINKS = [
  { id: 'longtail', name: 'The Longtail', place: 'Krabi',
    glass: 'highball', colour: 0x9CC26A, garnish: 'leaf',
    line: 'For the day that starts with an engine cutting out. Long, green, quiet and a bit salty. Drink it slowly enough to hear the water coming off the cliff.' },
  { id: 'rain', name: 'Shophouse Rain', place: 'Phuket',
    glass: 'coupe', colour: 0xE07FA0, garnish: 'parasol',
    line: 'For an afternoon spent not moving. Cold and pink, and best held while the rain arrives sideways and nobody minds.' },
  { id: 'headheight', name: 'Head Height', place: 'Bangkok',
    glass: 'rocks', colour: 0xE2731E, garnish: 'chilli',
    line: 'For a night of pointing at things and eating them. Hot at the back, sweet at the front, and gone before you have found a stool.' },
  { id: 'sixseats', name: 'Six Seats', place: 'Tokyo',
    glass: 'stem', colour: 0xD9E4D2, garnish: 'peel',
    line: 'For the door you would have walked straight past. Small, cold and exact. By the second one you know the names of everybody at the counter.' },
  { id: 'island', name: 'The Middle of the Island', place: 'Mykonos',
    glass: 'rocks', colour: 0xE8C060, garnish: 'sprig',
    line: 'For a day with sun on your forearms and no fixed plan. Honey, thyme and salt, in a short glass. Best drunk somewhere you had to drive to.' },
  { id: 'threefloors', name: 'Three Floors Up', place: 'Barcelona',
    glass: 'highball', colour: 0xA8281E, garnish: 'wheel',
    line: 'For eight people around one long table. Deep, red and slow, and still going at the point where somebody orders one more plate.' }
];
const BY_ID = {};
DRINKS.forEach((d) => { BY_ID[d.id] = d; });

const SIGHS = [
  'That is the third one tonight.',
  'The broom lives behind the till. It knows the way.',
  'Nobody is counting. Somebody is counting.',
  'They make another one. They always make another one.'
];
let sighN = 0;

/* --------------------------------------------------------------- the bar */

const BAR_Y = 1.06, BAR_Z = -0.25;
const START_X = -3.60, END_X = 2.92, SPEED = 3.10;
const EYE = { x: 0, y: 1.74, z: 4.60 };
const LOOK = { x: 0, y: 1.34, z: -1.4 };

/* ------------------------------------------------------------------ state */

let caught = {};
let sliding = null;         /* { def, group, x, v } */
let broom = null, broomOut = false;
let finished = false;

const stageEl = document.getElementById('roomStage');
const heldEl = document.getElementById('held');
const heldKick = document.getElementById('heldKick');
const heldName = document.getElementById('heldName');
const heldTag = document.getElementById('heldTag');
const heldBack = document.getElementById('heldBack');
const catchWrap = document.getElementById('catchWrap');
const catchBtn = document.getElementById('catchBtn');
const countEl = document.getElementById('bcNum');
const hintEl = document.getElementById('roomHint');

/* =================================================================== boot */

Hotel.ready(async () => {
  if (!Hotel.gateRoom('rooftop-bar', { originX: 0.5, originY: 0.46 })) return;
  Hotel.say('901. Night, a long bar and a bartender who has never once walked a drink down it.',
    { for: 13000 });
  wire();

  if (CAUGHT_HOOK) {
    const n = CAUGHT_HOOK === 'all' ? 6 : Math.min(6, parseInt(CAUGHT_HOOK, 10) || 0);
    for (let i = 0; i < n; i++) caught[DRINKS[i].id] = true;
  }

  if (Hotel.mode() !== 'full') { flatMode(); return; }
  let stage = null;
  try { stage = await getStage(); } catch (e) { stage = null; }
  if (!stage) { flatMode(); return; }
  try { build3d(stage); } catch (e) { console.error(e); flatMode(); }
});

/* ------------------------------------------------------------- flat mode */

let flatTimer = 0, flatDeadline = 0, flatOrder = null;

function flatMode() {
  document.documentElement.classList.add('room-flatmode');
  if (hintEl) hintEl.textContent = 'Order one, then catch it before the bar runs out.';
  const ids = Object.keys(caught);
  if (ids.length) showCard(BY_ID[ids[ids.length - 1]]);
  if (ids.length >= DRINKS.length && !finished) finish();
  refresh();
}

/* The same rule without a scene: the drink is on its way for as long as it
   would have taken to slide, and the Catch it button is the bar. */
function flatSlide(def) {
  window.clearTimeout(flatTimer);
  flatOrder = def;
  flatDeadline = performance.now() + 2100;
  catchWrap.hidden = false;
  catchBtn.textContent = 'Catch ' + def.name;
  catchBtn.classList.add('is-live');
  catchBtn.focus();
  Hotel.announce(def.name + ' is coming down the bar. Catch it.');
  flatTimer = window.setTimeout(() => {
    if (flatOrder === def) smash(def);
  }, 2100);
}

/* ============================================================== the scene */

let scene, camera, view, screen, counter, lanterns = [], skyLayers = [];
let pointer = { x: 0, y: 0, tx: 0, ty: 0 };
const glassObjs = {};
let shards = null;

function build3d(stage) {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(52, 1.7, 0.05, 90);
  camera.position.set(EYE.x, EYE.y, EYE.z);
  camera.lookAt(LOOK.x, LOOK.y, LOOK.z);

  /* --- the night, and the stars ------------------------------------------ */
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(120, 52),
    new THREE.MeshBasicMaterial({ map: texSky() }));
  sky.position.set(0, 13, -42);
  scene.add(sky);

  /* --- the skyline, three layers of cut paper ---------------------------- */
  [[-30, 0.46, 15, '#0A1F18'], [-21, 0.62, 11, '#08170F'], [-13, 0.86, 8, '#050E09']]
    .forEach(([z, dark, h, col], i) => {
      const w = Math.abs(z) * 2.3;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: texSkyline(i, col), transparent: true }));
      m.position.set(0, h / 2 - 1.2, z);
      scene.add(m);
      skyLayers.push({ mesh: m, amt: 0.10 + i * 0.16 });
    });

  /* --- the counter -------------------------------------------------------- */
  const woodMat = new THREE.MeshStandardMaterial({ map: texWood(), roughness: 0.42 });
  counter = new THREE.Group();
  scene.add(counter);
  const top = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.10, 0.92), woodMat);
  top.position.set(0, BAR_Y, BAR_Z);
  counter.add(top);
  const front = new THREE.Mesh(new THREE.BoxGeometry(11.5, 1.06, 0.14),
    new THREE.MeshStandardMaterial({ map: texBarFront(), roughness: 0.82 }));
  front.position.set(0, BAR_Y / 2 - 0.02, BAR_Z + 0.42);
  counter.add(front);
  /* a brass foot rail, and the light that catches on it */
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 11.2, 12),
    new THREE.MeshStandardMaterial({ color: 0xC9A227, roughness: 0.22, metalness: 0.9 }));
  rail.rotation.z = Math.PI / 2;
  rail.position.set(0, 0.24, BAR_Z + 0.66);
  counter.add(rail);
  const wash = new THREE.PointLight(0xFFB964, 1.3, 5.5, 2.0);
  wash.position.set(0, 0.70, BAR_Z + 1.5);
  scene.add(wash);
  const bead = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.035, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xC9A227, roughness: 0.3, metalness: 0.8 }));
  bead.position.set(0, BAR_Y - 0.07, BAR_Z + 0.49);
  counter.add(bead);
  /* the end of the bar, which is the whole point */
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.34, 12),
    new THREE.MeshStandardMaterial({ color: 0xB08A2E, roughness: 0.3, metalness: 0.85 }));
  post.position.set(END_X + 0.34, 0.67, BAR_Z + 0.3);
  counter.add(post);

  /* --- three paper-fire table lanterns ------------------------------------ */
  [-2.55, 0.05, 2.45].forEach((x, i) => {
    const g = new THREE.Group();
    g.scale.setScalar(0.92);
    g.position.set(x, BAR_Y + 0.05, BAR_Z - 0.16);
    counter.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.13, 0.06, 14),
      new THREE.MeshStandardMaterial({ color: 0x8A6A24, roughness: 0.3, metalness: 0.8 }));
    g.add(base);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.145, 0.30, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xEFE0BC, roughness: 0.95, transparent: true,
        opacity: 0.62, side: THREE.DoubleSide,
        emissive: new THREE.Color(0xC9791E), emissiveIntensity: 0.5 }));
    shade.position.y = 0.19;
    shade.renderOrder = 3;
    g.add(shade);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.28),
      makeFireMaterial(THREE, { sheets: 5, base: 0.02, height: 0.8, licks: 1.0, taper: 1,
        embers: 0, night: 1, intensity: 1.3, aspect: 0.78 }));
    f.material.depthWrite = false;
    f.renderOrder = 2;
    f.position.y = 0.19;
    g.add(f);
    const pl = new THREE.PointLight(0xFFAE5A, 1.5, 4.2, 2.0);
    pl.position.y = 0.24;
    g.add(pl);
    lanterns.push(g);
  });

  /* the terrace you are standing on, so the bottom of the frame is a place */
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(26, 10),
    new THREE.MeshStandardMaterial({ map: texDeck(), roughness: 0.94 }));
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, 0, 2.4);
  scene.add(deck);

  scene.add(new THREE.AmbientLight(0x2E4048, 0.55));
  scene.add(new THREE.HemisphereLight(0x8FA8C0, 0x1A1208, 0.45));
  const moon = new THREE.DirectionalLight(0xAFC6DC, 0.7);
  moon.position.set(-4, 7, 3);
  scene.add(moon);

  /* --- the glasses, one per drink, waiting off the end ------------------- */
  DRINKS.forEach((d) => {
    const g = buildGlass(d);
    g.scale.setScalar(1.55);                 /* stylised: it has to read across the bar */
    g.position.set(START_X, BAR_Y + 0.05, BAR_Z - 0.02);
    g.visible = false;
    scene.add(g);
    glassObjs[d.id] = { def: d, group: g };
  });

  /* the broom that turns up when one goes over the end */
  broom = new THREE.Group();
  broom.position.set(END_X + 0.62, 0, BAR_Z + 0.70);
  broom.visible = false;
  scene.add(broom);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 1.5, 8),
    new THREE.MeshStandardMaterial({ color: 0x9A7A46, roughness: 0.9 }));
  handle.position.y = 0.86; handle.rotation.z = 0.20; broom.add(handle);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.10),
    new THREE.MeshStandardMaterial({ color: 0x6E5A2E, roughness: 1 }));
  head.position.set(-0.17, 0.12, 0); broom.add(head);
  const bristles = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.09),
    new THREE.MeshStandardMaterial({ color: 0xD8BE84, roughness: 1 }));
  bristles.position.set(-0.17, 0.02, 0); broom.add(bristles);

  /* the shards, reused every time */
  shards = new THREE.Group();
  shards.visible = false;
  scene.add(shards);
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Mesh(new THREE.TetrahedronGeometry(0.045 + Math.random() * 0.035),
      new THREE.MeshStandardMaterial({ color: 0xCFE4DA, roughness: 0.12,
        metalness: 0.1, transparent: true, opacity: 0.8 }));
    s.userData.v = new THREE.Vector3((Math.random() - 0.2) * 2.4, 1.6 + Math.random() * 1.6,
      (Math.random() - 0.5) * 1.6);
    shards.add(s);
  }

  /* The menu is a menu: a card on the bar, not a pip floating over a glass
     that is not on the counter yet.  Screen is kept only so the harness can
     ask where a glass is. */
  screen = new Screen(camera, scene, stageEl, { occluders: [] });
  DRINKS.forEach((d) => { screen.add({ id: d.id, obj: glassObjs[d.id].group, dy: 0.10, hidden: true }); });

  view = stage.addView({
    el: stageEl, scene, camera,
    resize(w, h) {
      const a = w / Math.max(1, h);
      camera.aspect = a;
      camera.fov = a < 0.95 ? 78 : (a < 1.3 ? 62 : 52);
      camera.updateProjectionMatrix();
      camera.lookAt(LOOK.x, LOOK.y, LOOK.z);
    },
    onFrame(dt, t) { frame(dt, t); }
  });

  stageEl.addEventListener('pointermove', (e) => {
    const r = stageEl.getBoundingClientRect();
    pointer.tx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
    pointer.ty = clamp(-(((e.clientY - r.top) / r.height) * 2 - 1), -1, 1);
  }, { passive: true });

  stageEl.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.bm-btn') || e.target.closest('.held') ||
        e.target.closest('.bar-menu') ||
        e.target.closest('.room-out') || e.target.closest('.bar-catch')) return;
    if (sliding) katch();
  });

  document.documentElement.classList.add('room-3d');
  if (SLIDE_HOOK && BY_ID[SLIDE_HOOK]) { order(SLIDE_HOOK); sliding.x = 0.4; }
  if (SMASH_HOOK) { order(DRINKS[0].id); smash(DRINKS[0]); }
  const ids = Object.keys(caught);
  if (ids.length) showCard(BY_ID[ids[ids.length - 1]]);
  if (ids.length >= DRINKS.length && !finished) finish();
  refresh();
  frame(0, 0);

  window.RoomBar = {
    ids: DRINKS.map((d) => d.id),
    bounds: (id) => screen.bounds(id),
    state: () => ({ caught: Object.keys(caught), sliding: sliding && sliding.def.id,
      x: sliding ? sliding.x : null, broomOut, finished,
      shardsVisible: !!(shards && shards.visible) }),
    order: (id) => order(id),
    katch: () => katch(),
    miss: () => { if (sliding) smash(sliding.def); }
  };
}

/* ------------------------------------------------------------- textures */

function texSky() {
  const [c, g] = cnv(1024, 512);
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#04141C');
  gr.addColorStop(0.45, '#08202A');
  gr.addColorStop(0.78, '#123030');
  gr.addColorStop(1, '#3A3018');
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 420; i++) {
    const y = Math.pow(Math.random(), 1.5) * 420;
    const a = 0.25 + Math.random() * 0.7;
    g.fillStyle = 'rgba(243,236,220,' + a.toFixed(2) + ')';
    const r = Math.random() < 0.08 ? 1.9 : 0.9;
    g.beginPath(); g.arc(Math.random() * 1024, y, r, 0, 6.2832); g.fill();
  }
  grainy(g, 1024, 512, 10);
  return canvasTex(c);
}

/** One layer of the skyline, cut out of paper. */
function texSkyline(layer, col) {
  const W = 2048, H = 512;
  const [c, g] = cnv(W, H);
  g.clearRect(0, 0, W, H);
  g.fillStyle = col;
  let x = 0;
  let seed = 11 + layer * 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  g.beginPath();
  g.moveTo(0, H);
  while (x < W) {
    const w = 40 + rnd() * 130;
    const h = (90 + rnd() * 250) * (1 - layer * 0.14);
    g.lineTo(x, H - h);
    /* the odd spire, tank or aerial on the roof */
    if (rnd() > 0.72) {
      const sw = 10 + rnd() * 22;
      g.lineTo(x + w * 0.3, H - h);
      g.lineTo(x + w * 0.3, H - h - 40 - rnd() * 70);
      g.lineTo(x + w * 0.3 + sw, H - h - 40 - rnd() * 70);
      g.lineTo(x + w * 0.3 + sw, H - h);
    }
    g.lineTo(x + w, H - h);
    x += w;
  }
  g.lineTo(W, H);
  g.closePath();
  g.fill();
  /* lit windows, clipped to the buildings so none of them hangs in the sky */
  g.save();
  g.clip();
  for (let i = 0; i < 300 - layer * 80; i++) {
    g.fillStyle = Math.random() > 0.5 ? 'rgba(233,206,122,.55)' : 'rgba(255,186,90,.42)';
    g.fillRect(Math.random() * W, H - Math.random() * 330, 3 + Math.random() * 4, 4 + Math.random() * 5);
  }
  g.restore();
  return canvasTex(c);
}

/* the terrace: old encaustic tiles, worn pale where people stand */
function texDeck() {
  const [c, g] = cnv(256, 256);
  g.fillStyle = '#241C14'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(201,162,39,.16)'; g.lineWidth = 3;
  for (let i = 0; i <= 256; i += 64) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
  }
  g.strokeStyle = 'rgba(201,162,39,.10)'; g.lineWidth = 2;
  for (let y = 32; y < 256; y += 64) for (let x = 32; x < 256; x += 64) {
    g.beginPath(); g.arc(x, y, 17, 0, 6.2832); g.stroke();
  }
  grainy(g, 256, 256, 22);
  return canvasTex(c, { repeat: [9, 5] });
}

/* the front of the bar: dark lacquered panels with a gold bead */
function texBarFront() {
  const [c, g] = cnv(512, 256);
  g.fillStyle = '#231709'; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(${70 + Math.random() * 50},${44 + Math.random() * 30},16,.26)`;
    g.lineWidth = 1 + Math.random() * 2;
    const y = Math.random() * 256;
    g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(160, y + 6, 340, y - 6, 512, y); g.stroke();
  }
  g.lineWidth = 3;
  for (let x = 18; x < 512; x += 84) {
    g.strokeStyle = 'rgba(201,162,39,.34)'; g.strokeRect(x, 40, 62, 176);
    g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.6; g.strokeRect(x + 6, 46, 50, 164);
    g.lineWidth = 3;
  }
  grainy(g, 512, 256, 18);
  return canvasTex(c, { repeat: [5, 1] });
}

function texWood() {
  const [c, g] = cnv(512, 256);
  g.fillStyle = '#3E2A14'; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = `rgba(${86 + Math.random() * 70},${58 + Math.random() * 44},22,.30)`;
    g.lineWidth = 1 + Math.random() * 3;
    const y = Math.random() * 256;
    g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(160, y + 8, 340, y - 8, 512, y); g.stroke();
  }
  const sh = g.createLinearGradient(0, 0, 0, 256);
  sh.addColorStop(0, 'rgba(255,220,150,.22)');
  sh.addColorStop(0.5, 'rgba(0,0,0,0)');
  g.fillStyle = sh; g.fillRect(0, 0, 512, 256);
  grainy(g, 512, 256, 16);
  return canvasTex(c, { repeat: [5, 1] });
}

/* ------------------------------------------------------------ the glasses */

function buildGlass(d) {
  const g = new THREE.Group();
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xDCEAE4, roughness: 0.06, metalness: 0.18,
    transparent: true, opacity: 0.42, side: THREE.DoubleSide });
  const liquid = new THREE.MeshStandardMaterial({
    color: d.colour, roughness: 0.20, metalness: 0.05,
    transparent: true, opacity: 0.90 });

  if (d.glass === 'highball') {
    g.add(mesh(new THREE.CylinderGeometry(0.072, 0.064, 0.30, 22, 1, true), glassMat, 0, 0.15, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.063, 0.063, 0.012, 22), glassMat, 0, 0.006, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.066, 0.060, 0.23, 22), liquid, 0, 0.118, 0));
  } else if (d.glass === 'rocks') {
    g.add(mesh(new THREE.CylinderGeometry(0.082, 0.070, 0.16, 22, 1, true), glassMat, 0, 0.08, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.069, 0.069, 0.022, 22), glassMat, 0, 0.011, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.077, 0.068, 0.10, 22), liquid, 0, 0.058, 0));
    const ice = mesh(new THREE.BoxGeometry(0.058, 0.058, 0.058),
      new THREE.MeshStandardMaterial({ color: 0xE8F2EE, roughness: 0.05,
        transparent: true, opacity: 0.55 }), 0.012, 0.10, 0);
    ice.rotation.set(0.5, 0.7, 0.2);
  } else if (d.glass === 'coupe') {
    g.add(mesh(new THREE.SphereGeometry(0.098, 24, 12, 0, 6.2832, Math.PI * 0.52, Math.PI * 0.48),
      glassMat, 0, 0.175, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.10, 10), glassMat, 0, 0.055, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.056, 0.060, 0.012, 20), glassMat, 0, 0.006, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.086, 0.062, 0.042, 24), liquid, 0, 0.152, 0));
  } else {                                       /* a small stemmed glass */
    g.add(mesh(new THREE.CylinderGeometry(0.058, 0.030, 0.13, 22, 1, true), glassMat, 0, 0.145, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.085, 10), glassMat, 0, 0.046, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.050, 0.054, 0.012, 20), glassMat, 0, 0.006, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.050, 0.031, 0.09, 22), liquid, 0, 0.126, 0));
  }

  /* the garnish, which is most of the personality */
  switch (d.garnish) {
    case 'leaf': {
      const l = mesh(new THREE.SphereGeometry(0.055, 12, 8),
        new THREE.MeshStandardMaterial({ color: 0x4E7A32, roughness: 0.8 }), 0.05, 0.30, 0.02);
      l.scale.set(1, 0.24, 0.5); l.rotation.z = 0.6;
      break;
    }
    case 'parasol': {
      const stick = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.17, 6),
        new THREE.MeshStandardMaterial({ color: 0xC9B48A, roughness: 1 }), 0.04, 0.26, 0.02);
      stick.rotation.z = 0.42;
      const cone = mesh(new THREE.ConeGeometry(0.075, 0.05, 12),
        new THREE.MeshStandardMaterial({ color: 0xE04A6E, roughness: 0.9,
          side: THREE.DoubleSide }), 0.075, 0.33, 0.02);
      cone.rotation.z = 0.42;
      break;
    }
    case 'chilli': {
      const ch = mesh(new THREE.ConeGeometry(0.016, 0.10, 8),
        new THREE.MeshStandardMaterial({ color: 0xC02A16, roughness: 0.55 }), 0.05, 0.19, 0.03);
      ch.rotation.z = -1.1;
      break;
    }
    case 'peel': {
      const p = mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 14, Math.PI * 1.6),
        new THREE.MeshStandardMaterial({ color: 0xE8C245, roughness: 0.7 }), 0.028, 0.20, 0.02);
      p.rotation.set(0.9, 0.3, 0);
      break;
    }
    case 'sprig': {
      for (let i = 0; i < 3; i++) {
        const s = mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.09, 5),
          new THREE.MeshStandardMaterial({ color: 0x5E7A46, roughness: 0.9 }),
          0.03 + i * 0.012, 0.16, 0.02);
        s.rotation.z = -0.3 - i * 0.18;
      }
      break;
    }
    case 'wheel': {
      const w = mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.008, 18),
        new THREE.MeshStandardMaterial({ color: 0xE8913A, roughness: 0.75 }), 0.062, 0.27, 0.01);
      w.rotation.set(0, 0, Math.PI / 2 + 0.3);
      break;
    }
  }

  function mesh(geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  }
  return g;
}

/* ------------------------------------------------------------- each frame */

function frame(dt, t) {
  if (!scene) return;
  const still = Hotel.stillFrame;
  pointer.x = still ? pointer.tx : damp(pointer.x, pointer.tx, 0.002, dt);
  pointer.y = still ? pointer.ty : damp(pointer.y, pointer.ty, 0.002, dt);

  /* the skyline slides against itself: that is the 2.5D */
  skyLayers.forEach((l) => { l.mesh.position.x = -pointer.x * l.amt * 4.2; });

  if (sliding) {
    if (!still) sliding.x += sliding.v * dt;
    sliding.group.position.x = sliding.x;
    sliding.group.rotation.z = Math.sin(sliding.x * 6) * 0.02;
    if (sliding.x > END_X) { smash(sliding.def); }
  }

  if (shards && shards.visible && !still) {
    shards.children.forEach((s) => {
      s.userData.v.y -= 7.5 * dt;
      s.position.addScaledVector(s.userData.v, dt);
      s.rotation.x += dt * 5; s.rotation.y += dt * 3.5;
      s.material.opacity = Math.max(0, s.material.opacity - dt * 0.55);
    });
  }

  if (screen) screen.place();
}

/* ----------------------------------------------------- ordering, catching */

function wire() {
  document.querySelectorAll('.bm-btn').forEach((b) => {
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => order(b.dataset.obj));
  });
  catchBtn.addEventListener('click', () => katch());
  heldBack.addEventListener('click', () => { heldEl.hidden = true; refresh(); });
  document.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.code === 'Space') && (sliding || flatOrder)) {
      e.preventDefault();
      katch();
    } else if (e.key === 'Escape' && !heldEl.hidden) heldEl.hidden = true;
  });
}

function order(id) {
  const d = BY_ID[id];
  if (!d) return false;
  if (sliding || flatOrder) return false;               /* one at a time */
  if (caught[id]) { showCard(d); return false; }

  heldEl.hidden = true;
  if (broom) { broom.visible = false; broomOut = false; }
  if (shards) shards.visible = false;

  if (document.documentElement.classList.contains('room-flatmode') || !scene) {
    flatSlide(d);
    refresh();
    return true;
  }
  const o = glassObjs[id];
  o.group.visible = true;
  o.group.position.set(START_X, BAR_Y + 0.05, BAR_Z - 0.02);
  sliding = { def: d, group: o.group, x: START_X, v: SPEED };
  catchWrap.hidden = false;
  catchBtn.textContent = 'Catch it';
  catchBtn.classList.add('is-live');
  if (Hotel.sound.isOn()) Hotel.sound.play('tick');
  Hotel.announce(d.name + ' is coming down the bar. Press Catch it, or the space bar.');
  refresh();
  return true;
}

function katch() {
  const d = sliding ? sliding.def : flatOrder;
  if (!d) return false;
  if (document.documentElement.classList.contains('room-flatmode') || !sliding) {
    window.clearTimeout(flatTimer);
    if (performance.now() > flatDeadline) { smash(d); return false; }
    flatOrder = null;
  } else {
    if (sliding.x > END_X) { smash(d); return false; }
    sliding.group.position.x = sliding.x;
    if (window.gsap && !Hotel.stillFrame) {
      window.gsap.fromTo(sliding.group.position, { y: BAR_Y + 0.05 },
        { y: BAR_Y + 0.05, duration: 0.01 });
      window.gsap.fromTo(sliding.group.rotation, { z: 0.16 },
        { z: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    }
    sliding = null;
  }
  caught[d.id] = true;
  catchWrap.hidden = true;
  catchBtn.classList.remove('is-live');
  if (Hotel.sound.isOn()) Hotel.sound.play('hum');
  showCard(d);
  refresh();
  if (Object.keys(caught).length >= DRINKS.length && !finished) finish();
  return true;
}

function smash(d) {
  window.clearTimeout(flatTimer);
  flatOrder = null;
  catchWrap.hidden = true;
  catchBtn.classList.remove('is-live');
  if (sliding) {
    const g = sliding.group;
    if (shards) {
      shards.position.set(END_X + 0.24, 0.18, BAR_Z + 0.28);
      shards.visible = true;
      shards.children.forEach((s) => {
        s.position.set((Math.random() - 0.5) * 0.1, 0, (Math.random() - 0.5) * 0.1);
        s.material.opacity = 0.8;
        s.userData.v.set((Math.random() - 0.2) * 2.4, 1.4 + Math.random() * 1.6,
          (Math.random() - 0.5) * 1.6);
      });
    }
    g.visible = false;
    sliding = null;
  }
  if (broom) { broom.visible = true; broomOut = true; }
  if (Hotel.sound.isOn()) { Hotel.sound.play('clunk'); Hotel.sound.play('jingle'); }
  heldEl.hidden = false;
  stageEl.classList.add('is-carded');
  heldKick.textContent = 'Off the end';
  heldName.textContent = d.name + ', on the floor';
  heldTag.textContent = SIGHS[sighN++ % SIGHS.length] + ' Order it again whenever you are ready.';
  Hotel.say('It went over the end. The broom is already out.', { for: 9000 });
  Hotel.announce(d.name + ' went off the end of the bar and broke. Order it again.');
  refresh();
}

function showCard(d) {
  heldEl.hidden = false;
  heldKick.textContent = 'Draft, in the hotel’s voice';
  heldName.textContent = d.name;
  heldTag.textContent = d.line + ' (' + d.place + '.)';
  document.querySelectorAll('.bm-btn').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.obj === d.id));
  });
  Hotel.announce(d.name + '. ' + d.line);
}

function refresh() {
  if (countEl) countEl.textContent = String(Object.keys(caught).length);
  stageEl.classList.toggle('is-carded', !heldEl.hidden);
  document.querySelectorAll('.bm-btn').forEach((b) => {
    b.classList.toggle('is-done', !!caught[b.dataset.obj]);
  });
}

function finish() {
  finished = true;
  Hotel.addFound('barcard');
  const f = Hotel.FINDS.barcard;
  Hotel.say('Six for six, and not one of them on the floor. They keep something under the till for that.',
    { for: 15000 });
  if (Hotel.sound.isOn()) Hotel.sound.play('ding');
  heldEl.hidden = false;
  heldKick.textContent = 'Six of six';
  heldName.textContent = f.title;
  heldTag.textContent = 'In your passport. Public domain, from Wikimedia Commons, credited in full.';
  document.documentElement.classList.add('bar-all-caught');
  if (hintEl) { hintEl.textContent = 'All six.'; hintEl.style.opacity = '0'; }
}
