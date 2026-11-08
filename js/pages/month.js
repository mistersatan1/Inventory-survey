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
        <td class="first"><div class="name-cell">${avatar(i, 'sm', true)}<div><b>${esc(i.name)}</b>${commonBadge(i)}${i.archived ? ' <span class="badge muted">보관됨</span>' : ''}<small>${boxInfo(i)}</small></div></div></td>
        <td class="n" data-label="전월 재고">${!ro && !c.prevAuto ? `<input class="mini-in" data-f="prev" inputmode="decimal" value="${plain(md(ym, i.id)?.prevManual)}" placeholder="0" aria-label="${esc(i.name)} 전월 재고"><span class="print-val">${fmt(c.prev)}</span>` : `<span class="v-prevval">${fmt(c.prev)}</span>`}</td>
        <td class="n" data-label="+ 반입"><span class="v-in">${fmt(c.inQ)}</span></td>
        <td class="n" data-label="− 반출"><span class="v-out">${fmt(c.outQ)}</span></td>
        <td class="n" data-label="− ${esc(label)}">${ro ? `<span class="v-sales">${fmt(c.sales)}</span>` : `<input class="mini-in" data-f="sales" inputmode="decimal" value="${c.salesSet ? plain(c.sales) : ''}" placeholder="0" aria-label="${esc(i.name)} ${esc(label)} 수량"><span class="print-val">${fmt(c.sales)}</span>`}</td>
        <td class="n exp" data-label="= 예상 재고"><span class="v-exp">${fmt(c.expected)}</span></td>
        <td class="n act" data-label="실사 재고">${ro ? `<span class="v-act"></span>` : `<div class="act-box">
            <label><span class="lab">박스</span><input class="mini-in" data-f="box" inputmode="decimal" value="${plain(c.box)}" ${i.boxQty ? 'placeholder="박스"' : 'disabled placeholder="–"'} aria-label="${esc(i.name)} 박스 수량"></label>
            <label><span class="lab">낱개</span><input class="mini-in" data-f="ea" inputmode="decimal" value="${plain(c.ea)}" placeholder="낱개" aria-label="${esc(i.name)} 낱개 수량"></label>
            <output class="v-act screen-only"></output><span class="print-val v-actp"></span></div>`}</td>
        <td class="n" data-label="오차"><span class="v-diff"></span></td>
        <td data-label="오차 사유">${ro ? `<span class="v-reasonp"></span>` : `<input class="mini-in wide" data-f="reason" value="${esc(c.reason)}" placeholder="사유 (선택)" aria-label="${esc(i.name)} 오차 사유"><span class="print-val v-reasonp"></span>`}</td>
      </tr>`;
    });
  });
  const firstMonthBanner = !confirmed && !prevConfirmed && items.length
    ? `<div class="banner info no-print"><span class="b-ico">📌</span><div>${anyEarlierConfirmed ? `<b>${mLabel(prevYm)}이 확정되지 않아 전월 재고가 비어 있어요.</b>전월 재고를 직접 입력하거나 0으로 시작하세요.` : '<b>첫 달입니다. 전월 재고를 직접 입력하거나 0으로 시작하세요.</b>지난달 엑셀의 실사 재고를 ‘전월 재고’ 칸에 옮겨 적으면 돼요.'}</div></div>` : '';
  main.innerHTML = `
    <div class="print-only"><h2 style="margin:0 0 4px">${SHOPS[shop].name} ${ymLabel(ym)} 재고조사 (월말 정산)</h2>
      <p style="margin:0 0 8px">작성자: ${esc(rec?.author || '')} · ${confirmed ? '확정 ' + fmtDateTime(rec.confirmedAt) : '작성 중'} · 출력 ${fmtDateTime(Date.now())}</p></div>
    <div class="page-head no-print">
      <div class="month-nav"><button class="btn" data-act="month-nav" data-d="-1" aria-label="이전 달">‹</button><strong class="num">${ymLabel(ym)}</strong>
        <button class="btn" data-act="month-nav" data-d="1" aria-label="다음 달" ${ym >= addMonth(curYm(), 1) ? 'disabled' : ''}>›</button>
        ${confirmed ? '<span class="badge lock">🔒 확정됨</span>' : '<span class="badge muted">작성 중</span>'}</div>
      <div class="btn-row"><button class="btn sm" data-act="csv">${svg('file')}엑셀(CSV) 저장</button><button class="btn sm" data-act="print">${svg('print')}인쇄</button></div>
    </div>
    ${confirmed ? `<div class="banner lock no-print"><span class="b-ico">🔒</span><div><b>${mLabel(ym)} 재고는 ${fmtDateTime(rec.confirmedAt)}에 확정되었어요 (작성자 ${esc(rec.author || '–')}).</b>읽기 전용이에요. 확정한 실사 재고가 ${mLabel(addMonth(ym, 1))} 전월 재고로 들어가 있어요.</div></div>` : ''}
    ${firstMonthBanner}
    ${items.length ? `<div class="tbl-wrap"><table class="tbl cards cards-lg" id="monthTbl"><thead><tr><th>품목</th><th class="n">전월 재고</th><th class="n">+ 반입</th><th class="n">− 반출</th><th class="n">− ${esc(label)}</th><th class="n">= 예상 재고</th><th class="n">실사 재고<small class="th-sub">박스 · 낱개 → 합계</small></th><th class="n">오차</th><th>오차 사유</th></tr></thead>
      <tbody>${body}</tbody></table></div>
      <p class="legend"><span class="minus-note">마이너스(−)는 부족을 의미</span>
      <span class="muted">예상 재고 = 전월 재고 + 반입 − 반출 − ${esc(label)}</span><span class="muted">오차 = 실사 재고 − 예상 재고</span></p>
      <section class="card" id="monthSummary"></section>
      <section class="card no-print">
        <h2><span class="h2-ico">${svg('month')}</span>${mLabel(ym)} 마감하기</h2><div class="confirm-box"><label class="fld"><span>작성자</span><input class="inp" id="author" value="${esc(rec?.author || '')}" placeholder="이름" ${confirmed ? 'disabled' : ''} autocomplete="name"></label>
        ${confirmed ? `<button class="btn danger" data-act="unconfirm">확정 해제</button>` : `<button class="btn primary lg" data-act="confirm-month">월말 확정</button>`}</div>
        <p class="small muted" style="margin:8px 0 0">${confirmed ? '실수로 확정했다면 [확정 해제]로 다시 고칠 수 있어요.' : `확정하면 이 달은 잠기고, 실사 재고가 ${mLabel(addMonth(ym, 1))} 전월 재고로 자동 입력돼요.`}</p>
      </section>`
    : `<div class="empty card"><span class="e-ico">🗓</span><strong>${ymLabel(ym)}에 정산할 품목이 없어요</strong><p>${confirmed ? '' : '품목을 등록하면 여기서 월말 정산을 할 수 있어요.'}</p>${confirmed ? '' : '<button class="btn primary" data-act="new-item">첫 품목 등록하기</button>'}</div>`}`;
  $$('#monthTbl tr[data-item]').forEach(refreshRow);
  refreshMonthSummary();
  const a = $('#author'); if (a) a.addEventListener('input', () => { const r = monthRec(shop, ym) || { id: shop + '|' + ym, shop, ym, confirmed: false }; r.author = a.value; save('months', r); });
}
function refreshMonthSummary() {
  const box = $('#monthSummary'); if (!box) return;
  const ym = S.monthYm; const items = monthItems(S.shop, ym);
  const cs = items.map(i => ({ i, c: monthCalc(i, ym) }));
  const diffs = cs.filter(x => x.c.counted && x.c.diff !== 0);
  const unc = cs.filter(x => !x.c.counted);
  box.innerHTML = `<h2>오차 요약</h2>
    <p style="margin:0 0 6px">오차가 있는 품목: <b class="${diffs.length ? 'minus' : 'match'}">${diffs.length}개</b>${unc.length ? ` · 실사 미입력: <b>${unc.length}개</b>` : ''} <span class="muted">(전체 ${items.length}개)</span></p>
    ${diffs.length ? `<ul class="diff-list num">${diffs.map(({ i, c }) => `<li><span><b>${esc(i.name)}</b>${c.reason ? `<br><small class="muted">${esc(c.reason)}</small>` : ''}</span>${diffHTML(c.diff)}</li>`).join('')}</ul>` : `<p class="small muted" style="margin:0">${unc.length === items.length ? '아직 실사 재고를 입력하지 않았어요.' : '입력한 품목은 모두 예상 재고와 일치해요.'}</p>`}
    ${unc.length && unc.length < items.length ? `<p class="small muted" style="margin:6px 0 0">미입력: ${unc.map(x => esc(x.i.name)).join(', ')}</p>` : ''}`;
}
async function confirmMonth() {
  const ym = S.monthYm, shop = S.shop; const items = monthItems(shop, ym);
  const unc = items.filter(i => !monthCalc(i, ym).counted);
  const ok = await confirmDialog({ title: `${SHOPS[shop].name} ${ymLabel(ym)} 월말 확정`, ok: '월말 확정',
    message: `<p style="margin-top:0"><b>${mLabel(ym)} 재고를 확정하면 ${mLabel(addMonth(ym, 1))} 전월 재고로 자동 입력됩니다.</b></p>
      <dl class="kv"><dt>대상</dt><dd>${SHOPS[shop].name} · 품목 ${items.length}개</dd><dt>작성자</dt><dd>${esc(monthRec(shop, ym)?.author || '(비어 있음)')}</dd></dl>
      ${unc.length ? `<div class="banner warn" style="margin:10px 0 0"><div><b>실사 미입력 ${unc.length}개</b>는 예상 재고 값으로 확정돼요: ${unc.slice(0, 6).map(i => esc(i.name)).join(', ')}${unc.length > 6 ? ' 외' : ''}</div></div>` : ''}
      <p class="small muted">확정 후에는 이 달의 실사·${esc(salesLabel())}·반출입을 고칠 수 없어요(확정 해제로 다시 열 수 있음).</p>` });
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
  toast(`${mLabel(ym)} 재고를 확정했어요. ${mLabel(addMonth(ym, 1))} 전월 재고로 들어갔어요.`);
  render();
}
async function unconfirmMonth() {
  const ym = S.monthYm, shop = S.shop;
  if (isConfirmed(shop, addMonth(ym, 1))) { toast(`${mLabel(addMonth(ym, 1))}이 이미 확정되어 있어요. ${mLabel(addMonth(ym, 1))} 확정을 먼저 해제하세요.`, { error: true }); return; }
  const s1 = await confirmDialog({ title: `${ymLabel(ym)} 확정 해제 (1/2)`, ok: '다음 단계', danger: true,
    message: `<b>${SHOPS[shop].name} ${mLabel(ym)}</b> 확정을 해제하면 이 달을 다시 고칠 수 있고, ${mLabel(addMonth(ym, 1))} 전월 재고 자동 입력도 풀려요.` });
  if (!s1) return;
  const s2 = await openModal({ title: `${ymLabel(ym)} 확정 해제 (2/2)`,
    body: `<p style="margin-top:0">정말 해제하려면 아래 칸에 <b>해제</b>라고 입력하세요.</p><input class="inp" id="unc" autocomplete="off" aria-label="확인 문구">`,
    actions: [{ label: '취소', value: false }, { label: '확정 해제', cls: 'danger solid', onClick: ({ el }) => { if ($('#unc', el).value.trim() !== '해제') { toast('‘해제’라고 입력해야 진행돼요.', { error: true }); return false; } return true; } }] });
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
  toast(`${mLabel(ym)} 확정을 해제했어요. 다시 수정할 수 있어요.`);
  render();
}
function exportCSV() {
  const ym = S.monthYm, shop = S.shop; const label = salesLabel(); const rec = monthRec(shop, ym);
  const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const n = v => v === null || v === undefined ? '' : Calc.round(v);
  const lines = [
    [`${SHOPS[shop].name} ${ymLabel(ym)} 재고조사 (월말 정산)`],
    ['작성자', rec?.author || '', '상태', rec?.confirmed ? '확정 ' + fmtDateTime(rec.confirmedAt) : '작성 중'],
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
