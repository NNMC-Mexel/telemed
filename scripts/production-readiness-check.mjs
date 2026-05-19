#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const checks = [];

function run(name, fn) {
  try {
    fn();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error: error.message });
  }
}

function exec(command, args, cwd = root) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

run('No tracked .env files', () => {
  const files = exec('git', ['ls-files'])
    .split('\n')
    .filter((file) => /(^|\/)\.env$/.test(file));
  if (files.length) {
    throw new Error(`Tracked env files: ${files.join(', ')}`);
  }
});

run('Required env examples exist', () => {
  [
    'frontend/.env.example',
    'server/.env.example',
    'signaling-server/.env.example',
  ].forEach((file) => {
    if (!existsSync(join(root, file))) throw new Error(`${file} is missing`);
  });
});

run('Frontend audit has no high/critical prod findings', () => {
  exec('npm', ['audit', '--omit=dev', '--audit-level=high'], join(root, 'frontend'));
});

run('Server audit has no high/critical prod findings', () => {
  exec('npm', ['audit', '--omit=dev', '--audit-level=high'], join(root, 'server'));
});

run('Signaling audit has no high/critical prod findings', () => {
  exec('npm', ['audit', '--omit=dev', '--audit-level=high'], join(root, 'signaling-server'));
});

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}${check.error ? ` - ${check.error}` : ''}`);
}

if (failed.length) {
  process.exitCode = 1;
}
