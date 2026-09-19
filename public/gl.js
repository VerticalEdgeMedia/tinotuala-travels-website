/* ==========================================================================
   gl.js - the single WebGL stage.  v3.

   Browsers cap the number of live WebGL contexts, so this site has exactly
   ONE renderer per page.  Everything that wants to draw registers a VIEW:
   a scene, a camera and a DOM element whose on-screen rectangle it is drawn
   into (scissor + viewport).  The canvas is fixed to the viewport and never
   takes pointer events.

   Usage (ES module):

       import { getStage } from './gl.js';
       const stage = await getStage();          // null when WebGL is unavailable
       const view  = stage.addView({
         el,                                     // the element to draw into
         scene, camera,                          // three.js objects you own
         onFrame(dt, t) { ... },                 // optional, called before render
         resize(w, h) { ... },                   // optional, on rect change
         layer: 'page'                           // 'page' (default) or 'over'
       });
       view.remove();                            // disposes nothing you made

   Rules kept here so nobody has to remember them:
     - devicePixelRatio capped at 2, or 1.5 on a coarse pointer
     - the loop stops when the tab is hidden and when no view is on screen
     - a view whose rect is off screen is skipped
     - views in the 'over' layer raise the canvas above the page for the
       length of a transition (the burn), then it drops back

   Nothing in here knows about the hotel, the fire or any room.  Keep it that
   way: part B should be able to add a view without reading the rest.
   ========================================================================== */

import * as THREE from './vendor/three.module.min.js';

let stagePromise = null;

/** True when this browser can actually give us a context we can use. */
export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    // A context that reports no shading language is a dead end.
    return !!gl.getParameter(gl.SHADING_LANGUAGE_VERSION);
  } catch (e) {
    return false;
  }
}

class Stage {
  constructor() {
    this.views = [];
    this.running = false;
    this.frozen = false;          // ?shot=1 renders one frame and stops
    this.last = 0;
    this.time = 0;
    this._raf = 0;
    this._overCount = 0;

    const canvas = document.createElement('canvas');
    canvas.className = 'gl-stage';
    canvas.setAttribute('aria-hidden', 'true');
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,           // the art is flat colour; AA buys little and costs a lot
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(this.dpr());

    this._onResize = () => this.resize();
    this._onVisible = () => { document.hidden ? this.stop() : this.start(); };
    window.addEventListener('resize', this._onResize, { passive: true });
    window.addEventListener('orientationchange', this._onResize, { passive: true });
    document.addEventListener('visibilitychange', this._onVisible);

    document.body.appendChild(canvas);
    this.resize();
  }

  dpr() {
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    return Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
  }

  resize() {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.renderer.setPixelRatio(this.dpr());
    this.renderer.setSize(this.w, this.h, false);
    for (const v of this.views) v._rect = null;
    if (!this.running) this.renderOnce();
  }

  /** Register a view.  Returns a handle with .remove(). */
  addView(opts) {
    const view = {
      el: opts.el || null,
      scene: opts.scene,
      camera: opts.camera,
      onFrame: opts.onFrame || null,
      onResize: opts.resize || null,
      layer: opts.layer || 'page',
      full: !!opts.full,            // ignore el, use the whole viewport
      visible: true,
      _rect: null,
      _w: 0, _h: 0,
      remove: () => this.removeView(view)
    };
    this.views.push(view);
    if (view.layer === 'over') this._raiseOver(1);
    /* A view added after the stage was frozen (a lazily imported scene under
       ?shot=1) still has to be drawn once, or it never appears at all. */
    if (this.frozen) window.requestAnimationFrame(() => this.renderOnce());
    else this.start();
    return view;
  }

  removeView(view) {
    const i = this.views.indexOf(view);
    if (i < 0) return;
    this.views.splice(i, 1);
    if (view.layer === 'over') this._raiseOver(-1);
    if (!this.views.length) this.stop();
  }

  _raiseOver(delta) {
    this._overCount = Math.max(0, this._overCount + delta);
    this.canvas.classList.toggle('is-over', this._overCount > 0);
  }

  start() {
    if (this.running || this.frozen || document.hidden || !this.views.length) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.time += dt;
      this.draw(dt, this.time);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
  }

  /** One frame, no loop.  Used by ?shot=1 and after a resize while paused. */
  renderOnce(t) {
    if (typeof t === 'number') this.time = t;
    this.draw(0, this.time);
  }

  /**
   * Advance the loop by hand.  Headless Chrome under a virtual-time budget
   * produces almost no animation frames, so a test harness has to drive the
   * clock itself; this is the only way to play an interaction and then
   * measure where everything landed.  Nothing in the site calls it.
   */
  step(dt) {
    const d = typeof dt === 'number' ? dt : 1 / 60;
    this.time += d;
    this.draw(d, this.time);
  }

  /** Freeze on a single frame for screenshots. */
  freeze(t) {
    this.stop();
    this.frozen = true;
    this.renderOnce(t);
  }

  draw(dt, t) {
    const r = this.renderer;
    r.setScissorTest(false);
    r.clear(true, true, false);
    r.setScissorTest(true);

    let anyOnScreen = false;

    for (const v of this.views) {
      let x, y, w, h;
      if (v.full || !v.el) {
        x = 0; y = 0; w = this.w; h = this.h;
      } else {
        const rect = v.el.getBoundingClientRect();
        w = Math.round(rect.width); h = Math.round(rect.height);
        if (w < 2 || h < 2) continue;
        if (rect.bottom < -120 || rect.top > this.h + 120) { v.visible = false; continue; }
        x = Math.round(rect.left);
        y = Math.round(this.h - rect.bottom);          // WebGL's origin is bottom-left
      }
      v.visible = true;
      anyOnScreen = true;

      if (w !== v._w || h !== v._h) {
        v._w = w; v._h = h;
        if (v.onResize) v.onResize(w, h);
      }
      if (v.onFrame) v.onFrame(dt, t, w, h);

      r.setViewport(x, y, w, h);
      r.setScissor(x, y, w, h);
      r.clearDepth();
      r.render(v.scene, v.camera);
    }

    r.setScissorTest(false);

    // Nothing animated is on screen: idle until something scrolls into view.
    if (!anyOnScreen && this.running) {
      this.stop();
      const wake = () => {
        window.removeEventListener('scroll', wake);
        window.removeEventListener('resize', wake);
        this.start();
      };
      window.addEventListener('scroll', wake, { passive: true, once: true });
      window.addEventListener('resize', wake, { passive: true, once: true });
    }
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVisible);
    this.renderer.dispose();
    this.canvas.remove();
    stagePromise = null;
  }
}

/** The one stage for this page.  Resolves to null when WebGL is unavailable. */
export function getStage() {
  if (!stagePromise) {
    stagePromise = new Promise((resolve) => {
      if (!webglAvailable()) { resolve(null); return; }
      try {
        const s = new Stage();
        /* Shipped on purpose and harmless: a harness has to be able to reach
           step() from outside the module to drive the clock by hand. */
        window.__stage = s;
        resolve(s);
      } catch (e) { resolve(null); }
    });
  }
  return stagePromise;
}

export { THREE };
