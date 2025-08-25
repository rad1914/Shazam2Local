// @path: filenames.js
import fs from 'fs/promises';
import path from 'path';
import { info, warn, error, emptyResult, success, buildCheckKeys } from './utils.js';
import { processEntries } from './downloader.js';

export const processFilenames = async (txtPath, record) => {
  const sourceFile = path.basename(txtPath);
  try {
    const raw = await fs.readFile(txtPath, 'utf8');
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

    if (!lines.length) {
      warn(`No filenames found in "${sourceFile}"`);
      return emptyResult();
    }

    const entries = lines.map(line => {

      const clean = line.replace(/^\.\/(a\/)?/, '');

      const base = clean.replace(/\.[^/.]+$/, '');
      return { title: base, fileLine: line };
    });

    return processEntries(entries, record, e => ({
      title: e.title,
      query: `ytsearch1:${e.title}`,
      finalName: e.title,
      checkKeys: buildCheckKeys(e, 'filenames'),
      extraMeta: { sourceFile }
    }), `"${sourceFile}"`);
  } catch (err) {
    error(`❌ Error reading "${sourceFile}": ${err.message}`);
    return emptyResult();
  }
};
