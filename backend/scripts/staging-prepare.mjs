#!/usr/bin/env node
// Create ONLY a non-secret public staging SPA API config in a private host path.
// Never changes the public GitHub Pages connected-config.json.
import {mkdir,lstat,rename,writeFile} from 'node:fs/promises';
import {dirname,resolve,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {validateStaging} from './staging-readiness.mjs';

export async function prepareStaging(env=process.env){
 const cfg=validateStaging(env);
 if(!cfg.valid)throw Error('Staging configuration is blocked: '+cfg.problems.join('; '));
 const defaultOutput=fileURLToPath(new URL('../deploy/private/connected-config.json',import.meta.url));
 const path=env.FINANCE_STAGE_WEB_CONFIG_FILE||defaultOutput;
 if(!isAbsolute(path))throw Error('FINANCE_STAGE_WEB_CONFIG_FILE must be an absolute host path');
 const target=resolve(path);
 if(target===resolve(fileURLToPath(new URL('../../connected-config.json',import.meta.url))))
  throw Error('Refusing to overwrite public GitHub Pages connected-config.json');
 const parent=dirname(target);
 await mkdir(parent,{recursive:true,mode:0o700});
 try{const info=await lstat(target);if(info.isSymbolicLink()||!info.isFile())throw Error('Staging config target is not a regular file');}
 catch(err){if(err.code!=='ENOENT')throw err;}
 const temp=target+'.'+randomBytes(5).toString('hex')+'.tmp';
 try{
  await writeFile(temp,JSON.stringify({apiBase:cfg.apiOrigin},null,2)+'\n',{mode:0o600,flag:'wx'});
  await rename(temp,target);
 }catch(e){throw Error('Failed to generate non-secret staged API configuration: '+e.message);}
 return {status:'STAGING_WEB_CONFIG_PREPARED',configFile:target,apiOrigin:cfg.apiOrigin,
  productionReady:false,identityProvisioned:false,stagingApiReachable:false};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+resolve(process.argv[1])).href){
 try{console.log(JSON.stringify(await prepareStaging(),null,2));}
 catch(e){console.error(JSON.stringify({status:'STAGING_BLOCKED',reason:e.message}));process.exitCode=2;}
}
