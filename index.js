// @path: index.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { exec as _exec } from 'child_process';

import { error, warn, info, summary, success } from './utils.js';
import { loadRecord } from './record.js';
import { processCsv } from './csv.js';
import { processPlaylist } from './playlist.js';

const exec = promisify(_exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OUT_DIR = path.join(__dirname, 'downloads');
const TEMP_DIR = path.join(__dirname, 'temp');

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
      const { successful } = await processCsv(path.join(__dirname, file), record);
      allNewDownloads.push(...successful);
    }

    if (allNewDownloads.length > 0) {
      summary(`\n📊 All successful downloads this session:`);
      allNewDownloads.forEach(({ title, artist }) => {
        success(artist ? `"${title}" by ${artist}` : `"${title}"`);
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
