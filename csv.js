// @path: csv.js
import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { getField, emptyResult, buildCheckKeys } from './utils.js';
import { processEntries } from './downloader.js';

export const processCsv = async (csvPath, record) => {
  const sourceFile = path.basename(csvPath);
  try {
    const raw = (await fs.readFile(csvPath, 'utf8'))
      .replace(/\u0000/g, '')
      .replace(/\r/g, '');

    const lines = raw.split('\n').slice(2).filter(Boolean);
    if (!lines.length) {
      console.error(`❌ Archivo CSV inválido: ${sourceFile}`);
      return emptyResult();
    }

    const headers = ['Index', 'TagTime', 'Title', 'Artist', 'URL', 'TrackKey'];
    const validRows = lines.flatMap((line, i) => {
      try {
        return parse(headers.join(',') + '\n' + line, {
          columns: true,
          relax_quotes: true,
          relax_column_count: true,
          skip_empty_lines: true,
          trim: true
        });
      } catch {
        console.warn(`⚠️ Línea ${i + 3} ignorada por formato inválido`);
        return [];
      }
    });

    const entries = validRows
      .map(r => {
        const title = getField(r, 'Title', 'Song', 'Track Name', 'Name');
        const artist = getField(r, 'Artist', 'Performer', 'Artist Name');
        return title && artist ? { title, artist, sourceFile } : null;
      })
      .filter(Boolean);

    return processEntries(
      entries,
      record,
      e => ({
        title: e.title,
        artist: e.artist,
        query: `ytsearch1:${e.title} ${e.artist}`,
        finalName: `${e.title} - ${e.artist}`,
        checkKeys: buildCheckKeys(e, 'csv'),
        extraMeta: { sourceFile: e.sourceFile }
      }),
      `"${sourceFile}"`
    );
  } catch (err) {
    console.error(`❌ Error reading "${sourceFile}": ${err.message}`);
    return emptyResult();
  }
};
