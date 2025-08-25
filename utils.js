// @path: utils.js
const timestamp = () => `[${new Date().toISOString()}]`;

export const log = (tag, icon) => msg =>
  console[tag](`${timestamp()} ${icon} ${msg}`);

export const info = log('log', 'ℹ️');
export const warn = log('warn', '⚠️');
export const error = log('error', '❌');
export const success = log('log', '✔️');
export const summary = log('log', '📊');

export const sanitize = s =>
  s.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();

export const equalsIgnoreCase = (a = '', b = '') =>
  a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0;

export const getField = (row, ...fields) =>
  fields.map(f => row[f]?.trim()).find(Boolean) || '';

export const emptyResult = () => ({ successful: [], failed: [] });

export const buildCheckKeys = (entry, type) => {
  if (type === 'csv') return { title: entry.title, artist: entry.artist };
  if (type === 'playlist') return { id: entry.id };
  if (type === 'filenames') return { title: entry.title };
  return {};
};
