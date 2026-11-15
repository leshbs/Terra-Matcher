import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDirectories = ['app', 'components', 'public'];
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.md', '.mdx', '.json']);
const prohibitedClaims = [
  /\bbest(?:\s+Mars)?\s+landing\s+site\b/gi,
  /\bproven(?:\s+Mars)?\s+analog\b/gi,
  /\bAI\s+discovery\b/gi,
  /\bmission[-\s]ready\b/gi,
];

async function sourceFiles(root, directory) {
  const absoluteDirectory = resolve(root, directory);
  let entries;
  try {
    entries = await readdir(absoluteDirectory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const entryPath = resolve(absoluteDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await sourceFiles(root, relative(root, entryPath)));
    } else if (entry.isFile() && sourceExtensions.has(entry.name.slice(entry.name.lastIndexOf('.')))) {
      files.push(entryPath);
    }
  }
  return files;
}

export async function scanScientificClaims(root) {
  const files = (await Promise.all(publicDirectories.map((directory) => sourceFiles(root, directory)))).flat();
  const findings = [];

  for (const file of files) {
    const contents = await readFile(file, 'utf8');
    for (const expression of prohibitedClaims) {
      expression.lastIndex = 0;
      for (const match of contents.matchAll(expression)) {
        findings.push({
          file: relative(root, file).replaceAll('\\', '/'),
          line: contents.slice(0, match.index).split('\n').length,
          claim: match[0],
        });
      }
    }
  }

  return findings.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line || left.claim.localeCompare(right.claim));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? '.');
  const findings = await scanScientificClaims(root);
  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(`${finding.file}:${finding.line}: prohibited scientific claim: ${finding.claim}`);
    }
    process.exitCode = 1;
  } else {
    console.log('Scientific claim scan passed.');
  }
}
