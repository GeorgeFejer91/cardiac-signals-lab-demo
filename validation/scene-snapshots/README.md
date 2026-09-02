# Scene snapshot baseline

This directory contains the frozen, reviewable visual record of every scripted scene in the two experimental game previews. Each version is a complete research artifact rather than a loose screenshot collection.

## Version 1 matrix

Version `v1` contains exactly 240 scene states:

- `desktop` and `phone` viewports;
- six Used Car Salesman Game trials and four Number-Card Game trials;
- `aligned` and `conflicting` payoff modes;
- six steps per trial.

The total is `2 × ((6 + 4) × 2 × 6) = 240`. The fixed display condition is a live cardiac cue shown during both decision stages, with automatic advance disabled. Cue-source or cue-window variants are not silently mixed into this baseline.

## Canonical files

The version directory contains exactly one manifest, 240 PNGs, and 240 plain-text sidecars. No contact sheets, crops, per-frame JSON, exploratory images, or other files belong in `v1`.

```text
v1/manifest.json
v1/{viewport}/{game}_{mode}_trial{TT}_step{SS}.png
v1/text/{viewport}/{game}_{mode}_trial{TT}_step{SS}.txt
```

Examples:

```text
v1/desktop/used-car_aligned_trial01_step01.png
v1/text/desktop/used-car_aligned_trial01_step01.txt
v1/phone/number-card_conflicting_trial04_step06.png
v1/text/phone/number-card_conflicting_trial04_step06.txt
```

All manifest paths are normalized relative paths beneath `validation/scene-snapshots`. Absolute paths, parent traversal, aliases that disagree with the canonical identity, duplicate paths, missing files, and extra files are validation failures.

Every text sidecar is a deterministic six-line rendering of the corresponding manifest record:

```text
sceneStatus: ...
thought: ...
captionTitle: ...
explanation: ...
timing: ...
cueBadge: ...
```

The validator compares the complete content after normalizing CRLF to LF; merely having six non-empty labels is not sufficient.

## Hidden background renderer

Generate the complete raw matrix with:

```bash
npm run qa:screenshots:render -- --force
```

The renderer builds and serves the production site on a private loopback port, launches its own headless Edge/Chromium process with a temporary browser profile, and communicates with that process through the Chrome DevTools Protocol. It does not open or control the user's browser, use a signed-in browser profile, dispatch operating-system pointer input, or move the user's pointer. UI state is changed with DOM events inside the isolated page.

Both viewports use a device scale factor of 2.5. Before each capture, the renderer verifies fonts and 3D canvas readiness, removes focus artifacts, suppresses scrollbars in the private page, and waits for at least 90 active `requestAnimationFrame` cycles and at least 1,000 measured milliseconds. It captures the exact `.minimal-scene-pane` element beyond the viewport when necessary. This produces a consistent high-resolution pane rather than a browser-window screenshot or stitched mobile crop.

Raw output is written to:

```text
tmp/qa/readability-full-matrix/headless-renderer/
```

Its explicit `render-manifest.json` records the CSS clip, device scale factor, actual PNG dimensions, PNG SHA-256, fixed cue state, all six text fields, layout/overflow checks, isolated-browser protocol, and a full fingerprint of the application code, styles, face assets, car models, build configuration, package manifest, and dependency lockfile that can affect rendering.

For a fast protocol check that remains separate from the baseline:

```bash
npm run qa:screenshots:render -- --smoke --output-root tmp/qa/headless-renderer-smoke --force
```

Smoke mode renders five representative states per viewport. CI runs this isolated renderer after building the site and uploads its output for inspection.

Before an expensive PNG regeneration, audit the complete 240-state matrix in the same isolated renderer with:

```bash
npm run qa:screenshots:preflight -- --force
```

Preflight uses the same production build, private headless browser, fixed cue state, active-render settling, DOM checks, and 3D scene checks as the renderer. It visits every state, collects all failures instead of stopping at the first one, captures no PNGs, and exits nonzero when any state fails. Its deterministically ordered report is written atomically to `tmp/qa/readability-full-matrix/headless-renderer-preflight/preflight-report.json`. A different child of `tmp/qa` can be selected with `--output-root`; preflight output is deliberately separate from both raw renders and the canonical baseline.

## Assemble and validate

After a complete 240-state render, assemble the frozen version:

```bash
npm run qa:screenshots:assemble -- --force
```

The assembler consumes only the explicit headless render manifest, checks the complete matrix and provenance, stages the entire artifact, and replaces an existing version only after its safety checks pass.

Validate the committed baseline with:

```bash
npm run qa:screenshots:validate
```

Generate the background-only visual review index with:

```bash
npm run qa:screenshots:audit -- --strict
```

This performs a second pass over every PNG, its readability metadata, edge margins, hash, dimensions, and text sidecar. It writes `report.json`, a local `index.html`, and lightweight SVG sequence sheets to `validation/scene-snapshot-audit/v1`. The sheets reference the canonical PNGs rather than duplicating them, and the audit folder stays outside the sealed `v1` artifact set.

To inspect a future version without changing the default:

```bash
npm run qa:screenshots:validate -- --version v2
```

Validation requires all of the following:

- exactly 240 canonical manifest records, PNGs, and text sidecars, with no extra artifacts;
- complete and mutually consistent viewport, game, mode, trial, step, filename, path, and optional alias identities;
- `cueSource=live`, `cueWindow=both`, and `autoAdvance=false` in every state;
- the exact `.minimal-scene-pane` capture target and isolated-headless protocol;
- uniform DPR 2.5, at least 90 active render frames, and at least 1,000 measured settling milliseconds;
- ready fonts/assets, cleared focus, suppressed scrollbars, DOM-only interaction, a private profile, no visible browser, and no operating-system pointer input;
- empty bounds-failure and text-overflow arrays for every scene;
- valid PNG signature, IHDR and terminal IEND chunks, dimensions matching the recorded CSS clip and DPR, and an exact SHA-256 match;
- exact equality between each text sidecar and the manifest's six text fields;
- a current full render-source fingerprint covering every local input used by the visual scene.

The GitHub Actions workflow lints and builds the application, validates and audits this committed 240-state baseline, runs the independent hidden-renderer smoke test, and uploads the baseline, smoke output, and visual-review index. The committed baseline remains human-reviewable; intentional visual changes require a new complete render and explicit baseline update.

The PNG baseline is stored with Git LFS. The repository declares the LFS rule in `.gitattributes`, and CI checks out LFS objects before validation so a fresh clone audits the actual images rather than pointer files.
