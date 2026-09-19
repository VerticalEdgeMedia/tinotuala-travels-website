/* ==========================================================================
   room102b.js - Room 102B, the lost property room.

   The room as the owner described it, and nothing more:

     a SMALL room with a TRIANGULAR floor plan.  The doorway is one side; two
     interior walls run back from either edge of it and meet at a corner
     directly opposite.  You open the door and look into a corner.
     One wall: a mattress tilted up on its side, leaning against it.
     The other wall: the lost property, on shelves.
     A bare bulb.  A worn floor.  Corridor carpet behind you through the door.

   No windows.  No other furniture.  Do not add any.

   Everything here is built in code: the geometry with three.js primitives,
   every texture on a 2D canvas.  The only loaded pictures are the two
   public-domain rewards (a postcard and a travel poster), both credited.

   The room also exists as flat HTML in 102b.html.  That version is what the
   lighter mode, a browser without WebGL, and a screen reader get, and the
   logic below drives both: the buttons in `.lost-list` are the one route in.
   ========================================================================== */

import * as THREE from './vendor/three.module.min.js';
import { getStage } from './gl.js';

const HOOKS = new URLSearchParams(location.search);
const LOOK = HOOKS.get('look');          /* left | right | centre, for screenshots */
const PICK = HOOKS.get('pick');          /* an object id, for screenshots */
const PLAN = HOOKS.get('plan') === '1';  /* the floor plan, seen from above */

/* ------------------------------------------------------------ the objects */

const OBJECTS = [
  { id: 'flipflop',  shelf: 0, slot: 0 },
  { id: 'snorkel',   shelf: 0, slot: 1 },
  { id: 'strawhat',  shelf: 0, slot: 2 },
  { id: 'paperback', shelf: 0, slot: 3 },
  { id: 'ukulele',   shelf: 1, slot: 0 },
  { id: 'polaroid',  shelf: 1, slot: 1 },
  { id: 'flamingo',  shelf: 1, slot: 2 },
  { id: 'bucket',    shelf: 1, slot: 3 },
  { id: 'jar',       shelf: 2, slot: 0, does: 'shake' },
  { id: 'hat',       shelf: 2, slot: 1, does: 'take' },
  { id: 'postcard',  shelf: 2, slot: 2, does: 'keep', find: 'postcard' },
  { id: 'poster',    shelf: 2, slot: 3, does: 'keep', find: 'poster' }
];

const ACT_LABEL = { shake: 'Give it a shake', take: 'Take it with you', keep: 'Keep it' };

/* How far each thing has to be lifted so it stands ON the shelf rather than
   half inside it, and how big it reads at arm's length. */
const LIFT = {
  flipflop: 0.013, snorkel: 0.170, strawhat: 0.004, paperback: 0.100,
  ukulele: 0.128, polaroid: 0.064, flamingo: 0.004, bucket: 0.002,
  jar: 0.002, hat: 0.002, postcard: 0.052, poster: 0.035
};
const SIZE = {
  flipflop: 1.25, snorkel: 1.05, strawhat: 1.1, paperback: 1.3,
  ukulele: 0.92, polaroid: 1.15, flamingo: 1.05, bucket: 1.25,
  jar: 1.2, hat: 1.35, postcard: 1.35, poster: 1.1
};
/* A few of them lean or lie the way things do on a shelf nobody tidies. */
const TIP = {
  paperback: [0.08, 0, 0.16], postcard: [0.12, 0, -0.10], snorkel: [0.10, 0, -0.06],
  ukulele: [0.06, 0, 0.14], flipflop: [0, 0, 0]
};

/* ------------------------------------------------------- canvas textures */

function cnv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function grainy(g, w, h, amount) {
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

/** Faded hotel wallpaper: a small repeating motif, water stains, a dado. */
function texWall() {
  const [c, g] = cnv(512, 512);
  g.fillStyle = '#6A543C'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(120,96,64,.55)';
  g.lineWidth = 2;
  for (let y = 24; y < 512; y += 64) {
    for (let x = (y / 64) % 2 ? 32 : 0; x < 512; x += 64) {
      g.beginPath();
      g.moveTo(x + 32, y);
      g.bezierCurveTo(x + 48, y + 10, x + 48, y + 26, x + 32, y + 34);
      g.bezierCurveTo(x + 16, y + 26, x + 16, y + 10, x + 32, y);
      g.stroke();
      g.beginPath(); g.arc(x + 32, y + 17, 2.6, 0, 6.3); g.stroke();
    }
  }
  /* water coming through from somewhere above */
  for (let s = 0; s < 6; s++) {
    const x = Math.random() * 512, y = Math.random() * 300;
    const r = 40 + Math.random() * 110;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(60,44,26,.34)');
    grad.addColorStop(0.7, 'rgba(78,58,34,.16)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath(); g.ellipse(x, y, r, r * 0.7, Math.random() * 3, 0, 6.3); g.fill();
  }
  /* a dado rail and darker paint below it */
  g.fillStyle = 'rgba(34,24,14,.45)'; g.fillRect(0, 372, 512, 140);
  g.fillStyle = '#4C3A26'; g.fillRect(0, 366, 512, 9);
  grainy(g, 512, 512, 26);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Mattress ticking: cream, blue stripes, grime along the bottom, one stain. */
function texTicking() {
  const [c, g] = cnv(512, 512);
  g.fillStyle = '#DED5BC'; g.fillRect(0, 0, 512, 512);
  g.fillStyle = 'rgba(96,120,144,.46)';
  for (let x = 12; x < 512; x += 48) {
    g.fillRect(x, 0, 11, 512);
    g.fillRect(x + 18, 0, 3, 512);
  }
  /* tufting buttons */
  g.fillStyle = 'rgba(120,104,72,.5)';
  for (let y = 78; y < 512; y += 150) {
    for (let x = 70; x < 512; x += 150) {
      g.beginPath(); g.arc(x, y, 7, 0, 6.3); g.fill();
    }
  }
  /* the stain */
  const grad = g.createRadialGradient(330, 300, 4, 330, 300, 96);
  grad.addColorStop(0, 'rgba(120,88,42,.46)');
  grad.addColorStop(0.65, 'rgba(136,104,54,.24)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.beginPath(); g.ellipse(330, 300, 96, 74, 0.5, 0, 6.3); g.fill();
  /* grubby along one edge */
  const gr2 = g.createLinearGradient(0, 512, 0, 400);
  gr2.addColorStop(0, 'rgba(50,40,24,.55)');
  gr2.addColorStop(1, 'rgba(50,40,24,0)');
  g.fillStyle = gr2; g.fillRect(0, 400, 512, 112);
  grainy(g, 512, 512, 22);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The mattress label, sewn into the seam. */
function texLabel() {
  const [c, g] = cnv(256, 128);
  g.fillStyle = '#EFE8D6'; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#9A2E2E'; g.lineWidth = 3; g.strokeRect(8, 8, 240, 112);
  g.fillStyle = '#3A3226';
  g.font = '700 17px Georgia, serif';
  g.fillText('DO NOT REMOVE', 24, 42);
  g.font = '13px Georgia, serif';
  g.fillText('this label under', 24, 66);
  g.fillText('penalty of nothing', 24, 86);
  g.fillText('at all', 24, 106);
  grainy(g, 256, 128, 16);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Hotel corridor carpet: deep red, gold diamonds. */
function texCarpet() {
  const [c, g] = cnv(256, 256);
  g.fillStyle = '#5A1A18'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(190,150,60,.5)'; g.lineWidth = 3;
  for (let y = 0; y <= 256; y += 64) {
    for (let x = 0; x <= 256; x += 64) {
      g.beginPath();
      g.moveTo(x, y - 20); g.lineTo(x + 20, y); g.lineTo(x, y + 20); g.lineTo(x - 20, y);
      g.closePath(); g.stroke();
    }
  }
  g.fillStyle = 'rgba(28,8,8,.4)';
  for (let i = 0; i < 700; i++) {
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  grainy(g, 256, 256, 30);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Worn boards, scuffed pale where people have stood. */
function texFloor() {
  const [c, g] = cnv(512, 512);
  g.fillStyle = '#4A3826'; g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 64) {
    g.fillStyle = `rgba(${40 + Math.random() * 40},${28 + Math.random() * 26},${16 + Math.random() * 18},.5)`;
    g.fillRect(0, y, 512, 62);
    g.strokeStyle = 'rgba(16,10,6,.8)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke();
    for (let k = 0; k < 14; k++) {
      g.strokeStyle = 'rgba(30,20,12,.35)'; g.lineWidth = 1;
      const yy = y + 6 + Math.random() * 50;
      g.beginPath(); g.moveTo(0, yy); g.bezierCurveTo(170, yy + 4, 340, yy - 4, 512, yy); g.stroke();
    }
  }
  const grad = g.createRadialGradient(256, 256, 20, 256, 256, 230);
  grad.addColorStop(0, 'rgba(180,156,116,.22)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
  grainy(g, 512, 512, 24);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Old varnished shelving. */
function texShelf() {
  const [c, g] = cnv(256, 128);
  g.fillStyle = '#6A4E2E'; g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = `rgba(${30 + Math.random() * 60},${20 + Math.random() * 40},10,.35)`;
    g.lineWidth = 1 + Math.random() * 2;
    const y = Math.random() * 128;
    g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y + 6, 170, y - 6, 256, y); g.stroke();
  }
  grainy(g, 256, 128, 22);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A luggage tag with the object's name and its one line. */
function texTag(name, story) {
  const W = 640, H = 400;
  const [c, g] = cnv(W, H);
  g.fillStyle = '#E4D3A8'; g.fillRect(0, 0, W, H);
  /* a bit of age at the edges */
  const grad = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.66);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(90,64,28,.45)');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);

  g.strokeStyle = '#8A2E2E'; g.lineWidth = 5;
  g.strokeRect(22, 22, W - 44, H - 44);
  g.strokeStyle = 'rgba(138,46,46,.45)'; g.lineWidth = 2;
  g.strokeRect(34, 34, W - 68, H - 68);

  /* the punched hole and its brass eyelet */
  g.fillStyle = '#4A3A18';
  g.beginPath(); g.arc(70, 66, 20, 0, 6.3); g.fill();
  g.fillStyle = '#1A1208';
  g.beginPath(); g.arc(70, 66, 12, 0, 6.3); g.fill();

  g.fillStyle = '#5E4A20';
  g.font = '600 20px Cinzel, Georgia, serif';
  g.fillText('TINO TUALA TRAVELS', 112, 62);
  g.font = '600 17px Cinzel, Georgia, serif';
  g.fillText('102B', 112, 88);

  g.fillStyle = '#2E2618';
  g.font = '600 31px Georgia, serif';
  wrap(g, name, 56, 158, W - 112, 38);

  g.fillStyle = '#4A3E28';
  g.font = 'italic 25px Georgia, serif';
  const nameLines = countLines(g, name, W - 112, '600 31px Georgia, serif');
  wrap(g, story, 56, 158 + nameLines * 38 + 26, W - 112, 32);

  grainy(g, W, H, 18);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function wrap(g, text, x, y, maxw, lh) {
  const words = String(text).split(' ');
  let line = '', yy = y;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (g.measureText(test).width > maxw && line) {
      g.fillText(line, x, yy); line = words[i]; yy += lh;
    } else line = test;
  }
  if (line) g.fillText(line, x, yy);
}
function countLines(g, text, maxw, font) {
  const save = g.font; g.font = font;
  const words = String(text).split(' ');
  let line = '', n = 1;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (g.measureText(test).width > maxw && line) { n++; line = words[i]; }
    else line = test;
  }
  g.font = save;
  return n;
}

/** A paperback cover: abstract, no title anybody could have written. */
function texBook() {
  const [c, g] = cnv(256, 384);
  g.fillStyle = '#2E5A66'; g.fillRect(0, 0, 256, 384);
  g.fillStyle = '#D9A63C';
  g.beginPath(); g.arc(128, 150, 64, 0, 6.3); g.fill();
  g.fillStyle = '#1A3A44';
  g.beginPath();
  g.moveTo(0, 240); g.bezierCurveTo(70, 210, 170, 268, 256, 232); g.lineTo(256, 384); g.lineTo(0, 384);
  g.closePath(); g.fill();
  g.fillStyle = 'rgba(240,236,220,.85)';
  g.fillRect(40, 300, 176, 9); g.fillRect(64, 322, 128, 7);
  /* water damage */
  const grad = g.createLinearGradient(0, 384, 0, 190);
  grad.addColorStop(0, 'rgba(120,96,50,.62)');
  grad.addColorStop(1, 'rgba(120,96,50,0)');
  g.fillStyle = grad; g.fillRect(0, 190, 256, 194);
  grainy(g, 256, 384, 24);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------ object modelling */

const M = {
  rubber: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, metalness: 0 }),
  straw:  () => new THREE.MeshStandardMaterial({ color: 0xD8BE84, roughness: 0.95 }),
  plastic:(c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.42, metalness: 0.05 }),
  metal:  (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.34, metalness: 0.85 }),
  wood:   (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }),
  paper:  (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.96 })
};

function build(id, tex) {
  const g = new THREE.Group();
  switch (id) {

    case 'flipflop': {
      const sole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.085, 0.022, 24, 1),
        M.rubber(0x2E4E6E));
      sole.scale.set(1, 1, 2.05);
      g.add(sole);
      const toe = new THREE.Mesh(new THREE.SphereGeometry(0.083, 18, 12), M.rubber(0x2E4E6E));
      toe.scale.set(1, 0.13, 1); toe.position.z = 0.15; g.add(toe);
      const strapM = M.rubber(0xC9522E);
      const s1 = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.011, 8, 22, Math.PI), strapM);
      s1.rotation.set(0, 0, 0); s1.position.set(0, 0.03, 0.02); s1.rotation.x = Math.PI / 2;
      s1.rotation.z = Math.PI; g.add(s1);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.05), strapM);
      post.position.set(0, 0.03, 0.13); post.rotation.x = 0.5; g.add(post);
      break;
    }

    case 'snorkel': {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.14, 0.03),
        new THREE.Vector3(0.02, -0.02, 0.01),
        new THREE.Vector3(0.015, 0.10, -0.01),
        new THREE.Vector3(-0.01, 0.18, -0.005)
      ]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.016, 10, false),
        M.plastic(0xE0B22A));
      g.add(tube);
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.028), M.rubber(0x1E1E20));
      mouth.position.set(-0.03, -0.155, 0.035); mouth.rotation.z = 0.35; g.add(mouth);
      /* bitten clean through */
      const bite = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), M.rubber(0x141416));
      bite.position.set(-0.058, -0.15, 0.04); g.add(bite);
      break;
    }

    case 'strawhat':
    case 'hat': {
      const k = id === 'hat' ? 0.34 : 1;
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.175 * k, 0.185 * k, 0.012 * k, 30, 1), M.straw());
      brim.position.y = 0.01 * k; g.add(brim);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.085 * k, 0.098 * k, 0.10 * k, 26, 1, true), M.straw());
      crown.position.y = 0.062 * k; g.add(crown);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.086 * k, 22, 10, 0, 6.3, 0, Math.PI / 2), M.straw());
      top.position.y = 0.112 * k; g.add(top);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.100 * k, 0.100 * k, 0.026 * k, 26, 1, true),
        M.paper(id === 'hat' ? 0x9A3A2E : 0xB04A34));
      band.position.y = 0.026 * k; g.add(band);
      break;
    }

    case 'paperback': {
      const pages = new THREE.Mesh(new THREE.BoxGeometry(0.128, 0.196, 0.036), M.paper(0xD9CFAE));
      g.add(pages);
      const cover = new THREE.Mesh(new THREE.PlaneGeometry(0.132, 0.200),
        new THREE.MeshStandardMaterial({ map: tex.book, roughness: 0.95 }));
      cover.position.z = 0.019; g.add(cover);
      /* swollen: the pages fan */
      pages.geometry.scale(1, 1, 1);
      const fan = new THREE.Mesh(new THREE.BoxGeometry(0.120, 0.192, 0.030), M.paper(0xE6DCC0));
      fan.position.set(0.012, 0, -0.004); fan.rotation.z = 0.05; g.add(fan);
      break;
    }

    case 'ukulele': {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.105, 22, 16), M.wood(0xB07A3E));
      body.scale.set(1, 1.18, 0.34); g.add(body);
      const waist = new THREE.Mesh(new THREE.SphereGeometry(0.082, 20, 14), M.wood(0xB07A3E));
      waist.scale.set(1, 0.9, 0.34); waist.position.y = 0.11; g.add(waist);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.030, 22), M.paper(0x241609));
      hole.position.set(0, 0.03, 0.037); g.add(hole);
      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.20, 0.020), M.wood(0x6E4A24));
      neck.position.y = 0.26; g.add(neck);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.055, 0.016), M.wood(0x5A3A1C));
      head.position.y = 0.383; g.add(head);
      const str = new THREE.MeshStandardMaterial({ color: 0xF0EAD6, roughness: 0.5 });
      for (let i = 0; i < 3; i++) {                     /* three strings, not four */
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0013, 0.40, 5), str);
        s.position.set(-0.009 + i * 0.009, 0.185, 0.026); g.add(s);
      }
      break;
    }

    case 'polaroid': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.125, 0.092), M.plastic(0x2B2B2E));
      g.add(body);
      const front = new THREE.Mesh(new THREE.BoxGeometry(0.150, 0.048, 0.006), M.plastic(0xD8D6CE));
      front.position.set(0, -0.030, 0.048); g.add(front);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.034, 0.040, 24), M.plastic(0x1A1A1C));
      lens.rotation.x = Math.PI / 2; lens.position.set(0, 0.012, 0.062); g.add(lens);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(0.023, 22), M.metal(0x3A4A58));
      glass.position.set(0, 0.012, 0.083); g.add(glass);
      const flash = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.020, 0.008), M.plastic(0xE8E4D8));
      flash.position.set(-0.048, 0.050, 0.047); g.add(flash);
      /* taped shut, and the tape has gone yellow */
      const tape = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.132, 0.098),
        new THREE.MeshStandardMaterial({ color: 0xD9C27A, roughness: 0.8, transparent: true, opacity: 0.92 }));
      tape.position.set(0.035, 0, 0); g.add(tape);
      break;
    }

    case 'flamingo': {
      const pink = M.plastic(0xE97FA6);
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 22, 16), pink);
      body.scale.set(1.35, 0.42, 0.78);                 /* half the air gone */
      body.position.y = 0.05; g.add(body);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.10, 0.08, 0),
        new THREE.Vector3(0.17, 0.17, 0.01),
        new THREE.Vector3(0.13, 0.25, 0.01),
        new THREE.Vector3(0.05, 0.24, 0)
      ]);
      const neck = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.026, 9, false), pink);
      neck.scale.y = 0.72; neck.position.y = 0.02; g.add(neck);            /* drooping */
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.040, 16, 12), pink);
      head.position.set(0.05, 0.196, 0); g.add(head);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.020, 0.062, 12), M.plastic(0x2A2A2E));
      beak.rotation.z = 1.9; beak.position.set(0.005, 0.180, 0); g.add(beak);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.020, 8, 26), pink);
      ring.rotation.x = Math.PI / 2; ring.scale.y = 0.5; ring.position.y = 0.02; g.add(ring);
      break;
    }

    case 'bucket': {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.062, 0.115, 24, 1, true), M.plastic(0xE04A2E));
      b.position.y = 0.058; g.add(b);
      const base = new THREE.Mesh(new THREE.CircleGeometry(0.062, 24), M.plastic(0xC43E24));
      base.rotation.x = -Math.PI / 2; base.position.y = 0.001; g.add(base);
      const sand = new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.066, 0.05, 24), M.paper(0xD6C18E));
      sand.position.y = 0.036; g.add(sand);
      /* one handle, one stub where the other was */
      const h = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.006, 7, 22, Math.PI * 0.62), M.plastic(0x2A6EA8));
      h.rotation.set(Math.PI / 2, 0, 1.0); h.position.set(0.02, 0.12, 0); g.add(h);
      break;
    }

    case 'jar': {
      const glass = new THREE.MeshStandardMaterial({
        color: 0xCFE4DA, roughness: 0.10, metalness: 0.12, transparent: true, opacity: 0.55
      });
      const j = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.055, 0.145, 26, 1, true), glass);
      j.position.y = 0.074; g.add(j);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.008, 26), glass);
      base.position.y = 0.004; g.add(base);
      const sand = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.050, 0.085, 26), M.paper(0xD8C393));
      sand.position.y = 0.048; g.add(sand);
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 10, 0, 6.3, 0, Math.PI / 2), M.paper(0xEFE3CE));
      shell.position.set(0.02, 0.092, 0.024); shell.rotation.z = 0.6; g.add(shell);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.061, 0.061, 0.022, 26), M.metal(0x8A6A34));
      lid.position.y = 0.156; g.add(lid);
      break;
    }

    case 'postcard': {
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.100, 0.0018),
        new THREE.MeshStandardMaterial({ map: tex.postcard, roughness: 0.94 }));
      g.add(card);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(0.155, 0.100), M.paper(0xE9E0C8));
      back.position.z = -0.0012; back.rotation.y = Math.PI; g.add(back);
      break;
    }

    case 'poster': {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.30, 22, 1, true),
        M.paper(0x8A6A3E));
      tube.rotation.z = Math.PI / 2; g.add(tube);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.018, 22), M.plastic(0x3A2C18));
      cap.rotation.z = Math.PI / 2; cap.position.x = -0.152; g.add(cap);
      /* a hand's width of it pulled out, so you can see what it is */
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.115, 0.160),
        new THREE.MeshStandardMaterial({ map: tex.poster, roughness: 0.95, side: THREE.DoubleSide }));
      sheet.position.set(0.14, 0.055, 0.03); sheet.rotation.set(-0.2, 0.35, 0.12); g.add(sheet);
      break;
    }
  }
  return g;
}

/* ================================================================= start */

const Hotel = window.Hotel;
const stageEl = document.getElementById('roomStage');

Hotel.ready(async () => {
  /* The key gate.  No key, no room. */
  const allowed = Hotel.gateRoom('102b', { originX: 0.60, originY: 0.46 });
  if (!allowed) return;

  Hotel.say('102B. Mind the mattress. Anything you find in here is yours to sort out.',
    { for: 13000 });

  wireButtons();

  if (Hotel.mode() !== 'full') { liteMode(); return; }

  let stage = null;
  try { stage = await getStage(); } catch (e) { stage = null; }
  if (!stage) { liteMode(); return; }

  try { buildScene(stage); }
  catch (e) { console.error(e); liteMode(); }
});

/* ------------------------------------------------------------ lite mode */

function liteMode() {
  document.documentElement.classList.add('room-flatmode');
  const hint = document.getElementById('roomHint');
  if (hint) hint.textContent = 'Pick something up to read its tag.';
}

/* --------------------------------------------------------- the 3D room */

let scene, camera, planCam, view, objects = {}, held = null, heldTag = null;
let yaw = 0, pitch = 0, yawT = 0, pitchT = 0, dragYaw = 0;
let holdSpin = 0, holdSpinT = 0, holdTilt = 0, holdTiltT = 0;
let bulb, bulbMesh, narrow = 0;
let occluders = [];

/* ---------------------------------------------------------------------------
   THE FLOOR PLAN.  This is the whole room, and getting it right is the point.

       z = DOOR_Z  .. the doorway, the BASE of the triangle, nearest you
                      |<------------- 2 * DOOR_HALF ------------->|
            (-DH, DZ) *------------ the doorway wall -------------* (+DH, DZ)
                       \                                         /
                        \  left wall                right wall  /
                         \      (the mattress)   (the shelves)  /
                          \                                    /
                           \                                  /
       z = CORNER_Z          *------------------------------*
                                      the far corner, dead ahead

   You stand just inside the doorway and look INTO the corner: the left wall
   fills the left of the view and recedes toward the middle, the right wall
   fills the right and recedes toward the middle, and they meet on a vertical
   line in the middle distance.  Floor, ceiling, both walls and the doorway
   wall behind you close the room completely: there is no void anywhere.

   Getting this backwards gives a convex corner jutting at the camera like the
   spine of an open book, with the page showing through either side.  Use
   ?plan=1 to check: it draws the room from above with the camera marked, and
   it must be a triangle with the camera at the base looking at the apex.
   --------------------------------------------------------------------------- */

const DOOR_HALF = 1.50;
const DOOR_Z    = 2.00;
const CORNER_Z  = -0.90;      /* 2.9 m from the doorway: a small room */
const CEIL      = 2.45;
const WALL_A    = Math.atan2(DOOR_Z - CORNER_Z, DOOR_HALF);   /* the wall's cant */
const WALL_LEN  = Math.hypot(DOOR_HALF, DOOR_Z - CORNER_Z);
const EYE       = { x: 0, y: 1.52, z: 1.86 };                 /* in the doorway */

function buildScene(stage) {
  const R = stage.renderer;
  R.shadowMap.enabled = true;
  R.shadowMap.type = THREE.PCFSoftShadowMap;
  /* One bare bulb in a small room blows out to white without this.  Tone
     mapping is what gives the warm falloff and keeps the far corner gloomy.
     It does not touch the paper fire: that shader does its own clamp and
     gamma and never includes three's tonemapping chunk. */
  R.toneMapping = THREE.ACESFilmicToneMapping;
  R.toneMappingExposure = 1.05;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, 1.6, 0.05, 40);
  camera.position.set(EYE.x, EYE.y, EYE.z);

  const midZ = (DOOR_Z + CORNER_Z) / 2;

  /* --- the two walls -----------------------------------------------------
     The wall on the -x side runs from (-DOOR_HALF, DOOR_Z) to (0, CORNER_Z),
     so its rotation is +WALL_A and its inward normal points +x.  The wall on
     the +x side is its mirror: -WALL_A, normal -x.  Swapping these two signs
     is what turns the room inside out. */
  const wallTex = texWall();
  wallTex.repeat.set(1.9, 1.3);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.97 });

  function wall(side) {                       /* side: -1 left, +1 right */
    const m = new THREE.Mesh(new THREE.PlaneGeometry(WALL_LEN + 0.08, CEIL), wallMat);
    m.position.set(side * DOOR_HALF / 2, CEIL / 2, midZ);
    m.rotation.y = -side * WALL_A;
    m.receiveShadow = true;
    return m;
  }
  const wallLeft  = wall(-1);   /* the mattress leans on this one */
  const wallRight = wall(1);    /* the lost property lines this one */
  scene.add(wallLeft, wallRight);

  /* --- floor, ceiling ---------------------------------------------------- */
  const floorTex = texFloor(); floorTex.repeat.set(1.5, 1.5);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.8),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.94 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, midZ);
  floor.receiveShadow = true;
  scene.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.8),
    new THREE.MeshStandardMaterial({ color: 0x2E2418, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, CEIL, midZ);
  scene.add(ceil);

  /* --- the doorway wall, behind you -------------------------------------- */
  const OPEN_HALF = 0.52, OPEN_TOP = 2.06;
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x53422C, roughness: 0.95 });
  const sideW = DOOR_HALF - OPEN_HALF;
  [-1, 1].forEach((s) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(sideW, CEIL, 0.16), doorMat);
    b.position.set(s * (OPEN_HALF + sideW / 2), CEIL / 2, DOOR_Z);
    b.receiveShadow = true;
    scene.add(b);
  });
  const header = new THREE.Mesh(
    new THREE.BoxGeometry(OPEN_HALF * 2, CEIL - OPEN_TOP, 0.16), doorMat);
  header.position.set(0, OPEN_TOP + (CEIL - OPEN_TOP) / 2, DOOR_Z);
  scene.add(header);

  /* the corridor beyond it, so a glance back lands on carpet */
  const carpetTex = texCarpet(); carpetTex.repeat.set(1.6, 1.6);
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.8),
    new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 0.99 }));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(0, 0.004, DOOR_Z + 0.9);
  scene.add(carpet);
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(3.0, CEIL),
    new THREE.MeshStandardMaterial({ color: 0x14100A, roughness: 1 }));
  backWall.position.set(0, CEIL / 2, DOOR_Z + 1.8);
  backWall.rotation.y = Math.PI;
  scene.add(backWall);

  /* the door itself, open against the corridor side, with its small brass 102B */
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(OPEN_HALF * 2 - 0.04, OPEN_TOP - 0.04, 0.045),
    new THREE.MeshStandardMaterial({ color: 0x4A2A18, roughness: 0.62 }));
  leaf.geometry.translate((OPEN_HALF * 2 - 0.04) / 2, 0, 0);
  leaf.position.set(-OPEN_HALF, (OPEN_TOP - 0.04) / 2, DOOR_Z + 0.12);
  leaf.rotation.y = -1.95;
  scene.add(leaf);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.076),
    new THREE.MeshStandardMaterial({ map: plateTex(), roughness: 0.32, metalness: 0.65 }));
  plate.position.set(0.52, 1.56, 0.024);
  leaf.add(plate);

  /* --- the light: one bare bulb, roughly over the middle of the floor ----- */
  const centreZ = (DOOR_Z + DOOR_Z + CORNER_Z) / 3;      /* the triangle's centroid */
  const flex = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.40, 6),
    new THREE.MeshStandardMaterial({ color: 0x3A2E1E, roughness: 1 }));
  flex.position.set(0, CEIL - 0.20, centreZ);
  scene.add(flex);
  bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.055, 18, 14),
    new THREE.MeshStandardMaterial({
      color: 0xFFE4B0, emissive: 0xFFD9A0, emissiveIntensity: 2.2, roughness: 0.4
    }));
  bulbMesh.position.set(0, CEIL - 0.42, centreZ);
  scene.add(bulbMesh);

  bulb = new THREE.PointLight(0xFFCF92, 5.4, 9, 2.0);
  bulb.position.copy(bulbMesh.position);
  bulb.castShadow = true;
  bulb.shadow.mapSize.set(1024, 1024);
  bulb.shadow.bias = -0.0022;
  bulb.shadow.camera.near = 0.06;
  bulb.shadow.camera.far = 8;
  scene.add(bulb);

  scene.add(new THREE.AmbientLight(0x4A3A24, 0.22));
  scene.add(new THREE.HemisphereLight(0xA88A62, 0x241A10, 0.26));
  /* a cold spill through the doorway behind you */
  const spill = new THREE.PointLight(0xA8BACC, 1.9, 5.0, 2.0);
  spill.position.set(0, 1.9, DOOR_Z + 0.5);
  scene.add(spill);

  /* --- the mattress, tilted up on its side against the LEFT wall ---------- */
  const tickTex = texTicking();
  const mattMat = new THREE.MeshStandardMaterial({ map: tickTex, roughness: 0.96 });
  const mattress = new THREE.Group();
  mattress.position.set(-DOOR_HALF / 2, 0, midZ);
  mattress.rotation.y = WALL_A;                 /* local +x runs toward the corner */
  scene.add(mattress);

  const MW = 1.74, MH = 1.38, MT = 0.22, LEAN = 0.20;
  const slab = new THREE.BoxGeometry(MW, MH, MT, 16, 12, 2);
  saggy(slab, MW, MH, MT);
  const matt = new THREE.Mesh(slab, mattMat);
  matt.castShadow = true; matt.receiveShadow = true;
  /* the top edge rests on the wall, the foot stands out on the floor */
  matt.position.set(0.40, (MH / 2) * Math.cos(LEAN) + 0.01, 0.26);
  matt.rotation.x = -LEAN;
  mattress.add(matt);

  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x8A7A54, roughness: 0.9 });
  [-1, 1].forEach((sgn) => {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, MW, 9), pipeMat);
    pipe.rotation.z = Math.PI / 2;
    pipe.rotation.x = -LEAN;
    pipe.position.set(0.40,
      matt.position.y + sgn * (MH / 2 - 0.01) * Math.cos(LEAN),
      0.26 - sgn * (MH / 2 - 0.01) * Math.sin(LEAN) - sgn * 0.0 + sgn * 0.105 * 0);
    pipe.position.z += sgn * 0.0;
    mattress.add(pipe);
  });
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.20, 0.10),
    new THREE.MeshStandardMaterial({ map: texLabel(), roughness: 0.95, side: THREE.DoubleSide }));
  lbl.position.set(1.00, 0.33, 0.40);
  lbl.rotation.set(-LEAN, 0, -0.12);
  mattress.add(lbl);

  /* --- the lost property, on shelving that follows the RIGHT wall --------- */
  const shelfTex = texShelf();
  const shelfMat = new THREE.MeshStandardMaterial({ map: shelfTex, roughness: 0.78 });
  const shelves = new THREE.Group();
  shelves.position.set(DOOR_HALF / 2, 0, midZ);
  shelves.rotation.y = -WALL_A;                /* local +x runs toward the doorway */
  scene.add(shelves);

  const SH_Y = [0.44, 0.92, 1.40];
  const SH_W = 2.20, SH_D = 0.32, SH_MID = -0.25;
  SH_Y.forEach((y) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(SH_W, 0.035, SH_D), shelfMat);
    b.position.set(SH_MID, y, SH_D / 2 - 0.01);
    b.castShadow = true; b.receiveShadow = true;
    shelves.add(b);
  });
  [SH_MID - SH_W / 2, SH_MID + SH_W / 2].forEach((x) => {
    const u = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.62, SH_D), shelfMat);
    u.position.set(x, 0.80, SH_D / 2 - 0.01);
    u.castShadow = true; u.receiveShadow = true;
    u.userData.thin = true;          /* never an occluder: see below */
    shelves.add(u);
  });

  const tex = {
    book: texBook(),
    postcard: loadTex('img/reward-postcard-01.jpg'),
    poster: loadTex('img/reward-poster-01.jpg')
  };

  /* Where each thing stands along the wall.  The bottom shelf is the lowest
     and the most glancing, so its four places are pulled into a narrower band
     than the two above it: right at the ends nothing on it can be seen. */
  const SLOT_X = [
    [-1.02, -0.58, -0.14, 0.28],      /* bottom */
    [-1.12, -0.56,  0.02, 0.56],      /* middle */
    [-1.12, -0.56,  0.02, 0.56]       /* top */
  ];
  OBJECTS.forEach((o) => {
    const g = build(o.id, tex);
    g.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
    const k = SIZE[o.id] || 1;
    g.scale.setScalar(k);
    const home = new THREE.Vector3(SLOT_X[o.shelf][o.slot],
      SH_Y[o.shelf] + 0.018 + (LIFT[o.id] || 0) * k, 0.15);
    g.position.copy(home);
    const tip = TIP[o.id] || [0, 0, 0];
    g.rotation.set(tip[0], tip[1] + (-0.45 + (o.slot * 0.31 + o.shelf * 0.17) % 0.9), tip[2]);
    shelves.add(g);
    const box = new THREE.Box3().setFromObject(g);
    objects[o.id] = {
      def: o, group: g, home: home.clone(), homeRot: g.rotation.clone(),
      homeScale: k, parent: shelves,
      radius: Math.max(0.06, box.getSize(new THREE.Vector3()).length() * 0.5)
    };
  });

  /* the tag that swings round when you pick something up */
  heldTag = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.2625),
    new THREE.MeshStandardMaterial({ roughness: 0.95, side: THREE.DoubleSide, transparent: true }));
  heldTag.visible = false;
  scene.add(heldTag);

  /* What can genuinely stand between you and a thing on a shelf.  The
     uprights are left out on purpose: they are 45 mm boards seen at a
     glancing angle, and counting them hides a whole shelf's worth of things
     that you can plainly see. */
  occluders = [wallLeft, wallRight, floor, ceil, matt];
  shelves.children.forEach((c) => {
    if (c.isMesh && !c.userData.thin && !c.userData.__id) occluders.push(c);
  });

  /* --- the plan view, for checking the room is the right way round -------- */
  if (PLAN) buildPlan();

  /* --- the view ---------------------------------------------------------- */
  view = stage.addView({
    el: stageEl,
    scene,
    camera: PLAN ? planCam : camera,
    resize(w, h) {
      const a = w / Math.max(1, h);
      camera.aspect = a;
      camera.fov = a < 0.95 ? 90 : (a < 1.25 ? 80 : 70);
      narrow = a < 0.95 ? 1 : (a < 1.25 ? 0.5 : 0);
      camera.updateProjectionMatrix();
      if (planCam) {
        const s = 2.6;
        planCam.left = -s * a; planCam.right = s * a;
        planCam.top = s; planCam.bottom = -s;
        planCam.updateProjectionMatrix();
      }
    },
    onFrame(dt) {
      const k = Hotel.stillFrame ? 1 : 1 - Math.pow(0.0015, Math.max(0.001, dt));
      yaw += (yawT + dragYaw - yaw) * k;
      pitch += (pitchT - pitch) * k;

      /* You never leave the doorway: a little sway, and the look is clamped. */
      camera.position.set(EYE.x + Math.sin(yaw) * 0.14,
        EYE.y - narrow * 0.10 + pitch * 0.08, EYE.z);
      camera.lookAt(Math.sin(yaw) * 2.4, 1.16 - narrow * 0.10 + pitch * 1.1, CORNER_Z - 0.2);

      if (held) {
        holdSpin += (holdSpinT - holdSpin) * k;
        holdTilt += (holdTiltT - holdTilt) * k;
        /* animate the GROUP's rotation only; its placement lives on .position,
           so a tween can never clobber where the thing actually is */
        held.group.rotation.set(holdTilt, holdSpin, 0);
      }
      if (bulbMesh && !Hotel.stillFrame) {
        const t = performance.now() / 1000;
        bulbMesh.position.x = Math.sin(t * 0.7) * 0.012;
        bulb.position.x = bulbMesh.position.x;
      }
      placeButtons();
    }
  });

  /* --- looking around ---------------------------------------------------- */
  let dragging = false, lastX = 0, downX = 0, downY = 0, moved = false;

  stageEl.addEventListener('pointermove', (e) => {
    const r = stageEl.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (dragging && held) {
      holdSpinT += (e.clientX - lastX) * 0.012;
      lastX = e.clientX;
      return;
    }
    if (dragging) {
      dragYaw = clamp(dragYaw + (lastX - e.clientX) * 0.0018, -0.20, 0.20);
      lastX = e.clientX;
      return;
    }
    yawT = clamp(-nx * 0.24, -0.26, 0.26);
    pitchT = clamp(-ny * 0.20, -0.26, 0.26);
  }, { passive: true });

  stageEl.addEventListener('pointerleave', () => { yawT = 0; pitchT = 0; });
  stageEl.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.held') || e.target.closest('.room-out')) return;
    dragging = true; lastX = e.clientX; downX = e.clientX; downY = e.clientY; moved = false;
    if (stageEl.setPointerCapture) { try { stageEl.setPointerCapture(e.pointerId); } catch (err) {} }
  });
  stageEl.addEventListener('pointermove', (e) => {
    if (dragging && (Math.abs(e.clientX - downX) > 6 || Math.abs(e.clientY - downY) > 6)) moved = true;
  }, { passive: true });
  const release = (e) => {
    if (!dragging) return;
    dragging = false;
    if (!moved && !e.target.closest('.lost-btn') && !e.target.closest('.held')) pick3d(e);
  };
  stageEl.addEventListener('pointerup', release);
  stageEl.addEventListener('pointercancel', () => { dragging = false; });

  /* --- screenshot hooks --------------------------------------------------- */
  if (LOOK === 'left') { yawT = -0.26; dragYaw = -0.20; }    /* the mattress */
  if (LOOK === 'right') { yawT = 0.26; dragYaw = 0.20; }     /* the shelves */
  if (PICK && objects[PICK]) window.setTimeout(() => takeUp(PICK), 60);

  document.documentElement.classList.add('room-3d');
  placeButtons();

  /* A small read-only helper the harness uses to check that every accessible
     button really does sit over its object.  Harmless in production. */
  window.Room102B = {
    ids: Object.keys(objects),
    /* the object's projected screen box, in page pixels */
    bounds(id) {
      const o = objects[id];
      if (!o || !camera) return null;
      camera.updateMatrixWorld(true);
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(o.group);
      const r = stageEl.getBoundingClientRect();
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, ok = false;
      for (let i = 0; i < 8; i++) {
        const v = new THREE.Vector3(
          i & 1 ? box.max.x : box.min.x,
          i & 2 ? box.max.y : box.min.y,
          i & 4 ? box.max.z : box.min.z).project(camera);
        if (v.z < 1) ok = true;
        const px = r.left + (v.x * 0.5 + 0.5) * r.width;
        const py = r.top + (-v.y * 0.5 + 0.5) * r.height;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px);
        y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      return ok ? { x0, y0, x1, y1 } : null;
    },
    visible(id) {
      const b = btnFor(id);
      return !!(b && b.parentNode.style.opacity !== '0');
    }
  };
}

/* A top-down orthographic check of the floor plan.  ?plan=1 draws the room
   from above with the camera marked and its view cone: it MUST read as a
   triangle with the camera at the base, looking at the apex. */
function buildPlan() {
  planCam = new THREE.OrthographicCamera(-4, 4, 2.6, -2.6, 0.1, 30);
  planCam.position.set(0, 9, (DOOR_Z + CORNER_Z) / 2 + 0.4);
  planCam.up.set(0, 0, -1);
  planCam.lookAt(0, 0, (DOOR_Z + CORNER_Z) / 2 + 0.4);

  const mark = new THREE.Group();
  mark.position.y = CEIL + 0.5;                /* above the ceiling, always seen */
  scene.add(mark);

  /* the camera, and the cone it can see */
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.30, 3),
    new THREE.MeshBasicMaterial({ color: 0x33FF88 }));
  cone.position.set(EYE.x, 0, EYE.z);
  cone.rotation.x = Math.PI;                   /* point it down the room */
  mark.add(cone);

  const g = new THREE.BufferGeometry();
  const far = 4.0, spread = 1.05;
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    EYE.x, 0, EYE.z, EYE.x - spread * far, 0, EYE.z - far,
    EYE.x, 0, EYE.z, EYE.x + spread * far, 0, EYE.z - far
  ], 3));
  mark.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x33FF88 })));

  /* the triangle the room is supposed to be */
  const t = new THREE.BufferGeometry();
  t.setAttribute('position', new THREE.Float32BufferAttribute([
    -DOOR_HALF, 0, DOOR_Z, 0, 0, CORNER_Z,
    DOOR_HALF, 0, DOOR_Z, 0, 0, CORNER_Z,
    -DOOR_HALF, 0, DOOR_Z, DOOR_HALF, 0, DOOR_Z
  ], 3));
  mark.add(new THREE.LineSegments(t, new THREE.LineBasicMaterial({ color: 0xFF4488 })));

  /* the ceiling would hide everything from above */
  scene.traverse((n) => {
    if (n.isMesh && n.rotation.x === Math.PI / 2 && n.position.y === CEIL) n.visible = false;
  });
  scene.add(new THREE.AmbientLight(0xFFFFFF, 2.2));
}

function plateTex() {
  const [c, g] = cnv(256, 112);
  const grad = g.createLinearGradient(0, 0, 0, 112);
  grad.addColorStop(0, '#E4C87E'); grad.addColorStop(0.5, '#B08A2E'); grad.addColorStop(1, '#6E5418');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 112);
  g.fillStyle = '#231A06';
  g.font = '600 58px Cinzel, Georgia, serif';
  g.textAlign = 'center';
  g.fillText('102B', 128, 76);
  grainy(g, 256, 112, 14);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function loadTex(url) {
  const t = new THREE.TextureLoader().load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Push the middle of the slab in: a mattress that has been slept on. */
function saggy(geo, w, h, t) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const fx = 1 - Math.pow(Math.abs(x) / (w / 2), 2);
    const fy = 1 - Math.pow(Math.abs(y) / (h / 2), 2);
    const dip = fx * fy;
    if (Math.abs(z) > t / 2 - 0.001) {
      p.setZ(i, z * (1 - 0.30 * dip));
      p.setY(i, y - 0.045 * dip * (y > 0 ? 1 : -0.4));
    }
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

/* ------------------------------------------------ picking things up (3D) */

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function pick3d(e) {
  const r = stageEl.getBoundingClientRect();
  ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  ray.setFromCamera(ndc, camera);
  const groups = Object.keys(objects).map((k) => objects[k].group);
  const hits = ray.intersectObjects(groups, true);
  if (!hits.length) { if (held) putBack(); return; }
  let n = hits[0].object;
  while (n && !n.userData.__id) {
    for (const k in objects) if (objects[k].group === n) { n.userData.__id = k; break; }
    if (n.userData.__id) break;
    n = n.parent;
  }
  if (n && n.userData.__id) takeUp(n.userData.__id);
}

/* --------------------------------------------------- pick up / put back */

const heldEl = document.getElementById('held');
const heldName = document.getElementById('heldName');
const heldTagEl = document.getElementById('heldTag');
const heldAct = document.getElementById('heldAct');
const heldBack = document.getElementById('heldBack');

function btnFor(id) { return document.querySelector('.lost-btn[data-obj="' + id + '"]'); }
function textFor(id) {
  const b = btnFor(id);
  return {
    name: b ? b.querySelector('.lost-name').textContent.trim() : id,
    story: b ? b.querySelector('.tag-line').textContent.trim() : ''
  };
}

function takeUp(id) {
  const o = objects[id];
  const t = textFor(id);
  showHeldCard(id, t);

  if (!o) return;                                 /* lite mode: the card is all */
  if (held && held.def.id !== id) putBack(true);
  held = o;
  holdSpinT = holdSpin = 0; holdTiltT = holdTilt = -0.12;

  /* move it out of the shelf and into your hands */
  scene.attach(o.group);
  /* Out of the shelf and into your hands: a fixed distance IN FRONT of the
     camera along the way it is looking.  Never a hard-coded z - the camera
     moved into the doorway and a hard-coded z put this behind it. */
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const target = camera.position.clone()
    .addScaledVector(dir, 0.95)
    .add(new THREE.Vector3(-0.24, -0.09, 0));
  const g = window.gsap;
  if (g && !Hotel.stillFrame) {
    g.to(o.group.position, { x: target.x, y: target.y, z: target.z, duration: 0.7, ease: 'power3.out' });
    const K = 1.20;
    g.to(o.group.scale, { x: K, y: K, z: K, duration: 0.7, ease: 'power3.out' });
  } else {
    o.group.position.copy(target);
    o.group.scale.setScalar(1.20);
  }

  /* the tag swings round */
  heldTag.material.map = texTag(t.name, t.story);
  heldTag.material.needsUpdate = true;
  heldTag.visible = true;
  heldTag.position.set(target.x + 0.52, target.y - 0.05, target.z + 0.06);
  if (g && !Hotel.stillFrame) {
    g.fromTo(heldTag.rotation, { y: -1.9, z: 0.5 },
      { y: -0.34, z: 0.10, duration: 0.85, ease: 'elastic.out(1, 0.6)' });
    g.fromTo(heldTag.material, { opacity: 0 }, { opacity: 1, duration: 0.35 });
  } else {
    heldTag.rotation.set(0, -0.34, 0.10);
    heldTag.material.opacity = 1;
  }

  if (Hotel.sound.isOn()) Hotel.sound.play('rustle');
}

function showHeldCard(id, t) {
  const def = OBJECTS.filter((o) => o.id === id)[0] || {};
  heldName.textContent = t.name;
  heldTagEl.textContent = t.story;
  heldEl.hidden = false;
  stageEl.classList.add('is-holding');

  const doneAlready =
    (def.does === 'keep' && Hotel.carrying(def.find)) ||
    (def.does === 'take' && Hotel.carrying('hat')) ||
    (def.does === 'shake' && Hotel.has('k-214'));

  if (def.does && !doneAlready) {
    heldAct.hidden = false;
    heldAct.textContent = ACT_LABEL[def.does];
    heldAct.dataset.obj = id;
    heldAct.dataset.does = def.does;
  } else {
    heldAct.hidden = true;
  }
  Hotel.announce(t.name + '. ' + t.story);
  document.querySelectorAll('.lost-btn').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.obj === id));
  });
}

function putBack(quiet) {
  heldEl.hidden = true;
  stageEl.classList.remove('is-holding');
  document.querySelectorAll('.lost-btn').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  if (!held) return;
  const o = held;
  held = null;
  const g = window.gsap;
  o.parent.attach(o.group);
  if (g && !Hotel.stillFrame) {
    g.to(o.group.position, { x: o.home.x, y: o.home.y, z: o.home.z, duration: 0.55, ease: 'power2.inOut' });
    g.to(o.group.scale, { x: o.homeScale, y: o.homeScale, z: o.homeScale, duration: 0.55, ease: 'power2.inOut' });
    g.to(o.group.rotation, { x: o.homeRot.x, y: o.homeRot.y, z: o.homeRot.z, duration: 0.55 });
    g.to(heldTag.material, { opacity: 0, duration: 0.25, onComplete: () => { heldTag.visible = false; } });
  } else {
    o.group.position.copy(o.home);
    o.group.scale.setScalar(o.homeScale);
    o.group.rotation.copy(o.homeRot);
    heldTag.visible = false;
  }
  if (!quiet && Hotel.sound.isOn()) Hotel.sound.play('rustle');
}

/* ----------------------------------------------- what the objects DO */

function wireButtons() {
  document.querySelectorAll('.lost-btn').forEach((b) => {
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => takeUp(b.dataset.obj));
  });
  heldBack.addEventListener('click', () => { putBack(); });
  heldAct.addEventListener('click', () => {
    const id = heldAct.dataset.obj;
    const does = heldAct.dataset.does;
    if (does === 'shake') shakeJar();
    else if (does === 'take') takeHat();
    else if (does === 'keep') keepIt(id);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !heldEl.hidden) { putBack(); }
  });
}

/* the jar: something in the sand has been rattling all along */
function shakeJar() {
  const o = objects.jar;
  const g = window.gsap;
  if (o && g && !Hotel.stillFrame) {
    g.fromTo(o.group.rotation, { z: -0.2 }, { z: 0.2, duration: 0.07, repeat: 7, yoyo: true,
      onComplete: () => { g.to(o.group.rotation, { z: 0, duration: 0.2 }); } });
  }
  if (Hotel.sound.isOn()) Hotel.sound.play('jingle');
  window.setTimeout(() => {
    const got = Hotel.giveKey('k-214', { from: stageEl });
    heldAct.hidden = true;
    if (got) {
      Hotel.say('That was in the sand the whole time. Key 214. Room 214 is Tino\'s black book.',
        { for: 13000 });
    }
  }, Hotel.stillFrame ? 0 : 620);
}

/* the tiny hat: somebody on the ground floor is missing it */
function takeHat() {
  Hotel.addFound('hat');
  heldAct.hidden = true;
  putBack(true);
  Hotel.say('In your passport. Whoever owns that is not on this floor.', { for: 12000 });
}

/* the postcard and the poster: keep them */
function keepIt(id) {
  const def = OBJECTS.filter((o) => o.id === id)[0];
  if (!def || !def.find) return;
  Hotel.addFound(def.find);
  heldAct.hidden = true;
  Hotel.say(def.find === 'postcard'
    ? 'Kept. It is in your passport, still unposted.'
    : 'Kept. It is in your passport, still rolled.', { for: 11000 });
  if (Hotel.sound.isOn()) Hotel.sound.play('rustle');
}

/* --------------------------------------- the buttons, over the objects */
const proj = new THREE.Vector3();
const occRay = new THREE.Raycaster();
const camPos = new THREE.Vector3();
const dirTo = new THREE.Vector3();
let occTick = 0;
const occluded = {};

/* Each accessible button is moved on to its object every frame and hidden
   when the object is off screen or behind something.  At rest the button
   shows nothing at all: the object itself is the affordance.  A name appears
   on hover and on keyboard focus, with a visible ring on :focus-visible. */
function placeButtons() {
  if (!camera || document.documentElement.classList.contains('room-flatmode')) return;

  /* The renderer updates these inside render(), which has not run yet this
     frame.  Without it the first frame projects against an identity camera
     and every button lands in the middle of the picture. */
  camera.updateMatrixWorld(true);
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  scene.updateMatrixWorld(true);
  camera.getWorldPosition(camPos);

  /* occlusion is steady between frames, so it does not need doing on all of
     them: twelve rays against a dozen boxes, every third frame */
  const doOcc = (occTick++ % 3) === 0 && occluders.length > 0;

  for (const id in objects) {
    const b = btnFor(id);
    if (!b) continue;
    const o = objects[id];
    const li = b.parentNode;

    o.group.getWorldPosition(proj);
    if (held && held.def.id === id) proj.y += 0.10;

    if (doOcc) {
      dirTo.copy(proj).sub(camPos);
      const dist = dirTo.length();
      dirTo.divideScalar(dist);
      occRay.set(camPos, dirTo);
      occRay.far = Math.max(0.01, dist - o.radius * 0.85);
      occluded[id] = occRay.intersectObjects(occluders, false).length > 0;
    }

    proj.project(camera);
    const x = (proj.x * 0.5 + 0.5) * 100;
    const y = (-proj.y * 0.5 + 0.5) * 100;
    const onScreen = proj.z < 1 && x > -4 && x < 104 && y > -4 && y < 104;
    const show = onScreen && !occluded[id];

    li.style.setProperty('--x', x + '%');
    li.style.setProperty('--y', y + '%');
    li.style.opacity = show ? '1' : '0';
    li.style.pointerEvents = show ? 'auto' : 'none';
    b.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (!show && document.activeElement === b) b.blur();
  }
}
