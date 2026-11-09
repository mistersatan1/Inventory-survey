'use strict';
/* 엑셀 붙여넣기로 품목·재고 한 번에 등록
 * - 엑셀에서 표를 복사(Ctrl+C)하면 칸 사이가 탭(\t)으로 붙여넣어진다.
 * - 첫 줄이 제목줄(품목, 카테고리, 재고 …)이면 열을 자동으로 알아보고, 아니면 사용자가 고른다.
 * - 이름이 같은 품목은 새로 만들지 않고 재고만 넣는다.
 * - 엑셀의 병합된 카테고리 칸은 복사하면 아래 줄이 비어 있으므로, 비면 위 줄의 카테고리를 이어 쓴다. */

const IMPORT_ROLES = [
  { key: 'name', label: '품목명', need: true },
  { key: 'cat', label: '카테고리' },
  { key: 'qty', label: '재고 수량' },
  { key: 'unit', label: '단위' },
  { key: 'box', label: '1박스 기준' },
  { key: 'low', label: '부족 기준' },
];
// 제목줄 낱말 → 역할. 앞에 있을수록 먼저 고른다.
const IMPORT_HEADS = {
  name: ['품목명', '품목', '상품명', '상품', '제품명', '제품', '품명', '이름'],
  cat: ['카테고리', '분류', '종류', '구분'],
  qty: ['실사 재고', '현재 재고', '현재고', '재고 수량', '재고량', '재고', '수량', '실사', '전월 재고'],
  unit: ['단위'],
  box: ['1박스 기준', '1박스', '박스 기준', '박스당', '입수'],
  low: ['부족 기준', '안전 재고', '최소 재고', '최소'],
};

/** 붙여넣은 글을 줄·칸으로 나눈다 */
function splitTable(text) {
  const lines = String(text || '').split(/\r?\n/).filter(l => l.trim());
  const hasTab = lines.some(l => l.includes('\t'));
  return lines.map(l => (hasTab ? l.split('\t') : l.split(/,|\s{2,}/)).map(c => c.trim()));
}
/** '1,234개', '12.5 kg' 같은 칸에서 숫자만 뽑는다. 숫자가 없으면 null */
function numFrom(s) {
  const m = cleanNum(s).match(/^-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}
/** 제목줄을 보고 열 역할을 짐작한다. 제목줄이 아니면 null */
function guessHeader(row) {
  const cells = row.map(c => norm(c));
  const map = {}; const used = new Set();
  for (const role of ['name', 'cat', 'qty', 'unit', 'box', 'low']) {
    for (const word of IMPORT_HEADS[role]) {
      const w = norm(word);
      let idx = cells.findIndex((c, i) => !used.has(i) && c === w);
      // '재고'는 예상·부족 재고와 헷갈리지 않게 정확히 같을 때만, 나머지는 포함하면 인정
      const other = role === 'low' ? null : /예상|부족|안전/; // '예상 재고'·'부족 기준'을 재고 수량으로 착각하지 않게
      if (idx < 0 && w !== norm('재고') && w !== norm('실사')) idx = cells.findIndex((c, i) => !used.has(i) && c.includes(w) && !(other && other.test(c)));
      if (idx >= 0) { map[role] = idx; used.add(idx); break; }
    }
  }
  return map.name !== undefined ? map : null;
}
/** 제목줄이 없을 때: 2칸=품목·수량, 3칸 이상=카테고리·품목·…·수량 */
function guessNoHeader(rows) {
  const n = Math.max(...rows.map(r => r.length));
  if (n <= 1) return { name: 0 };
  if (n === 2) return { name: 0, qty: 1 };
  return { cat: 0, name: 1, qty: n - 1 };
}

/** 미리 보기용으로 줄마다 무엇을 할지 정한다 (저장은 하지 않음) */
function planImport(rows, map, opts) {
  const ym = curYm(); const shop = S.shop;
  const existing = new Map(itemsFor(shop, { archived: true }).map(i => [norm(i.name), i]));
  const cats = new Map(catsFor(shop).map(c => [norm(c.name), c]));
  const seen = new Set(); let lastCat = '';
  return rows.map(r => {
    const cell = k => (map[k] === undefined || map[k] === '' ? '' : (r[+map[k]] || '').trim());
    const name = cell('name');
    let cat = cell('cat'); if (cat) lastCat = cat; else cat = lastCat;
    const qtyRaw = cell('qty'); const qty = qtyRaw === '' ? null : numFrom(qtyRaw);
    const p = { name, cat: cat || opts.defaultCat, qty, unit: cell('unit'), box: numFrom(cell('box')), low: numFrom(cell('low')) };
    if (!name) return { ...p, act: 'skip', why: '품목명이 비어 있음' };
    if (/^(합계|소계|총계|total)$/i.test(name)) return { ...p, act: 'skip', why: '합계 줄' };
    if (qtyRaw !== '' && qty === null) return { ...p, act: 'skip', why: `수량 ‘${qtyRaw}’를 숫자로 읽지 못함` };
    const key = norm(name);
    if (seen.has(key)) return { ...p, act: 'skip', why: '위에 같은 이름이 있음' };
    seen.add(key);
    const it = existing.get(key);
    p.item = it || null; p.newCat = !it && !cats.has(norm(p.cat));
    if (it && qty !== null) {
      const c = monthCalc(it, ym);
      if (c.locked) return { ...p, act: 'skip', why: `${mLabel(ym)}이 마감되어 고칠 수 없음` };
      if (opts.target === 'prev' && c.prevAuto) return { ...p, act: 'skip', why: '지난달 마감 값이 이미 들어가 있음' };
    }
    return { ...p, act: it ? 'update' : 'new' };
  });
}

/** 정한 대로 저장한다 */
function applyImport(plan, opts) {
  const ym = curYm(); const now = Date.now();
  const catByName = new Map(catsFor(S.shop).map(c => [norm(c.name), c]));
  const newCats = [], items = [], mds = [];
  let order = Math.max(0, ...[...DB.items.values()].map(i => i.order ?? 0)) + 1;
  let catOrder = Math.max(-1, ...[...DB.categories.values()].map(c => c.order ?? 0)) + 1;
  for (const p of plan) {
    if (p.act === 'skip') continue;
    let it = p.item;
    if (!it) {
      let c = catByName.get(norm(p.cat));
      if (!c) { c = { id: uid(), name: p.cat, shop: opts.scope, order: catOrder++, createdAt: now }; catByName.set(norm(p.cat), c); newCats.push(c); }
      it = { id: uid(), name: p.name, categoryId: c.id, unit: p.unit || '개', boxQty: p.box || 0, lowStock: p.low, memo: '', photo: null, archived: false, order: order++, createdAt: now + order };
      items.push(it);
    } else {
      // 있는 품목은 비어 있는 정보만 채운다 (이미 넣은 값은 덮어쓰지 않음)
      let changed = false;
      if (!it.boxQty && p.box) { it.boxQty = p.box; changed = true; }
      if ((it.lowStock == null || it.lowStock === '') && p.low != null) { it.lowStock = p.low; changed = true; }
      if (it.archived) { it.archived = false; changed = true; }
      if (changed) items.push(it);
    }
    if (p.qty === null) continue;
    const m = ensureMd(ym, it.id);
    if (opts.target === 'prev') m.prevManual = p.qty;
    else { m.box = null; m.ea = p.qty; m.countedAt = now; m.countDate = todayStr(); m.countedShop = S.shop; }
    mds.push(m);
  }
  if (newCats.length) saveMany('categories', newCats);
  if (items.length) saveMany('items', items);
  if (mds.length) saveMany('monthData', mds);
  return { cats: newCats.length, created: plan.filter(p => p.act === 'new').length, updated: plan.filter(p => p.act === 'update').length, stock: mds.length };
}

function openExcelImport() {
  const ym = curYm();
  let rows = [], header = null, map = {};
  const colName = i => header ? (header[i] || `${i + 1}번째 칸`) : `${i + 1}번째 칸${rows[0] && rows[0][i] ? ` (예: ${rows[0][i].slice(0, 10)})` : ''}`;
  openModal({ title: '엑셀에서 품목·재고 붙여넣기', wide: true,
    body: `<ol class="howto small"><li>엑셀에서 <b>제목줄까지 포함해</b> 표를 드래그해 복사(Ctrl+C)해요.</li><li>아래 칸에 붙여넣어요(Ctrl+V). 휴대폰은 길게 눌러 붙여넣기.</li><li>미리 보기를 확인하고 [등록하기]를 눌러요.</li></ol>
      <label class="fld"><span>붙여넣을 내용</span><textarea class="inp" id="xlText" placeholder="카테고리&#9;품목명&#9;단위&#9;현재 재고&#10;문구·엽서&#9;엽서 세트&#9;개&#9;120&#10;&#9;볼펜&#9;개&#9;45"></textarea></label>
      <div id="xlMap"></div>
      <div class="xl-opts" id="xlOpts" hidden>
        <div class="fld"><span>재고 수량은 어디에 넣을까요?</span>
          <div class="scope"><label><input type="radio" name="xlTarget" value="prev" checked> 처음 있던 수 <small class="muted">(지난달 말 재고, 이번 달 계산의 시작)</small></label>
          <label><input type="radio" name="xlTarget" value="count"> 오늘 센 수 <small class="muted">(오늘 창고에서 센 결과)</small></label></div></div>
        <div class="fld"><span>새로 만드는 카테고리는</span>
          <div class="scope"><label><input type="radio" name="xlScope" value="${S.shop}" checked> ${SHOPS[S.shop].name} 전용</label><label><input type="radio" name="xlScope" value="common"> 두 매장 공용</label></div></div>
      </div>
      <div id="xlPrev"></div>`,
    actions: [{ label: '취소' }, { label: '등록하기', cls: 'primary', onClick: ({ el }) => {
      if (!rows.length || map.name === undefined || map.name === '') { toast('붙여넣은 내용과 ‘품목명’ 칸을 확인해 주세요.', { error: true }); return false; }
      const opts = readOpts(el); const plan = planImport(rows, map, opts);
      if (!plan.some(p => p.act !== 'skip')) { toast('등록할 줄이 없어요. 미리 보기의 이유를 확인해 주세요.', { error: true }); return false; }
      const r = applyImport(plan, opts);
      toast(`새 품목 ${r.created}개${r.updated ? ` · 있던 품목 ${r.updated}개` : ''} 등록, 재고 ${r.stock}개 넣었어요${r.cats ? ` (새 카테고리 ${r.cats}개)` : ''}`);
      render();
    } }],
    onMount: ({ el }) => {
      const ta = $('#xlText', el);
      const paint = () => {
        const all = splitTable(ta.value);
        header = all.length ? guessHeader(all[0]) && all[0] : null;
        const guessed = header ? guessHeader(header) : null;
        rows = header ? all.slice(1) : all;
        if (!all.length) { $('#xlMap', el).innerHTML = ''; $('#xlPrev', el).innerHTML = ''; $('#xlOpts', el).hidden = true; return; }
        // 사용자가 이미 고른 열은 유지, 처음이면 짐작한 값
        if (!paint.touched) map = guessed || guessNoHeader(rows);
        const n = Math.max(...all.map(r => r.length));
        $('#xlMap', el).innerHTML = `<div class="xl-map"><p class="small" style="margin:0 0 6px"><b>${header ? '제목줄을 보고 칸을 맞췄어요.' : '제목줄이 없어서 칸을 짐작했어요.'}</b> 틀리면 바꿔 주세요.</p>
          <div class="xl-map-grid">${IMPORT_ROLES.map(r => `<label class="fld"><span>${r.label}${r.need ? ' *' : ''}</span><select class="inp" data-role="${r.key}">
            ${r.need ? '' : '<option value="">(없음)</option>'}${Array.from({ length: n }, (_, i) => `<option value="${i}" ${String(map[r.key]) === String(i) ? 'selected' : ''}>${esc(colName(i))}</option>`).join('')}</select></label>`).join('')}</div></div>`;
        $('#xlOpts', el).hidden = false;
        preview();
      };
      const preview = () => {
        const opts = readOpts(el); const plan = planImport(rows, map, opts);
        const cnt = a => plan.filter(p => p.act === a).length;
        const newCats = [...new Set(plan.filter(p => p.act === 'new' && p.newCat).map(p => p.cat))];
        const tag = p => p.act === 'new' ? '<span class="badge ok">새 품목</span>' : p.act === 'update' ? '<span class="badge lock">있는 품목</span>' : `<span class="badge none">건너뜀</span>`;
        $('#xlPrev', el).innerHTML = `<p class="small" style="margin:12px 0 6px"><b class="match">새 품목 ${cnt('new')}개</b> · <b>있는 품목 ${cnt('update')}개</b>${cnt('skip') ? ` · <b class="minus">건너뜀 ${cnt('skip')}개</b>` : ''}
          ${newCats.length ? `<br><span class="muted">새로 만들 카테고리: ${newCats.map(esc).join(', ')}</span>` : ''}</p>
          <div class="tbl-wrap xl-prev"><table class="tbl"><thead><tr><th>품목</th><th>카테고리</th><th class="n">재고</th><th>할 일</th></tr></thead><tbody>
          ${plan.slice(0, 200).map(p => `<tr><td><b>${esc(p.name || '–')}</b>${p.unit ? ` <small class="muted">${esc(p.unit)}</small>` : ''}</td><td>${esc(p.item ? (catOf(p.item)?.name || '') : p.cat)}</td>
            <td class="n">${p.qty === null ? '<span class="muted">–</span>' : fmt(p.qty)}</td><td>${tag(p)}${p.why ? `<br><small class="muted">${esc(p.why)}</small>` : ''}</td></tr>`).join('')}
          </tbody></table></div>${plan.length > 200 ? `<p class="small muted">처음 200줄만 보여요 (전체 ${plan.length}줄).</p>` : ''}`;
      };
      ta.addEventListener('input', () => { paint.touched = false; paint(); });
      el.addEventListener('change', e => {
        const s = e.target.closest('[data-role]');
        if (s) { map[s.dataset.role] = s.value; paint.touched = true; preview(); return; }
        if (e.target.name === 'xlTarget' || e.target.name === 'xlScope') preview();
      });
    } });
  function readOpts(el) {
    return { target: $('input[name=xlTarget]:checked', el)?.value || 'prev', scope: $('input[name=xlScope]:checked', el)?.value || S.shop,
      defaultCat: '엑셀에서 가져옴' };
  }
}
