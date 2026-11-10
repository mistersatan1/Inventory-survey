'use strict';
/* 화면: 반출입 기록 */

/* =====================================================================
 * 8. 반출입 기록
 * ===================================================================== */
function movFormHTML(m) {
  const type = m ? m.type : 'in'; const unit = m ? m.inputUnit : 'box';
  return `<div class="form-grid mov">
    <label class="fld"><span>날짜</span><input class="inp" type="date" name="date" value="${m ? m.date : todayStr()}"></label>
    <div class="fld"><span>구분</span><div class="seg" data-seg="type" role="group" aria-label="구분">
      <button type="button" data-v="in" aria-pressed="${type === 'in'}" class="${type === 'in' ? 'on' : ''}">↓ 반입 <small>들어옴</small></button>
      <button type="button" data-v="out" aria-pressed="${type === 'out'}" class="${type === 'out' ? 'on' : ''}">↑ 반출 <small>나감</small></button></div></div>
    <div class="fld full"><span id="pickLbl">품목</span>
      <div class="picker"><button type="button" class="picker-btn" aria-labelledby="pickLbl" aria-haspopup="listbox"></button>
        <div class="picker-pop" hidden><input class="inp picker-q" placeholder="품목명·초성 검색" aria-label="품목 검색" autocomplete="off"><div class="picker-list" role="listbox"></div></div></div>
      <small class="err" data-err="item"></small></div>
    <label class="fld"><span>수량</span><input class="inp num" name="qty" inputmode="decimal" autocomplete="off" value="${m ? plain(m.inputQty) : ''}" placeholder="0"><small class="err" data-err="qty"></small></label>
    <div class="fld"><span>단위</span><div class="seg" data-seg="unit" role="group" aria-label="단위">
      <button type="button" data-v="box" class="${unit === 'box' ? 'on' : ''}">박스</button>
      <button type="button" data-v="ea" class="${unit === 'ea' ? 'on' : ''}">낱개</button></div></div>
    <label class="fld wide full"><span>메모 (선택)</span><input class="inp" name="memo" value="${esc(m ? m.memo : '')}" placeholder="예: 행사용 반출"></label>
    <div class="conv wide full" data-conv hidden></div>
  </div>`;
}
function bindMovForm(root, m, onTypeChange) {
  const st = { type: m ? m.type : 'in', unit: m ? m.inputUnit : 'box', itemId: m ? m.itemId : '' };
  const items = itemsFor(S.shop);
  const btn = $('.picker-btn', root), pop = $('.picker-pop', root), q = $('.picker-q', root), list = $('.picker-list', root);
  const qty = $('[name=qty]', root);
  const initial = JSON.stringify({ ...st, qty: qty.value, memo: m ? m.memo : '' });
  function paintBtn() {
    const it = DB.items.get(st.itemId);
    btn.innerHTML = it ? `${avatar(it, 'sm')}<span class="grow"><b>${esc(it.name)}</b> <small class="muted">${boxInfo(it)}</small></span>${svg('down')}`
      : `<span class="av sm ph">?</span><span class="grow ph-txt">품목을 고르세요</span>${svg('down')}`;
  }
  function paintList() {
    const f = items.filter(i => matchQ(i.name, q.value));
    list.innerHTML = f.length ? f.map(i => `<button type="button" class="picker-opt" role="option" data-id="${i.id}">${avatar(i, 'sm')}<span><b>${esc(i.name)}</b>${commonBadge(i)}<small>${esc(catOf(i)?.name || '')} · ${boxInfo(i)}</small></span></button>`).join('')
      : `<div class="empty small" style="padding:14px">맞는 품목이 없어요</div>`;
  }
  function openPop(v) { pop.hidden = !v; btn.setAttribute('aria-expanded', v); if (v) { q.value = ''; paintList(); q.focus(); } }
  function paintSeg() {
    $$('[data-seg=type] button', root).forEach(b => { const on = b.dataset.v === st.type; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $$('[data-seg=unit] button', root).forEach(b => { const on = b.dataset.v === st.unit; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    const it = DB.items.get(st.itemId);
    const boxBtn = $('[data-seg=unit] [data-v=box]', root);
    $('[data-seg=unit] [data-v=ea]', root).textContent = it ? unitLabel(it) : '낱개';
    boxBtn.disabled = !!it && !it.boxQty;
    if (it && !it.boxQty && st.unit === 'box') { st.unit = 'ea'; return paintSeg(); }
    paintConv();
    if (onTypeChange) onTypeChange(st.type);
  }
  function paintConv() {
    const conv = $('[data-conv]', root); const it = DB.items.get(st.itemId); const v = parseNum(qty.value);
    if (!it || !v) { conv.hidden = true; return; }
    conv.hidden = false;
    const u = esc(it.unit || 'ea');
    conv.innerHTML = st.unit === 'box' ? `${fmt(v)}박스 = <b>${fmt(v * it.boxQty)}${u}</b> 로 저장돼요 (1박스 ${fmt(it.boxQty)}${u})` : `<b>${fmt(v)}${u}</b>로 저장돼요`;
  }
  btn.addEventListener('click', () => openPop(pop.hidden));
  q.addEventListener('input', paintList);
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { const f = $('.picker-opt', list); if (f) f.click(); e.preventDefault(); } if (e.key === 'Escape') { openPop(false); btn.focus(); e.stopPropagation(); } });
  list.addEventListener('click', e => { const o = e.target.closest('.picker-opt'); if (!o) return; st.itemId = o.dataset.id; const it = DB.items.get(st.itemId); st.unit = it.boxQty ? st.unit : 'ea'; openPop(false); paintBtn(); paintSeg(); $('[data-err=item]', root).textContent = ''; qty.focus(); });
  document.addEventListener('click', e => { if (!root.isConnected) return; if (!e.target.closest('.picker')) pop.hidden = true; }, true);
  $$('.seg', root).forEach(seg => seg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; st[seg.dataset.seg] = b.dataset.v; paintSeg(); }));
  qty.addEventListener('input', () => { qty.classList.toggle('bad', parseNum(qty.value) === undefined); $('[data-err=qty]', root).textContent = ''; paintConv(); });
  paintBtn(); paintSeg();
  return {
    st,
    isDirty() { return root.isConnected && JSON.stringify({ ...st, qty: qty.value, memo: $('[name=memo]', root).value }) !== initial && (!!st.itemId || !!qty.value || !!$('[name=memo]', root).value); },
    read() {
      const it = DB.items.get(st.itemId); const v = parseNum(qty.value); const date = $('[name=date]', root).value;
      let ok = true;
      if (!it) { $('[data-err=item]', root).textContent = '품목을 골라 주세요.'; ok = false; }
      if (!v || v <= 0) { $('[data-err=qty]', root).textContent = '0보다 큰 수량을 넣어 주세요.'; qty.classList.add('bad'); ok = false; }
      if (!date) { toast('날짜를 골라 주세요.', { error: true }); ok = false; }
      if (!ok) return null;
      if (isLocked(it, date.slice(0, 7))) { toast(`${mLabel(date.slice(0, 7))}은 마감된 달이라 기록할 수 없어요. 월말 정산에서 [마감 풀기]를 한 뒤 기록하세요.`, { error: true }); return null; }
      const ea = st.unit === 'box' ? Calc.round(v * it.boxQty) : v;
      return { date, type: st.type, itemId: it.id, qty: ea, inputQty: v, inputUnit: st.unit, memo: $('[name=memo]', root).value.trim() };
    },
  };
}
function movLabel(m) { const it = DB.items.get(m.itemId); return m.inputUnit === 'box' ? `${fmt(m.inputQty)}BOX` : `${fmt(m.qty)}${(it?.unit || 'EA') === 'ea' || !it?.unit || it.unit === '개' ? 'EA' : it.unit}`; }
function renderMov(main) {
  const items = itemsFor(S.shop, { archived: true });
  if (!itemsFor(S.shop).length) { main.innerHTML = `<div class="empty card"><span class="e-ico">🌱</span><strong>반출입을 기록할 품목이 없어요</strong><p>먼저 품목을 등록하세요.</p><button class="btn primary" data-act="new-item">첫 품목 등록하기</button></div>`; return; }
  const ids = new Set(items.map(i => i.id));
  const ym = S.movYm;
  const all = [...DB.movements.values()].filter(m => ids.has(m.itemId) && m.date.slice(0, 7) === ym);
  const f = S.movFilter;
  const rows = all.filter(m => (!f.item || m.itemId === f.item) && (!f.type || m.type === f.type) && (!f.date || m.date === f.date))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const usedItems = items.filter(i => all.some(m => m.itemId === i.id));
  // 품목별 요약
  const sum = usedItems.map(it => {
    const ms = all.filter(m => m.itemId === it.id).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
    const inQ = ms.filter(m => m.type === 'in').reduce((s, m) => s + m.qty, 0); const outQ = ms.filter(m => m.type === 'out').reduce((s, m) => s + m.qty, 0);
    return { it, inQ, outQ, line: ms.map(m => `${dShort(m.date)} ${movLabel(m)} ${m.type === 'in' ? '반입' : '반출'}`).join(' / ') };
  });
  main.innerHTML = `
    <section class="card">
      <h2 id="movFormTitle"><span class="h2-ico">${svg('mov')}</span>들어오고 나간 물건 적기</h2>
      <div id="movForm">${movFormHTML(null)}</div>
      <div class="btn-row" style="margin-top:12px"><button class="btn primary lg block" data-act="mov-save" id="movSaveBtn">반입 저장</button></div>
      <p class="small muted" style="margin:8px 0 0">저장하면 전체 재고와 ‘있어야 할 수’에 바로 반영돼요.</p>
    </section>
    <section class="card">
      <div class="page-head" style="margin-bottom:10px"><h2 style="margin:0">반출입 내역</h2>
        <div class="month-nav"><button class="btn sm" data-act="mov-month" data-d="-1" aria-label="이전 달">‹</button><strong class="num">${ymLabel(ym)}</strong>
        <button class="btn sm" data-act="mov-month" data-d="1" aria-label="다음 달" ${ym >= curYm() ? 'disabled' : ''}>›</button></div></div>
      <div class="filters">
        <label class="fld full"><span>품목</span><select class="inp" id="fItem"><option value="">전체 품목</option>${usedItems.map(i => `<option value="${i.id}" ${f.item === i.id ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}</select></label>
        <label class="fld"><span>구분</span><select class="inp" id="fType"><option value="">반입+반출</option><option value="in" ${f.type === 'in' ? 'selected' : ''}>반입만</option><option value="out" ${f.type === 'out' ? 'selected' : ''}>반출만</option></select></label>
        <label class="fld"><span>날짜</span><input class="inp" type="date" id="fDate" value="${f.date}" min="${ym}-01" max="${monthEnd(ym)}"></label>
        ${f.item || f.type || f.date ? `<div class="fld" style="justify-content:flex-end"><button class="btn sm" data-act="mov-clear">필터 지우기</button></div>` : ''}
      </div>
      ${rows.length ? `<div class="tbl-wrap"><table class="tbl cards"><thead><tr><th>품목</th><th>날짜</th><th>구분</th><th class="n">수량</th><th>메모</th><th></th></tr></thead><tbody>
        ${rows.map(m => { const it = DB.items.get(m.itemId); const u = esc(it?.unit || 'ea'); return `<tr>
          <td class="first"><div class="name-cell">${it ? avatar(it, 'sm') : ''}<div><b>${esc(it?.name || '(삭제된 품목)')}</b><small class="num m-only">${dShort(m.date)}</small></div></div></td>
          <td class="hide-m num">${dShort(m.date)}</td>
          <td data-label="구분"><span class="mov-type ${m.type}">${m.type === 'in' ? '↓ 반입' : '↑ 반출'}</span></td>
          <td class="n" data-label="수량"><b>${fmt(m.qty)}${u}</b>${m.inputUnit === 'box' ? ` <small class="muted">(${fmt(m.inputQty)}박스)</small>` : ''}</td>
          <td data-label="메모">${esc(m.memo || '')}</td>
          <td data-label=""><div class="act-box"><button class="icon-btn" data-act="mov-edit" data-id="${m.id}">${svg('edit')}수정</button><button class="icon-btn danger" data-act="mov-del" data-id="${m.id}">${svg('trash')}삭제</button></div></td></tr>`; }).join('')}
      </tbody></table></div>` : `<div class="empty"><span class="e-ico">📭</span><strong>${all.length ? '조건에 맞는 내역이 없어요' : `${mLabel(ym)} 반출입 내역이 아직 없어요`}</strong><p>${all.length ? '필터를 바꿔 보세요.' : '위 입력 칸에서 첫 반입·반출을 기록하세요.'}</p></div>`}
    </section>
    <section class="card">
      <h2>품목별 합계 <small class="muted">${mLabel(ym)}</small></h2>
      ${sum.length ? `<ul class="sum-list">${sum.map(s => `<li><div class="name-cell">${avatar(s.it, 'sm')}<div style="flex:1"><b>${esc(s.it.name)}</b>${commonBadge(s.it)}
        <div class="small num">반입 합계 <b class="plus">${fmt(s.inQ)}</b> · 반출 합계 <b class="minus">${fmt(s.outQ)}</b></div></div></div>
        <div class="sum-line num">${esc(s.line)}</div></li>`).join('')}</ul>` : `<p class="muted small" style="margin:0">아직 요약할 내역이 없어요.</p>`}
    </section>`;
  movFormApi = bindMovForm($('#movForm'), null, t => { $('#movSaveBtn').textContent = t === 'in' ? '반입 저장' : '반출 저장'; });
  $('#fItem').addEventListener('change', e => { S.movFilter.item = e.target.value; renderMov(main); });
  $('#fType').addEventListener('change', e => { S.movFilter.type = e.target.value; renderMov(main); });
  $('#fDate').addEventListener('change', e => { S.movFilter.date = e.target.value; renderMov(main); });
}
function saveMovement() {
  const v = movFormApi.read(); if (!v) return;
  const rec = { id: uid(), createdAt: Date.now(), ...v };
  save('movements', rec);
  const it = DB.items.get(rec.itemId);
  toast(`${it.name} ${movLabel(rec)} ${rec.type === 'in' ? '반입' : '반출'}을 저장했어요 (${fmt(rec.qty)}${it.unit || 'ea'})`);
  S.movYm = rec.date.slice(0, 7);
  const keepType = rec.type, keepDate = rec.date;
  renderMov($('#main'));
  // 연속 입력 편의: 날짜와 구분은 유지
  $('#movForm [name=date]').value = keepDate;
  if (keepType === 'out') $('#movForm [data-seg=type] [data-v=out]').click();
}
function editMovement(id) {
  const m = DB.movements.get(id); const it = DB.items.get(m.itemId);
  if (it && isLocked(it, m.date.slice(0, 7))) { toast('마감된 달의 기록은 고칠 수 없어요. 월말 정산에서 [마감 풀기]를 눌러 주세요.', { error: true }); return; }
  let api;
  openModal({ title: '반출입 수정', body: movFormHTML(m), wide: true,
    actions: [{ label: '취소', value: null }, { label: '수정 내용 저장', cls: 'primary', onClick: () => {
      const v = api.read(); if (!v) return false;
      save('movements', { ...m, ...v, updatedAt: Date.now() }); toast('반출입 기록을 수정했어요'); renderMov($('#main'));
    } }],
    onMount: ({ el }) => { api = bindMovForm($('.modal-b', el), m); } });
}
function deleteMovement(id) {
  const m = DB.movements.get(id); const it = DB.items.get(m.itemId);
  if (it && isLocked(it, m.date.slice(0, 7))) { toast('마감된 달의 기록은 지울 수 없어요. 월말 정산에서 [마감 풀기]를 눌러 주세요.', { error: true }); return; }
  del('movements', id); renderMov($('#main'));
  toast(`${it?.name || ''} ${dShort(m.date)} ${m.type === 'in' ? '반입' : '반출'} 기록을 지웠어요`, { undo: () => { save('movements', m); if (S.page === 'mov') renderMov($('#main')); toast('되돌렸어요'); } });
}
