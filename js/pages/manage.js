'use strict';
/* 화면: 품목·카테고리·조사 묶음 관리 */

/* =====================================================================
 * 11. 품목·카테고리 관리
 * ===================================================================== */
function enableDragSort(listEl, onDone) {
  const items = () => $$(':scope > [data-id]', listEl);
  listEl.addEventListener('pointerdown', e => {
    const handle = e.target.closest('.drag'); if (!handle || !listEl.contains(handle)) return;
    const row = handle.closest('[data-id]'); if (!row || row.parentElement !== listEl) return;
    e.preventDefault(); row.classList.add('dragging'); handle.setPointerCapture(e.pointerId);
    const move = ev => {
      const y = ev.clientY; let before = null;
      for (const s of items()) { if (s === row) continue; const r = s.getBoundingClientRect(); if (y < r.top + r.height / 2) { before = s; break; } }
      if (before) { if (before !== row.nextElementSibling) listEl.insertBefore(row, before); } else if (listEl.lastElementChild !== row) listEl.appendChild(row);
    };
    const up = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up); row.classList.remove('dragging'); onDone(items().map(x => x.dataset.id)); };
    handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
  });
  listEl.addEventListener('keydown', e => {
    const handle = e.target.closest('.drag'); if (!handle || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const row = handle.closest('[data-id]'); e.preventDefault();
    if (e.key === 'ArrowUp' && row.previousElementSibling) listEl.insertBefore(row, row.previousElementSibling);
    else if (e.key === 'ArrowDown' && row.nextElementSibling) listEl.insertBefore(row.nextElementSibling, row);
    handle.focus(); onDone(items().map(x => x.dataset.id));
  });
}
const dragBtn = name => `<button type="button" class="drag" aria-label="${esc(name)} 순서 바꾸기 (끌거나 ↑↓ 키)">${svg('grip')}</button>`;
function reorder(store, ids) { const recs = ids.map((id, i) => { const r = DB[store].get(id); r.order = i; return r; }); saveMany(store, recs); }

function renderManage(main) {
  const t = S.mgTab;
  main.innerHTML = `<div class="tabs" role="group" aria-label="관리할 것 고르기">
      <button class="${t === 'cat' ? 'on' : ''}" aria-pressed="${t === 'cat'}" data-act="mg-tab" data-t="cat">카테고리</button>
      <button class="${t === 'item' ? 'on' : ''}" aria-pressed="${t === 'item'}" data-act="mg-tab" data-t="item">품목</button>
      <button class="${t === 'group' ? 'on' : ''}" aria-pressed="${t === 'group'}" data-act="mg-tab" data-t="group">조사 묶음</button></div>
    <div id="mgBody"></div>`;
  ({ cat: renderCatTab, item: renderItemTab, group: renderGroupTab })[t]($('#mgBody'));
}
function renderCatTab(box) {
  const cats = catsFor(S.shop);
  const cnt = id => [...DB.items.values()].filter(i => i.categoryId === id && !i.archived).length;
  box.innerHTML = `<section class="card">
      <h2>카테고리 추가</h2>
      <div class="add-row"><label class="fld"><span>카테고리 이름</span><input class="inp" id="newCatName" placeholder="예: 유리 용기" autocomplete="off"></label></div>
      <div class="fld" style="margin-top:10px"><span>소속</span><div class="scope">
        <label><input type="radio" name="newCatScope" value="${S.shop}" checked> 현재 매장 전용 (${SHOPS[S.shop].name})</label>
        <label><input type="radio" name="newCatScope" value="common"> 공동비품 (두 매장 공용)</label></div></div>
      <button class="btn primary" data-act="add-cat" style="margin-top:12px;width:100%">카테고리 추가</button>
    </section>
    <section class="card"><h2>${SHOPS[S.shop].name}에서 보이는 카테고리 <small class="muted">(끌어서 순서 변경)</small></h2>
      ${cats.length ? `<ul class="list" id="catList">${cats.map(c => `<li class="li" data-id="${c.id}">${dragBtn(c.name)}
        <div class="grow"><b>${esc(c.name)}</b> ${c.shop === 'common' ? '<span class="badge common">공용</span>' : ''}<small>품목 ${cnt(c.id)}개${c.shop === 'common' ? ' · 두 매장이 같이 씀' : ''}</small></div>
        <button class="icon-btn" data-act="rename-cat" data-id="${c.id}">이름 변경</button><button class="icon-btn danger" data-act="del-cat" data-id="${c.id}">삭제</button></li>`).join('')}</ul>`
      : `<div class="empty"><strong>아직 카테고리가 없어요</strong><p>위에서 첫 카테고리를 추가하세요.</p></div>`}</section>`;
  const list = $('#catList', box); if (list) enableDragSort(list, ids => reorder('categories', ids));
  $('#newCatName', box).addEventListener('keydown', e => { if (e.key === 'Enter') addCategoryFromForm(); });
}
function addCategoryFromForm() {
  const name = $('#newCatName').value.trim(); const scope = $('input[name=newCatScope]:checked').value;
  if (!name) { toast('카테고리 이름을 넣어 주세요.', { error: true }); $('#newCatName').focus(); return; }
  const c = createCategory(name, scope);
  toast(`‘${c.name}’ 카테고리를 추가했어요${scope === 'common' ? ' (두 매장 공용)' : ''}`);
  render();
}
function createCategory(name, scope) {
  const max = Math.max(-1, ...[...DB.categories.values()].map(c => c.order ?? 0));
  const c = { id: uid(), name, shop: scope, order: max + 1, createdAt: Date.now() }; save('categories', c); return c;
}
function openCategoryEditor(onDone) {
  openModal({ title: '카테고리 추가', body: `<label class="fld"><span>카테고리 이름</span><input class="inp" id="cName" autocomplete="off"></label>
    <div class="fld" style="margin-top:10px"><span>소속</span><div class="scope"><label><input type="radio" name="cScope" value="${S.shop}" checked> 현재 매장 전용 (${SHOPS[S.shop].name})</label><label><input type="radio" name="cScope" value="common"> 공동비품 (두 매장 공용)</label></div></div>`,
    actions: [{ label: '취소' }, { label: '카테고리 추가', cls: 'primary', onClick: ({ el }) => {
      const n = $('#cName', el).value.trim(); if (!n) { toast('카테고리 이름을 넣어 주세요.', { error: true }); return false; }
      const c = createCategory(n, $('input[name=cScope]:checked', el).value); toast(`‘${n}’ 카테고리를 추가했어요`); return c;
    } }] }).then(c => { if (c && onDone) onDone(c); else if (c) render(); });
}
function renameCategory(id) {
  const c = DB.categories.get(id);
  openModal({ title: '카테고리 이름 변경', body: `<label class="fld"><span>새 이름</span><input class="inp" id="rn" value="${esc(c.name)}" autocomplete="off"></label>${c.shop === 'common' ? '<p class="small muted">공용 카테고리라 두 매장 모두에서 바뀌어요.</p>' : ''}`,
    actions: [{ label: '취소' }, { label: '이름 저장', cls: 'primary', onClick: ({ el }) => { const n = $('#rn', el).value.trim(); if (!n) return false; c.name = n; save('categories', c); toast('이름을 바꿨어요'); render(); } }] });
}
async function deleteCategory(id) {
  const c = DB.categories.get(id);
  const its = [...DB.items.values()].filter(i => i.categoryId === id);
  if (!its.length) {
    if (await confirmDialog({ title: '카테고리 삭제', message: `‘<b>${esc(c.name)}</b>’ 카테고리를 삭제할까요?`, ok: `‘${c.name}’ 삭제`, danger: true })) {
      del('categories', id); toast(`‘${c.name}’ 카테고리를 삭제했어요`); render();
    }
    return;
  }
  const targets = (c.shop === 'common' ? [...DB.categories.values()] : catsFor(c.shop)).filter(x => x.id !== id && (c.shop === 'common' || x.shop === c.shop || x.shop === 'common'));
  if (!targets.length) { openModal({ title: '먼저 옮길 카테고리가 필요해요', body: `‘${esc(c.name)}’에 품목이 ${its.length}개 있어요. 품목을 옮길 다른 카테고리를 먼저 추가한 뒤 삭제하세요.`, actions: [{ label: '닫기', cls: 'primary' }] }); return; }
  openModal({ title: '품목을 어디로 옮길까요?',
    body: `<p style="margin-top:0">‘<b>${esc(c.name)}</b>’에 품목이 <b>${its.length}개</b> 있어요 (보관 품목 포함). 삭제하기 전에 옮길 카테고리를 고르세요.</p>
      <p class="small muted">${its.slice(0, 8).map(i => esc(i.name)).join(', ')}${its.length > 8 ? ' …' : ''}</p>
      <label class="fld"><span>옮길 카테고리</span><select class="inp" id="mvTo">${targets.map(t => `<option value="${t.id}">${esc(t.name)}${t.shop === 'common' ? ' (공용)' : ` (${SHOPS[t.shop].name})`}</option>`).join('')}</select></label>`,
    actions: [{ label: '취소' }, { label: '품목 옮기고 삭제', cls: 'danger solid', onClick: ({ el }) => {
      const to = $('#mvTo', el).value; its.forEach(i => { i.categoryId = to; }); saveMany('items', its); del('categories', id);
      toast(`품목 ${its.length}개를 ‘${DB.categories.get(to).name}’로 옮기고 ‘${c.name}’을 삭제했어요`); render();
    } }] });
}
/* ---------- 표로 한 번에 고치기 (PC에서 여러 품목을 수정 창 없이) ----------
 * 칸을 고치면 노랗게 표시되고, [바뀐 내용 저장]을 눌러야 한 번에 저장된다.
 * 입력 칸은 data-gf/data-gid 를 써서 재고 세기용 자동 저장(data-f/data-item)과 섞이지 않게 한다. */
let gridApi = null;
const GRID_UNITS = ['개', 'ea', '포대', '봉', '통', '롤', 'g', 'kg', 'L', 'ml', '매', '장', '포', '병', '세트'];
function renderItemGrid(box) {
  const items = itemsFor(S.shop); const cats = catsFor(S.shop);
  box.innerHTML = `<div class="grid-bar"><div class="grow"><b>표로 한 번에 고치기</b><small class="muted">칸을 고친 뒤 [바뀐 내용 저장]을 눌러요. <kbd>Enter</kbd> 아래 품목 · <kbd>Tab</kbd> 옆 칸</small></div>
      <span class="grid-dirty" id="gridDirty" aria-live="polite">바뀐 칸 없음</span>
      <button class="btn" data-act="grid-cancel">그만 고치기</button><button class="btn primary" data-act="grid-save" id="gridSave" disabled>바뀐 내용 저장</button></div>
    ${items.length ? `<div class="tbl-wrap"><table class="tbl grid-tbl" id="itemGrid"><thead><tr><th>품목명</th><th>카테고리</th><th>단위</th><th class="n">1박스 기준</th><th class="n">부족 기준</th><th>메모</th></tr></thead><tbody>
    ${items.map(i => `<tr data-gid="${i.id}">
      <td><input class="inp" data-gf="name" value="${esc(i.name)}" aria-label="품목명" autocomplete="off"></td>
      <td><select class="inp" data-gf="categoryId" aria-label="${esc(i.name)} 카테고리">${cats.map(c => `<option value="${c.id}" ${c.id === i.categoryId ? 'selected' : ''}>${esc(c.name)}${c.shop === 'common' ? ' (공용)' : ''}</option>`).join('')}</select></td>
      <td><input class="inp" data-gf="unit" list="gridUnits" value="${esc(i.unit || '개')}" aria-label="${esc(i.name)} 단위" autocomplete="off"></td>
      <td class="n"><input class="inp num" data-gf="boxQty" inputmode="decimal" value="${i.boxQty ? plain(i.boxQty) : ''}" placeholder="없음" aria-label="${esc(i.name)} 1박스 기준"></td>
      <td class="n"><input class="inp num" data-gf="lowStock" inputmode="decimal" value="${plain(i.lowStock)}" placeholder="–" aria-label="${esc(i.name)} 부족 기준"></td>
      <td><input class="inp" data-gf="memo" value="${esc(i.memo || '')}" aria-label="${esc(i.name)} 메모" autocomplete="off"></td></tr>`).join('')}
    </tbody></table></div><datalist id="gridUnits">${GRID_UNITS.map(u => `<option value="${u}">`).join('')}</datalist>`
    : '<div class="empty card"><strong>고칠 품목이 없어요</strong></div>'}`;
  const tbl = $('#itemGrid', box); if (!tbl) { gridApi = null; return; }
  const cells = () => $$('[data-gf]', tbl);
  cells().forEach(e => { e.dataset.orig = e.value; });
  const dirtyCells = () => cells().filter(e => e.value !== e.dataset.orig);
  const update = () => {
    cells().forEach(e => e.classList.toggle('dirty', e.value !== e.dataset.orig));
    const n = dirtyCells().length; const rows = new Set(dirtyCells().map(e => e.closest('tr').dataset.gid)).size;
    $('#gridDirty', box).textContent = n ? `${rows}개 품목 · 바뀐 칸 ${n}개` : '바뀐 칸 없음';
    $('#gridSave', box).disabled = !n;
  };
  tbl.addEventListener('input', e => { if (e.target.matches('[data-gf]')) { e.target.classList.remove('bad'); update(); } });
  tbl.addEventListener('change', update);
  tbl.addEventListener('keydown', e => { // Enter: 아래 품목의 같은 칸
    if (e.key !== 'Enter' || e.isComposing || !e.target.matches('[data-gf]')) return;
    e.preventDefault();
    const tr = e.shiftKey ? e.target.closest('tr').previousElementSibling : e.target.closest('tr').nextElementSibling;
    const n = tr && $(`[data-gf="${e.target.dataset.gf}"]`, tr);
    if (n) { n.focus(); if (n.select) n.select(); n.scrollIntoView({ block: 'nearest' }); }
  });
  gridApi = {
    dirty: () => tbl.isConnected ? dirtyCells().length : 0,
    save() {
      const byRow = new Map();
      for (const e of dirtyCells()) { const id = e.closest('tr').dataset.gid; if (!byRow.has(id)) byRow.set(id, []); byRow.get(id).push(e); }
      const recs = []; let bad = null;
      for (const [id, es] of byRow) {
        const it = DB.items.get(id); if (!it) continue; const patch = {};
        for (const e of es) {
          const f = e.dataset.gf; let v = e.value.trim();
          if (f === 'name' && !v) { bad = bad || e; e.classList.add('bad'); continue; }
          if (f === 'boxQty' || f === 'lowStock') {
            const n = parseNum(v); if (n === undefined) { bad = bad || e; e.classList.add('bad'); continue; }
            v = f === 'boxQty' ? (n || 0) : n;
          }
          if (f === 'unit' && !v) v = '개';
          patch[f] = v;
        }
        recs.push(Object.assign(it, patch));
      }
      if (bad) { toast('빨간 칸을 확인해 주세요. 품목명은 비울 수 없고, 숫자 칸에는 숫자만 넣어요.', { error: true }); bad.focus(); return; }
      if (recs.length) saveMany('items', recs);
      toast(`${recs.length}개 품목을 고쳤어요`);
      S.itemGrid = false; gridApi = null; render();
    },
  };
  update();
}
async function leaveGrid() {
  if (gridApi && gridApi.dirty() && !(await confirmDialog({ title: '고친 내용을 버릴까요?', message: `아직 저장하지 않은 칸이 ${gridApi.dirty()}개 있어요.`, ok: '저장하지 않고 나가기', danger: true, cancel: '계속 고치기' }))) return false;
  S.itemGrid = false; gridApi = null; return true;
}

function renderItemTab(box) {
  if (S.itemGrid) return renderItemGrid(box);
  const all = itemsFor(S.shop, { archived: true });
  const arch = all.filter(i => i.archived);
  const show = S.showArchived ? arch : all.filter(i => !i.archived);
  const cats = catsFor(S.shop);
  box.innerHTML = `<div class="page-head"><div class="btn-row"><button class="btn primary" data-act="new-item">${svg('plus')}품목 추가</button><button class="btn" data-act="xl-import">엑셀에서 붙여넣기</button></div>
    <div class="btn-row">${S.showArchived ? '' : `<button class="btn sm" data-act="item-grid">${svg('edit')}표로 한 번에 고치기</button><button class="btn sm" data-act="items-csv">${svg('file')}엑셀로 내보내기</button>`}
    <button class="btn sm" data-act="toggle-archive">${S.showArchived ? '← 사용 중인 품목 보기' : `보관함 (${arch.length})`}</button></div></div>
    ${S.showArchived ? '<div class="banner info"><span class="b-ico">📦</span><div><b>보관함</b>보관한 품목은 재고 세기·목록에서 숨겨지지만 지난 기록은 그대로 남아요.</div></div>' : ''}
    ${show.length ? cats.map(c => { const its = show.filter(i => i.categoryId === c.id); if (!its.length) return ''; return `<div class="sec-title"><span>${esc(c.name)} ${c.shop === 'common' ? '<span class="badge common">공용</span>' : ''}</span><span>${its.length}개</span></div>
      <ul class="list card">${its.map(i => `<li class="li">${avatar(i, '', true)}<div class="grow"><b>${esc(i.name)}</b>${commonBadge(i)}<small>${boxInfo(i)} · 단위 ${esc(i.unit || 'ea')}${i.lowStock != null && i.lowStock !== '' ? ` · 부족 기준 ${fmt(i.lowStock)}` : ''}${i.memo ? ' · ' + esc(i.memo) : ''}</small></div>
        ${S.showArchived ? `<button class="btn sm" data-act="unarchive" data-id="${i.id}">다시 꺼내기</button>` : `<button class="icon-btn" data-act="edit-item" data-id="${i.id}" aria-label="${esc(i.name)} 수정">${svg('edit')}수정</button>`}</li>`).join('')}</ul>`; }).join('')
    : S.showArchived ? `<div class="empty card"><strong>보관한 품목이 없어요</strong></div>`
    : `<div class="empty card"><span class="e-ico">🌱</span><strong>아직 품목이 없어요</strong><p>사진과 1박스 기준 수량을 넣어 두면 재고 세기가 빨라져요.</p><button class="btn primary" data-act="new-item">첫 품목 등록하기</button></div>`}`;
}
function compressImage(file, max = 400, q = 0.7) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url); res(cv.toDataURL('image/jpeg', q));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('사진을 읽지 못했어요. 다른 사진을 골라 주세요.')); };
    img.src = url;
  });
}
function openItemEditor(id, opts = {}) {
  const it = id ? DB.items.get(id) : null;
  const cats = catsFor(S.shop);
  let photo = it ? it.photo || null : null;
  const defCat = it ? it.categoryId : (opts.cat && opts.cat !== 'all' ? opts.cat : cats[0]?.id || '__new');
  const units = ['개', 'ea', '포대', '봉', '통', '롤', 'g', 'kg', 'L', 'ml', '매', '장', '포', '병', '세트'];
  const body = `
    <div class="photo-edit"><span id="phPrev"></span>
      <div class="btn-row" style="flex-direction:column;align-items:stretch;flex:1">
        <label class="btn" style="position:relative">📷 사진 찍기 / 고르기<input type="file" accept="image/*" capture="environment" id="phFile" style="position:absolute;inset:0;opacity:0;width:100%;cursor:pointer" aria-label="사진 찍기 또는 고르기"></label>
        <button type="button" class="btn sm ghost" id="phDel">사진 지우기</button>
        <small class="muted">자동으로 작게 줄여 저장해요 (긴 변 400px)</small></div></div>
    <div class="form-grid" style="margin-top:14px">
      <label class="fld full"><span>품목명 *</span><input class="inp" id="iName" value="${esc(it?.name || '')}" placeholder="예: 유리병 소" autocomplete="off"><small class="err" id="eName"></small></label>
      <label class="fld full"><span>카테고리 *</span><select class="inp" id="iCat">
        ${cats.map(c => `<option value="${c.id}" ${c.id === defCat ? 'selected' : ''}>${esc(c.name)}${c.shop === 'common' ? ' (공용)' : ''}</option>`).join('')}
        <option value="__new" ${defCat === '__new' ? 'selected' : ''}>＋ 새 카테고리 만들기</option></select></label>
      <div class="full" id="newCatBox" hidden><div class="form-grid"><label class="fld full"><span>새 카테고리 이름</span><input class="inp" id="iNewCat" autocomplete="off"></label>
        <div class="fld full scope"><label><input type="radio" name="iScope" value="${S.shop}" checked> ${SHOPS[S.shop].name} 전용</label><label><input type="radio" name="iScope" value="common"> 공동비품 (공용)</label></div></div></div>
      <label class="fld"><span>단위</span><input class="inp" id="iUnit" list="unitList" value="${esc(it?.unit || '개')}" autocomplete="off"><datalist id="unitList">${units.map(u => `<option value="${u}">`).join('')}</datalist><small class="muted">흙처럼 나눠 쓰면 ‘포대’로 두고 0.3처럼 소수점으로 적어요</small></label>
      <label class="fld"><span>1박스 기준 수량</span><input class="inp num" id="iBox" inputmode="decimal" value="${plain(it?.boxQty)}" placeholder="예: 24"><small class="muted">박스 없이 세면 비워 두세요</small></label>
      <label class="fld"><span>부족 기준 수량 (선택)</span><input class="inp num" id="iLow" inputmode="decimal" value="${plain(it?.lowStock)}" placeholder="이 수량 이하면 ‘부족’"></label>
      <label class="fld full"><span>메모 (선택)</span><input class="inp" id="iMemo" value="${esc(it?.memo || '')}" autocomplete="off"></label>
    </div>`;
  const actions = [{ label: '취소' }];
  if (it && !it.archived) actions.unshift({ label: '품목 보관', cls: 'danger', onClick: async () => {
    const ok = await confirmDialog({ title: '품목 보관', message: `‘<b>${esc(it.name)}</b>’을(를) 보관할까요?<br><span class="small muted">재고 세기와 목록에서 숨겨지고, 지난 달 기록은 그대로 남아요. 품목 관리 &gt; 보관함에서 다시 꺼낼 수 있어요.</span>`, ok: `‘${it.name}’ 보관`, danger: true });
    if (!ok) return false;
    it.archived = true; it.archivedAt = Date.now(); save('items', it); toast(`‘${it.name}’을(를) 보관했어요`, { undo: () => { it.archived = false; save('items', it); render(); } }); render();
  } });
  actions.push({ label: it ? '수정 내용 저장' : '품목 저장', cls: 'primary', onClick: ({ el }) => {
    const name = $('#iName', el).value.trim();
    if (!name) { $('#eName', el).textContent = '품목명을 넣어 주세요.'; $('#iName', el).focus(); return false; }
    let catId = $('#iCat', el).value;
    if (catId === '__new') {
      const cn = $('#iNewCat', el).value.trim(); if (!cn) { toast('새 카테고리 이름을 넣어 주세요.', { error: true }); $('#iNewCat', el).focus(); return false; }
      catId = createCategory(cn, $('input[name=iScope]:checked', el).value).id;
    }
    const box = parseNum($('#iBox', el).value), low = parseNum($('#iLow', el).value);
    if (box === undefined || low === undefined) { toast('숫자 칸에는 숫자만 넣어 주세요.', { error: true }); return false; }
    const rec = it ? (DB.items.get(it.id) || it) : { id: uid(), createdAt: Date.now(), order: Date.now(), archived: false };
    Object.assign(rec, { name, categoryId: catId, unit: $('#iUnit', el).value.trim() || '개', boxQty: box || 0, lowStock: low, memo: $('#iMemo', el).value.trim(), photo });
    save('items', rec);
    toast(it ? `‘${name}’ 정보를 저장했어요` : `‘${name}’ 품목을 등록했어요`);
    render();
  } });
  openModal({ title: it ? '품목 수정' : '품목 등록', body, actions, onMount: ({ el }) => {
    const paint = () => { $('#phPrev', el).innerHTML = avatar({ name: $('#iName', el).value || '?', photo }); $('#phDel', el).hidden = !photo; };
    paint();
    $('#iName', el).addEventListener('input', () => { $('#eName', el).textContent = ''; if (!photo) paint(); });
    const sync = () => { $('#newCatBox', el).hidden = $('#iCat', el).value !== '__new'; }; sync();
    $('#iCat', el).addEventListener('change', sync);
    $('#phFile', el).addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      try { photo = await compressImage(f); paint(); toast('사진을 넣었어요. 저장하면 모든 화면에 반영돼요.'); } catch (err) { toast(err.message, { error: true }); }
      e.target.value = '';
    });
    $('#phDel', el).addEventListener('click', () => { photo = null; paint(); });
  } });
}

function renderGroupTab(box) {
  const groups = [...DB.groups.values()].filter(g => g.shop === S.shop).sort(byOrder);
  box.innerHTML = `<section class="card"><h2>조사 묶음이란?</h2><p class="small muted" style="margin:0">이름이 비슷하거나 함께 세면 편한 품목을 묶어요 (예: 유리병 소/중/대). 재고 세기 화면은 묶음 단위로 접고 펼쳐요.
      묶음에 넣지 않은 품목은 카테고리별로 자동으로 묶여요.</p>
      <div class="add-row" style="margin-top:12px"><label class="fld"><span>새 묶음 이름</span><input class="inp" id="newGrp" placeholder="예: 유리병 소/중/대" autocomplete="off"></label><button class="btn primary" data-act="add-group">묶음 만들기</button></div></section>
    <section class="card"><h2>${SHOPS[S.shop].name} 조사 묶음 <small class="muted">(끌어서 순서 변경)</small></h2>
    ${groups.length ? `<ul class="list" id="grpList">${groups.map(g => { const its = g.itemIds.map(id => DB.items.get(id)).filter(i => i && !i.archived); return `<li class="li" data-id="${g.id}">${dragBtn(g.name)}
      <div class="grow"><b>${esc(g.name)}</b><small>${its.length ? its.map(i => esc(i.name)).join(', ') : '아직 품목이 없어요'}</small></div>
      <button class="icon-btn" data-act="edit-group" data-id="${g.id}">품목 고르기</button><button class="icon-btn" data-act="rename-group" data-id="${g.id}">이름</button><button class="icon-btn danger" data-act="del-group" data-id="${g.id}">삭제</button></li>`; }).join('')}</ul>`
    : `<div class="empty"><strong>아직 묶음이 없어요</strong><p>지금은 카테고리가 기본 묶음으로 쓰이고 있어요.</p><button class="btn" data-act="focus-new-group">첫 묶음 만들기</button></div>`}</section>`;
  const l = $('#grpList', box); if (l) enableDragSort(l, ids => reorder('groups', ids));
  $('#newGrp', box).addEventListener('keydown', e => { if (e.key === 'Enter') addGroup(); });
}
function addGroup() {
  const n = $('#newGrp').value.trim(); if (!n) { toast('묶음 이름을 넣어 주세요.', { error: true }); $('#newGrp').focus(); return; }
  const max = Math.max(-1, ...[...DB.groups.values()].map(g => g.order ?? 0));
  const g = { id: uid(), shop: S.shop, name: n, order: max + 1, itemIds: [], createdAt: Date.now() };
  save('groups', g); toast(`‘${n}’ 묶음을 만들었어요. 이제 품목을 골라 넣으세요.`); render(); editGroup(g.id);
}
function editGroup(id) {
  const g = DB.groups.get(id);
  const items = itemsFor(S.shop);
  const owner = new Map(); [...DB.groups.values()].filter(x => x.shop === S.shop && x.id !== id).forEach(x => x.itemIds.forEach(i => owner.set(i, x.name)));
  let sel = g.itemIds.filter(i => items.some(x => x.id === i));
  let q = '';
  openModal({ title: `‘${g.name}’ 묶음 품목`, wide: true,
    body: `<div class="fld-label" style="margin-bottom:6px">묶음에 든 품목 (끌어서 순서 변경)</div><ul class="list check-list" id="gSel" style="margin-bottom:14px"></ul>
      <div class="fld-label" style="margin-bottom:6px">품목 넣기 · 빼기 (체크)</div>
      <div class="search" style="margin-bottom:8px">${svg('search')}<input class="inp" id="gQ" placeholder="품목 검색 (초성 가능)" aria-label="품목 검색" autocomplete="off"></div>
      <div class="check-list" id="gAll"></div>`,
    actions: [{ label: '취소' }, { label: '묶음 저장', cls: 'primary', onClick: () => {
      const recs = [];
      // 다른 묶음에서 빼기 (한 품목은 한 묶음에만)
      [...DB.groups.values()].filter(x => x.shop === S.shop && x.id !== id).forEach(x => { const before = x.itemIds.length; x.itemIds = x.itemIds.filter(i => !sel.includes(i)); if (x.itemIds.length !== before) recs.push(x); });
      g.itemIds = sel; recs.push(g); saveMany('groups', recs); toast(`‘${g.name}’ 묶음을 저장했어요 (${sel.length}개)`); render();
    } }],
    onMount: ({ el }) => {
      const paint = () => {
        $('#gSel', el).innerHTML = sel.length ? sel.map(i => { const it = DB.items.get(i); return `<li class="li" data-id="${i}">${dragBtn(it.name)}${avatar(it, 'sm')}<div class="grow"><b>${esc(it.name)}</b></div><button type="button" class="icon-btn danger" data-rm="${i}">빼기</button></li>`; }).join('')
          : '<li class="li muted small" style="justify-content:center">아래에서 품목을 체크해 넣으세요</li>';
        $('#gAll', el).innerHTML = items.filter(i => matchQ(i.name, q)).map(i => `<label>${'<input type="checkbox" data-ck="' + i.id + '" ' + (sel.includes(i.id) ? 'checked' : '') + '>'}${avatar(i, 'sm')}<span style="flex:1"><b>${esc(i.name)}</b>${commonBadge(i)}<br><small>${esc(catOf(i)?.name || '')}${owner.has(i.id) ? ` · 지금 ‘${esc(owner.get(i.id))}’ 묶음 (넣으면 이리로 옮겨짐)` : ''}</small></span></label>`).join('') || '<div class="empty small">맞는 품목이 없어요</div>';
      };
      paint();
      enableDragSort($('#gSel', el), ids => { sel = ids; });
      $('#gSel', el).addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { sel = sel.filter(x => x !== b.dataset.rm); paint(); } });
      $('#gAll', el).addEventListener('change', e => { const c = e.target.closest('[data-ck]'); if (!c) return; sel = c.checked ? [...sel, c.dataset.ck] : sel.filter(x => x !== c.dataset.ck); paint(); });
      $('#gQ', el).addEventListener('input', e => { q = e.target.value; paint(); });
    } });
}
