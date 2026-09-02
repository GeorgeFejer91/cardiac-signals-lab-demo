#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeRenderSourceBytes } from './render-source-bytes.mjs';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SNAPSHOT_ROOT = path.join(PROJECT_ROOT, 'validation', 'scene-snapshots');
const DEFAULT_VERSION = 'v1';
const CAPTURE_TARGET = '.minimal-scene-pane';
const RENDERER = 'isolated-headless-edge-cdp';
const DPR = 2.5;
const MIN_SETTLE_MS = 1000;
const MIN_SETTLE_FRAMES = 90;
const MAX_ACTION_BUTTON_SYMMETRY_TOLERANCE = 0.002;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const TEXT_FIELDS = [
  'sceneStatus', 'thought', 'captionTitle', 'explanation', 'timing', 'cueBadge',
];
const RENDER_SOURCE_EXTENSIONS = new Set([
  '.bin', '.css', '.glb', '.gltf', '.jpeg', '.jpg', '.json', '.png', '.svg', '.ts', '.tsx', '.webp',
]);
const MATRIX = {
  viewports: ['desktop', 'phone'],
  games: [{ id: 'used-car', trials: 6 }, { id: 'number-card', trials: 4 }],
  modes: ['aligned', 'conflicting'],
  steps: 6,
};

function parseArguments(argv) {
  const options = {
    root: DEFAULT_SNAPSHOT_ROOT,
    version: process.env.SCENE_SNAPSHOT_VERSION || DEFAULT_VERSION,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--root') {
      const value = argv[index + 1];
      if (!value) throw new Error('--root requires a path.');
      options.root = path.resolve(value);
      index += 1;
    } else if (argument === '--version') {
      const value = argv[index + 1];
      if (!value) throw new Error('--version requires a value.');
      options.version = value;
      index += 1;
    } else if (argument === '--help' || argument === '-h') {
      console.log('Usage: node scripts/validate-scene-snapshots.mjs [--root PATH] [--version v1]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/u.test(options.version)) {
    throw new Error(`Invalid snapshot version: ${options.version || '(empty)'}`);
  }
  return options;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function expectedFrames(version) {
  const frames = [];
  for (const viewport of MATRIX.viewports) {
    for (const game of MATRIX.games) {
      for (const mode of MATRIX.modes) {
        for (let trial = 1; trial <= game.trials; trial += 1) {
          for (let step = 1; step <= MATRIX.steps; step += 1) {
            const filename = `${game.id}_${mode}_trial${pad2(trial)}_step${pad2(step)}.png`;
            frames.push({
              filename,
              screenshot: path.posix.join(version, viewport, filename),
              textPath: path.posix.join(version, 'text', viewport, filename.replace(/\.png$/u, '.txt')),
              viewport,
              game: game.id,
              mode,
              trial,
              step,
            });
          }
        }
      }
    }
  }
  return frames;
}

async function fileExists(filename) {
  try {
    return (await stat(filename)).isFile();
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function listFiles(directory) {
  const output = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return output;
    throw error;
  }
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await listFiles(absolute));
    else if (entry.isFile()) output.push(absolute);
  }
  return output;
}

async function renderSourceFiles() {
  const candidates = [
    ...await listFiles(path.join(PROJECT_ROOT, 'app')),
    ...await listFiles(path.join(PROJECT_ROOT, 'public', 'assets')),
    ...await listFiles(path.join(PROJECT_ROOT, 'public', 'models')),
    path.join(PROJECT_ROOT, 'package.json'),
    path.join(PROJECT_ROOT, 'package-lock.json'),
    path.join(PROJECT_ROOT, 'next.config.ts'),
    path.join(PROJECT_ROOT, 'tsconfig.json'),
    path.join(PROJECT_ROOT, 'vite.config.ts'),
  ];
  const files = [];
  for (const absolute of candidates) {
    if (!await fileExists(absolute)) continue;
    if (!RENDER_SOURCE_EXTENSIONS.has(path.extname(absolute).toLowerCase())) continue;
    files.push(path.relative(PROJECT_ROOT, absolute).split(path.sep).join('/'));
  }
  return [...new Set(files)].sort();
}

async function computeRenderSourceFingerprint() {
  const files = await renderSourceFiles();
  const hash = createHash('sha256');
  const entries = [];
  for (const relative of files) {
    const contents = normalizeRenderSourceBytes(
      relative,
      await readFile(path.join(PROJECT_ROOT, ...relative.split('/'))),
    );
    const sha256 = createHash('sha256').update(contents).digest('hex');
    entries.push({ path: relative, sha256 });
    hash.update(relative);
    hash.update('\0');
    hash.update(contents);
    hash.update('\0');
  }
  return { algorithm: 'sha256', files, entries, hash: hash.digest('hex') };
}

function normalizeRelativePath(value, label, errors) {
  if (typeof value !== 'string' || value.trim() === '' || value.includes('\0')) {
    errors.push(`[path] ${label} must be a non-empty safe relative path.`);
    return null;
  }
  const slashed = value.replaceAll('\\', '/');
  const normalized = path.posix.normalize(slashed);
  const absolute = slashed.startsWith('/') || /^[a-zA-Z]:\//u.test(slashed) || slashed.startsWith('//');
  const escapes = normalized === '..' || normalized.startsWith('../');
  if (absolute || escapes || normalized !== slashed || normalized.startsWith('./')) {
    errors.push(`[path] ${label} is not a normalized in-root relative path: ${value}`);
    return null;
  }
  return normalized;
}

async function readJson(filename, label, errors) {
  try {
    return JSON.parse(await readFile(filename, 'utf8'));
  } catch (error) {
    errors.push(`[json] Could not read ${label}: ${error.message}`);
    return null;
  }
}

function inspectPng(buffer) {
  if (buffer.length < 45 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { valid: false, reason: 'PNG signature/header is missing' };
  }
  let offset = 8;
  let width = null;
  let height = null;
  let firstChunk = true;
  let foundIend = false;
  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) return { valid: false, reason: 'truncated PNG chunk' };
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > buffer.length) return { valid: false, reason: `truncated ${type || 'unknown'} chunk` };
    if (firstChunk) {
      if (type !== 'IHDR' || length !== 13) return { valid: false, reason: 'IHDR is not the first valid chunk' };
      width = buffer.readUInt32BE(offset + 8);
      height = buffer.readUInt32BE(offset + 12);
      firstChunk = false;
    }
    if (type === 'IEND') {
      if (length !== 0 || chunkEnd !== buffer.length) return { valid: false, reason: 'IEND is malformed or not final' };
      foundIend = true;
    }
    offset = chunkEnd;
  }
  if (!foundIend) return { valid: false, reason: 'IEND chunk is missing' };
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return { valid: false, reason: `invalid dimensions ${String(width)}x${String(height)}` };
  }
  return { valid: true, width, height, sha256: createHash('sha256').update(buffer).digest('hex') };
}

function canonicalText(text) {
  return `${TEXT_FIELDS.map((field) => `${field}: ${text[field]}`).join('\n')}\n`;
}

function validateText(text, source, errors) {
  if (!text || typeof text !== 'object' || Array.isArray(text)) {
    errors.push(`[text] ${source}: text object is required.`);
    return false;
  }
  let valid = true;
  for (const field of TEXT_FIELDS) {
    if (typeof text[field] !== 'string' || text[field].trim() === '') {
      errors.push(`[text] ${source}: ${field} must be a non-empty string.`);
      valid = false;
    } else if (text[field] !== text[field].trim()) {
      errors.push(`[text] ${source}: ${field} must not contain surrounding whitespace.`);
      valid = false;
    }
  }
  return valid;
}

function normalizeGameAlias(value) {
  const normalized = String(value).trim().toLowerCase().replaceAll('_', '-').replaceAll(' ', '-');
  if (['used-car', 'used-car-salesman', 'used-car-salesman-game', 'car', 'cars'].includes(normalized)) return 'used-car';
  if (['number-card', 'number-cards', 'number', 'numbers'].includes(normalized)) return 'number-card';
  return null;
}

function normalizeModeAlias(value) {
  const normalized = String(value).trim().toLowerCase().replaceAll('_', '-');
  if (['aligned', 'cooperate', 'cooperative', 'collaborate', 'collaborative', 'common-interest'].includes(normalized)) return 'aligned';
  if (['conflicting', 'compete', 'competitive', 'opposed', 'mixed-motive'].includes(normalized)) return 'conflicting';
  return null;
}

function validateIdentity(record, expected, source, errors) {
  for (const field of ['game', 'mode', 'viewport']) {
    if (record[field] !== expected[field]) {
      errors.push(`[identity] ${source}: ${field} must be ${expected[field]}, found ${String(record[field])}.`);
    }
  }
  for (const field of ['trial', 'step']) {
    if (!Number.isInteger(record[field]) || record[field] !== expected[field]) {
      errors.push(`[identity] ${source}: ${field} must be integer ${expected[field]}, found ${String(record[field])}.`);
    }
  }
  if (record.filename !== expected.filename) {
    errors.push(`[identity] ${source}: filename must be ${expected.filename}, found ${String(record.filename)}.`);
  }
  for (const field of ['scenario', 'scenarioId']) {
    if (record[field] !== undefined && normalizeGameAlias(record[field]) !== expected.game) {
      errors.push(`[identity] ${source}: ${field} disagrees with game ${expected.game}.`);
    }
  }
  for (const field of ['incentive', 'payoff']) {
    if (record[field] !== undefined && normalizeModeAlias(record[field]) !== expected.mode) {
      errors.push(`[identity] ${source}: ${field} disagrees with mode ${expected.mode}.`);
    }
  }
  if (record.phase !== undefined && (!Number.isInteger(record.phase) || record.phase !== expected.step)) {
    errors.push(`[identity] ${source}: phase must equal one-based step ${expected.step} when present.`);
  }
}

function validateFixedState(record, source, errors) {
  if (record.cueSource !== 'live') errors.push(`[state] ${source}: cueSource must be live.`);
  if (record.cueWindow !== 'both') errors.push(`[state] ${source}: cueWindow must be both.`);
  if (record.autoAdvance !== false) errors.push(`[state] ${source}: autoAdvance must be false.`);
}

function validateCaptureProtocol(protocol, source, errors, { topLevel = false } = {}) {
  if (!protocol || typeof protocol !== 'object' || Array.isArray(protocol)) {
    errors.push(`[capture] ${source}: captureProtocol object is required.`);
    return;
  }
  const exact = {
    renderer: RENDERER,
    selector: CAPTURE_TARGET,
    domEventsOnly: true,
    operatingSystemPointerUsed: false,
    visibleBrowserUsed: false,
    privateBrowserProfile: true,
    focusSuppressed: true,
    activeElementBlurred: true,
    scrollbarSuppressed: true,
    fontsReady: true,
    assetsReady: true,
    activeRenderSettled: true,
  };
  for (const [field, expected] of Object.entries(exact)) {
    if (protocol[field] !== expected) {
      errors.push(`[capture] ${source}: ${field} must be ${String(expected)}, found ${String(protocol[field])}.`);
    }
  }
  if (!Number.isInteger(protocol.rendererProtocolVersion) || protocol.rendererProtocolVersion < 1) {
    errors.push(`[capture] ${source}: rendererProtocolVersion must be a positive integer.`);
  }
  if (protocol.deviceScaleFactor !== DPR) {
    errors.push(`[capture] ${source}: deviceScaleFactor must be ${DPR}.`);
  }
  if (!Number.isInteger(protocol.settleFrames) || protocol.settleFrames < MIN_SETTLE_FRAMES) {
    errors.push(`[capture] ${source}: settleFrames must be at least ${MIN_SETTLE_FRAMES}.`);
  }
  const settleMs = topLevel ? protocol.minimumSettleMs : protocol.settleMs;
  if (!Number.isFinite(settleMs) || settleMs < MIN_SETTLE_MS) {
    errors.push(`[capture] ${source}: ${topLevel ? 'minimumSettleMs' : 'settleMs'} must be at least ${MIN_SETTLE_MS}.`);
  }
  if (topLevel && protocol.uniformDeviceScaleFactor !== true) {
    errors.push(`[capture] ${source}: uniformDeviceScaleFactor must be true.`);
  }
  if (topLevel && protocol.measuredSettle !== true) {
    errors.push(`[capture] ${source}: measuredSettle must be true.`);
  }
}

function validateFingerprint(candidate, current, source, errors) {
  if (!candidate || typeof candidate !== 'object') {
    errors.push(`[fingerprint] ${source}: renderSourceFingerprint is required.`);
    return;
  }
  if (candidate.algorithm !== current.algorithm) errors.push(`[fingerprint] ${source}: algorithm must be sha256.`);
  if (candidate.hash !== current.hash) errors.push(`[fingerprint] ${source}: aggregate hash is stale.`);
  if (JSON.stringify(candidate.files) !== JSON.stringify(current.files)) {
    errors.push(`[fingerprint] ${source}: complete sorted source-file list does not match current render inputs.`);
  }
  if (JSON.stringify(candidate.entries) !== JSON.stringify(current.entries)) {
    errors.push(`[fingerprint] ${source}: per-file SHA-256 entries do not match current render inputs.`);
  }
}

function validateDimensions(record, png, source, errors) {
  const dimensions = record.captureDimensions;
  if (!dimensions || typeof dimensions !== 'object') {
    errors.push(`[dimensions] ${source}: captureDimensions object is required.`);
    return;
  }
  for (const field of ['cssWidth', 'cssHeight']) {
    if (!Number.isFinite(dimensions[field]) || dimensions[field] <= 0) {
      errors.push(`[dimensions] ${source}: ${field} must be positive.`);
    }
  }
  if (dimensions.deviceScaleFactor !== DPR) errors.push(`[dimensions] ${source}: deviceScaleFactor must be ${DPR}.`);
  if (dimensions.rasterWidth !== png.width || dimensions.rasterHeight !== png.height) {
    errors.push(`[dimensions] ${source}: recorded raster ${String(dimensions.rasterWidth)}x${String(dimensions.rasterHeight)} does not match PNG ${png.width}x${png.height}.`);
  }
  if (Number.isFinite(dimensions.cssWidth) && Math.abs(png.width - Math.round(dimensions.cssWidth * DPR)) > 2) {
    errors.push(`[dimensions] ${source}: raster width does not match CSS width × DPR ${DPR}.`);
  }
  if (Number.isFinite(dimensions.cssHeight) && Math.abs(png.height - Math.round(dimensions.cssHeight * DPR)) > 2) {
    errors.push(`[dimensions] ${source}: raster height does not match CSS height × DPR ${DPR}.`);
  }
  if (record.viewport === 'desktop') {
    if (png.width < 2200 || png.height < 1700 || png.height / png.width > 1.35) {
      errors.push(`[dimensions] ${source}: desktop pane dimensions are outside the canonical high-resolution profile.`);
    }
  } else if (record.viewport === 'phone') {
    if (png.width < 750 || png.width > 1100 || png.height < 2000 || png.height / png.width < 2.2) {
      errors.push(`[dimensions] ${source}: phone pane dimensions are outside the canonical high-resolution portrait profile.`);
    }
  }
  const clip = record.captureClipPageCss;
  if (!clip || !['x', 'y', 'width', 'height'].every((field) => Number.isFinite(clip[field]))) {
    errors.push(`[dimensions] ${source}: captureClipPageCss must contain finite x/y/width/height.`);
  } else if (Math.abs(clip.width - dimensions.cssWidth) > 0.01 || Math.abs(clip.height - dimensions.cssHeight) > 0.01) {
    errors.push(`[dimensions] ${source}: CSS clip and captureDimensions disagree.`);
  }
}

function validateActionButtonSymmetry(sceneQa, expectedScenario, source, errors) {
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
  ) {
    errors.push(`[layout] ${source}: complete passing action-button symmetry evidence is required.`);
    return;
  }
  const buttons = new Map(sceneQa.buttonContainment.map((button) => [button?.id, button]));
  if (buttons.size !== 4 || expectedPairs.flatMap(({ buttonIds }) => buttonIds).some((id) => !buttons.has(id))) {
    errors.push(`[layout] ${source}: action-button symmetry evidence does not cover the canonical four controls.`);
    return;
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
      errors.push(`[layout] ${source}: ${expected.participant} action buttons are not mirrored with matched row, scale, and footprint.`);
    }
  }
  if (!pairsValid) return;
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
  ) errors.push(`[layout] ${source}: far/near action-button pair geometry is not equivalent.`);
}

function validateLayout(record, source, errors) {
  const layout = record.layout;
  if (!layout || typeof layout !== 'object') {
    errors.push(`[layout] ${source}: layout audit evidence is required.`);
    return;
  }
  for (const field of ['boundsFailures', 'textOverflow']) {
    if (!Array.isArray(layout[field]) || layout[field].length !== 0) {
      errors.push(`[layout] ${source}: ${field} must be an empty array.`);
    }
  }
  const identity = layout.identityChecks;
  for (const field of ['mode', 'trial', 'step', 'cueSource', 'cueWindow', 'autoAdvance', 'sceneQaScenario', 'sceneQaPhase']) {
    if (identity?.[field] !== true) errors.push(`[layout] ${source}: identityChecks.${field} must be true.`);
  }
  if (!Number.isFinite(layout.minVisibleFontPx) || layout.minVisibleFontPx < 11) {
    errors.push(`[layout] ${source}: minVisibleFontPx must be at least 11.`);
  }
  if (!Array.isArray(layout.textMetrics) || layout.textMetrics.length === 0) {
    errors.push(`[layout] ${source}: textMetrics must document visible text sizes and bounds.`);
  } else {
    for (const [index, metric] of layout.textMetrics.entries()) {
      if (!Number.isFinite(metric?.fontSizePx) || metric.fontSizePx < 11) {
        errors.push(`[layout] ${source}: textMetrics[${index}].fontSizePx must be at least 11.`);
      }
      if (!metric?.bounds || !['x', 'y', 'width', 'height', 'right', 'bottom'].every((field) => Number.isFinite(metric.bounds[field]))) {
        errors.push(`[layout] ${source}: textMetrics[${index}] must include finite bounds.`);
      }
    }
  }
  if (!Array.isArray(layout.sceneQaFailures) || layout.sceneQaFailures.length !== 0) {
    errors.push(`[layout] ${source}: sceneQaFailures must be an empty array.`);
  }
  const sceneQa = layout.sceneQa;
  if (!sceneQa || typeof sceneQa !== 'object' || Array.isArray(sceneQa)) {
    errors.push(`[layout] ${source}: sceneQa evidence is required.`);
    return;
  }
  if (sceneQa.schema !== 'cardiac-scene-qa' || sceneQa.schemaVersion !== 1 || sceneQa.ready !== true) {
    errors.push(`[layout] ${source}: sceneQa must use the ready cardiac-scene-qa v1 schema.`);
  }
  const expectedScenario = record.game === 'used-car' ? 'cars' : 'numbers';
  if (sceneQa.scenarioId !== expectedScenario || sceneQa.phase !== record.step - 1) {
    errors.push(`[layout] ${source}: sceneQa scenario/phase identity is stale.`);
  }
  if (!Array.isArray(sceneQa.violations) || sceneQa.violations.length !== 0) {
    errors.push(`[layout] ${source}: sceneQa.violations must be an empty array.`);
  }
  if (!sceneQa.table || !['minX', 'maxX', 'minZ', 'maxZ', 'requiredMargin'].every((field) => Number.isFinite(sceneQa.table[field]))) {
    errors.push(`[layout] ${source}: sceneQa.table must contain finite world bounds and a required margin.`);
  }
  if (!Array.isArray(sceneQa.buttonContainment) || sceneQa.buttonContainment.length !== 4) {
    errors.push(`[layout] ${source}: sceneQa must document exactly four action buttons.`);
  } else {
    for (const [index, button] of sceneQa.buttonContainment.entries()) {
      if (!button?.id || button.contained !== true || !Number.isFinite(button.minimumMarginWorld)) {
        errors.push(`[layout] ${source}: sceneQa.buttonContainment[${index}] is incomplete or outside the table.`);
      } else if (Number.isFinite(sceneQa.table?.requiredMargin) && button.minimumMarginWorld + 0.001 < sceneQa.table.requiredMargin) {
        errors.push(`[layout] ${source}: sceneQa.buttonContainment[${index}] does not preserve the required table margin.`);
      }
      if (!button?.bounds || !['minX', 'maxX', 'minZ', 'maxZ'].every((field) => Number.isFinite(button.bounds[field]))) {
        errors.push(`[layout] ${source}: sceneQa.buttonContainment[${index}] needs finite world bounds.`);
      }
    }
  }
  validateActionButtonSymmetry(sceneQa, expectedScenario, source, errors);
  const projected = sceneQa.projected;
  if (!projected || !Array.isArray(projected.panels) || !Array.isArray(projected.avatarHeads) || projected.avatarHeads.length !== 2) {
    errors.push(`[layout] ${source}: sceneQa projected panel/head bounds are incomplete.`);
  } else {
    for (const [kind, entries] of [['panels', projected.panels], ['avatarHeads', projected.avatarHeads]]) {
      for (const [index, bounds] of entries.entries()) {
        if (!bounds?.id || !['x', 'y', 'width', 'height', 'right', 'bottom'].every((field) => Number.isFinite(bounds[field]))) {
          errors.push(`[layout] ${source}: sceneQa.projected.${kind}[${index}] needs finite viewport bounds.`);
        }
        if (kind === 'panels' && bounds?.insideCanvas !== true) {
          errors.push(`[layout] ${source}: sceneQa.projected.panels[${index}] is clipped by the 3D canvas.`);
        }
        if (kind === 'panels' && (
          !Number.isFinite(bounds?.requiredCanvasMarginPx)
          || bounds.requiredCanvasMarginPx < 12
          || !bounds.canvasMargins
          || !['left', 'top', 'right', 'bottom'].every((field) => (
            Number.isFinite(bounds.canvasMargins[field])
            && bounds.canvasMargins[field] + 0.001 >= bounds.requiredCanvasMarginPx
          ))
        )) {
          errors.push(`[layout] ${source}: sceneQa.projected.panels[${index}] lacks the required canvas safety margin.`);
        }
      }
    }
  }
  if (!Array.isArray(sceneQa.panelAvatarSeparations)) {
    errors.push(`[layout] ${source}: sceneQa.panelAvatarSeparations is required.`);
  } else {
    for (const [index, separation] of sceneQa.panelAvatarSeparations.entries()) {
      if (separation?.passes !== true || !Number.isFinite(separation.overlapRatio) || !Number.isFinite(separation.maximumOverlapRatio)) {
        errors.push(`[layout] ${source}: sceneQa.panelAvatarSeparations[${index}] reports overlap or incomplete evidence.`);
      }
    }
  }
  if (!Array.isArray(sceneQa.panelPairSeparations)) {
    errors.push(`[layout] ${source}: sceneQa.panelPairSeparations is required.`);
  } else {
    for (const [index, separation] of sceneQa.panelPairSeparations.entries()) {
      if (
        !separation?.firstPanel
        || !separation?.secondPanel
        || separation.passes !== true
        || !Number.isFinite(separation.overlapRatio)
        || !Number.isFinite(separation.maximumOverlapRatio)
        || separation.maximumOverlapRatio > 0.001
        || separation.overlapRatio > separation.maximumOverlapRatio
      ) {
        errors.push(`[layout] ${source}: sceneQa.panelPairSeparations[${index}] reports overlap or incomplete evidence.`);
      }
    }
  }
  if (!Array.isArray(sceneQa.bubbleSeparations) || sceneQa.bubbleSeparations.length === 0) {
    errors.push(`[layout] ${source}: sceneQa.bubbleSeparations must document the active thought bubble.`);
  } else {
    for (const [index, separation] of sceneQa.bubbleSeparations.entries()) {
      if (separation?.passes !== true || !Number.isFinite(separation.outerOverlapRatio) || !Number.isFinite(separation.copyOverlapRatio)) {
        errors.push(`[layout] ${source}: sceneQa.bubbleSeparations[${index}] reports overlap or incomplete evidence.`);
      }
    }
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const errors = [];
  const expected = expectedFrames(options.version);
  const expectedScreenshots = new Set(expected.map((frame) => frame.screenshot));
  const expectedTexts = new Set(expected.map((frame) => frame.textPath));
  const expectedFiles = new Set([
    path.posix.join(options.version, 'manifest.json'), ...expectedScreenshots, ...expectedTexts,
  ]);
  const versionRoot = path.join(options.root, options.version);
  const manifestRelative = path.posix.join(options.version, 'manifest.json');
  const manifestAbsolute = path.join(options.root, ...manifestRelative.split('/'));
  const manifest = await readJson(manifestAbsolute, manifestRelative, errors);
  const currentFingerprint = await computeRenderSourceFingerprint();

  if (manifest?.schemaVersion !== 1) errors.push(`[manifest] ${manifestRelative}: schemaVersion must be 1.`);
  if (manifest?.snapshotVersion !== options.version) errors.push(`[manifest] ${manifestRelative}: snapshotVersion must be ${options.version}.`);
  if (manifest?.frameCount !== expected.length) errors.push(`[manifest] ${manifestRelative}: frameCount must be ${expected.length}.`);
  if (manifest?.captureTarget !== CAPTURE_TARGET) errors.push(`[manifest] ${manifestRelative}: captureTarget must be ${CAPTURE_TARGET}.`);
  if (!Array.isArray(manifest?.frames) || manifest.frames.length !== expected.length) {
    errors.push(`[manifest] ${manifestRelative}: frames must contain exactly ${expected.length} records.`);
  }
  validateFingerprint(manifest?.renderSourceFingerprint, currentFingerprint, manifestRelative, errors);
  validateCaptureProtocol(manifest?.captureProtocol, manifestRelative, errors, { topLevel: true });
  validateFixedState(manifest?.fixedState || {}, manifestRelative, errors);

  const byScreenshot = new Map();
  const seenTextPaths = new Set();
  for (let index = 0; index < (Array.isArray(manifest?.frames) ? manifest.frames.length : 0); index += 1) {
    const record = manifest.frames[index];
    const source = `${manifestRelative}#${index + 1}`;
    const screenshot = normalizeRelativePath(record?.screenshot, `${source}.screenshot`, errors);
    const textPath = normalizeRelativePath(record?.textPath, `${source}.textPath`, errors);
    if (screenshot) {
      if (byScreenshot.has(screenshot)) errors.push(`[manifest] Duplicate screenshot path: ${screenshot}.`);
      else byScreenshot.set(screenshot, { record, source, textPath });
      if (!expectedScreenshots.has(screenshot)) errors.push(`[manifest] Unexpected screenshot record: ${screenshot}.`);
    }
    if (textPath) {
      if (seenTextPaths.has(textPath)) errors.push(`[manifest] Duplicate text path: ${textPath}.`);
      seenTextPaths.add(textPath);
      if (!expectedTexts.has(textPath)) errors.push(`[manifest] Unexpected text record: ${textPath}.`);
    }
    if (record?.auditPass !== true) errors.push(`[audit] ${source}: auditPass must be exactly true.`);
    if (record?.captureTarget !== CAPTURE_TARGET) errors.push(`[capture] ${source}: captureTarget must be ${CAPTURE_TARGET}.`);
    validateFixedState(record || {}, source, errors);
    validateCaptureProtocol(record?.captureProtocol, source, errors);
    validateLayout(record || {}, source, errors);
  }

  let validPngs = 0;
  let exactTexts = 0;
  for (const frame of expected) {
    const match = byScreenshot.get(frame.screenshot);
    if (!match) {
      errors.push(`[missing] Manifest record missing: ${frame.screenshot}.`);
      continue;
    }
    const { record, source, textPath } = match;
    validateIdentity(record, frame, source, errors);
    if (textPath !== frame.textPath) errors.push(`[text] ${source}: textPath must be ${frame.textPath}, found ${String(textPath)}.`);
    const screenshotAbsolute = path.join(options.root, ...frame.screenshot.split('/'));
    let png;
    try {
      png = inspectPng(await readFile(screenshotAbsolute));
    } catch (error) {
      errors.push(`[png] Could not read ${frame.screenshot}: ${error.message}`);
      continue;
    }
    if (!png.valid) {
      errors.push(`[png] ${frame.screenshot}: ${png.reason}.`);
    } else {
      validPngs += 1;
      if (!/^[a-f0-9]{64}$/u.test(record.screenshotSha256 || '') || record.screenshotSha256 !== png.sha256) {
        errors.push(`[png] ${source}: screenshotSha256 does not match ${frame.screenshot}.`);
      }
      validateDimensions(record, png, source, errors);
    }
    const textValid = validateText(record.text, source, errors);
    const textAbsolute = path.join(options.root, ...frame.textPath.split('/'));
    try {
      const actual = await readFile(textAbsolute, 'utf8');
      const normalized = actual.replaceAll('\r\n', '\n');
      if (normalized.includes('\r')) errors.push(`[text] ${frame.textPath}: unsupported bare carriage return.`);
      if (!textValid || normalized !== canonicalText(record.text)) {
        errors.push(`[text] ${frame.textPath}: content does not exactly equal the manifest's canonical six text fields.`);
      } else {
        exactTexts += 1;
      }
    } catch (error) {
      errors.push(`[text] Could not read ${frame.textPath}: ${error.message}`);
    }
  }

  const actualFiles = (await listFiles(versionRoot))
    .map((filename) => path.relative(options.root, filename).split(path.sep).join('/'))
    .sort();
  const actualFileSet = new Set(actualFiles);
  if (actualFileSet.size !== actualFiles.length) errors.push('[path] Duplicate normalized artifact paths found.');
  for (const expectedFile of expectedFiles) {
    if (!actualFileSet.has(expectedFile)) errors.push(`[missing] Required artifact missing: ${expectedFile}.`);
  }
  for (const actual of actualFileSet) {
    if (!expectedFiles.has(actual)) errors.push(`[extra] Unexpected artifact in frozen version: ${actual}.`);
  }
  const actualPngCount = actualFiles.filter((value) => value.endsWith('.png')).length;
  const actualTextCount = actualFiles.filter((value) => value.endsWith('.txt')).length;
  if (actualPngCount !== expected.length) errors.push(`[count] Expected exactly ${expected.length} PNGs, found ${actualPngCount}.`);
  if (actualTextCount !== expected.length) errors.push(`[count] Expected exactly ${expected.length} TXT files, found ${actualTextCount}.`);

  console.log(`Scene snapshot validation ${errors.length === 0 ? 'PASSED' : 'FAILED'}`);
  console.log(`Root: ${options.root}`);
  console.log(`Version: ${options.version}`);
  console.log(`Matrix: ${expected.length} frames (120 desktop + 120 phone; 144 used-car + 96 number-card)`);
  console.log(`PNG integrity: ${validPngs}/${expected.length}`);
  console.log(`Exact text sidecars: ${exactTexts}/${expected.length}`);
  console.log(`Render inputs fingerprinted: ${currentFingerprint.files.length}`);
  if (errors.length > 0) {
    console.error(`\n${errors.length} validation error${errors.length === 1 ? '' : 's'}:`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Scene snapshot validation could not run: ${error.message}`);
  process.exitCode = 1;
});
