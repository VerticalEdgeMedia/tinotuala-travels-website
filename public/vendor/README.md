# vendor/

Third-party libraries, copied in as plain files so the site still has no build step and no npm.
Do not edit them. To upgrade, replace the file and change the version below.

| File | Library | Version | Licence |
|---|---|---|---|
| `three.module.min.js` | three.js, as one ES module | 0.170.0 (r170) | MIT, see `three.LICENSE.txt` |
| `gsap.min.js`, `ScrollTrigger.min.js`, `Draggable.min.js`, `Flip.min.js` | GSAP and three of its plugins | 3.13.0 | GreenSock standard no-charge licence, https://gsap.com/standard-license |

Load GSAP with ordinary `<script src>` tags (it defines `gsap`, `ScrollTrigger`, `Draggable`, `Flip`
as globals). Load three.js from a `<script type="module">` with `import * as THREE from './vendor/three.module.min.js'`.
r170 was chosen because it is the last release that ships as a single module file.
Source: jsdelivr's copy of the npm packages.
