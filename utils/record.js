// @path: utils/record.js
import { readFile, writeFile, copyFile, rename } from 'fs/promises';
import { join } from 'path';
import { dirFromMeta } from './utils.js';

const file = join(dirFromMeta(import.meta.url), 'downloaded.json');

export const lr = async () => {
  try {
    const d = JSON.parse(await readFile(file, 'utf8'));
    if (!Array.isArray(d)) throw 0;
    return d;
  } catch {
    await writeFile(file, '[]');
    return [];
  }
};

export const sr = async (d) => {
  try {
    await copyFile(file, file + '.bak');
  } catch {

  }

  const tmp = file + '.tmp';
  await writeFile(tmp, JSON.stringify(d));
  await rename(tmp, file);
};
