import {prepare} from './prepare.mjs';
try{await prepare();await import('./server.mjs');}catch(e){console.error('\nLight Studio: '+e.message);process.exitCode=1;}
