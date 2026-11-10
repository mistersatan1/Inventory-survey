'use strict';
/* 주문할 것 목록
 * - 부족·없음 품목을 모아 주문 수량을 추천한다.
 * - 추천: 부족 기준의 2배까지 채우는 수. 1박스 기준이 있으면 박스 단위로 올림.
 *   부족 기준이 없고 재고가 0 이하인 품목은 1박스(박스 기준이 없으면 빈칸).
 * - 숫자는 고칠 수 있고, 복사·공유(카톡 등)·CSV 저장이 된다. */

function orderSuggest(item, cur) {
  const low = item.lowStock != null && item.lowStock !== '' ? Number(item.lowStock) : null;
  let need = low != null && low > 0 ? low * 2 - cur : (cur <= 0 ? (item.boxQty || 0) : 0);
  if (need <= 0) return 0;
  if (item.boxQty) need = Math.ceil(need / item.boxQty) * item.boxQty;
  return Calc.round(need);
}
function orderRows() {
  return itemsFor(S.shop).map(i => { const v = currentStock(i); return { i, v, st: stockStatus(i, v) }; })
    .filter(r => r.st.key !== 'ok')
    .map(r => ({ ...r, qty: orderSuggest(r.i, r.v) }));
}
function orderQtyLabel(item, qty) {
  const u = item.unit || '개';
  if (item.boxQty && qty % item.boxQty === 0) return `${fmt(qty / item.boxQty)}박스 (${fmt(qty)}${u})`;
  return `${fmt(qty)}${u}`;
}
function orderText(list) {
  const t = todayStr();
  return [`[${SHOPS[S.shop].name}] 주문할 것 (${dKo(t)})`,
    ...list.map(r => `- ${r.i.name}: ${orderQtyLabel(r.i, r.qty)} · 지금 ${fmt(r.v)}${r.i.unit || '개'}`),
    `총 ${list.length}개 품목`].join('\n');
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) { // file:// 등 클립보드 권한이 없을 때
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    ta.remove(); return ok;
  }
}

function openOrderList() {
  const rows = orderRows();
  if (!rows.length) { toast('부족하거나 없는 품목이 없어요. 주문할 것이 없어요.'); return; }
  const canShare = !!navigator.share;
  openModal({ title: `${SHOPS[S.shop].name} 주문할 것 목록`, wide: true,
    body: `<p class="small" style="margin-top:0">부족하거나 없는 품목이에요. <b>부족 기준의 2배</b>까지 채우는 수를 추천했고, 1박스 기준이 있으면 박스로 맞췄어요. 숫자는 고칠 수 있어요.</p>
      <ul class="order-list">${rows.map((r, k) => `<li data-k="${k}">
        <label class="ol-check"><input type="checkbox" ${r.qty > 0 ? 'checked' : ''} aria-label="${esc(r.i.name)} 주문 목록에 넣기"></label>
        ${avatar(r.i, 'sm')}
        <span class="grow"><b>${esc(r.i.name)}</b> <span class="badge ${r.st.key}"><span class="ic" aria-hidden="true">${r.st.ic}</span>${r.st.label}</span>
          <small>지금 ${fmt(r.v)}${esc(r.i.unit || '개')}${r.i.lowStock != null && r.i.lowStock !== '' ? ` · 부족 기준 ${fmt(r.i.lowStock)}` : ' · 부족 기준 없음'}${r.i.boxQty ? ` · 1박스 ${fmt(r.i.boxQty)}` : ''}</small></span>
        <span class="ol-qty"><input class="inp num" inputmode="decimal" value="${r.qty || ''}" placeholder="수량" aria-label="${esc(r.i.name)} 주문 수량"><small class="ol-hint">${r.qty ? esc(orderQtyLabel(r.i, r.qty)) : ''}</small></span></li>`).join('')}</ul>`,
    actions: [{ label: 'CSV 저장', value: 'csv' }, ...(canShare ? [{ label: '공유하기', value: 'share' }] : []), { label: '복사하기', value: 'copy', cls: 'primary' }]
      .map(a => ({ ...a, onClick: ({ el }) => run(a.value, el) })),
    onMount: ({ el }) => {
      el.addEventListener('input', e => {
        const li = e.target.closest('.order-list li'); if (!li || !e.target.matches('.ol-qty input')) return;
        const r = rows[+li.dataset.k]; const v = parseNum(e.target.value);
        e.target.classList.toggle('bad', v === undefined);
        $('.ol-hint', li).textContent = v ? orderQtyLabel(r.i, v) : '';
        $('input[type=checkbox]', li).checked = !!v;
      });
    } });

  function picked(el) {
    return $$('.order-list li', el).map(li => {
      const r = rows[+li.dataset.k]; const v = parseNum($('.ol-qty input', li).value);
      return $('input[type=checkbox]', li).checked && v ? { ...r, qty: v } : null;
    }).filter(Boolean);
  }
  async function run(kind, el) {
    const list = picked(el);
    if (!list.length) { toast('주문할 품목을 하나 이상 체크하고 수량을 넣어 주세요.', { error: true }); return false; }
    if (kind === 'copy') { toast(await copyText(orderText(list)) ? `${list.length}개 품목을 복사했어요. 카톡·문자에 붙여넣으세요.` : '복사하지 못했어요. 공유하기나 CSV 저장을 써 주세요.', { error: false }); return false; }
    if (kind === 'share') { try { await navigator.share({ title: '주문할 것', text: orderText(list) }); } catch (e) { /* 사용자가 공유 창을 닫음 */ } return false; }
    const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const lines = [['품목', '카테고리', '지금 재고', '단위', '부족 기준', '1박스 기준', '주문 수량', '주문 박스']]
      .concat(list.map(r => [r.i.name, catOf(r.i)?.name || '', Calc.round(r.v), r.i.unit || '개', r.i.lowStock ?? '', r.i.boxQty || '', r.qty, r.i.boxQty ? Calc.round(r.qty / r.i.boxQty) : '']));
    download(new Blob(['﻿' + lines.map(l => l.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), `주문목록_${SHOPS[S.shop].name}_${todayStr()}.csv`);
    toast('주문 목록 CSV를 저장했어요.');
    return false;
  }
}
