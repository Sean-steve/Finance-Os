/* Finance OS — reference-led correction layer for Screens 01, 42, 29, 24 and 43.
 * Reorders existing, delegated-event DOM instead of duplicating financial state.
 * Metrics and projections remain labelled local demonstrations. */
(() => {
  'use strict';
  const app = document.getElementById('app');
  if (!app) return;
  const storageKey = 'finance-os-exact-rebuild-demo-v1';
  const state = () => { try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch (_) { return {}; } };
  const escapeText = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const amount = value => 'KES ' + Math.round(Math.max(0, Number(value) || 0)).toLocaleString('en-KE');
  const numeric = value => Number(String(value || '').replace(/[^\d.-]/g, '')) || 0;
  const textTitle = (node, value) => { const h = node && node.querySelector('h2'); if (h) h.textContent = value; };
  const sectionNames = (grid, keys) => {
    if (!grid) return [];
    const children = Array.from(grid.children);
    keys.forEach((key, index) => { if (children[index]) children[index].dataset.foSection = key; });
    return children;
  };

  function enhanceAuth(page) {
    page.id = 'main';
    page.setAttribute('role', 'main');
    page.setAttribute('tabindex', '-1');
    const storyBrand = page.querySelector('.story-top');
    if (storyBrand) storyBrand.innerHTML = '<span class="fo-logo-icon" aria-hidden="true">◯</span><b>Finance OS</b><small>Build discipline. Create freedom.</small>';
    const login = page.querySelector('.auth-login');
    if (login) login.insertAdjacentHTML('afterbegin', '<div class="fo-auth-language" aria-label="Selected language">◎ &nbsp; English &nbsp;⌄</div>');
    const pw = page.querySelector('#auth-form input[name="password"]');
    if (pw) {
      pw.setAttribute('minlength', '4');
      pw.setAttribute('aria-describedby', 'fo-demo-auth-notice');
      const label = pw.closest('label');
      if (label) {
        label.classList.add('fo-password-wrap');
        label.insertAdjacentHTML('beforeend', '<button type="button" class="fo-password-toggle" data-fo-toggle-password aria-label="Show password" aria-pressed="false">◉</button>');
      }
    }
    const form = page.querySelector('.auth-form');
    if (form) form.insertAdjacentHTML('beforeend', '<p id="fo-demo-auth-notice" class="fo-auth-disclaimer">Prototype sign-in only — no real credentials are verified. Please do not enter an actual password.</p>');
    const foot = page.querySelector('.auth-foot');
    if (foot) {
      const paragraphs = foot.querySelectorAll('p');
      if (paragraphs[0]) paragraphs[0].innerHTML = '<span aria-hidden="true">♧</span> <strong>Private-by-design preview</strong><br><small>No live bank connection or server authentication</small>';
      if (paragraphs[1]) paragraphs[1].innerHTML = '<span aria-hidden="true">◇</span> <strong>You control your data</strong><br><small>Clear the local demonstration from Settings</small>';
      if (paragraphs[2]) paragraphs[2].innerHTML = '<span aria-hidden="true">▯</span> <strong>Accessible anywhere</strong><br><small>Responsive web, mobile and tablet layouts</small>';
    }
    page.querySelectorAll('.auth-mini-form').forEach(preview => preview.setAttribute('aria-label', 'Visual layout preview; use the main sign-in form'));
    page.querySelectorAll('.auth-mini-submit').forEach(preview => preview.setAttribute('aria-hidden', 'true'));
  }

  function enhance42(page) {
    const grid = page.querySelector('.cap-grid');
    const sections = sectionNames(grid, ['projections','outcomes','cashflow','builder','goals','whatif','comparison','insights','export']);
    if (sections.length < 9) return;
    textTitle(sections[1], 'Key Outcomes · illustrative');
    textTitle(sections[5], 'What-If Scenarios');
    const form = sections[3].querySelector('form');
    const snapshot = state().capitalV2 || {};
    const firstKpi = page.querySelector('.cap-kpi b');
    const initial = numeric(firstKpi && firstKpi.textContent) || 800000;
    const growth = Number(form && form.querySelector('[name="incomeGrowth"]')?.value) || 5;
    const expense = Number(form && form.querySelector('[name="expenseGrowth"]')?.value) || 3;
    const investment = Number(form && form.querySelector('[name="investmentReturn"]')?.value) || 6;
    const annual = Math.max(-.12, Math.min(.20, (growth * .55 + investment * .24 - expense * .38) / 100));
    const slopes = [annual + .07, annual, annual - .05, annual - .13];
    const colors = ['#0aaa7b','#217de4','#f2ae25','#ed4565'];
    const labels = ['Optimistic','Base Case','Conservative','Stress Case'];
    const xs = Array.from({length:6}, (_, i) => 51 + i * 107);
    const scenarios = slopes.map(rate => xs.map((_, i) => Math.max(initial * .28, initial * Math.pow(1 + rate, i))));
    const max = Math.max(initial * 1.05, ...scenarios.flat()) * 1.06;
    const min = Math.max(0, Math.min(...scenarios.flat()) * .78);
    const y = n => Math.round(196 - 157 * (n - min) / Math.max(1, max - min));
    const path = values => values.map((value, i) => (i ? 'L' : 'M') + xs[i] + ' ' + y(value)).join(' ');
    const gridLines = Array.from({length:5}, (_, i) => '<line x1="50" x2="610" y1="' + (39 + i * 39) + '" y2="' + (39 + i * 39) + '" stroke="#e9f0f1"/><text x="3" y="' + (42 + i * 39) + '" font-size="10" fill="#6d8297">' + amount(max - i * (max - min) / 4).replace('KES ', '') + '</text>').join('');
    const graph = '<svg class="fo-42-plot" viewBox="0 0 625 250" role="img" aria-label="Illustrative optimistic, base case, conservative and stress scenario comparison. These lines are sensitivities, not a financial forecast">' +
      gridLines + scenarios.map((series, i) => '<path d="' + path(series) + '" fill="none" stroke="' + colors[i] + '" stroke-width="2.6" stroke-dasharray="' + (i ? '6 5' : '7 4') + '"/>' + series.map((v, k) => '<circle cx="' + xs[k] + '" cy="' + y(v) + '" r="3.2" fill="' + colors[i] + '"/>').join('')).join('') +
      xs.map((x, i) => '<text x="' + x + '" y="225" text-anchor="middle" font-size="11" fill="#426187">Year ' + i + '</text>').join('') + '</svg>' +
      '<div class="fo-series-legend">' + labels.map((label, i) => '<span><i style="--fo-color:' + colors[i] + '"></i>' + label + '</span>').join('') + '</div>' +
      '<p class="fo-projection-note">Comparison illustration based on your local assumptions; not guaranteed future values.</p>';
    const oldChart = sections[0].querySelector('svg');
    if (oldChart) {
      oldChart.insertAdjacentHTML('beforebegin', graph);
      oldChart.remove();
    }
    const oldActions = sections[0].querySelector('.cap-actions');
    if (oldActions) oldActions.remove();
    const outcomeRows = sections[1].querySelectorAll('.cap-row');
    outcomeRows.forEach((r, i) => {
      if (i > 3) return;
      const icon = r.querySelector('.cap-ic');
      if (icon) { icon.textContent = ['✓','✦','◆','!'][i]; icon.style.setProperty('--fo-accent', colors[i]); }
    });
    const headline = sections[0].querySelector('h2');
    if (headline) headline.insertAdjacentHTML('afterend', '<span class="fo-panel-hint">Compare possible paths from today</span>');
  }

  function enhance29(page) {
    const grid = page.querySelector('.cf-grid');
    const blocks = sectionNames(grid, ['forecast','summary','gap','sources','growth','scenarios','monthly','mix','insights']);
    if (blocks.length < 9) return;
    textTitle(blocks[0], 'Income Forecast (12 Months)');
    textTitle(blocks[3], 'Forecast by Income Source');
    textTitle(blocks[4], 'Income Growth Plan');
    textTitle(blocks[6], 'Monthly Forecast Breakdown');
    textTitle(blocks[7], 'Projected Annual Income Mix');
    textTitle(blocks[8], 'Key Insights & Recommendations');
    const model = state().incomeFlowV2 || {};
    const incomes = (model.incomes || []).filter(income => income.status === 'Active');
    const months = Array.from(blocks[6].querySelectorAll('tbody tr')).slice(0,12).map(row => ({
      label: row.cells[0]?.textContent.trim().split(' ')[0] || '',
      sum: numeric(row.cells[1]?.textContent)
    }));
    if (!months.length) return;
    const cats = ['Salary','Business','Freelance','Investments','Other'];
    const portions = [0,0,0,0,0];
    incomes.forEach(item => {
      const kind = String(item.category || '').toLowerCase();
      const index = kind.includes('salary') || kind.includes('employment') ? 0 :
        kind.includes('business') ? 1 : kind.includes('freelance') ? 2 :
        kind.includes('invest') || kind.includes('trading') ? 3 : 4;
      portions[index] += Math.max(0, Number(item.amount) || 0);
    });
    const total = portions.reduce((a,b) => a + b, 0) || 1;
    const shares = portions.map(p => p / total);
    const colors = ['#21be83','#2d94ef','#ad55eb','#ffbb36','#9baab9'];
    const max = Math.max(...months.map(m => m.sum), 1) * 1.12;
    const bars = months.map((m,i) => {
      const x = 47 + i * 47, h = m.sum / max * 170;
      let top = 206;
      return shares.map((p,j) => {
        const sh = h*p, rect = '<rect x="' + x + '" y="' + (top-sh).toFixed(1) + '" width="30" height="' + sh.toFixed(1) + '" rx="1" fill="' + colors[j] + '"/>';
        top -= sh; return rect;
      }).join('') + '<text x="' + (x+15) + '" y="226" text-anchor="middle" font-size="10" fill="#506c88">' + escapeText(m.label) + '</text>';
    }).join('');
    const points = months.map((m,i) => (i ? 'L' : 'M') + (62 + i*47) + ' ' + (206 - m.sum / max * 170 - 6).toFixed(1)).join(' ');
    const svg = '<svg class="fo-29-plot" viewBox="0 0 635 245" role="img" aria-label="Projected monthly income stacked by active income-source category, with total projection line">' +
      Array.from({length:5},(_,i) => '<line x1="34" y1="' + (38+i*42) + '" x2="619" y2="' + (38+i*42) + '" stroke="#ebf0f4"/><text x="0" y="' + (41+i*42) + '" font-size="10" fill="#64809a">' + Math.round(max*(4-i)/4/1000) + 'K</text>').join('') +
      bars + '<path d="' + points + '" fill="none" stroke="#167ce5" stroke-width="2" stroke-dasharray="5 4"/>' +
      months.map((m,i)=>'<circle cx="' + (62+i*47) + '" cy="' + (206-m.sum/max*170-6).toFixed(1) + '" r="3.5" fill="#167ce5"/>').join('') + '</svg>' +
      '<div class="fo-series-legend">' + cats.map((cat,i)=>'<span><i style="--fo-color:' + colors[i] + '"></i>' + cat + '</span>').join('') + '<span><i style="--fo-color:#167ce5"></i>Total forecast</span></div>';
    const oldSvg = blocks[0].querySelector('svg');
    if (oldSvg) { oldSvg.insertAdjacentHTML('beforebegin', svg); oldSvg.remove(); }
    const summary = blocks[1];
    const target = page.querySelectorAll('.cf-metric strong');
    if (target.length >= 4) {
      const targetLabel = page.querySelectorAll('.cf-metric small');
      if (targetLabel[1]) targetLabel[1].textContent = 'Annual income target';
    }
    if (summary) summary.querySelectorAll('.cf-row').forEach((row,i) => row.dataset.foRank = String(i+1));
  }

  function enhance24(page) {
    const grid = page.querySelector('.sp-grid');
    const blocks = sectionNames(grid, ['rules','queue','check','impact','risk','recommendations','blocked','activity','settings']);
    if (blocks.length < 9) return;
    const guardTable = blocks[0].querySelector('table');
    if (guardTable && guardTable.querySelectorAll('thead th').length === 6) {
      const headers = guardTable.querySelectorAll('thead th');
      if (headers[2]) headers[2].insertAdjacentHTML('beforebegin', '<th scope="col">Type</th>');
      guardTable.querySelectorAll('tbody tr').forEach(row => {
        const condition = row.cells[2]?.textContent || '';
        const desc = row.cells[1]?.textContent || '';
        const type = /recurr|subscription/i.test(desc + condition) ? 'Recurring Rule' :
          /travel|location/i.test(desc + condition) ? 'Location Rule' :
          /merchant/i.test(desc + condition) ? 'Merchant Rule' :
          /spend|amount|purchase|limit|cap/i.test(desc + condition) ? 'Amount Limit' : 'Category Rule';
        if (row.cells[2]) row.cells[2].insertAdjacentHTML('beforebegin','<td><span class="fo-rule-type">' + type + '</span></td>');
      });
    }
    const demo = state().spendV2 || {};
    const decisions = demo.approvals || {};
    const queueItems = blocks[1].querySelectorAll('.sp-plan-item');
    queueItems.forEach((item,i) => {
      const decision = decisions[i];
      const message = item.querySelector('small');
      if (decision) {
        if (message) message.textContent = message.textContent.replace('Awaiting review', decision + ' locally');
        item.classList.add('fo-reviewed');
        item.querySelectorAll('[data-sp^="approval:"]').forEach(button => { button.disabled = true; button.setAttribute('aria-disabled','true'); });
        item.insertAdjacentHTML('beforeend','<strong class="fo-approval-status">' + escapeText(decision) + '</strong>');
      }
    });
    const kpis = page.querySelectorAll('.sp-kpi b');
    if (kpis.length >= 4) {
      const applied = Object.values(decisions);
      kpis[2].textContent = String(Math.max(0,3-applied.length));
      kpis[3].textContent = String(47+applied.filter(d=>d==='Approved').length);
    }
    const last = demo.lastPurchase;
    if (last) {
      const form = blocks[2].querySelector('form');
      if (form) {
        const safeDecision = escapeText(last.decision);
        form.insertAdjacentHTML('beforebegin', '<div class="fo-purchase-result" role="status"><b>Last local check: ' + safeDecision + '</b><small>' +
          escapeText(last.merchant) + ' · ' + amount(last.amt) + '</small><small>No real bank transaction was approved, blocked or initiated.</small></div>');
      }
    }
  }

  function enhance43(page) {
    const grid = page.querySelector('.pr-grid');
    const blocks = sectionNames(grid, ['breakdown','balance','actions','commitments','progress','insights','accounts','strategies','alerts']);
    if (blocks.length < 9) return;
    textTitle(blocks[5], 'AI Debt Insights · illustrative');
    textTitle(blocks[7], 'Payoff Strategies');
    const all = state().protectionV2?.debts || [];
    const balances = all.reduce((map, item) => { map[item.kind] = (map[item.kind] || 0) + Number(item.balance || 0); return map; }, {});
    blocks[0].querySelectorAll('.pr-legend-row').forEach(row => {
      const name = row.querySelector('.grow')?.textContent.trim() || '';
      const bal = balances[name];
      if (Number.isFinite(bal)) {
        const pct = row.querySelector('b');
        if (pct) pct.insertAdjacentHTML('beforebegin', '<span class="fo-debt-balance">' + amount(bal).replace('KES ','') + '</span>');
      }
    });
    const chart = blocks[1].querySelector('svg');
    if (chart) chart.setAttribute('aria-label','Illustrative debt-balance trend; lender balances are tracked in the debt table');
  }

  function enhance() {
    const match = location.hash.match(/screen\/(\d+)/);
    const id = Number(match?.[1] || 1);
    const selector = {1:'.auth-reconstruction',42:'.cap-page',29:'.cfpage',24:'.spend-page',43:'.pr-page'}[id];
    if (!selector) return;
    const page = app.querySelector(selector);
    if (!page || page.dataset.foReady === String(id)) return;
    page.dataset.foReady = String(id);
    page.classList.add('fo-priority-' + id);
    if (id === 1) enhanceAuth(page);
    if (id === 42) enhance42(page);
    if (id === 29) enhance29(page);
    if (id === 24) enhance24(page);
    if (id === 43) enhance43(page);
  }

  const observer = new MutationObserver(() => enhance());
  observer.observe(app, {childList:true});
  document.addEventListener('click', event => {
    const toggle = event.target.closest('[data-fo-toggle-password]');
    if (!toggle) return;
    event.preventDefault();
    const field = document.querySelector('#auth-form input[name="password"]');
    if (!field) return;
    const revealing = field.type === 'password';
    field.type = revealing ? 'text' : 'password';
    toggle.setAttribute('aria-label', revealing ? 'Hide password' : 'Show password');
    toggle.setAttribute('aria-pressed', String(revealing));
    toggle.textContent = revealing ? '◌' : '◉';
    field.focus();
  }, true);
  enhance();
})();