'use strict';
/* 화면: 월말 정산 */

/* =====================================================================
 * 10. 월말 정산
 * ===================================================================== */
function monthItems(shop, ym) {
  // 확정된 달: 스냅샷이 있는 품목만 / 작성 중: 보관 안 된 품목 + 이 달 기록이 있는 보관 품목
  return itemsFor(shop, { archived: true }).filter(i => {
    const m = md(ym, i.id);
    if (isConfirmed(shop, ym)) return !!(m && m.snap);
    if (isLocked(i, ym)) return !!(m && m.snap);
    return !i.archived || !!m || movsOf(i.id).some(x => x.date.slice(0, 7) === ym);
  });
}
function renderMonth(main) {
  const ym = S.monthYm; const shop = S.shop; const label = salesLabel();
  const rec = monthRec(shop, ym); const confirmed = !!(rec && rec.confirmed);
  const items = monthItems(shop, ym);
  const prevYm = addMonth(ym, -1);
  const anyEarlierConfirmed = [...DB.months.values()].some(r => r.shop === shop && r.confirmed && r.ym < ym);
  const prevConfirmed = isConfirmed(shop, prevYm);
  const calcs = items.map(i => ({ i, c: monthCalc(i, ym) }));
  const cats = catsFor(shop);
  let body = '';
  cats.forEach(cat => {
    const rs = calcs.filter(x => x.i.categoryId === cat.id); if (!rs.length) return;
    body += `<tr class="cat-row"><td colspan="9">${esc(cat.name)}${cat.shop === 'common' ? ' <span class="badge common">공용</span>' : ''}</td></tr>`;
    rs.forEach(({ i, c }) => {
      const ro = c.locked;
      body += `<tr data-item="${i.id}" data-ym="${ym}">
        <td class="first"><div class="name-cell">${avatar(i, 'sm', true, false)}<div><b>${esc(i.name)}</b>${commonBadge(i)}${i.archived ? ' <span class="badge muted">보관됨</span>' : ''}<small>${boxInfo(i)}</small></div></div></td>
        <td class="n" data-label="처음 있던 수">${!ro && !c.prevAuto ? `<input class="mini-in" data-f="prev" inputmode="decimal" value="${plain(md(ym, i.id)?.prevManual)}" placeholder="0" aria-label="${esc(i.name)} 처음 있던 수"><span class="print-val">${fmt(c.prev)}</span>` : `<span class="v-prevval">${fmt(c.prev)}</span>`}</td>
        <td class="n" data-label="+ 반입"><span class="v-in">${fmt(c.inQ)}</span></td>
        <td class="n" data-label="− 반출"><span class="v-out">${fmt(c.outQ)}</span></td>
        <td class="n" data-label="− ${esc(label)}">${ro ? `<span class="v-sales">${fmt(c.sales)}</span>` : `<input class="mini-in" data-f="sales" inputmode="decimal" value="${c.salesSet ? plain(c.sales) : ''}" placeholder="0" aria-label="${esc(i.name)} ${esc(label)} 수량"><span class="print-val">${fmt(c.sales)}</span>`}</td>
        <td class="n exp" data-label="= 있어야 할 수"><span class="v-exp">${fmt(c.expected)}</span></td>
        <td class="n act" data-label="센 수">${ro ? `<span class="v-act"></span>` : `<div class="act-box">
            <label><span class="lab">박스</span><input class="mini-in" data-f="box" inputmode="decimal" value="${plain(c.box)}" ${i.boxQty ? 'placeholder="박스"' : 'disabled placeholder="–"'} aria-label="${esc(i.name)} 박스 수량"></label>
            <label><span class="lab">${esc(unitLabel(i))}</span><input class="mini-in" data-f="ea" inputmode="decimal" value="${plain(c.ea)}" placeholder="${esc(unitLabel(i))}" aria-label="${esc(i.name)} ${esc(unitLabel(i))} 수량"></label>
            <output class="v-act screen-only"></output><span class="print-val v-actp"></span></div>`}</td>
        <td class="n" data-label="차이"><span class="v-diff"></span></td>
        <td data-label="차이 난 까닭">${ro ? `<span class="v-reasonp"></span>` : `<input class="mini-in wide" data-f="reason" value="${esc(c.reason)}" placeholder="까닭 (선택)" aria-label="${esc(i.name)} 차이 난 까닭"><span class="print-val v-reasonp"></span>`}</td>
      </tr>`;
    });
  });
  const startMissing = items.some(i => { const c = calcs.find(x => x.i === i).c; return !c.locked && !c.prevAuto && md(ym, i.id)?.prevManual == null; });
  const firstMonthBanner = !confirmed && !prevConfirmed && startMissing
    ? `<div class="banner info no-print"><span class="b-ico">📌</span><div>${anyEarlierConfirmed ? `<b>${mLabel(prevYm)}을 마감하지 않아서 ‘처음 있던 수’가 비어 있어요.</b>직접 넣거나 0으로 시작하세요.` : '<b>처음 쓰는 달이에요. 품목마다 ‘처음 있던 수’를 넣어 주세요.</b>지난달 엑셀의 실사 재고를 옮겨 적으면 돼요. 재고 세기 화면에서 한 번에 넣을 수도 있어요.'}</div></div>` : '';
  main.innerHTML = `
    <div class="print-only"><h2 style="margin:0 0 4px">${SHOPS[shop].name} ${ymLabel(ym)} 재고조사 (월말 정산)</h2>
      <p style="margin:0 0 8px">작성자: ${esc(rec?.author || '')} · ${confirmed ? '마감 ' + fmtDateTime(rec.confirmedAt) : '작성 중'} · 출력 ${fmtDateTime(Date.now())}</p></div>
    <div class="page-head no-print">
      <div class="month-nav"><button class="btn" data-act="month-nav" data-d="-1" aria-label="이전 달">‹</button><strong class="num">${ymLabel(ym)}</strong>
        <button class="btn" data-act="month-nav" data-d="1" aria-label="다음 달" ${ym >= addMonth(curYm(), 1) ? 'disabled' : ''}>›</button>
        ${confirmed ? '<span class="badge lock">🔒 마감됨</span>' : '<span class="badge muted">작성 중</span>'}</div>
      <div class="btn-row"><button class="btn sm" data-act="csv">${svg('file')}엑셀(CSV) 저장</button><button class="btn sm" data-act="print">${svg('print')}인쇄</button></div>
    </div>
    ${confirmed ? `<div class="banner lock no-print"><span class="b-ico">🔒</span><div><b>${mLabel(ym)}은 ${fmtDateTime(rec.confirmedAt)}에 마감했어요 (작성자 ${esc(rec.author || '–')}).</b>보기만 할 수 있어요. 이 달의 ‘센 수’가 ${mLabel(addMonth(ym, 1))}의 ‘처음 있던 수’로 들어가 있어요.</div></div>` : ''}
    ${firstMonthBanner}
    ${items.length ? `${confirmed ? '' : '<section class="card no-print" id="monthSteps"></section>'}
      <div class="sec-title no-print"><span>전체 표 <small class="muted">품목별로 자세히 보고 고치기</small></span></div>
      <div class="tbl-wrap"><table class="tbl cards cards-lg" id="monthTbl"><thead><tr><th>품목</th><th class="n">처음 있던&nbsp;수<small class="th-sub">전월 재고</small></th><th class="n">+&nbsp;반입</th><th class="n">−&nbsp;반출</th><th class="n">−&nbsp;${esc(label)}</th><th class="n">=&nbsp;있어야 할&nbsp;수<small class="th-sub">예상 재고</small></th><th class="n">센 수<small class="th-sub">실사 재고 · 박스 + 낱개</small></th><th class="n">차이<small class="th-sub">오차</small></th><th>차이 난 까닭</th></tr></thead>
      <tbody>${body}</tbody></table></div>
      <p class="legend"><span class="minus-note">마이너스(−)는 부족을 의미</span>
      <span class="muted">있어야 할 수 = 처음 있던 수 + 반입 − 반출 − ${esc(label)}</span><span class="muted">차이 = 센 수 − 있어야 할 수</span></p>
      ${confirmed ? `<section class="card no-print">
        <h2><span class="h2-ico">${svg('month')}</span>${mLabel(ym)} 마감됨</h2>
        <div class="confirm-box"><p class="small muted" style="margin:0;flex:1">잘못 마감했다면 [마감 풀기]로 다시 고칠 수 있어요.</p><button class="btn danger" data-act="unconfirm">마감 풀기</button></div>
      </section>` : ''}`
    : `<div class="empty card"><span class="e-ico">🗓</span><strong>${ymLabel(ym)}에 정산할 품목이 없어요</strong><p>${confirmed ? '' : '품목을 등록하면 여기서 월말 정산을 할 수 있어요.'}</p>${confirmed ? '' : '<button class="btn primary" data-act="new-item">첫 품목 등록하기</button>'}</div>`}`;
  $$('#monthTbl tr[data-item]').forEach(refreshRow);
  refreshMonthSummary();
  // 단계 안의 칸에서 나가면 목록을 다시 그린다 (입력 중에는 다시 그리지 않아 커서가 튀지 않음)
  const steps = $('#monthSteps');
  if (steps) steps.addEventListener('focusout', e => { if (!steps.contains(e.relatedTarget)) setTimeout(refreshMonthSummary, 0); });
}
/* ---------- 마감 순서 (① 다 셌나 → ② 차이 난 까닭 → ③ 마감) ----------
 * 큰 표만 보고는 무엇부터 할지 몰라서, 해야 할 일을 차례로 보여 준다. */
function monthStepState(ym) {
  const cs = monthItems(S.shop, ym).map(i => ({ i, c: monthCalc(i, ym) }));
  const unc = cs.filter(x => !x.c.counted && !x.c.locked);
  const diffs = cs.filter(x => x.c.counted && x.c.diff !== 0);
  const noReason = diffs.filter(x => !String(x.c.reason || '').trim());
  return { total: cs.length, unc, diffs, noReason };
}
function stepHead(n, done, title, status) {
  return `<div class="step-h"><span class="step-n ${done ? 'done' : ''}" data-step-n="${n}" aria-hidden="true">${done ? '✓' : n}</span>
    <b class="step-t">${title}</b><span class="step-st ${done ? 'done' : ''}" data-step-st="${n}">${status}</span></div>`;
}
function refreshMonthSummary() {
  const box = $('#monthSteps'); if (!box) return;
  const ym = S.monthYm; const st = monthStepState(ym); const rec = monthRec(S.shop, ym);
  const d1 = !st.unc.length, d2 = !st.noReason.length;
  const s1 = d1 ? '다 셌어요' : `아직 ${st.unc.length}개`;
  const s2 = !st.diffs.length ? '차이 없음' : d2 ? '까닭 다 적음' : `${st.diffs.length - st.noReason.length} / ${st.diffs.length}개 적음`;
  // 단계 안에서 글자를 넣는 중이면 상태 글자만 바꾼다
  if (box.contains(document.activeElement) && $('.steps', box)) {
    [[1, d1, s1], [2, d2, s2]].forEach(([n, done, txt]) => {
      const t = $(`[data-step-st="${n}"]`, box); if (t) { t.textContent = txt; t.classList.toggle('done', done); }
      const c = $(`[data-step-n="${n}"]`, box); if (c) { c.textContent = done ? '✓' : n; c.classList.toggle('done', done); }
    });
    return;
  }
  const isCur = ym === curYm();
  const chips = st.unc.slice(0, 12).map(x => `<span class="name-chip">${esc(x.i.name)}</span>`).join('') + (st.unc.length > 12 ? `<span class="name-chip">외 ${st.unc.length - 12}개</span>` : '');
  box.innerHTML = `<h2><span class="h2-ico">${svg('month')}</span>${mLabel(ym)} 마감 순서</h2>
    <ol class="steps">
      <li class="step ${d1 ? 'is-done' : ''}">${stepHead(1, d1, '모든 품목을 셌나요?', s1)}
        ${d1 ? '' : `<div class="step-b"><div class="name-chips">${chips}</div>
          ${isCur ? `<button class="btn sm" data-act="count-empty">재고 세기에서 마저 세기</button>` : `<p class="small muted" style="margin:0">아래 표의 ‘센 수’ 칸에 넣어 주세요.</p>`}
          <p class="small muted" style="margin:6px 0 0">못 센 품목은 ‘있어야 할 수’를 센 수로 보고 마감돼요.</p></div>`}</li>
      <li class="step ${d2 ? 'is-done' : ''}">${stepHead(2, d2, '차이 난 까닭을 적었나요?', s2)}
        ${st.diffs.length ? `<div class="step-b"><p class="small muted" style="margin:0 0 8px">적지 않아도 마감할 수 있어요. 적어 두면 다음 달에 원인을 찾기 쉬워요.</p>
          <ul class="reason-list">${st.diffs.map(({ i, c }) => `<li data-item="${i.id}" data-ym="${ym}"><span class="rl-name"><b>${esc(i.name)}</b>${diffHTML(c.diff)}</span>
            <input class="inp" data-f="reason" value="${esc(c.reason)}" placeholder="예: 파손 2개, 행사에 씀" autocomplete="off" aria-label="${esc(i.name)} 차이 난 까닭"></li>`).join('')}</ul></div>` : ''}</li>
      <li class="step">${stepHead(3, false, '이번 달 마감하기', '')}
        <div class="step-b"><div class="confirm-box"><label class="fld"><span>작성자</span><input class="inp" id="author" value="${esc(rec?.author || '')}" placeholder="이름" autocomplete="name"></label>
          <button class="btn primary lg" data-act="confirm-month">이번 달 마감하기</button></div>
          <p class="small muted" style="margin:8px 0 0">마감하면 이 달은 잠기고, ‘센 수’가 ${mLabel(addMonth(ym, 1))}의 ‘처음 있던 수’로 자동으로 들어가요. 잘못하면 [마감 풀기]로 되돌릴 수 있어요.</p></div></li>
    </ol>`;
  const a = $('#author', box);
  a.addEventListener('input', () => { const r = monthRec(S.shop, ym) || { id: S.shop + '|' + ym, shop: S.shop, ym, confirmed: false }; r.author = a.value; save('months', r); });
}
async function confirmMonth() {
  const ym = S.monthYm, shop = S.shop; const items = monthItems(shop, ym);
  const unc = items.filter(i => !monthCalc(i, ym).counted);
  const ok = await confirmDialog({ title: `${SHOPS[shop].name} ${ymLabel(ym)} 마감하기`, ok: '이번 달 마감하기',
    message: `<p style="margin-top:0"><b>마감하면 ${mLabel(ym)}의 ‘센 수’가 ${mLabel(addMonth(ym, 1))}의 ‘처음 있던 수’로 자동으로 들어가요.</b></p>
      <dl class="kv"><dt>대상</dt><dd>${SHOPS[shop].name} · 품목 ${items.length}개</dd><dt>작성자</dt><dd>${esc(monthRec(shop, ym)?.author || '(비어 있음)')}</dd></dl>
      ${unc.length ? `<div class="banner warn" style="margin:10px 0 0"><div><b>아직 안 센 품목 ${unc.length}개</b>는 ‘있어야 할 수’를 센 수로 보고 마감돼요: ${unc.slice(0, 6).map(i => esc(i.name)).join(', ')}${unc.length > 6 ? ' 외' : ''}</div></div>` : ''}
      <p class="small muted">마감한 뒤에는 이 달의 센 수·${esc(salesLabel())}·반출입을 고칠 수 없어요([마감 풀기]로 다시 열 수 있어요).</p>` });
  if (!ok) return;
  const recs = [];
  items.forEach(i => {
    const m = ensureMd(ym, i.id);
    if (m.snap) return; // 공용 품목이 이미 다른 매장에서 확정된 경우 그대로 둔다
    const c = monthCalc(i, ym);
    const actual = c.counted ? c.actual : c.expected;
    m.snap = { prev: c.prev, inQ: c.inQ, outQ: c.outQ, sales: c.sales, salesSet: true, expected: c.expected, actual, diff: Calc.diff(actual, c.expected), counted: c.counted, countedShop: c.countedShop };
    m.final = Calc.nextPrev(actual); m.snapBy = shop;
    recs.push(m);
  });
  await saveMany('monthData', recs);
  const r = monthRec(shop, ym) || { id: shop + '|' + ym, shop, ym };
  Object.assign(r, { confirmed: true, confirmedAt: Date.now(), author: ($('#author')?.value || r.author || '').trim() });
  await save('months', r);
  toast(`${mLabel(ym)}을 마감했어요. ${mLabel(addMonth(ym, 1))}의 ‘처음 있던 수’로 들어갔어요.`);
  render();
}
async function unconfirmMonth() {
  const ym = S.monthYm, shop = S.shop;
  if (isConfirmed(shop, addMonth(ym, 1))) { toast(`${mLabel(addMonth(ym, 1))}이 이미 마감되어 있어요. ${mLabel(addMonth(ym, 1))} 마감을 먼저 풀어 주세요.`, { error: true }); return; }
  const s1 = await confirmDialog({ title: `${ymLabel(ym)} 마감 풀기 (1/2)`, ok: '다음 단계', danger: true,
    message: `<b>${SHOPS[shop].name} ${mLabel(ym)}</b> 마감을 풀면 이 달을 다시 고칠 수 있고, ${mLabel(addMonth(ym, 1))}의 ‘처음 있던 수’ 자동 입력도 풀려요.` });
  if (!s1) return;
  const s2 = await openModal({ title: `${ymLabel(ym)} 마감 풀기 (2/2)`,
    body: `<p style="margin-top:0">정말 풀려면 아래 칸에 <b>풀기</b>라고 입력하세요.</p><input class="inp" id="unc" autocomplete="off" aria-label="확인 문구">`,
    actions: [{ label: '취소', value: false }, { label: '마감 풀기', cls: 'danger solid', onClick: ({ el }) => { if ($('#unc', el).value.trim() !== '풀기') { toast('‘풀기’라고 입력해야 진행돼요.', { error: true }); return false; } return true; } }] });
  if (!s2) return;
  const other = shop === 'gift' ? 'exp' : 'gift';
  const recs = [];
  monthItems(shop, ym).forEach(i => {
    const m = md(ym, i.id); if (!m || !m.snap) return;
    if (isCommon(i) && isConfirmed(other, ym)) return;
    delete m.snap; delete m.final; delete m.snapBy; recs.push(m);
  });
  await saveMany('monthData', recs);
  const r = monthRec(shop, ym); r.confirmed = false; r.unconfirmedAt = Date.now(); await save('months', r);
  toast(`${mLabel(ym)} 마감을 풀었어요. 다시 고칠 수 있어요.`);
  render();
}
function exportCSV() {
  const ym = S.monthYm, shop = S.shop; const label = salesLabel(); const rec = monthRec(shop, ym);
  const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const n = v => v === null || v === undefined ? '' : Calc.round(v);
  const lines = [
    [`${SHOPS[shop].name} ${ymLabel(ym)} 재고조사 (월말 정산)`],
    ['작성자', rec?.author || '', '상태', rec?.confirmed ? '마감 ' + fmtDateTime(rec.confirmedAt) : '작성 중'],
    [],
    ['카테고리', '품목', '단위', '1박스 기준', '전월 재고', '반입', '반출', label, '예상 재고', '실사 박스', '실사 낱개', '실사 재고', '오차', '오차 사유'],
  ];
  monthItems(shop, ym).forEach(i => {
    const c = monthCalc(i, ym);
    lines.push([catOf(i)?.name || '', i.name, i.unit || 'ea', n(i.boxQty), n(c.prev), n(c.inQ), n(c.outQ), n(c.sales), n(c.expected), n(c.box), n(c.ea), c.counted || c.locked ? n(c.actual) : '', c.counted || c.locked ? n(c.diff) : '', c.reason || '']);
  });
  lines.push([], ['마이너스(-)는 부족을 의미']);
  const csv = '﻿' + lines.map(r => r.map(q).join(',')).join('\r\n');
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `재고정산_${SHOPS[shop].name}_${ym}.csv`);
  toast('CSV 파일을 저장했어요. 엑셀에서 바로 열 수 있어요.');
}
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
