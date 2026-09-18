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
| Assets | `public/img/` — 19 JPEGs, plus `public/img/_credits.json`, the machine-readable credit list. |
| Fonts | Google Fonts: **Fraunces** (display) and **DM Sans** (text), loaded by `<link>`. |
| Deploy | Cloudflare Workers static assets, `wrangler.jsonc`, serving `./public`. |
| Build step | **None.** No bundler, no framework, no npm, no `package.json`, no `node_modules`. |
| Preview | Open `public/index.html`, or serve `public/` on a local port, or `npx wrangler dev`. |

Keep it that way. If a change seems to need a build step, that is a signal to reconsider the
change. Raise it before building it.

`RESEARCH/` and `Temporary Screenshots/` are gitignored and never published.

---

## Design tokens

| Token | Value | Role |
|---|---|---|
| `--sand` / `--sand-2` / `--sand-3` | `#F7F1E6` / `#EFE3D0` / `#E4D6C0` | Warm paper. The offer and the contrast sections. |
| `--ink` / `--ink-2` | `#16120F` / `#241D17` | The Moments section, the footer. |
| `--sea` / `--sea-deep` | `#0C4B4E` / `#062F31` | Deep sea teal. How it works, the enquiry block. |
| `--pink` | `#E0417E` | Bougainvillea. Buttons, kickers, the "yours" column, placeholder chips. |
| `--saffron` | `#E9A227` | Step numerals, focus rings, links on dark. |
| `--paper` | `#F6EFE3` | Type on dark grounds. |

Type: Fraunces 800 for display lines and place names, Fraunces 600 for sub-heads, DM Sans for
everything else. Rhythm comes from `--gutter` (`clamp(20px, 5vw, 76px)`) and a `1280px` max width.

## Section order (home page)

1. Preview bar and sticky header
2. Hero: one full-bleed photograph, the offer in a sentence, one button to the enquiry form
3. The offer in three beats: designed around you / room to wander / the locals' version
4. Moments, not itineraries: a slow drifting film strip, then six places, each with a different
   treatment (full bleed with an overlapping inset, an offset pair, a horizontal scroll strip,
   two mosaics, a full bleed with a pair underneath)
5. No cattle sightseeing: a two-column contrast, kept kind
6. How it works: four steps
7. About Tino: two visibly marked placeholders
8. Enquiry form
9. Footer, with a link to `credits.html`

## Motion

Reveal on scroll via IntersectionObserver, a slow CSS marquee on the film strip, a small scale
on image hover. `prefers-reduced-motion: reduce` switches **every** animation and transition
off, stops the marquee and drops its duplicate track. `?shot=1` reveals everything immediately
so screenshots show the real layout, and the reveal degrades to "visible" if the observer never
fires or JavaScript never runs.

---

## Rules that are not negotiable

### Image licensing
Every image must carry a licence that permits reuse: Wikimedia Commons (CC0, public domain,
CC BY, CC BY-SA) or equivalently licensed sources. **Never** Unsplash+, Getty, Shutterstock,
Instagram, Pinterest, tourism-board, hotel or news photography, and never AI-generated imagery.

A CC BY or CC BY-SA image without a visible credit is a licence breach. So:

- every file in `public/img/` that the site uses has a row in `public/credits.html`
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
