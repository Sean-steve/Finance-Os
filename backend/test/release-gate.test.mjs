import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const gate=fileURLToPath(new URL('../scripts/release-gate.mjs',import.meta.url));
test('Production launch fails closed without real operator attestations',()=>{
 const run=spawnSync(process.execPath,[gate,'--require-production'],{encoding:'utf8',
  env:{...process.env,FINANCE_RELEASE_EVIDENCE_FILE:''}});
 assert.equal(run.status,2);
 const body=JSON.parse(run.stdout);
 assert.equal(body.status,'PRODUCTION_BLOCKED');
 assert.equal(body.automaticallyDeploys,false);
 assert.equal(body.externalEvidenceCryptographicallyVerified,false);
 assert.ok(body.blockers.some(x=>x.includes('absent')));
});
test('CI-only verification shows blocker report and does not claim a live release',()=>{
 const run=spawnSync(process.execPath,[gate,'--assert-blocked'],{encoding:'utf8',
  env:{...process.env,FINANCE_RELEASE_EVIDENCE_FILE:''}});
 assert.equal(run.status,0);
 assert.equal(JSON.parse(run.stdout).status,'PRODUCTION_BLOCKED');
});
