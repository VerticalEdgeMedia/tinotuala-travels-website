# CLAUDE.md — Tino Tuala Travels

A **mock-up** website for a travel consultancy: custom-designed holidays, built for immersion,
with room in the schedule to go by feel. It is a pitch, not a live business site.
`<meta name="robots" content="noindex">` stays on every page.

**This file is committed and may become public.** Keep it free of private detail: no local
folder paths, no contact details, no credentials, no client information.

---

## Stack — deliberately tiny

| | |
|---|---|
| Source | `public/index.html` (one long scrolling home page), `public/102b.html`, five room pages (`map-room`, `rooftop-bar`, `black-book`, `lantern-room`, `long-gallery`) and `public/credits.html`. Shared: `site.css` + `hotel.css`, `site.js` + `hotel.js`, and the ES modules `gl.js`, `fire.js`, `home.js`, `room102b.js`. |
| Assets | `public/img/` — 37 JPEGs (19 place photographs, 2 supplied photographs of Tino, 8 public-domain or freely licensed artworks, 8 public-domain reward pictures), `public/audio/` — four animal calls as mp3 and ogg, `public/vendor/` — three.js and GSAP as plain files, plus `public/img/_credits.json`, the machine-readable credit list for both. |
| Fonts | Google Fonts: **Cormorant Garamond** (display), **Cinzel** (letterspaced capitals) and **Jost** (text), loaded by `<link>`. |
| Deploy | Cloudflare Workers static assets, `wrangler.jsonc`, serving `./public`. |
| Build step | **None.** No bundler, no framework, no npm, no `package.json`, no `node_modules`. three.js and GSAP are vendored as plain files. |
| Preview | Open `public/index.html`, or serve `public/` on a local port, or `npx wrangler dev`. |

Keep it that way. If a change seems to need a build step, that is a signal to reconsider the
change. Raise it before building it.

`RESEARCH/` and `Temporary Screenshots/` are gitignored and never published.

---

## Design system - v2 "the green room"

A grand tropical hotel: you step into a dark green lacquered room. Near-black jungle greens,
antique gold, a deep teal band, and warm parchment panels that carry all the reading. The
photographs are the proof, hung in gold-lined temple niches; painted foliage and engraved
animals are worked into the edges rather than boxed off.

| Token | Value | Role |
|---|---|---|
| `--forest-900` / `--forest-800` / `--forest-700` | `#0A2219` / `#0F2D21` / `#15392A` | The room. Near-black forest through bottle green. |
| `--emerald` / `--moss` | `#1D5A3F` / `#2C4833` | Mottling in the grounds. |
| `--teal-900` / `--teal` | `#052B2B` / `#0A4A44` | The film-strip band, the how-it-works band, the hero ribbon. |
| `--gold-deep` / `--gold` / `--gold-lite` | `#8A6A24` / `#C9A227` / `#E9CE7A` | Rules, keylines, numerals, ornament. Never body copy. |
| `--ivory` / `--ivory-2` | `#F3ECDC` / `#E7DCC4` | Parchment. Every panel that has to be read. |
| `--ink` / `--ink-2` / `--ink-soft` | `#1A1611` / `#3B3427` / `#5C5240` | Type on parchment. |
| `--hibiscus` / `--lacquer` | `#C1356C` / `#A63329` | The small hits of quirk. Placeholder chips only. |

`--foil` is a seven-stop gold gradient. It fills the SVG ornaments (`fill="url(#foil)"`), the
buttons, and large display headings through `background-clip: text`. The text version is inside
an `@supports` guard so unsupported browsers keep a solid gold colour rather than invisible type.

### Type
**Cormorant Garamond** for display, set large and lightish. **Cinzel** for every label, kicker,
place name, button and caption, always uppercase and widely letterspaced (`.18em` to `.34em`).
**Jost** for body copy. Three families, no more. Body copy is never gold and never a display
face; gold is for large type and ornament only, where it clears contrast comfortably.

### Ornament
Everything ornamental is drawn by hand in the inline `<svg class="sprite">` at the top of each
page. Three symbols and two clip paths:

- `#orn-lotus` - a lotus medallion. The brand mark, the centre of every gold rule, and the
  surround for each step numeral.
- `#orn-corner` - a corner flourish, mirrored into all four corners of a panel with
  `transform: scale(-1)` and friends.
- `#orn-frond` - a gold fern frond, generated leaflet by leaflet, that leans over the hero arch.
- `#ogee` / `#dome` - `clipPathUnits="objectBoundingBox"` arches. `.niche-art img` is clipped by
  one of them and an overlaid `<svg preserveAspectRatio="none">` draws the arch outline twice in
  gold with `vector-effect: non-scaling-stroke`, so the keyline stays 1-2px at every size.
- `.frame-dome` is the cheaper version: the same arch as a `border-radius` pair, with the double
  gold keyline drawn by an inset `box-shadow` on `::after`.

### Artwork, and how it is blended
Public-domain and freely licensed paintings, wallpapers and natural-history plates, chosen so
each blend suits its ground:

- **On parchment**, light-ground plates use `mix-blend-mode: multiply` plus a soft radial
  `mask-image` so the paper's edges dissolve: the Audubon parrots on the offer panel, the Lear
  macaw on Tino's frame, the Barye tiger looking over the top of the No-cattle panel.
- **On the dark grounds**, the Blake monkey engraving is inverted and crushed to black, tinted
  gold with `sepia`/`saturate`/`hue-rotate`, then `mix-blend-mode: screen` drops the paper away
  and leaves gold line-work glowing. It hangs off the corner of the enquiry form.
- **Murals** are `<img>` elements behind a two-layer gradient veil: Rousseau's jungle behind the
  hero and the enquiry, his monkeys behind the "moments, not itineraries" band.
- **Patterns**: Morris's Blackthorn is a repeating band under the film strip; Willow Bough is
  tiled at low opacity, inverted and tinted gold, as the wall texture behind Moments and the
  footer.

Every one of them is credited in `credits.html` and `img/_credits.json` with artist, work, year
where the file states it, holding collection where the file states it, licence and source.

### Texture
No flat fills on large areas. An `feTurbulence` grain sits over the whole page
(`.grain`, fixed, `mix-blend-mode: overlay`), a coarser paper grain multiplies inside every
parchment panel, and the green grounds carry layered radial gradients plus a vignette.

## Section order (home page)

1. Preview bar and sticky header (frosted forest, gold hairline, lotus mark)
2. Hero: the jungle mural, the pitch on the left, the Maya Bay photograph in a pointed gold
   niche on the right, gold fronds leaning in
3. The offer in three beats, on a parchment panel with four corner flourishes and a lotus rule
4. The mural band: monkeys in the foliage behind "Nobody gets home and talks about the itinerary"
5. Moments: the drifting film strip on a teal band, a Morris pattern band under it, then the six
   places, each place name in letterspaced gold capitals, photographs in arched gold frames
6. No cattle sightseeing: a parchment panel with the tiger looking over its top edge
7. How it works: four steps on the teal band, numerals in lotus medallions
8. About Tino: parchment, his photo in a gold niche with a macaw perched on it
9. Enquiry: the mural again, the form on parchment, a monkey hanging off its corner
10. Footer, with a link to `credits.html`

## Motion

Reveal on scroll via IntersectionObserver; a slow parallax drift on the murals and fronds
(transform only, capped at 90px, rAF-throttled); a gold shimmer sweep across display headings as
they reveal; the film strip drifting, draggable and scrollable both ways. `?shot=1` adds a
`shot` class that reveals everything and freezes every animation and transition, and the reveal
degrades to "visible" if the observer never fires or JavaScript never runs.

**Horizontal scrollers.** `overflow-x: auto` makes `overflow-y` compute to `auto` as well, and a
few pixels of vertical overflow then swallow the page's scroll when the pointer is over the
strip. Every sideways-scrolling container therefore carries `overflow-y: hidden` and
`overscroll-behavior-x: contain`, the script-driven film strip keeps `touch-action: pan-y`, and
the strip's `wheel` handler only calls `preventDefault()` when the horizontal delta is the
larger one.

## Phones

Designed at 390px first. Ornaments scale down or drop (`.frond` is hidden below 860px), the
niche arch changes ratio rather than growing tall, the two-column vignettes and the contrast
rows stack, corner flourishes shrink to 42px, the perched plates shrink, and the tiger's aside
moves out of the corner into the flow. Nothing may scroll the page sideways at any width.

---

## Rules that are not negotiable

### Image licensing
Every image must carry a licence that permits reuse: Wikimedia Commons (CC0, public domain,
CC BY, CC BY-SA) or equivalently licensed sources. **Never** Unsplash+, Getty, Shutterstock,
Instagram, Pinterest, tourism-board, hotel or news photography, and never AI-generated imagery.

A CC BY or CC BY-SA image without a visible credit is a licence breach. So:

- every file in `public/img/` that the live pages use has a row in `public/credits.html`
- the same data lives in `public/img/_credits.json`
- the counts must match; check them after any image change.

### No invented claims
Nothing is known about the business beyond the brief. **Never** write testimonials, reviews,
client names, trip or client or country counts, years in business, awards, accreditations
(ATAS, IATA, AFTA and the like), partner or airline or hotel logos, prices, deposit terms,
response times, guarantees, or biographical facts. No "as seen in". No star ratings.

Photographs name a place, never a client, and the site says plainly that they are stand-ins and
not photographs of the owner's trips.

Anything not yet known gets a **visibly marked placeholder chip**, not a plausible-looking
invention. Contact details are placeholders until the owner supplies real ones.

### Copy
Draft copy for the owner to correct. Australian spelling. Short, vivid, a little cheeky.
No em-dashes anywhere in site copy. No travel clichés: no "hidden gems", "bucket list",
"wanderlust", "paradise awaits", "curated", "unforgettable memories".

### The form
It is a mock-up. The enquiry form posts nowhere: submit is prevented and an inline note says so.
Do not wire it to an endpoint without being asked.

---

## Accessibility and quality bar

- Semantic landmarks, exactly one `<h1>` (the hero), real descriptive `alt` on every image.
- Visible `:focus-visible` styling on everything interactive; a label on every form field.
- Text over photography always sits on a scrim or gradient.
- `width`/`height` attributes on every image; ratio boxes stop layout shift.
- `loading="lazy"` on everything below the hero.
- Design the 390px layout deliberately, then check 820 and desktop.
- **Headless Chrome clamps its window to 500px wide**, so `--window-size=390,…` silently
  renders at 500 and crops. For a true 390px render, load the page in a 390px-wide `<iframe>`
  inside a 500px window and screenshot that.
- A screenshot proves rendering, not motion. Motion and feel need a human's eyes.

---

## Git

- **Claude never pushes.** `git push`, `gh`, `git remote` and deploys are done by hand.
  Claude may edit, `git add`, `git commit`, and read log/status/diff. Nothing else.
- Commit format: `[area] type: short description`, for example `[moments] feat: …`,
  `[copy] fix: …`, `[a11y] fix: …`. One change per commit.
- Check `git status --short` before committing: nothing from `RESEARCH/` or
  `Temporary Screenshots/` belongs in a commit.

### Photographs zoom inside their frames and lean toward the pointer

The **holder clips, the picture moves.** `.frame` has `overflow: hidden`; on the arched niches the
`clip-path` sits on `.niche-art`, never on the `<img>` (a clip on the image grows with the image,
which is how v2's first pass let photos spill past the gold line). On hover the picture zooms IN to
`scale(1.2)` and `setupTilt()` in `site.js` tips it up to 5 degrees toward whichever corner the
pointer is in, with a 1.4% slide. 1.2 is deliberately more than that lean can uncover: measured at
the most extreme corner, every photo still overhangs its frame by 17px or more on all four sides.
If the tilt angle or slide ever grows, re-measure before shipping. Mouse only; off under reduced
motion and `?shot=1`.

---

## Design system - v3 "the hotel with keys"

v2's green room, explored. You ring the bell at the front desk, you are handed a key, and the
rest of the page turns out to have five more hidden in it. They open six doors in a corridor
upstairs. Room 102B, the lost property room, is the one that is fully built.

### The four tools, and the no-build rule

| Job | Tool |
|---|---|
| 3D: the corridor, Room 102B | **three.js** r170, one ES module in `vendor/` |
| Effects: the paper fire, the burn-away | **GLSL** fragment shaders on flat quads |
| Motion and scroll choreography | **GSAP** 3.13 + ScrollTrigger (+ Draggable, Flip, available) |
| Textures, grain, procedural art | **Canvas 2D**, handed to three.js as `CanvasTexture` |

No build step, no npm, no CDN, no other libraries. three.js is imported inside
`<script type="module">`; GSAP is a plain `<script src>` global. Google Fonts stays a `<link>`.

### Files

| File | What it is |
|---|---|
| `public/hotel.js` | **plain script, global `Hotel`. On every page, first.** State, tray, passport, concierge, sound, the room key gate, the test hooks. |
| `public/hotel.css` | Everything shared: the canvas, the tray, the passport, the concierge, bubbles, room chrome, the lighter version's fire and burn, and Room 102B's stage pattern. |
| `public/gl.js` | ES module. **The one WebGL renderer for the page**, drawing many scissored views. Knows nothing about the hotel. |
| `public/fire.js` | ES module. The paper fire shader and the burn-away shader. |
| `public/home.js` | ES module. The home page only: the bell, the hunts, the corridor, the grade. |
| `public/room102b.js` | ES module. Room 102B's scene. |
| `public/site.js`, `public/site.css` | v2's behaviour and look, unchanged plus a v3 section at the foot of the stylesheet. |

### `Hotel` - the API part B builds on

```js
Hotel.ready(fn)                 // fn runs once the hotel has booted
Hotel.on(event, fn)             // returns an unsubscribe function
Hotel.mode()                    // 'full' | 'lite'
Hotel.stillFrame                // true under ?shot=1 or prefers-reduced-motion
Hotel.state()                   // a copy; never mutate it

Hotel.has(keyId)                // 'k-102b' etc
Hotel.giveKey(keyId, {from: el})// flies the key from `el` into the tray
Hotel.canOpen(doorId)
Hotel.isOpen(doorId)
Hotel.openDoor(doorId)
Hotel.stamp(doorId)             // one stamp per door; fires 'passport-full' at six
Hotel.door(doorId)              // the record: {id, no, name, plaque, page, key, stamp}

Hotel.addFound(id)              // put something in the passport collection
Hotel.dropFound(id)             // take it out again (the monkey takes the hat)
Hotel.carrying(id)

Hotel.checkIn()                 // marks it, opens the audio, starts the ambience
Hotel.reset()

Hotel.say(text, {for: ms, sticky: bool})   // the concierge card
Hotel.announce(text)                        // the aria-live region
Hotel.openPassport() / closePassport()

Hotel.sound.play(name)          // 'ding' 'jingle' 'clunk' 'creak' 'thump' 'rustle' 'crackle'
Hotel.sound.callNow(id)         // force an animal call: 'monkey' 'elephant' 'bigcat' 'bird'
Hotel.sound.isOn() / set(on) / gain()
Hotel.stage()                   // Promise -> the gl.js stage, or null
Hotel.fire(el, opts)            // Promise -> a fire handle, or a CSS/SVG stand-in
Hotel.burn(opts)                // Promise -> resolves when the paper has gone
Hotel.setNight(0..1)
Hotel.gateRoom(doorId, opts)    // the whole of a room page's front door
```

**Events:** `ready`, `check-in`, `key`, `door-open`, `door-refused`, `stamp`, `found`,
`passport-full`, `animal`, `mode`, `sound`, `reset`.

### Storage

`localStorage['ttt-hotel-v3']`

```json
{ "checkedIn": true, "keys": ["k-311"], "doors": {"102b": "open"},
  "stamps": ["102b"], "found": ["postcard"], "sound": true, "mode": "full" }
```

Every read and write is wrapped in try/catch: with storage blocked the hotel still works, it
just forgets. **A URL carrying any test hook never writes storage.** The bell's ring count is
kept separately in `sessionStorage['ttt-rings']`.

### The paper fire

`Hotel.fire(el, opts)` fills an element. `fire.js` exports `makeFireMaterial(THREE, opts)` for a
plane inside somebody else's 3D scene, which is how the corridor sconces are lit.

| Uniform | Option | What it does |
|---|---|---|
| `uSheets` | `sheets` | 5 to 7 stacked cut sheets |
| `uSpread` | `spread` | 0 to 1, how wide each flame stands in its cell |
| `uBase` | `base` | 0 to 1, where the foot of the flame sits in the box |
| `uHeight` | `height` | 0 to 1, how far up the box the tips reach |
| `uCount` | `count` | flames across: 1 for a torch, 6 for a fire pit |
| `uFloor` | `floor` | 0, or a band of paper along the foot that ties a row together |
| `uEmbers` | `embers` | 0 to 1, the little cut-paper flecks |
| `uNight` | `night` | 0 afternoon, 1 night: richer and warmer |
| `uIntensity`, `uOpacity` | | master |

Each sheet is a flat graded band from deep lacquer red through vermilion, orange and saffron to a
pale cream core, cut into a flame with a torn edge, leaning on its own cant, moving at its own
speed, and dropping a **soft warm shadow on the sheet behind it**. That shadow is the thing that
makes the paper read as thick, so do not take it out. The sheets slide by different amounts with
the pointer and the scroll, and part where the pointer is. The fibre is a Canvas 2D texture.
**Never a glow blob, never a particle spark, never realistic fire.**

Lighter version: the same sculpture as six stacked SVG paths with a CSS `drop-shadow`, swaying.

### The burn-away

`Hotel.burn({ el, origin: {x, y}, duration, paper: '#hex', freeze })`

A sheet of paper the colour of whatever is burning covers the element (or the viewport) and is
eaten from `origin` outward by an irregular front: black char at the cut, warming to brown, a hot
orange line inside it and a few embers hanging just past it. Alpha goes to zero behind the front,
so what is behind shows through.

It runs twice on the way into a room, and that is deliberate:

1. On the home page the door's own brown paper burns off the door, revealing a warm glow, then
   the page navigates.
2. On arrival, `gateRoom` burns a full-viewport sheet off from where the lock was, revealing
   the room.

`?burn=0.5` holds either one still at that progress.

### Day turns to night

One custom property, `--night`, on `<html>`, driven by scroll: afternoon down the top quarter,
dusk through the middle, night by the enquiry form. It only ever darkens the **grounds** (the
`.night-veil` layers over the murals, the teal bands, the fire-pit glow), never the parchment
panels or the type, so contrast goes **up** as the page gets later. The paper fire warms with it.
ScrollTrigger scrubs it and a plain scroll listener backs it up, because ScrollTrigger measures
the page once and this page is mostly photographs.

### Sound

- UI noises are synthesised in `hotel.js`: bell, key jingle, lock clunk, door creak, stamp thump,
  paper rustle, a fire crackle.
- The four animal calls are real Wikimedia Commons recordings in `public/audio/`, credited.
- The echoes are added live so no two calls are the same: a feedback delay of 280 to 620 ms with
  0.35 to 0.55 feedback through a low-pass, a convolution reverb whose impulse is generated as
  decaying filtered noise, a playback rate of 0.82 to 1.0, a stereo pan left or right, and a
  far-away level.
- One call roughly every 15 seconds (12 to 20, randomised), rotating so none repeats back to back.

**Rules, all enforced in code:** nothing sounds before the visitor has acted; the ambience starts
only at check-in; an AudioContext is only ever created or resumed inside a user gesture;
there is a sound switch on the tray and another in the passport; muted means master gain 0;
the ambience stops when the tab is hidden; on by default after check-in.
When a call plays, `Hotel` fires `animal` and the matching drawing reacts.

### The corridor, and where the keys are

| Key | Door | Where it is | Keyboard route |
|---|---|---|---|
| 311 | The Lantern Room | the bell, first ring | the bell is a `<button>` |
| 102B | Room 102B | the bell, third ring | the same button |
| 118 | The Map Room | under the tiger's paw. The first tug startles it, the second frees the key | `#huntTiger` is a `<button>` |
| 901 | The Rooftop Bar | the macaw, poked three times | `#huntMacaw` is a `<button>` |
| 214 | Tino's Black Book | inside the jar of sand in 102B; shake it | the jar's button, then "Give it a shake" |
| 402 | The Long Gallery | the monkey, in exchange for the tiny hat out of 102B | `#huntMonkey` is a `<button>` |

A luggage label hangs in the painted leaves behind the enquiry form and only shows once
`--night` is past 0.68. It is a collection reward, not a key.

**To open a door:** drag a key from the tray onto it, or click a key then click a door, or focus
a door and press Enter (it uses the key you are holding, or the right one if you hold it).
**Wrong key or no key:** the Do Not Disturb sign flips and rattles, the handle jiggles, somebody
says something through it, and the key goes back in the tray. Nothing is lost by getting it wrong.

Every door is a real `<a href="…">` in a real `<ul>`. In full mode the three.js corridor is drawn
behind them and each anchor is moved over its door every frame; the brass number stays HTML,
because a number baked into a door at a corridor's angle is never legible.

### Room 102B - the fixed spec

Do not change the architecture and do not add furniture.

- A **small** room with a **triangular floor plan**: the doorway is one side, two walls run back
  from either edge of it and meet at a corner directly opposite. You look into a corner.
- **One wall: a mattress tilted up on its side, leaning against it.** Ticking stripes, piping, a
  sag, a stain, a label.
- **The other wall: the lost property**, on shelves.
- A bare bulb. A worn floor. Corridor carpet behind you through the door. **No windows.**

The triangle is deliberately wide and shallow: any deeper and both walls go nearly edge-on from
the doorway and neither of them reads.

The twelve things on the shelves, each modelled in code, each with a luggage tag that swings
round with one line on it:

| Object | Does |
|---|---|
| a single flip-flop, left foot | |
| a snorkel, bitten through | |
| a straw hat, ribbon faded | |
| a paperback, swollen with seawater | |
| a ukulele, three strings | |
| a Polaroid camera, taped shut | |
| an inflatable flamingo, going down | |
| a child's bucket, one handle | |
| **a jar of sand** | shake it: **key 214** falls out |
| **a tiny straw hat** | take it: the monkey on the home page swaps it for **key 402** |
| **a postcard, never posted** | keep it: goes in the passport |
| **a poster, rolled in a tube** | keep it: goes in the passport |

The same room exists as a flat SVG drawing plus the same twelve buttons, with every tag line in
the HTML. That is what the lighter version, a browser with no WebGL, and a screen reader get, and
with JavaScript off entirely it is still a readable list of things and their stories.

### Test hooks

Shipped, harmless, and **none of them writes storage**.

`?shot=1` reveal everything, freeze, render one frame · `?lite=1` / `?full=1` ·
`?checkin=1` · `?keys=all` or `?keys=102b,118` · `?open=102b` · `?burn=0.5` ·
`?night=1` · `?passport=1` · `?mute=1`.
Room 102B also takes `?look=left|right` and `?pick=<object id>` for screenshots.

### The lighter version

Picked when: no WebGL, `prefers-reduced-motion`, `navigator.connection.saveData`, or a
small/coarse-pointer device with four cores or less or 4 GB of memory or less. `effectiveType` is
a bonus hint only: **Safari and iPhones report no connection information at all**, so nothing may
depend on it. A remembered choice from the passport's switch beats all of it, so nobody is
locked out either way. The switch is in the passport, and it reloads the page, because the two
versions are built differently and pretending to swap them live would be a lie.

Lite gets: CSS and SVG paper fire, a flat corridor of six doors, the flat drawing of 102B, and
every key, every door and every reward still reachable.

### Performance rules

- **One WebGL renderer per page.** Everything registers a view with `gl.js`. Never a canvas per
  effect; browsers cap live contexts and you will lose the first one you made.
- `devicePixelRatio` capped at 2, or 1.5 on a coarse pointer.
- The loop stops when the tab is hidden and when no view is on screen, and wakes on scroll.
- Dispose geometries and materials you create; `view.remove()` only unregisters the view.
- No image over about 350 KB, no file over 24 MB (`find public -type f -size +24M`).

---

## For part B - how to build a room page

Five rooms are scaffolded and wired: `map-room.html` (118), `rooftop-bar.html` (901),
`black-book.html` (214), `lantern-room.html` (311), `long-gallery.html` (402). Each one already
has its key placed on the home page and its door in the corridor, so the way in works today.
Replace the contents of `<main id="roomMain">` and leave everything else alone.

**The skeleton.** Copy `map-room.html`. It is:

```html
<link rel="stylesheet" href="site.css">
<link rel="stylesheet" href="hotel.css">
<script>document.documentElement.classList.add('js');
  if(/[?&]shot=1\b/.test(location.search))document.documentElement.classList.add('shot');</script>
…
<main id="roomMain">
  <section class="room above-gl"> … your room … </section>
</main>
…
<script src="hotel.js"></script>
<script src="vendor/gsap.min.js"></script>
<script>Hotel.ready(function () { Hotel.gateRoom('map-room'); });</script>
<!-- TEMP:versions … -->
```

1. **`hotel.js` goes on every page, before anything else**, as a plain `<script>`.
2. **`Hotel.gateRoom('<door id>')` is the whole front door.** With the key (or the door already
   open) it opens the door, stamps the passport, and burns the paper off the doorway. Without it,
   it replaces `#roomMain` with the locked door, rattles the handle when you try it, and offers a
   way back to the corridor. It returns `true` when you are in, so:
   `if (!Hotel.gateRoom('map-room')) return;`
   Options: `{ mount, originX, originY, duration, onOpen }`. `originX`/`originY` are where the
   lock was, as a fraction of the viewport, so the burn starts in the right place.
3. **The passport stamps itself.** Do not call `Hotel.stamp` again.
4. **3D:** `const stage = await Hotel.stage();` gives the one renderer, or `null`. Register a
   view with `stage.addView({el, scene, camera, onFrame, resize})` where `el` is the box in the
   page you want drawn into. `room102b.js` is the worked example, including how the accessible
   buttons are moved over the 3D objects each frame.
   If you need shadows, set `stage.renderer.shadowMap.enabled = true` yourself.
5. **Fire:** `Hotel.fire(el, {sheets, spread, base, height, count, floor, embers})`, or
   `makeFireMaterial(THREE, opts)` from `fire.js` for a plane inside your own scene.
6. **Burn:** `await Hotel.burn({el, origin, paper})` for a transition of your own.
7. **Rewards:** `Hotel.addFound('<id>')`. Add the entry to the `FINDS` table in `hotel.js` first,
   with its picture, size and alt text, then credit the picture on `credits.html` and in
   `img/_credits.json`. The counts on the credits page have to keep matching.
8. **Keys:** if a room hides a key, `Hotel.giveKey('k-nnn', {from: someElement})`.
9. **The finale:** `Hotel.on('passport-full', fn)` fires when the sixth stamp lands. Nothing is
   wired to it yet; that is yours.
10. **Every page must:** keep `noindex`, keep the preview bar, keep exactly one `<h1>`, copy the
    `<!-- TEMP:versions … -->` block **byte for byte** with v3 marked `aria-current`, keep its
    own fixed UI clear of the bottom-right corner (the dock) and the bottom-left (the tray), give
    every interactive thing a real name, work at 390px, and work in lite mode with everything
    still completable.
11. **Copy rules are legal, not stylistic.** Room flavour and tag stories are plainly fiction in
    the hotel's voice. Nothing invented is ever presented as Tino's, as a real guest, or as a
    fact about the business. Black Book and Rooftop Bar content are marked drafts for Tino to
    correct. Australian spelling, no em-dashes, no travel cliches.

**Never name the television show, the network or any hotel brand**, in copy, alt text, comments,
commit messages or file names. The look is described in its own terms: a grand tropical hotel,
cut-paper fire, a jungle mural.

## Versions — test-site scaffolding

While the site lives on its workers.dev address, earlier builds stay browsable so they can be
compared. `public/versions/` holds one folder per locked version plus a list page, and every
page carries a small dock (v1, v2, Versions) in its bottom corner.

- **v1** is locked at `public/versions/2026-09-18-v1-editorial/` (18 Sep 2026) and **v2** at
  `public/versions/2026-09-19-v2-green-room/` (19 Sep 2026). The front page is the working version, currently
  **v3**, which started as a copy of v2.
- **To lock a version, use the script**, not hands: `lock_version.py` in the site-setup master
  folder's version-lock kit. It reads everything first, then writes; it rewrites `img/` and `video/`
  paths to the site root in the frozen HTML, CSS `url()`s **and JS strings**, adds the version to every
  dock, live and frozen, and to `versions/index.html`.
- A frozen folder holds its own copy of the pages, `site.css` and `site.js`. **Media is
  shared:** frozen pages point at `/img/` and `/video/` from the site root, so the repo does not
  carry the same photos and loops once per version. **Never delete or overwrite a media file a
  frozen version still uses.** Add new files under new names instead.
- To lock the next version: copy the current pages, stylesheet and script into a new dated
  folder, rewrite `img/` and `video/` references to start with `/`, add the version to the dock
  in every page (live and frozen) and to `versions/index.html`, and mark the right one
  `aria-current`.
- The dock is self-contained between `<!-- TEMP:versions … -->` and `<!-- /TEMP:versions -->` at
  the end of index.html and credits.html. Nothing in `site.css` or `site.js` refers to it.
- **Before a real domain goes live:** delete `public/versions/` and remove every TEMP:versions
  block. `grep -rn "TEMP:versions" public/` must return nothing.
