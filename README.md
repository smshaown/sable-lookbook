# SABLE — Autumn / Winter 2026 Lookbook

An editorial fashion lookbook & e-commerce interactive experience built with **Semantic HTML5**, **Modern CSS3**, and **GSAP 3.12+**.

## Features
- **Infinite Circular 8-Look Rail**: Drag, trackpad swipe, keyboard arrows (`←` / `→`), or dot indicators with non-linear depth scaling.
- **Dynamic Ambient Palette**: Per-look `--tint` background cross-fade paired with a giant `Instrument Serif` masked wordmark (`CAMEL`, `CHARCOAL`, `RUST`, `TRENCH`, `IVORY`, `INDIGO`, `LEATHER`, `NOIR`).
- **Smooth GSAP Detail Drawer**: Desktop slide-over panel & mobile bottom sheet with `panelProgress` interpolation, garment breakdown, and accessible `radiogroup` size selectors.
- **Shopping Bag Drawer**: `localStorage`-persisted bag with live count badge, item removal, subtotal calculation, and toast feedback.
- **Accessible & Reduced-Motion Ready**: Full ARIA landmarks, `prefers-reduced-motion` support, and responsive mobile-first layout.

## Project Structure
```text
sable-lookbook/
├── index.html
├── styles/
│   ├── tokens.css
│   └── sable.css
├── js/
│   ├── looks-data.js
│   └── app.js
└── assets/
    └── looks/
```

## Run Locally
Serve the folder with any static HTTP server:
```bash
python -m http.server 8765
```
Then open `http://localhost:8765`.
