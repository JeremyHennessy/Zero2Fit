import { readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const files = [
  'data/generated/catalog_summary.json',
  'data/generated/met_reconciliation.json',
  'data/generated/training_catalog_summary.json'
];

for (const path of files) {
  const url = new URL(path, ROOT);
  const value = JSON.parse(await readFile(url, 'utf8'));
  delete value.generatedAt;
  await writeFile(url, JSON.stringify(value, null, 2) + '\n');
}

console.log('Normalized generated metadata: volatile timestamps removed.');
