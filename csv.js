// @path: csv.js
import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { getField, emptyResult, buildCheckKeys } from './utils.js';
import { processEntries } from './downloader.js';

export const processCsv = async (csvPath, record) => {
  const sourceFile = path.basename(csvPath);
  const failedPath = path.join(path.dirname(csvPath), 'failed.txt');

  try {
    let raw = (await fs.readFile(csvPath, 'utf8'))
      .replace(/\u0000|\r/g, '')
      .replace(/\(From\s+"([^"]+)"\)/g, "(From '$1')");

    const lines = raw.split('\n').slice(2).filter(Boolean);
    if (!lines.length) {
      console.error(`❌ Archivo CSV inválido: ${sourceFile}`);
      return emptyResult();
    }

    const headers = ['Index', 'TagTime', 'Title', 'Artist', 'URL', 'TrackKey'];
    const validRows = [];

    for (let i = 0; i < lines.length; i++) {
      try {
        validRows.push(...parse(headers.join(',') + '\n' + lines[i], {
          columns: true,
          relax_quotes: true,
          relax_column_count: true,
          skip_empty_lines: true,
          trim: true
        }));
      } catch {
        const lineNum = i + 3;
        console.warn(`⚠️ Línea ${lineNum} ignorada por formato inválido`);
        await fs.appendFile(failedPath, `Line ${lineNum}: ${lines[i]}\n`, 'utf8');
      }
    }

    const entries = validRows.map(r => {
      const title = getField(r, 'Title', 'Song', 'Track Name', 'Name');
      const artist = getField(r, 'Artist', 'Performer', 'Artist Name');
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
