import { readFile } from 'fs/promises';

const versionArg = process.argv[2];
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const version = versionArg ?? packageJson.version;

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  fail(`Invalid release version "${version}". Use SemVer, for example 0.1.0 or 0.2.0-beta.1.`);
}

if (versionArg && versionArg !== packageJson.version) {
  fail(`Release version "${versionArg}" does not match package.json version "${packageJson.version}".`);
}

console.log(`Release version OK: v${version}`);
