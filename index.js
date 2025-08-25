// @path: index.js
import fs from 'fs/promises';
import path from 'path';
import { exec } from './exec.js';
import { getDirname } from './paths.js';
import { error, warn, info, summary, success } from './utils.js';
import { loadRecord } from './record.js';
import { processCsv } from './csv.js';
import { processPlaylist } from './playlist.js';
import { processFilenames } from './filenames.js';
import { OUT_DIR, TEMP_DIR } from './config.js';

const __dirname = getDirname(import.meta.url);

(async () => {
  try {
    await exec('yt-dlp --version');
  } catch {
    return error('yt-dlp not found in PATH'), process.exit(1);
  }

  await Promise.all([OUT_DIR, TEMP_DIR].map(d => fs.mkdir(d, { recursive: true })));

  const [,, mode, arg] = process.argv;
  if (!mode) return error('Usage:\n  node index.js csv\n  node index.js playlist <url>\n  node index.js filenames'), process.exit(1);

  const record = await loadRecord();

  if (mode === 'csv') {
    const csvFiles = (await fs.readdir(__dirname)).filter(f => f.toLowerCase().endsWith('.csv'));
    if (!csvFiles.length) return warn('No CSV files found.');

    const allNew = [];
    for (const file of csvFiles) {
      info(`\nProcessing "${file}"`);
      const { successful } = await processCsv(path.join(__dirname, file), record);
      allNew.push(...successful);
    }

    allNew.length
      ? (summary('\n📊 Downloads this session:'), allNew.forEach(({ title, artist }) =>
          success(artist ? `"${title}" by ${artist}` : `"${title}"`)))
      : info('\nNo new songs were downloaded.');
  }

  else if (mode === 'playlist') {
    if (!arg) return error('Usage: node index.js playlist <url>'), process.exit(1);

    const { successful, failed } = await processPlaylist(arg, record);

    summary(`\n📊 Session summary:`);
    success(`Successful: ${successful.length}`);
    failed.length ? error(`Failed: ${failed.length}`) : info(`Failed: 0`);

    if (successful.length) {
      console.log('\n✔️ Successful downloads:');
      successful.forEach(({ title }) => console.log(`   - ${title}`));
    }
    if (failed.length) {
      console.log('\n❌ Failed downloads:');
      failed.forEach(({ title, reason }) => console.log(`   - ${title} (${reason})`));
    }
  }

  else if (mode === 'filenames') {
    const txtFiles = (await fs.readdir(__dirname)).filter(f => f.toLowerCase() === 'filenames.txt');
    if (!txtFiles.length) return warn('No filenames.txt found.');

    const allNew = [];
    for (const file of txtFiles) {
      info(`\nProcessing "${file}"`);
      const { successful } = await processFilenames(path.join(__dirname, file), record);
      allNew.push(...successful);
    }

    allNew.length
      ? (summary('\n📊 Downloads this session:'), allNew.forEach(({ title }) =>
          success(`"${title}"`)))
      : info('\nNo new songs were downloaded.');
  }

  else {
    error(`Unknown mode: ${mode}`);
    process.exit(1);
  }

  info('\nAll done!');
})();
