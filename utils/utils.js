// @path: utils/utils.js
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const timeStamp = () => `[${new Date().toISOString()}]`;
const loggerFactory = (method, label) => (msg) => console[method](`${timeStamp()} ${label} ${msg}`);

export const i = loggerFactory('log', 'ℹ️');
export const w = loggerFactory('warn', '⚠️');
export const e = loggerFactory('error', '❌');
export const s = loggerFactory('log', '✔️');
export const S = loggerFactory('log', '📊');

export const sanitizeFilename = (name) => name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();

export const equalsIgnoreCase = (a = '', b = '') =>
  a.localeCompare(b, void 0, { sensitivity: 'base' }) === 0;

export const getField = (obj = {}, ...keys) =>
  keys.map(k => (obj[k] || '').toString().trim()).find(Boolean) || '';

export const emptyResult = () => ({ successful: [], failed: [] });

export const buildCheckKeys = (obj = {}, type = '') => {
  if (type === 'csv') return { title: obj.title, artist: obj.artist };
  if (type === 'playlist') return { id: obj.id };
  if (type === 'filenames') return { title: obj.title };
  return {};
};

export const recordMatches = (records = [], keys = {}) =>
  records.some(rec => Object.keys(keys).every(k => equalsIgnoreCase((rec[k] || ''), (keys[k] || ''))));

export const dirFromMeta = (metaUrl) => dirname(fileURLToPath(metaUrl));

export const decodeEscapes = (s = '') =>
  s.replace(/\\u([0-9a-fA-F]{4})/g, (_, g1) => String.fromCharCode(parseInt(g1, 16)));

export const normalizeCsvRaw = (raw = '') =>
  raw.replace(/\u0000/g, '').replace(/\r/g, '').replace(/\(From\s+"([^"]+)"\)/g, "(From '$1')");

export const stripFileNoise = (s) => {
  if (!s) return s;
  s = decodeEscapes(s);
  s = s.replace(/\+/g, ' ');
  s = s.replace(/[_\-]{2,}/g, ' ');
  s = s.replace(/\b\d+\s*bits\b/ig, '');
  s = s.replace(/\b(?:mp3|m4a|flac|wav|aac|ogg)\b/ig, '');
  s = s.replace(/\b(?:F10Musica|ADD|media-store)\b/ig, '');
  s = s.replace(/(?:\b128kbps\b|\b320kbps\b)/ig, '');
  s = s.replace(/[\u0000-\u001F]+/g, '');
  s = s.replace(/[<>:"/\\|?*\x00-\x1F]+/g, ' ');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
};

export const extractDisplayName = (line = '') => {
  try {
    const decoded = decodeEscapes(line);
    const dnMatch = decoded.match(/(?:\b|&|\?|p\s?dn=|dn=)([^&\n]+)/i);
    if (dnMatch && dnMatch[1]) {
      try {
        return decodeURIComponent(dnMatch[1].replace(/\+/g, ' ')).trim();
      } catch {
        return dnMatch[1].replace(/\+/g, ' ').trim();
      }
    }
    const tail = decoded.split('/').pop().replace(/\.[^/.]+$/, '').trim();
    return tail;
  } catch {
    return line.replace(/\.[^/.]+$/, '').trim();
  }
};
