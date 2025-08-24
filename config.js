// @path: config.js
import path from 'path';
import { getDirname } from './paths.js';

const __dirname = getDirname(import.meta.url);

export const OUT_DIR = path.join(__dirname, 'downloads');
export const TEMP_DIR = path.join(__dirname, 'temp');
export const FORMAT = 'opus';

// Default yt-dlp flags with Android client workaround for SABR
export const YTDLP_FLAGS =
  `-x --no-playlist --restrict-filenames --audio-format=${FORMAT} --audio-quality=3 --extractor-args "youtube:player_client=android"`;
