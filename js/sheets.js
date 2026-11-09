'use strict';
/* 엑셀로 내보내기 · 종이 점검표 인쇄
 * - 품목 목록 CSV: 열 이름을 엑셀 붙여넣기(js/import.js)가 알아보는 이름으로 맞춰서,
 *   내보내 → 엑셀에서 고치고 → 다시 붙여넣기 가 된다.
 * - 점검표: 창고에서 종이로 세고 나중에 PC로 옮길 때 쓰는 A4 세로 표. */

function csvCell(v) { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function downloadCSV(lines, name) {
  const csv = '﻿' + lines.map(r => r.map(csvCell).join(',')).join('\r\n'); // BOM: 엑셀에서 한글이 안 깨지게
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), name);
}

/** 품목 목록(지금 재고 포함)을 CSV로. rows: [{ i: 품목, v: 지금 재고, st: 상태 }] */
function exportItemsCSV(rows, kind) {
  const n = v => v === null || v === undefined || v === '' ? '' : Calc.round(v);
  const lines = [['카테고리', '품목명', '단위', '1박스 기준', '부족 기준', '지금 재고', '상태', '메모']]
    .concat(rows.map(({ i, v, st }) => [catOf(i)?.name || '', i.name, i.unit || '개', n(i.boxQty || ''), n(i.lowStock), n(v), st.label, i.memo || '']));
  downloadCSV(lines, `${kind}_${SHOPS[S.shop].name}_${todayStr()}.csv`);
  toast(`${rows.length}개 품목을 엑셀(CSV) 파일로 저장했어요.`);
}
function stockRows(items) { return items.map(i => { const v = currentStock(i); return { i, v, st: stockStatus(i, v) }; }); }

/* ---------- 종이 점검표 ---------- */
function openCountSheet() {
  const ym = countYm();
  openModal({ title: '점검표 인쇄', body: `<p class="small" style="margin-top:0">창고에서 종이에 적어 세고, 나중에 [센 날짜]를 그날로 맞춰 PC에 옮길 때 써요. A4 세로로 나와요.</p>
      <div class="fld"><span>넣을 품목</span><div class="scope">
        <label><input type="radio" name="shScope" value="all" checked> 모든 품목</label>
        <label><input type="radio" name="shScope" value="empty"> ${mLabel(ym)}에 아직 안 센 품목만</label></div></div>
      <label class="toggle" style="margin-top:12px"><input type="checkbox" id="shExp"> ‘있어야 할 수’도 적기 <small class="muted">(안 적으면 숫자를 보지 않고 세게 돼서 더 정확해요)</small></label>`,
    actions: [{ label: '취소' }, { label: '인쇄하기', cls: 'primary', onClick: ({ el }) => {
      printCountSheet({ scope: $('input[name=shScope]:checked', el).value, withExp: $('#shExp', el).checked });
    } }] });
}
function printCountSheet({ scope, withExp }) {
  const ym = countYm();
  const groups = surveyGroups(S.shop).map(g => ({ ...g, items: g.items.filter(i => scope !== 'empty' || !monthCalc(i, ym).counted) })).filter(g => g.items.length);
  if (!groups.length) { toast('인쇄할 품목이 없어요. 모두 셌어요!'); return; }
  let no = 0;
  const html = `<div class="sheet">
    <div class="sheet-h"><h1>${esc(SHOPS[S.shop].name)} 재고 점검표</h1>
      <div class="sheet-meta"><span>센 날짜: ______년 ____월 ____일</span><span>센 사람: ______________</span><span class="muted">뽑은 날 ${todayStr()} · ${groups.reduce((n, g) => n + g.items.length, 0)}개 품목</span></div>
      <p class="sheet-tip">박스는 다 찬 박스만 세고, 나머지는 낱개 칸에 적어요. 흙처럼 나눠 쓰는 건 0.3처럼 소수점으로 적어요.</p></div>
    <table class="sheet-tbl"><thead><tr><th class="c-no">번호</th><th>품목</th><th class="c-unit">단위</th><th class="c-box">1박스</th>${withExp ? '<th class="c-num">있어야 할 수</th>' : ''}<th class="c-in">박스</th><th class="c-in">낱개</th><th class="c-memo">메모</th></tr></thead>
    <tbody>${groups.map(g => `<tr class="sheet-grp"><td colspan="${withExp ? 8 : 7}">${esc(g.name)}${g.common ? ' (공용)' : ''}</td></tr>` + g.items.map(i => `<tr>
      <td class="c-no">${++no}</td><td><b>${esc(i.name)}</b></td><td class="c-unit">${esc(i.unit || '개')}</td><td class="c-box">${i.boxQty ? fmt(i.boxQty) : '–'}</td>
      ${withExp ? `<td class="c-num">${fmt(monthCalc(i, ym, S.countDate).expected)}</td>` : ''}<td class="c-in">${i.boxQty ? '' : '／'}</td><td class="c-in"></td><td class="c-memo"></td></tr>`).join('')).join('')}
    </tbody></table></div>`;
  let root = $('#printRoot');
  if (!root) { root = document.createElement('div'); root.id = 'printRoot'; document.body.appendChild(root); }
  root.innerHTML = html;
  document.body.classList.add('print-sheet');
  const done = () => { document.body.classList.remove('print-sheet'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { window.print(); setTimeout(done, 1000); }, 50);
}
