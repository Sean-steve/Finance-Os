import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {prepareStaging} from '../scripts/staging-prepare.mjs';
const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const env={
 NODE_ENV:'production',LOCAL_AUTH_ENABLED:'false',
 FINANCE_STAGE_UI_ORIGIN:'https://stage.finance.test-company.org',
 FINANCE_STAGE_API_ORIGIN:'https://api.stage.finance.test-company.org',
 FINANCE_STAGE_IDP_ISSUER:'https://login.stage.finance.test-company.org/realms/finance',
 FINANCE_STAGE_RELEASE_SHA:'b'.repeat(40)
};
test('staging compose binds only loopback and never deploys local-auth or credentials in images',()=>{
 const c=read('../deploy/staging.compose.yaml');
 assert.match(c,/127\.0\.0\.1:3101:3101/);
 assert.match(c,/127\.0\.0\.1:8080:8080/);
 assert.match(c,/NODE_ENV: production/);
 assert.match(c,/LOCAL_AUTH_ENABLED: 'false'/);
 assert.match(c,/FINANCE_STAGE_API_ENV_FILE/);
 assert.match(c,/FINANCE_STAGE_WEB_CONFIG_FILE/);
 assert.doesNotMatch(c,/5432:5432/);
 const api=read('../deploy/api.Dockerfile');
 assert.match(api,/USER finance/);
 assert.match(api,/npm ci --omit=dev/);
 assert.doesNotMatch(api,/COPY \.env/);
 const web=read('../deploy/web.Dockerfile');
 assert.match(web,/COPY connected\.html/);
 assert.doesNotMatch(web,/COPY \./);
});
test('generate only staged public frontend config, preserve no bank credentials',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'finance-b81-'));
 try{
  const path=join(dir,'connected-config.json');
  const r=await prepareStaging({...env,FINANCE_STAGE_WEB_CONFIG_FILE:path});
  assert.equal(r.status,'STAGING_WEB_CONFIG_PREPARED');
  const content=JSON.parse(readFileSync(path,'utf8'));
  assert.deepEqual(content,{apiBase:env.FINANCE_STAGE_API_ORIGIN});
  assert.ok(!JSON.stringify(content).includes('FINANCE_STAGE_IDP_ISSUER'));
  assert.equal(r.productionReady,false);
  assert.equal(r.stagingApiReachable,false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('stage template sets header CSP to exact IdP and API, and prevents prototype serving',()=>{
 const conf=read('../deploy/staging.nginx.conf.template');
 assert.match(conf,/Content-Security-Policy/);
 assert.match(conf,/FINANCE_STAGE_API_ORIGIN/);
 assert.match(conf,/FINANCE_STAGE_IDP_ISSUER/);
 assert.match(conf,/location \/ \{ return 404; \}/);
});
