/* ==========================================================================
   home.js - the hotel, on the home page.  v3.

   Six jobs:
     1. the paper torches either side of the hero arch, and the fire pit
     2. CHECK-IN: ring the bell, a key drops into your hand, the hotel starts
        making its noises.  Ring it again and the concierge gives the next
        hint.  That ladder is the only help text on the page.
     3. THE CORRIDOR: six doors.  In the full version a three.js corridor is
        drawn behind the six anchors and each anchor is moved over its door
        every frame.  Drag a key from the tray to a door, or focus a door and
        press Enter.  Right key: the lock turns and the door burns away.
        Wrong key: the Do Not Disturb sign flips, the handle rattles, somebody
        says something through it, and the key drops back in the tray.
     4. THE KEYS hidden in the artwork: the tiger, the macaw, the painted
        leaves after dark, and the monkey on the enquiry form.
     5. DAY TURNS TO NIGHT as you scroll, with the paper fire taking over.
     6. The drawings react when an animal is heard.

   Everything here has a keyboard route and works in the lighter version.
   ========================================================================== */

const Hotel = window.Hotel;
const gsap = window.gsap;

/* --------------------------------------------------------------- helpers */

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

function bubble(anchor, text, ms) {
  if (!anchor) return;
  const b = document.createElement('p');
  b.className = 'bubble';
  b.textContent = text;
  const host = anchor.offsetParent || document.body;
  document.body.appendChild(b);
  const r = anchor.getBoundingClientRect();
  b.style.position = 'fixed';
  b.style.left = Math.max(10, Math.min(window.innerWidth - 240, r.left + r.width / 2 - 28)) + 'px';
  b.style.top = Math.max(60, r.top - b.offsetHeight - 14) + 'px';
  if (!Hotel.stillFrame) b.classList.add('is-in');
  Hotel.announce(text);
  window.setTimeout(() => {
    b.classList.add('is-out');
    window.setTimeout(() => b.remove(), 320);
  }, ms || 2600);
  return b;
}

function stir(el, ms) {
  if (!el || Hotel.stillFrame) return;
  el.classList.remove('is-stirring');
  void el.offsetWidth;
  el.classList.add('is-stirring');
  window.setTimeout(() => el.classList.remove('is-stirring'), ms || 1300);
}

/* ================================================================ the fire */

async function lightTheFires() {
  /* ?ft=<seconds> shifts the frozen frame the fire is caught on, so a
     screenshot can show three different moments of it. Shot hook only. */
  const ft = parseFloat(new URLSearchParams(location.search).get('ft')) || 0;
  const torches = $$('[data-fire="torch"]');
  for (const t of torches) {
    await Hotel.fire(t, {
      sheets: 6, base: 0.03, height: 0.76, licks: 1.5, taper: 1,
      embers: 0.8, shotTime: 17 + torches.indexOf(t) * 9 + ft
    });
  }
  const pit = $('[data-fire="pit"]');
  if (pit) {
    await Hotel.fire(pit, {
      sheets: 7, base: 0.04, height: 0.72, licks: 12, taper: 0,
      embers: 0.9, shotTime: 31 + ft
    });
  }
}

/* ============================================================== check-in */

const HINTS = [
  /* 0 is the first ring: it hands over a key, so it has its own line */
  'The tiger on the no cattle sightseeing panel has not moved in years. Something under its paw has.',
  /* 2 is the third ring: 102B */
  'The macaw in the About section is holding something, and it will not hand it over politely. Keep at it.',
  'Wait until it is properly dark. The painted leaves behind the enquiry form keep something that only shows at night.',
  'The monkey on the form will trade. Bring him something his size and he will give up what he is holding.',
  'Room 214 is not on this floor at all. Somebody left a jar of sand in 102B, and something in it rattles.',
  'Everything you have not found yet is behind a door you have not opened.'
];

function setUpBell() {
  const bell = $('#bell');
  if (!bell) return;
  let rings = Number(sessionStorage.getItem('ttt-rings') || 0);

  function remember(n) {
    if (Hotel.ephemeral) return;
    try { sessionStorage.setItem('ttt-rings', String(n)); } catch (e) {}
  }

  bell.addEventListener('click', () => {
    rings += 1;
    remember(rings);
    if (!Hotel.stillFrame) {
      bell.classList.remove('is-ringing');
      void bell.offsetWidth;
      bell.classList.add('is-ringing');
    }
    Hotel.checkIn();                        /* opens the audio, starts the ambience */

    if (rings === 1) {
      Hotel.giveKey('k-311', { from: bell });
      Hotel.say('Room 311 is yours for the afternoon. The other keys are about the place, ' +
        'and they are not all where you would put them. Ring again if you get stuck.', { for: 15000 });
      $('.reception') && $('.reception').classList.add('is-done');
      return;
    }
    if (rings === 3) {
      const got = Hotel.giveKey('k-102b', { from: bell });
      Hotel.say(got
        ? 'Lost property keeps its own key behind the desk. 102B. Mind the mattress.'
        : HINTS[0], { for: 14000 });
      return;
    }
    const i = rings === 2 ? 0 : Math.min(HINTS.length - 1, rings - 3);
    Hotel.say(HINTS[i], { for: 14000 });
  });
}

/* ========================================================= the key hunts */

function setUpHunts() {
  /* --- the tiger is lying on one ---------------------------------------- */
  const tigerBtn = $('#huntTiger');
  const tigerArt = $('.tiger');
  let tugs = 0;
  if (tigerBtn) {
    if (Hotel.has('k-118')) tigerBtn.classList.add('is-done');
    tigerBtn.addEventListener('click', () => {
      tugs += 1;
      if (!Hotel.stillFrame) {
        tigerBtn.classList.remove('is-tugging');
        void tigerBtn.offsetWidth;
        tigerBtn.classList.add('is-tugging');
      }
      if (tugs === 1) {
        /* something has to startle it.  The call happens whether or not the
           sound is on, so this works in silence too. */
        Hotel.sound.callNow('bigcat');
        stir(tigerArt, 1800);
        bubble(tigerBtn, 'Its head comes up. The paw shifts about a centimetre.', 3400);
        return;
      }
      tigerBtn.classList.add('is-done');
      Hotel.giveKey('k-118', { from: tigerBtn });
      bubble(tigerBtn, 'Key 118. It was warm.', 3200);
    });
  }

  /* --- the macaw drops one if you keep bothering it ---------------------- */
  const macawBtn = $('#huntMacaw');
  const macawArt = $('.perch-macaw');
  let pokes = 0;
  const POKE = ['It shuffles along the frame and looks at you.',
    'It opens one wing. There is definitely something under it.'];
  if (macawBtn) {
    if (Hotel.has('k-901')) macawBtn.classList.add('is-done');
    macawBtn.addEventListener('click', () => {
      pokes += 1;
      stir(macawArt, 1000);
      if (pokes < 3) { bubble(macawBtn, POKE[pokes - 1], 3000); return; }
      if (Hotel.sound.isOn()) Hotel.sound.callNow('bird');
      macawBtn.classList.add('is-done');
      Hotel.giveKey('k-901', { from: macawBtn });
      bubble(macawBtn, 'It squawks, ruffles, and flings key 901 at the floor.', 3600);
    });
  }

  /* --- something in the painted leaves, after dark ----------------------- */
  const leaves = $('#huntLeaves');
  if (leaves) {
    if (Hotel.carrying('label')) leaves.classList.add('is-done');
    leaves.addEventListener('click', () => {
      leaves.classList.add('is-done');
      Hotel.addFound('label');
      bubble(leaves, 'A paper luggage label, stuck to a painted leaf. It is in your passport now.', 4200);
      if (Hotel.sound.isOn()) Hotel.sound.play('rustle');
    });
  }

  /* --- the monkey wants something his size ------------------------------ */
  const monkeyBtn = $('#huntMonkey');
  const monkeyArt = $('.perch-monkey');
  if (monkeyBtn) {
    if (Hotel.has('k-402')) monkeyBtn.classList.add('is-done');
    monkeyBtn.addEventListener('click', () => {
      stir(monkeyArt, 1200);
      if (!Hotel.carrying('hat')) {
        Hotel.sound.callNow('monkey');
        bubble(monkeyBtn, 'He is holding a key and he is not interested in you. He wants something his own size.', 4400);
        return;
      }
      Hotel.dropFound('hat');
      monkeyBtn.classList.add('is-done');
      Hotel.giveKey('k-402', { from: monkeyBtn });
      bubble(monkeyBtn, 'He puts the little hat on, tips it, and hands over key 402.', 4600);
      Hotel.say('That hat has been in lost property since before any of us started here.', { for: 12000 });
    });
  }
}

/* ===================================================== day turns to night */

function nightCurve(p) {
  /* afternoon down the top quarter, then dusk, then night by the enquiry */
  const k = Math.max(0, Math.min(1, (p - 0.22) / 0.58));
  return k * k * (3 - 2 * k);
}

function setUpNight() {
  let announced = Hotel.carrying('label');
  const leaves = $('#huntLeaves');

  function apply(p) {
    const n = nightCurve(p);
    Hotel.setNight(n);
    if (leaves && n > 0.68 && leaves.hidden) {
      leaves.hidden = false;
      if (!announced && !Hotel.carrying('label')) {
        announced = true;
        Hotel.announce('Something gold has just caught the light in the painted leaves behind the enquiry form.');
      }
    }
  }

  if (gsap && window.ScrollTrigger && !Hotel.stillFrame) {
    gsap.registerPlugin(window.ScrollTrigger);
    const ST = window.ScrollTrigger;
    ST.create({
      trigger: document.documentElement,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => apply(self.progress)
    });
    /* The page is mostly photographs.  Its height at boot is not its height
       once they have loaded, so the trigger has to be measured again. */
    const again = () => { ST.refresh(); };
    window.addEventListener('load', again);
    window.setTimeout(again, 900);
    window.setTimeout(again, 2600);
    apply(0);
  }

  /* apply() is idempotent, so this runs alongside ScrollTrigger rather than
     instead of it.  ScrollTrigger measures the page once and this page is
     mostly photographs: if it measures short, the grade would stick at
     afternoon.  A plain rAF-throttled listener cannot. */
  /* The page height is measured on a timer rather than on every scroll, so
     the handler itself never forces a layout, and the handler runs straight
     away rather than inside a rAF: a background tab or an off-screen frame
     throttles rAF and the grade would stick. */
  let maxScroll = 0;
  const measure = () => {
    maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    onScroll();
  };
  const onScroll = () => { apply(maxScroll > 0 ? window.scrollY / maxScroll : 0); };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  window.addEventListener('load', measure);
  window.setTimeout(measure, 700);
  window.setTimeout(measure, 2400);
  measure();

  if (Hotel.hooks.night) { Hotel.setNight(1); if (leaves) leaves.hidden = false; }
  if (Hotel.hooks.shot && leaves) leaves.hidden = false;
}

/* ================================================= the animals, heard then seen */

function setUpAnimals() {
  const map = {
    monkey: '.perch-monkey',
    bigcat: '.tiger',
    bird: '.perch-macaw',
    elephant: '.mural-band .mural'
  };
  Hotel.on('animal', (which) => {
    const el = $(map[which] || '');
    stir(el, which === 'elephant' ? 1600 : 1200);
    if (which === 'bird') flyBird();
  });
}

/* a bird crosses the hero mural */
function flyBird() {
  const host = $('.hero-bg');
  if (!host || Hotel.stillFrame) return;
  const b = document.createElement('span');
  b.className = 'flybird';
  b.setAttribute('aria-hidden', 'true');
  b.innerHTML = '<svg viewBox="0 0 40 18"><path d="M2 12 C8 2 14 2 20 9 C26 2 32 2 38 12" fill="none" ' +
    'stroke="rgba(233,206,122,.85)" stroke-width="2.2" stroke-linecap="round"/></svg>';
  host.appendChild(b);
  if (gsap) {
    gsap.fromTo(b, { x: -60, y: 40 + Math.random() * 120, opacity: 0 },
      { x: window.innerWidth + 80, y: '-=60', opacity: 1, duration: 4.2, ease: 'none',
        onComplete: () => b.remove() });
  } else {
    window.setTimeout(() => b.remove(), 4400);
  }
}

/* ============================================================ the corridor */

let corridor3d = null;

function setUpCorridor() {
  const stage = $('#corridorStage');
  const doors = $$('.door');
  if (!stage || !doors.length) return;

  doors.forEach(refreshDoor);

  /* --- pick a key up, drag it, drop it on a door ----------------------- */
  let picked = null;
  let ghost = null;

  function keyButtons() { return $$('.keybtn'); }

  function setPicked(id, btn) {
    picked = id;
    $$('.keybtn').forEach((b) => b.classList.toggle('is-picked', b.dataset.key === id));
    if (id) {
      const k = Hotel.KEYS[id];
      Hotel.announce('Holding key ' + k.tag + '. Choose a door, or press Enter on one.');
      $('#corridorHint') && ($('#corridorHint').textContent = 'Now choose a door for key ' + k.tag);
    } else {
      $('#corridorHint') && ($('#corridorHint').textContent = 'Drag a key onto a door');
    }
  }

  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest && e.target.closest('.keybtn');
    if (!btn) return;
    const id = btn.dataset.key;
    let moved = false;
    const sx = e.clientX, sy = e.clientY;

    ghost = document.createElement('div');
    ghost.className = 'key-flight';
    ghost.innerHTML = Hotel.keySvg(Hotel.KEYS[id].tag, 'drag');
    ghost.style.opacity = '0';
    document.body.appendChild(ghost);

    const move = (ev) => {
      if (!moved && (Math.abs(ev.clientX - sx) > 5 || Math.abs(ev.clientY - sy) > 5)) {
        moved = true;
        ghost.style.opacity = '1';
        btn.classList.add('is-dragging');
        setPicked(id, btn);
      }
      if (!moved) return;
      ghost.style.transform = 'translate(' + (ev.clientX - 31) + 'px,' + (ev.clientY - 18) + 'px) rotate(-8deg)';
      const over = document.elementFromPoint(ev.clientX, ev.clientY);
      const d = over && over.closest && over.closest('.door');
      $$('.door').forEach((x) => x.classList.toggle('is-drop-target', x === d));
    };

    const up = (ev) => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      btn.classList.remove('is-dragging');
      $$('.door').forEach((x) => x.classList.remove('is-drop-target'));
      if (ghost) { ghost.remove(); ghost = null; }
      if (!moved) { setPicked(picked === id ? null : id, btn); return; }
      const over = document.elementFromPoint(ev.clientX, ev.clientY);
      const d = over && over.closest && over.closest('.door');
      if (d) { tryDoor(d, id); setPicked(null); }
      else { Hotel.announce('Key ' + Hotel.KEYS[id].tag + ' is back in the tray.'); setPicked(null); }
    };

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  });

  /* click or Enter on a door */
  doors.forEach((d) => {
    d.addEventListener('click', (e) => {
      e.preventDefault();
      tryDoor(d, picked);
      setPicked(null);
    });
  });

  /* keep the anchors over their 3D doors */
  if (Hotel.mode() === 'full') buildCorridor3d(stage, doors);
}

function refreshDoor(d) {
  const id = d.dataset.door;
  d.classList.toggle('is-open', Hotel.isOpen(id));
  const door = Hotel.door(id);
  d.classList.toggle('can-open', !!door && Hotel.has(door.key) && !Hotel.isOpen(id));
}

const REFUSALS = ['Occupied.', 'Not your room.', 'Try the one it says on the tag.',
  'Somebody is asleep in here.'];

function tryDoor(el, keyId) {
  const id = el.dataset.door;
  const door = Hotel.door(id);
  if (!door) return;

  if (Hotel.isOpen(id)) { window.location.href = door.page; return; }

  const usable = keyId ? (Hotel.KEYS[keyId] && Hotel.KEYS[keyId].door === id)
    : Hotel.has(door.key);

  if (usable) { unlockDoor(el, door); return; }

  /* consequence */
  if (!Hotel.stillFrame) {
    el.classList.remove('is-refusing');
    void el.offsetWidth;
    el.classList.add('is-refusing');
    window.setTimeout(() => el.classList.remove('is-refusing'), 2000);
  }
  if (Hotel.sound.isOn()) Hotel.sound.play('clunk');
  const line = keyId ? REFUSALS[Math.floor(Math.random() * REFUSALS.length)]
    : 'Locked. You would need key ' + door.no + '.';
  bubble(el, line, 3000);
  Hotel.emit('door-refused', id);
  if (keyId) Hotel.announce('Key ' + Hotel.KEYS[keyId].tag + ' does not fit room ' +
    door.no + '. It is back in the tray.');
}

async function unlockDoor(el, door) {
  if (Hotel.sound.isOn()) Hotel.sound.play('clunk');
  el.classList.add('is-opening');
  Hotel.openDoor(door.id);
  Hotel.announce('Room ' + door.no + ' is open.');

  if (Hotel.stillFrame) { window.location.href = door.page; return; }

  /* what is behind the door, waiting to show through as the door burns */
  const r = el.getBoundingClientRect();
  const hole = document.createElement('div');
  hole.className = 'door-hole';
  hole.setAttribute('aria-hidden', 'true');
  hole.style.cssText = 'position:fixed;z-index:78;pointer-events:none;left:' + r.left +
    'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;' +
    'background:radial-gradient(120% 90% at 50% 40%, #E2661A 0%, #7A2B08 38%, #170B04 100%);';
  document.body.appendChild(hole);

  if (Hotel.sound.isOn()) window.setTimeout(() => Hotel.sound.play('creak'), 90);

  await Hotel.burn({
    el: hole,
    origin: { x: r.left + r.width * 0.84, y: r.top + r.height * 0.56 },   /* the lock */
    duration: 1000,
    paper: '#4E2E1B'                      /* the door's own colour: the door burns */
  });
  window.location.href = door.page;
}

/* ------------------------------------------------ the corridor in three.js */

async function buildCorridor3d(stageEl, doorEls) {
  let stage;
  try { stage = await Hotel.stage(); } catch (e) { stage = null; }
  if (!stage) return;

  let THREE, fire;
  try {
    THREE = await import('./vendor/three.module.min.js');
    fire = await import('./fire.js');
  } catch (e) { return; }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(56, 2.1, 0.05, 60);
  camera.position.set(0, 1.50, 2.55);

  const HALF = 2.15, CEIL = 2.72, END = -7.0;

  /* --- textures, all drawn on a 2D canvas ------------------------------ */
  const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const tex = (c, rx, ry) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    if (rx) t.repeat.set(rx, ry);
    return t;
  };
  function noise(g, w, h, a) {
    const im = g.getImageData(0, 0, w, h), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * a; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(im, 0, 0);
  }

  function wallTex() {
    const [c, g] = cnv(512, 512);
    g.fillStyle = '#123023'; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(201,162,39,.30)'; g.lineWidth = 2.4;
    for (let y = 40; y < 512; y += 86) {
      for (let x = ((y / 86) | 0) % 2 ? 43 : 0; x < 512; x += 86) {
        g.beginPath();
        g.moveTo(x + 43, y - 20);
        g.bezierCurveTo(x + 70, y + 2, x + 70, y + 32, x + 43, y + 50);
        g.bezierCurveTo(x + 16, y + 32, x + 16, y + 2, x + 43, y - 20);
        g.stroke();
        g.beginPath(); g.arc(x + 43, y + 15, 4, 0, 6.3); g.stroke();
      }
    }
    g.fillStyle = 'rgba(0,0,0,.38)'; g.fillRect(0, 392, 512, 120);
    g.fillStyle = '#3A2C10'; g.fillRect(0, 384, 512, 10);
    noise(g, 512, 512, 22);
    return tex(c, 5, 1.6);
  }
  function carpetTex() {
    const [c, g] = cnv(256, 256);
    g.fillStyle = '#5A1A18'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(190,150,60,.46)'; g.lineWidth = 3;
    for (let y = 0; y <= 256; y += 64) for (let x = 0; x <= 256; x += 64) {
      g.beginPath(); g.moveTo(x, y - 20); g.lineTo(x + 20, y); g.lineTo(x, y + 20); g.lineTo(x - 20, y);
      g.closePath(); g.stroke();
    }
    noise(g, 256, 256, 26);
    return tex(c, 2, 9);
  }
  function floorTex() {
    const [c, g] = cnv(256, 256);
    g.fillStyle = '#25180E'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32) {
      g.fillStyle = `rgba(${28 + Math.random() * 28},${18 + Math.random() * 18},10,.55)`;
      g.fillRect(0, y, 256, 30);
    }
    noise(g, 256, 256, 20);
    return tex(c, 2, 10);
  }
  function doorTex(no, plaque) {
    const [c, g] = cnv(512, 820);
    g.fillStyle = '#3F2312'; g.fillRect(0, 0, 512, 820);
    g.fillStyle = 'rgba(0,0,0,.30)';
    g.fillRect(44, 60, 424, 300); g.fillRect(44, 420, 424, 330);
    g.strokeStyle = 'rgba(255,220,160,.10)'; g.lineWidth = 3;
    g.strokeRect(44, 60, 424, 300); g.strokeRect(44, 420, 424, 330);
    /* the brass number */
    const grad = g.createLinearGradient(0, 100, 0, 172);
    grad.addColorStop(0, '#E8CE84'); grad.addColorStop(0.5, '#B08A2E'); grad.addColorStop(1, '#6E5418');
    g.fillStyle = grad; g.fillRect(150, 100, 212, 74);
    g.fillStyle = '#231A06';
    g.font = '600 50px Cinzel, Georgia, serif';
    g.textAlign = 'center';
    g.fillText(no, 256, 154);
    if (plaque) {
      g.fillStyle = grad; g.fillRect(116, 196, 280, 46);
      g.fillStyle = '#231A06';
      g.font = '500 22px Cinzel, Georgia, serif';
      g.fillText(plaque.toUpperCase(), 256, 227);
    }
    noise(g, 512, 820, 18);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex(), roughness: 0.95 });
  const L = new THREE.Mesh(new THREE.PlaneGeometry(11.0, CEIL), wallMat);
  L.position.set(-HALF, CEIL / 2, (END + 2.6) / 2); L.rotation.y = Math.PI / 2; L.receiveShadow = true;
  const R = L.clone(); R.position.x = HALF; R.rotation.y = -Math.PI / 2;
  scene.add(L, R);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, 11.0),
    new THREE.MeshStandardMaterial({ map: floorTex(), roughness: 0.96 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, (END + 2.6) / 2);
  floor.receiveShadow = true;
  scene.add(floor);

  const runner = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 10.8),
    new THREE.MeshStandardMaterial({ map: carpetTex(), roughness: 0.99 }));
  runner.rotation.x = -Math.PI / 2; runner.position.set(0, 0.006, (END + 2.6) / 2);
  runner.receiveShadow = true;
  scene.add(runner);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, 11.0),
    new THREE.MeshStandardMaterial({ color: 0x1A1509, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, CEIL, (END + 2.6) / 2);
  scene.add(ceil);

  const endWall = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, CEIL), wallMat);
  endWall.position.set(0, CEIL / 2, END);
  scene.add(endWall);

  /* --- the six doors --------------------------------------------------- */
  const PLACE = {
    '102b':         { side: -1, z: -0.55 },
    'map-room':     { side: 1,  z: -1.15 },
    'black-book':   { side: -1, z: -2.55 },
    'lantern-room': { side: 1,  z: -3.15 },
    'long-gallery': { side: -1, z: -4.55 },
    'rooftop-bar':  { side: 1,  z: -5.15 }
  };
  const DW = 1.02, DH = 2.12;
  const doorObjs = {};

  Hotel.DOORS.forEach((d) => {
    const p = PLACE[d.id];
    if (!p) return;
    const g = new THREE.Group();
    g.position.set(p.side * (HALF - 0.10), 0, p.z);
    /* canted toward the visitor: flat on the wall they are unreadable */
    g.rotation.y = (p.side > 0 ? -Math.PI / 2 : Math.PI / 2) + p.side * 0.46;
    scene.add(g);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(DW + 0.16, DH + 0.1, 0.09),
      new THREE.MeshStandardMaterial({ color: 0x2A1C0E, roughness: 0.85 }));
    frame.position.set(0, (DH + 0.1) / 2, -0.02);
    g.add(frame);

    const leaf = new THREE.Mesh(new THREE.BoxGeometry(DW, DH, 0.06),
      new THREE.MeshStandardMaterial({ map: doorTex(d.no, d.plaque), roughness: 0.62 }));
    leaf.position.set(0, DH / 2, 0.035);
    leaf.castShadow = true;
    g.add(leaf);

    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10),
      new THREE.MeshStandardMaterial({ color: 0xC9A227, roughness: 0.28, metalness: 0.85 }));
    handle.position.set(DW / 2 - 0.13, 1.06, 0.075);
    g.add(handle);

    const dl = new THREE.PointLight(0xFFD9A0, 5.5, 2.6, 1.5);
    dl.position.set(p.side * (HALF - 0.85), 1.72, p.z + 0.1);
    scene.add(dl);

    doorObjs[d.id] = {
      group: g, leaf,
      centre: new THREE.Vector3(p.side * (HALF - 0.22), DH * 0.54, p.z),
      w: DW, h: DH
    };
  });

  /* --- sconces of paper fire ------------------------------------------- */
  const sconceMat = [];
  [[-1, -1.85], [1, -1.85], [-1, -3.85], [1, -3.85], [-1, -5.85], [1, -5.85]].forEach(([side, z], i) => {
    const m = fire.makeFireMaterial(THREE, {
      aspect: 0.55, sheets: 5, base: 0.04, height: 1.0, licks: 1.2, taper: 1, embers: 0.4
    });
    m.uniforms.uTime.value = i * 13.7;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.84), m);
    plane.position.set(side * (HALF - 0.07), 2.26, z);
    plane.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    scene.add(plane);
    sconceMat.push(m);

    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.055, 0.13, 14),
      new THREE.MeshStandardMaterial({ color: 0xA8842E, roughness: 0.34, metalness: 0.7 }));
    cup.position.set(side * (HALF - 0.06), 1.84, z);
    scene.add(cup);

    if (i < 4) {
      const lt = new THREE.PointLight(0xFFAF5A, 15, 6.5, 1.45);
      lt.position.set(side * (HALF - 0.55), 2.24, z);
      scene.add(lt);
    }
  });

  scene.add(new THREE.AmbientLight(0x5E4A2E, 1.25));
  scene.add(new THREE.HemisphereLight(0xC9A878, 0x141008, 0.9));
  const front = new THREE.PointLight(0xE9CE7A, 16, 7, 1.4);
  front.position.set(0, 2.2, 2.0);
  scene.add(front);

  document.documentElement.classList.add('corridor-3d');

  const v = new THREE.Vector3();
  function place() {
    camera.updateMatrixWorld(true);
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    scene.updateMatrixWorld(true);
    doorEls.forEach((el) => {
      const o = doorObjs[el.dataset.door];
      if (!o) return;
      v.copy(o.centre).project(camera);
      const x = (v.x * 0.5 + 0.5) * 100;
      const y = (-v.y * 0.5 + 0.5) * 100;
      /* how big the door is on screen: project its top as well */
      const top = v.clone();
      const t2 = new THREE.Vector3(o.centre.x, o.centre.y + o.h / 2, o.centre.z).project(camera);
      const hpc = Math.abs((-t2.y * 0.5 + 0.5) - (-v.y * 0.5 + 0.5)) * 2 * 100;
      const li = el.parentNode;
      li.style.setProperty('--dx', x + '%');
      li.style.setProperty('--dy', y + '%');
      li.style.setProperty('--dh', hpc + '%');
      li.style.setProperty('--dw', (hpc * (o.w / o.h) * (stageEl.clientHeight / Math.max(1, stageEl.clientWidth))) + '%');
      li.style.opacity = v.z < 1 ? '1' : '0';
    });
  }

  let px = 0, py = 0;
  stageEl.addEventListener('pointermove', (e) => {
    const r = stageEl.getBoundingClientRect();
    px = ((e.clientX - r.left) / r.width) * 2 - 1;
    py = ((e.clientY - r.top) / r.height) * 2 - 1;
  }, { passive: true });
  stageEl.addEventListener('pointerleave', () => { px = 0; py = 0; });

  let cx = 0, cy = 0;
  corridor3d = stage.addView({
    el: stageEl,
    scene,
    camera,
    resize(w, h) {
      camera.aspect = w / Math.max(1, h);
      /* a portrait box needs a much wider lens or the near doors fall off
         either side of the frame */
      camera.fov = camera.aspect < 1.25 ? 78 : 56;
      camera.updateProjectionMatrix();
    },
    onFrame(dt, t) {
      const k = Hotel.stillFrame ? 1 : 1 - Math.pow(0.002, Math.max(0.001, dt));
      cx += (px * 0.30 - cx) * k;
      cy += (py * 0.16 - cy) * k;
      camera.position.set(cx * 0.45, 1.50 - cy * 0.3, 2.55);
      camera.lookAt(cx * 1.1, 1.30 - cy * 0.9, -1.8);
      for (const m of sconceMat) m.uniforms.uTime.value += dt;
      place();
    }
  });
  place();
}

/* ==================================================================== boot */

/* declared up here on purpose: Hotel.ready() runs its callback immediately
   when the hotel has already booted, which is before a `let` further down
   the module has been initialised */
let finaleRun = false;

Hotel.ready(() => {
  lightTheFires();
  setUpBell();
  setUpHunts();
  setUpNight();
  setUpAnimals();
  setUpCorridor();

  Hotel.on('key', () => { $$('.door').forEach(refreshDoor); });
  Hotel.on('door-open', () => { $$('.door').forEach(refreshDoor); });
  Hotel.on('reset', () => {
    try { sessionStorage.removeItem('ttt-rings'); } catch (e) {}
    $$('.door').forEach(refreshDoor);
    $$('.hunt').forEach((h) => h.classList.remove('is-done'));
    $('.reception') && $('.reception').classList.remove('is-done');
  });
  /* THE FINALE.  hotel.js shuts the passport and stamps the cover wherever
     you are standing; this is the home page's half of it: the paper over the
     far end of the corridor burns away, and the enquiry section gains a line
     and a way to start the whole thing again.  The form itself is untouched:
     it still posts nowhere and still says so. */
  Hotel.on('passport-full', () => { runFinale(true); });
  if (Hotel.state().stamps.length >= Hotel.DOORS.length) runFinale(false);

  /* The whole point of the enquiry form is still the enquiry form. */
  if (Hotel.hooks.shot) $$('.hunt').forEach((h) => { h.hidden = false; });
});

async function runFinale(fresh) {
  if (finaleRun) return;
  finaleRun = true;
  const panel = $('#finale');
  const note = $('#finaleNote');

  if (note) {
    note.hidden = false;
    if (fresh && !Hotel.stillFrame) note.classList.add('is-in');
    const reset = $('#finaleReset');
    if (reset && !reset.dataset.wired) {
      reset.dataset.wired = '1';
      reset.addEventListener('click', () => {
        Hotel.reset();
        Hotel.say('Reset. Every key, every door and every stamp gone. Ring the bell again.',
          { for: 12000 });
        window.setTimeout(() => { window.location.href = 'index.html'; }, 900);
      });
    }
  }
  if (!panel) return;
  panel.hidden = false;

  if (!fresh || Hotel.stillFrame) {
    panel.classList.add('is-open');
    return;
  }
  /* the paper over the end of the corridor goes, and what is behind shows */
  Hotel.say('Six of six. Something at the end of the corridor has just given way.',
    { for: 13000 });
  panel.classList.add('is-burning');
  panel.scrollIntoView({ block: 'center', behavior: 'smooth' });
  await new Promise((r) => setTimeout(r, 420));
  await Hotel.burn({ el: panel, paper: '#3A2A18', duration: 1500,
    origin: (() => { const r = panel.getBoundingClientRect();
      return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.42 }; })() });
  panel.classList.remove('is-burning');
  panel.classList.add('is-open');
}
