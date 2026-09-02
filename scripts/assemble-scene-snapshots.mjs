#!/usr/bin/env node

import {
  cp,
  copyFile,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeRenderSourceBytes } from './render-source-bytes.mjs';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CAPTURE_ROOT = path.join(PROJECT_ROOT, 'tmp', 'qa', 'readability-full-matrix');
const DEFAULT_RENDER_MANIFEST = path.join(DEFAULT_CAPTURE_ROOT, 'headless-renderer', 'render-manifest.json');
const DEFAULT_OUTPUT_ROOT = path.join(PROJECT_ROOT, 'validation', 'scene-snapshots');
const DEFAULT_VERSION = 'v1';
const CAPTURE_TARGET = '.minimal-scene-pane';
const MAX_ACTION_BUTTON_SYMMETRY_TOLERANCE = 0.002;
const TEXT_FIELDS = [
  'sceneStatus',
  'thought',
  'captionTitle',
  'explanation',
  'timing',
  'cueBadge',
];
const MATRIX = {
  viewports: ['desktop', 'phone'],
  games: [
    { id: 'used-car', trials: 6 },
    { id: 'number-card', trials: 4 },
  ],
  modes: ['aligned', 'conflicting'],
  steps: 6,
};

function parseArguments(argv) {
  const options = {
    captureRoot: DEFAULT_CAPTURE_ROOT,
    manifest: DEFAULT_RENDER_MANIFEST,
    manifestExplicit: false,
    outputRoot: DEFAULT_OUTPUT_ROOT,
    version: process.env.SCENE_SNAPSHOT_VERSION || DEFAULT_VERSION,
    force: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--capture-root') {
      options.captureRoot = path.resolve(argv[index + 1] || '');
      if (!options.manifestExplicit) {
        options.manifest = path.join(options.captureRoot, 'headless-renderer', 'render-manifest.json');
      }
      index += 1;
    } else if (argument === '--manifest') {
      options.manifest = path.resolve(argv[index + 1] || '');
      options.manifestExplicit = true;
      options.captureRoot = path.dirname(options.manifest);
      index += 1;
    } else if (argument === '--output-root') {
      options.outputRoot = path.resolve(argv[index + 1] || '');
      index += 1;
    } else if (argument === '--version') {
      options.version = argv[index + 1] || '';
      index += 1;
    } else if (argument === '--force') {
      options.force = true;
    } else if (argument === '--help' || argument === '-h') {
      console.log([
        'Usage: node scripts/assemble-scene-snapshots.mjs [options]',
        '',
        'Options:',
        '  --manifest PATH      Explicit headless render-manifest.json input',
        '  --capture-root PATH  Root containing headless-renderer/render-manifest.json',
        '  --output-root PATH   Versioned snapshot output directory',
        '  --version NAME       Snapshot version (default: v1)',
        '  --force              Replace an existing version after staging succeeds',
      ].join('\n'));
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(options.version)) {
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
              key: `${viewport}/${filename}`,
              screenshot: path.posix.join(version, viewport, filename),
              textPath: path.posix.join(
                version,
                'text',
                viewport,
                filename.replace(/\.png$/u, '.txt'),
              ),
              viewport,
              game: game.id,
              mode,
              trial,
              step,
              filename,
            });
          }
        }
      }
    }
  }
  return frames;
}

async function exists(filename) {
  try {
    return (await stat(filename)).isFile();
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function pathExists(filename) {
  try {
    await stat(filename);
    return true;
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

async function computeSourceFingerprint() {
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
  const extensions = new Set([
    '.bin', '.css', '.glb', '.gltf', '.jpeg', '.jpg', '.json', '.png', '.svg', '.ts', '.tsx', '.webp',
  ]);
  const sourceFiles = [];
  for (const absolute of candidates) {
    if (!(await exists(absolute))) continue;
    if (!extensions.has(path.extname(absolute).toLowerCase())) continue;
    sourceFiles.push(path.relative(PROJECT_ROOT, absolute).split(path.sep).join('/'));
  }
  const files = [...new Set(sourceFiles)].sort();
  const hash = createHash('sha256');
  const fileHashes = {};
  const entries = [];
  for (const relative of files) {
    const contents = normalizeRenderSourceBytes(
      relative,
      await readFile(path.join(PROJECT_ROOT, ...relative.split('/'))),
    );
    hash.update(relative);
    hash.update('\0');
    hash.update(contents);
    hash.update('\0');
    fileHashes[relative] = createHash('sha256').update(contents).digest('hex');
    entries.push({ path: relative, sha256: fileHashes[relative] });
  }
  return {
    algorithm: 'sha256',
    files,
    entries,
    hash: hash.digest('hex'),
    fileHashes,
  };
}

function fingerprintMatches(candidate, current) {
  if (typeof candidate === 'string') return candidate === current.hash;
  if (!candidate || typeof candidate !== 'object') return false;

  if (
    candidate.algorithm === current.algorithm
    && candidate.hash === current.hash
    && JSON.stringify(candidate.files) === JSON.stringify(current.files)
  ) return true;

  const entryList = Array.isArray(candidate.entries) ? candidate.entries : candidate.files;
  if (Array.isArray(entryList)) {
    const supplied = new Map(entryList
      .filter((entry) => entry && typeof entry.path === 'string' && typeof entry.sha256 === 'string')
      .map((entry) => [entry.path.replaceAll('\\', '/'), entry.sha256.toLowerCase()]));
    if (current.files.every((relative) => supplied.get(relative) === current.fileHashes[relative])) return true;
  }
  return false;
}

function resolveCaptureTarget(record, manifest) {
  const candidates = [
    record.captureTarget,
    record.captureTarget?.selector,
    manifest?.captureTarget,
    manifest?.captureTarget?.selector,
    record.captureProtocol?.selector,
    manifest?.captureProtocol?.selector,
    record.captureKind === 'minimal-scene-pane' ? CAPTURE_TARGET : null,
  ];
  return candidates.find((value) => typeof value === 'string' && value.trim() !== '')?.trim() || null;
}

function deriveAuditPass(record, manifest) {
  if (record.auditPass === true) return { pass: true, basis: 'explicit auditPass' };
  if (
    manifest?.allScenesFullyInFrame === true
    && record.sceneFullyInFrame === true
    && record.focusCleared === true
    && record.focusStylesSuppressedForCapture === true
  ) return { pass: true, basis: 'manifest allScenesFullyInFrame + per-frame capture checks' };
  if (
    record.paneFullyInViewport === true
    && record.sceneFullyInViewport === true
    && Array.isArray(record.renderedClipped)
    && record.renderedClipped.length === 0
    && record.focusClearedBeforeCapture === true
    && record.focusStylesSuppressedForCapture === true
  ) return { pass: true, basis: 'per-frame pane/scene/focus checks' };
  return { pass: false, basis: 'no complete positive audit evidence' };
}

function validateActionButtonSymmetry(sceneQa, expectedScenario, label) {
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
    !symmetry
    || symmetry.coordinateSpace !== 'world'
    || !Number.isFinite(tolerance)
    || tolerance <= 0
    || tolerance > MAX_ACTION_BUTTON_SYMMETRY_TOLERANCE
    || symmetry.passes !== true
    || !Array.isArray(symmetry.pairs)
    || symmetry.pairs.length !== 2
  ) {
    throw new Error(`${label}: complete passing action-button symmetry evidence is required.`);
  }
  const buttons = new Map(sceneQa.buttonContainment.map((button) => [button?.id, button]));
  if (buttons.size !== 4 || expectedPairs.flatMap(({ buttonIds }) => buttonIds).some((id) => !buttons.has(id))) {
    throw new Error(`${label}: action-button symmetry evidence does not cover the canonical four controls.`);
  }
  const pointFields = ['x', 'z', 'effectiveScale'];
  const footprintFields = ['width', 'depth'];
  const pairErrorFields = [
    'mirroredXError', 'matchedZRowError', 'matchedScaleError',
    'matchedFootprintWidthError', 'matchedFootprintDepthError',
  ];
  const close = (first, second) => Number.isFinite(first) && Number.isFinite(second)
    && Math.abs(first - second) <= tolerance;
  for (let index = 0; index < expectedPairs.length; index += 1) {
    const pair = symmetry.pairs[index];
    const expected = expectedPairs[index];
    if (
      pair?.participant !== expected.participant
      || JSON.stringify(pair?.buttonIds) !== JSON.stringify(expected.buttonIds)
      || pair?.passes !== true
    ) throw new Error(`${label}: ${expected.participant} action-button pair identity/symmetry failed.`);
    for (const [pointName, id] of [['first', expected.buttonIds[0]], ['second', expected.buttonIds[1]]]) {
      const point = pair[pointName];
      const button = buttons.get(id);
      if (
        !pointFields.every((field) => Number.isFinite(point?.[field]))
        || !footprintFields.every((field) => Number.isFinite(point?.effectiveFootprint?.[field]))
        || !pointFields.every((field) => close(point[field], field === 'effectiveScale' ? button?.effectiveScale : button?.position?.[field]))
        || !footprintFields.every((field) => close(point.effectiveFootprint[field], button?.effectiveFootprint?.[field]))
      ) throw new Error(`${label}: ${expected.participant} action-button placement/footprint evidence is incomplete or stale.`);
    }
    const calculatedErrors = [
      Math.abs(pair.first.x + pair.second.x),
      Math.abs(pair.first.z - pair.second.z),
      Math.abs(pair.first.effectiveScale - pair.second.effectiveScale),
      Math.abs(pair.first.effectiveFootprint.width - pair.second.effectiveFootprint.width),
      Math.abs(pair.first.effectiveFootprint.depth - pair.second.effectiveFootprint.depth),
    ];
    if (calculatedErrors.some((error) => error > tolerance) || pairErrorFields.some((field, errorIndex) => (
      !Number.isFinite(pair[field]) || pair[field] > tolerance || !close(pair[field], calculatedErrors[errorIndex])
    ))) throw new Error(`${label}: ${expected.participant} action buttons are not mirrored with matched row, scale, and footprint.`);
  }
  const [far, near] = symmetry.pairs;
  const between = symmetry.betweenParticipants;
  const calculatedBetweenErrors = [
    Math.abs(Math.abs(far.first.x - far.second.x) - Math.abs(near.first.x - near.second.x)),
    Math.abs(((far.first.x + far.second.x) / 2) - ((near.first.x + near.second.x) / 2)),
    Math.abs(far.first.z + near.first.z),
    Math.abs(far.first.effectiveScale - near.first.effectiveScale),
    Math.abs(far.first.effectiveFootprint.width - near.first.effectiveFootprint.width),
    Math.abs(far.first.effectiveFootprint.depth - near.first.effectiveFootprint.depth),
  ];
  const betweenFields = [
    'spanXError', 'matchedCenterXError', 'mirroredZError', 'matchedScaleError',
    'matchedFootprintWidthError', 'matchedFootprintDepthError',
  ];
  if (
    !between
    || JSON.stringify(between.pairIds) !== JSON.stringify(['far', 'near'])
    || between.passes !== true
    || calculatedBetweenErrors.some((error) => error > tolerance)
    || betweenFields.some((field, errorIndex) => (
      !Number.isFinite(between[field]) || between[field] > tolerance || !close(between[field], calculatedBetweenErrors[errorIndex])
    ))
  ) throw new Error(`${label}: far/near action-button pair geometry is not equivalent.`);
}

function validateSceneQaEvidence(record, identity, label) {
  const layout = record.layout;
  if (!layout || typeof layout !== 'object' || Array.isArray(layout)) {
    throw new Error(`${label}: renderer layout evidence is required.`);
  }
  if (!Array.isArray(layout.sceneQaFailures) || layout.sceneQaFailures.length !== 0) {
    throw new Error(`${label}: sceneQaFailures must be an empty array.`);
  }
  if (layout.identityChecks?.sceneQaScenario !== true || layout.identityChecks?.sceneQaPhase !== true) {
    throw new Error(`${label}: scene QA scenario/phase identity checks must pass.`);
  }
  const sceneQa = layout.sceneQa;
  if (!sceneQa || sceneQa.schema !== 'cardiac-scene-qa' || sceneQa.schemaVersion !== 1 || sceneQa.ready !== true) {
    throw new Error(`${label}: ready cardiac-scene-qa v1 evidence is required.`);
  }
  const expectedScenario = identity.game === 'used-car' ? 'cars' : 'numbers';
  if (sceneQa.scenarioId !== expectedScenario || sceneQa.phase !== identity.step - 1) {
    throw new Error(`${label}: scene QA scenario/phase is stale.`);
  }
  if (!Array.isArray(sceneQa.violations) || sceneQa.violations.length !== 0) {
    throw new Error(`${label}: scene QA contains ${Array.isArray(sceneQa.violations) ? sceneQa.violations.length : 'unknown'} violation(s).`);
  }
  if (!Array.isArray(sceneQa.buttonContainment) || sceneQa.buttonContainment.length !== 4) {
    throw new Error(`${label}: scene QA must document exactly four action buttons.`);
  }
  for (const button of sceneQa.buttonContainment) {
    if (
      button?.contained !== true
      || !Number.isFinite(button.minimumMarginWorld)
      || (Number.isFinite(sceneQa.table?.requiredMargin) && button.minimumMarginWorld + 0.001 < sceneQa.table.requiredMargin)
    ) {
      throw new Error(`${label}: action button ${button?.id || '(unknown)'} is outside the safe tabletop margin.`);
    }
  }
  validateActionButtonSymmetry(sceneQa, expectedScenario, label);
  if (!Array.isArray(sceneQa.projected?.panels) || !Array.isArray(sceneQa.projected?.avatarHeads) || sceneQa.projected.avatarHeads.length !== 2) {
    throw new Error(`${label}: projected 3D panel/head evidence is incomplete.`);
  }
  if (sceneQa.projected.panels.some((panel) => panel?.insideCanvas !== true)) {
    throw new Error(`${label}: a projected 3D panel is clipped by the canvas.`);
  }
  if (sceneQa.projected.panels.some((panel) => (
    !Number.isFinite(panel?.requiredCanvasMarginPx)
    || panel.requiredCanvasMarginPx < 12
    || !panel.canvasMargins
    || !['left', 'top', 'right', 'bottom'].every((field) => (
      Number.isFinite(panel.canvasMargins[field])
      && panel.canvasMargins[field] + 0.001 >= panel.requiredCanvasMarginPx
    ))
  ))) {
    throw new Error(`${label}: a projected 3D panel lacks the required canvas safety margin.`);
  }
  if (!Array.isArray(sceneQa.panelAvatarSeparations) || sceneQa.panelAvatarSeparations.some((item) => item?.passes !== true)) {
    throw new Error(`${label}: panel/avatar separation validation failed.`);
  }
  if (!Array.isArray(sceneQa.panelPairSeparations) || sceneQa.panelPairSeparations.some((item) => (
    item?.passes !== true
    || !Number.isFinite(item?.overlapRatio)
    || !Number.isFinite(item?.maximumOverlapRatio)
    || item.maximumOverlapRatio > 0.001
    || item.overlapRatio > item.maximumOverlapRatio
  ))) {
    throw new Error(`${label}: panel/panel separation validation failed.`);
  }
  if (!Array.isArray(sceneQa.bubbleSeparations) || sceneQa.bubbleSeparations.length === 0 || sceneQa.bubbleSeparations.some((item) => item?.passes !== true)) {
    throw new Error(`${label}: thought-bubble/scene separation validation failed.`);
  }
}

function protocolValue(record, manifest, field) {
  return record.captureProtocol?.[field]
    ?? manifest?.captureProtocol?.[field]
    ?? record[field]
    ?? manifest?.[field];
}

function normalizeCaptureProtocol(record, manifest, label) {
  const focusSuppressed = protocolValue(record, manifest, 'focusSuppressed') === true
    || protocolValue(record, manifest, 'focusStylesSuppressedForCapture') === true;
  const activeElementBlurred = protocolValue(record, manifest, 'activeElementBlurred') === true
    || record.focusCleared === true
    || record.focusClearedBeforeCapture === true
    || record.focusAfterClear?.tag === 'BODY';
  const elapsed = Number(protocolValue(record, manifest, 'settleMs')
    ?? record.captureSettleElapsedMs);
  const settleFrames = Number(protocolValue(record, manifest, 'settleFrames')
    ?? record.captureSettleRafFrames);
  const activeRenderSettled = protocolValue(record, manifest, 'activeRenderSettled') === true;
  const settleMs = Number.isFinite(elapsed) && elapsed >= 1000
    ? elapsed
    : null;
  const scrollbarSuppressed = protocolValue(record, manifest, 'scrollbarSuppressed') === true;
  const renderer = protocolValue(record, manifest, 'renderer');
  const rendererProtocolVersion = Number(protocolValue(record, manifest, 'rendererProtocolVersion'));
  const deviceScaleFactor = Number(protocolValue(record, manifest, 'deviceScaleFactor'));
  const domEventsOnly = protocolValue(record, manifest, 'domEventsOnly') === true;
  const operatingSystemPointerUsed = protocolValue(record, manifest, 'operatingSystemPointerUsed');
  const visibleBrowserUsed = protocolValue(record, manifest, 'visibleBrowserUsed');
  const privateBrowserProfile = protocolValue(record, manifest, 'privateBrowserProfile') === true;
  const fontsReady = protocolValue(record, manifest, 'fontsReady') === true;
  const assetsReady = protocolValue(record, manifest, 'assetsReady') === true;

  if (!focusSuppressed) throw new Error(`${label}: capture protocol must suppress focus styles.`);
  if (!activeElementBlurred) throw new Error(`${label}: capture protocol must blur the active element.`);
  if (!settleMs || settleFrames < 90 || !activeRenderSettled) {
    throw new Error(`${label}: capture protocol needs >=1000 measured ms and >=90 active rAF frames.`);
  }
  if (!scrollbarSuppressed) throw new Error(`${label}: capture protocol must suppress scrollbars.`);
  if (renderer !== 'isolated-headless-edge-cdp') throw new Error(`${label}: renderer provenance is not isolated headless Edge CDP.`);
  if (rendererProtocolVersion !== 1) throw new Error(`${label}: rendererProtocolVersion must be 1.`);
  if (deviceScaleFactor !== 2.5) throw new Error(`${label}: deviceScaleFactor must be 2.5.`);
  if (!domEventsOnly || operatingSystemPointerUsed !== false || visibleBrowserUsed !== false || !privateBrowserProfile) {
    throw new Error(`${label}: renderer must use DOM events in a hidden private profile without OS pointer input.`);
  }
  if (!fontsReady || !assetsReady) throw new Error(`${label}: fonts and scene assets must be ready.`);

  return {
    selector: CAPTURE_TARGET,
    renderer,
    rendererProtocolVersion,
    deviceScaleFactor,
    domEventsOnly: true,
    operatingSystemPointerUsed: false,
    visibleBrowserUsed: false,
    privateBrowserProfile: true,
    fontsReady: true,
    assetsReady: true,
    focusSuppressed: true,
    activeElementBlurred: true,
    activeRenderSettled: true,
    settleMs,
    ...(Number.isFinite(settleFrames) ? { settleFrames } : {}),
    scrollbarSuppressed: true,
  };
}

function normalizeMode(value) {
  const normalized = String(value || '').trim().toLowerCase().replaceAll('_', '-');
  if (['aligned', 'cooperate', 'cooperative', 'collaborate', 'collaborative', 'common-interest'].includes(normalized)) {
    return 'aligned';
  }
  if (['conflicting', 'compete', 'competitive', 'opposed', 'mixed-motive'].includes(normalized)) {
    return 'conflicting';
  }
  return null;
}

function normalizeGame(value) {
  const normalized = String(value || '').trim().toLowerCase().replaceAll('_', '-').replaceAll(' ', '-');
  if (['used-car', 'used-car-salesman', 'used-car-salesman-game', 'car', 'cars'].includes(normalized)) {
    return 'used-car';
  }
  if (['number-card', 'number-cards', 'numbers', 'number'].includes(normalized)) {
    return 'number-card';
  }
  return null;
}

function normalizeViewport(value) {
  const candidate = typeof value === 'string' ? value : value?.name;
  const normalized = String(candidate || '').trim().toLowerCase();
  return MATRIX.viewports.includes(normalized) ? normalized : null;
}

function inferViewport(record, manifestPath, captureRoot) {
  const candidates = [
    normalizeViewport(record.viewport),
    ...path.relative(captureRoot, manifestPath).split(path.sep).map(normalizeViewport),
    ...String(record.path || record.screenshot || record.screenshotPath || '').split(/[\\/]/u).map(normalizeViewport),
  ].filter(Boolean);
  const unique = [...new Set(candidates)];
  if (unique.length !== 1) {
    throw new Error(`Could not infer one viewport for ${record.filename || record.path || '(unnamed frame)'}.`);
  }
  return unique[0];
}

function parseCaptureFilename(filename) {
  const match = /^(used-car|number-card)_(aligned|conflicting|cooperate|cooperative|collaborate|collaborative|compete|competitive|opposed|mixed-motive)_trial(\d{2})_step(\d{2})\.png$/iu.exec(filename);
  if (!match) return null;
  return {
    game: normalizeGame(match[1]),
    mode: normalizeMode(match[2]),
    trial: Number(match[3]),
    step: Number(match[4]),
  };
}

function firstNonEmptyString(...values) {
  return values.find((value) => typeof value === 'string' && value.trim() !== '')?.trim() || null;
}

function extractText(record) {
  const nested = record.text && typeof record.text === 'object' ? record.text : {};
  return {
    sceneStatus: firstNonEmptyString(nested.sceneStatus, record.sceneStatus, record.sceneLabel),
    thought: firstNonEmptyString(nested.thought, record.thought, record.thoughtText, record.bubbleText),
    captionTitle: firstNonEmptyString(nested.captionTitle, record.captionTitle, record.caption),
    explanation: firstNonEmptyString(nested.explanation, record.explanation),
    timing: firstNonEmptyString(nested.timing, record.timing),
    cueBadge: firstNonEmptyString(nested.cueBadge, record.cueBadge),
  };
}

function preserveAuditEvidence(record, output) {
  output.auditPass = true;
  for (const field of [
    'layout',
    'audit',
    'auditEvidence',
    'visualAudit',
    'verdict',
    'checks',
    'paneCapture',
    'element',
    'paneBoundsCss',
    'captureDimensions',
    'captureClipPageCss',
    'sceneFullyInFrame',
    'sceneFullyInViewport',
    'paneFullyInViewport',
    'renderedClipped',
  ]) {
    if (record[field] !== undefined) output[field] = record[field];
  }
  if (record.captureProtocol !== undefined) output.sourceCaptureProtocol = record.captureProtocol;
}

function canonicalIdentity(record, filenameIdentity, viewport) {
  const recordGame = normalizeGame(record.game || record.scenario || record.scenarioId);
  const recordMode = normalizeMode(record.mode || record.incentive || record.payoff);
  const game = recordGame || filenameIdentity.game;
  const mode = recordMode || filenameIdentity.mode;
  const trial = Number(record.trial ?? filenameIdentity.trial);
  const step = Number(record.step ?? record.phase ?? filenameIdentity.step);

  if (recordGame && recordGame !== filenameIdentity.game) throw new Error('Game field disagrees with filename.');
  if (recordMode && recordMode !== filenameIdentity.mode) throw new Error('Mode field disagrees with filename.');
  if (Number.isFinite(Number(record.trial)) && Number(record.trial) !== filenameIdentity.trial) {
    throw new Error('Trial field disagrees with filename.');
  }
  if (Number.isFinite(Number(record.step)) && Number(record.step) !== filenameIdentity.step) {
    throw new Error('Step field disagrees with filename.');
  }
  return { game, mode, trial, step, viewport };
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function resolveRawArtifact(manifestPath, value, expectedRelative, label) {
  if (typeof value !== 'string' || value.trim() === '' || value.includes('\0')) {
    throw new Error(`${label}: renderer artifact path must be a non-empty relative path.`);
  }
  const slashed = value.replaceAll('\\', '/');
  const normalized = path.posix.normalize(slashed);
  if (
    slashed !== value
    || normalized !== slashed
    || normalized.startsWith('/')
    || normalized.startsWith('../')
    || normalized === '..'
    || /^[a-zA-Z]:\//u.test(normalized)
  ) {
    throw new Error(`${label}: renderer artifact path is not canonical and relative: ${value}`);
  }
  if (normalized !== expectedRelative) {
    throw new Error(`${label}: expected renderer artifact path ${expectedRelative}, found ${normalized}.`);
  }
  if (path.posix.basename(normalized) !== path.posix.basename(expectedRelative)) {
    throw new Error(`${label}: renderer artifact basename is not canonical.`);
  }

  const manifestDirectory = await realpath(path.dirname(manifestPath));
  const candidate = path.resolve(manifestDirectory, ...normalized.split('/'));
  let resolved;
  try {
    resolved = await realpath(candidate);
  } catch (error) {
    if (error?.code === 'ENOENT') throw new Error(`${label}: renderer artifact does not exist: ${normalized}.`);
    throw error;
  }
  if (!isWithin(manifestDirectory, resolved)) {
    throw new Error(`${label}: renderer artifact resolves outside its manifest directory.`);
  }
  if (!(await stat(resolved)).isFile()) throw new Error(`${label}: renderer artifact is not a file.`);
  return resolved;
}

function ensureRelativeOutputPath(value, label) {
  const slashed = value.replaceAll('\\', '/');
  const normalized = path.posix.normalize(slashed);
  if (
    slashed.startsWith('/')
    || /^[a-zA-Z]:\//.test(slashed)
    || normalized === '..'
    || normalized.startsWith('../')
    || normalized !== slashed
  ) {
    throw new Error(`${label} is not a normalized relative path: ${value}`);
  }
}

function textSidecar(text) {
  return `${TEXT_FIELDS.map((field) => `${field}: ${text[field]}`).join('\n')}\n`;
}

async function publishStaging(staging, target) {
  const backup = `${target}.backup-${process.pid}-${Date.now()}`;
  const targetExists = await pathExists(target);
  const hadTarget = await exists(path.join(target, 'manifest.json'));
  if (targetExists && !hadTarget) {
    throw new Error(`Refusing to replace an unrecognized target without manifest.json: ${target}`);
  }
  await validateAssembledTree(staging);
  let targetChanged = false;
  try {
    if (hadTarget) await cp(target, backup, { recursive: true, errorOnExist: true, force: false });
    if (hadTarget) {
      await rm(target, { recursive: true, force: true });
      targetChanged = true;
    }
    targetChanged = true;
    await cp(staging, target, { recursive: true, errorOnExist: true, force: false });
    await validateAssembledTree(target);
  } catch (error) {
    if (targetChanged) await rm(target, { recursive: true, force: true });
    if (await exists(path.join(backup, 'manifest.json'))) {
      await cp(backup, target, { recursive: true, errorOnExist: true, force: false });
      await validateAssembledTree(target);
    }
    throw error;
  } finally {
    if (await exists(path.join(backup, 'manifest.json'))) await rm(backup, { recursive: true, force: true });
  }
}

async function verifyRenderedPng(record, filename, label) {
  const png = await readFile(filename);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (png.length < 24 || !png.subarray(0, 8).equals(signature)) throw new Error(`${label}: invalid PNG.`);
  const rasterWidth = png.readUInt32BE(16);
  const rasterHeight = png.readUInt32BE(20);
  const dimensions = record.captureDimensions;
  const cssWidth = Number(dimensions?.cssWidth);
  const cssHeight = Number(dimensions?.cssHeight);
  const dpr = Number(dimensions?.deviceScaleFactor);
  if (
    !Number.isFinite(cssWidth) || cssWidth <= 0
    || !Number.isFinite(cssHeight) || cssHeight <= 0
    || dpr !== 2.5
    || Number(dimensions?.rasterWidth) !== rasterWidth
    || Number(dimensions?.rasterHeight) !== rasterHeight
  ) throw new Error(`${label}: captureDimensions do not match the PNG IHDR at DPR 2.5.`);
  if (Math.abs(rasterWidth - Math.round(cssWidth * dpr)) > 2 || Math.abs(rasterHeight - Math.round(cssHeight * dpr)) > 2) {
    throw new Error(`${label}: CSS clip and PNG raster dimensions disagree.`);
  }
  const screenshotSha256 = createHash('sha256').update(png).digest('hex');
  if (!/^[a-f0-9]{64}$/u.test(record.screenshotSha256 || '') || record.screenshotSha256 !== screenshotSha256) {
    throw new Error(`${label}: screenshotSha256 does not match the rendered PNG.`);
  }
  const clip = record.captureClipPageCss;
  if (['x', 'y', 'width', 'height'].some((field) => !Number.isFinite(Number(clip?.[field])))) {
    throw new Error(`${label}: captureClipPageCss is incomplete.`);
  }
  if (Math.abs(Number(clip.width) - cssWidth) > 0.01 || Math.abs(Number(clip.height) - cssHeight) > 0.01) {
    throw new Error(`${label}: capture clip and CSS dimensions disagree.`);
  }
  return {
    captureDimensions: { cssWidth, cssHeight, deviceScaleFactor: dpr, rasterWidth, rasterHeight },
    captureClipPageCss: {
      x: Number(clip.x), y: Number(clip.y), width: Number(clip.width), height: Number(clip.height),
    },
    screenshotSha256,
  };
}

async function validateAssembledTree(directory) {
  const manifestPath = path.join(directory, 'manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not validate assembled manifest in ${directory}: ${error.message}`);
  }
  if (manifest.schemaVersion !== 1 || typeof manifest.snapshotVersion !== 'string') {
    throw new Error(`Invalid assembled manifest schema in ${directory}.`);
  }
  const expected = expectedFrames(manifest.snapshotVersion);
  if (manifest.frameCount !== expected.length || !Array.isArray(manifest.frames) || manifest.frames.length !== expected.length) {
    throw new Error(`Assembled manifest in ${directory} does not contain the complete ${expected.length}-frame matrix.`);
  }

  const expectedFiles = new Set(['manifest.json']);
  for (let index = 0; index < expected.length; index += 1) {
    const expectedFrame = expected[index];
    const record = manifest.frames[index];
    if (
      record?.filename !== expectedFrame.filename
      || record?.screenshot !== expectedFrame.screenshot
      || record?.textPath !== expectedFrame.textPath
      || record?.viewport !== expectedFrame.viewport
      || record?.game !== expectedFrame.game
      || record?.mode !== expectedFrame.mode
      || record?.trial !== expectedFrame.trial
      || record?.step !== expectedFrame.step
    ) {
      throw new Error(`Assembled frame ${index + 1} is not in canonical matrix order.`);
    }
    const localScreenshot = expectedFrame.screenshot.split('/').slice(1).join('/');
    const localText = expectedFrame.textPath.split('/').slice(1).join('/');
    expectedFiles.add(localScreenshot);
    expectedFiles.add(localText);
    const pngPath = path.join(directory, ...localScreenshot.split('/'));
    await verifyRenderedPng(record, pngPath, `assembled ${expectedFrame.screenshot}`);
    const actualText = (await readFile(path.join(directory, ...localText.split('/')), 'utf8')).replaceAll('\r\n', '\n');
    if (actualText.includes('\r') || actualText !== textSidecar(record.text)) {
      throw new Error(`Assembled text sidecar differs from its canonical six fields: ${expectedFrame.textPath}.`);
    }
  }

  const actualFiles = (await listFiles(directory))
    .map((filename) => path.relative(directory, filename).split(path.sep).join('/'))
    .sort();
  if (actualFiles.length !== expectedFiles.size) {
    throw new Error(`Assembled tree in ${directory} must contain exactly ${expectedFiles.size} artifacts, found ${actualFiles.length}.`);
  }
  for (const filename of actualFiles) {
    if (!expectedFiles.has(filename)) throw new Error(`Unexpected assembled artifact: ${filename}.`);
  }
  for (const filename of expectedFiles) {
    if (!actualFiles.includes(filename)) throw new Error(`Missing assembled artifact: ${filename}.`);
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const sourceFingerprint = await computeSourceFingerprint();
  const expected = expectedFrames(options.version);
  const expectedByKey = new Map(expected.map((frame) => [frame.key, frame]));
  if (path.basename(options.manifest).toLowerCase() !== 'render-manifest.json') {
    throw new Error('The assembler accepts only an explicit render-manifest.json from the headless renderer.');
  }
  if (!(await exists(options.manifest))) throw new Error(`Headless render manifest not found: ${options.manifest}`);
  const manifestFiles = [options.manifest];

  const assembled = new Map();
  let relevantManifestCount = 0;
  for (const manifestPath of manifestFiles) {
    let manifest;
    try {
      manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    } catch (error) {
      throw new Error(`Could not parse ${manifestPath}: ${error.message}`);
    }
    if (manifest?.schema !== 'cardiac-scene-render-manifest' || manifest?.schemaVersion !== 1) {
      throw new Error(`${manifestPath}: unsupported renderer manifest schema.`);
    }
    if (manifest.completeMatrix !== true || manifest.frameCount !== 240 || manifest.expectedFrameCount !== 240) {
      throw new Error(`${manifestPath}: only a complete 240-frame background render can be assembled.`);
    }
    if (
      manifest.fixedState?.cueSource !== 'live'
      || manifest.fixedState?.cueWindow !== 'both'
      || manifest.fixedState?.autoAdvance !== false
    ) throw new Error(`${manifestPath}: fixed capture state must be live/both/autoAdvance=false.`);
    const records = manifest.frames;
    relevantManifestCount += 1;

    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      const label = `${path.relative(options.captureRoot, manifestPath)}#${index + 1}`;
      const fingerprints = [
        record.sourceFingerprint,
        record.renderSourceFingerprint,
        manifest?.sourceFingerprint,
        manifest?.renderSourceFingerprint,
      ].filter(Boolean);
      if (!fingerprints.some((fingerprint) => fingerprintMatches(fingerprint, sourceFingerprint))) {
        throw new Error(`${label}: sourceFingerprint does not match the current frozen source.`);
      }
      const sourceName = path.basename(record.filename || record.path || record.screenshot || record.screenshotPath || '');
      const filenameIdentity = parseCaptureFilename(sourceName);
      if (!filenameIdentity) throw new Error(`${label}: unsupported screenshot filename ${sourceName || '(empty)'}.`);
      const viewport = inferViewport(record, manifestPath, options.captureRoot);
      let identity;
      try {
        identity = canonicalIdentity(record, filenameIdentity, viewport);
      } catch (error) {
        throw new Error(`${label}: ${error.message}`);
      }
      const canonicalFilename = `${identity.game}_${identity.mode}_trial${pad2(identity.trial)}_step${pad2(identity.step)}.png`;
      const key = `${identity.viewport}/${canonicalFilename}`;
      const expectedFrame = expectedByKey.get(key);
      if (!expectedFrame) throw new Error(`${label}: frame is outside the expected matrix (${key}).`);
      if (assembled.has(key)) {
        throw new Error(`${label}: duplicate frame ${key}; first seen in ${assembled.get(key).sourceManifest}.`);
      }
      const audit = deriveAuditPass(record, manifest);
      if (!audit.pass) throw new Error(`${label}: ${audit.basis}; frame is not eligible for the frozen baseline.`);
      validateSceneQaEvidence(record, identity, label);
      const captureTarget = resolveCaptureTarget(record, manifest);
      if (captureTarget !== CAPTURE_TARGET) {
        throw new Error(`${label}: captureTarget must be ${CAPTURE_TARGET}.`);
      }
      const captureProtocol = normalizeCaptureProtocol(record, manifest, label);
      if (record.cueSource !== 'live' || record.cueWindow !== 'both' || record.autoAdvance !== false) {
        throw new Error(`${label}: frame capture state must be cueSource=live, cueWindow=both, autoAdvance=false.`);
      }

      const text = extractText(record);
      const missingText = TEXT_FIELDS.filter((field) => !text[field]);
      if (missingText.length > 0) throw new Error(`${label}: missing text fields: ${missingText.join(', ')}.`);
      if (record.filename !== canonicalFilename) {
        throw new Error(`${label}: filename must be the canonical basename ${canonicalFilename}.`);
      }
      const expectedRawScreenshot = `${identity.viewport}/${canonicalFilename}`;
      const expectedRawText = `text/${identity.viewport}/${canonicalFilename.replace(/\.png$/u, '.txt')}`;
      const sourcePng = await resolveRawArtifact(
        manifestPath,
        record.screenshot,
        expectedRawScreenshot,
        `${label}.screenshot`,
      );
      const sourceText = await resolveRawArtifact(
        manifestPath,
        record.textPath,
        expectedRawText,
        `${label}.textPath`,
      );
      const rawText = (await readFile(sourceText, 'utf8')).replaceAll('\r\n', '\n');
      if (rawText.includes('\r') || rawText !== textSidecar(text)) {
        throw new Error(`${label}: raw text sidecar does not exactly equal the manifest's canonical six text fields.`);
      }
      const renderedPng = await verifyRenderedPng(record, sourcePng, label);

      const frame = {
        filename: expectedFrame.filename,
        screenshot: expectedFrame.screenshot,
        textPath: expectedFrame.textPath,
        game: identity.game,
        trial: identity.trial,
        mode: identity.mode,
        step: identity.step,
        viewport: identity.viewport,
        cueSource: 'live',
        cueWindow: 'both',
        autoAdvance: false,
        captureTarget: CAPTURE_TARGET,
        captureProtocol,
        auditPass: true,
        sourceAuditEvidence: audit.basis,
        ...renderedPng,
        text,
      };
      preserveAuditEvidence(record, frame);
      assembled.set(key, {
        frame,
        sourcePng,
        sourceManifest: path.relative(options.captureRoot, manifestPath).split(path.sep).join('/'),
      });
    }
  }

  if (relevantManifestCount !== 1) throw new Error('Exactly one explicit renderer manifest is required.');

  const missing = expected.filter((frame) => !assembled.has(frame.key));
  if (missing.length > 0) {
    throw new Error(`Capture matrix is incomplete: ${missing.length} frame(s) missing. First: ${missing.slice(0, 8).map((frame) => frame.key).join(', ')}`);
  }
  if (assembled.size !== expected.length) {
    throw new Error(`Expected ${expected.length} unique frames, found ${assembled.size}.`);
  }

  const orderedFrames = expected.map((expectedFrame) => assembled.get(expectedFrame.key));
  const screenshotPaths = new Set();
  const textPaths = new Set();
  for (const { frame } of orderedFrames) {
    ensureRelativeOutputPath(frame.screenshot, 'screenshot');
    ensureRelativeOutputPath(frame.textPath, 'textPath');
    if (screenshotPaths.has(frame.screenshot)) throw new Error(`Duplicate output screenshot: ${frame.screenshot}`);
    if (textPaths.has(frame.textPath)) throw new Error(`Duplicate output text sidecar: ${frame.textPath}`);
    screenshotPaths.add(frame.screenshot);
    textPaths.add(frame.textPath);
  }

  await mkdir(options.outputRoot, { recursive: true });
  const target = path.join(options.outputRoot, options.version);
  const staging = path.join(options.outputRoot, `.${options.version}-staging-${process.pid}-${Date.now()}`);
  const expectedTarget = path.resolve(options.outputRoot, options.version);
  if (path.resolve(target) !== expectedTarget || path.dirname(expectedTarget) !== path.resolve(options.outputRoot)) {
    throw new Error('Refusing to assemble outside the requested version directory.');
  }
  if (await exists(path.join(target, 'manifest.json')) && !options.force) {
    throw new Error(`${target} already exists. Re-run with --force to replace it after staging succeeds.`);
  }

  await rm(staging, { recursive: true, force: true });
  try {
    for (const { frame, sourcePng } of orderedFrames) {
      const stagedScreenshot = path.join(staging, ...frame.screenshot.split('/').slice(1));
      const stagedText = path.join(staging, ...frame.textPath.split('/').slice(1));
      await mkdir(path.dirname(stagedScreenshot), { recursive: true });
      await mkdir(path.dirname(stagedText), { recursive: true });
      await copyFile(sourcePng, stagedScreenshot);
      await writeFile(stagedText, textSidecar(frame.text), 'utf8');
    }

    const manifest = {
      schemaVersion: 1,
      snapshotVersion: options.version,
      sourceFingerprint: {
        algorithm: sourceFingerprint.algorithm,
        files: sourceFingerprint.files,
        entries: sourceFingerprint.entries,
        hash: sourceFingerprint.hash,
      },
      renderSourceFingerprint: {
        algorithm: sourceFingerprint.algorithm,
        files: sourceFingerprint.files,
        entries: sourceFingerprint.entries,
        hash: sourceFingerprint.hash,
      },
      captureTarget: CAPTURE_TARGET,
      captureProtocol: {
        renderer: 'isolated-headless-edge-cdp',
        rendererProtocolVersion: 1,
        selector: CAPTURE_TARGET,
        deviceScaleFactor: 2.5,
        uniformDeviceScaleFactor: true,
        focusSuppressed: true,
        activeElementBlurred: true,
        activeRenderSettled: true,
        settleFrames: 90,
        minimumSettleMs: 1000,
        scrollbarSuppressed: true,
        phoneScrollbarSuppressed: true,
        domEventsOnly: true,
        operatingSystemPointerUsed: false,
        visibleBrowserUsed: false,
        privateBrowserProfile: true,
        fontsReady: true,
        assetsReady: true,
        measuredSettle: true,
      },
      fixedState: { cueSource: 'live', cueWindow: 'both', autoAdvance: false },
      assembledAt: new Date().toISOString(),
      frameCount: orderedFrames.length,
      frames: orderedFrames.map(({ frame }) => frame),
    };
    await writeFile(path.join(staging, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    await publishStaging(staging, target);
    await rm(staging, { recursive: true, force: true });
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }

  console.log(`Assembled ${orderedFrames.length} scene snapshots.`);
  console.log(`Manifest fragments: ${relevantManifestCount}`);
  console.log(`Output: ${target}`);
  console.log('Run npm run qa:screenshots:validate to validate the frozen baseline.');
}

main().catch((error) => {
  console.error(`Scene snapshot assembly failed: ${error.message}`);
  process.exitCode = 1;
});
