'use strict';
/* Finance OS priority visual reconstruction regression tests.
 * Checks DOM/grid relationships, native interactions, and responsive safety.
 * These are functional/render gates, not a claim of pixel certification. */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { strict: assert } = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const artifacts = path.join(root, 'qa-artifacts', 'priority-screen-fidelity');
fs.mkdirSync(artifacts, { recursive:true });
const url = 'http://127.0.0.1:8897/rebuild.html#screen/';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
 const server = spawn('python3', ['-m', 'http.server', '8897', '--bind', '127.0.0.1', '--directory', root], { stdio:'ignore' });
 const errors = [], failures = [], successes = [];
 let browser;
 const check = async (name, fn) => { try { await fn(); successes.push(name); console.log('PASS', name); } catch(error) { const issue = name + ': ' + error.message; failures.push(issue); console.error('FAIL', issue); } };
 try {
  for(let i = 0; i < 65; i++) { try { if((await fetch(url + '1')).ok) break; } catch (_) {} await sleep(160); }
  browser = await chromium.launch({headless:true, args:['--no-sandbox']});
  const page = await browser.newPage({viewport:{width:1536, height:1024}, acceptDownloads:true});
  page.setDefaultTimeout(7000);
  page.on('pageerror', error => errors.push(error.message));
  const go = async screen => { await page.goto(url+screen); await page.locator('.fo-priority-'+screen).waitFor(); };
  const sectionArea = async name => page.locator('[data-fo-section="'+name+'"]').evaluate(node => ({
    named: node.dataset.foSection, area: getComputedStyle(node).gridArea,
    visible:node.getBoundingClientRect().width>0
  }));
  await check('Screen 01: approved desktop, tablet, mobile and authentication states remain native DOM',async()=>{
   await go(1);
   assert.equal(await page.locator('.auth-showcase>section').count(),3);
   assert.equal(await page.locator('.auth-state-examples>div').count(),4);
   assert.equal(await page.locator('#auth-form').count(),1);
   assert.equal(await page.locator('img').count(),0);
   const password = page.locator('#auth-form input[name="password"]');
   await password.fill('test-password-only');
   await page.locator('[data-fo-toggle-password]').click();
   assert.equal(await password.getAttribute('type'),'text');
   await page.locator('[data-fo-toggle-password]').click();
   assert.equal(await password.getAttribute('type'),'password');
   assert.match(await page.locator('#fo-demo-auth-notice').innerText(),/no real credentials/i);
  });
  await check('Screen 42: source grid order, interactive scenario builder and scenario comparisons',async()=>{
   await go(42);
   assert.equal(await page.locator('.cap-grid>[data-fo-section]').count(),9);
   assert.equal((await sectionArea('builder')).area,'builder');
   assert.equal((await sectionArea('projections')).area,'projections');
   assert.equal(await page.locator('.fo-42-plot path[stroke]').count(),4);
   await page.locator('form[data-capform="scenario"] input[name="incomeGrowth"]').fill('12');
   await page.locator('form[data-capform="scenario"] button[type="submit"]').click();
   await page.locator('.fo-42-plot').waitFor();
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('finance-os-exact-rebuild-demo-v1')).capitalV2.scenario.incomeGrowth);
   assert.equal(saved,12);
   assert.equal((await sectionArea('builder')).area,'builder');
  });
  await check('Screen 29: stacked twelve-month chart, source table and growth plan in approved positions',async()=>{
   await go(29);
   assert.equal(await page.locator('.cf-grid>[data-fo-section]').count(),9);
   assert.equal((await sectionArea('forecast')).area,'forecast');
   assert.equal((await sectionArea('scenarios')).area,'scenarios');
   assert.equal((await sectionArea('growth')).area,'growth');
   assert.equal(await page.locator('.fo-29-plot rect').count(),60);
   assert.ok(await page.locator('[data-fo-section="sources"] table tbody tr').count() >= 1);
  });
  await check('Screen 24: guardrail rule matrix, local purchase check and approval queue state',async()=>{
   await go(24);
   assert.equal(await page.locator('.sp-grid>[data-fo-section]').count(),9);
   assert.equal((await sectionArea('rules')).area,'rules');
   assert.equal((await sectionArea('queue')).area,'queue');
   assert.equal(await page.locator('[data-fo-section="rules"] table thead th').count(),7);
   const form = page.locator('form[data-spform="purchase"]');
   await form.locator('input[name="amount"]').fill('40000');
   await form.locator('button[type="submit"]').click();
   await page.locator('.fo-purchase-result').waitFor();
   assert.match(await page.locator('.fo-purchase-result').innerText(),/no real bank transaction/i);
   await page.locator('[data-sp="approval:0:approve"]').click();
   assert.equal(await page.locator('.sp-grid [data-fo-section="queue"] .fo-approval-status').count(),1);
   const result=await page.evaluate(()=>JSON.parse(localStorage.getItem('finance-os-exact-rebuild-demo-v1')).spendV2.approvals[0]);
   assert.equal(result,'Approved');
  });
  await check('Screen 43: debt dashboard grid, dynamic balances and optimizer routing',async()=>{
   await go(43);
   assert.equal(await page.locator('.pr-grid>[data-fo-section]').count(),9);
   assert.equal((await sectionArea('breakdown')).area,'breakdown');
   assert.equal((await sectionArea('strategies')).area,'strategies');
   assert.ok(await page.locator('[data-fo-section="breakdown"] .fo-debt-balance').count()>=3);
   await page.locator('[data-pr="optimizer"]').first().click();
   assert.equal(new URL(page.url()).hash,'#screen/45');
  });
  await check('Priority screens: phone layout no horizontal overflow',async()=>{
   await page.setViewportSize({width:390, height:844});
   for(const id of [1,42,29,24,43]){
    await go(id);
    const widths = await page.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:window.innerWidth}));
    assert.ok(widths.content<=widths.viewport+2,'screen '+id+' overflows: '+JSON.stringify(widths));
    await page.screenshot({path:path.join(artifacts,'screen-'+String(id).padStart(2,'0')+'-mobile.png'),fullPage:true});
   }
  });
  await check('Priority screens: desktop captures and reference route integrity',async()=>{
   await page.setViewportSize({width:1536,height:1024});
   for(const id of [1,42,29,24,43]){
    await go(id);
    assert.ok(await page.locator('[data-action="compare"]').count()>0);
    await page.screenshot({path:path.join(artifacts,'screen-'+String(id).padStart(2,'0')+'-desktop.png'),fullPage:true});
   }
  });
  await check('No uncaught client-side errors',async()=>assert.deepEqual(errors,[]));
  fs.writeFileSync(path.join(artifacts,'results.json'),JSON.stringify({successes,failures,errors},null,2));
  console.log('Priority screen checks:',successes.length,'passed,',failures.length,'failed');
  if(failures.length)process.exitCode=1;
 } finally {
  if(browser)await browser.close();
  server.kill('SIGTERM');
 }
}
main().catch(error=>{console.error(error);process.exitCode=1});
