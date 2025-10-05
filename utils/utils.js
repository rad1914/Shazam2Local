// @path: utils/utils.js
import{dirname}from'path';import{fileURLToPath}from'url';import{promisify}from'util';import{exec as _exec}from'child_process';
const t=()=>`[${new Date().toISOString()}]`,L=(a,b)=>c=>console[a](`${t()} ${b} ${c}`);
export const i=L('log','ℹ️'),w=L('warn','⚠️'),e=L('error','❌'),s=L('log','✔️'),S=L('log','📊');
export const z=a=>a.replace(/[<>:"/\\|?*\x00-\x1F]/g,'_').trim(),q=(a='',b='')=>a.localeCompare(b,void 0,{sensitivity:'base'})===0,g=(a,...b)=>b.map(c=>a[c]?.trim()).find(Boolean)||'',n=()=>({successful:[],failed:[]});
export const k=(a,b)=>b==='csv'?{title:a.title,artist:a.artist}:b==='playlist'?{id:a.id}:b==='filenames'?{title:a.title}:{},r=(a,b)=>a.some(c=>Object.keys(b).every(d=>q(c[d]||'',b[d]))),D=a=>dirname(fileURLToPath(a)),exec=promisify(_exec);
