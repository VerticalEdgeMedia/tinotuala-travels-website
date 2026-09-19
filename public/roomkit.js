/* ==========================================================================
   roomkit.js - the bits every v3 room page needs.

   Five rooms draw their own world in code: the geometry with three.js
   primitives, every texture on a 2D canvas, the light warm and low.  This is
   the small pile of things they all wanted, kept in one place so a room file
   is about the room and nothing else.

     cnv / grainy / canvasTex / loadTex      canvas textures
     paperGround / goldGrad / archPath       the hotel's look, on a canvas
     plateTex                                 a brass plate with a number on it
     wrapText / clamp / lerp / damp           odds and ends
     Screen                                   projects a 3D object to the page
                                              and moves its accessible button
                                              on to it, every frame

   THE TWO THINGS THAT BITE, both learnt in Room 102B and both handled here:

   1. Project with THIS frame's matrices.  The renderer updates them inside
      render(), which has not run yet when onFrame is called, so Screen.sync()
      calls camera.updateMatrixWorld(true) and rebuilds matrixWorldInverse
      itself.  Without it the first frame projects against an identity camera
      and every button lands in the middle of the picture.
   2. Be careful what counts as an occluder.  A thin upright seen at a
      glancing angle hides a whole shelf of things you can plainly see, so a
      room passes in only the walls and slabs that really do get in the way.
   ========================================================================== */

import * as THREE from './vendor/three.module.min.js';
export { THREE };

/* ------------------------------------------------------------- canvas 2D */

export function cnv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

/** Fine tooth over a whole canvas: nothing in this hotel is a flat fill. */
export function grainy(g, w, h, amount) {
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

export function canvasTex(c, opts) {
  opts = opts || {};
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  t.anisotropy = opts.aniso || 4;
  return t;
}

export function loadTex(url, onLoad) {
  const t = new THREE.TextureLoader().load(url, onLoad);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* --------------------------------------------------------------- the look */

/** Parchment: warm paper, a little mottling, a lot of grain. */
export function paperGround(g, w, h, base) {
  g.fillStyle = base || '#EFE6D0';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = w * (0.06 + Math.random() * 0.22);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(150,118,62,.09)');
    gr.addColorStop(1, 'rgba(150,118,62,0)');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(x, y, r, r * 0.74, Math.random() * 3, 0, 6.2832); g.fill();
  }
  grainy(g, w, h, 16);
}

/** The seven-stop foil, as a canvas gradient. */
export function goldGrad(g, x0, y0, x1, y1) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, '#8A6A24');
  gr.addColorStop(0.17, '#C9A227');
  gr.addColorStop(0.33, '#F6E7B0');
  gr.addColorStop(0.49, '#C9A227');
  gr.addColorStop(0.65, '#96752A');
  gr.addColorStop(0.82, '#EBD28A');
  gr.addColorStop(1, '#A8842E');
  return gr;
}

/**
 * The hotel's arch, as a path on a 2D context: straight sides, a pointed
 * ogee shoulder, the same silhouette as the niches on the home page.
 */
export function archPath(g, x, y, w, h) {
  const sh = h * 0.42;                    /* where the shoulder starts */
  g.beginPath();
  g.moveTo(x, y + h);
  g.lineTo(x, y + sh);
  g.bezierCurveTo(x, y + sh * 0.34, x + w * 0.22, y + sh * 0.10, x + w * 0.5, y);
  g.bezierCurveTo(x + w * 0.78, y + sh * 0.10, x + w, y + sh * 0.34, x + w, y + sh);
  g.lineTo(x + w, y + h);
  g.closePath();
}

/** A brass plate with a room number pressed into it. */
export function plateTex(text, w, h) {
  w = w || 256; h = h || 112;
  const [c, g] = cnv(w, h);
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#E4C87E'); grad.addColorStop(0.5, '#B08A2E'); grad.addColorStop(1, '#6E5418');
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  g.fillStyle = '#231A06';
  g.font = '600 ' + Math.round(h * 0.52) + 'px Cinzel, Georgia, serif';
  g.textAlign = 'center';
  g.fillText(text, w / 2, h * 0.68);
  grainy(g, w, h, 14);
  return canvasTex(c);
}

/* ----------------------------------------------------------------- odds */

export function wrapText(g, text, x, y, maxw, lh) {
  const words = String(text).split(' ');
  let line = '', yy = y;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (g.measureText(test).width > maxw && line) { g.fillText(line, x, yy); line = words[i]; yy += lh; }
    else line = test;
  }
  if (line) g.fillText(line, x, yy);
  return yy + lh;
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
/** Frame-rate independent easing toward a target. */
export function damp(cur, target, lambda, dt) {
  return cur + (target - cur) * (1 - Math.pow(lambda, Math.max(0.001, dt)));
}

/* ---------------------------------------------- objects and their buttons */

/**
 * Screen(camera, scene, el)
 *
 * Projects 3D objects to page coordinates and moves each object's accessible
 * button on to it every frame, hiding the button when the object is off
 * screen or behind something.  At rest the button shows nothing at all: the
 * thing itself is the affordance.  `bounds(id)` exists so a harness can
 * assert that a button really does sit over its object.
 */
export class Screen {
  constructor(camera, scene, el, opts) {
    this.camera = camera;
    this.scene = scene;
    this.el = el;
    this.items = [];
    this.occluders = (opts && opts.occluders) || [];
    this.sel = (opts && opts.selector) || '.lost-btn';
    this.attr = (opts && opts.attr) || 'obj';
    this._v = new THREE.Vector3();
    this._cam = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._ray = new THREE.Raycaster();
    this._tick = 0;
    this._occ = {};
  }

  /** add({id, obj, dy, radius}) - dy lifts the anchor point off the object */
  add(item) {
    item.btn = this.el.ownerDocument.querySelector(
      this.sel + '[data-' + this.attr + '="' + item.id + '"]');
    this.items.push(item);
    return item;
  }

  /** The renderer has not updated these yet this frame, so we do it. */
  sync() {
    this.camera.updateMatrixWorld(true);
    this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert();
    this.scene.updateMatrixWorld(true);
    this.camera.getWorldPosition(this._cam);
  }

  /** Where an object lands on the page, as percentages of the stage box. */
  at(obj, dy) {
    obj.getWorldPosition(this._v);
    if (dy) this._v.y += dy;
    this._v.project(this.camera);
    return { x: (this._v.x * 0.5 + 0.5) * 100, y: (-this._v.y * 0.5 + 0.5) * 100, z: this._v.z };
  }

  place() {
    if (document.documentElement.classList.contains('room-flatmode')) return;
    this.sync();
    const doOcc = (this._tick++ % 3) === 0 && this.occluders.length > 0;
    for (const it of this.items) {
      if (!it.btn) continue;
      const li = it.btn.parentNode;
      if (doOcc && it.radius) {
        it.obj.getWorldPosition(this._v);
        this._dir.copy(this._v).sub(this._cam);
        const dist = this._dir.length();
        this._dir.divideScalar(dist);
        this._ray.set(this._cam, this._dir);
        this._ray.far = Math.max(0.01, dist - it.radius);
        this._occ[it.id] = this._ray.intersectObjects(this.occluders, false).length > 0;
      }
      const p = this.at(it.obj, it.dy || 0);
      const on = p.z < 1 && p.x > -4 && p.x < 104 && p.y > -4 && p.y < 104;
      const show = on && !this._occ[it.id] && it.hidden !== true;
      li.style.setProperty('--x', p.x + '%');
      li.style.setProperty('--y', p.y + '%');
      li.style.opacity = show ? '1' : '0';
      li.style.pointerEvents = show ? 'auto' : 'none';
      it.btn.setAttribute('aria-hidden', show ? 'false' : 'true');
      if (!show && document.activeElement === it.btn) it.btn.blur();
      it.screen = p;
      it.onScreen = show;
    }
  }

  /** The object's projected box in page pixels.  For the harness. */
  bounds(id) {
    const it = this.items.filter((i) => i.id === id)[0];
    if (!it) return null;
    this.sync();
    const box = new THREE.Box3().setFromObject(it.obj);
    const r = this.el.getBoundingClientRect();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, ok = false;
    for (let i = 0; i < 8; i++) {
      const v = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z).project(this.camera);
      if (v.z < 1) ok = true;
      const px = r.left + (v.x * 0.5 + 0.5) * r.width;
      const py = r.top + (-v.y * 0.5 + 0.5) * r.height;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px);
      y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    return ok ? { x0, y0, x1, y1 } : null;
  }
}
