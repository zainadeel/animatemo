# AnimateMo

A super lightweight in-browser SVG animation editor. Drop in SVGs, set keyframes, scrub, loop, and export GSAP code.

Sibling to TokoMo, IcoMo, and CompoMo in the `ds-mo` family.

## Stack

- Vite + React + TypeScript
- GSAP (with MorphSVGPlugin and DrawSVGPlugin — both free as of GSAP 3.13)
- CSS Modules

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## Deploy

Push to `main`. The GitHub Actions workflow builds and deploys to GitHub Pages.

## How to use

1. The canvas opens with a sample starburst path that rotates.
2. Click **import file** or **paste svg** to add your own SVG (e.g. a starburst, a compass).
3. Click an element in the **layers** panel or the **canvas** to select it.
4. In the **inspector**, edit any property and press `+` to add a keyframe at the current playhead time. Or toggle **rec** to auto-keyframe on every change.
5. The **timeline** shows tracks for every animated property. Diamonds are keyframes. Click on the timeline strip to scrub. Right-click a keyframe to delete it.
6. Toggle **loop** and **yoyo** in the toolbar; set the **dur**ation in seconds.
7. Press **play** to preview. Press **export** to copy GSAP code to your clipboard.

## Path morphing

To morph one shape into another:

1. Import the source SVG, select the path you want to morph.
2. Move the playhead to the target time (e.g. 1s).
3. Open the second SVG in a text editor, copy its `<path d="...">` value.
4. Paste it into the inspector's `d` field.
5. Press `+` to record that as a keyframe.

The exported GSAP code uses `MorphSVGPlugin` automatically.
