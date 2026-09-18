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
| Source | `public/index.html` (one long scrolling home page) and `public/credits.html`, sharing `public/site.css` and `public/site.js`. |
| Assets | `public/img/` — 29 JPEGs (19 place photographs, 2 supplied photographs of Tino, 8 public-domain or freely licensed artworks), plus `public/img/_credits.json`, the machine-readable credit list. |
| Fonts | Google Fonts: **Cormorant Garamond** (display), **Cinzel** (letterspaced capitals) and **Jost** (text), loaded by `<link>`. |
| Deploy | Cloudflare Workers static assets, `wrangler.jsonc`, serving `./public`. |
| Build step | **None.** No bundler, no framework, no npm, no `package.json`, no `node_modules`. |
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
| `--forest-900` / `--forest-800` / `--forest-700` | `#071310` / `#0B1C16` / `#10261D` | The room. Near-black forest through bottle green. |
| `--emerald` / `--moss` | `#163F2E` / `#2C4833` | Mottling in the grounds. |
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

## Versions — test-site scaffolding

While the site lives on its workers.dev address, earlier builds stay browsable so they can be
compared. `public/versions/` holds one folder per locked version plus a list page, and every
page carries a small dock (v1, v2, Versions) in its bottom corner.

- **v1** is locked at `public/versions/2026-09-18-v1-editorial/` (18 Sep 2026). The front page is the working
  version, currently **v2**, which started as a copy of v1.
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
