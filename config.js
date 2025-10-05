// @path: config.js
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const O = path.join(__dirname, 'downloads');
export const T = path.join(__dirname, 'temp');

export const A = 'opus';
export const X = '%(ext)s';

export const Y =
  `-x --no-playlist --restrict-filenames --audio-format=${A} --audio-quality=0 -f bestaudio --postprocessor-args "ffmpeg:-ar 48000 -ac 2" `;

export const C = path.join(__dirname, 'cookies.txt');
export const c = () => {
  try {
    return fs.existsSync(C);
  } catch {
    return false;
  }
};
