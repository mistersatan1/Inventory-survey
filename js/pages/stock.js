'use strict';
/* 화면: 전체 재고 */

/* =====================================================================
 * 9. 전체 재고
 * ===================================================================== */
function renderInv(main) {
  const cats = catsFor(S.shop);
  const items = itemsFor(S.shop);
  if (S.invCat !== 'all' && !cats.some(c => c.id === S.invCat)) S.invCat = 'all';
  const all = items.map(i => { const v = currentStock(i); return { i, v, st: stockStatus(i, v) }; });
  const cnt = k => all.filter(r => r.st.key === k).length;
  const rows = all.filter(r => (S.invCat === 'all' || r.i.categoryId === S.invCat) && matchQ(r.i.name, S.invQ) && (!S.invSt || r.st.key === S.invSt));
  const stat = (k, label) => `<button class="stat ${k}" data-act="inv-st" data-k="${k}" aria-pressed="${S.invSt === k}"><span class="k"><span class="dot"></span>${label}</span><span class="v">${cnt(k)}</span></button>`;
  main.innerHTML = `
    <div class="page-head"><div><h1 class="page-h">${SHOPS[S.shop].name} 전체 재고</h1><p class="page-sub">지금 창고에 있는 수예요. 마지막으로 센 수에 그 뒤 반입·반출을 더하고 빼서 계산해요.</p></div>
      <div class="btn-row"><button class="btn sm" data-act="new-cat">카테고리 추가</button><button class="btn sm primary" data-act="new-item">${svg('plus')}품목 추가</button></div></div>
    <div class="stats" role="group" aria-label="상태별로 보기">${stat('ok', '넉넉')}${stat('low', '부족')}${stat('none', '없음')}</div>
    <div class="search" style="margin-bottom:var(--s-3)">${svg('search')}<input class="inp" id="invQ" type="search" value="${esc(S.invQ)}" placeholder="품목 찾기 (초성도 돼요)" aria-label="품목 찾기" autocomplete="off"></div>
    <div class="chips" style="margin-bottom:var(--s-4)" role="group" aria-label="카테고리">
      <button class="chip ${S.invCat === 'all' ? 'on' : ''}" data-act="inv-cat" data-id="all" aria-pressed="${S.invCat === 'all'}">전체 ${items.length}</button>
      ${cats.map(c => `<button class="chip ${S.invCat === c.id ? 'on' : ''}" data-act="inv-cat" data-id="${c.id}" aria-pressed="${S.invCat === c.id}">${esc(c.name)}${c.shop === 'common' ? ' · 공용' : ''}</button>`).join('')}
    </div>
    ${S.invSt ? `<div class="banner info"><span class="b-ico">🔎</span><div><b>‘${{ ok: '넉넉', low: '부족', none: '없음' }[S.invSt]}’ 품목만 보고 있어요</b><button class="btn sm" data-act="inv-st" data-k="${S.invSt}">모두 보기</button></div></div>` : ''}
    <div id="invTable"></div>`;
  const tbl = $('#invTable');
  tbl.innerHTML = !items.length ? `<div class="empty card"><span class="e-ico">🌱</span><strong>아직 품목이 없어요</strong><p>품목을 등록하면 재고가 여기에 모여요.</p><button class="btn primary" data-act="new-item">첫 품목 등록하기</button></div>`
    : !rows.length ? `<div class="empty card"><span class="e-ico">${S.invSt && S.invSt !== 'ok' ? '👍' : '🔍'}</span><strong>${S.invSt && S.invSt !== 'ok' ? '여기에 해당하는 품목이 없어요' : '조건에 맞는 품목이 없어요'}</strong><p>검색어나 카테고리를 바꿔 보세요.</p></div>`
    : `<div class="tbl-wrap"><table class="tbl cards"><thead><tr><th>품목</th><th>카테고리</th><th class="n">지금 재고</th><th>상태</th><th><span class="sr">수정</span></th></tr></thead><tbody>
      ${rows.map(({ i, v, st }) => `<tr>
        <td class="first"><div class="name-cell">${avatar(i, 'sm', true)}<div><b>${esc(i.name)}</b>${commonBadge(i)}<small>${boxInfo(i)}</small></div></div></td>
        <td class="hide-m">${esc(catOf(i)?.name || '')}</td>
        <td class="n" data-label="지금 재고"><span class="stock-v num">${fmt(v)}</span> <small class="muted">${esc(i.unit || 'ea')}</small></td>
        <td data-label="상태"><span class="badge ${st.key}"><span class="ic" aria-hidden="true">${st.ic}</span>${st.label}</span>${i.lowStock != null && i.lowStock !== '' ? ` <small class="muted">기준 ${fmt(i.lowStock)}</small>` : ''}</td>
        <td data-label="" class="n"><button class="icon-btn" data-act="edit-item" data-id="${i.id}" aria-label="${esc(i.name)} 수정">${svg('edit')}수정</button></td></tr>`).join('')}
    </tbody></table></div>`;
  $('#invQ').addEventListener('input', e => { S.invQ = e.target.value; const pos = e.target.selectionStart; renderInv(main); const n = $('#invQ'); n.focus(); n.setSelectionRange(pos, pos); });
}
