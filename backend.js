// @path: backend.js
// @path: csv.js
import fs from'fs/promises';import path from'path';import{parse}from'csv-parse/sync';import{g,n,k}from'./utils/utils.js';import{p}from'./downloader.js';

export const a=async(c,r)=>{const s=path.basename(c),f=path.join(path.dirname(c),'failed.txt');try{const raw=(await fs.readFile(c,'utf8')).replace(/\u0000|\r/g,'').replace(/\(From\s+"([^"]+)"\)/g,"(From '$1')"),lines=raw.split('\n').slice(2).filter(Boolean);if(!lines.length)return n();const h=['Index','TagTime','Title','Artist','URL','TrackKey'],rows=[];for(let i=0;i<lines.length;i++){try{rows.push(...parse(`${h}\n${lines[i]}`,{columns:!0,relax_quotes:!0,relax_column_count:!0,skip_empty_lines:!0,trim:!0}))}catch{await fs.appendFile(f,`Line ${i+3}: ${lines[i]}\n`)}}const e=rows.map(r=>{const t=g(r,'Title','Song','Track Name','Name'),a=g(r,'Artist','Performer','Artist Name');return t&&a?{title:t,artist:a,sFile:s}:null}).filter(Boolean);return p(e,r,e=>({title:e.title,artist:e.artist,query:`ytsearch1:${e.title} ${e.artist}`,finalName:`${e.title} - ${e.artist}`,checkKeys:k(e,'csv'),extraMeta:{sourceFile:s}}),`"${s}"`)}catch{return n()}};
// @path: downloader.js
import path from 'path';
import { exec } from './exec.js';
import { z, w, s, e, S, r } from './utils/utils.js';
import { sr, lr } from './record.js';
import { O, Y, C, c } from './config.js';

const dl = async (m, rec, client) => {
  const out = path.join(O, `${z(m.finalName)}.%(ext)s`),
        cookie = c() ? ` --cookies "${C}"` : '',
        clArg = client ? ` --extractor-args "youtube:player_client=${client}"` : '';
  await exec(`yt-dlp ${Y}${cookie}${clArg} -o "${out}" "${m.query}"`);
  rec.push({ id: m.id, title: m.title, artist: m.artist, ...m.extraMeta });
  s(`Downloaded${client ? ` (${client})` : ''}: "${m.finalName}"`);
};

export const tryDownload = async (m, rec) => {
  for (const client of [null,'android','web']) {
    try {
      if (r(await lr(), m.checkKeys)) { w(`Already recorded, skipping: "${m.finalName}"`); return {success:false,skipped:true,reason:'already_recorded'} }
      await dl(m, rec, client);
      return {success:true};
    } catch(err) {
      if(client==='web'){ e(`Failed "${m.finalName}": ${err.message}`); return {success:false,reason:err.message} }
      w(`Retrying "${m.finalName}" with ${client??'default'} client...`);
    }
  }
};

export const p = async (entries, rec, buildMeta, label) => {
  const s=[],f=[]; let d=0,sk=0,m=false;
  for(const ee of entries){
    const mObj = buildMeta(ee); if(!mObj) continue;
    if(r(rec,mObj.checkKeys)){ w(`Skipped: "${mObj.finalName}"`); sk++; continue }
    const res = await tryDownload(mObj,rec);
    if(res.skipped){ sk++; continue }
    if(res.success){ s.push(mObj); d++; m=true } else f.push({...mObj.checkKeys,title:mObj.title,reason:res.reason});
  }
  if(m) await sr(rec);
  S(`${label} done: downloaded ${d}, skipped ${sk}`);
  return {successful:s,failed:f};
};
// @path: playlist.js
import{exec}from'./exec.js';import{z,e,i,n,k}from'./utils/utils.js';import{p}from'./downloader.js';export const c=async(u,r)=>{i('Fetching playlist...');try{const{stdout}=await exec(`yt-dlp --flat-playlist --print-json "${u}"`),a=stdout.trim().split('\n').map(l=>{try{const d=JSON.parse(l);return{id:d.id,title:z(d.title||d.id),u}}catch{return null}}).filter(Boolean),b=[...new Map(a.map(x=>[x.id,x])).values()];return p(b,r,x=>({id:x.id,title:x.title,query:`https://youtu.be/${x.id}`,finalName:x.title,checkKeys:k(x,'playlist'),extraMeta:{playlist:x.u}}),'Playlist')}catch(t){e(`Playlist fetch failed: ${t.message}`);return n()}};
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
  `-x --no-playlist --restrict-filenames -f bestaudio --audio-format=${A} --audio-quality 0 --postprocessor-args "-ar 48000 -ac 2"`;

export const C = path.join(__dirname, 'cookies.txt');
export const c = () => {
  try {
    return fs.existsSync(C);
  } catch {
    return false;
  }
};
// @path: record.js
import { readFile, writeFile, copyFile } from 'fs/promises'; import { join } from 'path'; import { D } from './utils/utils.js'; const f = join(D(import.meta.url), 'downloaded.json'); export const lr=async()=>{try{const d=JSON.parse(await readFile(f,'utf8'));if(!Array.isArray(d))throw 0;return d;}catch{await writeFile(f,'[]');return[];}}; export const sr=async d=>{try{await copyFile(f,f+'.bak');}catch{} await writeFile(f,JSON.stringify(d));};
// @path: exec.js
import { promisify } from 'util';
import { exec as _exec } from 'child_process';

export const exec = promisify(_exec);
// @path: index.js
import fs from'fs/promises';import path from'path';import{fileURLToPath}from'url';import{exec}from'./exec.js';import{a as c}from'./csv.js';import{c as p}from'./playlist.js';import{d as f}from'./filenames.js';import{lr}from'./record.js';import{O,T}from'./config.js';import{i,w,e,s,S}from'./utils/utils.js';
const d=path.dirname(fileURLToPath(import.meta.url)),h=async(F,P,r,m='No files found.')=>{const L=(await fs.readdir(d)).filter(F);if(!L.length)return w(m);const a=[];for(const x of L){i(`Processing ${x}`);const{successful}=await P(path.join(d,x),r);a.push(...successful)}a.length?(S('\n📊 Downloads this session:'),a.forEach(({title:t,artist:A})=>s(A?`"${t}" by ${A}`:`"${t}"`))):i('No new songs downloaded.')};
(async()=>{try{await exec('yt-dlp --version')}catch{e('yt-dlp not found in PATH');process.exit(1)}await Promise.all([O,T].map(d=>fs.mkdir(d,{recursive:!0})));const[,,m,a]=process.argv;if(!m)return e('Usage:\n  node index.js csv\n  node index.js playlist <url>\n  node index.js filenames'),process.exit(1);const r=await lr(),H={csv:()=>h(f=>f.endsWith('.csv'),c,r,'No CSV files found.'),playlist:async()=>{if(!a)return e('Usage: node index.js playlist <url>'),process.exit(1);const{successful,failed}=await p(a,r);S('\n📊 Session summary:'),s(`Successful: ${successful.length}`),failed.length?e(`Failed: ${failed.length}`):i('Failed: 0'),successful.length&&console.log('\n✔️ Successful:',successful.map(x=>`- ${x.title}`).join('\n')),failed.length&&console.log('\n❌ Failed:',failed.map(x=>`- ${x.title} (${x.reason})`).join('\n'))},filenames:()=>h(f=>f==='filenames.txt',f,r,'No filenames.txt found.')};if(!H[m])return e(`Unknown mode: ${m}`),process.exit(1);await H[m]();i('\nAll done!')})();
// @path: utils/utils.js
import{dirname}from'path';import{fileURLToPath}from'url';import{promisify}from'util';import{exec as _exec}from'child_process';
const t=()=>`[${new Date().toISOString()}]`,L=(a,b)=>c=>console[a](`${t()} ${b} ${c}`);
export const i=L('log','ℹ️'),w=L('warn','⚠️'),e=L('error','❌'),s=L('log','✔️'),S=L('log','📊');
export const z=a=>a.replace(/[<>:"/\\|?*\x00-\x1F]/g,'_').trim(),q=(a='',b='')=>a.localeCompare(b,void 0,{sensitivity:'base'})===0,g=(a,...b)=>b.map(c=>a[c]?.trim()).find(Boolean)||'',n=()=>({successful:[],failed:[]});
export const k=(a,b)=>b==='csv'?{title:a.title,artist:a.artist}:b==='playlist'?{id:a.id}:b==='filenames'?{title:a.title}:{},r=(a,b)=>a.some(c=>Object.keys(b).every(d=>q(c[d]||'',b[d]))),D=a=>dirname(fileURLToPath(a)),exec=promisify(_exec);
// @path: filenames.js
import fs from 'fs/promises';
import path from 'path';
import { i,w,e,n,k } from './utils/utils.js';
import { p } from './downloader.js';

export const d = async(t,r)=>{const f=path.basename(t);try{const l=(await fs.readFile(t,'utf8')).split('\n').map(a=>a.trim()).filter(Boolean);if(!l.length)return w(`No filenames in "${f}"`)||n();return p(l.map(a=>({title:a.replace(/^\.\/(a\/)?/,'').replace(/\.[^/.]+$/,''),fileLine:a})),r,e_=>({title:e_.title,query:`ytsearch1:${e_.title}`,finalName:e_.title,checkKeys:k(e_,'filenames'),extraMeta:{sourceFile:f}}),`"${f}"`)}catch(a){return e(`❌ Error reading "${f}": ${a.message}`)||n()}}
