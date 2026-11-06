#!/usr/bin/env node
/* B8 release evidence gate. Never confuses passing GitHub Actions with a production launch.
 * This checks the SHAPE of operator-supplied evidence; it cannot independently validate
 * the IdP, restored backups, privacy legal approval, monitoring or hosted infrastructure.
 */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const required=[
 'live_oidc_mfa','production_tls_dns','least_privilege_database',
 'staging_cross_module_reconciliation','backup_restore_observed',
 'monitoring_alerts_incident_drill','privacy_dpia_retention_review',
 'privacy_requests_operational','accessibility_performance',
 'deployment_rollback_and_signoff'
];
const value=process.env.FINANCE_RELEASE_EVIDENCE_FILE;
const strict=process.argv.includes('--require-production');
const checkOnly=process.argv.includes('--assert-blocked');
let evidence=null,unreadable=null;
if(value){try{evidence=JSON.parse(readFileSync(resolve(value),'utf8'));}catch{unreadable='Evidence JSON cannot be read or parsed';}}
const blockers=[];
if(!evidence)blockers.push(unreadable||'Operator release-evidence file is absent');
if(evidence){
 if(evidence.environment!=='production')blockers.push('Evidence environment must be production');
 if(!/^https:\/\/[^\s/]+(?:\/[^\s]*)?$/.test(evidence.origin||''))
  blockers.push('A valid HTTPS production origin is required');
 if(!/^[0-9a-f]{40}$/i.test(evidence.releaseCommit||''))
  blockers.push('A complete 40-character release commit SHA is required');
 if(process.env.FINANCE_RELEASE_COMMIT && process.env.FINANCE_RELEASE_COMMIT!==evidence.releaseCommit)
  blockers.push('Evidence does not match the requested deployed commit');
 const entries=evidence.checks && typeof evidence.checks==='object'?evidence.checks:{};
 const now=Date.now();
 for(const name of required){
  const record=entries[name];
  if(!record||record.status!=='VERIFIED'||typeof record.evidenceRef!=='string'||
    !/^https:\/\//.test(record.evidenceRef)||!record.approvedBy||
    !record.verifiedAt||!Number.isFinite(Date.parse(record.verifiedAt))||
    Date.parse(record.verifiedAt)>now+60000||Date.parse(record.verifiedAt)<now-30*24*3600000){
   blockers.push('Missing or stale external verification: '+name);
  }
 }
}
const status=blockers.length?'PRODUCTION_BLOCKED':'EVIDENCE_RECORDED_PENDING_INDEPENDENT_REVIEW';
console.log(JSON.stringify({phase:'B8',status,releaseCommit:evidence?.releaseCommit||null,
 evidenceRefProvided:!!value,requiredEvidenceKeys:required,
 blockers,automaticallyDeploys:false,externalEvidenceCryptographicallyVerified:false},null,2));
if(strict||checkOnly){
 if(strict&&blockers.length)process.exitCode=2;
 if(checkOnly&&!blockers.length)process.exitCode=3;
}
