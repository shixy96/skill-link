import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const electronBinary = path.join(
  rootDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron.cmd' : 'electron'
);

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      ...options
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

async function waitForRenderer(url) {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Renderer server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

await run(npmCommand, ['run', 'build']);
await run(npmCommand, ['run', 'build:electron']);

const renderer = spawn(npmCommand, ['exec', 'vite', '--', '--host', '127.0.0.1'], {
  cwd: rootDir,
  stdio: 'inherit'
});

try {
  await waitForRenderer('http://127.0.0.1:5173');

  const electron = spawn(electronBinary, ['dist-electron/main.js'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development'
    }
  });

  electron.on('exit', (code) => {
    renderer.kill();
    process.exit(code ?? 0);
  });

  electron.on('error', (error) => {
    renderer.kill();
    throw error;
  });
} catch (error) {
  renderer.kill();
  throw error;
}
