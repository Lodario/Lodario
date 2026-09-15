import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'));
const directory=path.resolve('.local-backups/country-beta');fs.mkdirSync(directory,{recursive:true});
const run=(file,args=[])=>execFileSync(process.execPath,[file,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true,timeout:600000});
const outcome={checkedAt:new Date().toISOString(),backup:false,retention:false,mailRetention:false,healthy:false};
try {
  const records=fs.readdirSync(directory).filter(n=>/^backup-.*\.json$/.test(n)).map(n=>JSON.parse(fs.readFileSync(path.join(directory,n),'utf8')));
  const recent=records.some(r=>r.files.some(f=>f.name.endsWith('-recovery.dump'))&&Date.now()-Date.parse(r.createdAt)<23*3600000&&r.files.every(f=>path.basename(f.name)===f.name&&fs.existsSync(path.join(directory,f.name))));
  if(!recent)run('scripts/database/backup.mjs');
  outcome.backup=true;
}catch{outcome.backup=false;}
try{run('scripts/database/retention.mjs',['--apply']);outcome.retention=true;}catch{outcome.retention=false;}
try{run('scripts/database/mail-retention.mjs',['--apply']);outcome.mailRetention=true;}catch{outcome.mailRetention=false;}
try{const response=await fetch('https://lodario.vercel.app/api/health',{signal:AbortSignal.timeout(15000)});outcome.healthy=response.ok&&(await response.json()).status==='ok';}catch{outcome.healthy=false;}
fs.writeFileSync(path.join(directory,'maintenance-status.json'),JSON.stringify(outcome,null,2));
console.log(JSON.stringify(outcome));
if(!outcome.backup||!outcome.retention||!outcome.mailRetention||!outcome.healthy)process.exitCode=1;
