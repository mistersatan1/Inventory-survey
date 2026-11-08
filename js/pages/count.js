'use strict';
/* 화면: 재고조사(중간점검) */

/** 진행 정도에 따라 자라는 화분 (0 씨앗 → 4 꽃) */
const PLANT_SVG = `<svg viewBox="0 0 64 64" fill="none">
  <path d="M18 44h28l-3 14a3 3 0 0 1-3 2H24a3 3 0 0 1-3-2z" fill="#c9774a"/><rect x="15" y="40" width="34" height="6" rx="2" fill="#b0623a"/>
  <ellipse cx="32" cy="41" rx="14" ry="2" fill="#5a3a22"/>
  <g class="st st1"><path d="M32 41V30" stroke="#a8dcae" stroke-width="3" stroke-linecap="round"/><path d="M32 33c-6 0-9-3-9-8 5 0 9 3 9 8z" fill="#a8dcae"/></g>
  <g class="st st2"><path d="M32 33c5-1 8-5 8-10-5 0-8 4-8 10z" fill="#d4f0d0"/></g>
  <g class="st st3"><path d="M32 30V18" stroke="#a8dcae" stroke-width="3" stroke-linecap="round"/><path d="M32 24c-5 0-8-3-8-7 5 0 8 3 8 7z" fill="#d4f0d0"/></g>
  <g class="st st4"><circle cx="32" cy="13" r="5" fill="#ffd166"/><g fill="#ff9fb2"><circle cx="32" cy="6" r="4"/><circle cx="39" cy="13" r="4"/><circle cx="32" cy="20" r="4"/><circle cx="25" cy="13" r="4"/></g><circle cx="32" cy="13" r="3.5" fill="#ffd166"/></g>
</svg>`;

/* =====================================================================
 * 7. 재고조사 (중간점검)
 * ===================================================================== */
function surveyGroups(shop) {
  const items = itemsFor(shop);
  const visible = new Set(items.map(i => i.id));
  const used = new Set(); const out = [];
  [...DB.groups.values()].filter(g => g.shop === shop).sort(byOrder).forEach(g => {
    const its = g.itemIds.filter(id => visible.has(id) && !used.has(id)).map(id => DB.items.get(id));
    its.forEach(i => used.add(i.id));
    if (its.length) out.push({ key: 'g:' + g.id, name: g.name, items: its, kind: '묶음' });
  });
  catsFor(shop).forEach(c => {
    const its = items.filter(i => i.categoryId === c.id && !used.has(i.id));
    if (its.length) out.push({ key: 'c:' + c.id, name: c.name, items: its, common: c.shop === 'common' });
  });
  return out;
}
function countRowHTML(item, ym) {
  const c = monthCalc(item, ym);
  const dis = c.locked ? 'disabled' : '';
  const noBox = !item.boxQty;
  const nm = esc(item.name);
  return `<div class="crow ${c.counted ? 'counted' : ''}" data-item="${item.id}" data-ym="${ym}">
    <div class="crow-head">${avatar(item, '', true)}
      <div class="crow-name"><b>${nm}</b>${commonBadge(item)}<small>${boxInfo(item)}</small></div>
      <span class="state v-state"></span></div>
    <div class="crow-in">
      <label><span class="lab">박스</span><input data-f="box" data-nav inputmode="decimal" enterkeyhint="next" autocomplete="off" value="${plain(c.box)}" ${dis} ${noBox ? 'disabled placeholder="없음"' : 'placeholder=" "'} aria-label="${nm} 박스 수량"></label>
      <label><span class="lab">낱개</span><input data-f="ea" data-nav inputmode="decimal" enterkeyhint="next" autocomplete="off" value="${plain(c.ea)}" placeholder=" " ${dis} aria-label="${nm} 낱개 수량"></label>
      <label><span class="lab">${esc(salesLabel())}</span><input data-f="sales" data-nav inputmode="decimal" enterkeyhint="next" autocomplete="off" value="${c.salesSet || c.locked ? plain(c.sales) : ''}" placeholder="0" ${dis} aria-label="${nm} ${esc(SHOPS[S.shop].salesLong)}"></label>
    </div>
    <div class="crow-side">
      <div class="crow-res">
        <div><span class="k">있어야 할 수</span><span class="v v-cexp"></span></div>
        <div><span class="k">센 수</span><span class="v v-total"></span></div>
        <div class="res-diff"><span class="k">차이</span><span class="v v-cdiff" aria-live="polite"></span></div>
      </div>
      <div class="calc v-calc"></div>
    </div>
    <div class="reason v-reason" hidden><input data-f="reason" value="${esc(c.reason)}" placeholder="차이 난 까닭 (선택) 예: 파손 2개" ${dis} aria-label="${nm} 차이 사유"></div>
  </div>`;
}

function refreshRow(row) {
  const item = DB.items.get(row.dataset.item); if (!item) return;
  const ym = row.dataset.ym; const c = monthCalc(item, ym);
  const set = (sel, html) => { const e = $(sel, row); if (e) e.innerHTML = html; };
  set('.v-total', c.counted ? fmt(c.actual) : '<span class="muted">–</span>');
  set('.v-cexp', fmt(c.expected));
  const rd = $('.res-diff', row);
  if (rd) {
    rd.classList.remove('minus', 'plus', 'match');
    if (c.counted) rd.classList.add(c.diff === 0 ? 'match' : c.diff < 0 ? 'minus' : 'plus');
    set('.v-cdiff', c.counted ? diffHTML(c.diff) : '<span class="muted small">세는 중</span>');
  }
  const st = $('.v-state', row);
  if (st) {
    const other = c.counted && isCommon(item) && c.countedShop && c.countedShop !== S.shop ? ` · ${SHOPS[c.countedShop].name}` : '';
    st.className = 'state v-state ' + (c.counted ? 'on' : 'off'); st.textContent = c.counted ? '✓ 셌어요' + other : '아직';
  }
  row.classList.toggle('counted', c.counted);
  set('.v-calc', `전월 ${fmt(c.prev)} + 반입 ${fmt(c.inQ)} − 반출 ${fmt(c.outQ)} − ${esc(salesLabel())} ${fmt(c.sales)}`);
  const rw = $('.v-reason', row); if (rw) rw.hidden = !((c.counted && c.diff !== 0) || c.reason);
  // 월말 정산 표의 칸들
  set('.v-prevval', fmt(c.prev)); set('.v-in', fmt(c.inQ)); set('.v-out', fmt(c.outQ)); set('.v-sales', fmt(c.sales));
  set('.v-exp', fmt(c.expected)); set('.v-diff', diffHTML(c.diff)); set('.v-act', c.counted ? fmt(c.actual) : '<span class="muted">미입력</span>');
  set('.v-actp', c.counted ? fmt(c.actual) : '');
  set('.v-reasonp', esc(c.reason));
}
const PLANT_MSG = ['이제 세기 시작해요', '새싹이 났어요', '잎이 자라고 있어요', '거의 다 왔어요', '다 셌어요! 꽃이 피었어요'];
function refreshCountSummary() {
  const groups = surveyGroups(S.shop); const ym = curYm();
  let total = 0, done = 0;
  groups.forEach(g => {
    const d = g.items.filter(i => monthCalc(i, ym).counted).length; total += g.items.length; done += d;
    const el = $(`[data-gcnt="${CSS.escape(g.key)}"]`);
    if (el) { el.textContent = d === g.items.length ? `✓ ${d}/${g.items.length}` : `${d}/${g.items.length}`; el.classList.toggle('done', d === g.items.length); }
  });
  const pct = total ? done / total : 0;
  const stage = done === 0 ? 0 : pct >= 1 ? 4 : pct >= 0.66 ? 3 : pct >= 0.33 ? 2 : 1;
  const pt = $('#progTxt'); if (pt) pt.innerHTML = `${done}<small>/ ${total}개 셌어요</small>`;
  const pm = $('#progMsg'); if (pm) pm.textContent = PLANT_MSG[stage];
  const pl = $('#plant'); if (pl) pl.dataset.stage = stage;
  const pb = $('#progBar'); if (pb) { pb.style.width = (pct * 100) + '%'; pb.parentElement.setAttribute('aria-valuenow', Math.round(pct * 100)); pb.parentElement.setAttribute('aria-valuetext', `${total}개 중 ${done}개 셌어요`); }
}

function renderCountList() {
  const box = $('#countList'); if (!box) return;
  const ym = curYm();
  const groups = surveyGroups(S.shop);
  const q = S.countQ.trim();
  let html = '';
  let shown = 0;
  groups.forEach(g => {
    const its = g.items.filter(i => matchQ(i.name, q) && (!S.onlyEmpty || !monthCalc(i, ym).counted));
    if (!its.length) return;
    shown += its.length;
    const open = q || S.onlyEmpty || !S.collapsed.has(g.key);
    html += `<section class="grp"><button class="grp-head" data-act="toggle-grp" data-key="${esc(g.key)}" aria-expanded="${!!open}">${svg('chev', 'chev')}
      <span class="gname">${esc(g.name)}${g.common ? ' <span class="badge common">공용</span>' : ''}${g.kind ? ' <span class="badge muted">묶음</span>' : ''}</span>
      <span class="grp-cnt" data-gcnt="${esc(g.key)}"></span></button>
      <div class="grp-body" ${open ? '' : 'hidden'}><div class="crow-cols" aria-hidden="true"><span>품목</span><span class="c3"><span>박스</span><span>낱개</span><span>${esc(salesLabel())}</span></span><span class="c3"><span>있어야 할 수</span><span>센 수</span><span>차이</span></span></div>${its.map(i => countRowHTML(i, ym)).join('')}</div></section>`;
  });
  if (!shown) html = q ? `<div class="empty"><span class="e-ico">🔍</span><strong>‘${esc(q)}’에 맞는 품목이 없어요</strong><p>초성(예: ㅇㄹㅂ)이나 이름 일부로도 찾을 수 있어요.</p><button class="btn" data-act="clear-count-q">검색 지우기</button></div>`
    : `<div class="empty"><span class="e-ico">🌸</span><strong>모든 품목을 셌어요</strong><p>이제 아래 [중간점검 저장]을 눌러 오늘 점검을 남겨 주세요.</p><button class="btn" data-act="show-all">전체 품목 보기</button></div>`;
  box.innerHTML = html;
  $$('.crow', box).forEach(refreshRow);
  refreshCountSummary();
}
function renderCount(main) {
  const ym = curYm(); const t = todayStr();
  const items = itemsFor(S.shop);
  const locked = isConfirmed(S.shop, ym);
  const cps = [...DB.checkpoints.values()].filter(c => c.shop === S.shop);
  if (!items.length) {
    main.innerHTML = `<div class="empty card"><span class="e-ico">🌱</span><strong>아직 ${SHOPS[S.shop].name} 품목이 없어요</strong><p>품목을 등록하면 여기서 바로 재고를 셀 수 있어요.</p><button class="btn primary" data-act="new-item">첫 품목 등록하기</button></div>`;
    return;
  }
  main.innerHTML = `
    <div class="grow-card">
      <div class="plant" id="plant" data-stage="0" aria-hidden="true">${PLANT_SVG}</div>
      <div class="grow-txt">
        <div class="grow-top"><div class="grow-num num" id="progTxt"></div><p class="grow-msg" id="progMsg"></p></div>
        <div class="bar" role="progressbar" aria-label="입력한 품목 비율" aria-valuemin="0" aria-valuemax="100"><i id="progBar"></i></div>
      </div>
    </div>
    <div class="period-line">
      <div class="when num">${mLabel(ym)} 1일 ~ ${dKo(t)} 점검<small>숫자를 넣으면 바로 저장돼요. 다 세면 아래 [중간점검 저장]을 눌러요.</small></div>
      <button class="btn sm" data-act="cp-history">${svg('history')}지난 점검 (${cps.length})</button>
    </div>
    ${locked ? `<div class="banner lock"><span class="b-ico">🔒</span><div><b>${mLabel(ym)}은 월말 확정되어 고칠 수 없어요.</b>고치려면 월말 정산에서 확정을 풀어 주세요.<br><button class="btn sm" data-act="nav" data-page="month">월말 정산 열기</button></div></div>` : ''}
    <div class="tools">
      <div class="search">${svg('search')}<input class="inp" id="countQ" type="search" value="${esc(S.countQ)}" placeholder="품목 찾기 (예: 유리병, ㅇㄹㅂ)" aria-label="품목 찾기" autocomplete="off"></div>
      <div class="tools-row">
        <label class="toggle"><input type="checkbox" id="onlyEmpty" ${S.onlyEmpty ? 'checked' : ''}> 아직 안 센 것만</label>
        <button class="btn sm" data-act="paste-sales" ${locked ? 'disabled' : ''}>${svg('file')}${esc(salesLabel())} 수량 붙여넣기</button>
      </div>
    </div>
    <div id="countList"></div>
    <div class="bottom-bar no-print">
      <div class="save-state" id="saveState" role="status"></div>
      <button class="btn primary" data-act="save-cp" ${locked ? 'disabled' : ''}>중간점검 저장</button>
    </div>`;
  renderCountList();
  renderSaveState();
  $('#countQ').addEventListener('input', e => { S.countQ = e.target.value; renderCountList(); });
  $('#onlyEmpty').addEventListener('change', e => { S.onlyEmpty = e.target.checked; renderCountList(); });
}
function renderSaveState() {
  const el = $('#saveState'); if (!el) return;
  el.className = 'save-state ' + (SaveState.state === 'saving' ? 'saving' : SaveState.state === 'err' ? 'err' : '');
  el.textContent = SaveState.state === 'saving' ? '저장하는 중…' : SaveState.state === 'err' ? '저장하지 못했어요. 숫자를 다시 넣어 주세요'
    : `자동 저장됨${SaveState.at ? ' ' + fmtDateTime(SaveState.at).slice(11) : ''}`;
}
saveListeners.push(renderSaveState);

function saveCheckpoint() {
  const ym = curYm();
  const items = itemsFor(S.shop);
  const rows = items.map(i => { const c = monthCalc(i, ym); return { itemId: i.id, name: i.name, counted: c.counted, actual: c.actual, expected: c.expected, diff: c.diff, sales: c.sales, reason: c.reason }; });
  const rec = { id: uid(), shop: S.shop, ym, date: todayStr(), savedAt: Date.now(), rows };
  save('checkpoints', rec);
  S.countDirty = false;
  const done = rows.filter(r => r.counted).length;
  toast(`${dKo(rec.date)} 중간점검을 저장했어요 (입력 ${done}/${rows.length})`);
  if (S.page === 'count') { const b = $('[data-act="cp-history"]'); if (b) b.textContent = `이전 점검 기록 (${[...DB.checkpoints.values()].filter(c => c.shop === S.shop).length})`; }
}
function showCheckpoints() {
  const list = [...DB.checkpoints.values()].filter(c => c.shop === S.shop).sort((a, b) => b.savedAt - a.savedAt);
  const body = list.length ? `<ul class="list">${list.map(c => {
    const done = c.rows.filter(r => r.counted).length; const diffs = c.rows.filter(r => r.counted && r.diff !== 0).length;
    return `<li class="li"><div class="grow"><b class="num">${fmtDateTime(c.savedAt)}</b><small>입력 ${done}/${c.rows.length} · 차이 있는 품목 ${diffs}개</small></div>
      <button class="btn sm" data-cp="${c.id}">열어보기</button></li>`; }).join('')}</ul>`
    : `<div class="empty"><span class="e-ico">🗓</span><strong>아직 저장한 중간점검이 없어요</strong><p>재고조사 화면 아래 [중간점검 저장]을 누르면 날짜별로 남아요.</p></div>`;
  openModal({ title: `${SHOPS[S.shop].name} 이전 점검 기록`, body, actions: [{ label: '닫기', cls: 'primary' }], onMount: ({ el, close }) => {
    $$('[data-cp]', el).forEach(b => b.addEventListener('click', () => { close(); showCheckpoint(DB.checkpoints.get(b.dataset.cp)); }));
  } });
}
function showCheckpoint(c) {
  openModal({ title: `중간점검 ${fmtDateTime(c.savedAt)}`, wide: true,
    body: `<div class="tbl-wrap"><table class="tbl cards"><thead><tr><th>품목</th><th class="n">실사</th><th class="n">예상</th><th class="n">차이</th><th class="n">${esc(salesLabel())}</th><th>사유</th></tr></thead><tbody>
      ${c.rows.map(r => `<tr><td class="first"><b>${esc(DB.items.get(r.itemId)?.name || r.name)}</b></td><td class="n" data-label="실사">${r.counted ? fmt(r.actual) : '<span class="muted">미입력</span>'}</td>
      <td class="n" data-label="예상">${fmt(r.expected)}</td><td class="n" data-label="차이">${r.counted ? diffHTML(r.diff) : '–'}</td><td class="n" data-label="${esc(salesLabel())}">${fmt(r.sales)}</td><td data-label="사유">${esc(r.reason || '')}</td></tr>`).join('')}
    </tbody></table></div>`, actions: [{ label: '목록으로', value: 'back' }, { label: '닫기', cls: 'primary' }] })
    .then(v => { if (v === 'back') showCheckpoints(); });
}

/* ---------- 판매 수량 붙여넣기 ---------- */
function parsePaste(text, items) {
  const byName = new Map(items.map(i => [norm(i.name), i]));
  const matched = [], unmatched = [];
  text.split(/\r?\n/).forEach(line => {
    if (!line.trim()) return;
    let cols = line.split('\t').map(s => s.trim()).filter(Boolean);
    if (cols.length < 2) { const m = line.trim().match(/^(.*?)[\s,;]+([-\d.,]+)\s*$/); cols = m ? [m[1], m[2]] : [line.trim()]; }
    const name = cols[0]; const qty = parseNum(cols[cols.length - 1]);
    const it = byName.get(norm(name));
    if (cols.length < 2 || qty === undefined || qty === null) unmatched.push({ line, why: '수량을 읽지 못함' });
    else if (!it) unmatched.push({ line, why: '같은 이름의 품목 없음' });
    else matched.push({ item: it, qty });
  });
  return { matched, unmatched };
}
function pasteSales() {
  const label = salesLabel(); const ym = curYm();
  const items = itemsFor(S.shop).filter(i => !isLocked(i, ym));
  let parsed = { matched: [], unmatched: [] };
  openModal({ title: `${label} 수량 붙여넣기`, wide: true,
    body: `<p class="small muted" style="margin-top:0">엑셀이나 POS 화면에서 <b>품목명</b>과 <b>수량</b> 두 열을 복사해 아래에 붙여넣으세요. 품목명이 같은 품목에 ${mLabel(ym)} 누적 ${label} 수량으로 채워져요(기존 값은 바뀜).</p>
      <label class="fld"><span>붙여넣을 내용</span><textarea class="inp" id="pasteTxt" placeholder="유리병 소&#9;393&#10;키링&#9;120"></textarea></label>
      <div id="pastePrev" style="margin-top:12px"></div>`,
    actions: [{ label: '취소', value: null }, { label: `${label} 수량 채우기`, cls: 'primary', onClick: () => {
      if (!parsed.matched.length) { toast('채울 수 있는 줄이 없어요. 품목명과 수량을 확인해 주세요.', { error: true }); return false; }
      const recs = parsed.matched.map(({ item, qty }) => { const m = ensureMd(ym, item.id); m.sales = qty; return m; });
      saveMany('monthData', recs); S.countDirty = true;
      toast(`${recs.length}개 품목의 ${label} 수량을 채웠어요${parsed.unmatched.length ? ` · 못 맞춘 줄 ${parsed.unmatched.length}개` : ''}`);
      renderCountList();
    } }],
    onMount: ({ el }) => {
      const ta = $('#pasteTxt', el);
      ta.addEventListener('input', () => {
        parsed = parsePaste(ta.value, items);
        $('#pastePrev', el).innerHTML = !ta.value.trim() ? '' : `
          <p class="small" style="margin:0 0 6px"><b class="match">맞춘 품목 ${parsed.matched.length}개</b>${parsed.unmatched.length ? ` · <b class="minus">못 맞춘 줄 ${parsed.unmatched.length}개</b>` : ''}</p>
          ${parsed.matched.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>품목</th><th class="n">${esc(label)} 수량</th></tr></thead><tbody>${parsed.matched.map(m => `<tr><td>${esc(m.item.name)}</td><td class="n">${fmt(m.qty)}</td></tr>`).join('')}</tbody></table></div>` : ''}
          ${parsed.unmatched.length ? `<div class="banner warn" style="margin-top:10px"><div><b>아래 줄은 짝을 찾지 못했어요 (채우지 않음)</b>${parsed.unmatched.map(u => `<div class="small">· ${esc(u.line)} <span class="muted">— ${u.why}</span></div>`).join('')}<div class="small muted" style="margin-top:4px">품목명이 앱에 등록된 이름과 똑같아야 해요(띄어쓰기·대소문자는 무시).</div></div></div>` : ''}`;
      });
    } });
}
