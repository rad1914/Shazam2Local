// @path: filenames.js
import fs from 'fs/promises';
import path from 'path';
import { i,w,e,n,k } from './utils/utils.js';
import { p } from './downloader.js';

export const d = async(t,r)=>{const f=path.basename(t);try{const l=(await fs.readFile(t,'utf8')).split('\n').map(a=>a.trim()).filter(Boolean);if(!l.length)return w(`No filenames in "${f}"`)||n();return p(l.map(a=>({title:a.replace(/^\.\/(a\/)?/,'').replace(/\.[^/.]+$/,''),fileLine:a})),r,e_=>({title:e_.title,query:`ytsearch1:${e_.title}`,finalName:e_.title,checkKeys:k(e_,'filenames'),extraMeta:{sourceFile:f}}),`"${f}"`)}catch(a){return e(`❌ Error reading "${f}": ${a.message}`)||n()}}
