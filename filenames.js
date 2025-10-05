// @path: filenames.js
import fs from 'fs/promises';
import path from 'path';
import { i, w, e, emptyResult, buildCheckKeys, stripFileNoise, extractDisplayName } from './utils/utils.js';
import { processEntries } from './downloader.js';

export const processFilenames = async (filePath, rec) => {
  const filename = path.basename(filePath);
  try {
    const lines = (await fs.readFile(filePath, 'utf8')).split('\n').map(a => a.trim()).filter(Boolean);
    if (!lines.length) {
      w(`No filenames in "${filename}"`);
      return emptyResult();
    }

    const mapped = lines.map(line => {
      const rawName = extractDisplayName(line);
      const title = stripFileNoise(rawName) || rawName;
      return { title, fileLine: line };
    });

    return processEntries(mapped, rec, e_ => ({
      title: e_.title,
      query: `ytsearch1:${e_.title}`,
      finalName: e_.title,
      checkKeys: buildCheckKeys(e_, 'filenames'),
      extraMeta: { sourceFile: filename }
    }), `"${filename}"`);
  } catch (err) {
    e(`❌ Error reading "${filename}": ${err.message}`);
    return emptyResult();
  }
};
