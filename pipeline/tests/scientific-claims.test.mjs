import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { scanScientificClaims } from '../../scripts/scan-scientific-claims.mjs';

test('permits bounded scientific language', async () => {
  const root = await mkdtemp(join(tmpdir(), 'terra-claims-'));
  await mkdir(join(root, 'app'));
  await writeFile(
    join(root, 'app', 'copy.ts'),
    'export const copy = "A candidate hypothesis, not a landing-site recommendation.";\n',
  );

  assert.deepEqual(await scanScientificClaims(root), []);
});

test('flags prohibited public-facing claims with their location', async () => {
  const root = await mkdtemp(join(tmpdir(), 'terra-claims-'));
  await mkdir(join(root, 'components'));
  await writeFile(
    join(root, 'components', 'hero.tsx'),
    'export const copy = "Our proven analog is mission-ready.";\n',
  );

  const findings = await scanScientificClaims(root);
  assert.equal(findings.length, 2);
  assert.equal(findings[0].file, 'components/hero.tsx');
  assert.equal(findings[0].line, 1);
});
