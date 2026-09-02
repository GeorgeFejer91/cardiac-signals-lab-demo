#!/usr/bin/env node

/**
 * Background-only visual audit for the frozen scene snapshot matrix.
 *
 * This script never launches or controls a browser. It reads the committed PNGs,
 * their text sidecars, and the capture metadata, then emits a deterministic audit
 * report plus lightweight HTML/SVG indexes in a sibling audit tree. The indexes
 * reference (rather than copy) the canonical screenshots, so the sealed v1 tree
 * remains free of validator-visible extras.
 */

import { createHash } from 'node:crypto';
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_MANIFEST = path.join(
  PROJECT_ROOT,
  'validation',
  'scene-snapshots',
  'v1',
  'manifest.json',
);
const DEFAULT_AUDIT_OUTPUT = path.join(
  PROJECT_ROOT,
  'validation',
  'scene-snapshot-audit',
  'v1',
);
const EXPECTED_FRAME_COUNT = 240;
const MAX_ACTION_BUTTON_SYMMETRY_TOLERANCE = 0.002;
const TEXT_FIELDS = [
  'sceneStatus',
  'thought',
  'captionTitle',
  'explanation',
  'timing',
  'cueBadge',
];
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function parseArguments(argv) {
  const options = {
    manifest: DEFAULT_MANIFEST,
    output: null,
    allowPartial: false,
    strict: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--manifest') {
      options.manifest = path.resolve(argv[index + 1] || '');
      index += 1;
    } else if (argument === '--output') {
      options.output = path.resolve(argv[index + 1] || '');
      index += 1;
    } else if (argument === '--allow-partial') {
      options.allowPartial = true;
    } else if (argument === '--strict') {
      options.strict = true;
    } else if (argument === '--help' || argument === '-h') {
      console.log([
        'Usage: node scripts/audit-scene-visuals.mjs [options]',
        '',
        'Options:',
        '  --manifest PATH   Canonical v1 manifest (default: validation/scene-snapshots/v1/manifest.json)',
        '  --output PATH     Audit output directory (default: validation/scene-snapshot-audit/v1)',
        '  --allow-partial   Permit a render smoke manifest with fewer than 240 frames',
        '  --strict          Treat heuristic/manual-review flags as failures',
        '  --help            Show this help',
      ].join('\n'));
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!options.output) {
    options.output = path.resolve(options.manifest) === path.resolve(DEFAULT_MANIFEST)
      ? DEFAULT_AUDIT_OUTPUT
      : `${path.dirname(options.manifest)}-audit`;
  }
  return options;
}

function slash(value) {
  return value.split(path.sep).join('/');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeXml(value) {
  return escapeHtml(value);
}

function normalizeText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

function expectedTextSidecar(text) {
  return TEXT_FIELDS.map((field) => `${field}: ${text[field]}`).join('\n');
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function resolveFrameAsset(manifestPath, relativePath, snapshotVersion) {
  if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)) {
    throw new Error(`Unsafe or empty asset path: ${relativePath ?? '(missing)'}`);
  }
  const normalized = relativePath.replaceAll('\\', '/');
  if (normalized.split('/').some((segment) => segment === '..')) {
    throw new Error(`Parent traversal is not permitted in asset paths: ${relativePath}`);
  }

  const manifestDirectory = path.dirname(manifestPath);
  const familyRoot = path.dirname(manifestDirectory);
  const candidates = [path.resolve(manifestDirectory, ...normalized.split('/'))];
  if (snapshotVersion && normalized.startsWith(`${snapshotVersion}/`)) {
    candidates.unshift(path.resolve(familyRoot, ...normalized.split('/')));
  }

  for (const candidate of candidates) {
    try {
      const resolved = await realpath(candidate);
      const safeRoots = [manifestDirectory, familyRoot].map((root) => path.resolve(root));
      if (!safeRoots.some((root) => isWithin(root, resolved))) {
        throw new Error(`Resolved asset leaves the snapshot family: ${relativePath}`);
      }
      const details = await stat(resolved);
      if (details.isFile()) return resolved;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  throw new Error(`Asset does not exist: ${relativePath}`);
}

function readUInt32(buffer, offset) {
  return buffer.readUInt32BE(offset);
}

function paethPredictor(left, above, upperLeft) {
  const predictor = left + above - upperLeft;
  const leftDistance = Math.abs(predictor - left);
  const aboveDistance = Math.abs(predictor - above);
  const upperLeftDistance = Math.abs(predictor - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  if (aboveDistance <= upperLeftDistance) return above;
  return upperLeft;
}

function parsePng(buffer) {
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Invalid PNG signature.');
  }

  let offset = 8;
  let ihdr = null;
  let palette = null;
  let transparency = null;
  const idat = [];
  while (offset + 12 <= buffer.length) {
    const length = readUInt32(buffer, offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > buffer.length) throw new Error(`Truncated PNG chunk ${type}.`);
    const data = buffer.subarray(start, end);
    if (type === 'IHDR') {
      ihdr = {
        width: readUInt32(data, 0),
        height: readUInt32(data, 4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      };
    } else if (type === 'PLTE') {
      palette = data;
    } else if (type === 'tRNS') {
      transparency = data;
    } else if (type === 'IDAT') {
      idat.push(data);
    }
    offset = end + 4;
    if (type === 'IEND') break;
  }

  if (!ihdr || idat.length === 0) throw new Error('PNG lacks IHDR or IDAT data.');
  if (ihdr.width <= 0 || ihdr.height <= 0) throw new Error('PNG has invalid dimensions.');
  if (ihdr.bitDepth !== 8 || ihdr.interlace !== 0 || ihdr.compression !== 0 || ihdr.filter !== 0) {
    throw new Error('Audit supports non-interlaced 8-bit PNG captures only.');
  }

  const channelsByType = new Map([[0, 1], [2, 3], [3, 1], [4, 2], [6, 4]]);
  const channels = channelsByType.get(ihdr.colorType);
  if (!channels) throw new Error(`Unsupported PNG color type ${ihdr.colorType}.`);
  if (ihdr.colorType === 3 && !palette) throw new Error('Indexed PNG lacks a palette.');

  const rowBytes = ihdr.width * channels;
  const inflated = inflateSync(Buffer.concat(idat));
  const expectedLength = (rowBytes + 1) * ihdr.height;
  if (inflated.length !== expectedLength) {
    throw new Error(`Unexpected PNG payload length ${inflated.length}; expected ${expectedLength}.`);
  }

  const pixels = Buffer.allocUnsafe(rowBytes * ihdr.height);
  const previous = Buffer.alloc(rowBytes);
  const current = Buffer.alloc(rowBytes);
  let sourceOffset = 0;
  for (let y = 0; y < ihdr.height; y += 1) {
    const filterType = inflated[sourceOffset];
    sourceOffset += 1;
    for (let x = 0; x < rowBytes; x += 1) {
      const raw = inflated[sourceOffset + x];
      const left = x >= channels ? current[x - channels] : 0;
      const above = previous[x];
      const upperLeft = x >= channels ? previous[x - channels] : 0;
      let value;
      if (filterType === 0) value = raw;
      else if (filterType === 1) value = raw + left;
      else if (filterType === 2) value = raw + above;
      else if (filterType === 3) value = raw + Math.floor((left + above) / 2);
      else if (filterType === 4) value = raw + paethPredictor(left, above, upperLeft);
      else throw new Error(`Unsupported PNG filter type ${filterType}.`);
      current[x] = value & 0xff;
    }
    current.copy(pixels, y * rowBytes);
    current.copy(previous);
    sourceOffset += rowBytes;
  }

  function rgbaAt(x, y) {
    const pixelOffset = y * rowBytes + x * channels;
    if (ihdr.colorType === 0) {
      const gray = pixels[pixelOffset];
      return [gray, gray, gray, 255];
    }
    if (ihdr.colorType === 2) {
      return [pixels[pixelOffset], pixels[pixelOffset + 1], pixels[pixelOffset + 2], 255];
    }
    if (ihdr.colorType === 3) {
      const index = pixels[pixelOffset];
      return [
        palette[index * 3] ?? 0,
        palette[index * 3 + 1] ?? 0,
        palette[index * 3 + 2] ?? 0,
        transparency?.[index] ?? 255,
      ];
    }
    if (ihdr.colorType === 4) {
      const gray = pixels[pixelOffset];
      return [gray, gray, gray, pixels[pixelOffset + 1]];
    }
    return [
      pixels[pixelOffset],
      pixels[pixelOffset + 1],
      pixels[pixelOffset + 2],
      pixels[pixelOffset + 3],
    ];
  }

  return { ...ihdr, rgbaAt };
}

function meanColor(png, xStart, yStart, xEnd, yEnd, stride) {
  let red = 0;
  let green = 0;
  let blue = 0;
  let alpha = 0;
  let count = 0;
  for (let y = yStart; y < yEnd; y += stride) {
    for (let x = xStart; x < xEnd; x += stride) {
      const rgba = png.rgbaAt(x, y);
      red += rgba[0];
      green += rgba[1];
      blue += rgba[2];
      alpha += rgba[3];
      count += 1;
    }
  }
  if (count === 0) return [0, 0, 0, 0];
  return [red / count, green / count, blue / count, alpha / count];
}

function colorDistance(first, second) {
  const red = first[0] - second[0];
  const green = first[1] - second[1];
  const blue = first[2] - second[2];
  return Math.sqrt(red * red + green * green + blue * blue);
}

function longestRun(values) {
  let longest = 0;
  let current = 0;
  for (const value of values) {
    if (value) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

function rounded(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function analyzePng(png) {
  const { width, height } = png;
  const stride = Math.max(1, Math.floor(Math.min(width, height) / 700));
  const cornerWidth = Math.max(8, Math.round(width * 0.025));
  const cornerHeight = Math.max(8, Math.round(height * 0.025));
  const inset = Math.max(3, Math.round(Math.min(width, height) * 0.003));
  const band = Math.max(10, Math.round(Math.min(width, height) * 0.012));
  const corners = [
    meanColor(png, inset, inset, cornerWidth, cornerHeight, stride),
    meanColor(png, width - cornerWidth, inset, width - inset, cornerHeight, stride),
    meanColor(png, inset, height - cornerHeight, cornerWidth, height - inset, stride),
    meanColor(png, width - cornerWidth, height - cornerHeight, width - inset, height - inset, stride),
  ];

  let sampled = 0;
  let transparent = 0;
  let luminanceTotal = 0;
  let luminanceSquared = 0;
  let luminanceMin = 255;
  let luminanceMax = 0;
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const rgba = png.rgbaAt(x, y);
      const luminance = rgba[0] * 0.2126 + rgba[1] * 0.7152 + rgba[2] * 0.0722;
      sampled += 1;
      if (rgba[3] < 16) transparent += 1;
      luminanceTotal += luminance;
      luminanceSquared += luminance * luminance;
      luminanceMin = Math.min(luminanceMin, luminance);
      luminanceMax = Math.max(luminanceMax, luminance);
    }
  }
  const luminanceMean = luminanceTotal / sampled;
  const luminanceVariance = Math.max(0, luminanceSquared / sampled - luminanceMean * luminanceMean);

  function isForeground(x, y) {
    const rgba = png.rgbaAt(x, y);
    if (rgba[3] < 32) return false;
    return Math.min(...corners.map((corner) => colorDistance(rgba, corner))) >= 52;
  }

  function horizontalEdge(yStart, yEnd) {
    const activeColumns = [];
    let active = 0;
    let total = 0;
    for (let x = inset; x < width - inset; x += stride) {
      let columnActive = 0;
      let columnTotal = 0;
      for (let y = yStart; y < yEnd; y += stride) {
        const foreground = isForeground(x, y);
        if (foreground) active += 1;
        total += 1;
        columnActive += foreground ? 1 : 0;
        columnTotal += 1;
      }
      activeColumns.push(columnTotal > 0 && columnActive / columnTotal >= 0.35);
    }
    return {
      activeFraction: total ? active / total : 0,
      longestRunFraction: activeColumns.length ? longestRun(activeColumns) / activeColumns.length : 0,
    };
  }

  function verticalEdge(xStart, xEnd) {
    const activeRows = [];
    let active = 0;
    let total = 0;
    for (let y = inset; y < height - inset; y += stride) {
      let rowActive = 0;
      let rowTotal = 0;
      for (let x = xStart; x < xEnd; x += stride) {
        const foreground = isForeground(x, y);
        if (foreground) active += 1;
        total += 1;
        rowActive += foreground ? 1 : 0;
        rowTotal += 1;
      }
      activeRows.push(rowTotal > 0 && rowActive / rowTotal >= 0.35);
    }
    return {
      activeFraction: total ? active / total : 0,
      longestRunFraction: activeRows.length ? longestRun(activeRows) / activeRows.length : 0,
    };
  }

  const edges = {
    top: horizontalEdge(inset, Math.min(height, inset + band)),
    right: verticalEdge(Math.max(0, width - inset - band), width - inset),
    bottom: horizontalEdge(Math.max(0, height - inset - band), height - inset),
    left: verticalEdge(inset, Math.min(width, inset + band)),
  };
  for (const edge of Object.values(edges)) {
    edge.activeFraction = rounded(edge.activeFraction);
    edge.longestRunFraction = rounded(edge.longestRunFraction);
  }

  const reviewEdges = Object.entries(edges)
    .filter(([, edge]) => (
      edge.activeFraction >= 0.42
      || (edge.activeFraction >= 0.24 && edge.longestRunFraction >= 0.5)
    ))
    .map(([name]) => name);

  return {
    stride,
    sampledPixels: sampled,
    transparentFraction: rounded(transparent / sampled),
    luminance: {
      mean: rounded(luminanceMean, 2),
      standardDeviation: rounded(Math.sqrt(luminanceVariance), 2),
      range: rounded(luminanceMax - luminanceMin, 2),
    },
    edgeBandRasterPixels: band,
    edgeActivity: edges,
    clippingReviewEdges: reviewEdges,
  };
}

function frameIdentity(frame) {
  return `${frame.viewport}/${frame.game}/${frame.mode}/trial-${String(frame.trial).padStart(2, '0')}/step-${String(frame.step).padStart(2, '0')}`;
}

function compareFrames(first, second) {
  const viewportOrder = { desktop: 0, phone: 1 };
  const gameOrder = { 'used-car': 0, 'number-card': 1 };
  const modeOrder = { aligned: 0, conflicting: 1 };
  return (viewportOrder[first.viewport] ?? 9) - (viewportOrder[second.viewport] ?? 9)
    || (gameOrder[first.game] ?? 9) - (gameOrder[second.game] ?? 9)
    || (modeOrder[first.mode] ?? 9) - (modeOrder[second.mode] ?? 9)
    || Number(first.trial) - Number(second.trial)
    || Number(first.step) - Number(second.step);
}

function validateMatrix(frames, allowPartial) {
  const failures = [];
  if (!allowPartial && frames.length !== EXPECTED_FRAME_COUNT) {
    failures.push(`Expected ${EXPECTED_FRAME_COUNT} frames, found ${frames.length}.`);
  }
  const seen = new Set();
  for (const frame of frames) {
    const identity = frameIdentity(frame);
    if (seen.has(identity)) failures.push(`Duplicate frame identity: ${identity}.`);
    seen.add(identity);
  }
  if (!allowPartial) {
    for (const viewport of ['desktop', 'phone']) {
      for (const [game, trials] of [['used-car', 6], ['number-card', 4]]) {
        for (const mode of ['aligned', 'conflicting']) {
          for (let trial = 1; trial <= trials; trial += 1) {
            for (let step = 1; step <= 6; step += 1) {
              const identity = `${viewport}/${game}/${mode}/trial-${String(trial).padStart(2, '0')}/step-${String(step).padStart(2, '0')}`;
              if (!seen.has(identity)) failures.push(`Missing frame identity: ${identity}.`);
            }
          }
        }
      }
    }
  }
  return failures;
}

function dimensionChecks(frame, png) {
  const failures = [];
  const warnings = [];
  const recorded = frame.captureDimensions || {};
  if (Number(recorded.rasterWidth) !== png.width || Number(recorded.rasterHeight) !== png.height) {
    failures.push(`PNG is ${png.width}x${png.height}, metadata records ${recorded.rasterWidth ?? '?'}x${recorded.rasterHeight ?? '?'}.`);
  }
  if (Number(recorded.deviceScaleFactor) !== 2.5) {
    failures.push(`Device scale factor is ${recorded.deviceScaleFactor ?? 'missing'}, expected 2.5.`);
  }
  if (frame.viewport === 'desktop') {
    if (png.width < 2400 || png.height < 2000) failures.push(`Desktop raster ${png.width}x${png.height} is below 2400x2000.`);
    if (Number(recorded.cssWidth) < 1000) failures.push(`Desktop pane width ${recorded.cssWidth ?? 'missing'} CSS px is below 1000.`);
  } else if (frame.viewport === 'phone') {
    if (png.width < 850 || png.height < 2200) failures.push(`Phone raster ${png.width}x${png.height} is below 850x2200.`);
    if (Number(recorded.cssWidth) < 350) failures.push(`Phone pane width ${recorded.cssWidth ?? 'missing'} CSS px is below 350.`);
  } else {
    failures.push(`Unknown viewport ${frame.viewport}.`);
  }
  if (recorded.cssWidth && Math.abs(png.width / Number(recorded.cssWidth) - 2.5) > 0.02) {
    warnings.push('Raster/CSS width ratio differs from 2.5 by more than 0.02.');
  }
  if (recorded.cssHeight && Math.abs(png.height / Number(recorded.cssHeight) - 2.5) > 0.02) {
    warnings.push('Raster/CSS height ratio differs from 2.5 by more than 0.02.');
  }
  return { failures, warnings };
}

function actionButtonSymmetryFailures(sceneQa, expectedScenario) {
  const failures = [];
  const symmetry = sceneQa.actionButtonSymmetry;
  const tolerance = Number(symmetry?.tolerance);
  const expectedPairs = expectedScenario === 'cars'
    ? [
        { participant: 'far', buttonIds: ['seller-recommend-buy', 'seller-recommend-pass'] },
        { participant: 'near', buttonIds: ['buyer-buy', 'buyer-pass'] },
      ]
    : [
        { participant: 'far', buttonIds: ['informed-a', 'informed-b'] },
        { participant: 'near', buttonIds: ['less-informed-a', 'less-informed-b'] },
      ];
  if (
    !Array.isArray(sceneQa.buttonContainment)
    || sceneQa.buttonContainment.length !== 4
    || !symmetry
    || symmetry.coordinateSpace !== 'world'
    || !Number.isFinite(tolerance)
    || tolerance <= 0
    || tolerance > MAX_ACTION_BUTTON_SYMMETRY_TOLERANCE
    || symmetry.passes !== true
    || !Array.isArray(symmetry.pairs)
    || symmetry.pairs.length !== 2
  ) return ['Complete passing action-button symmetry evidence is missing.'];
  const buttons = new Map(sceneQa.buttonContainment.map((button) => [button?.id, button]));
  if (buttons.size !== 4 || expectedPairs.flatMap(({ buttonIds }) => buttonIds).some((id) => !buttons.has(id))) {
    return ['Action-button symmetry evidence does not cover the canonical four controls.'];
  }
  const close = (first, second) => Number.isFinite(first) && Number.isFinite(second)
    && Math.abs(first - second) <= tolerance;
  const pairErrorFields = [
    'mirroredXError', 'matchedZRowError', 'matchedScaleError',
    'matchedFootprintWidthError', 'matchedFootprintDepthError',
  ];
  let pairsValid = true;
  for (let index = 0; index < expectedPairs.length; index += 1) {
    const pair = symmetry.pairs[index];
    const expected = expectedPairs[index];
    let pairValid = pair?.participant === expected.participant
      && JSON.stringify(pair?.buttonIds) === JSON.stringify(expected.buttonIds)
      && pair?.passes === true;
    for (const [pointName, id] of [['first', expected.buttonIds[0]], ['second', expected.buttonIds[1]]]) {
      const point = pair?.[pointName];
      const button = buttons.get(id);
      pairValid = pairValid
        && ['x', 'z', 'effectiveScale'].every((field) => Number.isFinite(point?.[field]))
        && ['width', 'depth'].every((field) => Number.isFinite(point?.effectiveFootprint?.[field]))
        && ['x', 'z', 'effectiveScale'].every((field) => close(
          point?.[field], field === 'effectiveScale' ? button?.effectiveScale : button?.position?.[field],
        ))
        && ['width', 'depth'].every((field) => close(point?.effectiveFootprint?.[field], button?.effectiveFootprint?.[field]));
    }
    if (pairValid) {
      const calculatedErrors = [
        Math.abs(pair.first.x + pair.second.x),
        Math.abs(pair.first.z - pair.second.z),
        Math.abs(pair.first.effectiveScale - pair.second.effectiveScale),
        Math.abs(pair.first.effectiveFootprint.width - pair.second.effectiveFootprint.width),
        Math.abs(pair.first.effectiveFootprint.depth - pair.second.effectiveFootprint.depth),
      ];
      pairValid = calculatedErrors.every((error) => error <= tolerance)
        && pairErrorFields.every((field, errorIndex) => (
          Number.isFinite(pair[field]) && pair[field] <= tolerance && close(pair[field], calculatedErrors[errorIndex])
        ));
    }
    if (!pairValid) {
      pairsValid = false;
      failures.push(`${expected.participant} action buttons are not mirrored with matched row, scale, and footprint.`);
    }
  }
  if (!pairsValid) return failures;
  const [far, near] = symmetry.pairs;
  const between = symmetry.betweenParticipants;
  const betweenFields = [
    'spanXError', 'matchedCenterXError', 'mirroredZError', 'matchedScaleError',
    'matchedFootprintWidthError', 'matchedFootprintDepthError',
  ];
  const calculatedBetweenErrors = [
    Math.abs(Math.abs(far.first.x - far.second.x) - Math.abs(near.first.x - near.second.x)),
    Math.abs(((far.first.x + far.second.x) / 2) - ((near.first.x + near.second.x) / 2)),
    Math.abs(far.first.z + near.first.z),
    Math.abs(far.first.effectiveScale - near.first.effectiveScale),
    Math.abs(far.first.effectiveFootprint.width - near.first.effectiveFootprint.width),
    Math.abs(far.first.effectiveFootprint.depth - near.first.effectiveFootprint.depth),
  ];
  if (
    !between
    || JSON.stringify(between.pairIds) !== JSON.stringify(['far', 'near'])
    || between.passes !== true
    || !calculatedBetweenErrors.every((error) => error <= tolerance)
    || !betweenFields.every((field, errorIndex) => (
      Number.isFinite(between[field]) && between[field] <= tolerance && close(between[field], calculatedBetweenErrors[errorIndex])
    ))
  ) failures.push('Far/near action-button pair geometry is not equivalent.');
  return failures;
}

function metadataChecks(frame) {
  const failures = [];
  const warnings = [];
  if (frame.auditPass !== true) failures.push('Renderer auditPass is not true.');
  if (frame.captureTarget !== '.minimal-scene-pane') failures.push('Capture target is not .minimal-scene-pane.');
  if (frame.cueSource !== 'live' || frame.cueWindow !== 'both' || frame.autoAdvance !== false) {
    failures.push('Capture state is not live/both/autoAdvance=false.');
  }
  const protocol = frame.captureProtocol || frame.sourceCaptureProtocol || {};
  if (protocol.renderer !== 'isolated-headless-edge-cdp') failures.push('Frame is not attributed to the isolated headless Edge renderer.');
  if (protocol.domEventsOnly !== true) failures.push('Frame protocol does not guarantee DOM-only interaction.');
  if (protocol.operatingSystemPointerUsed !== false) failures.push('Frame protocol does not guarantee that the OS pointer was unused.');
  if (protocol.visibleBrowserUsed !== false) failures.push('Frame protocol does not guarantee that no visible browser was used.');
  if (protocol.focusSuppressed !== true || protocol.activeElementBlurred !== true) {
    failures.push('Focus suppression/blur metadata is incomplete.');
  }
  if (protocol.activeRenderSettled !== true || Number(protocol.settleMs) < 1000 || Number(protocol.settleFrames) < 90) {
    failures.push('Frame lacks at least 1000 ms and 90 active render frames of settling evidence.');
  }
  const layout = frame.layout || {};
  if (Array.isArray(layout.boundsFailures) && layout.boundsFailures.length > 0) {
    failures.push(`${layout.boundsFailures.length} renderer bounds failure(s).`);
  }
  if (Array.isArray(layout.textOverflow) && layout.textOverflow.length > 0) {
    failures.push(`${layout.textOverflow.length} renderer text overflow failure(s).`);
  }
  if (!Array.isArray(layout.boundsFailures)) warnings.push('Renderer did not provide boundsFailures metadata.');
  if (!Array.isArray(layout.textOverflow)) warnings.push('Renderer did not provide textOverflow metadata.');

  const minFont = Number(layout.minVisibleFontPx);
  if (Number.isFinite(minFont)) {
    if (minFont < 6) failures.push(`Smallest visible text is ${minFont}px, below the 6px hard floor.`);
    else if (minFont < 10) warnings.push(`Smallest visible text is ${minFont}px; inspect it at intended display size.`);
  } else {
    warnings.push('No minimum visible font-size metadata; direct legibility remains a manual check.');
  }
  if (Array.isArray(layout.textMetrics)) {
    const clipped = layout.textMetrics.filter((metric) => metric.overflow === true || metric.inBounds === false);
    if (clipped.length > 0) failures.push(`${clipped.length} text metric(s) report clipping or out-of-bounds placement.`);
  }
  if (!Array.isArray(layout.sceneQaFailures)) {
    failures.push('Renderer did not provide sceneQaFailures metadata.');
  } else if (layout.sceneQaFailures.length > 0) {
    failures.push(`${layout.sceneQaFailures.length} deterministic 3D scene QA failure(s).`);
  }
  const sceneQa = layout.sceneQa;
  if (!sceneQa || sceneQa.schema !== 'cardiac-scene-qa' || sceneQa.schemaVersion !== 1 || sceneQa.ready !== true) {
    failures.push('Ready cardiac-scene-qa v1 evidence is missing.');
  } else {
    if (!Array.isArray(sceneQa.violations) || sceneQa.violations.length > 0) {
      failures.push(`${Array.isArray(sceneQa.violations) ? sceneQa.violations.length : 'Unknown number of'} 3D scene violation(s).`);
    }
    if (!Array.isArray(sceneQa.buttonContainment) || sceneQa.buttonContainment.length !== 4) {
      failures.push('Four-button tabletop containment evidence is incomplete.');
    } else {
      const outside = sceneQa.buttonContainment.filter((button) => (
        button?.contained !== true
        || !Number.isFinite(button.minimumMarginWorld)
        || (Number.isFinite(sceneQa.table?.requiredMargin) && button.minimumMarginWorld + 0.001 < sceneQa.table.requiredMargin)
      ));
      if (outside.length > 0) failures.push(`${outside.length} action button(s) are outside the safe tabletop margin.`);
    }
    failures.push(...actionButtonSymmetryFailures(sceneQa, frame.game === 'used-car' ? 'cars' : 'numbers'));
    const clippedPanels = Array.isArray(sceneQa.projected?.panels)
      ? sceneQa.projected.panels.filter((panel) => panel?.insideCanvas !== true)
      : null;
    if (clippedPanels === null) failures.push('Projected 3D panel bounds are missing.');
    else if (clippedPanels.length > 0) failures.push(`${clippedPanels.length} 3D panel(s) are clipped by the canvas.`);
    const unsafePanels = Array.isArray(sceneQa.projected?.panels)
      ? sceneQa.projected.panels.filter((panel) => (
        !Number.isFinite(panel?.requiredCanvasMarginPx)
        || panel.requiredCanvasMarginPx < 12
        || !panel.canvasMargins
        || !['left', 'top', 'right', 'bottom'].every((field) => (
          Number.isFinite(panel.canvasMargins[field])
          && panel.canvasMargins[field] + 0.001 >= panel.requiredCanvasMarginPx
        ))
      ))
      : null;
    if (unsafePanels && unsafePanels.length > 0) failures.push(`${unsafePanels.length} 3D panel(s) lack the required canvas safety margin.`);
    const panelOverlap = Array.isArray(sceneQa.panelAvatarSeparations)
      ? sceneQa.panelAvatarSeparations.filter((separation) => separation?.passes !== true)
      : null;
    if (panelOverlap === null) failures.push('Panel/avatar separation evidence is missing.');
    else if (panelOverlap.length > 0) failures.push(`${panelOverlap.length} 3D panel/avatar overlap(s) exceed the allowed threshold.`);
    const panelPairOverlap = Array.isArray(sceneQa.panelPairSeparations)
      ? sceneQa.panelPairSeparations.filter((separation) => (
        separation?.passes !== true
        || !Number.isFinite(separation?.overlapRatio)
        || !Number.isFinite(separation?.maximumOverlapRatio)
        || separation.maximumOverlapRatio > 0.001
        || separation.overlapRatio > separation.maximumOverlapRatio
      ))
      : null;
    if (panelPairOverlap === null) failures.push('Panel/panel separation evidence is missing.');
    else if (panelPairOverlap.length > 0) failures.push(`${panelPairOverlap.length} 3D panel/panel overlap(s) exceed the allowed threshold.`);
    const bubbleOverlap = Array.isArray(sceneQa.bubbleSeparations)
      ? sceneQa.bubbleSeparations.filter((separation) => separation?.passes !== true)
      : null;
    if (bubbleOverlap === null || sceneQa.bubbleSeparations.length === 0) failures.push('Bubble/scene separation evidence is missing.');
    else if (bubbleOverlap.length > 0) failures.push(`${bubbleOverlap.length} thought-bubble/scene overlap(s) exceed the allowed threshold.`);
  }
  return { failures, warnings, minVisibleFontPx: Number.isFinite(minFont) ? minFont : null };
}

function statusFor(failures, warnings) {
  if (failures.length > 0) return 'fail';
  if (warnings.length > 0) return 'review';
  return 'pass';
}

function groupKey(frame) {
  return `${frame.viewport}_${frame.game}_${frame.mode}_trial${String(frame.trial).padStart(2, '0')}`;
}

function groupLabel(frame) {
  const viewport = frame.viewport === 'phone' ? 'Phone' : 'Desktop';
  const game = frame.game === 'used-car' ? 'Used Car Salesman Game' : 'Number-card Deception Game';
  const mode = frame.mode === 'aligned' ? 'Aligned incentives' : 'Conflicting incentives';
  return `${viewport} · ${game} · ${mode} · Trial ${frame.trial}`;
}

function createContactSheet(group, outputDirectory) {
  const sample = group[0];
  const phone = sample.viewport === 'phone';
  const columns = 3;
  const rows = 2;
  const cellWidth = phone ? 430 : 520;
  const cellHeight = phone ? 690 : 500;
  const imageWidth = phone ? 390 : 490;
  const imageHeight = phone ? 610 : 420;
  const width = columns * cellWidth;
  const height = rows * cellHeight + 44;
  const sheetDirectory = path.join(outputDirectory, 'contact-sheets');
  const cards = group.map((entry, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * cellWidth;
    const y = 44 + row * cellHeight;
    const relativeImage = entry.screenshotAbsolute
      ? slash(path.relative(sheetDirectory, entry.screenshotAbsolute))
      : null;
    const warningMark = entry.status === 'pass' ? '' : ` · ${entry.status.toUpperCase()}`;
    const statusColor = entry.status === 'fail' ? '#ff8e76' : entry.status === 'review' ? '#f3bb72' : '#80f1e7';
    return [
      `<g transform="translate(${x} ${y})">`,
      `<rect x="10" y="10" width="${cellWidth - 20}" height="${cellHeight - 20}" fill="#10131a" stroke="#30343d"/>`,
      `<text x="20" y="35" fill="${statusColor}" font-family="system-ui, sans-serif" font-size="16" font-weight="700">Step ${entry.step}${escapeXml(warningMark)}</text>`,
      relativeImage
        ? `<image href="${escapeXml(relativeImage)}" x="${(cellWidth - imageWidth) / 2}" y="50" width="${imageWidth}" height="${imageHeight}" preserveAspectRatio="xMidYMid meet"/>`
        : `<text x="20" y="80" fill="#ff8e76" font-family="system-ui, sans-serif" font-size="16">Screenshot unavailable</text>`,
      '</g>',
    ].join('');
  }).join('');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<rect width="100%" height="100%" fill="#080a10"/>',
    `<text x="16" y="29" fill="#f5f3ec" font-family="system-ui, sans-serif" font-size="18" font-weight="700">${escapeXml(groupLabel(sample))}</text>`,
    cards,
    '</svg>',
    '',
  ].join('\n');
}

function createHtml(report, groups) {
  const summaryRows = [
    ['Frames', report.summary.frames],
    ['Automatic pass', report.summary.pass],
    ['Needs review', report.summary.review],
    ['Failure', report.summary.fail],
    ['Matrix errors', report.summary.matrixFailures],
    ['Contact sheets', groups.length],
  ].map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('');

  const groupMarkup = groups.map(({ key, entries, sheetPath }) => {
    const first = entries[0];
    const statusCounts = entries.reduce((counts, entry) => {
      counts[entry.status] += 1;
      return counts;
    }, { pass: 0, review: 0, fail: 0 });
    const frames = entries.map((entry) => {
      const imagePath = entry.screenshotAbsolute
        ? slash(path.relative(path.dirname(report.outputIndexAbsolute), entry.screenshotAbsolute))
        : null;
      const flags = [...entry.failures, ...entry.warnings];
      const flagMarkup = flags.length
        ? `<ul>${flags.map((flag) => `<li>${escapeHtml(flag)}</li>`).join('')}</ul>`
        : '<p class="quiet">No automated flags.</p>';
      return [
        `<article class="frame ${entry.status}" id="${escapeHtml(entry.identity)}">`,
        `<div class="frame-title"><span>Step ${entry.step}</span><b>${escapeHtml(entry.status)}</b></div>`,
        imagePath
          ? `<a href="${escapeHtml(imagePath)}"><img loading="lazy" src="${escapeHtml(imagePath)}" alt="${escapeHtml(entry.identity)}"></a>`
          : '<p class="missing">Screenshot unavailable</p>',
        `<p>${escapeHtml(entry.text.captionTitle)}</p>`,
        `<p class="quiet">${escapeHtml(entry.text.thought)}</p>`,
        flagMarkup,
        '</article>',
      ].join('');
    }).join('');
    return [
      `<section id="${escapeHtml(key)}">`,
      '<div class="sequence-title">',
      `<span>${escapeHtml(groupLabel(first))}</span>`,
      `<span>${statusCounts.pass} pass · ${statusCounts.review} review · ${statusCounts.fail} fail · <a href="${escapeHtml(sheetPath)}">SVG sheet</a></span>`,
      '</div>',
      `<div class="frames">${frames}</div>`,
      '</section>',
    ].join('');
  }).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Scene visual audit</title>
<style>
:root { color-scheme: dark; --bg:#080a10; --surface:#10131a; --line:#30343d; --text:#f5f3ec; --muted:#aaaeb9; --pass:#80f1e7; --review:#f3bb72; --fail:#ff8e76; }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--text); font-family:ui-sans-serif,system-ui,sans-serif; font-size:14px; line-height:1.45; }
header { display:flex; align-items:start; justify-content:space-between; gap:24px; padding:24px; border-bottom:1px solid var(--line); }
header strong { display:block; margin-bottom:5px; font-size:18px; }
header p { max-width:760px; margin:0; color:var(--muted); }
table { border-collapse:collapse; min-width:220px; }
th,td { padding:3px 8px; border-bottom:1px solid var(--line); text-align:left; }
th { color:var(--muted); font-weight:500; }
main { padding:0 24px 40px; }
section { padding:24px 0; border-bottom:1px solid var(--line); }
.sequence-title { display:flex; justify-content:space-between; gap:16px; margin-bottom:12px; font-weight:700; }
.sequence-title span:last-child { color:var(--muted); font-weight:500; }
a { color:var(--pass); text-underline-offset:3px; }
.frames { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
.frame { min-width:0; border:1px solid var(--line); background:var(--surface); }
.frame.review { border-color:#6b5835; }
.frame.fail { border-color:#7b4036; }
.frame-title { display:flex; justify-content:space-between; padding:8px 10px; border-bottom:1px solid var(--line); }
.frame-title b { color:var(--pass); font-size:12px; text-transform:uppercase; }
.frame.review .frame-title b { color:var(--review); }
.frame.fail .frame-title b { color:var(--fail); }
.frame img { display:block; width:100%; aspect-ratio:1/1; object-fit:contain; background:#05070b; }
.frame p { margin:9px 10px; }
.frame ul { margin:9px 10px 12px; padding-left:18px; color:var(--review); }
.frame.fail ul { color:var(--fail); }
.quiet { color:var(--muted); }
@media (max-width:900px) { header { display:block; } table { margin-top:16px; } .frames { grid-template-columns:1fr; } .sequence-title { display:block; } }
</style>
</head>
<body>
<header>
  <div><strong>Scene visual audit</strong><p>Static index of the isolated headless captures. The PNGs are referenced in place; this audit does not duplicate or recapture them. Automated checks cover integrity, dimensions, renderer overflow/bounds metadata, text sidecars, and edge activity. Human inspection is still required for semantic clarity, occlusion inside the 3D canvas, contrast, and subjective readability.</p></div>
  <table><tbody>${summaryRows}</tbody></table>
</header>
<main>${groupMarkup}</main>
</body>
</html>
`;
}

function createReadme(report) {
  return [
    'SCENE SNAPSHOT VISUAL AUDIT',
    '',
    `Manifest fingerprint: ${report.manifestFingerprint}`,
    `Frames: ${report.summary.frames}`,
    `Automatic pass: ${report.summary.pass}`,
    `Needs review: ${report.summary.review}`,
    `Failure: ${report.summary.fail}`,
    `Matrix errors: ${report.summary.matrixFailures}`,
    '',
    'This folder was created without launching or controlling a visible browser.',
    'index.html and contact-sheets/*.svg reference the canonical PNGs in place; they do not contain duplicate screenshots.',
    'report.json records deterministic machine checks for every frame.',
    '',
    'AUTOMATED CHECKS',
    '- PNG signature, decompression, dimensions, raster/CSS scale, and SHA-256 when supplied.',
    '- Exact text-sidecar equality with the manifest text.',
    '- Renderer-reported text overflow and bounds failures.',
    '- Renderer-reported minimum visible font size when present.',
    '- Edge-band activity as a conservative clipping-review heuristic.',
    '- Blank, transparent, or very low-contrast image detection.',
    '',
    'LIMITATIONS',
    '- Edge activity is a review hint, not proof of clipping; intentional borders and controls can touch a pane edge.',
    '- Pixel analysis cannot reliably identify semantic occlusion, misleading object placement, or whether a 3D action matches the written phase.',
    '- No OCR is performed, so spelling and actual rendered glyph legibility must be checked in the contact sheets or canonical PNGs.',
    '- Passing machine checks does not replace human review at the intended display size.',
    '',
    'Run:',
    'node scripts/audit-scene-visuals.mjs',
    'Use --strict to make review flags return a failing exit code.',
    '',
  ].join('\n');
}

async function safeReplaceDirectory(staging, target) {
  await rm(target, { recursive: true, force: true });
  try {
    await rename(staging, target);
  } catch (error) {
    if (!['EPERM', 'EACCES', 'EXDEV'].includes(error?.code)) throw error;
    await mkdir(target, { recursive: true });
    const entries = await readdir(staging, { withFileTypes: true });
    for (const entry of entries) {
      const source = path.join(staging, entry.name);
      const destination = path.join(target, entry.name);
      if (entry.isDirectory()) {
        await copyDirectory(source, destination);
      } else if (entry.isFile()) {
        await copyFile(source, destination);
      }
    }
    await rm(staging, { recursive: true, force: true });
  }
}

async function copyDirectory(source, destination) {
  await mkdir(destination, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) await copyDirectory(from, to);
    else if (entry.isFile()) await copyFile(from, to);
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const manifestBuffer = await readFile(options.manifest);
  const manifest = JSON.parse(manifestBuffer.toString('utf8'));
  if (!Array.isArray(manifest.frames)) throw new Error('Manifest has no frames array.');
  if (!options.allowPartial && manifest.snapshotVersion !== 'v1') {
    throw new Error(`Expected canonical snapshotVersion v1, found ${manifest.snapshotVersion ?? '(missing)'}.`);
  }

  const matrixFailures = validateMatrix(manifest.frames, options.allowPartial);
  const entries = [];
  for (const frame of [...manifest.frames].sort(compareFrames)) {
    const identity = frameIdentity(frame);
    const failures = [];
    const warnings = [];
    for (const field of TEXT_FIELDS) {
      if (!normalizeText(frame.text?.[field])) failures.push(`Missing text field ${field}.`);
    }

    let screenshotAbsolute;
    let textAbsolute;
    try {
      screenshotAbsolute = await resolveFrameAsset(options.manifest, frame.screenshot, manifest.snapshotVersion);
      textAbsolute = await resolveFrameAsset(options.manifest, frame.textPath, manifest.snapshotVersion);
    } catch (error) {
      failures.push(error.message);
    }

    let pngMetrics = null;
    let actualSha256 = null;
    if (screenshotAbsolute) {
      try {
        const pngBuffer = await readFile(screenshotAbsolute);
        actualSha256 = sha256(pngBuffer);
        if (frame.screenshotSha256 && frame.screenshotSha256 !== actualSha256) {
          failures.push('PNG SHA-256 does not match the manifest.');
        }
        const png = parsePng(pngBuffer);
        const dimensions = dimensionChecks(frame, png);
        failures.push(...dimensions.failures);
        warnings.push(...dimensions.warnings);
        pngMetrics = { width: png.width, height: png.height, ...analyzePng(png) };
        if (pngMetrics.transparentFraction > 0.01) failures.push(`PNG is ${rounded(pngMetrics.transparentFraction * 100, 2)}% transparent.`);
        if (pngMetrics.luminance.range < 35 || pngMetrics.luminance.standardDeviation < 8) {
          failures.push('PNG appears blank or has insufficient luminance variation.');
        }
        if (pngMetrics.clippingReviewEdges.length > 0) {
          warnings.push(`Foreground activity approaches ${pngMetrics.clippingReviewEdges.join(', ')} edge(s); inspect for clipping.`);
        }
      } catch (error) {
        failures.push(`PNG analysis failed: ${error.message}`);
      }
    }

    if (textAbsolute && TEXT_FIELDS.every((field) => normalizeText(frame.text?.[field]))) {
      try {
        const actualText = normalizeText(await readFile(textAbsolute, 'utf8'));
        const expectedText = normalizeText(expectedTextSidecar(frame.text));
        if (actualText !== expectedText) failures.push('Text sidecar differs from the manifest text.');
      } catch (error) {
        failures.push(`Text sidecar analysis failed: ${error.message}`);
      }
    }

    const metadata = metadataChecks(frame);
    failures.push(...metadata.failures);
    warnings.push(...metadata.warnings);
    entries.push({
      identity,
      viewport: frame.viewport,
      game: frame.game,
      mode: frame.mode,
      trial: Number(frame.trial),
      step: Number(frame.step),
      screenshot: frame.screenshot,
      textPath: frame.textPath,
      screenshotAbsolute,
      text: frame.text || {},
      actualSha256,
      png: pngMetrics,
      minVisibleFontPx: metadata.minVisibleFontPx,
      failures,
      warnings,
      status: statusFor(failures, warnings),
    });
  }

  const summary = entries.reduce((counts, entry) => {
    counts.frames += 1;
    counts[entry.status] += 1;
    return counts;
  }, { frames: 0, pass: 0, review: 0, fail: 0 });
  const report = {
    schema: 'cardiac-scene-visual-audit',
    schemaVersion: 1,
    manifestFingerprint: sha256(manifestBuffer),
    snapshotVersion: manifest.snapshotVersion ?? null,
    backgroundOnly: true,
    visibleBrowserUsed: false,
    screenshotsDuplicated: false,
    checks: {
      expectedFrameCount: options.allowPartial ? null : EXPECTED_FRAME_COUNT,
      minimumDeviceScaleFactor: 2.5,
      desktopMinimumRaster: { width: 2400, height: 2000 },
      phoneMinimumRaster: { width: 850, height: 2200 },
      edgeActivityIsHeuristicOnly: true,
      humanVisualReviewStillRequired: true,
    },
    matrixFailures,
    summary: { ...summary, matrixFailures: matrixFailures.length },
    frames: entries.map((entry) => {
      const serializable = { ...entry };
      delete serializable.screenshotAbsolute;
      return serializable;
    }),
  };

  const groupsByKey = new Map();
  for (const entry of entries) {
    const key = groupKey(entry);
    if (!groupsByKey.has(key)) groupsByKey.set(key, []);
    groupsByKey.get(key).push(entry);
  }
  const groups = [...groupsByKey.entries()].map(([key, groupEntries]) => ({
    key,
    entries: groupEntries.sort((first, second) => first.step - second.step),
    sheetPath: `contact-sheets/${key}.svg`,
  }));

  const target = path.resolve(options.output);
  const targetRelative = path.relative(PROJECT_ROOT, target);
  const targetParts = targetRelative.split(path.sep).filter(Boolean);
  if (
    !isWithin(PROJECT_ROOT, target)
    || target === PROJECT_ROOT
    || targetParts.length < 2
    || isWithin(target, options.manifest)
  ) {
    throw new Error(`Refusing to replace unsafe audit output directory: ${target}`);
  }
  const staging = `${target}.staging-${process.pid}`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(path.join(staging, 'contact-sheets'), { recursive: true });
  const htmlContext = {
    ...report,
    outputIndexAbsolute: path.join(target, 'index.html'),
  };
  for (const group of groups) {
    const svg = createContactSheet(group.entries, staging);
    await writeFile(path.join(staging, group.sheetPath), svg, 'utf8');
  }
  await writeFile(path.join(staging, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(path.join(staging, 'README.txt'), createReadme(report), 'utf8');
  await writeFile(path.join(staging, 'index.html'), createHtml(htmlContext, groups), 'utf8');
  await safeReplaceDirectory(staging, target);

  console.log(`Audited ${entries.length} canonical scene PNGs without launching a browser.`);
  console.log(`Automatic pass: ${summary.pass}; review: ${summary.review}; fail: ${summary.fail}.`);
  console.log(`Contact sheets: ${groups.length}; raster screenshots duplicated: no.`);
  console.log(`Output: ${target}`);
  if (summary.fail > 0 || matrixFailures.length > 0 || (options.strict && summary.review > 0)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Visual audit failed: ${error.message}`);
  process.exitCode = 1;
});
