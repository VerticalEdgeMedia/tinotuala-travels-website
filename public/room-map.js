/* ==========================================================================
   room-map.js - 118, The Map Room.

   A dim panelled room with a big globe on a brass tripod, lit by a paper-fire
   sconce on the wall.  Drag the globe and it spins, with weight: it keeps
   going, it slows down, and it ticks as each meridian passes the front.

   Six brass pins stand in it, one for each place on this site, at their real
   coordinates.  Press one and the globe turns that place to the front and a
   card unfolds with the site's own line about it and its photographs.  Visit
   all six and a thin gold great-circle arc joins them in the order you went,
   and something falls out of the map drawer.

   Wrong move: give it a proper shove and the whole thing wobbles on its
   stand, the pins rattle, and the concierge has a view about it.

   THE GLOBE'S TEXTURE IS DRAWN HERE, on a 2D canvas, from a coarse outline of
   the continents written out below in degrees.  It is deliberately a
   hand-drawn approximation in the hotel's palette - parchment oceans, green
   gold land, an engraved graticule - and not a traced map, so there is no
   third-party artwork in it to licence.  The six pins sit at their real
   latitudes and longitudes on top of it.

   The flat version has the same six buttons and the same card.
   ========================================================================== */

import * as THREE from './vendor/three.module.min.js';
import { getStage } from './gl.js';
import { makeFireMaterial } from './fire.js';
import { cnv, grainy, canvasTex, goldGrad, clamp, damp, Screen } from './roomkit.js';

const Hotel = window.Hotel;
const HOOKS = new URLSearchParams(location.search);
const PIN_HOOK = HOOKS.get('pin');            /* ?pin=tokyo */
const SEEN_HOOK = HOOKS.get('seen');          /* ?seen=all or ?seen=3 */
const SPIN_HOOK = HOOKS.get('spin') === 'hard';

/* -------------------------------------------------------------- the places
   The lines are the site's own copy, word for word off the home page.  They
   are draft copy about a place, not a promise and not a description of any
   real trip.  The photographs are the site's stand-in photographs. */

const PLACES = [
  { id: 'krabi', name: 'Krabi', lon: 98.91, lat: 8.09, coord: '8.1 N, 98.9 E',
    line: 'The engine cuts and the longtail slides onto the sand. For about a minute the loudest thing in Thailand is water coming off a cliff.',
    pics: [
      ['hero-krabi-longtail.jpg', 2200, 1466, 'Railay, Krabi Province', 'A wooden longtail boat moored on pale sand at Railay in Krabi, a limestone cliff rising out of turquoise water behind it.'],
      ['krabi-railay-cliff.jpg', 1124, 1500, 'Railay West Beach, Krabi', 'A huge limestone cliff above Railay West Beach at golden hour, longtail boats drawn up on the sand below.'],
      ['krabi-phiphi-prows.jpg', 1600, 985, 'Longtail prows, Ko Phi Phi', 'Carved longtail boat prows strung with coloured ribbons resting in shallow green water below jungle cliffs.']
    ] },
  { id: 'phuket', name: 'Phuket', lon: 98.39, lat: 7.88, coord: '7.9 N, 98.4 E',
    line: 'Shophouse pink, a cold drink, the afternoon rain arriving sideways. Nobody moves, and nobody minds.',
    pics: [
      ['phuket-soi-rommanee.jpg', 1400, 1050, 'Soi Rommanee, Phuket Old Town', 'A narrow street of pink and yellow Sino-Portuguese shophouses in Phuket Old Town, red lanterns strung overhead after rain.'],
      ['phuket-banana-beach-dusk.jpg', 1500, 843, 'Banana Beach, Phuket', 'A quiet curve of sand at Banana Beach in Phuket, a headland dark against a pale dusk sky.']
    ] },
  { id: 'bangkok', name: 'Bangkok', lon: 100.50, lat: 13.76, coord: '13.8 N, 100.5 E',
    line: 'Flame at head height, a plastic stool at knee height. You point at something, eat it, then point at it again.',
    pics: [
      ['bangkok-street-food-wok.jpg', 1600, 1067, 'Street kitchen, Bangkok', 'A street cook tossing a wok over a tall orange flame at a Bangkok food stall at night.'],
      ['bangkok-yaowarat-neon.jpg', 1400, 933, 'Yaowarat Road, Bangkok', 'Yaowarat Road in Bangkok seen from above at night, lanes of traffic between tall neon signs.'],
      ['bangkok-wat-arun-sunset.jpg', 1600, 1066, 'Wat Arun and the Chao Phraya', 'The spires of Wat Arun silhouetted against an orange sunset over the Chao Phraya, a long rowing barge crossing the water.'],
      ['bangkok-tuktuk.jpg', 1400, 942, 'Bangkok', 'A teal tuk-tuk moving down an empty Bangkok street, the driver leaning into the turn.']
    ] },
  { id: 'tokyo', name: 'Tokyo', lon: 139.65, lat: 35.68, coord: '35.7 N, 139.7 E',
    line: 'Six seats, one chef, a door you would have walked straight past. Two hours later you know everyone’s name.',
    pics: [
      ['tokyo-golden-gai-alley.jpg', 1500, 1000, 'Golden Gai, Shinjuku', 'A narrow Golden Gai alley in Shinjuku at night, hung with small hand-painted signs and lit by a line of paper lamps.'],
      ['tokyo-lantern-facade.jpg', 1072, 1300, 'Chiyoda, Tokyo', 'A three-storey Tokyo restaurant lit top to bottom with rows of red and gold paper lanterns at dusk.'],
      ['tokyo-kabukicho-gate.jpg', 1300, 1158, 'Kabukicho, Shinjuku', 'The red neon arch over Kabukicho Ichibangai in Shinjuku, a wall of illuminated signs down the street beyond.']
    ] },
  { id: 'mykonos', name: 'Mykonos', lon: 25.33, lat: 37.45, coord: '37.4 N, 25.3 E',
    line: 'Quad bike, sun on your forearms, straight over the middle of the island because somebody said the bakery there is worth it. It was.',
    pics: [
      ['mykonos-lane-bougainvillea.jpg', 933, 1400, 'Chora, Mykonos', 'A whitewashed lane in Mykonos town climbing between blue-railed steps, bougainvillea spilling over a doorway.'],
      ['mykonos-little-venice-sunset.jpg', 1500, 996, 'Little Venice, Mykonos', 'Wooden balconies hanging over the water at Little Venice in Mykonos as the sun drops behind the hills.'],
      ['mykonos-windmills.jpg', 1500, 939, 'The windmills, Mykonos', 'Two whitewashed Mykonos windmills with bare timber sails against a deep blue sky.'],
      ['mykonos-table-by-the-sea.jpg', 1400, 934, 'Little Venice, Mykonos', 'Blue and white tables set out on the rocks at the water’s edge in Mykonos, a parasol open above them.']
    ] },
  { id: 'barcelona', name: 'Barcelona', lon: 2.17, lat: 41.39, coord: '41.4 N, 2.2 E',
    line: 'Eight of you around one long table in the Gothic Quarter, three floors up, the last plate arriving somewhere near midnight.',
    pics: [
      ['barcelona-gothic-lane-night.jpg', 1600, 1104, 'Barcelona, after dark', 'A stone lane in old Barcelona at night, lit by a single wrought-iron lamp, one figure walking away into the dark.'],
      ['barcelona-carrer-del-bisbe.jpg', 1400, 933, 'Carrer del Bisbe, Barcelona', 'The carved Gothic footbridge across Carrer del Bisbe in Barcelona, a Catalan flag hanging from a balcony.'],
      ['barcelona-placa-reial.jpg', 1400, 933, 'Placa Reial, Barcelona', 'Placa Reial in Barcelona at blue hour, strings of lights crossing above the palms and arcades.']
    ] }
];
const BY_ID = {};
PLACES.forEach((p) => { BY_ID[p.id] = p; });

/* ------------------------------------------------- the world, in degrees
   A coarse hand-written outline: enough points that it reads as Earth and
   the six pins sit where they should.  Not traced from anybody's map. */

const LAND = {
  africa: [[-17,21],[-16,28],[-10,31],[-5,36],[10,37],[20,32],[25,31],[32,31],[34,28],[37,22],
    [39,15],[43,12],[51,12],[48,5],[41,-1],[40,-10],[35,-19],[33,-26],[27,-33],[20,-35],
    [18,-32],[14,-23],[12,-16],[9,-1],[9,4],[3,6],[-5,5],[-13,9],[-17,15]],
  eurasia: [[-10,36],[-9,43],[-2,43],[-1,46],[-4,48],[2,51],[8,54],[10,58],[5,61],[12,68],
    [22,70],[30,70],[42,68],[55,70],[70,73],[80,74],[100,77],[115,74],[130,73],[142,72],
    [160,70],[170,66],[179,65],[179,60],[165,60],[155,58],[143,54],[140,46],[130,43],
    [126,38],[122,31],[118,24],[110,21],[105,10],[100,5],[97,10],[94,16],[90,22],[86,21],
    [80,13],[77,8],[73,18],[68,24],[62,25],[57,22],[50,28],[44,38],[36,36],[30,36],[27,40],
    [24,36],[19,40],[13,38],[16,44],[12,45],[3,42],[-4,37]],
  seasia: [[96,6],[100,5],[104,1],[106,-6],[115,-8],[120,-9],[125,-8],[131,-8],[135,-3],
    [141,-3],[141,-9],[131,-9],[120,-10],[110,-8],[104,-7],[100,0],[97,4]],
  borneo: [[109,2],[117,4],[119,0],[117,-4],[110,-3],[108,0]],
  luzon: [[120,18],[124,18],[126,10],[122,6],[120,12]],
  australia: [[113,-22],[114,-28],[118,-35],[125,-32],[132,-32],[137,-35],[141,-38],[147,-38],
    [150,-37],[153,-28],[153,-25],[146,-19],[142,-11],[136,-12],[130,-11],[126,-14],[122,-17]],
  tasmania: [[145,-41],[148,-41],[148,-43],[145,-43]],
  namerica: [[-168,66],[-160,71],[-140,70],[-125,70],[-110,68],[-95,68],[-85,70],[-75,68],
    [-65,60],[-55,52],[-60,45],[-70,43],[-75,35],[-81,25],[-90,29],[-95,29],[-97,26],
    [-105,22],[-110,24],[-117,32],[-124,40],[-125,48],[-132,55],[-145,60],[-158,58],[-165,62]],
  samerica: [[-85,15],[-83,9],[-77,8],[-72,12],[-62,10],[-52,5],[-44,-2],[-38,-6],[-35,-8],
    [-39,-18],[-48,-25],[-54,-34],[-58,-39],[-62,-42],[-65,-48],[-69,-52],[-75,-50],[-73,-43],
    [-71,-33],[-70,-18],[-75,-14],[-81,-6],[-80,0],[-78,6]],
  greenland: [[-45,60],[-55,68],[-60,76],[-45,83],[-25,82],[-20,75],[-30,68]],
  japan: [[130,32],[135,34],[139,35],[141,39],[141,45],[145,44],[142,42],[138,37],[133,34]],
  britain: [[-5,50],[-6,55],[-3,58],[0,54],[1,51]],
  madagascar: [[43,-12],[50,-15],[50,-25],[45,-25],[43,-19]],
  newzealand: [[173,-35],[178,-38],[177,-41],[171,-44],[167,-46],[166,-45],[171,-41]],
  iceland: [[-24,65],[-18,67],[-14,65],[-19,63]],
  srilanka: [[80,9],[82,7],[80,6]],
  antarctica: [[-180,-72],[-140,-74],[-100,-74],[-60,-70],[-20,-70],[20,-70],[60,-68],
    [100,-66],[140,-68],[180,-72],[180,-84],[-180,-84]]
};

/* ------------------------------------------------------------------ state */

let seen = {};
let order = [];
let current = null;
let finished = false;

const stageEl = document.getElementById('roomStage');
const cardEl = document.getElementById('mapCard');
const mcKick = document.getElementById('mcKick');
const mcName = document.getElementById('mcName');
const mcCoord = document.getElementById('mcCoord');
const mcImg = document.getElementById('mcImg');
const mcCap = document.getElementById('mcCap');
const mcLine = document.getElementById('mcLine');
const mcThumbs = document.getElementById('mcThumbs');
const mcClose = document.getElementById('mcClose');
const countEl = document.getElementById('mcNum');
const hintEl = document.getElementById('roomHint');

/* =================================================================== boot */

Hotel.ready(async () => {
  if (!Hotel.gateRoom('map-room', { originX: 0.42, originY: 0.5 })) return;
  Hotel.say('118. The globe is heavier than it looks, and it has been dropped once already.',
    { for: 13000 });
  wire();

  if (SEEN_HOOK) {
    const n = SEEN_HOOK === 'all' ? 6 : Math.min(6, parseInt(SEEN_HOOK, 10) || 0);
    for (let i = 0; i < n; i++) { seen[PLACES[i].id] = true; order.push(PLACES[i].id); }
  }

  if (Hotel.mode() !== 'full') { flatMode(); return; }
  let stage = null;
  try { stage = await getStage(); } catch (e) { stage = null; }
  if (!stage) { flatMode(); return; }
  try { build3d(stage); } catch (e) { console.error(e); flatMode(); }
});

function flatMode() {
  document.documentElement.classList.add('room-flatmode');
  if (hintEl) hintEl.textContent = 'Press a pin to read what the hotel has about that place.';
  if (PIN_HOOK && BY_ID[PIN_HOOK]) visit(PIN_HOOK);
  else if (order.length) visit(order[order.length - 1]);
  refresh();
  /* the same read-only handle the 3D path exposes, so a harness can play the
     flat room too */
  window.RoomMap = {
    ids: PLACES.map((p) => p.id), bounds: () => null,
    state: () => ({ seen: Object.keys(seen), spin: 0, spinV: 0, current, finished,
      arcs: 0, wobble: 0 }),
    visit: (id) => visit(id), spinBy: () => {}
  };
}

/* ============================================================== the scene */

let scene, camera, view, screen, globe, pinGroup, arcGroup, stand;
let spin = 0, spinV = 0, dragging = false, lastX = 0, lastT = 0, tickAt = 0;
let wobble = 0, wobbleV = 0, target = null;
const pinObjs = {};
const R = 0.92;
const STAND_X = -1.15;

const LOOK = { x: 0, y: 1.98, z: -0.4 };
const EYE = { x: 0, y: 1.86, z: 5.60 };

function lonLatToVec(lon, lat, r) {
  const phi = (lon + 180) * Math.PI / 180;
  const theta = (90 - lat) * Math.PI / 180;
  return new THREE.Vector3(
    -r * Math.cos(phi) * Math.sin(theta),
    r * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta));
}

function build3d(stage) {
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x08150F, 6, 16);
  camera = new THREE.PerspectiveCamera(40, 1.7, 0.05, 40);
  camera.position.set(EYE.x, EYE.y, EYE.z);
  camera.lookAt(LOOK.x, LOOK.y, LOOK.z);

  /* --- the room ---------------------------------------------------------- */
  const wallMat = new THREE.MeshStandardMaterial({ map: texPanel(), roughness: 0.9 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), wallMat);
  wall.position.set(0, 2.6, -3.2);
  scene.add(wall);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(9, 8), wallMat);
  left.position.set(-5.2, 2.6, 1.0); left.rotation.y = Math.PI / 2; scene.add(left);
  const right = new THREE.Mesh(new THREE.PlaneGeometry(9, 8), wallMat);
  right.position.set(5.2, 2.6, 1.0); right.rotation.y = -Math.PI / 2; scene.add(right);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 12),
    new THREE.MeshStandardMaterial({ map: texRug(), roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0.6);
  scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(16, 12),
    new THREE.MeshStandardMaterial({ color: 0x0B1913, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 4.6, 0.6); scene.add(ceil);

  /* --- the sconce, a paper fire on the wall ------------------------------- */
  const brass = new THREE.MeshStandardMaterial({ color: 0xB08A2E, roughness: 0.32, metalness: 0.8 });
  [[-3.75, -3.16], [3.75, -3.16]].forEach(([x, z], i) => {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.10, 0.22), brass);
    bracket.position.set(x, 2.05, z + 0.12); scene.add(bracket);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.10, 0.20, 16), brass);
    cup.position.set(x, 2.18, z + 0.12); scene.add(cup);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.72),
      makeFireMaterial(THREE, { sheets: 6, base: 0.02, height: 0.78, licks: 1.4, taper: 1,
        embers: 0.5, night: 1, intensity: 1.1, aspect: 0.61 }));
    f.material.depthWrite = false;
    f.position.set(x, 2.62, z + 0.12);
    scene.add(f);
    const pl = new THREE.PointLight(0xFFA84C, 2.6, 8, 2.0);
    pl.position.set(x, 2.7, z + 0.5);
    scene.add(pl);
  });

  scene.add(new THREE.AmbientLight(0x4E5C4A, 0.55));
  scene.add(new THREE.HemisphereLight(0xE0C070, 0x14261C, 0.52));
  const key = new THREE.PointLight(0xFFDCA0, 3.0, 12, 2.0);
  key.position.set(-2.0, 3.6, 2.6);
  scene.add(key);
  /* a low fill so the underside of the globe is not a black crescent */
  const fill = new THREE.PointLight(0xC9A227, 1.1, 9, 2.0);
  fill.position.set(0.9, 0.9, 3.2);
  scene.add(fill);

  /* --- the stand ---------------------------------------------------------- */
  stand = new THREE.Group();
  stand.position.set(STAND_X, 0, 0);
  scene.add(stand);

  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 1.02, 10), brass);
    leg.position.set(Math.cos(a) * 0.34, 0.50, Math.sin(a) * 0.34);
    leg.rotation.z = -Math.cos(a) * 0.33;
    leg.rotation.x = Math.sin(a) * 0.33;
    stand.add(leg);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), brass);
    foot.position.set(Math.cos(a) * 0.51, 0.04, Math.sin(a) * 0.51);
    stand.add(foot);
  }
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.14, 18), brass);
  collar.position.y = 1.02; stand.add(collar);
  /* the meridian ring the globe turns inside, tilted with it */
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.075, 0.028, 10, 64), brass);
  ring.position.y = R + 1.08;
  ring.rotation.z = -23.4 * Math.PI / 180;
  stand.add(ring);
  const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, (R + 0.10) * 2, 8), brass);
  axis.position.y = R + 1.08;
  axis.rotation.z = -23.4 * Math.PI / 180;
  stand.add(axis);

  /* --- the globe ---------------------------------------------------------- */
  globe = new THREE.Group();
  globe.position.y = R + 1.08;
  globe.rotation.z = -23.4 * Math.PI / 180;         /* it leans, the way they do */
  stand.add(globe);

  const ball = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 48),
    new THREE.MeshStandardMaterial({ map: texGlobe(), roughness: 0.88 }));
  globe.add(ball);

  /* --- the pins ----------------------------------------------------------- */
  pinGroup = new THREE.Group();
  globe.add(pinGroup);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xE2C067, roughness: 0.28, metalness: 0.85,
    emissive: new THREE.Color(0x8A6A24), emissiveIntensity: 0.25 });
  PLACES.forEach((p) => {
    const g = new THREE.Group();
    const v = lonLatToVec(p.lon, p.lat, R);
    g.position.copy(v);
    g.lookAt(v.clone().multiplyScalar(2));
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.005, 0.26, 8), headMat);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = 0.09;
    g.add(shaft);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.047, 14, 12), headMat);
    head.position.z = 0.23;
    g.add(head);
    pinGroup.add(g);
    pinObjs[p.id] = { def: p, group: g, head, rattle: Math.random() * 6.28 };
  });

  arcGroup = new THREE.Group();
  globe.add(arcGroup);

  /* --- buttons over the pins ---------------------------------------------- */
  screen = new Screen(camera, scene, stageEl, { occluders: [ball] });
  PLACES.forEach((p) => {
    screen.add({ id: p.id, obj: pinObjs[p.id].head, radius: 0.04 });
  });

  view = stage.addView({
    el: stageEl, scene, camera,
    resize(w, h) {
      const a = w / Math.max(1, h);
      camera.fov = a < 0.95 ? 62 : (a < 1.3 ? 50 : 40);
      camera.aspect = a;
      /* on a phone the card takes the bottom, so the globe comes to the middle */
      /* On a phone the card is a sheet across the bottom, so the globe is
         framed in the top half: same camera, aimed lower. */
      const narrow = a < 0.95;
      const cx = narrow ? STAND_X : LOOK.x;
      camera.position.set(cx, narrow ? 1.95 : EYE.y, narrow ? 5.2 : EYE.z);
      camera.updateProjectionMatrix();
      camera.lookAt(cx, narrow ? 0.55 : LOOK.y, LOOK.z);
    },
    onFrame(dt, t) { frame(dt, t); }
  });

  bindDrag();
  document.documentElement.classList.add('room-3d');
  drawArcs();
  if (SPIN_HOOK) { spinV = 9.5; shove(); }
  if (PIN_HOOK && BY_ID[PIN_HOOK]) visit(PIN_HOOK);
  else if (order.length) visit(order[order.length - 1], true);
  refresh();
  frame(0, 0);

  window.RoomMap = {
    ids: PLACES.map((p) => p.id),
    bounds: (id) => screen.bounds(id),
    state: () => ({ seen: Object.keys(seen), spin, spinV, current, finished,
      arcs: arcGroup.children.length, wobble }),
    visit: (id) => visit(id),
    spinBy: (v) => { spinV = v; }
  };
}

/* ---------------------------------------------------------------- texture */

function texPanel() {
  const [c, g] = cnv(512, 512);
  g.fillStyle = '#0E241B'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 18; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = 70 + Math.random() * 140;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(29,90,63,.26)'); gr.addColorStop(1, 'rgba(29,90,63,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
  }
  g.lineWidth = 3;
  for (let x = 20; x < 512; x += 124) {
    for (let y = 20; y < 512; y += 160) {
      g.strokeStyle = 'rgba(201,162,39,.30)'; g.strokeRect(x, y, 96, 128);
      g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.6;
      g.strokeRect(x + 7, y + 7, 82, 114); g.lineWidth = 3;
    }
  }
  grainy(g, 512, 512, 20);
  return canvasTex(c, { repeat: [3.4, 1.7] });
}

function texRug() {
  const [c, g] = cnv(512, 512);
  g.fillStyle = '#3A1512'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(190,150,60,.34)'; g.lineWidth = 3;
  for (let y = 0; y <= 512; y += 86) {
    for (let x = 0; x <= 512; x += 86) {
      g.beginPath();
      g.moveTo(x, y - 26); g.lineTo(x + 26, y); g.lineTo(x, y + 26); g.lineTo(x - 26, y);
      g.closePath(); g.stroke();
    }
  }
  grainy(g, 512, 512, 26);
  return canvasTex(c, { repeat: [4, 4] });
}

/** The globe, drawn as an antique engraving in the hotel's colours. */
function texGlobe() {
  const W = 2048, H = 1024;
  const [c, g] = cnv(W, H);
  const X = (lon) => ((lon + 180) / 360) * W;
  const Y = (lat) => ((90 - lat) / 180) * H;

  /* parchment ocean */
  g.fillStyle = '#E4D6B2'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * W, y = Math.random() * H, r = 40 + Math.random() * 190;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(160,132,74,.10)'); gr.addColorStop(1, 'rgba(160,132,74,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
  }
  /* engraved sea hatching */
  g.strokeStyle = 'rgba(122,100,58,.16)'; g.lineWidth = 1;
  for (let y = 0; y < H; y += 7) {
    g.beginPath();
    for (let x = 0; x <= W; x += 24) g.lineTo(x, y + Math.sin((x + y) * 0.01) * 2.2);
    g.stroke();
  }

  /* the graticule */
  g.strokeStyle = 'rgba(110,84,24,.34)'; g.lineWidth = 1.6;
  for (let lon = -180; lon <= 180; lon += 15) {
    g.beginPath(); g.moveTo(X(lon), 0); g.lineTo(X(lon), H); g.stroke();
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    g.beginPath(); g.moveTo(0, Y(lat)); g.lineTo(W, Y(lat)); g.stroke();
  }
  g.strokeStyle = 'rgba(138,46,46,.42)'; g.lineWidth = 3.4;
  g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(W, Y(0)); g.stroke();
  g.lineWidth = 2; g.setLineDash([12, 9]);
  [23.44, -23.44].forEach((lat) => { g.beginPath(); g.moveTo(0, Y(lat)); g.lineTo(W, Y(lat)); g.stroke(); });
  g.setLineDash([]);

  /* the land: green gold, with an engraved coast shadow */
  for (const k in LAND) {
    const pts = LAND[k];
    g.beginPath();
    pts.forEach((p, i) => { const x = X(p[0]), y = Y(p[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.closePath();
    const grad = g.createLinearGradient(0, Y(60), 0, Y(-50));
    grad.addColorStop(0, '#7E8A54');
    grad.addColorStop(0.5, '#6E7C46');
    grad.addColorStop(1, '#5E6C3E');
    g.fillStyle = grad; g.fill();
    g.strokeStyle = 'rgba(58,44,16,.75)'; g.lineWidth = 3; g.stroke();
    /* a hatched shadow just inside the coast */
    g.save(); g.clip();
    g.strokeStyle = 'rgba(58,44,16,.16)'; g.lineWidth = 2;
    for (let i = -H; i < W; i += 9) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + H, H); g.stroke();
    }
    g.restore();
  }

  /* a compass rose and a cartouche, the way a globe has */
  const cx = X(-150), cy = Y(-35);
  g.strokeStyle = 'rgba(110,84,24,.55)'; g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cy, 62, 0, 6.2832); g.stroke();
  g.beginPath(); g.arc(cx, cy, 44, 0, 6.2832); g.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * 60, cy + Math.sin(a) * 60);
    g.stroke();
  }
  g.fillStyle = 'rgba(110,84,24,.8)';
  g.font = '600 34px Cinzel, Georgia, serif';
  g.textAlign = 'center';
  g.fillText('N', cx, cy - 70);

  g.textAlign = 'left';
  g.fillStyle = 'rgba(96,74,26,.75)';
  g.font = 'italic 40px Georgia, serif';
  g.fillText('Mare Pacificum', X(-140), Y(12));
  g.fillText('Mare Atlanticum', X(-38), Y(26));
  g.fillText('Mare Indicum', X(72), Y(-22));

  grainy(g, W, H, 14);
  return canvasTex(c, { aniso: 8 });
}

/* ------------------------------------------------------------------ drag */

function bindDrag() {
  const down = (e) => {
    if (e.target.closest('.lost-btn') || e.target.closest('.map-card') ||
        e.target.closest('.room-out')) return;
    dragging = true; lastX = e.clientX; lastT = performance.now();
    target = null;
    stageEl.classList.add('is-holding');
    if (stageEl.setPointerCapture) { try { stageEl.setPointerCapture(e.pointerId); } catch (err) {} }
  };
  const move = (e) => {
    if (!dragging) return;
    const now = performance.now();
    const dt = Math.max(8, now - lastT) / 1000;
    const d = (e.clientX - lastX) * 0.0078;
    spin += d;
    spinV = damp(spinV, d / dt, 0.0001, dt);
    lastX = e.clientX; lastT = now;
  };
  const up = () => {
    if (!dragging) return;
    dragging = false;
    stageEl.classList.remove('is-holding');
    if (Math.abs(spinV) > 8.0) shove();
  };
  stageEl.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);

  /* keyboard: the globe is a control too */
  stageEl.setAttribute('tabindex', '0');
  stageEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { spinV -= 2.2; target = null; e.preventDefault(); }
    else if (e.key === 'ArrowRight') { spinV += 2.2; target = null; e.preventDefault(); }
    else return;
    if (Math.abs(spinV) > 8.0) shove();
  });
}

const REBUKES = [
  'It is a globe, not a roulette wheel.',
  'That is how it got dropped the first time.',
  'The pins are brass. They do come out.',
  'Gently. It has been round the world enough.'
];
let rebuke = 0;

function shove() {
  wobbleV = 5.4 * (spinV > 0 ? 1 : -1);
  spinV = clamp(spinV, -7.0, 7.0);
  for (const id in pinObjs) pinObjs[id].rattleT = 1;
  if (Hotel.sound.isOn()) { Hotel.sound.play('clunk'); Hotel.sound.play('jingle'); }
  Hotel.say(REBUKES[rebuke++ % REBUKES.length], { for: 8000 });
  Hotel.announce('The globe wobbles on its stand and the pins rattle.');
}

/* ------------------------------------------------------------- each frame */

function frame(dt, t) {
  if (!globe) return;
  const still = Hotel.stillFrame;

  if (target !== null && !dragging) {
    /* turning a place to the front: ease, shortest way round */
    let d = target - spin;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) < 0.004) { spin = target; target = null; spinV = 0; }
    else { spin += d * (still ? 1 : 1 - Math.pow(0.004, Math.max(0.001, dt))); spinV = 0; }
  } else if (!dragging && !still) {
    spin += spinV * dt;
    spinV *= Math.pow(0.30, dt);                 /* it keeps going, then it doesn't */
    if (Math.abs(spinV) < 0.012) spinV = 0;
  }
  globe.rotation.y = spin;

  /* a brass tick every fifteen degrees of meridian */
  const step = Math.PI / 12;
  const n = Math.floor(spin / step);
  if (n !== tickAt) {
    if (tickAt !== 0 && Math.abs(spinV) > 0.25 && Hotel.sound.isOn()) Hotel.sound.play('tick');
    tickAt = n;
  }

  /* the wobble on the stand, and the pins rattling in it */
  if (!still) {
    wobbleV += -wobble * 62 * dt;
    wobbleV *= Math.pow(0.02, dt);
    wobble += wobbleV * dt;
  }
  stand.rotation.z = wobble * 0.022;
  stand.rotation.x = wobble * 0.014;
  for (const id in pinObjs) {
    const o = pinObjs[id];
    if (o.rattleT > 0 && !still) {
      o.rattleT = Math.max(0, o.rattleT - dt * 1.5);
      const k = o.rattleT * 0.09;
      o.head.position.z = 0.23 + Math.sin(t * 40 + o.rattle) * k;
    } else if (o.head.position.z !== 0.23) {
      o.head.position.z = 0.23;
    }
    const on = seen[id];
    o.head.material = o.head.material;
    o.head.scale.setScalar(current === id ? 1.5 : (on ? 1.18 : 1));
  }
  if (screen) screen.place();
}

/* --------------------------------------------------------------- the arcs */

function drawArcs() {
  if (!arcGroup) return;
  while (arcGroup.children.length) {
    const c = arcGroup.children.pop();
    c.geometry.dispose(); c.material.dispose();
  }
  for (let i = 1; i < order.length; i++) {
    const a = BY_ID[order[i - 1]], b = BY_ID[order[i]];
    const va = lonLatToVec(a.lon, a.lat, R), vb = lonLatToVec(b.lon, b.lat, R);
    const pts = [];
    const steps = 64;
    for (let s = 0; s <= steps; s++) {
      const k = s / steps;
      /* a great circle, lifted off the surface so it reads as a thread */
      const v = va.clone().lerp(vb, k).normalize()
        .multiplyScalar(R * (1.012 + 0.055 * Math.sin(k * Math.PI)));
      pts.push(v);
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0xE9CE7A, transparent: true, opacity: 0.85 }));
    arcGroup.add(line);
  }
}

/* -------------------------------------------------------------- selecting */

function wire() {
  document.querySelectorAll('.lost-btn').forEach((b) => {
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => visit(b.dataset.obj));
  });
  if (mcClose) mcClose.addEventListener('click', () => closeCard());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cardEl && !cardEl.hidden) closeCard();
  });
}

function visit(id, quiet) {
  const p = BY_ID[id];
  if (!p) return false;
  current = id;
  if (!seen[id]) { seen[id] = true; order.push(id); drawArcs(); }
  showCard(p, 0);
  if (!quiet && Hotel.sound.isOn()) Hotel.sound.play('tick');

  /* turn the globe so that place faces you.  The pin sits at longitude p.lon;
     the globe's own rotation.y has to bring it round to the front. */
  if (globe) {
    const want = -((p.lon + 180) * Math.PI / 180) + Math.PI / 2;
    let d = want - spin;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    target = spin + d;
    spinV = 0;
    if (Hotel.stillFrame) { spin = target; target = null; globe.rotation.y = spin; }
  }
  refresh();
  if (Object.keys(seen).length >= PLACES.length && !finished) finish();
  return true;
}

function showCard(p, i) {
  const pic = p.pics[i] || p.pics[0];
  mcKick.textContent = 'Pinned';
  mcName.textContent = p.name;
  mcCoord.textContent = p.coord;
  mcImg.src = 'img/' + pic[0];
  mcImg.width = pic[1]; mcImg.height = pic[2];
  mcImg.alt = pic[4];
  mcCap.textContent = pic[3];
  mcLine.textContent = p.line;
  mcThumbs.innerHTML = p.pics.map((q, k) =>
    '<li><button type="button" class="mc-thumb' + (k === i ? ' is-on' : '') +
    '" data-i="' + k + '" aria-pressed="' + (k === i) + '">' +
    '<img src="img/' + q[0] + '" width="' + q[1] + '" height="' + q[2] + '" alt="' + q[3] + '" loading="lazy">' +
    '</button></li>').join('');
  mcThumbs.querySelectorAll('.mc-thumb').forEach((b) => {
    b.addEventListener('click', () => showCard(p, Number(b.dataset.i)));
  });
  cardEl.hidden = false;
  if (window.gsap && !Hotel.stillFrame) {
    window.gsap.fromTo(cardEl, { opacity: 0, x: 26, rotate: 0.8 },
      { opacity: 1, x: 0, rotate: 0, duration: 0.55, ease: 'power3.out' });
  }
  Hotel.announce(p.name + '. ' + p.line);
}

function closeCard() {
  cardEl.hidden = true;
  current = null;
  document.querySelectorAll('.lost-btn').forEach((b) => b.setAttribute('aria-pressed', 'false'));
}

function refresh() {
  if (countEl) countEl.textContent = String(Object.keys(seen).length);
  document.querySelectorAll('.lost-btn').forEach((b) => {
    b.classList.toggle('is-done', !!seen[b.dataset.obj]);
    b.setAttribute('aria-pressed', String(b.dataset.obj === current));
  });
}

function finish() {
  finished = true;
  Hotel.addFound('chart');
  const f = Hotel.FINDS.chart;
  Hotel.say('Six of six, and a line drawn between them. There was a chart rolled up under the stand the whole time.',
    { for: 15000 });
  if (Hotel.sound.isOn()) Hotel.sound.play('ding');
  document.documentElement.classList.add('map-all-seen');
  mcKick.textContent = 'Six of six';
  mcName.textContent = f.title;
  mcCoord.textContent = 'In your passport';
  mcImg.src = f.img; mcImg.width = f.w; mcImg.height = f.h; mcImg.alt = f.alt;
  mcCap.textContent = 'Public domain, from Wikimedia Commons, credited in full';
  mcLine.textContent = 'Every route the mail boats ran, and not one of them goes anywhere you have just pinned.';
  mcThumbs.innerHTML = '';
  cardEl.hidden = false;
  if (hintEl) { hintEl.textContent = 'All six.'; hintEl.style.opacity = '0'; }
}
