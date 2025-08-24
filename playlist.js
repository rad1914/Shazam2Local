// @path: playlist.js
import { exec } from './exec.js';
import { sanitize, error, info, emptyResult, buildCheckKeys } from './utils.js';
import { processEntries } from './downloader.js';

export const processPlaylist = async (playlistUrl, record) => {
  info(`Fetching playlist metadata...`);
  let output;
  try {
    const { stdout } = await exec(
      `yt-dlp --flat-playlist --print-json "${playlistUrl}"`
    );
    output = stdout.trim().split('\n').filter(Boolean);
  } catch (err) {
    error(`Failed to fetch playlist: ${err.message}`);
    return emptyResult();
  }

  const entries = output.map(line => {
    try {
      const data = JSON.parse(line);
      return { id: data.id, title: sanitize(data.title || data.id), playlistUrl };
    } catch {
      return null;
    }
  }).filter(Boolean);

  const unique = new Map(entries.map(e => [e.id, e]));
  const finalEntries = Array.from(unique.values());

  return processEntries(finalEntries, record, e => ({
    id: e.id,
    title: e.title,
    artist: undefined,
    query: `https://youtu.be/${e.id}`,
    finalName: e.title,
    checkKeys: buildCheckKeys(e, 'playlist'),
    extraMeta: { playlist: e.playlistUrl }
  }), `Playlist`);
};
