/* ==========================================================================
   room-gallery.js - 402, The Long Gallery.

   A long wall under picture lights, hung with genuine public-domain travel
   posters, hotel luggage labels and two of the site's own photographs.
   Every single one of them is crooked.

   Walk along it by dragging sideways, or with the arrow keys.  Take hold of
   the brass corner of a frame and lift or drop it until the spirit level
   lying on top of it reads true: it hums when it is, the frame settles, and
   the card on the wall beside it flips round to say what the picture is,
   who made it, when, and under what licence - only what Commons states.

   Wrong moves, in order of expense: push it too far and it swings back the
   other way; push it a long way too far and it comes off its nail and ends
   up on the floor, and has to be hung back up.

   All eighteen level: the gallery lights come up and something turns up
   behind the last frame.

   The flat version has the same eighteen buttons, the same nudge, the same
   caption cards and the same reward.
   ========================================================================== */

import * as THREE from './vendor/three.module.min.js';
import { getStage } from './gl.js';
import { cnv, grainy, canvasTex, loadTex, clamp, damp, Screen } from './roomkit.js';

const Hotel = window.Hotel;
const HOOKS = new URLSearchParams(location.search);
const LEVEL_HOOK = HOOKS.get('level');     /* ?level=all or ?level=5 */
const FALL_HOOK = HOOKS.get('fallen');     /* ?fallen=2 */
const WALK_HOOK = HOOKS.get('walk');       /* ?walk=6  which frame to stand at */

/* file, w, h, title, maker, year, licence, alt */
const PICS = [
  ["gal-poster-01.jpg", 823, 1150, "Touraine, Loches", "Poilpot, Théophile (1848-1915)", "1906", "Public domain", "A railway poster: a woman in black standing before the towers of a chateau at sunset, lettered Chemin de Fer d’Orleans, Touraine, Loches."],
  ["gal-label-01.jpg", 1091, 1100, "Kyoto Hotel", "Hannes Grobe", "photographed 2020", "CC BY-SA 4.0", "A blue starburst luggage label with a small crest and a hanging string, lettered Kyoto Hotel, Kyoto Japan."],
  ["gal-poster-03.jpg", 780, 1029, "Paris-Plage, Le Touquet", "Tauzin, Louis (1842-1915)", "1904", "Public domain", "A railway poster: a woman in a long red skirt carrying a basket on a pole, with small inset views of the pines and the shore below her."],
  ["reward-poster-02.jpg", 862, 1400, "Italian Lakes", "Unknown", "1930", "Public domain", "Italian tourism poster of a lakeside village with red-tiled roofs and a white bell tower, a tall dark cypress beside it and blue water running back to mountains."],
  ["gal-poster-05.jpg", 962, 1400, "Ault-Onival Plages", "Pal (1855-1942)", "1894", "Public domain", "A railway poster: a woman in black sitting on a rock above a beach, framed by roses, with inset views of the sands and the town."],
  ["gal-label-02.jpg", 952, 1100, "Grand Hotel, Rome", "Hannes Grobe", "photographed 2020", "CC BY-SA 4.0", "An oval red luggage label with a winged emblem in the middle, lettered Grand Hotel Rome around the rim."],
  ["gal-poster-08.jpg", 977, 775, "La Lorraine and La Savoie", "Argence, Eugène d' (1853-1920)", "1900", "Public domain", "A shipping line poster of a two-funnelled mail steamer under way, a crowd of small boats along the quay behind her."],
  ["gal-poster-02.jpg", 842, 1087, "Pyrenees, Cirque de Gavarnie", "Poilpot, Théophile (1848-1915)", "1902", "Public domain", "A railway poster: a shepherd in a blue cloak standing with his sheep on a mountain path, a green valley falling away below."],
  ["reward-poster-05.jpg", 1400, 1084, "French Line, Paris Havre New York", "Albert Sebille", "1914", "Public domain", "Ocean liner poster of the steamship France leaving harbour under a smoky amber sky, tugs and gulls around her bow."],
  ["gal-label-03.jpg", 1100, 531, "Hotel Continental, Naples", "Hannes Grobe", "photographed 2020", "CC BY-SA 4.0", "A green rectangular luggage label with a pale border, lettered Hotel Continental, Naples."],
  ["gal-poster-04.jpg", 872, 1139, "Berck-Plage", "Tauzin, Louis (1842-1915)", "1905", "Public domain", "A railway poster: a beached fishing boat with tall dark red sails, children with shrimping nets in the shallows beside it."],
  ["barcelona-gothic-lane-night.jpg", 1600, 1104, "Barcelona, after dark", "Davidlohr Bueso", "", "CC BY 2.0", "A stone lane in old Barcelona at night, lit by a single wrought-iron lamp, one figure walking away into the dark."],
  ["gal-poster-06.jpg", 1024, 789, "Banlieue de Paris, Athis-Mons", "Loir, Luigi (1845-1916)", "1904", "Public domain", "A railway poster in a gold art-nouveau surround: a river bank with figures on the towpath and a train running along the far side."],
  ["gal-label-04.jpg", 1100, 929, "Norfolk Hotel, Nairobi", "Hannes Grobe", "photographed 2020", "CC BY-SA 4.0", "A deco luggage label showing a lion, a long verandah and figures in front of it, lettered Norfolk Hotel, Nairobi, Kenya."],
  ["reward-poster-03.jpg", 872, 1400, "The Yangtze gorges", "Unknown", "1930", "Public domain", "Shipping line poster for the Yangtze gorges showing two steamers on a green river between purple cliffs, with a blue-roofed temple on a headland."],
  ["gal-poster-07.jpg", 917, 1263, "Dougga, Visitez la Tunisie", "La Nézière, Joseph de (1873-1944)", "1929", "Public domain", "A railway poster: two figures in deep blue robes carrying water jars in front of the ruined columns of a Roman temple."],
  ["tokyo-kabukicho-gate.jpg", 1300, 1158, "Kabukicho, Shinjuku", "Alessandro Baffa", "", "CC BY-SA 4.0", "The red neon arch over Kabukicho Ichibangai in Shinjuku, a wall of illuminated signs down the street beyond."],
  ["reward-poster-04.jpg", 1090, 1400, "Cie de Navigation Mixte", "F. Hugo d'Alesi", "1899", "Public domain", "French shipping line poster of a lateen-rigged boat on blue water, a mast of signal flags above it and a white North African town on the far shore."]
];

const SPACING = 1.78;
const WALL_Z = 0, CEIL = 3.6;
const EYE_Z = 4.05, EYE_Y = 1.58;
const TOL = 0.021;            /* within this it is level */
const SWING = 0.155;          /* past this it swings back the other way */
const FALL = 0.305;           /* past this it comes off the nail */

/* ------------------------------------------------------------------ state */

const st = [];                /* per picture: angle, level, fallen */
PICS.forEach(() => st.push({ a: 0, level: false, fallen: false }));
let panX = 0, panT = 0, panV = 0;
let finished = false, shown = -1;

const stageEl = document.getElementById('roomStage');
const heldEl = document.getElementById('held');
const heldKick = document.getElementById('heldKick');
const heldName = document.getElementById('heldName');
const heldTag = document.getElementById('heldTag');
const heldAct = document.getElementById('heldAct');
const heldBack = document.getElementById('heldBack');
const countEl = document.getElementById('gcNum');
const hintEl = document.getElementById('roomHint');

function idx(id) { return Number(String(id).slice(1)); }
function btnFor(i) { return document.querySelector('.gal-btn[data-obj="p' + i + '"]'); }

/* =================================================================== boot */

Hotel.ready(async () => {
  if (!Hotel.gateRoom('long-gallery', { originX: 0.5, originY: 0.46 })) return;
  Hotel.say('402. Eighteen pictures, not one of them straight. Nobody here has ever owned a spirit level until today.',
    { for: 14000 });

  /* the crooked start: a fixed pattern, so it is the same room every time */
  PICS.forEach((p, i) => {
    const s = Math.sin(i * 12.9898) * 43758.5453;
    st[i].a = ((s - Math.floor(s)) - 0.5) * 0.24 + (i % 2 ? 0.030 : -0.030);
  });

  if (LEVEL_HOOK) {
    const n = LEVEL_HOOK === 'all' ? PICS.length : Math.min(PICS.length, parseInt(LEVEL_HOOK, 10) || 0);
    for (let i = 0; i < n; i++) { st[i].a = 0; st[i].level = true; }
  }
  if (FALL_HOOK) { const i = Math.min(PICS.length - 1, parseInt(FALL_HOOK, 10) || 0); st[i].fallen = true; }
  if (WALK_HOOK) { panX = panT = (Number(WALK_HOOK) - (PICS.length - 1) / 2) * SPACING; }

  wire();
  if (Hotel.mode() !== 'full') { flatMode(); return; }
  let stage = null;
  try { stage = await getStage(); } catch (e) { stage = null; }
  if (!stage) { flatMode(); return; }
  try { build3d(stage); } catch (e) { console.error(e); flatMode(); }
});

function flatMode() {
  document.documentElement.classList.add('room-flatmode');
  if (hintEl) hintEl.textContent = 'Use the arrow keys on a frame, or press it, to level it.';
  if (countLevel() >= PICS.length && !finished) finish();
  refresh();
  window.RoomGallery = {
    ids: PICS.map((p, i) => 'p' + i), bounds: () => null,
    state: () => ({ level: countLevel(), fallen: st.filter((s) => s.fallen).length,
      angles: st.map((s) => +s.a.toFixed(3)), panX: 0, finished }),
    nudge: (i, d) => nudge(i, d),
    setAngle: (i, a) => { st[i].a = a; settle(i); },
    walkTo: () => {}
  };
}

function countLevel() { return st.filter((s) => s.level).length; }

/* ============================================================== the scene */

let scene, camera, view, screen, wallGroup, spirit, bubble, lights = [];
const frames = [];

function build3d(stage) {
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x08170F, 7, 26);
  camera = new THREE.PerspectiveCamera(46, 1.7, 0.05, 60);
  camera.position.set(0, EYE_Y, EYE_Z);

  const halfW = PICS.length * SPACING;

  const wallMat = new THREE.MeshStandardMaterial({ map: texWall(), roughness: 0.92 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2 + 12, CEIL * 2), wallMat);
  wall.position.set(0, CEIL * 0.62, WALL_Z);
  scene.add(wall);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2 + 12, 14),
    new THREE.MeshStandardMaterial({ map: texRunner(), roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 4);
  scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2 + 12, 14),
    new THREE.MeshStandardMaterial({ color: 0x09170F, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, CEIL, 4); scene.add(ceil);

  /* the picture rail, and the skirting */
  const brass = new THREE.MeshStandardMaterial({ color: 0xB08A2E, roughness: 0.3, metalness: 0.85 });
  const rail = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 12, 0.05, 0.06), brass);
  rail.position.set(0, 2.62, WALL_Z + 0.04); scene.add(rail);
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 12, 0.22, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x1B2C22, roughness: 0.9 }));
  skirt.position.set(0, 0.11, WALL_Z + 0.03); scene.add(skirt);

  scene.add(new THREE.AmbientLight(0x35473C, 0.42));
  scene.add(new THREE.HemisphereLight(0xC9A227, 0x0A1712, 0.30));

  wallGroup = new THREE.Group();
  scene.add(wallGroup);

  PICS.forEach((p, i) => {
    const x = (i - (PICS.length - 1) / 2) * SPACING;
    const H = 0.96 + (i % 3) * 0.10;
    const W = Math.min(1.34, H * (p[1] / p[2]));
    const y = 1.84 + ((i % 4) - 1.5) * 0.05;

    /* holder is the nail, and never moves.  pivot is what swings. */
    const holder = new THREE.Group();
    holder.position.set(x, y + H / 2 + 0.10, WALL_Z + 0.055);
    wallGroup.add(holder);
    const pivot = new THREE.Group();
    holder.add(pivot);

    const moulding = new THREE.Mesh(new THREE.BoxGeometry(W + 0.10, H + 0.10, 0.045),
      new THREE.MeshStandardMaterial({ map: texMoulding(), roughness: 0.42, metalness: 0.5 }));
    moulding.position.y = -(H / 2 + 0.10);
    pivot.add(moulding);
    const mount = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.03, H + 0.03),
      new THREE.MeshStandardMaterial({ color: 0xE9DEC0, roughness: 0.96 }));
    mount.position.set(0, -(H / 2 + 0.10), 0.024);
    pivot.add(mount);
    const art = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.07, H - 0.07),
      new THREE.MeshStandardMaterial({ map: loadTex('img/' + p[0]), roughness: 0.9 }));
    art.position.set(0, -(H / 2 + 0.10), 0.028);
    pivot.add(art);

    /* the brass corner you take hold of */
    const corner = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 10), brass);
    corner.position.set(W / 2 + 0.04, -(H + 0.14), 0.03);
    pivot.add(corner);

    /* the card on the wall beside it, blank until the picture hangs true */
    const [cc, cg] = cnv(512, 256);
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.23),
      new THREE.MeshStandardMaterial({ map: canvasTex(cc), roughness: 0.95 }));
    card.position.set(x + W / 2 + 0.34, y - H / 2 + 0.05, WALL_Z + 0.03);
    wallGroup.add(card);

    /* a picture light on the rail above it */
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.10, 0.20, 14, 1, true), brass);
    hood.position.set(x, 2.62, WALL_Z + 0.22);
    hood.rotation.x = 1.0;
    wallGroup.add(hood);
    const lamp = new THREE.SpotLight(0xFFD79A, 4.4, 4.6, 0.62, 0.95, 1.1);
    lamp.position.set(x, 2.56, WALL_Z + 0.30);
    lamp.target.position.set(x, y, WALL_Z);
    wallGroup.add(lamp, lamp.target);
    lights.push(lamp);

    frames.push({ i, holder, pivot, corner, card, cc, cg, W, H, x, y, lamp, drawn: false });
    drawCard(i, false);
  });

  /* the spirit level: it sits on top of whichever frame you have hold of */
  spirit = new THREE.Group();
  spirit.visible = false;
  scene.add(spirit);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.055, 0.045),
    new THREE.MeshStandardMaterial({ color: 0x7A4E1E, roughness: 0.7 }));
  spirit.add(body);
  [-0.19, 0.19].forEach((ex) => {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.058, 0.048), brass);
    cap.position.x = ex; spirit.add(cap);
  });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.13, 14),
    new THREE.MeshStandardMaterial({ color: 0xBFE4CE, roughness: 0.08,
      transparent: true, opacity: 0.45 }));
  tube.rotation.z = Math.PI / 2; tube.position.z = 0.026; spirit.add(tube);
  bubble = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xF6F2DE, roughness: 0.2,
      emissive: new THREE.Color(0x6E8A5A), emissiveIntensity: 0.5 }));
  bubble.position.z = 0.026; spirit.add(bubble);

  screen = new Screen(camera, scene, stageEl, { occluders: [] , selector: '.gal-btn' });
  frames.forEach((f) => screen.add({ id: 'p' + f.i, obj: f.corner, radius: 0.04 }));

  view = stage.addView({
    el: stageEl, scene, camera,
    resize(w, h) {
      const a = w / Math.max(1, h);
      camera.aspect = a;
      camera.fov = a < 0.95 ? 72 : (a < 1.3 ? 58 : 46);
      camera.updateProjectionMatrix();
    },
    onFrame(dt, t) { frame(dt, t); }
  });

  bindWalk();
  document.documentElement.classList.add('room-3d');
  st.forEach((s, i) => { if (s.level) drawCard(i, true); if (s.fallen) dropIt(i, true); });
  if (countLevel() >= PICS.length && !finished) finish();
  refresh();
  frame(0, 0);

  window.RoomGallery = {
    ids: PICS.map((p, i) => 'p' + i),
    bounds: (id) => screen.bounds(id),
    state: () => ({ level: countLevel(), fallen: st.filter((s) => s.fallen).length,
      angles: st.map((s) => +s.a.toFixed(3)), panX: +panX.toFixed(2), finished }),
    nudge: (i, d) => nudge(i, d),
    setAngle: (i, a) => { st[i].a = a; settle(i); },
    walkTo: (i) => { panT = (i - (PICS.length - 1) / 2) * SPACING; }
  };
}

/* --------------------------------------------------------------- textures */

function texWall() {
  const [c, g] = cnv(512, 512);
  g.fillStyle = '#123227'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 24; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = 60 + Math.random() * 170;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(29,90,63,.30)'); gr.addColorStop(1, 'rgba(29,90,63,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
  }
  /* a damask, very faint */
  g.strokeStyle = 'rgba(201,162,39,.11)'; g.lineWidth = 2;
  for (let y = 26; y < 512; y += 76) {
    for (let x = (y / 76) % 2 ? 38 : 0; x < 512; x += 76) {
      g.beginPath();
      g.moveTo(x + 38, y);
      g.bezierCurveTo(x + 62, y + 14, x + 62, y + 34, x + 38, y + 46);
      g.bezierCurveTo(x + 14, y + 34, x + 14, y + 14, x + 38, y);
      g.stroke();
    }
  }
  grainy(g, 512, 512, 18);
  return canvasTex(c, { repeat: [10, 2] });
}

function texRunner() {
  const [c, g] = cnv(256, 256);
  g.fillStyle = '#3A1512'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#2A0F0E'; g.fillRect(0, 60, 256, 136);
  g.strokeStyle = 'rgba(190,150,60,.4)'; g.lineWidth = 3;
  g.strokeRect(14, 74, 228, 108);
  grainy(g, 256, 256, 24);
  return canvasTex(c, { repeat: [14, 6] });
}

function texMoulding() {
  const [c, g] = cnv(128, 128);
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, '#E4C87E'); gr.addColorStop(0.35, '#B08A2E');
  gr.addColorStop(0.7, '#8A6A24'); gr.addColorStop(1, '#5A4212');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  grainy(g, 128, 128, 16);
  return canvasTex(c);
}

/** The caption card beside a picture: blank until it hangs true. */
function drawCard(i, on) {
  const f = frames[i];
  if (!f) return;
  const p = PICS[i], g = f.cg;
  g.fillStyle = on ? '#EFE6D0' : '#D8CDB0';
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = 'rgba(122,96,42,.7)'; g.lineWidth = 5; g.strokeRect(9, 9, 494, 238);
  if (!on) {
    g.fillStyle = 'rgba(122,96,42,.45)';
    g.font = 'italic 34px Georgia, serif';
    g.textAlign = 'center';
    g.fillText('(face down)', 256, 140);
  } else {
    g.textAlign = 'left';
    g.fillStyle = '#2E2618';
    g.font = '600 38px Georgia, serif';
    g.fillText(p[3].slice(0, 26), 32, 74);
    g.fillStyle = '#5C5240';
    g.font = '27px Georgia, serif';
    g.fillText((p[4] || 'Unknown').slice(0, 30), 32, 122);
    g.fillText(String(p[5] || ''), 32, 162);
    g.fillStyle = '#8A6A24';
    g.font = '600 22px Cinzel, Georgia, serif';
    g.fillText((p[6] + ' · WIKIMEDIA COMMONS').toUpperCase().slice(0, 40), 32, 212);
  }
  grainy(g, 512, 256, 12);
  f.card.material.map.needsUpdate = true;
  f.drawn = on;
}

/* ------------------------------------------------------------- walking */

let walking = false, wLastX = 0, grabbing = -1, gLastY = 0, gMoved = false;

function bindWalk() {
  stageEl.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.gal-btn') || e.target.closest('.held') ||
        e.target.closest('.room-out')) return;
    walking = true; wLastX = e.clientX;
    stageEl.classList.add('is-holding');
    if (stageEl.setPointerCapture) { try { stageEl.setPointerCapture(e.pointerId); } catch (err) {} }
  });
  window.addEventListener('pointermove', (e) => {
    if (grabbing >= 0) {
      const d = (e.clientY - gLastY) * 0.0034;
      gLastY = e.clientY;
      if (Math.abs(e.movementY || d) > 0) gMoved = true;
      st[grabbing].a = clamp(st[grabbing].a + d, -0.6, 0.6);
      return;
    }
    if (!walking) return;
    panT = clamp(panT - (e.clientX - wLastX) * 0.011, -limit(), limit());
    wLastX = e.clientX;
  }, { passive: true });
  const up = () => {
    if (grabbing >= 0) { const i = grabbing; grabbing = -1; spirit.visible = false; settle(i); }
    walking = false;
    stageEl.classList.remove('is-holding');
  };
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);

  stageEl.setAttribute('tabindex', '0');
  stageEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { panT = clamp(panT - 1.1, -limit(), limit()); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { panT = clamp(panT + 1.1, -limit(), limit()); e.preventDefault(); }
  });
}

function limit() { return ((PICS.length - 1) / 2) * SPACING + 0.9; }

/* ------------------------------------------------------------- each frame */

function frame(dt, t) {
  if (!scene) return;
  const still = Hotel.stillFrame;
  panX = still ? panT : damp(panX, panT, 0.0015, dt);
  camera.position.set(panX, EYE_Y, EYE_Z);
  camera.lookAt(panX, 1.72, WALL_Z);

  frames.forEach((f) => {
    const s = st[f.i];
    if (!s.fallen) {
      f.pivot.rotation.z = s.a;
      /* a picture on a nail swings a little when you let go */
      if (!still && s.v) {
        s.v -= s.a * 46 * dt;
        s.v *= Math.pow(0.05, dt);
        s.a += s.v * dt;
        if (Math.abs(s.v) < 0.004 && Math.abs(s.a) < 0.004) { s.v = 0; s.a = 0; }
      }
    }
    f.lamp.intensity = (s.level ? 5.6 : 2.9) * (finished ? 1.7 : 1);
  });

  if (grabbing >= 0 && spirit) {
    const f = frames[grabbing];
    const s = st[grabbing];
    spirit.visible = true;
    spirit.position.set(f.x - Math.sin(s.a) * (f.H / 2), f.y + f.H / 2 + 0.08, WALL_Z + 0.16);
    spirit.rotation.z = s.a;
    bubble.position.x = clamp(-s.a * 1.9, -0.05, 0.05);
    bubble.material.emissive.setHex(Math.abs(s.a) < TOL ? 0x9AD07A : 0x6E8A5A);
  }
  if (screen) screen.place();
}

/* ---------------------------------------------------------- straightening */

function nudge(i, d) {
  if (st[i].fallen) return false;
  st[i].a = clamp(st[i].a + d, -0.6, 0.6);
  st[i].v = 0;
  settle(i);
  return true;
}

function settle(i) {
  const s = st[i];
  if (s.fallen) return;
  if (Math.abs(s.a) > FALL) { dropIt(i); return; }
  if (Math.abs(s.a) > SWING) {
    /* too far: it swings back past the middle and stops on the other side */
    s.a = -s.a * 0.62;
    s.v = 0;
    if (Hotel.sound.isOn()) Hotel.sound.play('creak');
    Hotel.say('Too much. It has gone the other way now.', { for: 7000 });
    Hotel.announce('Overcorrected. It is crooked the other way.');
    refresh();
    return;
  }
  if (Math.abs(s.a) <= TOL) {
    if (!s.level) {
      s.level = true;
      s.a = 0; s.v = 0;
      drawCard(i, true);
      if (Hotel.sound.isOn()) Hotel.sound.play('hum');
      showCard(i);
      refresh();
      if (countLevel() >= PICS.length && !finished) finish();
    } else { s.a = 0; }
    return;
  }
  if (s.level) { s.level = false; drawCard(i, false); refresh(); }
  s.v = -s.a * 1.4;          /* let it swing */
}

function dropIt(i, quiet) {
  const s = st[i], f = frames[i];
  s.fallen = true; s.level = false; s.a = 0; s.v = 0;
  if (f) {
    drawCard(i, false);
    if (window.gsap && !Hotel.stillFrame && !quiet) {
      /* it ends up leaning against the skirting, on its side, not gone */
      window.gsap.to(f.pivot.position, { y: -(f.y - 0.30), z: 0.34, duration: 0.5, ease: 'power2.in' });
      window.gsap.to(f.pivot.rotation, { z: 1.42, duration: 0.6, ease: 'power2.in' });
    } else {
      f.pivot.position.y = -(f.y - 0.30);
      f.pivot.position.z = 0.34;
      f.pivot.rotation.z = 1.42;
    }
  }
  if (!quiet) {
    if (Hotel.sound.isOn()) { Hotel.sound.play('clunk'); Hotel.sound.play('rustle'); }
    Hotel.say('Off the nail. It is on the floor. The glass held, which is something.', { for: 10000 });
    Hotel.announce('The picture has come off the wall. Hang it back up.');
  }
  showFallen(i);
  refresh();
}

function hangBack(i) {
  const s = st[i], f = frames[i];
  s.fallen = false;
  s.a = 0.085;                 /* back up, and still not straight */
  s.v = 0;
  if (f) {
    if (window.gsap && !Hotel.stillFrame) {
      window.gsap.to(f.pivot.position, { y: 0, z: 0, duration: 0.5, ease: 'power3.out' });
      window.gsap.to(f.pivot.rotation, { z: s.a, duration: 0.5, ease: 'power3.out' });
    } else { f.pivot.position.set(0, 0, 0); f.pivot.rotation.z = s.a; }
  }
  if (Hotel.sound.isOn()) Hotel.sound.play('thump');
  heldAct.hidden = true;
  heldEl.hidden = true;
  Hotel.say('Back up. Still not straight, but back up.', { for: 7000 });
  refresh();
}

/* ------------------------------------------------------------------- DOM */

function wire() {
  document.querySelectorAll('.gal-btn').forEach((b) => {
    const i = idx(b.dataset.obj);
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('pointerdown', (e) => {
      if (st[i].fallen) return;
      grabbing = i; gLastY = e.clientY; gMoved = false;
      st[i].v = 0;
      if (b.setPointerCapture) { try { b.setPointerCapture(e.pointerId); } catch (err) {} }
    });
    b.addEventListener('click', () => {
      if (st[i].fallen) { showFallen(i); return; }
      if (!gMoved) { if (st[i].level) showCard(i); else nudge(i, -st[i].a * 0.55); }
    });
    b.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 0.004 : 0.012;
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { nudge(i, -step); e.preventDefault(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { nudge(i, step); e.preventDefault(); }
    });
  });
  heldBack.addEventListener('click', () => { heldEl.hidden = true; });
  heldAct.addEventListener('click', () => {
    const i = Number(heldAct.dataset.i);
    if (!isNaN(i)) hangBack(i);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !heldEl.hidden) heldEl.hidden = true;
  });
}

function showCard(i) {
  const p = PICS[i];
  shown = i;
  heldEl.hidden = false;
  heldKick.textContent = 'Hanging true';
  heldName.textContent = p[3];
  heldTag.textContent = (p[4] || 'Unknown') + (p[5] ? ', ' + p[5] : '') + '. ' +
    p[6] + ', from Wikimedia Commons.';
  heldAct.hidden = true;
  Hotel.announce(p[3] + '. ' + (p[4] || 'Unknown') + '. ' + (p[5] || '') + '. ' + p[6] + '.');
  document.querySelectorAll('.gal-btn').forEach((b) => {
    b.setAttribute('aria-pressed', String(idx(b.dataset.obj) === i));
  });
}

function showFallen(i) {
  heldEl.hidden = false;
  heldKick.textContent = 'On the floor';
  heldName.textContent = PICS[i][3];
  heldTag.textContent = 'It came off its nail. Nothing is broken.';
  heldAct.hidden = false;
  heldAct.textContent = 'Hang it back up';
  heldAct.dataset.i = String(i);
}

function refresh() {
  if (countEl) countEl.textContent = String(countLevel());
  document.querySelectorAll('.gal-btn').forEach((b) => {
    const i = idx(b.dataset.obj);
    b.classList.toggle('is-done', st[i].level);
    b.classList.toggle('is-wanted', st[i].fallen);
  });
}

function finish() {
  finished = true;
  Hotel.addFound('backlabel');
  const f = Hotel.FINDS.backlabel;
  Hotel.say('Eighteen out of eighteen. The lights come up, and there is something stuck to the back of the last one.',
    { for: 15000 });
  if (Hotel.sound.isOn()) Hotel.sound.play('ding');
  heldEl.hidden = false;
  heldKick.textContent = 'Eighteen of eighteen';
  heldName.textContent = f.title;
  heldTag.textContent = 'In your passport. Wikimedia Commons, credited in full.';
  heldAct.hidden = true;
  document.documentElement.classList.add('gallery-all-level');
  if (hintEl) { hintEl.textContent = 'All level.'; hintEl.style.opacity = '0'; }
}
