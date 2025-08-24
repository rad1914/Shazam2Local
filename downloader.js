// @path: downloader.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { exec as _exec } from 'child_process';

import { sanitize, equalsIgnoreCase, warn, success, error, summary } from './utils.js';
import { saveRecord } from './record.js';

const exec = promisify(_exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OUT_DIR = path.join(__dirname, 'downloads');
const TEMP_DIR = path.join(__dirname, 'temp');
const FORMAT = 'opus', QUALITY = '3';
const YTDLP_FLAGS = `-x --audio-format ${FORMAT} --audio-quality ${QUALITY}`;

export const recordExists = (record, keys) =>
  record.some(e => Object.keys(keys).every(k => equalsIgnoreCase(e[k] || '', keys[k])));

export const downloadEntry = async ({ id, title, artist, query, finalName, extraMeta }, record) => {
  const base = sanitize(finalName);
  const temp = path.join(TEMP_DIR, `${base}.%(ext)s`);
  const final = path.join(OUT_DIR, `${base}.${FORMAT}`);

  try {
    await exec(`yt-dlp ${YTDLP_FLAGS} -o "${temp}" "${query}"`);
    const file = (await fs.readdir(TEMP_DIR))
      .find(f => f.startsWith(base) && f.endsWith(`.${FORMAT}`));

    if (!file) {
      warn(`No ${FORMAT} found for "${finalName}"`);
      return { success: false, reason: `No ${FORMAT} file found` };
    }

    await fs.rename(path.join(TEMP_DIR, file), final);
    const newEntry = { id, title, artist, ...extraMeta };
    record.push(newEntry);
    success(`Downloaded: "${finalName}"`);
    return { success: true, entry: newEntry };
  } catch (err) {
    error(`Failed "${finalName}": ${err.message}`);
    return { success: false, reason: err.message };
  }
};

export const processEntries = async (entries, record, buildMeta, sourceLabel) => {
  const successful = [], failed = [];
  let downloaded = 0, skipped = 0, modified = false;

  for (const e of entries) {
    const meta = buildMeta(e);
    if (!meta) continue;

    if (recordExists(record, meta.checkKeys)) {
      warn(`Skipped (already): "${meta.finalName}"`);
      skipped++;
      continue;
    }

    const result = await downloadEntry(meta, record);
    if (result.success) {
      successful.push(result.entry);
      downloaded++;
      modified = true;
    } else {
      failed.push({ ...meta.checkKeys, title: meta.title, reason: result.reason });
    }
  }

  if (modified) await saveRecord(record);
  summary(`${sourceLabel} done: downloaded ${downloaded}, skipped ${skipped}`);
  return { successful, failed };
};
