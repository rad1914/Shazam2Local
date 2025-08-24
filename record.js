// @path: record.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECORD_PATH = path.join(__dirname, 'downloaded.json');

export const loadRecord = async () => {
  try {
    return JSON.parse(await fs.readFile(RECORD_PATH, 'utf8'));
  } catch {
    await fs.writeFile(RECORD_PATH, '[]', 'utf8');
    return [];
  }
};

export const saveRecord = data =>
  fs.writeFile(RECORD_PATH, JSON.stringify(data, null, 2), 'utf8');
  