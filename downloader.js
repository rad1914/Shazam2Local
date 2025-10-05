// @path: downloader.js
import path from 'path';
import { exec } from './exec.js';
import { z, w, k, s, e, S, r } from './utils/utils.js';
import { sr, lr } from './record.js';
import { O, Y, C, c } from './config.js';

const UNAVAILABLE_RE = /Video unavailable|This video is private|This content isn’t available|This video is unavailable|This live stream recording is not available|Cannot extract video/i;

const runYtDl = async (cmd) => {
  const res = await exec(cmd);
  return res;
};

const findAvailableBySearch = async (query, client) => {
  const safeQuery = query.replace(/"/g, '\\"');
  const dumpCmd = `yt-dlp --dump-single-json "ytsearch5:${safeQuery}"${client ? ` --extractor-args "youtube:player_client=${client}"` : ''}`;
  try {
    const { stdout } = await exec(dumpCmd);
    const data = JSON.parse(stdout);
    const entries = Array.isArray(data.entries) ? data.entries : (data.entries ? data.entries : []);
    return entries.map(e => ({ id: e.id, url: `https://youtu.be/${e.id}`, title: e.title }));
  } catch (err) {
    return [];
  }
};

const dl = async (m, rec, client) => {
  const out = path.join(O, `${z(m.finalName)}.%(ext)s`);
  const cookie = c() ? ` --cookies "${C}"` : '';
  const clArg = client ? ` --extractor-args "youtube:player_client=${client}"` : '';

  if (typeof m.query === 'string' && /^ytsearch/i.test(m.query)) {
    const term = m.query.replace(/^ytsearch\d*:\s*/i, '');
    const candidates = await findAvailableBySearch(term, client);
    if (!candidates.length) throw new Error('No results from ytsearch');
    for (const entry of candidates) {
      try {
        await runYtDl(`yt-dlp ${Y}${cookie}${clArg} -o "${out}" "${entry.url}"`);
        rec.push({ id: entry.id, title: m.title, artist: m.artist, ...m.extraMeta });
        s(`Downloaded${client ? ` (${client})` : ''}: "${m.finalName}"`);
        return;
      } catch (err) {
        const msg = (err.stderr || err.stdout || err.message || '').toString();
        if (UNAVAILABLE_RE.test(msg)) throw new Error(msg);
        w(`Failed candidate ${entry.id} for "${m.finalName}": ${msg}`);
      }
    }
    throw new Error('All search candidates failed');
  }

  await runYtDl(`yt-dlp ${Y}${cookie}${clArg} -o "${out}" "${m.query}"`);
  rec.push({ id: m.id, title: m.title, artist: m.artist, ...m.extraMeta });
  s(`Downloaded${client ? ` (${client})` : ''}: "${m.finalName}"`);
};

export const tryDownload = async (m, rec) => {
  try {
    const disk = await lr();
    if (r(disk, m.checkKeys)) {
      w(`Already recorded on-disk, skipping: "${m.finalName}"`);
      return { success: false, skipped: true, reason: 'already_recorded' };
    }
  } catch (err) {
    w(`Warning: couldn't read downloaded.json before download attempt: ${err.message}`);
  }

  if (r(rec, m.checkKeys)) {
    w(`Already recorded in session, skipping: "${m.finalName}"`);
    return { success: false, skipped: true, reason: 'already_recorded_in_session' };
  }

  for (const client of [null, 'android', 'web']) {
    try {
      await dl(m, rec, client);
      return { success: true };
    } catch (err) {
      const msg = (err.stderr || err.stdout || err.message || '').toString();
      if (UNAVAILABLE_RE.test(msg)) {
        e(`Failed "${m.finalName}": ${msg}`);
        return { success: false, reason: msg };
      }
      if (client === 'web') {
        e(`Failed "${m.finalName}": ${msg}`);
        return { success: false, reason: msg };
      }
      w(`Retrying "${m.finalName}" with ${client ?? 'default'} client...`);
    }
  }
};

export const p = async (entries, rec, buildMeta, label) => {
  const sArr = [], f = []; let d = 0, sk = 0, m = false;
  for (const ee of entries) {
    const mObj = buildMeta(ee); if (!mObj) continue;
    if (r(rec, mObj.checkKeys)) { w(`Skipped: "${mObj.finalName}"`); sk++; continue }
    const res = await tryDownload(mObj, rec);
    if (res.skipped) { sk++; continue }
    if (res.success) { sArr.push(mObj); d++; m = true } else f.push({ ...mObj.checkKeys, title: mObj.title, reason: res.reason });
  }
  if (m) await sr(rec);
  S(`${label} done: downloaded ${d}, skipped ${sk}`);
  return { successful: sArr, failed: f };
};
