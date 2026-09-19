/* ==========================================================================
   room-book.js - 214, Tino's Black Book.

   A worn leather notebook lying open on a desk under a brass lamp.  Take the
   corner of the right-hand page and drag it across: the paper bends, it
   rustles, and it falls over on to the other side.  Arrow keys do the same.

   EVERY PAGE IS EMPTY ON PURPOSE.  Each one has a heading, a ruled blank
   area, a DRAFT: TINO TO WRITE stamp, and one line saying what belongs
   there.  The prompts echo the brief - the bakery in the middle of the
   island, the eight-person place in the Gothic Quarter - but not one name,
   address, price or recommendation is invented to fill them in, because the
   whole point of the room is that this is Tino's to write.

   Three things are tucked between the pages and can be pulled out and kept:
   a public-domain luggage label somebody used as a bookmark, a pressed
   flower and half a ticket, both drawn here.

   Wrong move: flick the page over instead of turning it and it tears a
   little.  It comes back taped.
   ========================================================================== */

import * as THREE from './vendor/three.module.min.js';
import { getStage } from './gl.js';
import { cnv, grainy, canvasTex, loadTex, paperGround, clamp, damp, wrapText, Screen }
  from './roomkit.js';

const Hotel = window.Hotel;
const HOOKS = new URLSearchParams(location.search);
const PAGE_HOOK = HOOKS.get('page');
const TURN_HOOK = HOOKS.get('turn');        /* ?turn=0.5 holds a page half over */
const TORN_HOOK = HOOKS.get('torn');        /* ?torn=2 */

/* ------------------------------------------------------------- the pages
   Headings and prompts only.  The hotel is asking; Tino answers. */

const PAGES = [
  { head: 'Krabi', sub: 'Thailand',
    ask: 'Which boatman, which beach, and the hour of the day it is worth being there.' },
  { head: 'Phuket', sub: 'Thailand',
    ask: 'The street to be on when the rain starts, and where to sit it out.' },
  { head: 'Bangkok', sub: 'Thailand',
    ask: 'The stall, the dish, and the one thing you have to say to order it.' },
  { head: 'Tokyo', sub: 'Japan',
    ask: 'The door nobody would open on their own: how you know it, and who to ask for.' },
  { head: 'Mykonos', sub: 'Greece',
    ask: 'The bakery in the middle of the island: the name, what to order, and what time it shuts.' },
  { head: 'Barcelona', sub: 'Spain',
    ask: 'The eight-person place in the Gothic Quarter: which floor, whose kitchen, and how far ahead you have to ask.' },
  { head: 'Who to ring', sub: 'When it goes wrong',
    ask: 'A name and a number in each place, and what each of them is actually good at.' },
  { head: 'Never again', sub: 'The list nobody puts on a website',
    ask: 'The things you would not put anybody through twice, and why.' },
  { head: 'The rest of it', sub: 'Everywhere this site has not got to yet',
    ask: 'Whatever else is in your head. This book has more pages than the site has places.' }
];

/* what is tucked where */
const EPHEMERA = [
  { id: 'eph-label', page: 1, find: 'bookmark', kind: 'label',
    name: 'A luggage label, pressed flat',
    line: 'Somebody used it as a bookmark and never came back for it.' },
  { id: 'eph-flower', page: 4, find: 'flower', kind: 'flower',
    name: 'A flower, pressed between two pages',
    line: 'Flat, brown, and still faintly a flower.' },
  { id: 'eph-stub', page: 6, find: 'stub', kind: 'stub',
    name: 'A ticket stub, torn in half',
    line: 'The half that gets you in is not this one.' }
];

/* ------------------------------------------------------------------ state */

let page = 0;                       /* which spread: left = page, right = page+1 */
let turning = null;                 /* { dir, k } while a page is over */
let torn = {};                      /* page index -> true */
let taken = {};
let finished = false;

const stageEl = document.getElementById('roomStage');
const heldEl = document.getElementById('held');
const heldKick = document.getElementById('heldKick');
const heldName = document.getElementById('heldName');
const heldTag = document.getElementById('heldTag');
const heldAct = document.getElementById('heldAct');
const heldBack = document.getElementById('heldBack');
const numEl = document.getElementById('bkNum');
const totEl = document.getElementById('bkTot');
const hintEl = document.getElementById('roomHint');
const bookFlat = document.getElementById('bookFlat');
const bfLeft = document.getElementById('bfLeft');
const bfRight = document.getElementById('bfRight');

/* =================================================================== boot */

Hotel.ready(async () => {
  if (!Hotel.gateRoom('black-book', { originX: 0.5, originY: 0.5 })) return;
  Hotel.say('214. The book he actually writes in, and it is empty. That is the point of it.',
    { for: 13000 });
  if (totEl) totEl.textContent = String(PAGES.length);
  if (PAGE_HOOK) page = clamp(parseInt(PAGE_HOOK, 10) || 0, 0, PAGES.length - 2);
  if (TORN_HOOK) torn[parseInt(TORN_HOOK, 10) || 0] = true;
  wire();

  if (Hotel.mode() !== 'full') { flatMode(); return; }
  let stage = null;
  try { stage = await getStage(); } catch (e) { stage = null; }
  if (!stage) { flatMode(); return; }
  try { build3d(stage); } catch (e) { console.error(e); flatMode(); }
});

/* ------------------------------------------------------------- flat mode */

function flatMode() {
  document.documentElement.classList.add('room-flatmode');
  if (hintEl) hintEl.textContent = 'Turn the page. Two turns in a rush and one of them tears.';
  bookFlat.hidden = false;
  paintFlat();
  refresh();
}

function pageHTML(i) {
  if (i < 0 || i >= PAGES.length) return '<p class="bf-blank">(the inside of the cover)</p>';
  const p = PAGES[i];
  return '<h2 class="bf-head">' + p.head + '</h2>' +
    '<p class="bf-sub">' + p.sub + '</p>' +
    (torn[i] ? '<p class="bf-tape">taped</p>' : '') +
    '<p class="bf-stamp">Draft: Tino to write</p>' +
    '<p class="bf-ask">' + p.ask + '</p>' +
    '<div class="bf-rules" aria-hidden="true"></div>';
}

function paintFlat() {
  if (!bookFlat || bookFlat.hidden) return;
  bfLeft.innerHTML = pageHTML(page);
  bfRight.innerHTML = pageHTML(page + 1);
}

/* ============================================================== the scene */

let scene, camera, view, screen, book, leftMesh, rightMesh, flipMesh, flipTex;
let leftTex, rightTex, ephObjs = {};
const BOOK_W = 0.66, BOOK_H = 0.86;

function build3d(stage) {
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x070F0B, 2.2, 6.2);
  camera = new THREE.PerspectiveCamera(42, 1.7, 0.02, 20);
  camera.position.set(0, 1.52, 1.52);
  camera.lookAt(0, 0.80, -0.10);

  /* the room behind, barely there */
  const back = new THREE.Mesh(new THREE.PlaneGeometry(9, 5),
    new THREE.MeshStandardMaterial({ color: 0x0C1E16, roughness: 1 }));
  back.position.set(0, 1.6, -2.1);
  scene.add(back);

  /* the desk */
  const desk = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 1.5),
    new THREE.MeshStandardMaterial({ map: texLeather(0x4A3218), roughness: 0.68 }));
  desk.position.set(0, 0.74, -0.15);
  scene.add(desk);
  [[-1.3, -0.75], [1.3, -0.75]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.72, 10),
      new THREE.MeshStandardMaterial({ color: 0x2E2012, roughness: 0.9 }));
    leg.position.set(x, 0.36, z);
    scene.add(leg);
  });

  /* the lamp */
  const brass = new THREE.MeshStandardMaterial({ color: 0xB08A2E, roughness: 0.28, metalness: 0.88 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.03, 18), brass);
  base.position.set(0.82, 0.795, -0.36); scene.add(base);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.44, 10), brass);
  stem.position.set(0.82, 1.02, -0.36); scene.add(stem);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.15, 0.13, 20, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x2C6A4E, roughness: 0.6,
      side: THREE.DoubleSide, emissive: new THREE.Color(0xFFD79A), emissiveIntensity: 0.18 }));
  shade.position.set(0.82, 1.23, -0.36); scene.add(shade);
  const bulb = new THREE.PointLight(0xFFD79A, 2.1, 4.2, 1.6);
  bulb.position.set(0.66, 1.20, -0.20);
  scene.add(bulb);
  /* a second, softer light over the left page, so one half is not in shadow
     while the other is blown out */
  const fill = new THREE.PointLight(0xFFE0B0, 1.05, 3.2, 1.7);
  fill.position.set(-0.62, 1.22, 0.34);
  scene.add(fill);
  scene.add(new THREE.AmbientLight(0x35453C, 0.62));
  scene.add(new THREE.HemisphereLight(0xC9A227, 0x0A1712, 0.26));

  /* --- the book ----------------------------------------------------------- */
  book = new THREE.Group();
  book.position.set(0, 0.79, -0.10);
  book.rotation.x = -Math.PI / 2;
  book.rotation.z = 0.0;
  scene.add(book);

  const leather = new THREE.MeshStandardMaterial({ map: texLeather(0x211A12), roughness: 0.8 });
  const cover = new THREE.Mesh(new THREE.BoxGeometry(BOOK_W * 2 + 0.06, BOOK_H + 0.05, 0.035), leather);
  cover.position.z = -0.02;
  book.add(cover);
  const block = new THREE.Mesh(new THREE.BoxGeometry(BOOK_W * 2 - 0.01, BOOK_H - 0.01, 0.022),
    new THREE.MeshStandardMaterial({ color: 0xE3D8BA, roughness: 0.95 }));
  block.position.z = 0.002;
  book.add(block);
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.035, BOOK_H + 0.05, 0.05), leather);
  spine.position.z = -0.01;
  book.add(spine);

  leftTex = makePageTex();
  rightTex = makePageTex();
  flipTex = makePageTex();

  leftMesh = new THREE.Mesh(new THREE.PlaneGeometry(BOOK_W, BOOK_H),
    new THREE.MeshStandardMaterial({ map: leftTex.tex, roughness: 0.96 }));
  leftMesh.position.set(-BOOK_W / 2 - 0.006, 0, 0.016);
  book.add(leftMesh);
  rightMesh = new THREE.Mesh(new THREE.PlaneGeometry(BOOK_W, BOOK_H),
    new THREE.MeshStandardMaterial({ map: rightTex.tex, roughness: 0.96 }));
  rightMesh.position.set(BOOK_W / 2 + 0.006, 0, 0.016);
  book.add(rightMesh);

  /* the page that is over: its pivot is the spine, and only the pivot turns */
  const flipPivot = new THREE.Group();
  flipPivot.position.set(0.006, 0, 0.018);
  book.add(flipPivot);
  const geo = new THREE.PlaneGeometry(BOOK_W, BOOK_H, 18, 2);
  geo.translate(BOOK_W / 2, 0, 0);
  flipMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: flipTex.tex, roughness: 0.96, side: THREE.DoubleSide }));
  flipPivot.add(flipMesh);
  flipPivot.visible = false;
  book.userData.flipPivot = flipPivot;
  book.userData.flat = geo.attributes.position.array.slice();

  /* --- the ephemera, tucked in at the fore edge --------------------------- */
  EPHEMERA.forEach((e, i) => {
    const g = new THREE.Group();
    g.position.set(BOOK_W * 0.72, 0.14 - i * 0.20, 0.028);
    g.rotation.z = -0.12 + i * 0.09;
    book.add(g);
    let m;
    if (e.kind === 'label') {
      m = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.145),
        new THREE.MeshStandardMaterial({ map: loadTex('img/reward-label-03.jpg'), roughness: 0.94 }));
    } else if (e.kind === 'flower') {
      m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16),
        new THREE.MeshStandardMaterial({ map: texFlower(), roughness: 0.98, transparent: true }));
    } else {
      m = new THREE.Mesh(new THREE.PlaneGeometry(0.20, 0.09),
        new THREE.MeshStandardMaterial({ map: texStub(), roughness: 0.95, transparent: true }));
    }
    g.add(m);
    ephObjs[e.id] = { def: e, group: g, mesh: m };
    if (Hotel.carrying(e.find)) { g.visible = false; taken[e.id] = true; }
  });

  screen = new Screen(camera, scene, stageEl, { occluders: [] });
  EPHEMERA.forEach((e) => screen.add({ id: e.id, obj: ephObjs[e.id].group, radius: 0.08 }));

  view = stage.addView({
    el: stageEl, scene, camera,
    resize(w, h) {
      const a = w / Math.max(1, h);
      camera.aspect = a;
      camera.fov = a < 0.95 ? 66 : (a < 1.3 ? 52 : 42);
      camera.updateProjectionMatrix();
      camera.position.set(0, a < 0.95 ? 1.58 : 1.52, a < 0.95 ? 1.62 : 1.52);
      camera.lookAt(0, 0.80, -0.10);
    },
    onFrame(dt, t) { frame(dt, t); }
  });

  bindDrag();
  document.documentElement.classList.add('room-3d');
  paint();
  if (TURN_HOOK) { turning = { dir: 1, k: parseFloat(TURN_HOOK) || 0.5, held: true }; }
  refresh();
  frame(0, 0);

  window.RoomBook = {
    ids: EPHEMERA.map((e) => e.id),
    bounds: (id) => screen.bounds(id),
    state: () => ({ page, turning: turning ? +turning.k.toFixed(2) : null,
      torn: Object.keys(torn).map(Number), taken: Object.keys(taken), finished }),
    turn: (d) => startTurn(d, true),
    take: (id) => takeIt(id)
  };
}

/* --------------------------------------------------------------- textures */

function texLeather(hex) {
  const [c, g] = cnv(512, 512);
  const col = '#' + hex.toString(16).padStart(6, '0');
  g.fillStyle = col; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = Math.random() > 0.5 ? 'rgba(255,240,210,.035)' : 'rgba(0,0,0,.06)';
    g.beginPath();
    g.ellipse(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 5,
      1 + Math.random() * 3, Math.random() * 3, 0, 6.2832);
    g.fill();
  }
  grainy(g, 512, 512, 18);
  return canvasTex(c, { repeat: [1, 1] });
}

/** One page: heading, rules, the stamp, and the line asking for the entry. */
function makePageTex() {
  const [c, g] = cnv(640, 820);
  const t = canvasTex(c);
  return { c, g, tex: t };
}

function paintPage(pg, i) {
  const { c, g, tex } = pg;
  const W = 640, H = 820;
  paperGround(g, W, H, i % 2 ? '#EFE6D0' : '#EDE3CB');
  if (i < 0 || i >= PAGES.length) {
    g.fillStyle = 'rgba(90,74,42,.35)';
    g.font = 'italic 30px Georgia, serif';
    g.textAlign = 'center';
    g.fillText('(the inside of the cover)', W / 2, H / 2);
    tex.needsUpdate = true;
    return;
  }
  const p = PAGES[i];

  /* the ruled area: this is the part that stays empty */
  g.strokeStyle = 'rgba(120,100,60,.32)';
  g.lineWidth = 1.6;
  for (let y = 300; y < H - 60; y += 44) {
    g.beginPath(); g.moveTo(58, y); g.lineTo(W - 58, y); g.stroke();
  }
  g.strokeStyle = 'rgba(160,60,60,.30)';
  g.beginPath(); g.moveTo(96, 46); g.lineTo(96, H - 46); g.stroke();

  g.textAlign = 'left';
  g.fillStyle = '#2E2618';
  g.font = '600 58px Georgia, serif';
  g.fillText(p.head, 116, 118);
  g.fillStyle = '#8A6A24';
  g.font = '600 22px Cinzel, Georgia, serif';
  g.fillText(p.sub.toUpperCase(), 118, 154);

  g.fillStyle = '#5C5240';
  g.font = 'italic 26px Georgia, serif';
  wrapText(g, p.ask, 116, 205, W - 180, 34);

  /* the stamp, pressed on at an angle */
  g.save();
  g.translate(W - 190, 300);
  g.rotate(-0.12);
  g.strokeStyle = 'rgba(122,35,64,.75)';
  g.lineWidth = 4;
  g.setLineDash([16, 3]);
  g.strokeRect(-110, -34, 220, 68);
  g.setLineDash([]);
  g.fillStyle = 'rgba(122,35,64,.8)';
  g.font = '600 21px Cinzel, Georgia, serif';
  g.textAlign = 'center';
  g.fillText('DRAFT', 0, -6);
  g.font = '600 15px Cinzel, Georgia, serif';
  g.fillText('TINO TO WRITE', 0, 20);
  g.restore();

  /* a tear, and the tape that holds it together next time */
  if (torn[i]) {
    g.strokeStyle = 'rgba(120,96,50,.7)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(W - 20, 520);
    g.lineTo(W - 90, 562); g.lineTo(W - 44, 602); g.lineTo(W - 120, 648);
    g.stroke();
    g.save();
    g.translate(W - 82, 585); g.rotate(0.55);
    g.fillStyle = 'rgba(226,212,168,.72)';
    g.fillRect(-16, -56, 32, 112);
    g.strokeStyle = 'rgba(160,140,90,.55)'; g.lineWidth = 2;
    g.strokeRect(-16, -56, 32, 112);
    g.restore();
  }
  grainy(g, W, H, 10);
  tex.needsUpdate = true;
}

function texFlower() {
  const [c, g] = cnv(256, 256);
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(88,74,38,.9)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(128, 240); g.quadraticCurveTo(140, 180, 128, 130); g.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    g.save();
    g.translate(128, 112);
    g.rotate(a);
    g.fillStyle = i % 2 ? 'rgba(150,104,84,.85)' : 'rgba(168,124,92,.8)';
    g.beginPath(); g.ellipse(0, -38, 15, 36, 0, 0, 6.2832); g.fill();
    g.strokeStyle = 'rgba(96,66,38,.7)'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(0, -38, 15, 36, 0, 0, 6.2832); g.stroke();
    g.restore();
  }
  g.fillStyle = 'rgba(120,92,40,.95)';
  g.beginPath(); g.arc(128, 112, 15, 0, 6.2832); g.fill();
  [[-1, 170], [1, 186]].forEach(([s, y]) => {
    g.fillStyle = 'rgba(96,110,62,.8)';
    g.save(); g.translate(128, y); g.rotate(s * 0.7);
    g.beginPath(); g.ellipse(s * 22, 0, 24, 9, 0, 0, 6.2832); g.fill();
    g.restore();
  });
  return canvasTex(c);
}

function texStub() {
  const [c, g] = cnv(320, 150);
  g.clearRect(0, 0, 320, 150);
  g.fillStyle = '#E6D3A4';
  g.beginPath();
  g.moveTo(0, 0); g.lineTo(276, 0);
  for (let y = 6; y < 150; y += 12) g.lineTo(y % 24 ? 288 : 268, y);
  g.lineTo(276, 150); g.lineTo(0, 150);
  g.closePath(); g.fill();
  g.strokeStyle = '#8A2E2E'; g.lineWidth = 4; g.stroke();
  g.fillStyle = '#5E4A20';
  g.font = '600 26px Cinzel, Georgia, serif';
  g.fillText('ADMIT ONE', 22, 52);
  g.font = '20px Georgia, serif';
  g.fillStyle = '#3A3226';
  g.fillText('no date, no row', 22, 88);
  g.fillText('no seat', 22, 118);
  g.strokeStyle = 'rgba(58,44,20,.35)'; g.lineWidth = 2;
  g.setLineDash([5, 5]);
  g.beginPath(); g.moveTo(236, 6); g.lineTo(236, 144); g.stroke();
  g.setLineDash([]);
  grainy(g, 320, 150, 12);
  return canvasTex(c);
}

/* -------------------------------------------------------------- painting */

function paint() {
  if (!leftTex) { paintFlat(); return; }
  paintPage(leftTex, page);
  paintPage(rightTex, page + 1);
  EPHEMERA.forEach((e) => {
    const o = ephObjs[e.id];
    if (!o) return;
    o.group.visible = !taken[e.id] && (e.page === page || e.page === page + 1);
    const it = screen && screen.items.filter((x) => x.id === e.id)[0];
    if (it) it.hidden = !o.group.visible;
  });
  paintFlat();
}

/* ---------------------------------------------------------- turning pages */

let lastTurnAt = 0;

function startTurn(dir, instant) {
  if (turning) return false;
  if (dir > 0 && page + 2 > PAGES.length) return false;
  if (dir < 0 && page - 2 < -1) return false;

  const now = performance.now();
  const hurried = now - lastTurnAt < 420 && lastTurnAt > 0;
  lastTurnAt = now;

  const i = dir > 0 ? page + 1 : page;
  if (hurried && !torn[i] && i >= 0 && i < PAGES.length) {
    torn[i] = true;
    if (Hotel.sound.isOn()) Hotel.sound.play('rustle');
    Hotel.say('That one tore. Not badly. There is tape in the drawer, and somebody has clearly used it before.',
      { for: 10000 });
    Hotel.announce('A page has torn a little. It will come back taped.');
  }

  if (flipTex) paintPage(flipTex, dir > 0 ? page + 1 : page - 1);
  turning = { dir, k: 0, v: instant ? 6 : 3.2 };
  if (book) book.userData.flipPivot.visible = true;
  if (Hotel.sound.isOn()) Hotel.sound.play('rustle');
  if (Hotel.stillFrame || instant) { finishTurn(); }
  return true;
}

function finishTurn() {
  const dir = turning ? turning.dir : 1;
  turning = null;
  if (book) book.userData.flipPivot.visible = false;
  page = clamp(page + dir * 2, -1, PAGES.length - 1);
  paint();
  refresh();
  const p = PAGES[page] || PAGES[page + 1];
  if (p) Hotel.announce('Page ' + (page + 1) + '. ' + p.head + '. ' + p.ask);
}

/** Bend the turning page: paper does not fold flat, it bows. */
function bendPage(k) {
  if (!flipMesh) return;
  const pos = flipMesh.geometry.attributes.position;
  const flat = book.userData.flat;
  const bow = Math.sin(k * Math.PI) * 0.16;
  for (let i = 0; i < pos.count; i++) {
    const x = flat[i * 3], y = flat[i * 3 + 1];
    const u = clamp(x / BOOK_W, 0, 1);
    pos.setXYZ(i, x, y, Math.sin(u * Math.PI) * bow * (1 - Math.abs(y) / BOOK_H * 0.5));
  }
  pos.needsUpdate = true;
  flipMesh.geometry.computeVertexNormals();
}

function bindDrag() {
  let grab = false, x0 = 0, t0 = 0;
  stageEl.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.lost-btn') || e.target.closest('.held') ||
        e.target.closest('.book-nav') || e.target.closest('.room-out')) return;
    grab = true; x0 = e.clientX; t0 = performance.now();
    stageEl.classList.add('is-holding');
    if (stageEl.setPointerCapture) { try { stageEl.setPointerCapture(e.pointerId); } catch (err) {} }
  });
  window.addEventListener('pointermove', (e) => {
    if (!grab) return;
    const d = (x0 - e.clientX) / Math.max(120, stageEl.clientWidth * 0.32);
    if (!turning && Math.abs(d) > 0.05) startTurnHeld(d > 0 ? 1 : -1);
    if (turning && turning.held) turning.k = clamp(Math.abs(d), 0, 1);
  }, { passive: true });
  const up = () => {
    if (!grab) return;
    grab = false;
    stageEl.classList.remove('is-holding');
    if (turning && turning.held) {
      const quick = performance.now() - t0 < 260;
      if (turning.k > 0.42 || quick) {
        if (quick) {
          const i = turning.dir > 0 ? page + 1 : page;
          if (!torn[i] && i >= 0 && i < PAGES.length) {
            torn[i] = true;
            Hotel.say('Flicked. It tore a little. Tape, again.', { for: 9000 });
            Hotel.announce('A page has torn a little. It will come back taped.');
          }
        }
        turning.held = false; turning.v = 3.4;
      } else {
        turning.held = false; turning.v = -3.4;       /* it falls back */
      }
    }
  };
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);

  stageEl.setAttribute('tabindex', '0');
  stageEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { startTurn(1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { startTurn(-1); e.preventDefault(); }
  });
}

function startTurnHeld(dir) {
  if (turning) return;
  if (dir > 0 && page + 2 > PAGES.length) return;
  if (dir < 0 && page - 2 < -1) return;
  if (flipTex) paintPage(flipTex, dir > 0 ? page + 1 : page - 1);
  turning = { dir, k: 0, v: 0, held: true };
  if (book) book.userData.flipPivot.visible = true;
  if (Hotel.sound.isOn()) Hotel.sound.play('rustle');
}

/* ------------------------------------------------------------- each frame */

function frame(dt, t) {
  if (!book) return;
  const pivot = book.userData.flipPivot;
  if (turning) {
    if (!turning.held && !Hotel.stillFrame) turning.k += turning.v * dt;
    if (turning.k >= 1) { turning.k = 1; finishTurn(); }
    else if (turning.k < 0) { turning.k = 0; turning = null; pivot.visible = false; }
    else {
      pivot.visible = true;
      const dir = turning.dir;
      pivot.rotation.y = dir > 0 ? -turning.k * Math.PI : Math.PI - turning.k * Math.PI;
      pivot.scale.x = dir > 0 ? 1 : -1;
      bendPage(turning.k);
    }
  }
  if (screen) screen.place();
}

/* ------------------------------------------------------------- ephemera */

function wire() {
  document.querySelectorAll('.lost-btn').forEach((b) => {
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => pickUp(b.dataset.obj));
  });
  document.getElementById('pageNext').addEventListener('click', () => startTurn(1));
  document.getElementById('pagePrev').addEventListener('click', () => startTurn(-1));
  heldBack.addEventListener('click', () => { heldEl.hidden = true; });
  heldAct.addEventListener('click', () => takeIt(heldAct.dataset.obj));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !heldEl.hidden) heldEl.hidden = true;
  });
}

function pickUp(id) {
  const e = EPHEMERA.filter((x) => x.id === id)[0];
  if (!e) return;
  heldEl.hidden = false;
  heldKick.textContent = 'Tucked between the pages';
  heldName.textContent = e.name;
  heldTag.textContent = e.line;
  heldAct.hidden = !!taken[id] || Hotel.carrying(e.find);
  heldAct.textContent = 'Keep it';
  heldAct.dataset.obj = id;
  Hotel.announce(e.name + '. ' + e.line);
  document.querySelectorAll('.lost-btn').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.obj === id));
  });
}

function takeIt(id) {
  const e = EPHEMERA.filter((x) => x.id === id)[0];
  if (!e) return false;
  Hotel.addFound(e.find);
  taken[id] = true;
  heldAct.hidden = true;
  if (ephObjs[id]) ephObjs[id].group.visible = false;
  if (Hotel.sound.isOn()) Hotel.sound.play('rustle');
  Hotel.say('In your passport. He will not miss it; he did not know it was in there.', { for: 10000 });
  paint();
  refresh();
  if (EPHEMERA.every((x) => taken[x.id]) && !finished) finish();
  return true;
}

function refresh() {
  if (numEl) numEl.textContent = String(clamp(page + 1, 1, PAGES.length));
  document.querySelectorAll('.lost-btn').forEach((b) => {
    b.classList.toggle('is-done', !!taken[b.dataset.obj]);
  });
  const prev = document.getElementById('pagePrev');
  const next = document.getElementById('pageNext');
  if (prev) prev.disabled = page <= -1;
  if (next) next.disabled = page + 2 > PAGES.length;
}

function finish() {
  finished = true;
  Hotel.say('All three out of the book, and the book itself still empty. Over to him.',
    { for: 14000 });
  if (Hotel.sound.isOn()) Hotel.sound.play('ding');
  heldEl.hidden = false;
  heldKick.textContent = 'Three of three';
  heldName.textContent = 'Everything that was in the book';
  heldTag.textContent = 'A label, a flower and half a ticket, all in your passport. The pages are still Tino’s to fill.';
  heldAct.hidden = true;
  document.documentElement.classList.add('book-all-found');
}
