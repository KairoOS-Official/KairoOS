import { cpSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const studioRoot = path.resolve(projectRoot, '..');
const packageVersion = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8')).version;
const versionLabel = `v${packageVersion}`;
const installerDir = path.join(studioRoot, '.live', 'builds', 'installer', versionLabel);
const targetDir = path.join(installerDir, '_cargo');
const buildEnv = { ...process.env, CARGO_TARGET_DIR: targetDir };

mkdirSync(installerDir, { recursive: true });
console.log(`Build installateur KaïroOS ${versionLabel}`);
console.log(`Sortie : ${installerDir}`);

execSync('npx tauri build', { cwd: projectRoot, env: buildEnv, stdio: 'inherit' });

const bundleDir = path.join(targetDir, 'release', 'bundle');
if (!existsSync(bundleDir)) {
  throw new Error(`Bundle Tauri introuvable : ${bundleDir}`);
}

const exportedBundleDir = path.join(installerDir, 'bundle');
cpSync(bundleDir, exportedBundleDir, { recursive: true, force: true });
console.log(`Installateur exporte dans : ${exportedBundleDir}`);
