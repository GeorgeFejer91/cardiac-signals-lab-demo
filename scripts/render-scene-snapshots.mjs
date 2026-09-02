#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeRenderSourceBytes } from './render-source-bytes.mjs';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUTPUT_ROOT = path.join(
  PROJECT_ROOT,
  'tmp',
  'qa',
  'readability-full-matrix',
  'headless-renderer',
);
const DEFAULT_PREFLIGHT_OUTPUT_ROOT = path.join(
  PROJECT_ROOT,
  'tmp',
  'qa',
  'readability-full-matrix',
  'headless-renderer-preflight',
);
const CAPTURE_TARGET = '.minimal-scene-pane';
const RENDER_MANIFEST = 'render-manifest.json';
const PREFLIGHT_REPORT = 'preflight-report.json';
const DPR = 2.5;
const SETTLE_FRAMES = 90;
const MAX_RENDER_WORKERS = 4;
const RENDERER_PROTOCOL_VERSION = 1;
const VIEWPORTS = {
  desktop: { width: 1200, height: 1180, mobile: false },
  phone: { width: 390, height: 1500, mobile: true },
};
const GAMES = {
  'used-car': { triggerText: 'Used Car Salesman Game', trials: 6, scenarioId: 'cars' },
  'number-card': { triggerText: 'Number-Card Game', trials: 4, scenarioId: 'numbers' },
};
const MODES = {
  aligned: 'Aligned',
  conflicting: 'Conflicting',
};
const REQUIRED_TEXT_FIELDS = [
  'sceneStatus',
  'thought',
  'captionTitle',
  'explanation',
  'timing',
  'cueBadge',
];

function sameResolvedPath(first, second) {
  const normalize = (value) => {
    const resolved = path.resolve(value);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  };
  return normalize(first) === normalize(second);
}

function parseArguments(argv) {
  const options = {
    outputRoot: DEFAULT_OUTPUT_ROOT,
    dpr: DPR,
    settleFrames: SETTLE_FRAMES,
    build: true,
    url: null,
    smoke: false,
    preflight: false,
    force: false,
    outputRootExplicit: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--output-root') {
      options.outputRoot = path.resolve(argv[index + 1] || '');
      options.outputRootExplicit = true;
      index += 1;
    } else if (argument === '--url') {
      options.url = argv[index + 1] || '';
      index += 1;
    } else if (argument === '--skip-build') {
      options.build = false;
    } else if (argument === '--smoke') {
      options.smoke = true;
    } else if (argument === '--preflight') {
      options.preflight = true;
    } else if (argument === '--force') {
      options.force = true;
    } else if (argument === '--dpr') {
      options.dpr = Number(argv[index + 1]);
      index += 1;
    } else if (argument === '--settle-frames') {
      options.settleFrames = Number(argv[index + 1]);
      index += 1;
    } else if (argument === '--help' || argument === '-h') {
      console.log([
        'Usage: node scripts/render-scene-snapshots.mjs [options]',
        '',
        'Options:',
        '  --output-root PATH   Raw renderer output directory',
        '  --url URL            Render an already-running URL (still in isolated headless Edge)',
        '  --skip-build         Reuse the existing local production build',
        '  --smoke              Render five representative frames per viewport instead of all 240',
        '  --preflight          Audit all 240 states, write one report, and capture no PNGs',
        '  --force              Replace an existing renderer output directory after staging succeeds',
        '  --dpr NUMBER         Device scale factor (canonical value: 2.5)',
        '  --settle-frames N    Active requestAnimationFrame settling (minimum: 90)',
      ].join('\n'));
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!Number.isFinite(options.dpr) || options.dpr <= 0) {
    throw new Error('--dpr must be a positive number.');
  }
  if (!Number.isInteger(options.settleFrames) || options.settleFrames < SETTLE_FRAMES) {
    throw new Error(`--settle-frames must be an integer of at least ${SETTLE_FRAMES}.`);
  }
  if (options.url !== null && !/^https?:\/\//iu.test(options.url)) {
    throw new Error('--url must be an http(s) URL.');
  }
  if (options.preflight && options.smoke) {
    throw new Error('--preflight always audits the complete 240-state matrix and cannot be combined with --smoke.');
  }
  if (options.preflight && !options.outputRootExplicit) {
    options.outputRoot = DEFAULT_PREFLIGHT_OUTPUT_ROOT;
  }
  if (options.preflight && sameResolvedPath(options.outputRoot, DEFAULT_OUTPUT_ROOT)) {
    throw new Error('--preflight output cannot replace the normal raw-render directory. Use its separate preflight directory.');
  }
  if (!options.preflight && sameResolvedPath(options.outputRoot, DEFAULT_PREFLIGHT_OUTPUT_ROOT)) {
    throw new Error('Normal render output cannot replace the preflight directory. Use a separate raw-render directory.');
  }
  return options;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function exists(filename) {
  try {
    await access(filename);
    return true;
  } catch {
    return false;
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

async function captureSourceFiles() {
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
  const files = [];
  for (const absolute of candidates) {
    if (!(await exists(absolute))) continue;
    const info = await stat(absolute);
    if (!info.isFile() || !extensions.has(path.extname(absolute).toLowerCase())) continue;
    files.push(path.relative(PROJECT_ROOT, absolute).split(path.sep).join('/'));
  }
  return [...new Set(files)].sort();
}

async function fingerprint(files) {
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

function runNode(args, { label, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: PROJECT_ROOT,
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0 && !signal) resolve({ stdout, stderr });
      else reject(new Error(`${label || args[0]} failed (${signal || `exit ${code}`}).`));
    });
  });
}

async function availablePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function startProductionServer({ build }) {
  const vinextCli = path.join(PROJECT_ROOT, 'node_modules', 'vinext', 'dist', 'cli.js');
  if (!(await exists(vinextCli))) throw new Error('vinext is not installed; run npm ci first.');
  if (build) await runNode([vinextCli, 'build'], { label: 'Production build' });
  const port = await availablePort();
  const child = spawn(
    process.execPath,
    [vinextCli, 'start', '--port', String(port), '--hostname', '127.0.0.1'],
    {
      cwd: PROJECT_ROOT,
      env: { ...process.env, NODE_ENV: 'production' },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const logs = [];
  child.stdout.on('data', (chunk) => logs.push(chunk.toString()));
  child.stderr.on('data', (chunk) => logs.push(chunk.toString()));
  child.once('error', (error) => logs.push(`server error: ${error.message}`));
  const url = `http://127.0.0.1:${port}/`;
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Local renderer server exited early. ${logs.join('').trim()}`);
    }
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) return { child, url, logs };
    } catch {
      // The private loopback server is still starting.
    }
    await sleep(200);
  }
  throw new Error(`Timed out waiting for ${url}. ${logs.join('').trim()}`);
}

async function stopProcessTree(child) {
  if (!child || child.exitCode !== null || !child.pid) return;
  child.kill();
  const exited = await Promise.race([
    new Promise((resolve) => child.once('exit', () => resolve(true))),
    sleep(2500).then(() => false),
  ]);
  if (exited || process.platform !== 'win32') return;
  await new Promise((resolve) => {
    const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    killer.once('error', () => resolve());
    killer.once('exit', () => resolve());
  });
}

async function findBrowser() {
  const configured = process.env.SCENE_RENDER_BROWSER;
  const candidates = [
    configured,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  throw new Error('No Edge/Chromium browser found. Set SCENE_RENDER_BROWSER to its executable.');
}

async function launchHeadlessBrowser() {
  const executable = await findBrowser();
  const profile = await mkdtemp(path.join(os.tmpdir(), 'cardiac-scene-render-'));
  const child = spawn(executable, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=Translate,OptimizationHints,MediaRouter',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
    '--mute-audio',
    'about:blank',
  ], {
    cwd: PROJECT_ROOT,
    windowsHide: true,
    stdio: 'ignore',
  });
  const activePortPath = path.join(profile, 'DevToolsActivePort');
  const deadline = Date.now() + 25_000;
  let port = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Headless browser exited before CDP became available.');
    try {
      const [line] = (await readFile(activePortPath, 'utf8')).trim().split(/\r?\n/u);
      if (/^\d+$/u.test(line)) {
        port = Number(line);
        break;
      }
    } catch {
      // The browser writes DevToolsActivePort after initializing its private profile.
    }
    await sleep(100);
  }
  if (!port) throw new Error('Timed out waiting for the hidden browser CDP endpoint.');
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  return { child, profile, port, executable, browserWebSocketUrl: version.webSocketDebuggerUrl, version };
}

class CdpClient {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', () => reject(new Error(`Could not connect to CDP: ${url}`)), { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const raw = typeof event.data === 'string' ? event.data : Buffer.from(event.data).toString('utf8');
      const message = JSON.parse(raw);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result || {});
        return;
      }
      for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
    });
    this.socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) pending.reject(new Error('CDP connection closed.'));
      this.pending.clear();
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId;
    this.nextId += 1;
    return await new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) || [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  close() {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.close();
  }
}

async function createPage(browserPort, url) {
  const response = await fetch(
    `http://127.0.0.1:${browserPort}/json/new?${encodeURIComponent(url)}`,
    { method: 'PUT' },
  );
  if (!response.ok) throw new Error(`CDP could not create a private page (${response.status}).`);
  const target = await response.json();
  return { target, client: new CdpClient(target.webSocketDebuggerUrl) };
}

async function evaluate(client, expression, { awaitPromise = false } = {}) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: false,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Page evaluation failed.');
  }
  return result.result?.value;
}

async function waitForPage(client) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const ready = await evaluate(client, `document.readyState === 'complete' && Boolean(document.querySelector('.scenario-accordion'))`);
      if (ready) return;
    } catch {
      // Navigation swaps the execution context while the page is loading.
    }
    await sleep(100);
  }
  throw new Error('Timed out waiting for the scenario page.');
}

async function waitForSelector(client, selector, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(client, `Boolean(document.querySelector(${JSON.stringify(selector)}))`)) return;
    await sleep(50);
  }
  throw new Error(`Timed out waiting for ${selector}.`);
}

async function installCaptureCss(client) {
  await evaluate(client, `(() => {
    const id = 'headless-scene-capture-protocol';
    document.getElementById(id)?.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = [
      '*:focus, *:focus-visible { outline: none !important; outline-offset: 0 !important; box-shadow: none !important; }',
      'html, body { scrollbar-width: none !important; }',
      '*::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }'
    ].join('\\n');
    document.head.append(style);
    document.documentElement.dataset.sceneCapture = 'headless-cdp-v1';
    return true;
  })()`);
}

async function clickByText(client, selector, text) {
  const result = await evaluate(client, `(() => {
    const wanted = ${JSON.stringify(text)};
    const element = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find((candidate) => [candidate.textContent, candidate.getAttribute('aria-label')]
        .filter(Boolean)
        .some((value) => value.trim().includes(wanted)));
    if (!element) return { ok: false, reason: 'not found', wanted };
    element.click();
    return { ok: true, text: element.textContent?.trim() || '' };
  })()`);
  if (!result?.ok) throw new Error(`Could not click ${selector} containing “${text}”.`);
}

async function ensureScenarioOpen(client, text) {
  const result = await evaluate(client, `(() => {
    const wanted = ${JSON.stringify(text)};
    const element = [...document.querySelectorAll('.scenario-accordion-trigger')]
      .find((candidate) => candidate.textContent?.trim().includes(wanted));
    if (!element) return { ok: false, reason: 'not found' };
    if (element.getAttribute('aria-expanded') !== 'true') element.click();
    return { ok: true };
  })()`);
  if (!result?.ok) throw new Error(`Could not open the “${text}” scenario.`);
}

async function setSelect(client, labelText, value) {
  const result = await evaluate(client, `(() => {
    const label = [...document.querySelectorAll('label.storyboard-select')]
      .find((candidate) => candidate.querySelector('span')?.textContent?.trim() === ${JSON.stringify(labelText)});
    const select = label?.querySelector('select');
    if (!select) return { ok: false };
    select.value = ${JSON.stringify(value)};
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: select.value === ${JSON.stringify(value)}, value: select.value };
  })()`);
  if (!result?.ok) throw new Error(`Could not set ${labelText} to ${value}.`);
}

async function settleActiveRender(client, frames) {
  return await evaluate(client, `new Promise((resolve) => {
    const started = performance.now();
    let count = 0;
    const tick = () => {
      count += 1;
      const elapsedMs = performance.now() - started;
      if (count >= ${Number(frames)} && elapsedMs >= 1000) {
        resolve({ frames: count, elapsedMs });
      } else {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  })`, { awaitPromise: true });
}

function frameFilename(game, mode, trial, step) {
  return `${game}_${mode}_trial${pad2(trial)}_step${pad2(step)}.png`;
}

function parsePngDimensions(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature)) {
    throw new Error('CDP returned an invalid PNG.');
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function inspectPane(client) {
  return await evaluate(client, `(() => {
    const pane = document.querySelector(${JSON.stringify(CAPTURE_TARGET)});
    if (!pane) return { ok: false, reason: 'capture target missing' };
    const paneRect = pane.getBoundingClientRect();
    const absoluteRect = {
      x: paneRect.left + window.scrollX,
      y: paneRect.top + window.scrollY,
      width: paneRect.width,
      height: paneRect.height,
    };
    const rect = (element) => {
      const value = element.getBoundingClientRect();
      return { x: value.left, y: value.top, width: value.width, height: value.height, right: value.right, bottom: value.bottom };
    };
    const inside = (child, parent, tolerance = 1.25) => (
      child.x >= parent.x - tolerance
      && child.y >= parent.y - tolerance
      && child.right <= parent.right + tolerance
      && child.bottom <= parent.bottom + tolerance
    );
    const visible = (element) => {
      const styles = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return styles.display !== 'none' && styles.visibility !== 'hidden' && Number(styles.opacity) > 0 && bounds.width > 0 && bounds.height > 0;
    };
    const overlapRatio = (first, second) => {
      const width = Math.max(0, Math.min(first.right, second.right) - Math.max(first.x, second.x));
      const height = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.y, second.y));
      const smallerArea = Math.min(first.width * first.height, second.width * second.height);
      return smallerArea > 0 ? (width * height) / smallerArea : 0;
    };
    const sceneElement = pane.querySelector('.storyboard-scene');
    let sceneQa = null;
    let sceneQaParseError = '';
    try {
      sceneQa = sceneElement?.dataset.sceneQa ? JSON.parse(sceneElement.dataset.sceneQa) : null;
    } catch (error) {
      sceneQaParseError = error instanceof Error ? error.message : String(error);
    }
    const bubbleSeparations = [];
    const projectedPanels = Array.isArray(sceneQa?.projected?.panels) ? sceneQa.projected.panels : [];
    const projectedHeads = Array.isArray(sceneQa?.projected?.avatarHeads) ? sceneQa.projected.avatarHeads : [];
    for (const bubble of pane.querySelectorAll('.storyboard-bubble')) {
      if (!visible(bubble)) continue;
      const bubbleBounds = rect(bubble);
      const copy = bubble.querySelector('.bubble-copy');
      const copyBounds = copy && visible(copy) ? rect(copy) : bubbleBounds;
      const bubbleId = bubble.classList.contains('player-a') ? 'player-a' : 'player-b';
      for (const panel of projectedPanels) {
        const outerRatio = overlapRatio(bubbleBounds, panel);
        const copyRatio = overlapRatio(copyBounds, panel);
        bubbleSeparations.push({
          bubble: bubbleId,
          target: panel.id,
          targetKind: 'panel',
          outerOverlapRatio: outerRatio,
          copyOverlapRatio: copyRatio,
          maximumOuterOverlapRatio: 0.08,
          maximumCopyOverlapRatio: 0.001,
          passes: outerRatio <= 0.08 && copyRatio <= 0.001,
        });
      }
      for (const head of projectedHeads) {
        const copyRatio = overlapRatio(copyBounds, head);
        bubbleSeparations.push({
          bubble: bubbleId,
          target: head.id,
          targetKind: 'avatar-head',
          outerOverlapRatio: overlapRatio(bubbleBounds, head),
          copyOverlapRatio: copyRatio,
          maximumOuterOverlapRatio: 1,
          maximumCopyOverlapRatio: 0.001,
          passes: copyRatio <= 0.001,
        });
      }
    }
    const sceneQaFailures = [];
    if (sceneQaParseError) sceneQaFailures.push('scene-qa-json-invalid:' + sceneQaParseError);
    if (!sceneQa) sceneQaFailures.push('scene-qa-missing');
    if (sceneQa && (sceneQa.schema !== 'cardiac-scene-qa' || sceneQa.schemaVersion !== 1 || sceneQa.ready !== true)) {
      sceneQaFailures.push('scene-qa-not-ready');
    }
    if (!Array.isArray(sceneQa?.buttonContainment) || sceneQa.buttonContainment.length !== 4) {
      sceneQaFailures.push('button-containment-incomplete');
    } else {
      for (const button of sceneQa.buttonContainment) {
        if (button.contained !== true) sceneQaFailures.push('button-outside-table:' + String(button.id || 'unknown'));
      }
    }
    const buttonSymmetry = sceneQa?.actionButtonSymmetry;
    const expectedButtonPairs = sceneQa?.scenarioId === 'cars'
      ? [
          { participant: 'far', buttonIds: ['seller-recommend-buy', 'seller-recommend-pass'] },
          { participant: 'near', buttonIds: ['buyer-buy', 'buyer-pass'] },
        ]
      : sceneQa?.scenarioId === 'numbers'
        ? [
            { participant: 'far', buttonIds: ['informed-a', 'informed-b'] },
            { participant: 'near', buttonIds: ['less-informed-a', 'less-informed-b'] },
          ]
        : null;
    const symmetryTolerance = Number(buttonSymmetry?.tolerance);
    const symmetryErrorFields = [
      'mirroredXError', 'matchedZRowError', 'matchedScaleError',
      'matchedFootprintWidthError', 'matchedFootprintDepthError'
    ];
    if (
      !buttonSymmetry
      || buttonSymmetry.coordinateSpace !== 'world'
      || !Number.isFinite(symmetryTolerance)
      || symmetryTolerance <= 0
      || symmetryTolerance > 0.002
      || buttonSymmetry.passes !== true
      || !Array.isArray(buttonSymmetry.pairs)
      || buttonSymmetry.pairs.length !== 2
      || !expectedButtonPairs
      || !Array.isArray(sceneQa?.buttonContainment)
      || sceneQa.buttonContainment.length !== 4
    ) {
      sceneQaFailures.push('button-symmetry-incomplete');
    } else {
      const buttonMap = new Map(sceneQa.buttonContainment.map((button) => [button?.id, button]));
      const close = (first, second) => Number.isFinite(first) && Number.isFinite(second)
        && Math.abs(first - second) <= symmetryTolerance;
      let symmetryPairsPass = buttonMap.size === 4;
      for (let pairIndex = 0; pairIndex < expectedButtonPairs.length; pairIndex += 1) {
        const pair = buttonSymmetry.pairs[pairIndex];
        const expected = expectedButtonPairs[pairIndex];
        const idsMatch = JSON.stringify(pair?.buttonIds) === JSON.stringify(expected.buttonIds);
        let pairPass = pair?.participant === expected.participant && idsMatch && pair?.passes === true;
        for (const [pointName, id] of [['first', expected.buttonIds[0]], ['second', expected.buttonIds[1]]]) {
          const point = pair?.[pointName];
          const button = buttonMap.get(id);
          pairPass = pairPass
            && ['x', 'z', 'effectiveScale'].every((field) => Number.isFinite(point?.[field]))
            && ['width', 'depth'].every((field) => Number.isFinite(point?.effectiveFootprint?.[field]))
            && ['x', 'z', 'effectiveScale'].every((field) => close(
              point?.[field], field === 'effectiveScale' ? button?.effectiveScale : button?.position?.[field]
            ))
            && ['width', 'depth'].every((field) => close(point?.effectiveFootprint?.[field], button?.effectiveFootprint?.[field]));
        }
        if (pairPass) {
          const calculatedErrors = [
            Math.abs(pair.first.x + pair.second.x),
            Math.abs(pair.first.z - pair.second.z),
            Math.abs(pair.first.effectiveScale - pair.second.effectiveScale),
            Math.abs(pair.first.effectiveFootprint.width - pair.second.effectiveFootprint.width),
            Math.abs(pair.first.effectiveFootprint.depth - pair.second.effectiveFootprint.depth)
          ];
          pairPass = calculatedErrors.every((error) => error <= symmetryTolerance)
            && symmetryErrorFields.every((field, errorIndex) => (
              Number.isFinite(pair[field])
              && pair[field] <= symmetryTolerance
              && close(pair[field], calculatedErrors[errorIndex])
            ));
        }
        if (!pairPass) {
          symmetryPairsPass = false;
          sceneQaFailures.push('button-pair-asymmetric:' + expected.participant);
        }
      }
      const between = buttonSymmetry.betweenParticipants;
      const betweenErrorFields = [
        'spanXError', 'matchedCenterXError', 'mirroredZError', 'matchedScaleError',
        'matchedFootprintWidthError', 'matchedFootprintDepthError'
      ];
      const [far, near] = buttonSymmetry.pairs;
      const calculatedBetweenErrors = symmetryPairsPass ? [
        Math.abs(Math.abs(far.first.x - far.second.x) - Math.abs(near.first.x - near.second.x)),
        Math.abs(((far.first.x + far.second.x) / 2) - ((near.first.x + near.second.x) / 2)),
        Math.abs(far.first.z + near.first.z),
        Math.abs(far.first.effectiveScale - near.first.effectiveScale),
        Math.abs(far.first.effectiveFootprint.width - near.first.effectiveFootprint.width),
        Math.abs(far.first.effectiveFootprint.depth - near.first.effectiveFootprint.depth)
      ] : [];
      if (
        !symmetryPairsPass
        || !between
        || JSON.stringify(between.pairIds) !== JSON.stringify(['far', 'near'])
        || between.passes !== true
        || !calculatedBetweenErrors.every((error) => error <= symmetryTolerance)
        || !betweenErrorFields.every((field, errorIndex) => (
          Number.isFinite(between[field])
          && between[field] <= symmetryTolerance
          && close(between[field], calculatedBetweenErrors[errorIndex])
        ))
      ) {
        sceneQaFailures.push('button-pairs-not-equivalent');
      }
    }
    if (!Array.isArray(sceneQa?.projected?.avatarHeads) || sceneQa.projected.avatarHeads.length !== 2) {
      sceneQaFailures.push('avatar-projections-incomplete');
    }
    if (!Array.isArray(sceneQa?.panelPairSeparations)) {
      sceneQaFailures.push('panel-pair-separations-missing');
    } else {
      for (const separation of sceneQa.panelPairSeparations) {
        if (
          separation?.passes !== true
          || !Number.isFinite(separation?.overlapRatio)
          || !Number.isFinite(separation?.maximumOverlapRatio)
          || separation.maximumOverlapRatio > 0.001
          || separation.overlapRatio > separation.maximumOverlapRatio
        ) {
          sceneQaFailures.push('panel-overlap:' + String(separation?.firstPanel || 'unknown') + ':' + String(separation?.secondPanel || 'unknown'));
        }
      }
    }
    if (Array.isArray(sceneQa?.violations)) sceneQaFailures.push(...sceneQa.violations.map(String));
    else if (sceneQa) sceneQaFailures.push('scene-qa-violations-missing');
    for (const separation of bubbleSeparations) {
      if (!separation.passes) sceneQaFailures.push('bubble-overlap:' + separation.bubble + ':' + separation.target);
    }
    const boundedSelectors = [
      '.storyboard-toolbar', '.storyboard-scene', '.storyboard-scene canvas', '.scene-status',
      '.storyboard-bubble', '.cue-window-badge', '.storyboard-caption', '.storyboard-navigation'
    ];
    const paneBounds = rect(pane);
    const boundsFailures = [];
    for (const selector of boundedSelectors) {
      for (const element of pane.querySelectorAll(selector)) {
        if (visible(element) && !inside(rect(element), paneBounds)) boundsFailures.push(selector);
      }
    }
    const textSelectors = [
      '.storyboard-toolbar button', '.storyboard-select span', '.storyboard-select select',
      '.scene-status', '.storyboard-bubble .bubble-copy', '.cue-window-badge',
      '.storyboard-caption h2', '.storyboard-caption p', '.storyboard-caption time',
      '.storyboard-progress > span', '.storyboard-progress > strong', '.auto-advance'
    ];
    const textOverflow = [];
    const textMetrics = [];
    for (const selector of textSelectors) {
      for (const element of pane.querySelectorAll(selector)) {
        if (!visible(element)) continue;
        const styles = getComputedStyle(element);
        textMetrics.push({
          selector,
          text: element.textContent?.trim() || '',
          fontSizePx: Number.parseFloat(styles.fontSize),
          lineHeightPx: Number.parseFloat(styles.lineHeight),
          bounds: rect(element),
        });
        if (element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2) {
          textOverflow.push({ selector, text: element.textContent?.trim() || '', scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight });
        }
      }
    }
    const bubbleText = [...pane.querySelectorAll('.storyboard-bubble svg[aria-label]')]
      .filter(visible)
      .map((element) => element.getAttribute('aria-label')?.trim())
      .filter(Boolean);
    const text = {
      sceneStatus: pane.querySelector('.scene-status')?.textContent?.trim() || '',
      thought: bubbleText.length ? bubbleText.join(' | ') : 'No explanatory thought is shown in this step.',
      captionTitle: pane.querySelector('.storyboard-caption h2')?.textContent?.trim() || '',
      explanation: pane.querySelector('.storyboard-caption p')?.textContent?.trim() || '',
      timing: pane.querySelector('.storyboard-caption time')?.textContent?.trim() || '',
      cueBadge: pane.querySelector('.cue-window-badge')?.textContent?.trim() || '',
    };
    const fontsReady = document.fonts?.status === 'loaded';
    const canvas = pane.querySelector('.storyboard-scene canvas');
    const canvasReady = Boolean(canvas && canvas.width > 0 && canvas.height > 0);
    const selectedMode = pane.querySelector('.storyboard-mode-toggle button[aria-pressed="true"]')?.textContent?.trim() || '';
    const trialText = pane.querySelector('.storyboard-progress > span')?.textContent?.trim() || '';
    const stepText = pane.querySelector('.storyboard-progress > strong')?.textContent?.trim() || '';
    const cueSource = pane.querySelectorAll('label.storyboard-select select')[0]?.value || '';
    const cueWindow = pane.querySelectorAll('label.storyboard-select select')[1]?.value || '';
    const autoAdvance = pane.querySelector('.auto-advance')?.getAttribute('aria-pressed') === 'true';
    return {
      ok: boundsFailures.length === 0 && textOverflow.length === 0 && sceneQaFailures.length === 0 && fontsReady && canvasReady,
      cssClip: absoluteRect,
      paneBoundsViewportCss: paneBounds,
      boundsFailures,
      textOverflow,
      textMetrics,
      minVisibleFontPx: Math.min(...textMetrics.map((metric) => metric.fontSizePx).filter(Number.isFinite)),
      sceneQa: sceneQa ? { ...sceneQa, bubbleSeparations } : null,
      sceneQaFailures,
      fontsReady,
      canvasReady,
      selectedMode,
      trialText,
      stepText,
      cueSource,
      cueWindow,
      autoAdvance,
      text,
    };
  })()`);
}

async function auditFrameState({ client, viewport, game, mode, trial, step, settleFrames }) {
  await evaluate(client, `(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
    document.body.focus({ preventScroll: true });
    document.querySelector(${JSON.stringify(CAPTURE_TARGET)})?.scrollIntoView({ block: 'start', inline: 'nearest' });
    window.scrollBy(0, -2);
    return document.activeElement === document.body;
  })()`);
  const settled = await settleActiveRender(client, settleFrames);
  const pane = await inspectPane(client);
  const expectedMode = MODES[mode];
  const identityChecks = {
    mode: pane.selectedMode === expectedMode,
    trial: pane.trialText === `Trial ${trial}`,
    step: pane.stepText === `Step ${step} / 6`,
    cueSource: pane.cueSource === 'live',
    cueWindow: pane.cueWindow === 'both',
    autoAdvance: pane.autoAdvance === false,
    sceneQaScenario: pane.sceneQa?.scenarioId === GAMES[game].scenarioId,
    sceneQaPhase: pane.sceneQa?.phase === step - 1,
  };
  const missingText = REQUIRED_TEXT_FIELDS.filter((field) => !pane.text?.[field]);
  const auditPass = pane.ok
    && missingText.length === 0
    && Object.values(identityChecks).every(Boolean)
    && settled.frames >= SETTLE_FRAMES;
  return {
    filename: frameFilename(game, mode, trial, step),
    viewport,
    game,
    mode,
    trial,
    step,
    auditPass,
    pane,
    identityChecks,
    missingText,
    settled,
  };
}

function auditFailureReasons(audit) {
  const reasons = [];
  const pane = audit.pane || {};
  if (pane.reason) reasons.push(`pane:${pane.reason}`);
  for (const selector of pane.boundsFailures || []) reasons.push(`bounds:${selector}`);
  for (const overflow of pane.textOverflow || []) reasons.push(`text-overflow:${overflow.selector || 'unknown'}`);
  for (const failure of pane.sceneQaFailures || []) reasons.push(`scene-qa:${failure}`);
  if (pane.fontsReady !== true) reasons.push('readiness:fonts');
  if (pane.canvasReady !== true) reasons.push('readiness:canvas');
  for (const [name, passes] of Object.entries(audit.identityChecks || {})) {
    if (passes !== true) reasons.push(`identity:${name}`);
  }
  for (const field of audit.missingText || []) reasons.push(`missing-text:${field}`);
  if (!audit.settled || audit.settled.frames < SETTLE_FRAMES || audit.settled.elapsedMs < 1000) {
    reasons.push('readiness:active-render-settle');
  }
  if (reasons.length === 0 && audit.auditPass !== true) reasons.push('audit:unspecified');
  return [...new Set(reasons)].sort();
}

function stableErrorMessage(error) {
  return String(error instanceof Error ? error.message : error)
    .replace(/127\.0\.0\.1:\d+/gu, '127.0.0.1:<port>')
    .replace(/localhost:\d+/gu, 'localhost:<port>');
}

async function captureFrame({ client, outputRoot, viewport, game, mode, trial, step, dpr, settleFrames }) {
  const audit = await auditFrameState({ client, viewport, game, mode, trial, step, settleFrames });
  const { pane, identityChecks, missingText, settled, auditPass } = audit;
  if (!auditPass) {
    throw new Error(`Frame audit failed for ${viewport}/${frameFilename(game, mode, trial, step)}: ${JSON.stringify({ pane, identityChecks, missingText, settled })}`);
  }
  const { x, y, width, height } = pane.cssClip;
  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: true,
    optimizeForSpeed: false,
    clip: { x, y, width, height, scale: 1 },
  });
  const png = Buffer.from(screenshot.data, 'base64');
  const raster = parsePngDimensions(png);
  const filename = frameFilename(game, mode, trial, step);
  const screenshotRelative = `${viewport}/${filename}`;
  const textRelative = `text/${viewport}/${filename.replace(/\.png$/u, '.txt')}`;
  const screenshotPath = path.join(outputRoot, ...screenshotRelative.split('/'));
  const textPath = path.join(outputRoot, ...textRelative.split('/'));
  await mkdir(path.dirname(screenshotPath), { recursive: true });
  await mkdir(path.dirname(textPath), { recursive: true });
  await writeFile(screenshotPath, png);
  await writeFile(
    textPath,
    `${REQUIRED_TEXT_FIELDS.map((field) => `${field}: ${pane.text[field]}`).join('\n')}\n`,
    'utf8',
  );
  return {
    filename,
    screenshot: screenshotRelative,
    textPath: textRelative,
    game,
    mode,
    trial,
    step,
    viewport,
    cueSource: 'live',
    cueWindow: 'both',
    autoAdvance: false,
    captureTarget: CAPTURE_TARGET,
    auditPass: true,
    captureProtocol: {
      renderer: 'isolated-headless-edge-cdp',
      rendererProtocolVersion: RENDERER_PROTOCOL_VERSION,
      selector: CAPTURE_TARGET,
      domEventsOnly: true,
      operatingSystemPointerUsed: false,
      visibleBrowserUsed: false,
      privateBrowserProfile: true,
      focusSuppressed: true,
      activeElementBlurred: true,
      scrollbarSuppressed: true,
      fontsReady: pane.fontsReady,
      assetsReady: pane.canvasReady,
      activeRenderSettled: true,
      settleFrames: settled.frames,
      settleMs: Math.round(settled.elapsedMs),
      deviceScaleFactor: dpr,
    },
    captureClipPageCss: pane.cssClip,
    paneBoundsViewportCss: pane.paneBoundsViewportCss,
    captureDimensions: {
      cssWidth: pane.cssClip.width,
      cssHeight: pane.cssClip.height,
      deviceScaleFactor: dpr,
      rasterWidth: raster.width,
      rasterHeight: raster.height,
    },
    screenshotSha256: createHash('sha256').update(png).digest('hex'),
    layout: {
      boundsFailures: pane.boundsFailures,
      textOverflow: pane.textOverflow,
      minVisibleFontPx: pane.minVisibleFontPx,
      textMetrics: pane.textMetrics,
      sceneQa: pane.sceneQa,
      sceneQaFailures: pane.sceneQaFailures,
      identityChecks,
    },
    text: pane.text,
  };
}

async function configurePage(client, viewport, dpr) {
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Network.enable');
  await client.send('Log.enable');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: dpr,
    mobile: viewport.mobile,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
    screenOrientation: { type: 'portraitPrimary', angle: 0 },
  });
  await client.send('Emulation.setEmulatedMedia', {
    media: 'screen',
    features: [
      { name: 'prefers-color-scheme', value: 'dark' },
      { name: 'prefers-reduced-motion', value: 'reduce' },
    ],
  });
}

function renderPlan(options) {
  return options.smoke
    ? [
        { game: 'used-car', mode: 'aligned', trial: 1, steps: [2, 4] },
        { game: 'number-card', mode: 'conflicting', trial: 1, steps: [2, 3, 6] },
      ]
    : Object.entries(GAMES).flatMap(([game, definition]) => Object.keys(MODES).map((mode) => ({
        game,
        mode,
        trials: definition.trials,
      })));
}

async function renderWorkUnit({ browserPort, url, outputRoot, viewportName, item, options, diagnostics }) {
  const profile = VIEWPORTS[viewportName];
  const { target, client } = await createPage(browserPort, 'about:blank');
  const pageErrors = [];
  client.on('Runtime.exceptionThrown', ({ exceptionDetails }) => pageErrors.push(exceptionDetails?.text || 'Runtime exception'));
  client.on('Log.entryAdded', ({ entry }) => {
    if (entry?.level === 'error') pageErrors.push(`${entry.source || 'log'}: ${entry.text}`);
  });
  client.on('Network.loadingFailed', (entry) => {
    if (!entry.canceled) pageErrors.push(`Network: ${entry.errorText} (${entry.type || 'unknown'})`);
  });
  try {
    await configurePage(client, profile, options.dpr);
    await client.send('Page.navigate', { url });
    await waitForPage(client);
    await installCaptureCss(client);
    await evaluate(client, 'document.fonts?.ready || Promise.resolve()', { awaitPromise: true });

    const frames = [];
    await ensureScenarioOpen(client, GAMES[item.game].triggerText);
    await waitForSelector(client, CAPTURE_TARGET);
    await setSelect(client, 'Cardiac cue', 'live');
    await setSelect(client, 'Shown while', 'both');
    await clickByText(client, '.storyboard-mode-toggle button', MODES[item.mode]);

    if (options.smoke) {
      for (const step of item.steps) {
        await clickByText(client, '.storyboard-progress button', `Go to step ${step}`);
        frames.push(await captureFrame({
          client, outputRoot, viewport: viewportName, game: item.game, mode: item.mode,
          trial: item.trial, step, dpr: options.dpr, settleFrames: options.settleFrames,
        }));
      }
    } else {
      for (let trial = 1; trial <= item.trials; trial += 1) {
        for (let step = 1; step <= 6; step += 1) {
          await clickByText(client, '.storyboard-progress button', `Go to step ${step}`);
          frames.push(await captureFrame({
            client, outputRoot, viewport: viewportName, game: item.game, mode: item.mode,
            trial, step, dpr: options.dpr, settleFrames: options.settleFrames,
          }));
        }
        if (trial < item.trials) {
          await clickByText(client, '.storyboard-arrow.next', '');
        }
      }
    }
    diagnostics.push({ viewport: viewportName, game: item.game, mode: item.mode, targetId: target.id, errors: pageErrors });
    if (pageErrors.length > 0) {
      throw new Error(`Browser errors in ${viewportName}/${item.game}/${item.mode}: ${pageErrors.join(' | ')}`);
    }
    console.log(`Rendered ${viewportName}/${item.game}/${item.mode}: ${frames.length} frames.`);
    return frames;
  } finally {
    try {
      await client.send('Page.close');
    } catch {
      // Browser cleanup closes any remaining private targets.
    }
    client.close();
  }
}

function preflightStateIdentity(viewport, game, mode, trial, step) {
  return {
    filename: frameFilename(game, mode, trial, step),
    viewport,
    game,
    mode,
    trial,
    step,
    cueSource: 'live',
    cueWindow: 'both',
    autoAdvance: false,
  };
}

function preflightRecordFromAudit(audit) {
  return {
    ...preflightStateIdentity(audit.viewport, audit.game, audit.mode, audit.trial, audit.step),
    auditPass: audit.auditPass,
    failureReasons: auditFailureReasons(audit),
    details: {
      captureClipPageCss: audit.pane?.cssClip || null,
      paneBoundsViewportCss: audit.pane?.paneBoundsViewportCss || null,
      boundsFailures: audit.pane?.boundsFailures || [],
      textOverflow: audit.pane?.textOverflow || [],
      minVisibleFontPx: Number.isFinite(audit.pane?.minVisibleFontPx) ? audit.pane.minVisibleFontPx : null,
      textMetrics: audit.pane?.textMetrics || [],
      sceneQa: audit.pane?.sceneQa || null,
      sceneQaFailures: audit.pane?.sceneQaFailures || [],
      identityChecks: audit.identityChecks || {},
      missingText: audit.missingText || [],
      readiness: {
        fontsReady: audit.pane?.fontsReady === true,
        canvasReady: audit.pane?.canvasReady === true,
        activeRenderSettled: Boolean(
          audit.settled
          && audit.settled.frames >= SETTLE_FRAMES
          && audit.settled.elapsedMs >= 1000
        ),
      },
      text: audit.pane?.text || null,
    },
  };
}

function preflightExecutionFailure(viewport, game, mode, trial, step, error) {
  const message = stableErrorMessage(error);
  return {
    ...preflightStateIdentity(viewport, game, mode, trial, step),
    auditPass: false,
    failureReasons: [`execution:${message}`],
    details: { executionError: message },
  };
}

function addPreflightUnitFailures(records, prefix, errors) {
  const reasons = [...new Set(errors.map((error) => `${prefix}:${stableErrorMessage(error)}`))].sort();
  if (reasons.length === 0) return;
  for (const record of records) {
    record.auditPass = false;
    record.failureReasons = [...new Set([...record.failureReasons, ...reasons])].sort();
    record.details.unitErrors = [...new Set([...(record.details.unitErrors || []), ...reasons])].sort();
  }
}

function plannedPreflightStates(viewportName, item) {
  const states = [];
  for (let trial = 1; trial <= item.trials; trial += 1) {
    for (let step = 1; step <= 6; step += 1) {
      states.push({ viewport: viewportName, game: item.game, mode: item.mode, trial, step });
    }
  }
  return states;
}

async function preflightWorkUnit({ browserPort, url, viewportName, item, options, diagnostics }) {
  const profile = VIEWPORTS[viewportName];
  const { client } = await createPage(browserPort, 'about:blank');
  const pageErrors = [];
  const navigationErrors = [];
  client.on('Runtime.exceptionThrown', ({ exceptionDetails }) => pageErrors.push(exceptionDetails?.text || 'Runtime exception'));
  client.on('Log.entryAdded', ({ entry }) => {
    if (entry?.level === 'error') pageErrors.push(`${entry.source || 'log'}: ${entry.text}`);
  });
  client.on('Network.loadingFailed', (entry) => {
    if (!entry.canceled) pageErrors.push(`Network: ${entry.errorText} (${entry.type || 'unknown'})`);
  });

  const records = [];
  const plannedStates = plannedPreflightStates(viewportName, item);
  try {
    try {
      await configurePage(client, profile, options.dpr);
      await client.send('Page.navigate', { url });
      await waitForPage(client);
      await installCaptureCss(client);
      await evaluate(client, 'document.fonts?.ready || Promise.resolve()', { awaitPromise: true });
      await ensureScenarioOpen(client, GAMES[item.game].triggerText);
      await waitForSelector(client, CAPTURE_TARGET);
      await setSelect(client, 'Cardiac cue', 'live');
      await setSelect(client, 'Shown while', 'both');
      await clickByText(client, '.storyboard-mode-toggle button', MODES[item.mode]);
    } catch (error) {
      const message = stableErrorMessage(error);
      diagnostics.push({ viewport: viewportName, game: item.game, mode: item.mode, errors: [`setup:${message}`] });
      return plannedStates.map((state) => preflightExecutionFailure(
        state.viewport, state.game, state.mode, state.trial, state.step, error,
      ));
    }

    for (let trial = 1; trial <= item.trials; trial += 1) {
      for (let step = 1; step <= 6; step += 1) {
        try {
          await clickByText(client, '.storyboard-progress button', `Go to step ${step}`);
          const audit = await auditFrameState({
            client,
            viewport: viewportName,
            game: item.game,
            mode: item.mode,
            trial,
            step,
            settleFrames: options.settleFrames,
          });
          records.push(preflightRecordFromAudit(audit));
        } catch (error) {
          records.push(preflightExecutionFailure(viewportName, item.game, item.mode, trial, step, error));
        }
      }
      if (trial < item.trials) {
        try {
          await clickByText(client, '.storyboard-arrow.next', '');
        } catch (error) {
          navigationErrors.push(stableErrorMessage(error));
        }
      }
    }

    addPreflightUnitFailures(records, 'navigation', navigationErrors);
    addPreflightUnitFailures(records, 'browser', pageErrors);
    diagnostics.push({
      viewport: viewportName,
      game: item.game,
      mode: item.mode,
      errors: [...new Set([
        ...navigationErrors.map((error) => `navigation:${error}`),
        ...pageErrors.map((error) => `browser:${stableErrorMessage(error)}`),
      ])].sort(),
    });
    console.log(`Preflighted ${viewportName}/${item.game}/${item.mode}: ${records.length} states.`);
    return records;
  } finally {
    try {
      await client.send('Page.close');
    } catch {
      // Browser cleanup closes any remaining private targets.
    }
    client.close();
  }
}

async function runWorkerPool(jobs, concurrency, worker) {
  const results = new Array(jobs.length);
  let cursor = 0;
  const run = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= jobs.length) return;
      results[index] = await worker(jobs[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, () => run()));
  return results.flat();
}

async function safeReplaceDirectory(staging, target, force) {
  const allowedRoot = path.resolve(PROJECT_ROOT, 'tmp', 'qa');
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(allowedRoot, resolvedTarget);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Renderer output must be a child of ${allowedRoot}.`);
  }
  const install = `${target}.install-${process.pid}-${Date.now()}`;
  const backup = `${target}.backup-${process.pid}-${Date.now()}`;
  const targetExists = await exists(target);
  if (targetExists && !force) {
    throw new Error(`${target} already exists; use --force to replace it after staging passes.`);
  }
  const validateTree = async (directory) => {
    const manifest = JSON.parse(await readFile(path.join(directory, RENDER_MANIFEST), 'utf8'));
    if (manifest.schema !== 'cardiac-scene-render-manifest' || manifest.frames?.length !== manifest.frameCount) {
      throw new Error(`Invalid staged render manifest in ${directory}.`);
    }
    for (const frame of manifest.frames) {
      for (const field of ['screenshot', 'textPath']) {
        const relativePath = String(frame[field] || '').replaceAll('\\', '/');
        const normalized = path.posix.normalize(relativePath);
        if (!relativePath || normalized !== relativePath || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
          throw new Error(`Unsafe ${field} in staged render manifest: ${relativePath || '(empty)'}.`);
        }
        const artifact = path.join(directory, ...normalized.split('/'));
        if (!(await exists(artifact)) || !(await stat(artifact)).isFile()) {
          throw new Error(`Missing staged render artifact: ${relativePath}.`);
        }
      }
      const png = await readFile(path.join(directory, ...frame.screenshot.split('/')));
      const digest = createHash('sha256').update(png).digest('hex');
      if (digest !== frame.screenshotSha256) throw new Error(`PNG checksum mismatch: ${frame.screenshot}.`);
    }
    return manifest.frameCount;
  };

  try {
    // Windows scanners can temporarily hold directory handles and reject directory
    // renames. Copy to an unexposed install tree, validate every checksum, and retain
    // both the completed staging tree and a prior-target backup until publication passes.
    await cp(staging, install, { recursive: true, errorOnExist: true, force: false });
    const expectedCount = await validateTree(install);
    if (targetExists) await cp(target, backup, { recursive: true, errorOnExist: true, force: false });
    if (targetExists) await rm(target, { recursive: true, force: true });
    await cp(install, target, { recursive: true, errorOnExist: true, force: false });
    const publishedCount = await validateTree(target);
    if (publishedCount !== expectedCount) throw new Error('Published renderer tree is incomplete.');
  } catch (error) {
    if (await exists(target)) await rm(target, { recursive: true, force: true });
    if (await exists(backup)) await cp(backup, target, { recursive: true, errorOnExist: true, force: false });
    throw error;
  } finally {
    if (await exists(install)) await rm(install, { recursive: true, force: true });
    if (await exists(backup)) await rm(backup, { recursive: true, force: true });
  }
}

async function safeReplacePreflightDirectory(staging, target, force) {
  const allowedRoot = path.resolve(PROJECT_ROOT, 'tmp', 'qa');
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(allowedRoot, resolvedTarget);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Preflight output must be a child of ${allowedRoot}.`);
  }
  const install = `${target}.install-${process.pid}-${Date.now()}`;
  const backup = `${target}.backup-${process.pid}-${Date.now()}`;
  const targetExists = await exists(target);
  if (targetExists && !force) {
    throw new Error(`${target} already exists; use --force to replace it after preflight completes.`);
  }
  const validateTree = async (directory) => {
    const files = (await listFiles(directory))
      .map((filename) => path.relative(directory, filename).split(path.sep).join('/'))
      .sort();
    if (files.length !== 1 || files[0] !== PREFLIGHT_REPORT) {
      throw new Error(`Preflight output must contain only ${PREFLIGHT_REPORT}.`);
    }
    const report = JSON.parse(await readFile(path.join(directory, PREFLIGHT_REPORT), 'utf8'));
    if (
      report.schema !== 'cardiac-scene-preflight-report'
      || report.completeMatrix !== true
      || report.expectedStateCount !== 240
      || report.stateCount !== 240
      || report.checkedStates?.length !== 240
      || report.failureCount !== report.failures?.length
      || report.passCount + report.failureCount !== 240
      || report.pngCaptureCount !== 0
    ) {
      throw new Error(`Invalid staged preflight report in ${directory}.`);
    }
    return report;
  };

  try {
    await cp(staging, install, { recursive: true, errorOnExist: true, force: false });
    await validateTree(install);
    if (targetExists) await cp(target, backup, { recursive: true, errorOnExist: true, force: false });
    if (targetExists) await rm(target, { recursive: true, force: true });
    await cp(install, target, { recursive: true, errorOnExist: true, force: false });
    await validateTree(target);
  } catch (error) {
    if (await exists(target)) await rm(target, { recursive: true, force: true });
    if (await exists(backup)) await cp(backup, target, { recursive: true, errorOnExist: true, force: false });
    throw error;
  } finally {
    if (await exists(install)) await rm(install, { recursive: true, force: true });
    if (await exists(backup)) await rm(backup, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const expectedCount = options.preflight ? 240 : (options.smoke ? 10 : 240);
  const renderSourceFingerprint = await fingerprint(await captureSourceFiles());
  const outputParent = path.dirname(options.outputRoot);
  await mkdir(outputParent, { recursive: true });
  const staging = await mkdtemp(path.join(
    outputParent,
    options.preflight ? '.headless-preflight-staging-' : '.headless-render-staging-',
  ));
  let localServer = null;
  let browser = null;
  let browserClient = null;
  const diagnostics = [];
  try {
    const url = options.url || (localServer = await startProductionServer({ build: options.build })).url;
    browser = await launchHeadlessBrowser();
    browserClient = new CdpClient(browser.browserWebSocketUrl);
    await browserClient.ready;
    const jobs = Object.keys(VIEWPORTS).flatMap((viewportName) => renderPlan(options).map((item) => ({
      viewportName,
      item,
    })));
    const frames = await runWorkerPool(jobs, MAX_RENDER_WORKERS, ({ viewportName, item }) => (
      options.preflight
        ? preflightWorkUnit({
            browserPort: browser.port,
            url,
            viewportName,
            item,
            options,
            diagnostics,
          })
        : renderWorkUnit({
            browserPort: browser.port,
            url,
            outputRoot: staging,
            viewportName,
            item,
            options,
            diagnostics,
          })
    ));
    const viewportRank = { desktop: 0, phone: 1 };
    const gameRank = { 'used-car': 0, 'number-card': 1 };
    const modeRank = { aligned: 0, conflicting: 1 };
    frames.sort((a, b) => (
      viewportRank[a.viewport] - viewportRank[b.viewport]
      || gameRank[a.game] - gameRank[b.game]
      || modeRank[a.mode] - modeRank[b.mode]
      || a.trial - b.trial
      || a.step - b.step
    ));
    diagnostics.sort((a, b) => (
      viewportRank[a.viewport] - viewportRank[b.viewport]
      || gameRank[a.game] - gameRank[b.game]
      || modeRank[a.mode] - modeRank[b.mode]
    ));
    if (frames.length !== expectedCount) {
      throw new Error(`Expected ${expectedCount} rendered frames, received ${frames.length}.`);
    }
    const identities = new Set(frames.map((frame) => `${frame.viewport}/${frame.filename}`));
    if (identities.size !== frames.length) throw new Error('Renderer produced duplicate frame identities.');
    if (options.preflight) {
      const checkedStates = frames.map((frame) => ({
        filename: frame.filename,
        viewport: frame.viewport,
        game: frame.game,
        mode: frame.mode,
        trial: frame.trial,
        step: frame.step,
        cueSource: frame.cueSource,
        cueWindow: frame.cueWindow,
        autoAdvance: frame.autoAdvance,
        auditPass: frame.auditPass,
        failureReasons: frame.failureReasons,
      }));
      const failures = frames.filter(({ auditPass }) => auditPass !== true);
      const failureCount = failures.length;
      const passCount = frames.length - failureCount;
      const reasonCounts = new Map();
      for (const failure of failures) {
        for (const reason of failure.failureReasons) {
          reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
        }
      }
      const report = {
        schema: 'cardiac-scene-preflight-report',
        schemaVersion: 1,
        rendererProtocolVersion: RENDERER_PROTOCOL_VERSION,
        completeMatrix: true,
        expectedStateCount: expectedCount,
        stateCount: frames.length,
        passCount,
        failureCount,
        passed: failureCount === 0,
        pngCaptureCount: 0,
        canonicalArtifactsWritten: false,
        browser: {
          product: browser.version.Browser,
          protocolVersion: browser.version['Protocol-Version'],
          executable: path.basename(browser.executable),
          headless: true,
          privateProfile: true,
        },
        renderSourceFingerprint,
        captureTarget: CAPTURE_TARGET,
        captureProtocol: {
          renderer: 'isolated-headless-edge-cdp',
          rendererProtocolVersion: RENDERER_PROTOCOL_VERSION,
          selector: CAPTURE_TARGET,
          deviceScaleFactor: options.dpr,
          uniformDeviceScaleFactor: true,
          settleFrames: options.settleFrames,
          minimumSettleMs: 1000,
          focusSuppressed: true,
          activeElementBlurred: true,
          scrollbarSuppressed: true,
          domEventsOnly: true,
          operatingSystemPointerUsed: false,
          visibleBrowserUsed: false,
          privateBrowserProfile: true,
          measuredSettle: true,
          screenshotsCaptured: false,
          maximumConcurrentPages: MAX_RENDER_WORKERS,
        },
        fixedState: {
          cueSource: 'live',
          cueWindow: 'both',
          autoAdvance: false,
        },
        failureReasonCounts: Object.fromEntries([...reasonCounts.entries()].sort(([a], [b]) => a.localeCompare(b))),
        diagnostics,
        checkedStates,
        failures,
      };
      await writeFile(path.join(staging, PREFLIGHT_REPORT), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
      await safeReplacePreflightDirectory(staging, options.outputRoot, options.force);
      console.log(`Preflighted ${frames.length} scene states in a hidden background browser.`);
      console.log(`Passed: ${passCount}; failed: ${failureCount}; PNGs captured: 0.`);
      console.log(`Report: ${path.join(options.outputRoot, PREFLIGHT_REPORT)}`);
      console.log('No visible browser window or operating-system pointer input was used.');
      if (failureCount > 0) {
        throw new Error(`Preflight found ${failureCount} failing scene state${failureCount === 1 ? '' : 's'}.`);
      }
      return;
    }
    const manifest = {
      schema: 'cardiac-scene-render-manifest',
      schemaVersion: 1,
      rendererProtocolVersion: RENDERER_PROTOCOL_VERSION,
      completeMatrix: !options.smoke,
      frameCount: frames.length,
      expectedFrameCount: expectedCount,
      renderedAt: new Date().toISOString(),
      sourceUrl: url,
      browser: {
        product: browser.version.Browser,
        protocolVersion: browser.version['Protocol-Version'],
        executable: path.basename(browser.executable),
        headless: true,
        privateProfile: true,
      },
      sourceFingerprint: renderSourceFingerprint,
      renderSourceFingerprint,
      captureTarget: CAPTURE_TARGET,
      captureProtocol: {
        renderer: 'isolated-headless-edge-cdp',
        rendererProtocolVersion: RENDERER_PROTOCOL_VERSION,
        selector: CAPTURE_TARGET,
        deviceScaleFactor: options.dpr,
        uniformDeviceScaleFactor: true,
        settleFrames: options.settleFrames,
        minimumSettleMs: 1000,
        focusSuppressed: true,
        activeElementBlurred: true,
        scrollbarSuppressed: true,
        fontsReady: true,
        assetsReady: true,
        activeRenderSettled: true,
        domEventsOnly: true,
        operatingSystemPointerUsed: false,
        visibleBrowserUsed: false,
        privateBrowserProfile: true,
        measuredSettle: true,
        maximumConcurrentPages: MAX_RENDER_WORKERS,
      },
      fixedState: {
        cueSource: 'live',
        cueWindow: 'both',
        autoAdvance: false,
      },
      diagnostics,
      frames,
    };
    await writeFile(path.join(staging, RENDER_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await safeReplaceDirectory(staging, options.outputRoot, options.force);
    console.log(`Rendered ${frames.length} scene panes in a hidden background browser.`);
    console.log(`Manifest: ${path.join(options.outputRoot, RENDER_MANIFEST)}`);
    console.log(`No visible browser window or operating-system pointer input was used.`);
  } finally {
    if (browserClient) {
      try {
        await browserClient.send('Browser.close');
      } catch {
        // Exact-PID cleanup below is the fallback.
      }
      browserClient.close();
    }
    if (browser) {
      await stopProcessTree(browser.child);
      await rm(browser.profile, { recursive: true, force: true });
    }
    if (localServer) await stopProcessTree(localServer.child);
    if (await exists(staging)) await rm(staging, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`Headless scene rendering failed: ${error.message}`);
  process.exitCode = 1;
});
