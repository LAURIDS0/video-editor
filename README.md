# Video Editor MVP

A browser-based video editor built with React + TypeScript + Vite and `ffmpeg.wasm`.

## Features in this version

- Video file upload
- Preview player
- Trim with start/end range
- Speed (0.5x to 2x)
- Volume + mute
- Grayscale filter
- Rotation (0°, 90°, 180°, 270°)
- Text overlay in preview
- Save/load project as JSON
- Export to MP4

## Getting started

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:5173`).

## Build

```bash
npm run build
```

## Notes

- Export runs in the browser via `ffmpeg.wasm`, so large files can be heavy.
- In this MVP, text overlay is preview-only (not burned into exported video).
