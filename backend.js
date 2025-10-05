// @path: backend.js
// @path: csv.js
import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { getField, emptyResult, buildCheckKeys, normalizeCsvRaw } from './utils/utils.js';
import { processEntries } from './downloader.js';

export const processCsv = async (csvPath, record) => {
  const sourceFile = path.basename(csvPath);
  const failedPath = path.join(path.dirname(csvPath), 'failed.txt');

  try {
    const raw = normalizeCsvRaw(await fs.readFile(csvPath, 'utf8'));

    const lines = raw.split('\n').slice(2).filter(Boolean);
    if (!lines.length) return emptyResult();

    const header = ['Index', 'TagTime', 'Title', 'Artist', 'URL', 'TrackKey'];
    const rows = [];

    for (let i = 0; i < lines.length; i++) {
      try {
        rows.push(...parse(`${header}\n${lines[i]}`, {
          columns: true,
          relax_quotes: true,
          relax_column_count: true,
          skip_empty_lines: true,
          trim: true
        }));
      } catch {
        await fs.appendFile(failedPath, `Line ${i + 3}: ${lines[i]}\n`);
      }
    }

    const entries = rows
      .map(r => {
        const title = getField(r, 'Title', 'Song', 'Track Name', 'Name');
        const artist = getField(r, 'Artist', 'Performer', 'Artist Name');
        return title && artist ? { title, artist, sourceFile } : null;
      })
      .filter(Boolean);

    return processEntries(entries, record, (entry) => ({
      title: entry.title,
      artist: entry.artist,
      query: `ytsearch1:${entry.title} ${entry.artist}`,
      finalName: `${entry.title} - ${entry.artist}`,
      checkKeys: buildCheckKeys(entry, 'csv'),
      extraMeta: { sourceFile }
    }), `"${sourceFile}"`);
  } catch {
    return emptyResult();
  }
};
// @path: downloader.js
import path from'path';import{exec}from'./exec.js';import{sanitizeFilename,w,s,e,S,recordMatches,stripFileNoise}from'./utils/utils.js';import{sr,lr}from'./record.js';import{O,Y,C,c as cookiesExist}from'./config.js';const UNAVAILABLE=/Video unavailable|private|not available|rate-limited/i,RATE_LIMIT=/rate[- ]limited|session has been rate-limited/i,outPath=m=>path.join(O,`${sanitizeFilename(m.finalName)}.%(ext)s`),run=cmd=>exec(cmd),searchCandidates=q=>{const b=stripFileNoise(q).trim();return[b,b.replace(/[-–—()].*$/,''),b.split(/\s+/).slice(0,6).join(' '),q].filter(Boolean)},findBySearch=async(q,client)=>{for(const sq of searchCandidates(q))for(const n of[5,10]){const cmd=`yt-dlp --dump-single-json "ytsearch${n}:${sq.replace(/"/g,'\\"')}"${client?` --extractor-args "youtube:player_client=${client}"`:''}`;try{const{stdout}=await run(cmd),{entries=[]}=JSON.parse(stdout);if(entries.length)return entries.map(e=>({id:e.id,url:`https://youtu.be/${e.id}`,title:e.title}))}catch(err){w(`Search fail "${sq}" (${n}): ${(err.stderr||err.message||'').slice(0,150)}`)}}return[]},tryYtDl=(u,m,client,useCookies=!0,sleep=!1)=>run(`yt-dlp ${Y}${useCookies&&cookiesExist()?` --cookies "${C}"`:''}${client?` --extractor-args "youtube:player_client=${client}"`:''}${sleep?' --sleep-interval 5 --max-sleep-interval 10':''} -o "${outPath(m)}" "${u}"`),download=async(m,rec,client)=>{const handleErr=async(err,url,useCookies)=>{const msg=(err.stderr||err.stdout||err.message||'').toString();if(UNAVAILABLE.test(msg)){if(RATE_LIMIT.test(msg)&&useCookies&&cookiesExist()){w(`Rate-limit detected. Retrying "${m.finalName}" without cookies...`),await tryYtDl(url,m,client,!1,!0);return!0}throw new Error(msg)}throw err};if(/^ytsearch/i.test(m.query)){const term=m.query.replace(/^ytsearch\d*:\s*/i,''),results=await findBySearch(term,client);for(const{id,url,title}of results)try{await tryYtDl(url,m,client),rec.push({id,title,artist:m.artist,...m.extraMeta}),s(`Downloaded${client?` (${client})`:''}: "${m.finalName}"`);return}catch(err){try{if(await handleErr(err,url,!0))return}catch{w(`Skip ${id} (${title})`)}}throw new Error('All search candidates failed')}try{await tryYtDl(m.query,m,client),rec.push({id:m.id,title:m.title,artist:m.artist,...m.extraMeta}),s(`Downloaded${client?` (${client})`:''}: "${m.finalName}"`)}catch(err){await handleErr(err,m.query,!0),rec.push({id:m.id,title:m.title,artist:m.artist,...m.extraMeta})}},tryDownload=async(m,rec)=>{const already=a=>recordMatches(a,m.checkKeys);try{if(already(await lr()))return w(`Skip (disk): "${m.finalName}"`),{success:!1,skipped:!0}}catch{w(`Warn: couldn't read downloaded.json`)}if(already(rec))return w(`Skip (session): "${m.finalName}"`),{success:!1,skipped:!0};for(const client of[null,'android','web'])try{if(already(await lr()))return w(`Skip (post-check): "${m.finalName}"`),{success:!1,skipped:!0};await download(m,rec,client),await sr(rec).catch(err=>w(`Write fail after "${m.finalName}": ${err.message}`));return{success:!0}}catch(err){const msg=(err.stderr||err.message||'').toString();if(UNAVAILABLE.test(msg)||client==='web')return e(`Fail "${m.finalName}": ${msg}`),{success:!1,reason:msg};w(`Retrying "${m.finalName}" via ${client??'default'} client...`)}};export const processEntries=async(entries,rec,buildMeta,label)=>{const ok=[],fail=[];let done=0,skip=0,mod=!1;for(const e of entries){const m=buildMeta(e);if(!m)continue;if(recordMatches(rec,m.checkKeys)){w(`Skip: "${m.finalName}"`),skip++;continue}const res=await tryDownload(m,rec);if(res.skipped){skip++;continue}res.success?(ok.push(m),done++,mod=!0):fail.push({...m.checkKeys,title:m.title,reason:res.reason})}if(mod)await sr(rec).catch(err=>w(`Write fail: ${err.message}`));return S(`${label} done: downloaded ${done}, skipped ${skip}`),{successful:ok,failed:fail}};
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
// @path: exec.js
import { promisify } from 'util';
import { exec as _exec } from 'child_process';

export const exec = (cmd, opts = {}) => {
  const defaultOpts = { maxBuffer: 10 * 1024 * 1024 };
  return promisify(_exec)(cmd, { ...defaultOpts, ...opts });
};
// @path: index.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from './exec.js';
import { processCsv } from './csv.js';
import { processPlaylist } from './playlist.js';
import { processFilenames } from './filenames.js';
import { lr } from './record.js';
import { O, T } from './config.js';
import { i, w, e, s, S } from './utils/utils.js';

const dir = path.dirname(fileURLToPath(import.meta.url));

const processFolderFiles = async (filterFn, processor, record, noFilesMessage = 'No files found.') => {
  const list = (await fs.readdir(dir)).filter(filterFn);
  if (!list.length) return w(noFilesMessage);
  const sessionDownloaded = [];
  for (const filename of list) {
    i(`Processing ${filename}`);
    const res = await processor(path.join(dir, filename), record);
    sessionDownloaded.push(...(res.successful || []));
  }
  if (sessionDownloaded.length) {
    S('\n📊 Downloads this session:');
    sessionDownloaded.forEach(({ title, artist }) => s(artist ? `"${title}" by ${artist}` : `"${title}"`));
  } else {
    i('No new songs downloaded.');
  }
};

(async () => {
  try {
    await exec('yt-dlp --version');
  } catch {
    e('yt-dlp not found in PATH');
    process.exit(1);
  }

  await Promise.all([O, T].map(d => fs.mkdir(d, { recursive: true })));

  const [, , mode, arg] = process.argv;
  if (!mode) {
    e('Usage:\n  node index.js csv\n  node index.js playlist <url>\n  node index.js filenames');
    process.exit(1);
  }

  const record = await lr();

  const handlers = {
    csv: () => processFolderFiles(f => f.endsWith('.csv'), processCsv, record, 'No CSV files found.'),
    playlist: async () => {
      if (!arg) {
        e('Usage: node index.js playlist <url>');
        process.exit(1);
      }
      const { successful, failed } = await processPlaylist(arg, record);
      S('\n📊 Session summary:');
      s(`Successful: ${successful.length}`);
      if (failed.length) e(`Failed: ${failed.length}`);
      else i('Failed: 0');
      successful.length && console.log('\n✔️ Successful:', successful.map(x => `- ${x.title}`).join('\n'));
      failed.length && console.log('\n❌ Failed:', failed.map(x => `- ${x.title} (${x.reason})`).join('\n'));
    },
    filenames: () => processFolderFiles(f => f === 'filenames.txt', processFilenames, record, 'No filenames.txt found.')
  };

  if (!handlers[mode]) {
    e(`Unknown mode: ${mode}`);
    process.exit(1);
  }

  await handlers[mode]();
  i('\nAll done!');
})();
// @path: utils/record.js
import { readFile, writeFile, copyFile, rename } from 'fs/promises';
import { join } from 'path';
import { dirFromMeta } from './utils/utils.js';

const file = join(dirFromMeta(import.meta.url), 'downloaded.json');

export const lr = async () => {
  try {
    const d = JSON.parse(await readFile(file, 'utf8'));
    if (!Array.isArray(d)) throw 0;
    return d;
  } catch {
    await writeFile(file, '[]');
    return [];
  }
};

export const sr = async (d) => {
  try {
    await copyFile(file, file + '.bak');
  } catch {

  }

  const tmp = file + '.tmp';
  await writeFile(tmp, JSON.stringify(d));
  await rename(tmp, file);
};
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
