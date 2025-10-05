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
