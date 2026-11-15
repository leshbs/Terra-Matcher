import assert from 'node:assert/strict';
import test from 'node:test';

import { validateExplorerGridSamples } from '../../scripts/build-production-seed.mjs';

const locationIds = ['mars-reference', 'candidate-1', 'candidate-2', 'candidate-3', 'candidate-4', 'candidate-5'];
const manifest = {
  modelRunId: 'run-1',
  inputDatasetIds: ['mars-dem', 'earth-dem'],
};

function validSamples() {
  return locationIds.flatMap((windowId, locationIndex) => Array.from({ length: 25 }, (_, index) => ({
    id: `${windowId}-${index}`,
    modelRunId: 'run-1',
    windowId,
    datasetId: locationIndex === 0 ? 'mars-dem' : 'earth-dem',
    offsetEastKm: index % 5,
    offsetNorthKm: Math.floor(index / 5),
    slope: 1,
    roughness: 2,
    relativeRelief: 3,
    qualityFlag: 'source-backed-derived',
  })));
}

test('validateExplorerGridSamples accepts six locations with twenty-five finite samples each', () => {
  const samples = validSamples();

  assert.equal(validateExplorerGridSamples(samples, locationIds, manifest), samples);
});

test('validateExplorerGridSamples rejects an incomplete location sample count', () => {
  const samples = validSamples();
  samples.pop();

  assert.throws(() => validateExplorerGridSamples(samples, locationIds, manifest), /requires exactly 25 samples/i);
});

test('validateExplorerGridSamples rejects duplicate offsets within a location', () => {
  const samples = validSamples();
  samples[1].offsetEastKm = samples[0].offsetEastKm;
  samples[1].offsetNorthKm = samples[0].offsetNorthKm;

  assert.throws(() => validateExplorerGridSamples(samples, locationIds, manifest), /duplicate offsets/i);
});

test('validateExplorerGridSamples rejects samples from a different model run', () => {
  const samples = validSamples();
  samples[0].modelRunId = 'run-2';

  assert.throws(() => validateExplorerGridSamples(samples, locationIds, manifest), /model run mismatch/i);
});

test('validateExplorerGridSamples rejects samples with a dataset outside the manifest inputs', () => {
  const samples = validSamples();
  samples[0].datasetId = 'other-dem';

  assert.throws(() => validateExplorerGridSamples(samples, locationIds, manifest), /dataset ID mismatch/i);
});

test('validateExplorerGridSamples rejects non-finite sample values', () => {
  const samples = validSamples();
  samples[0].roughness = Number.NaN;

  assert.throws(() => validateExplorerGridSamples(samples, locationIds, manifest), /finite roughness/i);
});

test('validateExplorerGridSamples rejects a duplicate sample ID across locations', () => {
  const samples = validSamples();
  samples[25].id = samples[0].id;

  assert.throws(() => validateExplorerGridSamples(samples, locationIds, manifest), /duplicate sample ID/i);
});

test('validateExplorerGridSamples rejects a non-production quality flag', () => {
  const samples = validSamples();
  samples[0].qualityFlag = 'estimated';

  assert.throws(() => validateExplorerGridSamples(samples, locationIds, manifest), /quality flag/i);
});
