// @path: playlist.js
import { exec } from './exec.js';
import { sanitizeFilename, e as logError } from './utils/utils.js';
import { processEntries } from './downloader.js';

export const processPlaylist = async (url, rec) => {
  try {
    console.log(`[${new Date().toISOString()}] ℹ️ Fetching playlist...`);
    const { stdout } = await exec(`yt-dlp --flat-playlist --print-json "${url}"`);
    const lines = stdout.trim().split('\n');

    const parsed = lines.map(l => {
      try {
        const d = JSON.parse(l);
        return { id: d.id, title: sanitizeFilename(d.title || d.id), u: url };
      } catch {
        return null;
      }
    }).filter(Boolean);

    const uniq = [...new Map(parsed.map(x => [x.id, x])).values()];

    return processEntries(uniq, rec, x => ({
      id: x.id,
      title: x.title,
      query: `https://youtu.be/${x.id}`,
      finalName: x.title,
      checkKeys: { id: x.id },
      extraMeta: { playlist: x.u }
    }), 'Playlist');
  } catch (t) {
    logError(`Playlist fetch failed: ${t.message}`);
    return { successful: [], failed: [] };
  }
};
