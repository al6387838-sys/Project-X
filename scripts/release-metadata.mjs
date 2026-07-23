import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const releaseConfigPath = resolve(root, 'config/release.json');
const RELEASE_PATTERN = /^v\d+\.\d+\.\d+$/;

export async function loadReleaseConfig() {
  const raw = await readFile(releaseConfigPath, 'utf8');
  const config = JSON.parse(raw);

  if (!config || Object.keys(config).length !== 1 || !RELEASE_PATTERN.test(String(config.release))) {
    throw new Error('config/release.json must contain exactly one valid "release" value');
  }

  return Object.freeze({ release: config.release });
}

export function currentCommit() {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();

  if (!/^[0-9a-f]{40}$/i.test(commit)) {
    throw new Error('Unable to resolve a full Git commit SHA for the release');
  }

  return commit;
}

export async function createReleaseMetadata({ builtAt = new Date().toISOString() } = {}) {
  const { release } = await loadReleaseConfig();
  const commit = currentCommit();

  return Object.freeze({
    release,
    version: release,
    buildId: `lifeos-${release.slice(1)}-${commit.slice(0, 12)}`,
    commit,
    builtAt,
    environment: 'production',
    platform: 'cloudflare-pages',
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const metadata = await createReleaseMetadata();
  console.log(JSON.stringify(metadata, null, 2));
}
