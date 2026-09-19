/* ==========================================================================
   hotel.js - the hotel itself.  v3.   Plain script, global `Hotel`.
   Loaded on EVERY page, before site.js and before any page script.

   What it owns
   ------------
     state        keys you hold, doors you have opened, passport stamps,
                  things you are carrying, sound on or off, full or lite
     the tray     fixed bottom-left; the keys, the passport button, the sound
                  switch                   (the versions dock owns bottom-right)
     the passport a <dialog> with a stamp slot per door, the things you have
                  found, "Reset my stay", and the two switches
     sound        Web Audio.  UI noises are synthesised here; the four animal
                  calls are real recordings in audio/, played through a long
                  delay, a procedural reverb and a random pitch drop so no two
                  are the same
     fire & burn  thin wrappers over fire.js, with a CSS/SVG stand-in for the
                  lighter version
     the concierge one line at a time, and the hint ladder

   Storage
   -------
     localStorage['ttt-hotel-v3'] =
       { checkedIn: bool,
         keys:   ['k-102b', ...],
         doors:  { '102b': 'open', ... },
         stamps: ['102b', ...],
         found:  ['postcard', ...],
         sound:  bool,
         mode:   'full' | 'lite' }
     Every read and write is wrapped: with storage blocked the hotel still
     works, it just forgets.  A URL carrying a test hook NEVER writes.

   Events   Hotel.on(name, fn)
   ------
     'ready'         the hotel has booted
     'check-in'      the bell has been rung for the first time
     'key'           (keyId)      a key has arrived in the tray
     'door-open'     (doorId)     a door has been unlocked
     'door-refused'  (doorId)     the wrong key, or no key
     'stamp'         (doorId)     the passport has been stamped
     'found'         (findId)     something has gone into the collection
     'passport-full' ()           every door stamped.  Part B wires the finale
     'animal'        (which)      a call is sounding: 'monkey' | 'elephant' |
                                  'bigcat' | 'bird'
     'mode'          (mode)       'full' or 'lite'
     'sound'         (on)
     'reset'

   Test hooks (shipped, harmless, and none of them writes storage)
   ----------
     ?shot=1        reveal everything, freeze, render one frame
     ?lite=1 / ?full=1
     ?checkin=1     already checked in
     ?keys=all  or  ?keys=102b,118
     ?open=102b     that door already open
     ?burn=0.5      hold the burn transition at that progress
     ?night=1       force the night end of the grade
     ?passport=1    the passport open
     ?mute=1        sound off
   ========================================================================== */

(function (window, document) {
  'use strict';

  var STORE_KEY = 'ttt-hotel-v3';

  /* ---------------------------------------------------------------- doors */

  var DOORS = [
    { id: '102b', no: '102B', name: 'Room 102B', plaque: null,
      page: '102b.html', key: 'k-102b', stamp: 'lost',
      blurb: 'Lost property. No plaque, just the number.' },
    { id: 'map-room', no: '118', name: 'The Map Room', plaque: 'The Map Room',
      page: 'map-room.html', key: 'k-118', stamp: 'map',
      blurb: 'Where the hotel keeps its maps.' },
    { id: 'black-book', no: '214', name: "Tino's Black Book", plaque: 'Black Book',
      page: 'black-book.html', key: 'k-214', stamp: 'book',
      blurb: 'The notebook he actually writes in.' },
    { id: 'lantern-room', no: '311', name: 'The Lantern Room', plaque: 'The Lantern Room',
      page: 'lantern-room.html', key: 'k-311', stamp: 'lantern',
      blurb: 'Pictures, hung close together.' },
    { id: 'long-gallery', no: '402', name: 'The Long Gallery', plaque: 'The Long Gallery',
      page: 'long-gallery.html', key: 'k-402', stamp: 'gallery',
      blurb: 'More pictures, hung further apart.' },
    { id: 'rooftop-bar', no: '901', name: 'The Rooftop Bar', plaque: 'The Rooftop Bar',
      page: 'rooftop-bar.html', key: 'k-901', stamp: 'bar',
      blurb: 'Up the stairs at the end.' }
  ];

  var KEYS = {
    'k-311':  { tag: '311',  door: 'lantern-room', where: 'The bell, first ring.' },
    'k-102b': { tag: '102B', door: '102b',        where: 'The bell, third ring. Lost property keeps its own key behind the desk.' },
    'k-118':  { tag: '118',  door: 'map-room',    where: 'Under the tiger, on the no cattle sightseeing panel.' },
    'k-901':  { tag: '901',  door: 'rooftop-bar', where: 'The macaw drops it, if you keep bothering it.' },
    'k-214':  { tag: '214',  door: 'black-book',  where: 'Inside the jar of sand in 102B. Give it a shake.' },
    'k-402':  { tag: '402',  door: 'long-gallery', where: 'The monkey swaps it for the tiny hat from 102B.' }
  };

  /* Things that go in the passport.  The pictures are public-domain files
     from Wikimedia Commons and every one is credited on the credits page. */
  var FINDS = {
    postcard: {
      title: 'A postcard, never posted',
      img: 'img/reward-postcard-01.jpg', w: 1400, h: 902,
      alt: 'A hand-tinted postcard of Collyer Quay in Singapore, the Alkaff Arcade along the waterfront.'
    },
    poster: {
      title: 'A poster in a tube',
      img: 'img/reward-poster-01.jpg', w: 998, h: 1400,
      alt: 'A railway travel poster: a silhouetted pine and a green bird framing pine-topped islands in a bay.'
    },
    label: {
      title: 'A luggage label, from the leaves',
      img: 'img/reward-label-01.jpg', w: 1042, h: 1400,
      alt: 'A gummed hotel luggage label showing a camel rider in front of the Sphinx and a pyramid.'
    },
    hat: { title: 'A tiny straw hat', icon: 'hat', carried: true,
      note: 'Far too small for a person.' },

    /* one per room, part B */
    lantern: {
      title: 'A lantern float, drawn in Edo',
      img: 'img/reward-lantern-01.jpg', w: 763, h: 1050,
      alt: 'A Japanese woodblock print: children in patterned robes gathered around a tall festival lantern float on a stand, with a block of writing in a cartouche above them.'
    },
    chart: {
      title: 'A chart of the steamship routes',
      img: 'img/reward-chart-01.jpg', w: 984, h: 1400,
      alt: 'An Admiralty chart of the Atlantic: fine ruled steamship tracks crossing a pale sea between outlined coastlines, with a panel of sailing notes down one side.'
    },
    barcard: {
      title: 'A bar-tender\u2019s plate, 1891',
      img: 'img/reward-bar-01.jpg', w: 747, h: 1100,
      alt: 'A colour plate of a man\u2019s head on a rooster\u2019s body with long green tail feathers, standing in a stemmed bowl and pouring from a jug, over the words Standard Authority.'
    },
    bookmark: {
      title: 'A label, pressed between two pages',
      img: 'img/reward-label-03.jpg', w: 787, h: 1100,
      alt: 'A gummed hotel luggage label: a dark sailing boat on a red lake below white mountains, lettered Touring Hotel Balance, Geneve.'
    },
    backlabel: {
      title: 'A label off the back of a frame',
      img: 'img/reward-label-04.jpg', w: 1100, h: 1092,
      alt: 'A gummed hotel luggage label with a red torii gate and a lake below a snow-capped peak, lettered for a hotel at Hakone in Japan.'
    }
  };

  /* ---------------------------------------------------------------- hooks */

  var qs = (function () {
    var out = {};
    var s = window.location.search.replace(/^\?/, '');
    if (!s) return out;
    s.split('&').forEach(function (bit) {
      if (!bit) return;
      var i = bit.indexOf('=');
      var k = i < 0 ? bit : bit.slice(0, i);
      out[decodeURIComponent(k)] = i < 0 ? '1' : decodeURIComponent(bit.slice(i + 1));
    });
    return out;
  })();

  var hooks = {
    shot: qs.shot === '1',
    lite: qs.lite === '1',
    full: qs.full === '1',
    checkin: qs.checkin === '1',
    keys: qs.keys || null,
    open: qs.open || null,
    burn: qs.burn != null ? parseFloat(qs.burn) : null,
    night: qs.night === '1',
    passport: qs.passport === '1',
    mute: qs.mute === '1'
  };
  var EPHEMERAL = !!(hooks.shot || hooks.lite || hooks.full || hooks.checkin ||
    hooks.keys || hooks.open || hooks.burn != null || hooks.night ||
    hooks.passport || hooks.mute);

  var reduceMotion = !!(window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var stillFrame = hooks.shot || reduceMotion;

  /* ---------------------------------------------------------------- state */

  function blank() {
    return { checkedIn: false, keys: [], doors: {}, stamps: [], found: [], sound: true, mode: null };
  }

  var state = blank();
  var stored = null;

  function load() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (raw) {
        var v = JSON.parse(raw);
        if (v && typeof v === 'object') {
          state.checkedIn = !!v.checkedIn;
          state.keys = Array.isArray(v.keys) ? v.keys.filter(function (k) { return !!KEYS[k]; }) : [];
          state.doors = (v.doors && typeof v.doors === 'object') ? v.doors : {};
          state.stamps = Array.isArray(v.stamps) ? v.stamps : [];
          state.found = Array.isArray(v.found) ? v.found : [];
          state.sound = v.sound !== false;
          state.mode = (v.mode === 'full' || v.mode === 'lite') ? v.mode : null;
          stored = true;
        }
      }
    } catch (e) { /* storage blocked: the hotel simply forgets */ }
  }

  function save() {
    if (EPHEMERAL) return;
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { /* nothing to be done */ }
  }

  load();

  /* hooks layer on top of whatever was stored, without saving */
  if (hooks.checkin || hooks.keys || hooks.open) state.checkedIn = true;
  if (hooks.keys === 'all') {
    state.keys = Object.keys(KEYS);
  } else if (hooks.keys) {
    hooks.keys.split(',').forEach(function (t) {
      t = t.trim().toLowerCase();
      for (var k in KEYS) if (KEYS[k].tag.toLowerCase() === t || k === t || k === 'k-' + t) {
        if (state.keys.indexOf(k) < 0) state.keys.push(k);
      }
    });
  }
  if (hooks.open) {
    hooks.open.split(',').forEach(function (d) {
      d = d.trim();
      state.doors[d] = 'open';
      var door = doorById(d);
      if (door && state.stamps.indexOf(d) < 0) state.stamps.push(d);
      if (door && state.keys.indexOf(door.key) < 0) state.keys.push(door.key);
    });
  }
  if (hooks.mute) state.sound = false;

  function doorById(id) {
    for (var i = 0; i < DOORS.length; i++) if (DOORS[i].id === id) return DOORS[i];
    return null;
  }

  /* ---------------------------------------------------------------- events */

  var listeners = {};
  function on(name, fn) {
    (listeners[name] || (listeners[name] = [])).push(fn);
    return function () { off(name, fn); };
  }
  function off(name, fn) {
    var a = listeners[name]; if (!a) return;
    var i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
  }
  function emit(name, arg) {
    var a = listeners[name]; if (!a) return;
    for (var i = 0; i < a.length; i++) {
      try { a[i](arg); } catch (e) { if (window.console) console.error(e); }
    }
  }

  /* ----------------------------------------------------------------- mode */

  function webglOk() {
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl2') || c.getContext('webgl');
      return !!(gl && gl.getParameter(gl.SHADING_LANGUAGE_VERSION));
    } catch (e) { return false; }
  }

  function pickMode() {
    if (hooks.lite) return 'lite';
    if (hooks.full) return 'full';
    if (state.mode) return state.mode;            /* the visitor chose, and we remember */
    if (reduceMotion) return 'lite';
    if (!webglOk()) return 'lite';

    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn && conn.saveData) return 'lite';

    var coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    var small = Math.min(window.innerWidth, window.innerHeight) < 520;
    var cores = navigator.hardwareConcurrency || 0;
    var mem = navigator.deviceMemory || 0;
    if ((coarse || small) && ((cores && cores <= 4) || (mem && mem <= 4))) return 'lite';

    /* A bonus hint only.  Safari and iPhones report nothing at all here, so
       the decision above can never depend on it. */
    if (conn && typeof conn.effectiveType === 'string' && /(^|-)2g$/.test(conn.effectiveType)) return 'lite';

    return 'full';
  }

  var mode = pickMode();
  document.documentElement.classList.add('hotel-' + mode);
  if (reduceMotion) document.documentElement.classList.add('hotel-still');

  /* ---------------------------------------------------------------- sound */

  var sound = (function () {
    var ctx = null, master = null, uiBus = null, ambBus = null, conv = null;
    var buffers = {};
    var loading = false;
    var timer = 0;
    var order = ['monkey', 'elephant', 'bigcat', 'bird'];
    var lastCall = null;
    var ambienceWanted = false;

    function ready() { return !!ctx; }

    function ensure() {
      if (ctx) return ctx;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }

      master = ctx.createGain();
      master.gain.value = state.sound ? 1 : 0;
      master.connect(ctx.destination);

      uiBus = ctx.createGain(); uiBus.gain.value = 0.5; uiBus.connect(master);
      ambBus = ctx.createGain(); ambBus.gain.value = 0.42; ambBus.connect(master);

      conv = ctx.createConvolver();
      conv.buffer = makeIR(3.0 + Math.random() * 2.0);
      var convOut = ctx.createGain(); convOut.gain.value = 0.9;
      conv.connect(convOut); convOut.connect(ambBus);

      return ctx;
    }

    /* A room, made out of decaying filtered noise.  Nothing sampled. */
    function makeIR(seconds) {
      var rate = ctx.sampleRate;
      var len = Math.max(1, Math.floor(rate * seconds));
      var buf = ctx.createBuffer(2, len, rate);
      for (var ch = 0; ch < 2; ch++) {
        var d = buf.getChannelData(ch);
        var last = 0;
        var k = 0.22 + ch * 0.04;                 /* the two sides differ slightly */
        for (var i = 0; i < len; i++) {
          var t = i / len;
          var n = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.7);
          last += (n - last) * k;                 /* one pole: the tail goes dark */
          d[i] = last * (1 - t * 0.15);
        }
      }
      return buf;
    }

    function noiseBuffer(seconds) {
      var len = Math.floor(ctx.sampleRate * seconds);
      var b = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = b.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return b;
    }

    function env(node, t0, a, d, peak) {
      node.gain.setValueAtTime(0.0001, t0);
      node.gain.exponentialRampToValueAtTime(peak, t0 + a);
      node.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    }

    /* --- the synthesised noises ------------------------------------------ */

    function play(name) {
      /* Never CREATE a context here.  Sounds are only ever heard after a
         gesture has opened one through unlock(); before that they are
         silently skipped, which is what the browser wants anyway. */
      if (!ctx || ctx.state === 'closed') return;
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
      var t = ctx.currentTime + 0.005;
      switch (name) {
        case 'ding': {
          [1318, 1975, 3290].forEach(function (f, i) {
            var o = ctx.createOscillator(), g = ctx.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(f * (1 + (Math.random() - 0.5) * 0.004), t);
            o.frequency.exponentialRampToValueAtTime(f * 0.995, t + 1.4);
            env(g, t, 0.003, 1.5 - i * 0.35, [0.30, 0.13, 0.05][i]);
            o.connect(g); g.connect(uiBus);
            o.start(t); o.stop(t + 1.8);
          });
          break;
        }
        case 'jingle': {
          for (var j = 0; j < 4; j++) {
            var s = ctx.createBufferSource(); s.buffer = noiseBuffer(0.09);
            var bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
            bp.frequency.value = 2400 + Math.random() * 2200; bp.Q.value = 9;
            var g2 = ctx.createGain();
            var tt = t + j * (0.045 + Math.random() * 0.035);
            env(g2, tt, 0.002, 0.075, 0.18);
            s.connect(bp); bp.connect(g2); g2.connect(uiBus);
            s.start(tt); s.stop(tt + 0.12);
          }
          break;
        }
        case 'clunk': {
          var o1 = ctx.createOscillator(), g1 = ctx.createGain();
          o1.type = 'sine';
          o1.frequency.setValueAtTime(110, t);
          o1.frequency.exponentialRampToValueAtTime(52, t + 0.12);
          env(g1, t, 0.003, 0.17, 0.42);
          o1.connect(g1); g1.connect(uiBus); o1.start(t); o1.stop(t + 0.3);

          var n = ctx.createBufferSource(); n.buffer = noiseBuffer(0.08);
          var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
          var gn = ctx.createGain(); env(gn, t, 0.002, 0.06, 0.24);
          n.connect(lp); lp.connect(gn); gn.connect(uiBus); n.start(t); n.stop(t + 0.1);
          break;
        }
        case 'creak': {
          var o3 = ctx.createOscillator(), bp3 = ctx.createBiquadFilter(), g3 = ctx.createGain();
          o3.type = 'sawtooth'; o3.frequency.setValueAtTime(58, t);
          o3.frequency.linearRampToValueAtTime(88, t + 0.9);
          bp3.type = 'bandpass'; bp3.Q.value = 7;
          bp3.frequency.setValueAtTime(320, t);
          bp3.frequency.linearRampToValueAtTime(980, t + 0.85);
          var lfo = ctx.createOscillator(), lg = ctx.createGain();
          lfo.frequency.value = 7.5; lg.gain.value = 140;
          lfo.connect(lg); lg.connect(bp3.frequency);
          g3.gain.setValueAtTime(0.0001, t);
          g3.gain.exponentialRampToValueAtTime(0.16, t + 0.12);
          g3.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
          o3.connect(bp3); bp3.connect(g3); g3.connect(uiBus);
          o3.start(t); o3.stop(t + 1.05); lfo.start(t); lfo.stop(t + 1.05);
          break;
        }
        case 'thump': {
          var n2 = ctx.createBufferSource(); n2.buffer = noiseBuffer(0.06);
          var lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 800;
          var gn2 = ctx.createGain(); env(gn2, t, 0.002, 0.07, 0.34);
          n2.connect(lp2); lp2.connect(gn2); gn2.connect(uiBus); n2.start(t); n2.stop(t + 0.1);

          var o4 = ctx.createOscillator(), g4 = ctx.createGain();
          o4.type = 'sine';
          o4.frequency.setValueAtTime(150, t);
          o4.frequency.exponentialRampToValueAtTime(64, t + 0.1);
          env(g4, t, 0.002, 0.13, 0.3);
          o4.connect(g4); g4.connect(uiBus); o4.start(t); o4.stop(t + 0.2);
          break;
        }
        case 'rustle': {
          var n3 = ctx.createBufferSource(); n3.buffer = noiseBuffer(0.45);
          var bp4 = ctx.createBiquadFilter(); bp4.type = 'bandpass';
          bp4.frequency.value = 2600; bp4.Q.value = 1.1;
          var g5 = ctx.createGain();
          g5.gain.setValueAtTime(0.0001, t);
          for (var r = 0; r < 7; r++) {
            g5.gain.exponentialRampToValueAtTime(0.03 + Math.random() * 0.09, t + 0.05 + r * 0.05);
          }
          g5.gain.exponentialRampToValueAtTime(0.0001, t + 0.44);
          n3.connect(bp4); bp4.connect(g5); g5.connect(uiBus);
          n3.start(t); n3.stop(t + 0.46);
          break;
        }
        case 'crackle': {
          for (var c = 0; c < 5; c++) {
            var ns = ctx.createBufferSource(); ns.buffer = noiseBuffer(0.02);
            var hp = ctx.createBiquadFilter(); hp.type = 'bandpass';
            hp.frequency.value = 900 + Math.random() * 2600; hp.Q.value = 4;
            var gc = ctx.createGain();
            var tc = t + Math.random() * 1.6;
            env(gc, tc, 0.001, 0.02, 0.012 + Math.random() * 0.02);
            ns.connect(hp); hp.connect(gc); gc.connect(uiBus);
            ns.start(tc); ns.stop(tc + 0.04);
          }
          break;
        }
      }
    }

    /* --- the animals ------------------------------------------------------ */

    function fetchCalls() {
      if (loading || !ctx) return;
      loading = true;
      order.forEach(function (id) {
        var url = 'audio/animal-' + id + '.mp3';
        fetch(url).then(function (r) {
          if (!r.ok) throw new Error(r.status);
          return r.arrayBuffer();
        }).then(function (ab) {
          return new Promise(function (res, rej) {
            ctx.decodeAudioData(ab, res, rej);
          });
        }).then(function (buf) { buffers[id] = buf; })
          .catch(function () { /* one call missing just drops out of the rotation */ });
      });
    }

    function callOnce(id) {
      if (!ctx || !buffers[id]) return;
      var t = ctx.currentTime + 0.02;
      var buf = buffers[id];

      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = 0.82 + Math.random() * 0.18;   /* a slight drop */

      var pan;
      if (ctx.createStereoPanner) {
        pan = ctx.createStereoPanner();
        pan.pan.value = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.32);
      } else {
        pan = ctx.createGain();
      }

      /* far away */
      var dry = ctx.createGain(); dry.gain.value = 0.28;

      /* a long feedback delay through a lowpass: the echo goes darker each time */
      var dl = ctx.createDelay(1.2);
      dl.delayTime.value = 0.28 + Math.random() * 0.34;
      var fb = ctx.createGain(); fb.gain.value = 0.35 + Math.random() * 0.20;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.value = 1200 + Math.random() * 1100;
      var dlOut = ctx.createGain(); dlOut.gain.value = 0.40;

      src.connect(pan);
      pan.connect(dry); dry.connect(ambBus);
      pan.connect(dl);
      dl.connect(lp); lp.connect(fb); fb.connect(dl);
      dl.connect(dlOut); dlOut.connect(ambBus);

      var send = ctx.createGain(); send.gain.value = 0.55;
      pan.connect(send); send.connect(conv);

      src.start(t);
      var life = (buf.duration / src.playbackRate.value) + 6;
      window.setTimeout(function () {
        try {
          src.disconnect(); pan.disconnect(); dry.disconnect();
          dl.disconnect(); lp.disconnect(); fb.disconnect();
          dlOut.disconnect(); send.disconnect();
        } catch (e) {}
      }, life * 1000);

      emit('animal', id);
    }

    function pickNext() {
      var pool = order.filter(function (id) { return id !== lastCall && buffers[id]; });
      if (!pool.length) pool = order.filter(function (id) { return buffers[id]; });
      if (!pool.length) return null;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    function schedule() {
      window.clearTimeout(timer);
      if (!ambienceWanted || document.hidden) return;
      var wait = 12000 + Math.random() * 8000;          /* roughly every 15 seconds */
      timer = window.setTimeout(function () {
        if (!ambienceWanted || document.hidden) return;
        var id = pickNext();
        if (id) { lastCall = id; callOnce(id); }
        schedule();
      }, wait);
    }

    function ambienceStart() {
      ambienceWanted = true;
      if (!ctx) return;                 /* waiting on a gesture; unlock() opens it */
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
      fetchCalls();
      schedule();
    }

    function ambienceStop() {
      ambienceWanted = false;
      window.clearTimeout(timer);
    }

    /* Make one call happen now, whether or not the timer was due.  Used by
       the tiger: something has to startle it. */
    function callNow(id) {
      if (!ensure()) { emit('animal', id || 'monkey'); return; }
      if (!buffers[id]) {
        /* the drawing still reacts, so the hunt works with the sound off */
        emit('animal', id || 'monkey');
        return;
      }
      lastCall = id;
      callOnce(id);
      schedule();
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { window.clearTimeout(timer); }
      else if (ambienceWanted) schedule();
    });

    return {
      ready: ready,
      play: play,
      unlock: function () { ensure(); if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} } },
      ambienceStart: ambienceStart,
      ambienceStop: ambienceStop,
      callNow: callNow,
      isOn: function () { return state.sound; },
      set: function (on) {
        state.sound = !!on;
        if (master) master.gain.value = on ? 1 : 0;
        save();
        emit('sound', state.sound);
        syncSoundButtons();
      },
      gain: function () { return master ? master.gain.value : null; },
      context: function () { return ctx; }
    };
  })();

  /* ------------------------------------------------------------- drawings */

  function keySvg(tag, id) {
    var gid = 'kg-' + (id || Math.random().toString(36).slice(2, 7));
    return '<svg viewBox="0 0 120 70" role="img" aria-hidden="true" focusable="false">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0.2" y2="1">' +
      '<stop offset="0" stop-color="#F0DDA8"/><stop offset=".42" stop-color="#B08A2E"/>' +
      '<stop offset=".72" stop-color="#8A6A24"/><stop offset="1" stop-color="#5E4712"/>' +
      '</linearGradient></defs>' +
      '<path d="M46 30 L60 24" stroke="#4A3A12" stroke-width="2.4" fill="none"/>' +
      '<rect x="3" y="11" width="45" height="36" rx="4" fill="url(#' + gid + ')" stroke="#43330F" stroke-width="1.6"/>' +
      '<circle cx="11" cy="18" r="2.4" fill="#2A1F06"/>' +
      '<text x="27.5" y="36" text-anchor="middle" font-family="Cinzel, Georgia, serif" ' +
      'font-size="' + (tag.length > 3 ? 14 : 17) + '" font-weight="600" fill="#241A04" ' +
      'letter-spacing=".5">' + tag + '</text>' +
      '<circle cx="73" cy="24" r="12.5" fill="none" stroke="url(#' + gid + ')" stroke-width="6.5"/>' +
      '<path d="M84 24 H113" stroke="url(#' + gid + ')" stroke-width="6.5" stroke-linecap="round" fill="none"/>' +
      '<path d="M103 26 v10 M112 26 v13" stroke="url(#' + gid + ')" stroke-width="5" stroke-linecap="round" fill="none"/>' +
      '</svg>';
  }

  /* One stamp per door, drawn here.  Ragged strokes, ink that is not quite
     even: they have to look pressed on, not printed. */
  function stampSvg(kind) {
    var ink = { lost: '#7A2340', map: '#1F5B4E', book: '#2B2F6B', lantern: '#8A4418',
      gallery: '#4A2B6B', bar: '#7A5A14' }[kind] || '#7A2340';
    var head = '<svg viewBox="0 0 140 116" role="img" aria-hidden="true" focusable="false" ' +
      'style="--tilt:' + (kind.length % 2 ? '-5deg' : '4deg') + '">' +
      '<g fill="none" stroke="' + ink + '" stroke-width="3" stroke-linecap="round" ' +
      'stroke-linejoin="round" opacity=".88" stroke-dasharray="26 2.4">';
    var body = '';
    var label = '';
    switch (kind) {
      case 'lost':
        body = '<rect x="9" y="16" width="122" height="84" rx="3"/>' +
          '<rect x="16" y="23" width="108" height="70" rx="2" stroke-dasharray="14 3"/>' +
          '<g transform="translate(96 36) scale(.52)">' +
          '<path d="M46 74 c0-10 6-13 9-18 2-4 1-9 5-9 4 0 4 5 3 9 l-2 7 h5 l10-3 c4-1 6 2 4 5 l-3 4 c3 0 4 3 2 5 l-4 3 c2 2 1 5-2 6 l-19 4 c-5 1-8-1-8-6z"/></g>';
        label = '<text x="60" y="58" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="22" font-weight="600" fill="' + ink + '" opacity=".9" letter-spacing="2">102B</text>' +
          '<text x="70" y="85" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="9" fill="' + ink + '" opacity=".85" letter-spacing="3">LOST PROPERTY</text>';
        break;
      case 'map':
        body = '<circle cx="70" cy="58" r="44"/><circle cx="70" cy="58" r="36" stroke-dasharray="12 3"/>' +
          '<ellipse cx="70" cy="58" rx="36" ry="14"/><ellipse cx="70" cy="58" rx="15" ry="36"/>' +
          '<path d="M34 58 h72"/>';
        label = '<text x="70" y="26" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="9" fill="' + ink + '" opacity=".9" letter-spacing="3">118</text>';
        break;
      case 'book':
        body = '<rect x="20" y="12" width="100" height="74" rx="4"/>' +
          '<path d="M70 12 v74"/><path d="M30 28 h30 M30 40 h30 M30 52 h26 M80 28 h30 M80 40 h26"/>';
        label = '<text x="70" y="106" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="9" fill="' + ink + '" opacity=".9" letter-spacing="3">214</text>';
        break;
      case 'lantern':
        body = '<path d="M70 12 v10 M52 22 h36 M56 22 c-6 16-6 36 0 52 h28 c6-16 6-36 0-52" />' +
          '<path d="M52 74 h36 M70 74 v14 M62 88 h16"/><path d="M64 34 c0 12 0 20 0 30 M76 34 c0 12 0 20 0 30"/>';
        label = '<text x="70" y="108" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="9" fill="' + ink + '" opacity=".9" letter-spacing="3">311</text>';
        break;
      case 'gallery':
        body = '<rect x="14" y="20" width="52" height="66" rx="2"/><rect x="76" y="32" width="50" height="46" rx="2"/>' +
          '<path d="M22 74 l14-22 10 14 8-10 10 18z"/><path d="M84 68 l12-18 9 12 7-8 8 14z"/>' +
          '<circle cx="34" cy="36" r="5"/>';
        label = '<text x="70" y="106" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="9" fill="' + ink + '" opacity=".9" letter-spacing="3">402</text>';
        break;
      case 'bar':
        body = '<circle cx="70" cy="56" r="44" stroke-dasharray="16 3"/>' +
          '<path d="M48 36 h44 l-22 24z"/><path d="M70 60 v22 M58 82 h24"/>' +
          '<path d="M84 30 l10-12"/><circle cx="96" cy="16" r="4"/>';
        label = '<text x="70" y="112" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="9" fill="' + ink + '" opacity=".9" letter-spacing="3">901</text>';
        break;
    }
    return head + body + '</g>' + label + '</svg>';
  }

  var ICONS = {
    passport: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5zM7 3v18" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="13" cy="10" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9.8 10h6.4M13 6.8c1.6 2 1.6 4.4 0 6.4-1.6-2-1.6-4.4 0-6.4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
    soundOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h3.5L12 5v14l-4.5-4H4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h3.5L12 5v14l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    hat: '<svg viewBox="0 0 120 80" aria-hidden="true"><ellipse cx="60" cy="58" rx="52" ry="14" fill="#D9BE7E" stroke="#8A6A24" stroke-width="2"/><path d="M28 56c0-18 10-32 32-32s32 14 32 32" fill="#E7D3A0" stroke="#8A6A24" stroke-width="2"/><path d="M28 50c14 7 50 7 64 0" fill="none" stroke="#A63329" stroke-width="5"/></svg>'
  };

  /* ------------------------------------------------------------------- DOM */

  var el = {};

  function build() {
    if (document.getElementById('hotelTray')) return;

    var live = document.createElement('p');
    live.className = 'hotel-live';
    live.id = 'hotelLive';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    document.body.appendChild(live);
    el.live = live;

    var tray = document.createElement('div');
    tray.className = 'tray';
    tray.id = 'hotelTray';
    tray.innerHTML =
      '<ul class="tray-keys" id="trayKeys" aria-label="Keys you are holding"></ul>' +
      '<div class="tray-btns">' +
      '<button type="button" class="tray-btn tray-passport" id="trayPassport">' +
      ICONS.passport + '<span class="label">Passport</span> <span class="count" id="trayCount">0/6</span></button>' +
      '<button type="button" class="tray-btn tray-sound" id="traySound" aria-pressed="true">' +
      '<span class="on">' + ICONS.soundOn + '</span><span class="off">' + ICONS.soundOff + '</span>' +
      '<span class="label">Sound</span><span class="vh" id="soundState">Sound on</span></button>' +
      '</div>';
    document.body.appendChild(tray);
    el.tray = tray;
    el.keys = tray.querySelector('#trayKeys');
    el.count = tray.querySelector('#trayCount');
    el.soundBtn = tray.querySelector('#traySound');

    el.soundBtn.addEventListener('click', function () {
      sound.unlock();
      sound.set(!state.sound);
      if (state.sound) { sound.play('jingle'); if (state.checkedIn) sound.ambienceStart(); }
      announce(state.sound ? 'Sound on.' : 'Sound off.');
    });
    tray.querySelector('#trayPassport').addEventListener('click', function () {
      sound.unlock(); openPassport();
    });

    var card = document.createElement('div');
    card.className = 'concierge';
    card.id = 'concierge';
    card.hidden = true;
    card.innerHTML = '<span class="concierge-who">The concierge</span>' +
      '<span id="conciergeText"></span>' +
      '<button type="button" class="concierge-close" aria-label="Dismiss">&times;</button>';
    document.body.appendChild(card);
    el.card = card;
    el.cardText = card.querySelector('#conciergeText');
    card.querySelector('.concierge-close').addEventListener('click', function () {
      card.hidden = true;
    });

    buildPassport();
    renderKeys();
    syncSoundButtons();

    /* Before check-in there is nothing in the tray worth showing, except on a
       room page, where you plainly are already a guest. */
    updateTrayVisibility();
  }

  function updateTrayVisibility() {
    if (!el.tray) return;
    var show = state.checkedIn || state.keys.length > 0 || hooks.shot;
    el.tray.hidden = !show;
  }

  function renderKeys() {
    if (!el.keys) return;
    if (!state.keys.length) {
      el.keys.innerHTML = '<li class="tray-empty">No keys yet</li>';
    } else {
      el.keys.innerHTML = state.keys.map(function (id) {
        var k = KEYS[id];
        var door = doorById(k.door);
        var opened = state.doors[k.door] === 'open';
        return '<li class="keyitem" data-key="' + id + '">' +
          '<button type="button" class="keybtn" data-key="' + id + '" ' +
          'aria-label="Key ' + k.tag + (door ? ', ' + door.name : '') +
          (opened ? ', already used' : '') + '. Drag it to a door, or press Enter to pick it up.">' +
          keySvg(k.tag, id) + '</button></li>';
      }).join('');
    }
    if (el.count) el.count.textContent = state.stamps.length + '/' + DOORS.length;
    /* With nothing in it the tray is a slim chip: an empty felt saying NO KEYS
       YET is dead weight, and it sits exactly where the reception bell is. */
    if (el.tray) el.tray.classList.toggle('is-compact', state.keys.length === 0);
  }

  function syncSoundButtons() {
    if (el.soundBtn) {
      el.soundBtn.setAttribute('aria-pressed', state.sound ? 'true' : 'false');
      var s = el.soundBtn.querySelector('#soundState');
      if (s) s.textContent = state.sound ? 'Sound on' : 'Sound off';
    }
    var sw = document.getElementById('ppSoundSwitch');
    if (sw) {
      sw.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', String((b.dataset.v === 'on') === state.sound));
      });
    }
  }

  function announce(text) {
    if (!el.live) return;
    el.live.textContent = '';
    window.setTimeout(function () { el.live.textContent = text; }, 40);
  }

  var cardTimer = 0;
  function say(text, opts) {
    opts = opts || {};
    if (!el.card) return;
    el.cardText.textContent = text;
    el.card.hidden = false;
    el.card.classList.remove('is-in');
    void el.card.offsetWidth;
    if (!stillFrame) el.card.classList.add('is-in');
    announce(text);
    window.clearTimeout(cardTimer);
    if (opts.sticky !== true) {
      cardTimer = window.setTimeout(function () { el.card.hidden = true; }, opts.for || 11000);
    }
  }

  /* --------------------------------------------------------- the passport */

  function buildPassport() {
    var dlg = document.createElement('dialog');
    dlg.className = 'passport';
    dlg.id = 'passportBook';
    dlg.setAttribute('aria-labelledby', 'passportTitle');
    dlg.innerHTML =
      '<div class="passport-inner">' +
      '<div class="passport-head">' +
      '<div><p class="passport-kick">Guest passport</p>' +
      '<h2 id="passportTitle">Your stay</h2></div>' +
      '<button type="button" class="passport-close" aria-label="Close the passport">&times;</button>' +
      '</div>' +
      '<p class="passport-sub">A stamp for every room you get into. Fill all six and the hotel owes you something.</p>' +
      '<ul class="stamps" id="ppStamps"></ul>' +
      '<div id="ppFullNote"></div>' +
      '<h3>What you are carrying</h3>' +
      '<div id="ppFinds"></div>' +
      '<div class="passport-controls">' +
      '<span class="switch-label">How this site runs</span>' +
      '<div class="switch" id="ppModeSwitch" role="group" aria-label="Full experience or lighter version">' +
      '<button type="button" data-v="full" aria-pressed="false">Full experience</button>' +
      '<button type="button" data-v="lite" aria-pressed="false">Lighter version</button>' +
      '</div>' +
      '<div class="switch" id="ppSoundSwitch" role="group" aria-label="Sound">' +
      '<button type="button" data-v="on" aria-pressed="true">Sound on</button>' +
      '<button type="button" data-v="off" aria-pressed="false">Sound off</button>' +
      '</div>' +
      '<button type="button" class="passport-reset" id="ppReset">Reset my stay</button>' +
      '</div>' +
      '<p class="passport-note">The lighter version drops the 3D and the shaders for flat drawings. Everything still works and every room is still reachable. Your choice is remembered on this device.</p>' +
      '</div>';
    document.body.appendChild(dlg);
    el.passport = dlg;

    dlg.querySelector('.passport-close').addEventListener('click', function () { closePassport(); });
    dlg.addEventListener('cancel', function () { closePassport(); });
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) closePassport();
    });

    dlg.querySelector('#ppModeSwitch').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-v]');
      if (!b) return;
      setMode(b.dataset.v);
    });
    dlg.querySelector('#ppSoundSwitch').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-v]');
      if (!b) return;
      sound.unlock();
      sound.set(b.dataset.v === 'on');
      if (state.sound && state.checkedIn) sound.ambienceStart();
    });
    dlg.querySelector('#ppReset').addEventListener('click', function () {
      reset();
      renderPassport();
      say('Your stay has been reset. Ring the bell again whenever you like.');
    });
  }

  function renderPassport() {
    if (!el.passport) return;
    var list = el.passport.querySelector('#ppStamps');
    list.innerHTML = DOORS.map(function (d) {
      var got = state.stamps.indexOf(d.id) >= 0;
      return '<li class="stampslot' + (got ? ' is-stamped' : '') + '" data-door="' + d.id + '">' +
        (got ? stampSvg(d.stamp) : '<span class="no">' + d.no + '</span>') + '</li>';
    }).join('');

    var full = el.passport.querySelector('#ppFullNote');
    full.innerHTML = state.stamps.length >= DOORS.length
      ? '<p class="passport-full">Six of six. The book is full. Whatever the hotel does about that, it does at the front desk.</p>'
      : '';

    var finds = el.passport.querySelector('#ppFinds');
    if (!state.found.length) {
      finds.innerHTML = '<p class="finds-empty">Nothing yet. Rooms tend to have things in them.</p>';
    } else {
      finds.innerHTML = '<ul class="finds">' + state.found.map(function (id) {
        var f = FINDS[id];
        if (!f) return '';
        var pic = f.img
          ? '<img src="' + f.img + '" width="' + f.w + '" height="' + f.h + '" loading="lazy" alt="' + f.alt + '">'
          : '<div style="padding:10px">' + (ICONS[f.icon] || '') + '</div>';
        return '<li class="find"><figure style="margin:0">' + pic +
          '<figcaption>' + f.title + (f.note ? '<br>' + f.note : '') + '</figcaption></figure></li>';
      }).join('') + '</ul>';
    }

    el.passport.querySelectorAll('#ppModeSwitch button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.v === mode));
    });
    syncSoundButtons();
  }

  function openPassport() {
    if (!el.passport) return;
    renderPassport();
    try { el.passport.showModal(); } catch (e) { el.passport.setAttribute('open', ''); }
    if (state.sound) sound.play('rustle');
  }
  function closePassport() {
    if (!el.passport) return;
    try { el.passport.close(); } catch (e) { el.passport.removeAttribute('open'); }
  }

  /* ---------------------------------------------------- keys arriving */

  function giveKey(id, opts) {
    opts = opts || {};
    if (!KEYS[id]) return false;
    if (state.keys.indexOf(id) >= 0) return false;
    state.keys.push(id);
    save();

    var done = function () {
      renderKeys();
      updateTrayVisibility();
      if (el.tray && !stillFrame) {
        el.tray.classList.remove('is-catching');
        void el.tray.offsetWidth;
        el.tray.classList.add('is-catching');
      }
      var li = el.keys && el.keys.querySelector('[data-key="' + id + '"]');
      if (li && !stillFrame) li.classList.add('is-arriving');
      if (state.sound) sound.play('jingle');
      var k = KEYS[id];
      var door = doorById(k.door);
      announce('Key ' + k.tag + ' is in your tray. It opens ' + (door ? door.name : 'a room') + '.');
      emit('key', id);
    };

    if (opts.from && !stillFrame && el.tray && !el.tray.hidden) {
      flyKey(id, opts.from, done);
    } else if (opts.from && el.tray && el.tray.hidden) {
      /* the tray is about to appear: show it, then fly */
      updateTrayVisibility();
      window.requestAnimationFrame(function () { flyKey(id, opts.from, done); });
    } else {
      done();
    }
    return true;
  }

  function flyKey(id, fromEl, done) {
    var from = fromEl.getBoundingClientRect ? fromEl.getBoundingClientRect() : fromEl;
    var trayRect = el.tray.getBoundingClientRect();
    var ghost = document.createElement('div');
    ghost.className = 'key-flight';
    ghost.innerHTML = keySvg(KEYS[id].tag, 'fly');
    document.body.appendChild(ghost);

    var x0 = from.left + from.width / 2 - 31;
    var y0 = from.top + from.height / 2 - 18;
    var x1 = trayRect.left + 30;
    var y1 = trayRect.top + trayRect.height / 2 - 18;

    ghost.style.transform = 'translate(' + x0 + 'px,' + y0 + 'px) rotate(-18deg) scale(1.3)';
    ghost.style.opacity = '0';

    var g = window.gsap;
    if (g) {
      /* it hangs in your hand for a beat, then goes to the tray */
      var tl = g.timeline({ onComplete: function () { ghost.remove(); done(); } });
      tl.set(ghost, { x: x0, y: y0, rotate: -18, scale: 1.3, opacity: 0, clearProps: '' })
        .to(ghost, { opacity: 1, duration: 0.16, ease: 'none' })
        .to(ghost, { x: x1, y: y1, rotate: 4, scale: 1, duration: 0.78, ease: 'power3.inOut' }, 0.22)
        .to(ghost, { opacity: 0, duration: 0.18, ease: 'none' }, 0.86);
    } else {
      ghost.style.transition = 'transform .75s cubic-bezier(.4,0,.2,1), opacity .2s';
      ghost.style.opacity = '1';
      window.requestAnimationFrame(function () {
        ghost.style.transform = 'translate(' + x1 + 'px,' + y1 + 'px) rotate(4deg) scale(1)';
      });
      window.setTimeout(function () { ghost.remove(); done(); }, 800);
    }
  }

  /* ------------------------------------------------------------ the doors */

  function has(keyId) { return state.keys.indexOf(keyId) >= 0; }
  function canOpen(doorId) {
    var d = doorById(doorId);
    return !!(d && has(d.key));
  }
  function isOpen(doorId) { return state.doors[doorId] === 'open'; }

  function openDoor(doorId) {
    if (!doorById(doorId)) return false;
    if (state.doors[doorId] !== 'open') {
      state.doors[doorId] = 'open';
      save();
      emit('door-open', doorId);
    }
    return true;
  }

  function stamp(doorId) {
    if (state.stamps.indexOf(doorId) >= 0) return false;
    if (!doorById(doorId)) return false;
    state.stamps.push(doorId);
    save();
    if (state.sound) sound.play('thump');
    renderKeys();
    emit('stamp', doorId);
    var d = doorById(doorId);
    announce('Passport stamped: ' + (d ? d.name : doorId) + '. ' +
      state.stamps.length + ' of ' + DOORS.length + '.');
    if (state.stamps.length >= DOORS.length) emit('passport-full');
    return true;
  }

  function addFound(id) {
    if (!FINDS[id]) return false;
    if (state.found.indexOf(id) >= 0) return false;
    state.found.push(id);
    save();
    emit('found', id);
    announce(FINDS[id].title + ' is in your passport.');
    return true;
  }
  function dropFound(id) {
    var i = state.found.indexOf(id);
    if (i < 0) return false;
    state.found.splice(i, 1);
    save();
    emit('found', null);
    return true;
  }
  function carrying(id) { return state.found.indexOf(id) >= 0; }

  function checkIn() {
    var first = !state.checkedIn;
    state.checkedIn = true;
    save();
    updateTrayVisibility();
    sound.unlock();
    if (state.sound) { sound.play('ding'); sound.ambienceStart(); }
    if (first) emit('check-in');
    return first;
  }

  function reset() {
    state = blank();
    try { window.localStorage.removeItem(STORE_KEY); } catch (e) {}
    sound.ambienceStop();
    renderKeys();
    updateTrayVisibility();
    emit('reset');
  }

  function setMode(m) {
    if (m !== 'full' && m !== 'lite') return;
    if (m === mode) return;
    state.mode = m;
    save();
    emit('mode', m);
    /* The page is built differently in each mode, so the honest thing is to
       load it again rather than pretend we can swap it live. */
    var u = new URL(window.location.href);
    u.searchParams.delete('lite');
    u.searchParams.delete('full');
    window.location.href = u.toString();
  }

  /* --------------------------------------------------------- fire & burn */

  var glStage = null;
  var glFailed = false;

  function stage() {
    if (mode !== 'full' || glFailed) return Promise.resolve(null);
    if (glStage) return glStage;
    glStage = import('./gl.js')
      .then(function (m) { return m.getStage(); })
      .then(function (s) {
        if (!s) { glFailed = true; return null; }
        if (hooks.shot) {
          /* leave room for lazily built scenes and their textures */
          window.setTimeout(function () { s.freeze(); }, 2200);
          window.setTimeout(function () { s.renderOnce(); }, 3200);
          window.setTimeout(function () { s.renderOnce(); }, 4600);
        }
        return s;
      })
      .catch(function () { glFailed = true; return null; });
    return glStage;
  }

  /* A paper fire filling an element.  In the lighter version it is the same
     sculpture drawn as stacked SVG paths. */
  function fire(target, opts) {
    opts = opts || {};
    if (!target) return Promise.resolve(null);
    if (mode !== 'full') { return Promise.resolve(cssFire(target, opts)); }
    return stage().then(function (s) {
      if (!s) return cssFire(target, opts);
      return import('./fire.js').then(function (m) {
        return m.mountFire(s, target, opts).then(function (h) {
          if (h && hooks.shot) h.setTime(opts.shotTime != null ? opts.shotTime : 21);
          if (h) fires.push(h);
          return h;
        });
      }).catch(function () { return cssFire(target, opts); });
    });
  }

  var fires = [];

  /* THE LIGHTER VERSION of the paper fire: the same sculpture as stacked SVG
     paths.  A run of tall, rounded, leaning flame tongues - never a saw-tooth
     ridge - each one a smaller cut of the one behind it, swaying. */
  var PF_PATH = 'M12 160 C6 122 24 96 36 68 C45 48 49 28 50 4 C51 28 55 48 64 68 ' +
    'C76 96 94 122 88 160 Z';
  var PF_COLS = ['#531017', '#7E1714', '#A82A13', '#C94A14', '#E28A24', '#F4CE8A'];

  function cssFire(target, opts) {
    if (target.querySelector('.paper-fire')) return null;
    /* how many tongues run across: the same number the shader would cut */
    var count = Math.max(1, Math.round(opts.count || (opts.licks ? opts.licks / 1.7 : 1)));
    var wrap = document.createElement('span');
    wrap.className = 'paper-fire';
    wrap.setAttribute('aria-hidden', 'true');
    var cells = '';
    var boxH = Math.round((opts.height != null ? opts.height : 0.9) * 100);
    for (var c = 0; c < count; c++) {
      /* a few tall, many medium, some low, and they overlap */
      var tall = [1, 0.62, 0.84, 0.54, 1, 0.70, 0.58, 0.92][c % 8];
      var cx = ((c + 0.5) / count) * 100;
      var cw = (100 / count) * 1.08 * (opts.spread != null ? opts.spread : 1);
      var lean = (c % 3) - 1;
      var sheets = '';
      for (var i = 0; i < 6; i++) {
        var s = 1 - i * 0.088;
        sheets += '<path class="pf-sheet" d="' + PF_PATH + '" fill="' + PF_COLS[i] + '" ' +
          'style="animation-delay:' + (-c * 0.7 - i * 0.35).toFixed(2) + 's" ' +
          'transform="translate(50 160) rotate(' + (lean * 3.4) + ') scale(' +
          s.toFixed(3) + ' ' + s.toFixed(3) + ') translate(-50 -160)"/>';
      }
      cells += '<svg viewBox="0 0 100 160" preserveAspectRatio="none" ' +
        'style="left:' + (cx - cw / 2) + '%;width:' + cw + '%;' +
        'height:' + Math.round(boxH * tall) + '%;' +
        'bottom:' + Math.round((opts.base != null ? opts.base : 0) * 100) + '%;top:auto">' +
        sheets + '</svg>';
    }
    /* the lip of the trough, so the feet of the tongues are hidden */
    cells += '<span class="pf-foot"></span>';
    wrap.innerHTML = cells;
    var cs = window.getComputedStyle(target);
    if (cs.position === 'static') target.style.position = 'relative';
    target.appendChild(wrap);
    return { lite: true, node: wrap, setNight: function () {}, setIntensity: function () {},
      setTime: function () {}, remove: function () { wrap.remove(); } };
  }

  function setNight(v) {
    document.documentElement.style.setProperty('--night', String(v));
    for (var i = 0; i < fires.length; i++) {
      if (fires[i] && fires[i].setNight) fires[i].setNight(v);
    }
  }

  /**
   * The burn-away.  A sheet of paper over the element (or the viewport) is
   * eaten by a charred, glowing edge travelling out from `origin`.
   * Returns a promise that resolves when the paper has gone.
   */
  function burn(opts) {
    opts = opts || {};
    var freeze = opts.freeze != null ? opts.freeze : (hooks.burn != null ? hooks.burn : null);
    if (state.sound && freeze == null) sound.play('rustle');

    if (mode !== 'full' || glFailed) return cssBurn(opts, freeze);

    return stage().then(function (s) {
      if (!s) return cssBurn(opts, freeze);
      return import('./fire.js').then(function (m) {
        return m.burnAway(s, {
          el: opts.el || null,
          origin: opts.origin || null,
          duration: opts.duration || 1150,
          paper: opts.paper || '#EFE6D2',
          freeze: freeze == null ? undefined : freeze,
          onProgress: opts.onProgress
        });
      });
    }).catch(function () { return cssBurn(opts, freeze); });
  }

  function cssBurn(opts, freeze) {
    return new Promise(function (resolve) {
      var sheet = document.createElement('div');
      sheet.className = 'burn-sheet';
      sheet.setAttribute('aria-hidden', 'true');
      if (opts.el) {
        var r = opts.el.getBoundingClientRect();
        sheet.style.position = 'fixed';
        sheet.style.left = r.left + 'px';
        sheet.style.top = r.top + 'px';
        sheet.style.width = r.width + 'px';
        sheet.style.height = r.height + 'px';
        sheet.style.inset = 'auto';
      }
      var host = opts.el ? document.body : document.body;
      var ox = 50, oy = 50;
      if (opts.origin) {
        var rr = opts.el ? opts.el.getBoundingClientRect()
          : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        ox = ((opts.origin.x - rr.left) / Math.max(1, rr.width)) * 100;
        oy = ((opts.origin.y - rr.top) / Math.max(1, rr.height)) * 100;
      }
      sheet.style.setProperty('--bx', ox + '%');
      sheet.style.setProperty('--by', oy + '%');
      sheet.style.setProperty('--bp', '0');
      host.appendChild(sheet);

      if (freeze != null) {
        sheet.style.setProperty('--bp', String(freeze));
        resolve({ hold: true, remove: function () { sheet.remove(); } });
        return;
      }
      if (stillFrame) {
        window.setTimeout(function () { sheet.remove(); resolve(); }, 60);
        return;
      }
      var dur = opts.duration || 1000, t0 = performance.now();
      (function step(now) {
        var k = Math.min(1, (now - t0) / dur);
        sheet.style.setProperty('--bp', String(k));
        if (opts.onProgress) opts.onProgress(k);
        if (k < 1) requestAnimationFrame(step);
        else { sheet.remove(); resolve(); }
      })(t0);
    });
  }

  /* ------------------------------------------------- room pages: gating */

  /**
   * Called at the top of every room page.
   *   Hotel.gateRoom('102b', { onOpen: fn })
   * If the visitor holds the key (or the door is already open) it opens the
   * door, stamps the passport, runs the arrival burn and calls onOpen.
   * If not, it swaps in the locked door and returns false.
   */
  function gateRoom(doorId, opts) {
    opts = opts || {};
    var d = doorById(doorId);
    if (!d) return false;

    var allowed = isOpen(doorId) || has(d.key);
    var mount = opts.mount || document.getElementById('roomMain') || document.querySelector('main');

    if (!allowed) {
      if (mount) mount.innerHTML = lockedMarkup(d);
      var door = document.querySelector('.locked-door');
      var rattle = function () {
        if (!door) return;
        door.classList.remove('is-rattling');
        void door.offsetWidth;
        door.classList.add('is-rattling');
        if (state.sound) sound.play('clunk');
        announce('Locked. The handle just rattles.');
      };
      var btn = document.getElementById('tryHandle');
      if (btn) btn.addEventListener('click', rattle);
      if (door) door.addEventListener('click', rattle);
      document.documentElement.classList.add('room-is-locked');
      return false;
    }

    openDoor(doorId);
    stamp(doorId);

    /* The paper the corridor left over the doorway burns off to show the
       room.  The door was unlocked on the way in, so the fire starts at the
       lock: about two thirds across, a bit above the middle. */
    var origin = { x: window.innerWidth * (opts.originX || 0.62),
      y: window.innerHeight * (opts.originY || 0.52) };
    if (hooks.burn != null) {
      burn({ origin: origin, freeze: hooks.burn });
    } else if (!stillFrame) {
      burn({ origin: origin, duration: opts.duration || 1250 });
      if (state.sound) window.setTimeout(function () { sound.play('creak'); }, 120);
    }
    if (opts.onOpen) opts.onOpen();
    return true;
  }

  function lockedMarkup(d) {
    return '<section class="room"><div class="wrap">' +
      '<div class="room-locked">' +
      '<div class="locked-door" aria-hidden="true">' +
      '<span class="locked-plate">' + d.no + '</span>' +
      '<span class="locked-handle"></span><span class="locked-keyhole"></span>' +
      '</div>' +
      '<div class="room-card">' +
      '<p class="kicker">The corridor</p>' +
      '<h1 class="display">This one is locked.</h1>' +
      '<p>Key ' + d.no + ' opens it, and you have not got key ' + d.no + '. ' +
      (KEYS[d.key] ? KEYS[d.key].where : '') + '</p>' +
      '<p class="room-back"><button type="button" class="btn btn-ink" id="tryHandle">Try the handle</button> ' +
      '<a class="btn" href="index.html#corridor">Back to the corridor</a></p>' +
      '</div></div></div></section>';
  }

  /* --------------------------------------------------------------- boot */

  function boot() {
    build();
    /* The first real gesture on this page opens the audio context, so a
       visitor who arrives in a room from the corridor still hears the place.
       It is inside a gesture, which is the whole rule. */
    var wake = function () {
      sound.unlock();
      if (state.checkedIn && state.sound) sound.ambienceStart();
      document.removeEventListener('pointerdown', wake, true);
      document.removeEventListener('keydown', wake, true);
    };
    document.addEventListener('pointerdown', wake, true);
    document.addEventListener('keydown', wake, true);

    if (hooks.night) setNight(1);
    if (hooks.passport) window.setTimeout(openPassport, 120);
    if (hooks.shot) {
      document.documentElement.classList.add('shot');
      if (el.tray) el.tray.hidden = false;
    }
    emit('ready');
    readyFns.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
    readyFns.length = 0;
    booted = true;
  }

  var booted = false;
  var readyFns = [];
  function ready(fn) {
    if (booted) { try { fn(); } catch (e) { console.error(e); } }
    else readyFns.push(fn);
  }

  /* ------------------------------------------------------------- exports */

  window.Hotel = {
    VERSION: 3,
    DOORS: DOORS,
    KEYS: KEYS,
    FINDS: FINDS,
    hooks: hooks,
    ephemeral: EPHEMERAL,
    reduceMotion: reduceMotion,
    stillFrame: stillFrame,

    ready: ready,
    on: on,
    off: off,
    emit: emit,

    state: function () { return JSON.parse(JSON.stringify(state)); },
    mode: function () { return mode; },
    setMode: setMode,

    has: has,
    giveKey: giveKey,
    canOpen: canOpen,
    isOpen: isOpen,
    openDoor: openDoor,
    stamp: stamp,
    door: doorById,

    addFound: addFound,
    dropFound: dropFound,
    carrying: carrying,

    checkIn: checkIn,
    isCheckedIn: function () { return state.checkedIn; },
    reset: reset,

    sound: sound,
    say: say,
    announce: announce,
    openPassport: openPassport,
    closePassport: closePassport,
    renderPassport: renderPassport,
    renderKeys: renderKeys,

    stage: stage,
    fire: fire,
    burn: burn,
    setNight: setNight,
    keySvg: keySvg,
    stampSvg: stampSvg,

    gateRoom: gateRoom
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window, document);
