SCENE SNAPSHOT VISUAL AUDIT

Manifest fingerprint: 9189c4ca23029b6ff533c658783357564daabdcd5f6b21a7963655e3941bdce5
Frames: 240
Automatic pass: 240
Needs review: 0
Failure: 0
Matrix errors: 0

This folder was created without launching or controlling a visible browser.
index.html and contact-sheets/*.svg reference the canonical PNGs in place; they do not contain duplicate screenshots.
report.json records deterministic machine checks for every frame.

AUTOMATED CHECKS
- PNG signature, decompression, dimensions, raster/CSS scale, and SHA-256 when supplied.
- Exact text-sidecar equality with the manifest text.
- Renderer-reported text overflow and bounds failures.
- Renderer-reported minimum visible font size when present.
- Edge-band activity as a conservative clipping-review heuristic.
- Blank, transparent, or very low-contrast image detection.

LIMITATIONS
- Edge activity is a review hint, not proof of clipping; intentional borders and controls can touch a pane edge.
- Pixel analysis cannot reliably identify semantic occlusion, misleading object placement, or whether a 3D action matches the written phase.
- No OCR is performed, so spelling and actual rendered glyph legibility must be checked in the contact sheets or canonical PNGs.
- Passing machine checks does not replace human review at the intended display size.

Run:
node scripts/audit-scene-visuals.mjs
Use --strict to make review flags return a failing exit code.
