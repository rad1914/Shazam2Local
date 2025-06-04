import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';
import { exec as _exec } from 'child_process';
import { promisify } from 'util';

const exec = promisify(_exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CSV_PATH    = path.join(__dirname, 'library.csv');
const RECORD_PATH = path.join(__dirname, 'downloaded.json');
const OUT_DIR     = path.join(__dirname, 'downloads');
const MIN_BITRATE = 64; // (no longer used, but kept here in case you want to add any bitrate logic)

async function loadRecord() {
  try {
    return JSON.parse(await fs.readFile(RECORD_PATH, 'utf8'));
  } catch {
    await fs.writeFile(RECORD_PATH, '[]');
    return [];
  }
}

async function saveRecord(arr) {
  await fs.writeFile(RECORD_PATH, JSON.stringify(arr, null, 2));
}

async function main() {
  // Ensure output directory exists
  await fs.mkdir(OUT_DIR, { recursive: true });
  const record = await loadRecord();

  let csv;
  try {
    csv = await fs.readFile(CSV_PATH, 'utf8');
  } catch (e) {
    console.error(`Cannot read CSV: ${e.message}`);
    process.exit(1);
  }

  const rows = parse(csv, {
    from_line: 2,
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
  });

  for (let row of rows) {
    const title  = (row.Title  || '').trim();
    const artist = (row.Artist || '').trim();
    if (!title || !artist) continue;

    // Skip if already downloaded
    if (record.some(e => e.title === title && e.artist === artist)) continue;

    // Build search query and output filename
    const query = `${title} ${artist} audio`;
    const escapedTitle  = title.replace(/"/g, '\\"');
    const escapedArtist = artist.replace(/"/g, '\\"');
    const filename = `${escapedTitle} - ${escapedArtist}.opus`;
    const outFile  = path.join(OUT_DIR, filename);

    // Run yt-dlp with opus extraction only
    try {
      await exec(
        `yt-dlp -x --audio-format opus --audio-quality 8 -o "${outFile}" "ytsearch1:${query}"`
      );
    } catch (err) {
      console.error(`Failed to download "${title}" by ${artist}: ${err.message}`);
      continue;
    }

    // Verify that yt-dlp actually produced something
    try {
      await fs.access(outFile);
    } catch {
      console.error(`No file found after download for "${title}" by ${artist}`);
      continue;
    }

    // Record success
    record.push({ title, artist });
    await saveRecord(record);
    console.log(`Downloaded: ${filename}`);
  }
}

main().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
