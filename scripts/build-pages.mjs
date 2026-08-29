import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nextCli = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');

const child = spawn(process.execPath, [nextCli, 'build'], {
  cwd: projectRoot,
  env: {
    ...process.env,
    STATIC_EXPORT: '1',
  },
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error('Static export stopped with signal ' + signal);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
