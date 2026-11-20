import {readFile,mkdir,rename,rm,stat} from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
async function digest(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
export async function prepare(){
 const {files}=JSON.parse(await readFile(path.join(root,'dependencies.json'),'utf8'));
 for(const entry of files){
  const target=path.resolve(root,entry.path);if(!target.startsWith(root+path.sep))throw Error('Invalid dependency path.');
  try{if((await stat(target)).size===entry.bytes&&await digest(target)===entry.sha256)continue;}catch{}
  console.log('Preparing '+entry.path+' ('+(entry.bytes/1048576).toFixed(1)+' MB)…');await mkdir(path.dirname(target),{recursive:true});
  let lastError;
  for(let attempt=1;attempt<=3;attempt++){
   try{const response=await fetch(entry.url,{signal:AbortSignal.timeout(240000)});if(!response.ok)throw Error('HTTP '+response.status);
    await pipeline(Readable.fromWeb(response.body),createWriteStream(target+'.part'));
    if((await stat(target+'.part')).size!==entry.bytes||await digest(target+'.part')!==entry.sha256)throw Error('Checksum mismatch.');
    await rm(target,{force:true});await rename(target+'.part',target);lastError=null;break;
   }catch(e){lastError=e;await rm(target+'.part',{force:true});if(attempt<3)await new Promise(r=>setTimeout(r,1000));}
  }
  if(lastError)throw Error('Could not prepare '+entry.path+': '+lastError.message+'. Check internet access and run START again.');
 }
 console.log('Dependencies verified. Photos will stay in your browser.');
}
