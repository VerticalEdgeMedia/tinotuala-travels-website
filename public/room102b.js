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

let scene, camera, view, objects = {}, held = null, heldTag = null;
let yaw = 0, pitch = 0, yawT = 0, pitchT = 0, dragYaw = 0;
let holdSpin = 0, holdSpinT = 0, holdTilt = 0, holdTiltT = 0;
let bulb, bulbMesh, narrow = 0;

function buildScene(stage) {
  const R = stage.renderer;
  R.shadowMap.enabled = true;
  R.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(54, 1.6, 0.05, 40);
  camera.position.set(0, 1.34, 3.25);

  /* --- the shell.  A triangle: the doorway, and two walls meeting at a
     corner directly opposite it. ----------------------------------------- */
  /* A wide, shallow triangle.  Deeper than this and both walls go nearly
     edge-on from the doorway and you cannot read either of them. */
  const DOOR_HALF = 1.42, DOOR_Z = 1.70, CORNER_Z = -1.62, CEIL = 2.30;
  const dx = DOOR_HALF, dz = DOOR_Z - CORNER_Z;              /* 1.05, 4.10 */
  const wallLen = Math.hypot(dx, dz) + 0.06;
  const A = Math.atan2(dz, dx);                              /* the wall's cant */

  /* An outer shell.  The canvas is transparent, so any gap at the edge of
     the frame would show the page through it.  This box guarantees there
     is none, at any width. */
  const outside = new THREE.Mesh(new THREE.BoxGeometry(16, 9, 16),
    new THREE.MeshBasicMaterial({ color: 0x0A0806, side: THREE.BackSide }));
  outside.position.set(0, 2.2, 0);
  scene.add(outside);

  const wallTex = texWall();
  wallTex.repeat.set(2.1, 1.25);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.97 });

  function wall(sign) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wallLen, CEIL), wallMat);
    m.position.set(sign * dx / 2, CEIL / 2, (DOOR_Z + CORNER_Z) / 2);
    m.rotation.y = sign * A;
    m.receiveShadow = true;
    return m;
  }
  const wallL = wall(1);            /* the mattress goes on this one */
  const wallR = wall(-1);           /* the lost property goes on this one */
  scene.add(wallL, wallR);

  const floorTex = texFloor(); floorTex.repeat.set(1.6, 2.4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 4.0),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.94 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, CORNER_Z + 1.7);
  floor.receiveShadow = true;
  scene.add(floor);

  /* the corridor, behind you, through the door */
  const carpetTex = texCarpet(); carpetTex.repeat.set(2.2, 2.2);
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.4),
    new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 0.99 }));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(0, 0.003, DOOR_Z + 1.2);
  scene.add(carpet);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 4.0),
    new THREE.MeshStandardMaterial({ color: 0x2A2118, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, CEIL, CORNER_Z + 1.7);
  scene.add(ceil);

  /* The corridor side.  You stand at the threshold and look through the
     opening, so the wall around the door is what frames the room.  It is
     built as three boxes: left of the opening, right of it, and the header. */
  const OPEN_TOP = 2.04;
  const corridorMat = new THREE.MeshStandardMaterial({ color: 0x2A1D12, roughness: 0.95 });
  const sideW = 3.0;
  const wLeft = new THREE.Mesh(new THREE.BoxGeometry(sideW, 3.2, 0.24), corridorMat);
  wLeft.position.set(-DOOR_HALF - sideW / 2 - 0.06, 1.6, DOOR_Z);
  const wRight = wLeft.clone();
  wRight.position.x = DOOR_HALF + sideW / 2 + 0.06;
  const header = new THREE.Mesh(new THREE.BoxGeometry(DOOR_HALF * 2 + 0.24, 3.2 - OPEN_TOP + 0.4, 0.24), corridorMat);
  header.position.set(0, OPEN_TOP + (3.2 - OPEN_TOP + 0.4) / 2 - 0.2, DOOR_Z);
  wLeft.receiveShadow = wRight.receiveShadow = header.receiveShadow = true;
  scene.add(wLeft, wRight, header);

  /* the architrave, a lighter frame around the opening */
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x4A3420, roughness: 0.75 });
  const jambL = new THREE.Mesh(new THREE.BoxGeometry(0.11, OPEN_TOP + 0.11, 0.09), frameMat);
  jambL.position.set(-DOOR_HALF - 0.055, (OPEN_TOP + 0.11) / 2, DOOR_Z + 0.16);
  const jambR = jambL.clone(); jambR.position.x = DOOR_HALF + 0.055;
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(DOOR_HALF * 2 + 0.22, 0.11, 0.09), frameMat);
  lintel.position.set(0, OPEN_TOP + 0.055, DOOR_Z + 0.16);
  scene.add(jambL, jambR, lintel);

  /* the door itself, standing open into the corridor so it blocks nothing */
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(DOOR_HALF * 2 - 0.04, OPEN_TOP - 0.05, 0.048),
    new THREE.MeshStandardMaterial({ color: 0x4A2A18, roughness: 0.62 }));
  leaf.geometry.translate((DOOR_HALF * 2 - 0.04) / 2, 0, 0);
  leaf.position.set(-DOOR_HALF - 0.02, (OPEN_TOP - 0.05) / 2, DOOR_Z + 0.26);
  leaf.rotation.y = -2.02;                          /* pulled back into the corridor */
  leaf.castShadow = true;
  scene.add(leaf);

  /* the small brass 102B, the only thing on the door */
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.085),
    new THREE.MeshStandardMaterial({ map: plateTex(), roughness: 0.32, metalness: 0.65 }));
  plate.position.set(1.62, 1.58, 0.026);
  leaf.add(plate);

  /* --- the light: one bare bulb ---------------------------------------- */
  const flex = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.42, 6),
    new THREE.MeshStandardMaterial({ color: 0x3A2E1E, roughness: 1 }));
  flex.position.set(0, CEIL - 0.19, -0.18);
  scene.add(flex);
  bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.055, 18, 14),
    new THREE.MeshStandardMaterial({ color: 0xFFE4B0, emissive: 0xFFD9A0, emissiveIntensity: 2.4, roughness: 0.4 }));
  bulbMesh.position.set(0, CEIL - 0.40, -0.18);
  scene.add(bulbMesh);

  bulb = new THREE.PointLight(0xFFCF92, 42, 12, 1.25);
  bulb.position.copy(bulbMesh.position);
  bulb.castShadow = true;
  bulb.shadow.mapSize.set(1024, 1024);
  bulb.shadow.bias = -0.0022;
  bulb.shadow.camera.near = 0.08;
  bulb.shadow.camera.far = 9;
  scene.add(bulb);

  scene.add(new THREE.AmbientLight(0x6B5436, 1.7));
  /* a little cold light coming in from the corridor behind you */
  const spill = new THREE.PointLight(0xAFC2D4, 9, 8, 1.5);
  spill.position.set(0.4, 2.0, DOOR_Z + 1.5);
  scene.add(spill);

  /* a second, weaker bulb-bounce down in the corner: without it the far end
     of the shelves is a black hole and you cannot see what is on them */
  const corner = new THREE.PointLight(0xE8C089, 14, 5.5, 1.35);
  corner.position.set(0.42, 1.35, -0.35);
  scene.add(corner);
  /* and one on the mattress, or that half of the room is a black wall */
  const onMatt = new THREE.PointLight(0xEACB9B, 8, 4.4, 1.5);
  onMatt.position.set(-0.60, 1.55, 0.75);
  scene.add(onMatt);

  /* the light the walls throw back at each other in a room this small */
  const bounce = new THREE.HemisphereLight(0xD3B289, 0x3A2A18, 1.15);
  scene.add(bounce);

  /* --- the mattress, tilted up on its side, leaning on the left wall ----- */
  const tickTex = texTicking();
  const mattMat = new THREE.MeshStandardMaterial({ map: tickTex, roughness: 0.96 });
  const mattress = new THREE.Group();
  mattress.position.set(-dx / 2, 0, (DOOR_Z + CORNER_Z) / 2);
  mattress.rotation.y = A;
  scene.add(mattress);

  const MW = 1.88, MH = 1.40, MT = 0.24;
  const slab = new THREE.BoxGeometry(MW, MH, MT, 18, 14, 2);
  saggy(slab, MW, MH, MT);
  const matt = new THREE.Mesh(slab, mattMat);
  matt.castShadow = true; matt.receiveShadow = true;
  matt.position.set(-0.42, MH / 2 - 0.02, 0.26);
  matt.rotation.x = 0.165;                          /* leaning back on the wall */
  mattress.add(matt);

  /* piping along the two long seams */
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x8A7A54, roughness: 0.9 });
  [-1, 1].forEach((s) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, MW, 9), pipeMat);
    p.rotation.z = Math.PI / 2;
    p.position.set(-0.42, MH / 2 - 0.02 + s * (MH / 2 - 0.01), 0.26 - s * 0.115);
    p.rotation.x = 0.165;
    mattress.add(p);
  });
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.095),
    new THREE.MeshStandardMaterial({ map: texLabel(), roughness: 0.95, side: THREE.DoubleSide }));
  lbl.position.set(0.20, 0.30, 0.395); lbl.rotation.set(0.165, 0, -0.14);
  mattress.add(lbl);

  /* --- the shelves, and everything people left behind ------------------- */
  const shelfTex = texShelf();
  const shelfMat = new THREE.MeshStandardMaterial({ map: shelfTex, roughness: 0.78 });
  const shelves = new THREE.Group();
  shelves.position.set(dx / 2, 0, (DOOR_Z + CORNER_Z) / 2);
  shelves.rotation.y = -A;
  scene.add(shelves);

  const SH_Y = [0.62, 1.20, 1.76];
  const SH_W = 2.45, SH_D = 0.34;
  SH_Y.forEach((y) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(SH_W, 0.035, SH_D), shelfMat);
    b.position.set(0.42, y, SH_D / 2 - 0.01);
    b.castShadow = true; b.receiveShadow = true;
    shelves.add(b);
  });
  [-0.74, 0.44, 1.60].forEach((x) => {
    const u = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.98, SH_D), shelfMat);
    u.position.set(x, 0.99, SH_D / 2 - 0.01);
    u.castShadow = true; u.receiveShadow = true;
    shelves.add(u);
  });

  const tex = {
    book: texBook(),
    postcard: loadTex('img/reward-postcard-01.jpg'),
    poster: loadTex('img/reward-poster-01.jpg')
  };

  const SLOT_X = [-0.30, 0.16, 0.78, 1.28];
  OBJECTS.forEach((o) => {
    const g = build(o.id, tex);
    g.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
    const k = SIZE[o.id] || 1;
    g.scale.setScalar(k);
    const home = new THREE.Vector3(SLOT_X[o.slot],
      SH_Y[o.shelf] + 0.018 + (LIFT[o.id] || 0) * k, 0.155);
    g.position.copy(home);
    const tip = TIP[o.id] || [0, 0, 0];
    g.rotation.set(tip[0], tip[1] + (-0.45 + (o.slot * 0.31 + o.shelf * 0.17) % 0.9), tip[2]);
    shelves.add(g);
    objects[o.id] = {
      def: o, group: g, home: home.clone(),
      homeRot: g.rotation.clone(), homeScale: k, parent: shelves
    };
  });

  /* the tag that swings round when you pick something up */
  heldTag = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.3375),
    new THREE.MeshStandardMaterial({ roughness: 0.95, side: THREE.DoubleSide, transparent: true }));
  heldTag.visible = false;
  scene.add(heldTag);

  /* --- the view ---------------------------------------------------------- */
  view = stage.addView({
    el: stageEl,
    scene,
    camera,
    resize(w, h) {
      const a = w / Math.max(1, h);
      camera.aspect = a;
      /* A small room in a portrait box needs a much wider lens, or the
         shelves fall straight off the side of the frame. */
      camera.fov = a < 0.95 ? 88 : (a < 1.25 ? 72 : 54);
      narrow = a < 0.95 ? 1 : (a < 1.25 ? 0.5 : 0);
      camera.updateProjectionMatrix();
    },
    onFrame(dt) {
      const k = Hotel.stillFrame ? 1 : 1 - Math.pow(0.0015, Math.max(0.001, dt));
      yaw += (yawT + dragYaw - yaw) * k;
      pitch += (pitchT - pitch) * k;
      camera.rotation.set(0, 0, 0);
      /* You never leave the threshold: a little sway, and the look clamps. */
      /* a wide lens in a portrait box takes in a lot of lintel, so the
         camera drops and aims a little lower */
      camera.position.set(Math.sin(yaw) * 0.18, 1.34 - narrow * 0.18 + pitch * 0.10, 3.25 - narrow * 0.25);
      camera.lookAt(Math.sin(yaw) * 2.8, 1.02 - narrow * 0.24 + pitch * 1.25, -0.9);

      if (held) {
        holdSpin += (holdSpinT - holdSpin) * k;
        holdTilt += (holdTiltT - holdTilt) * k;
        held.group.rotation.set(holdTilt, holdSpin, 0);
      }
      if (bulbMesh && !Hotel.stillFrame) {
        /* the flex has not stopped moving since somebody shut the door */
        const t = performance.now() / 1000;
        bulbMesh.position.x = Math.sin(t * 0.7) * 0.012;
        bulb.position.x = bulbMesh.position.x;
      }
      placeButtons();
    }
  });

  /* --- looking around ---------------------------------------------------- */
  stageEl.addEventListener('pointermove', (e) => {
    const r = stageEl.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (dragging && held) {
      /* turning the thing you are holding: sideways only, so a vertical
         swipe still scrolls the page */
      holdSpinT += (e.clientX - lastX) * 0.012;
      lastX = e.clientX;
      return;
    }
    if (dragging) {
      dragYaw = clamp(dragYaw + (lastX - e.clientX) * 0.0020, -0.26, 0.26);
      lastX = e.clientX;
      return;
    }
    yawT = clamp(-nx * 0.26, -0.30, 0.30);
    pitchT = clamp(-ny * 0.20, -0.26, 0.26);
  }, { passive: true });

  stageEl.addEventListener('pointerleave', () => { yawT = 0; pitchT = 0; });

  let dragging = false, lastX = 0, downX = 0, downY = 0, moved = false;
  stageEl.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.held')) return;
    dragging = true; lastX = e.clientX; downX = e.clientX; downY = e.clientY; moved = false;
    stageEl.setPointerCapture && stageEl.setPointerCapture(e.pointerId);
  });
  stageEl.addEventListener('pointermove', (e) => {
    if (dragging && (Math.abs(e.clientX - downX) > 6 || Math.abs(e.clientY - downY) > 6)) moved = true;
  }, { passive: true });
  const release = (e) => {
    if (!dragging) return;
    dragging = false;
    if (!moved && !e.target.closest('.lost-btn') && !e.target.closest('.held')) {
      pick3d(e);
    }
  };
  stageEl.addEventListener('pointerup', release);
  stageEl.addEventListener('pointercancel', () => { dragging = false; });

  /* --- screenshot hooks --------------------------------------------------- */
  if (LOOK === 'left') { yawT = -0.30; dragYaw = -0.24; }    /* the mattress */
  if (LOOK === 'right') { yawT = 0.30; dragYaw = 0.24; }     /* the shelves */
  if (PICK && objects[PICK]) window.setTimeout(() => takeUp(PICK), 60);

  document.documentElement.classList.add('room-3d');
  placeButtons();
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
  /* out of the shelf and into your hands, just in front of the doorway */
  const target = new THREE.Vector3(Math.sin(yaw) * 0.5 - 0.34, 1.24 + pitch * 0.4, 1.95);
  const g = window.gsap;
  if (g && !Hotel.stillFrame) {
    g.to(o.group.position, { x: target.x, y: target.y, z: target.z, duration: 0.7, ease: 'power3.out' });
    const K = 1.85;
    g.to(o.group.scale, { x: K, y: K, z: K, duration: 0.7, ease: 'power3.out' });
  } else {
    o.group.position.copy(target);
    o.group.scale.setScalar(1.85);
  }

  /* the tag swings round */
  heldTag.material.map = texTag(t.name, t.story);
  heldTag.material.needsUpdate = true;
  heldTag.visible = true;
  heldTag.position.set(target.x + 0.66, target.y - 0.08, target.z + 0.18);
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

function placeButtons() {
  if (!camera || document.documentElement.classList.contains('room-flatmode')) return;
  /* The renderer updates these inside render(), which has not run yet this
     frame.  Without this the first frame projects against an identity
     camera and every pip lands in the middle of the picture. */
  camera.updateMatrixWorld(true);
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  scene.updateMatrixWorld(true);
  for (const id in objects) {
    const b = btnFor(id);
    if (!b) continue;
    const o = objects[id];
    o.group.getWorldPosition(proj);
    proj.y += 0.03;
    proj.project(camera);
    const x = (proj.x * 0.5 + 0.5) * 100;
    const y = (-proj.y * 0.5 + 0.5) * 100;
    const on = proj.z < 1 && x > -6 && x < 106 && y > -6 && y < 106;
    b.parentNode.style.setProperty('--x', x + '%');
    b.parentNode.style.setProperty('--y', y + '%');
    b.parentNode.style.opacity = on ? '1' : '0';
    b.parentNode.style.pointerEvents = on ? 'auto' : 'none';
  }
}
