/* Tino Tuala Travels - mock-up behaviour.
   Four jobs: reveal on scroll, a form that goes nowhere on purpose, the film strip, the year.
   Everything degrades to "visible and usable" if any of it fails. */

(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var shot = /[?&]shot=1\b/.test(window.location.search);

  /* --- reveal on scroll -------------------------------------------------- */

  function revealAll(nodes) {
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.add('in');
  }

  function setupReveal() {
    var nodes = document.querySelectorAll('[data-reveal]');
    if (!nodes.length) return;

    // Screenshots, reduced motion, or a browser without IntersectionObserver:
    // show everything straight away so nothing can hide.
    if (shot || reduce || !('IntersectionObserver' in window)) {
      revealAll(nodes);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    for (var i = 0; i < nodes.length; i++) io.observe(nodes[i]);

    // Belt and braces: anything already on screen at load, and a late sweep
    // in case the observer never fires (bfcache, print, odd embeddings).
    window.setTimeout(function () {
      var still = document.querySelectorAll('[data-reveal]:not(.in)');
      for (var j = 0; j < still.length; j++) {
        var r = still[j].getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) still[j].classList.add('in');
      }
    }, 120);

    window.setTimeout(function () {
      if (!document.querySelector('[data-reveal].in')) revealAll(nodes);
    }, 2500);
  }

  /* --- enquiry form: a preview, wired to nothing -------------------------- */

  function setupForm() {
    var form = document.getElementById('enquiryForm');
    var note = document.getElementById('formNote');
    if (!form || !note) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = (form.querySelector('#f-name') || {}).value || '';
      name = name.trim().split(/\s+/)[0];
      note.textContent = name
        ? 'Thanks ' + name + ', but this is a preview of a website. The form is not connected yet, so nothing has been sent.'
        : 'This is a preview of a website. The form is not connected yet, so nothing has been sent.';
      note.hidden = false;
      note.focus && note.focus();
    });
  }

  /* --- film strip ---------------------------------------------------------
     Always drifting. A sideways scroll or a drag pushes it either way, then it
     eases back to its own pace. Reduced motion keeps the plain scrollable row. */

  function setupStrip() {
    var strip = document.querySelector('.filmstrip');
    if (!strip || reduce || shot) return;
    var tracks = strip.querySelectorAll('.filmstrip-track');
    if (tracks.length < 2) return;
    strip.classList.add('is-live');

    var GAP = 14, BASE = 26, x = 0, span = 0, boost = 0, hot = false;
    var down = false, lastX = 0, lastT = 0, vel = 0, last = performance.now();

    function measure() { span = tracks[0].getBoundingClientRect().width + GAP; }
    function wrap() { if (!span) return; while (x <= -span) x += span; while (x > 0) x -= span; }
    function paint() {
      var t = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
      tracks[0].style.transform = t; tracks[1].style.transform = t;
    }
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!span) measure();
      if (!down) {
        x -= (BASE + boost) * dt;
        boost *= Math.pow(hot ? 0.5 : 0.12, dt);          /* lingers while the pointer is over it */
        if (Math.abs(boost) < 1) boost = 0;
      }
      wrap(); paint();
      requestAnimationFrame(frame);
    }

    strip.addEventListener('mouseenter', function () { hot = true; });
    strip.addEventListener('mouseleave', function () { hot = false; });
    strip.addEventListener('wheel', function (e) {
      var d = e.deltaX;                                    /* sideways only: up and down belongs to the page */
      if (!d || Math.abs(d) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      boost = Math.max(-700, Math.min(700, boost + d * 2.4));
    }, { passive: false });

    strip.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      down = true; lastX = e.clientX; lastT = performance.now(); vel = 0; boost = 0;
      strip.classList.add('dragging');
      if (strip.setPointerCapture) { try { strip.setPointerCapture(e.pointerId); } catch (err) {} }
    });
    strip.addEventListener('pointermove', function (e) {
      if (!down) return;
      var now = performance.now(), dx = e.clientX - lastX, dt = Math.max(1, now - lastT);
      x += dx; vel = dx / dt * 1000; lastX = e.clientX; lastT = now;
    });
    function release() {
      if (!down) return;
      down = false; strip.classList.remove('dragging');
      boost = Math.max(-900, Math.min(900, -vel * 0.9)) - 0;   /* a flick carries on, then settles */
    }
    strip.addEventListener('pointerup', release);
    strip.addEventListener('pointercancel', release);
    window.addEventListener('resize', measure);
    requestAnimationFrame(frame);
  }

  /* --- the year ----------------------------------------------------------- */

  function setupYear() {
    var el = document.getElementById('year');
    if (el) el.textContent = String(new Date().getFullYear());
  }

  function init() {
    setupReveal();
    setupForm();
    setupStrip();
    setupYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
