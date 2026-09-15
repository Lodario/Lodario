import fs from 'node:fs';
import dotenv from 'dotenv';
import { ImapFlow } from 'imapflow';
const env=dotenv.parse(fs.readFileSync('.env.local'));
const apply=process.argv.includes('--apply');
const label='Lodario Support';
const cutoff=new Date();cutoff.setUTCFullYear(cutoff.getUTCFullYear()-1);
const client=new ImapFlow({host:'imap.gmail.com',port:993,secure:true,auth:{user:env.GMAIL_SMTP_USER,pass:env.GMAIL_SMTP_APP_PASSWORD},logger:false,connectionTimeout:15000,socketTimeout:30000,disableAutoIdle:true});
client.on('error',()=>{});
let count=0;
try{
  await client.connect();
  if(!client.capabilities.has('X-GM-EXT-1')||!client.capabilities.has('UIDPLUS'))throw Error('Required Gmail/UID safety features unavailable.');
  let folders=await client.list();
  if(apply&&!folders.some(f=>f.path===label)){await client.mailboxCreate(label);folders=await client.list();}
  const trash=folders.find(f=>f.specialUse==='\\Trash');
  if(!trash)throw Error('Trash folder could not be identified safely.');
  // Only app-generated feedback and mail explicitly labelled by the support operator.
  // No message bodies, subjects, addresses, IDs or credentials are logged.
  const query={before:cutoff,or:[{subject:'Lodario Beta Feedback ['},{gmailRaw:'label:"Lodario Support"'}]};
  for(const folder of folders.filter(f=>['\\All','\\Junk','\\Trash'].includes(f.specialUse))) {
    const lock=await client.getMailboxLock(folder.path,{readOnly:!apply});
    let moved=[];
    try{
      const matches=await client.search(query,{uid:true});if(!matches?.length)continue;
      const eligible=[];
      for await(const message of client.fetch(matches,{uid:true,internalDate:true},{uid:true}))
        if(message.internalDate&&new Date(message.internalDate)<cutoff)eligible.push(message.uid);
      count+=eligible.length;if(!apply||!eligible.length)continue;
      if(folder.path===trash.path)await client.messageDelete(eligible,{uid:true});
      else{
        const result=await client.messageMove(eligible,trash.path,{uid:true});
        if(!result?.uidMap)throw Error('Trash UID mapping unavailable; moved messages retained in Trash.');
        moved=[...result.uidMap.values()];
      }
    }finally{lock.release();}
    if(moved.length){const trashLock=await client.getMailboxLock(trash.path);try{await client.messageDelete(moved,{uid:true});}finally{trashLock.release();}}
  }
  console.log(JSON.stringify({mailRetention:true,mode:apply?'applied':'dry-run',eligibleMessages:count,months:12,manualSupportLabel:label}));
}catch{
  console.error('Mail retention could not complete. Check Gmail IMAP access and the configured app password.');process.exitCode=1;
}finally{try{await client.logout();}catch{client.close();}}
