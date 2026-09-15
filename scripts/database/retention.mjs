import fs from 'node:fs';
import path from 'node:path';
const apply=process.argv.includes('--apply');
const root=fs.realpathSync('.local-backups');
const cutoff=Date.now()-30*86400000;
let removed=0;
for(const name of ['country-beta','pre-18-plus']) {
  const directory=path.join(root,name);if(!fs.existsSync(directory))continue;
  // Never follow junctions/symlinks or recurse beyond the two known backup directories.
  if(fs.lstatSync(directory).isSymbolicLink()||fs.realpathSync(directory)!==directory)throw Error('Unexpected backup directory target.');
  for(const file of fs.readdirSync(directory)) {
    if(!/^lodario-\d{4}-?\d{2}-?\d{2}.*(?:-data\.sql|-schema\.sql|-roles\.sql|-stable-core-data\.sql|-recovery\.dump)$/.test(file))continue;
    const target=path.resolve(directory,file);
    if(path.dirname(target)!==directory||fs.lstatSync(target).isSymbolicLink())throw Error('Unexpected backup file target.');
    // Dump files are immutable; use completion time rather than rounding the date.
    const created=fs.statSync(target).mtimeMs;
    if(created>cutoff)continue;
    console.log((apply?'DELETE ':'WOULD DELETE ')+path.relative(root,target));
    if(apply)fs.unlinkSync(target);removed++;
  }
}
console.log(`${apply?'Removed':'Eligible'} backup files: ${removed}`);
