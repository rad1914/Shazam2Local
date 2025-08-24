// @path: downloader.js
import path from 'path';
import { exec } from './exec.js';
import { sanitize, equalsIgnoreCase, warn, success, error, summary } from './utils.js';
import { saveRecord } from './record.js';
import { OUT_DIR, FORMAT, YTDLP_FLAGS } from './config.js';

export const recordExists = (record, keys) =>
  record.some(e => Object.keys(keys).every(k => equalsIgnoreCase(e[k] || '', keys[k])));

export const downloadEntry = async (meta, record) => {
  const final = path.join(OUT_DIR, `${sanitize(meta.finalName)}.${FORMAT}`);
  try {
    await exec(`yt-dlp ${YTDLP_FLAGS} -o "${final}" "${meta.query}"`);
    record.push({ id: meta.id, title: meta.title, artist: meta.artist, ...meta.extraMeta });
    success(`Downloaded: "${meta.finalName}"`);
    return { success: true };
  } catch (err) {
    error(`Failed "${meta.finalName}": ${err.message}`);
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
      warn(`Skipped: "${meta.finalName}"`);
      skipped++;
      continue;
    }

    const result = await downloadEntry(meta, record);
    if (result.success) {
      successful.push(meta);
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
