# RŌNIN

**Steel shaped by centuries.**

A personal web design and development project by [Ben Brändle](https://braendle.tech): an interactive exploration of the form, craft and history of the Japanese sword. A single katana connects changing landscapes, expressive typography and moments of closer inspection.

## The experience

- **A continuous 3D journey.** Scroll from water and mountain silhouettes through unfolding paper, polished steel and woven details. The katana draws from its saya, turns and separates into its individual parts before returning to the landscape.
- **Typography with depth.** Lettering follows the sword, wraps around its details and shares the scene with glass text, reflections and moving light.
- **Interactive inspection.** Explore Sugata, Hamon, Tsuka, Tsuba and Saya. Adjust the lighting to reveal their surfaces; selecting the same detail again returns to the complete form.
- **Craft and history.** An interactive steel diagram, five historical periods and an illustrated glossary connect the object to its materials and cultural context.
- **Through the torii.** Scroll through a vermilion gate into a cherry blossom garden. Turn both models directly or send a breeze through the blossoms.

Portrait layouts include dedicated touch controls and a horizontal timeline. Keyboard interaction, reduced-motion compositions and readable HTML fallbacks accompany the 3D experience. A custom loading sequence waits for the models, fonts and first rendered frame; failed requests offer a retry or a preview fallback.

## Stack

Astro 7 · Tailwind CSS 4 · TypeScript · Three.js · GLSL · SVG

The site builds to static HTML, CSS, JavaScript and assets. One WebGL renderer handles the models, scenery and 3D typography. Models use Meshopt compression; fonts and assets are served locally. No API keys, database, server adapter or environment variables are required.

## Run locally

Use Node.js **24.18.0**, as pinned in `.node-version`, and npm.

```sh
npm ci
npm run dev
```

Open [http://127.0.0.1:4330](http://127.0.0.1:4330).

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run check` | Check Astro and TypeScript |
| `npm test` | Run geometry, motion, loading and interaction regression tests |
| `npm run build` | Generate the static site in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run check:dev` | Check the running development server's JavaScript module graph over HTTP |

The tests exercise the actual compressed models, camera bounds across viewport sizes, scroll transitions, touch gesture handling, reduced motion and loading states. They run in Node; visual appearance and performance on real devices need a separate browser check.

## Project structure

```text
public/
  fonts/             # Self-hosted webfont and font licenses
  models/            # Four optimized production GLB models
src/
  assets/typefaces/  # Prebuilt outlines for 3D lettering and licenses
  components/       # Reading sections, glossary, diagrams and loader
  data/             # Page content and source references
  pages/            # Document structure and metadata
  scripts/          # 3D scenes, scroll choreography and interactions
  styles/           # Typography, layouts and responsive adaptations
scripts/             # Development-server verification
tests/               # Regression tests
```

## Assets and credits

The katana assembly was refined in Blender. Torii, sakura and saya assets were prepared from Tripo models and optimized for the web. Water, mist, cloth, paper, petals and lighting are animated at runtime.

Only the four models used by the site are included: `ronin-katana-v04.glb`, `ronin-saya-v03.glb`, `ronin-torii-v01.glb` and `ronin-sakura-v01.glb`. The prebuilt font outlines are committed, so running or building the site does not require Blender, Tripo or private source files.

Anton and Instrument Serif are used under the SIL Open Font License. Their license notices are included alongside the font assets. Historical and cultural explanations link to their museum and institutional sources within the page.

RŌNIN is an independent portfolio experience. Its katana and landscape are artistic interpretations, not reproductions of a specific historical sword or shrine. There is no shop, account system, analytics or collection of visitor information.

Private references, source models, recordings, experiments, local tool state and generated build output are excluded from Git.

Design and development by **[Ben Brändle](https://braendle.tech)**.
