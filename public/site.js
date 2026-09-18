/* Tino Tuala Travels - mock-up behaviour.
   Three jobs: reveal on scroll, a form that goes nowhere on purpose, the year.
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

  /* --- the year ----------------------------------------------------------- */

  function setupYear() {
    var el = document.getElementById('year');
    if (el) el.textContent = String(new Date().getFullYear());
  }

  function init() {
    setupReveal();
    setupForm();
    setupYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
