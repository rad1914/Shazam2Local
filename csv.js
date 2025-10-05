// @path: csv.js
import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { getField, emptyResult, buildCheckKeys, normalizeCsvRaw } from './utils/utils.js';
import { processEntries } from './downloader.js';

export const processCsv = async (csvPath, record) => {
  const sourceFile = path.basename(csvPath);
  const failedPath = path.join(path.dirname(csvPath), 'failed.txt');

  try {
    const raw = normalizeCsvRaw(await fs.readFile(csvPath, 'utf8'));

    const lines = raw.split('\n').slice(2).filter(Boolean);
    if (!lines.length) return emptyResult();

    const header = ['Index', 'TagTime', 'Title', 'Artist', 'URL', 'TrackKey'];
    const rows = [];

    for (let i = 0; i < lines.length; i++) {
      try {
        rows.push(...parse(`${header}\n${lines[i]}`, {
          columns: true,
          relax_quotes: true,
          relax_column_count: true,
          skip_empty_lines: true,
          trim: true
        }));
      } catch {
        await fs.appendFile(failedPath, `Line ${i + 3}: ${lines[i]}\n`);
      }
    }

    const entries = rows
      .map(r => {
        const title = getField(r, 'Title', 'Song', 'Track Name', 'Name');
        const artist = getField(r, 'Artist', 'Performer', 'Artist Name');
        return title && artist ? { title, artist, sourceFile } : null;
      })
      .filter(Boolean);

    return processEntries(entries, record, (entry) => ({
      title: entry.title,
      artist: entry.artist,
      query: `ytsearch1:${entry.title} ${entry.artist}`,
      finalName: `${entry.title} - ${entry.artist}`,
      checkKeys: buildCheckKeys(entry, 'csv'),
      extraMeta: { sourceFile }
    }), `"${sourceFile}"`);
  } catch {
    return emptyResult();
  }
};
