import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { exec as _exec } from 'child_process';

const exec = promisify(_exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RECORD_PATH = path.join(__dirname, 'downloaded.json');
const OUT_DIR = path.join(__dirname, 'downloads');
const TEMP_DIR = path.join(__dirname, 'temp');
const FORMAT = 'opus', QUALITY = '3';
const YTDLP_FLAGS = `-x --audio-format ${FORMAT} --audio-quality ${QUALITY}`;

const log = (tag, icon) => msg => console[tag](`${icon} ${msg}`);
const info = log('log', 'ℹ️'), warn = log('warn', '⚠️'), error = log('error', '❌');
const success = log('log', '✔️'), summary = log('log', '📊');

const sanitize = s => s.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
const equalsIgnoreCase = (a = '', b = '') => a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0;

const loadRecord = async () => {
  try {
    return JSON.parse(await fs.readFile(RECORD_PATH, 'utf8'));
  } catch {
    await fs.writeFile(RECORD_PATH, '[]', 'utf8');
    return [];
  }
};
const saveRecord = data => fs.writeFile(RECORD_PATH, JSON.stringify(data, null, 2), 'utf8');

/**
 * Download a YouTube playlist
 */
const processPlaylist = async (playlistUrl, record) => {
  info(`Fetching playlist metadata...`);
  let output;
  try {
    const { stdout } = await exec(
      `yt-dlp --flat-playlist --print "%(id)s\\t%(title)s" "${playlistUrl}"`
    );
    output = stdout.trim().split('\n').filter(Boolean);
  } catch (err) {
    error(`Failed to fetch playlist: ${err.message}`);
    return { successful: [], failed: [] };
  }

  const successfulDownloads = [];
  const failedDownloads = [];
  let downloaded = 0, skipped = 0, modified = false;

  for (const line of output) {
    const [id, titleRaw] = line.split('\t');
    const title = sanitize(titleRaw || id);
    const url = `https://youtu.be/${id}`;

    if (record.some(e => equalsIgnoreCase(e.id, id))) {
      warn(`Skipped (already): "${title}"`);
      skipped++;
      continue;
    }

    const base = sanitize(title);
    const temp = path.join(TEMP_DIR, `${base}.%(ext)s`);
    const final = path.join(OUT_DIR, `${base}.${FORMAT}`);

    info(`Downloading: "${title}"`);

    try {
      await exec(`yt-dlp ${YTDLP_FLAGS} -o "${temp}" "${url}"`);
      const file = (await fs.readdir(TEMP_DIR))
        .find(f => f.startsWith(base) && f.endsWith(`.${FORMAT}`));

      if (!file) {
        warn(`No ${FORMAT} found for "${title}"`);
        failedDownloads.push({ id, title, reason: `No ${FORMAT} file found` });
        continue;
      }

      await fs.rename(path.join(TEMP_DIR, file), final);
      const newEntry = { id, title, playlist: playlistUrl };
      record.push(newEntry);
      successfulDownloads.push(newEntry);
      modified = true;
      downloaded++;
      success(`Downloaded: "${title}"`);
    } catch (err) {
      error(`Failed "${title}": ${err.message}`);
      failedDownloads.push({ id, title, reason: err.message });
    }
  }

  if (modified) await saveRecord(record);
  summary(`Playlist done: downloaded ${downloaded}, skipped ${skipped}`);
  return { successful: successfulDownloads, failed: failedDownloads };
};

(async () => {
  try {
    await exec('yt-dlp --version');
  } catch {
    error('yt-dlp not found in PATH');
    process.exit(1);
  }

  await Promise.all([fs.mkdir(OUT_DIR, { recursive: true }), fs.mkdir(TEMP_DIR, { recursive: true })]);

  const playlistUrl = process.argv[2];
  if (!playlistUrl) {
    error('Usage: node download-playlist.js <playlist-url>');
    process.exit(1);
  }

  const record = await loadRecord();
  const { successful, failed } = await processPlaylist(playlistUrl, record);

  // --- Final summary ---
  summary(`\n📊 Session summary:`);
  success(`Successful: ${successful.length}`);
  failed.length > 0
    ? error(`Failed: ${failed.length}`)
    : info(`Failed: 0`);

  if (successful.length > 0) {
    console.log('\n✔️ Successful downloads:');
    successful.forEach(({ title }) => console.log(`   - ${title}`));
  }
  if (failed.length > 0) {
    console.log('\n❌ Failed downloads:');
    failed.forEach(({ title, reason }) => console.log(`   - ${title} (${reason})`));
  }

  info('\nAll done!');
})();
