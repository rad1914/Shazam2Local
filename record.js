// @path: record.js
import fs from 'fs/promises';
import path from 'path';
import { getDirname } from './paths.js';

const __dirname = getDirname(import.meta.url);
const RECORD_PATH = path.join(__dirname, 'downloaded.json');

export const loadRecord = async () => {
  try {
    const data = JSON.parse(await fs.readFile(RECORD_PATH, 'utf8'));
    if (!Array.isArray(data)) throw new Error('Corrupted format');
    return data;
  } catch {
    await fs.writeFile(RECORD_PATH, '[]', 'utf8');
    return [];
  }
};

export const saveRecord = async data => {
  try {
    await fs.copyFile(RECORD_PATH, `${RECORD_PATH}.bak`);
  } catch {}
  await fs.writeFile(RECORD_PATH, JSON.stringify(data, null, 2), 'utf8');
};
