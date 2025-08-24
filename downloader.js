// @path: downloader.js
import path from 'path';
import { exec } from './exec.js';
import { getDirname } from './paths.js';
import { sanitize, equalsIgnoreCase, warn, success, error, summary } from './utils.js';
import { saveRecord } from './record.js';
import { OUT_DIR, FORMAT, YTDLP_FLAGS } from './config.js';

const __dirname = getDirname(import.meta.url);

export const recordExists = (record, keys) =>
  record.some(e => Object.keys(keys).every(k => equalsIgnoreCase(e[k] || '', keys[k])));

export const downloadEntry = async ({ id, title, artist, query, finalName, extraMeta }, record) => {
  const base = sanitize(finalName);
  const final = path.join(OUT_DIR, `${base}.${FORMAT}`);

  try {
    await exec(`yt-dlp ${YTDLP_FLAGS} -o "${final}" "${query}"`);

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
