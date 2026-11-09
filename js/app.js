'use strict';
/* 앱 뼈대: 매장 전환·메뉴·이동, 첫 실행, 이벤트 연결, 시작 */

/* =====================================================================
 * 6. 셸: 매장 전환, 메뉴, 알림 띠
 * ===================================================================== */
const PAGES = [
  // 메뉴·윗줄·창 제목에 같은 이름을 쓴다 (화면마다 이름이 다르면 헷갈림)
  { id: 'count', label: '재고 세기' },
  { id: 'mov', label: '반출입' },
  { id: 'inv', label: '전체 재고' },
  { id: 'month', label: '월말 정산' },
  { id: 'manage', label: '품목 관리' },
  { id: 'settings', label: '백업' },
];
function renderShell() {
  document.body.dataset.shop = S.shop;
  $('meta[name=theme-color]').content = SHOPS[S.shop].color;
  const sh = SHOPS[S.shop];
  $('#shopSwitch').innerHTML = `<button class="shop-btn" id="shopBtn" aria-expanded="false" aria-controls="shopMenu" aria-label="매장 바꾸기, 지금 ${sh.name}"><span class="shop-ico" aria-hidden="true">${sh.icon}</span>${sh.name}${svg('down')}</button>
    <div class="shop-menu" id="shopMenu" hidden>
      ${Object.entries(SHOPS).map(([k, v]) => `<button class="shop-opt" data-act="shop" data-shop="${k}" aria-current="${k === S.shop}">
        <span class="dot" style="background:${v.color}" aria-hidden="true">${v.icon}</span><span>${v.name}<small>${k === S.shop ? '지금 보는 매장' : '이 매장으로 바꾸기'}</small></span></button>`).join('')}
    </div>`;
  const p = PAGES.find(x => x.id === S.page);
  $('#topTitle').textContent = p.label;
  document.title = `${p.label} · ${sh.name} 재고`;
  const t = todayStr();
  $('#topDate').textContent = `${dShort(t)} (${'일월화수목금토'[new Date().getDay()]})`;
  $('#nav').innerHTML = PAGES.map(pg => `<a href="#${pg.id}" data-act="nav" data-page="${pg.id}" ${pg.id === S.page ? 'aria-current="page"' : ''}><span class="nav-ico">${svg(pg.id)}</span><span class="nav-label">${pg.label}</span></a>`).join('');
  document.body.classList.toggle('has-bottom-bar', S.page === 'count');
  renderNotice();
}
function renderNotice() {
  const last = meta.get('lastBackupAt', null);
  const since = last || meta.get('initializedAt', Date.now());
  const hasData = DB.items.size > 0;
  const show = hasData && !S.noticeHidden && daysAgo(since) >= 7;
  $('#notice').innerHTML = show ? `<div class="notice no-print" role="status">
    <span>💾 ${last ? `마지막 백업이 ${daysAgo(last)}일 전이에요.` : '아직 백업한 적이 없어요.'} 휴대폰이 고장 나도 데이터가 남도록 백업해 두세요.</span>
    <button class="btn sm" data-act="backup">지금 백업하기</button>
    <button class="x" data-act="hide-notice" aria-label="알림 닫기">×</button></div>` : storage.mode === 'local'
    ? `<div class="notice no-print">이 브라우저는 IndexedDB를 쓸 수 없어 임시 저장소(localStorage)에 저장 중이에요. 사진이 많으면 공간이 부족할 수 있으니 자주 백업하세요.</div>` : '';
}
function toggleShopMenu(force) {
  const m = $('#shopMenu'), b = $('#shopBtn');
  const open = force !== undefined ? force : m.hidden;
  m.hidden = !open; b.setAttribute('aria-expanded', open);
  if (open) $('.shop-opt[aria-current="true"]', m).focus();
}

/* ---------- 이동 경고 ---------- */
let movFormApi = null;
async function canLeave() {
  if (S.page === 'count' && S.countDirty) {
    const v = await openModal({ title: '오늘 기록을 남길까요?',
      body: `<p style="margin:0">센 숫자는 <b>이미 저장되어 있어요.</b> 그냥 나가도 사라지지 않아요.<br>[기록 남기고 이동]을 누르면 오늘 날짜로 결과가 한 장 더 남아서, 나중에 [지난 기록]에서 다시 볼 수 있어요.</p>`,
      actions: [{ label: '계속 세기', value: 'stay' }, { label: '남기지 않고 이동', value: 'go' }, { label: '기록 남기고 이동', value: 'save', cls: 'primary' }] });
    if (v === 'save') { saveCheckpoint(); return true; }
    if (v === 'go') { S.countDirty = false; return true; }
    return false;
  }
  if (S.page === 'mov' && movFormApi && movFormApi.isDirty()) {
    return confirmDialog({ title: '저장하지 않은 반출입 입력이 있어요', message: '입력 중인 반출입 내용이 저장되지 않고 사라져요. 이동할까요?', ok: '저장 안 하고 이동', danger: true, cancel: '계속 입력하기' });
  }
  return true;
}
async function go(page, opts = {}) {
  if (!opts.force && page !== S.page && !(await canLeave())) { history.replaceState(null, '', '#' + S.page); return; }
  S.page = page;
  if (location.hash !== '#' + page) history.replaceState(null, '', '#' + page);
  render();
  if (!opts.keepScroll) window.scrollTo(0, 0);
}
async function switchShop(shop) {
  toggleShopMenu(false);
  if (shop === S.shop) return;
  if (!(await canLeave())) return;
  S.shop = shop; S.invCat = 'all'; S.collapsed.clear(); S.movFilter = { item: '', type: '', date: '' };
  meta.set('lastShop', shop);
  render();
  toast(`${SHOPS[shop].name} 화면으로 바꿨어요`);
}
function render() {
  movFormApi = null;
  renderShell();
  const fn = { count: renderCount, mov: renderMov, inv: renderInv, month: renderMonth, manage: renderManage, settings: renderSettings }[S.page];
  fn($('#main'));
}

/* =====================================================================
 * 13. 첫 실행 · 샘플 데이터
 * ===================================================================== */
function sampleData() {
  const now = Date.now(); let o = 0;
  const cat = (name, shop) => ({ id: uid(), name, shop, order: o++, createdAt: now + o });
  const c1 = cat('문구·엽서', 'gift'), c2 = cat('기념 상품', 'gift'), c3 = cat('유리 용기', 'exp'), c4 = cat('흙·이끼', 'exp'), c5 = cat('공동비품', 'common');
  let n = 0;
  const item = (c, name, unit, boxQty, lowStock, memo = '') => ({ id: uid(), name, categoryId: c.id, unit, boxQty, lowStock, memo, photo: null, archived: false, order: n++, createdAt: now + n });
  const items = [
    item(c1, '엽서 세트', '개', 100, 30), item(c1, '볼펜', '개', 50, 20), item(c1, '스티커', '매', 200, 50),
    item(c2, '키링', '개', 24, 10), item(c2, '머그컵', '개', 12, 6, '깨지기 쉬움'), item(c2, '에코백', '개', 20, 5),
    item(c3, '유리병 소', '개', 24, 12), item(c3, '유리병 중', '개', 24, 12), item(c3, '유리병 대', '개', 12, 6), item(c3, '유리 돔', '개', 6, 3),
    item(c4, '배양토', 'g', 20000, 5000), item(c4, '이끼 매트', '매', 50, 10), item(c4, '장식용 돌멩이', 'g', 10000, 2000),
    item(c5, '빗자루', '개', 0, 1), item(c5, '물티슈', '개', 20, 5), item(c5, '박스테이프', '개', 50, 10),
  ];
  const g = { id: uid(), shop: 'exp', name: '유리병 소/중/대', order: 0, itemIds: [items[6].id, items[7].id, items[8].id], createdAt: now };
  const t = todayStr(); const d1 = curYm() + '-01';
  const movements = [
    { id: uid(), date: d1, type: 'in', itemId: items[3].id, qty: 48, inputQty: 2, inputUnit: 'box', memo: '샘플: 입고', createdAt: now - 3000 },
    { id: uid(), date: t, type: 'out', itemId: items[6].id, qty: 24, inputQty: 1, inputUnit: 'box', memo: '샘플: 체험 준비', createdAt: now - 2000 },
  ];
  return { categories: [c1, c2, c3, c4, c5], items, groups: [g], movements };
}
async function firstRun() {
  const v = await openModal({ title: '재고조사를 시작해요', dismissable: false,
    body: `<p style="margin-top:0">처음 오셨네요. 어떻게 시작할까요?</p>
      <ul class="small muted" style="padding-left:18px;margin:0"><li><b>샘플 데이터</b>: 기념품숍·체험장·공동비품 카테고리와 품목 몇 개가 들어가요. 둘러본 뒤 지우거나 고쳐 쓰면 돼요.</li>
      <li><b>엑셀에서 붙여넣기</b>: 지금 쓰는 엑셀 재고표를 복사해 붙여넣으면 품목과 재고가 한 번에 들어가요.</li>
      <li><b>빈 상태</b>: 카테고리와 품목을 직접 등록해요.</li></ul>`,
    actions: [{ label: '빈 상태로 시작', value: 'empty' }, { label: '엑셀에서 붙여넣기', value: 'excel' }, { label: '샘플 데이터 넣기', value: 'sample', cls: 'primary' }] });
  if (v === 'sample') { const d = sampleData(); for (const s of ['categories', 'items', 'groups', 'movements']) await saveMany(s, d[s]); }
  await meta.set('initializedAt', Date.now());
  S.page = 'count';
  render();
  if (v === 'empty') toast('먼저 품목·카테고리 관리에서 카테고리를 만들어 주세요');
  if (v === 'excel') openExcelImport();
}

/* =====================================================================
 * 14. 이벤트 연결
 * ===================================================================== */
const actions = {
  nav: (el, e) => { e.preventDefault(); go(el.dataset.page); },
  shop: el => switchShop(el.dataset.shop),
  zoom: el => zoomItem(DB.items.get(el.dataset.id)),
  'toggle-grp': el => { const k = el.dataset.key; const open = el.getAttribute('aria-expanded') === 'true'; if (open) S.collapsed.add(k); else S.collapsed.delete(k); el.setAttribute('aria-expanded', !open); el.nextElementSibling.hidden = open; },
  'clear-count-q': () => { S.countQ = ''; $('#countQ').value = ''; renderCountList(); },
  'show-all': () => { S.onlyEmpty = false; $('#onlyEmpty').checked = false; renderCountList(); },
  'save-cp': () => saveCheckpoint(),
  'cp-history': () => showCheckpoints(),
  'paste-sales': () => pasteSales(),
  'start-stock': () => startStock(),
  'xl-import': () => openExcelImport(),
  'order-list': () => openOrderList(),
  'share-backup': () => shareBackup(),
  'count-empty': () => { S.onlyEmpty = true; go('count'); },
  'count-today': () => { S.countDate = todayStr(); renderCount($('#main')); },
  'new-item': () => { if (!catsFor(S.shop).length) toast('카테고리가 없어 새로 만들어요. 아래에서 이름을 넣어 주세요.'); openItemEditor(null, { cat: S.invCat }); },
  'edit-item': el => openItemEditor(el.dataset.id),
  'new-cat': () => openCategoryEditor(),
  'mov-save': () => saveMovement(),
  'mov-edit': el => editMovement(el.dataset.id),
  'mov-del': el => deleteMovement(el.dataset.id),
  'mov-month': el => { S.movYm = addMonth(S.movYm, +el.dataset.d); S.movFilter.date = ''; renderMov($('#main')); },
  'mov-clear': () => { S.movFilter = { item: '', type: '', date: '' }; renderMov($('#main')); },
  'inv-st': el => { S.invSt = S.invSt === el.dataset.k ? '' : el.dataset.k; renderInv($('#main')); },
  'inv-cat': el => { S.invCat = el.dataset.id; renderInv($('#main')); },
  'month-nav': el => { S.monthYm = addMonth(S.monthYm, +el.dataset.d); renderMonth($('#main')); },
  'confirm-month': () => confirmMonth(),
  unconfirm: () => unconfirmMonth(),
  csv: () => exportCSV(),
  print: () => window.print(),
  'mg-tab': el => { S.mgTab = el.dataset.t; renderManage($('#main')); },
  'add-cat': () => addCategoryFromForm(),
  'rename-cat': el => renameCategory(el.dataset.id),
  'del-cat': el => deleteCategory(el.dataset.id),
  'toggle-archive': () => { S.showArchived = !S.showArchived; renderManage($('#main')); },
  unarchive: el => { const it = DB.items.get(el.dataset.id); it.archived = false; save('items', it); toast(`‘${it.name}’을(를) 다시 꺼냈어요`); renderManage($('#main')); },
  'add-group': () => addGroup(),
  'focus-new-group': () => $('#newGrp').focus(),
  'edit-group': el => editGroup(el.dataset.id),
  'rename-group': el => { const g = DB.groups.get(el.dataset.id); openModal({ title: '묶음 이름 변경', body: `<label class="fld"><span>새 이름</span><input class="inp" id="rg" value="${esc(g.name)}"></label>`, actions: [{ label: '취소' }, { label: '이름 저장', cls: 'primary', onClick: ({ el: m }) => { const n = $('#rg', m).value.trim(); if (!n) return false; g.name = n; save('groups', g); render(); } }] }); },
  'del-group': async el => { const g = DB.groups.get(el.dataset.id); if (await confirmDialog({ title: '묶음 삭제', message: `‘<b>${esc(g.name)}</b>’ 묶음을 삭제할까요?<br><span class="small muted">품목은 지워지지 않고 카테고리 묶음으로 돌아가요.</span>`, ok: `‘${g.name}’ 삭제`, danger: true })) { del('groups', g.id); toast('묶음을 삭제했어요'); render(); } },
  backup: () => doBackup(),
  'hide-notice': () => { S.noticeHidden = true; renderNotice(); },
  selftest: () => { const r = Calc.selfTest(); $('#testOut').innerHTML = `<div class="test-out"><b class="${r.ok ? 'match' : 'minus'}">${esc(r.summary)}</b>\n${r.lines.map(esc).join('\n')}</div>`; },
  wipe: () => wipeAll(),
};
document.addEventListener('click', e => {
  const sb = e.target.closest('#shopBtn'); if (sb) { toggleShopMenu(); return; }
  if (!e.target.closest('#shopSwitch')) { const m = $('#shopMenu'); if (m && !m.hidden) toggleShopMenu(false); }
  const el = e.target.closest('[data-act]'); if (!el || el.closest('.modal-back')) return;
  const fn = actions[el.dataset.act]; if (fn && !el.disabled) fn(el, e);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { const m = $('#shopMenu'); if (m && !m.hidden) { toggleShopMenu(false); $('#shopBtn').focus(); } } });
// 숫자 입력 (재고조사 · 월말 정산 공용)
document.addEventListener('input', e => {
  const el = e.target; if (!el.dataset || !el.dataset.f || !el.closest('#main')) return;
  const row = el.closest('[data-item]'); if (!row) return;
  const item = DB.items.get(row.dataset.item); const ym = row.dataset.ym; const f = el.dataset.f;
  if (isLocked(item, ym)) return;
  const m = ensureMd(ym, item.id);
  if (f === 'reason') m.reason = el.value;
  else {
    const v = parseNum(el.value, f === 'prev'); el.classList.toggle('bad', v === undefined);
    if (v === undefined) return;
    if (f === 'box' || f === 'ea') { m[f] = v; m.countedAt = Date.now(); m.countDate = S.page === 'count' && S.countDate.slice(0, 7) === ym ? S.countDate : ym === curYm() ? todayStr() : monthEnd(ym); m.countedShop = S.shop; }
    else if (f === 'sales') m.sales = v;
    else if (f === 'prev') m.prevManual = v;
  }
  save('monthData', m);
  // 같은 품목의 같은 칸이 화면에 두 곳 있으면(월말 단계 목록과 표) 값을 맞춘다
  $$(`#main [data-item="${item.id}"] [data-f="${f}"]`).forEach(x => { if (x !== el) x.value = el.value; });
  if (S.page === 'count') { S.countDirty = true; refreshRow(row); refreshCountSummary(); }
  else { refreshRow(row); refreshMonthSummary(); }
});
// Enter → 아래 품목의 같은 칸 (엑셀처럼), Shift+Enter → 위 품목. 옆 칸은 Tab.
function nextCell(el, dir) {
  const row = el.closest('[data-item]'); if (!row) return null;
  const f = el.dataset.f; const kind = row.tagName + '.' + (row.classList[0] || '');
  const rows = $$('#main [data-item]').filter(r => r.tagName + '.' + (r.classList[0] || '') === kind && r.offsetParent !== null);
  const ok = x => x && !x.disabled && x.offsetParent !== null && getComputedStyle(x).visibility !== 'hidden';
  for (let k = rows.indexOf(row) + dir; k >= 0 && k < rows.length; k += dir) {
    const same = $(`input[data-f="${f}"]`, rows[k]); if (ok(same)) return same;
    const ea = $('input[data-f="ea"]', rows[k]); if (f === 'box' && ok(ea)) return ea; // 박스 기준이 없는 품목은 낱개 칸으로
  }
  return null;
}
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.isComposing) return;
  const el = e.target; if (!el.matches || !el.matches('#main input[data-f]')) return;
  e.preventDefault();
  const next = nextCell(el, e.shiftKey ? -1 : 1);
  if (next) { next.focus(); if (next.select) next.select(); next.scrollIntoView({ block: 'nearest' }); } else el.blur();
});
// '/' → 품목 찾기 칸으로 (글자를 넣는 중이 아닐 때)
document.addEventListener('keydown', e => {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || $('.modal-back')) return;
  const a = document.activeElement;
  if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
  const q = $('#countQ') || $('#invQ'); if (!q) return;
  e.preventDefault(); q.focus(); q.select();
});
document.addEventListener('focusout', e => {
  const sw = $('#shopSwitch'); const m = $('#shopMenu');
  if (sw && m && !m.hidden && sw.contains(e.target) && !sw.contains(e.relatedTarget)) toggleShopMenu(false);
});
/* ---------- 같은 PC의 다른 탭에서 바뀐 내용 반영 ---------- */
let remotePending = false;
function isBusy() {
  const a = document.activeElement;
  return !!document.querySelector('.modal-back') || !!(a && a.closest && a.closest('#main') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
}
function flushRemote() {
  if (!remotePending || isBusy() || !DB.items) return;
  remotePending = false; const y = window.scrollY; render(); window.scrollTo(0, y);
}
storage.onRemoteChange(async stores => {
  for (const s of stores) if (DB[s]) DB[s] = new Map((await storage.getAll(s)).map(r => [r.id, r]));
  remotePending = true; flushRemote();
});
setInterval(flushRemote, 800); // 입력을 마치거나 창을 닫으면 반영
window.addEventListener('hashchange', () => { const p = location.hash.slice(1); if (PAGES.some(x => x.id === p) && p !== S.page) go(p); });
/* =====================================================================
 * 15. 시작
 * ===================================================================== */
(async function start() {
  try {
    await storage.init();
    await loadAll();
  } catch (e) {
    $('#main').innerHTML = `<div class="empty card"><strong>데이터를 열지 못했어요</strong><p>${esc(e.message)}</p><p>브라우저를 새로 고치거나, 다른 브라우저(크롬·사파리)로 열어 보세요.</p></div>`;
    return;
  }
  S.shop = meta.get('lastShop', 'gift') in SHOPS ? meta.get('lastShop', 'gift') : 'gift';
  const h = location.hash.slice(1); if (PAGES.some(p => p.id === h)) S.page = h;
  const t = Calc.selfTest(); if (!t.ok) console.error('계산 자체 테스트 실패');
  if (!meta.get('initializedAt', null)) { renderShell(); $('#main').innerHTML = ''; await firstRun(); }
  else render();
})();
