// @path: playlist.js
import { exec } from './exec.js';
import { sanitize, error, info, emptyResult, buildCheckKeys } from './utils.js';
import { processEntries } from './downloader.js';

export const processPlaylist = async (url, record) => {
  info(`Fetching playlist...`);
  try {
    const { stdout } = await exec(`yt-dlp --flat-playlist --print-json "${url}"`);
    const entries = stdout.trim().split('\n').map(line => {
      try {
        const d = JSON.parse(line);
        return { id: d.id, title: sanitize(d.title || d.id), playlistUrl: url };
      } catch { return null; }
    }).filter(Boolean);

    const unique = [...new Map(entries.map(e => [e.id, e])).values()];
    return processEntries(unique, record, e => ({
      id: e.id,
      title: e.title,
      query: `https://youtu.be/${e.id}`,
      finalName: e.title,
      checkKeys: buildCheckKeys(e, 'playlist'),
      extraMeta: { playlist: e.playlistUrl }
    }), 'Playlist');
  } catch (err) {
    error(`Playlist fetch failed: ${err.message}`);
    return emptyResult();
  }
};
