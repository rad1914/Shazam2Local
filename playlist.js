// @path: playlist.js
import { promisify } from 'util';
import { exec as _exec } from 'child_process';
import { sanitize, error, info } from './utils.js';
import { processEntries } from './downloader.js';

const exec = promisify(_exec);

export const processPlaylist = async (playlistUrl, record) => {
  info(`Fetching playlist metadata...`);
  let output;
  try {
    const { stdout } = await exec(
      `yt-dlp --flat-playlist --print "%(id)s\\t%(title)s" "${playlistUrl}"`
    );
    output = stdout.trim().split('\n').filter(Boolean);
  } catch (err) {
    error(`Failed to fetch playlist: ${err.message}`);
    return { successful: [], failed: [] };
  }

  const entries = output.map(line => {
    const [id, titleRaw] = line.split('\t');
    return { id, title: sanitize(titleRaw || id), playlistUrl };
  });

  return processEntries(entries, record, e => ({
    id: e.id,
    title: e.title,
    artist: undefined,
    query: `https://youtu.be/${e.id}`,
    finalName: e.title,
    checkKeys: { id: e.id },
    extraMeta: { playlist: e.playlistUrl }
  }), `Playlist`);
};
