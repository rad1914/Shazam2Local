// @path: index.js
import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';
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
const getField = (row, ...fields) => fields.map(f => row[f]?.trim()).find(Boolean) || '';

const loadRecord = async () => {
  try {
    return JSON.parse(await fs.readFile(RECORD_PATH, 'utf8'));
  } catch {
    await fs.writeFile(RECORD_PATH, '[]', 'utf8');
    return [];
  }
};
const saveRecord = data => fs.writeFile(RECORD_PATH, JSON.stringify(data, null, 2), 'utf8');

const processCsv = async (csvPath, record) => {
  const sourceFile = path.basename(csvPath);
  let rows;
  const successfulDownloads = [];

  try {
    const content = await fs.readFile(csvPath, 'utf8');
    rows = parse(content, { from_line: 2, columns: true, skip_empty_lines: true, relax_quotes: true });
  } catch (err) {
    error(`Error reading "${sourceFile}": ${err.message}`);
    return successfulDownloads;
  }

  let downloaded = 0, skipped = 0, modified = false;

  for (const row of rows) {
    const title = getField(row, 'Title', 'Song'), artist = getField(row, 'Artist', 'Performer');
    if (!title || !artist) continue;

    if (record.some(e => 
      equalsIgnoreCase(e.title, title) && 
      equalsIgnoreCase(e.artist, artist)
    )) {
      warn(`Skipped (already): "${title}" by ${artist}`);
      skipped++;
      continue;
    }

    const base = `${sanitize(title)} - ${sanitize(artist)}`;
    const temp = path.join(TEMP_DIR, `${base}.%(ext)s`);
    const final = path.join(OUT_DIR, `${base}.${FORMAT}`);
    const query = `ytsearch1:${title} ${artist}`;

    info(`Searching: ${query}`);

    try {
      await exec(`yt-dlp ${YTDLP_FLAGS} -o "${temp}" "${query}"`);
      const file = (await fs.readdir(TEMP_DIR)).find(f => f.startsWith(base) && f.endsWith(`.${FORMAT}`));
      if (!file) {
        warn(`No ${FORMAT} found for "${title}"`);
        continue;
      }

      await fs.rename(path.join(TEMP_DIR, file), final);
      const newEntry = { title, artist, sourceFile };
      record.push(newEntry);
      successfulDownloads.push(newEntry);
      modified = true;
      downloaded++;
      success(`Downloaded: "${title}" by ${artist}`);
    } catch (err) {
      error(`Failed "${title}" by ${artist}: ${err.message}`);
    }
  }

  if (modified) await saveRecord(record);
  summary(`"${sourceFile}": downloaded ${downloaded}, skipped ${skipped}`);
  return successfulDownloads;
};

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

  const mode = process.argv[2];
  if (!mode) {
    error('Usage:\n  node index.js csv\n  node index.js playlist <playlist-url>');
    process.exit(1);
  }

  const record = await loadRecord();

  if (mode === 'csv') {
    const csvFiles = (await fs.readdir(__dirname)).filter(f => f.toLowerCase().endsWith('.csv'));
    if (!csvFiles.length) {
      warn('No CSV files found.');
      return;
    }

    const allNewDownloads = [];
    for (const file of csvFiles) {
      info(`\nProcessing "${file}"`);
      const newDownloads = await processCsv(path.join(__dirname, file), record);
      allNewDownloads.push(...newDownloads);
    }

    if (allNewDownloads.length > 0) {
      summary(`\n📊 All successful downloads this session:`);
      allNewDownloads.forEach(({ title, artist }) => {
        success(`"${title}" by ${artist}`);
      });
    } else {
      info('\nNo new songs were downloaded in this session.');
    }

  } else if (mode === 'playlist') {
    const playlistUrl = process.argv[3];
    if (!playlistUrl) {
      error('Usage: node index.js playlist <playlist-url>');
      process.exit(1);
    }

    const { successful, failed } = await processPlaylist(playlistUrl, record);

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
  } else {
    error(`Unknown mode: ${mode}`);
    process.exit(1);
  }

  info('\nAll done!');
})();
