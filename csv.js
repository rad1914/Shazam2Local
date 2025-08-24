// @path: csv.js
import fs from 'fs/promises';
import { parse } from 'csv-parse/sync';
import path from 'path';

import { getField, emptyResult, buildCheckKeys } from './utils.js';
import { processEntries } from './downloader.js';

export const processCsv = async (csvPath, record) => {
  const sourceFile = path.basename(csvPath);
  let rows;
  try {
    const content = await fs.readFile(csvPath, 'utf8');
    rows = parse(content, {
      from_line: 2,
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      trim: true
    });
  } catch (err) {
    console.error(`❌ Error reading "${sourceFile}": ${err.message}`);
    return emptyResult();
  }

  const entries = rows.map(row => {
    const title = getField(row, 'Title', 'Song');
    const artist = getField(row, 'Artist', 'Performer');
    if (!title || !artist) return null;
    return { title, artist, sourceFile };
  }).filter(Boolean);

  return processEntries(entries, record, e => ({
    id: undefined,
    title: e.title,
    artist: e.artist,
    query: `ytsearch1:${e.title} ${e.artist}`,
    finalName: `${e.title} - ${e.artist}`,
    checkKeys: buildCheckKeys(e, 'csv'),
    extraMeta: { sourceFile: e.sourceFile }
  }), `"${sourceFile}"`);
};
