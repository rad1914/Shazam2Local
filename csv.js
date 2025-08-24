// @path: csv.js
import fs from 'fs/promises';
import { parse } from 'csv-parse/sync';
import path from 'path';
import { getField, emptyResult, buildCheckKeys } from './utils.js';
import { processEntries } from './downloader.js';

export const processCsv = async (csvPath, record) => {
  const sourceFile = path.basename(csvPath);
  try {
    const rows = parse(await fs.readFile(csvPath, 'utf8'), {
      from_line: 2, columns: true, skip_empty_lines: true, relax_quotes: true, trim: true
    });
    const entries = rows.map(r => {
      const title = getField(r, 'Title', 'Song');
      const artist = getField(r, 'Artist', 'Performer');
      return title && artist ? { title, artist, sourceFile } : null;
    }).filter(Boolean);

    return processEntries(entries, record, e => ({
      title: e.title,
      artist: e.artist,
      query: `ytsearch1:${e.title} ${e.artist}`,
      finalName: `${e.title} - ${e.artist}`,
      checkKeys: buildCheckKeys(e, 'csv'),
      extraMeta: { sourceFile: e.sourceFile }
    }), `"${sourceFile}"`);
  } catch (err) {
    console.error(`❌ Error reading "${sourceFile}": ${err.message}`);
    return emptyResult();
  }
};
