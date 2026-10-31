import pg from 'pg';
import {loadConfig} from './config.js';
import {createPool} from './db/client.js';
import {buildApp} from './app.js';

const config=loadConfig();
const financePool=createPool(config);
const authPool=config.authDatabaseUrl && (config.localAuthEnabled||config.oidc)
 ? new pg.Pool({connectionString:config.authDatabaseUrl,max:5,connectionTimeoutMillis:4000,
    idleTimeoutMillis:15000,application_name:'finance-os-identity'}) : undefined;
const app=await buildApp({config,database:financePool,financePool,authPool});
async function close(){await app.close();await financePool.end();if(authPool)await authPool.end();}
process.once('SIGTERM',()=>{void close().finally(()=>process.exit(0));});
process.once('SIGINT',()=>{void close().finally(()=>process.exit(0));});
try{await app.listen({port:config.port,host:config.host});}
catch(error){app.log.error(error);await close();process.exitCode=1;}
