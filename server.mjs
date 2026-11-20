import http from 'node:http';
import {stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.onnx':'application/octet-stream','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
const server=http.createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)||path.relative(root,file).split(path.sep).some(p=>p.startsWith('.'))){res.writeHead(403).end();return;}
  const info=await stat(file);if(!info.isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
  if(req.method==='HEAD')res.end();else createReadStream(file).on('error',()=>res.destroy()).pipe(res);
 }catch{res.writeHead(404).end('Not found');}
});
let port=Number(process.env.PORT||4197),attempts=0;
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('PORT must be an integer between 1024 and 65535.');
server.on('error',e=>{if(e.code==='EADDRINUSE'&&attempts++<20&&port<65535){port++;server.listen(port,'127.0.0.1');}else{console.error(e.message);process.exitCode=1;}});
server.on('listening',()=>{
 const url='http://127.0.0.1:'+port+'/';console.log('\nLight Studio is ready: '+url+'\nKeep this window open. Press Ctrl+C to stop.');
 if(process.argv.includes('--open')){
  const args=process.platform==='win32'?['cmd.exe',['/c','start','',url]]:process.platform==='darwin'?['open',[url]]:['xdg-open',[url]];
  const child=spawn(args[0],args[1],{stdio:'ignore',detached:true,windowsHide:true});child.on('error',()=>console.log('Open the link above in your browser.'));child.unref();
 }
});
server.listen(port,'127.0.0.1');
