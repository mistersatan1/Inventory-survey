'use strict';
/* 재고 계산 규칙(Calc)과 데이터 캐시·도메인 헬퍼 */

/* =====================================================================
 * 2. 계산 규칙 (순수 함수) — 콘솔에서 Calc.selfTest() 로 확인
 * ===================================================================== */
const Calc = {
  round(n) { return Math.round((Number(n) || 0) * 1000) / 1000; },
  /** 실사 합계 = 박스 수량 × 1박스 기준 + 낱개 수량 */
  countTotal(box, boxQty, ea) { return Calc.round((Number(box) || 0) * (Number(boxQty) || 0) + (Number(ea) || 0)); },
  /** 예상 재고 = 전월 재고 + 반입 − 반출 − 판매(사용) */
  expected(prev, inQ, outQ, sales) { return Calc.round((Number(prev) || 0) + (Number(inQ) || 0) - (Number(outQ) || 0) - (Number(sales) || 0)); },
  /** 오차 = 실사 재고 − 예상 재고 */
  diff(actual, expected) { return Calc.round((Number(actual) || 0) - (Number(expected) || 0)); },
  /** 해당 월 1일 ~ upto(YYYY-MM-DD) 까지 반입·반출 누적 */
  sumMovements(movs, ym, upto) {
    let inQ = 0, outQ = 0;
    for (const m of movs) {
      if (m.date.slice(0, 7) !== ym) continue;
      if (upto && m.date > upto) continue;
      if (m.type === 'in') inQ += m.qty; else outQ += m.qty;
    }
    return { inQ: Calc.round(inQ), outQ: Calc.round(outQ) };
  },
  /** 현재 재고 = 가장 최근 실사 값 + 그 이후 반입 − 반출. 실사가 없으면 fallback(예상 재고) */
  currentStock(latest, movs, fallback) {
    if (!latest) return Calc.round(fallback);
    let v = latest.value;
    for (const m of movs) {
      const after = m.date > latest.date || (m.date === latest.date && (m.createdAt || 0) > latest.ts);
      if (after) v += m.type === 'in' ? m.qty : -m.qty;
    }
    return Calc.round(v);
  },
  /** 다음 달 전월 재고 = 이번 달 확정된 실사 재고 */
  nextPrev(confirmedActual) { return Calc.round(confirmedActual); },
  selfTest() {
    const cases = [
      ['예시 1: 전월 0, 판매 393, 반출 252 → 예상 −645', Calc.expected(0, 0, 252, 393), -645],
      ['예시 2: 실사 7857, 예상 −645 → 오차 8502', Calc.diff(7857, -645), 8502],
      ['실사 합계: 13.5박스 × 1400 + 0 = 18900', Calc.countTotal(13.5, 1400, 0), 18900],
      ['실사 합계: 1박스 × 100 + 41 = 141', Calc.countTotal(1, 100, 41), 141],
      ['상품3: 전월 0, 판매 630, 반출 288 → −918', Calc.expected(0, 0, 288, 630), -918],
      ['반입 2박스(1400ea) 반영: 0 + 2800 − 0 − 0 = 2800', Calc.expected(0, Calc.countTotal(2, 1400, 0), 0, 0), 2800],
      ['월 누적: 11월 반입 10, 반출 3 (12월분 제외)', JSON.stringify(Calc.sumMovements([
        { date: '2026-11-02', type: 'in', qty: 10 }, { date: '2026-11-05', type: 'out', qty: 3 }, { date: '2026-12-01', type: 'in', qty: 99 }], '2026-11', '2026-11-30')), JSON.stringify({ inQ: 10, outQ: 3 })],
      ['현재 재고: 실사 100 이후 반출 30 → 70', Calc.currentStock({ value: 100, date: '2026-11-05', ts: 5 },
        [{ date: '2026-11-04', type: 'in', qty: 50, createdAt: 1 }, { date: '2026-11-06', type: 'out', qty: 30, createdAt: 9 }], 0), 70],
      ['다음 달 전월 재고 = 확정 실사 7857', Calc.nextPrev(7857), 7857],
      ['소수점: 흙 1포대 반입 − 사용 0.3 → 0.7 (0.30000000000000004 같은 오차 없음)', Calc.expected(0, 1, 0, 0.3), 0.7],
      ['소수점: 센 수 0.7 − 있어야 할 수 0.7 → 차이 0', Calc.diff(Calc.countTotal(0, 0, 0.7), Calc.expected(0, 1, 0, 0.3)), 0],
    ];
    let pass = 0;
    const lines = cases.map(([name, got, want]) => { const ok = got === want; if (ok) pass++; return `${ok ? '✅' : '❌'} ${name}  (결과: ${got})`; });
    const summary = `계산 자체 테스트: ${pass}/${cases.length} 통과`;
    console.log([summary, ...lines].join('\n'));
    return { pass, total: cases.length, ok: pass === cases.length, lines, summary };
  }
};
if (typeof window !== "undefined") window.Calc = Calc;

/* =====================================================================
 * 4. 데이터 캐시 (화면은 이 메모리 캐시를 읽고, 쓰기는 storage로 바로 저장)
 * ===================================================================== */
const DB = {};
let saveListeners = [];
const SaveState = { state: 'saved', at: null };
function setSaveState(st) { SaveState.state = st; if (st === 'saved') SaveState.at = Date.now(); saveListeners.forEach(f => f()); }
async function loadAll() { for (const s of storage.STORES) { const rows = await storage.getAll(s); DB[s] = new Map(rows.map(r => [r.id, r])); } }
/* 고친 시각(updatedAt)을 남겨 두면 다른 기기 기록과 합칠 때 더 최신 쪽을 고를 수 있다 */
function stamp(store, rec) {
  if (store === 'meta' || store === 'tombstones') return;
  rec.updatedAt = Date.now();
  const t = DB.tombstones && DB.tombstones.get(store + '|' + rec.id);
  if (t) { DB.tombstones.delete(t.id); storage.remove('tombstones', t.id).catch(() => {}); } // 되돌리기 등으로 다시 살아남
}
function save(store, rec) {
  stamp(store, rec);
  DB[store].set(rec.id, rec);
  setSaveState('saving');
  return storage.put(store, rec).then(() => setSaveState('saved')).catch(e => { setSaveState('err'); toast('저장하지 못했어요: ' + e.message, { error: true }); });
}
function saveMany(store, recs) {
  recs.forEach(r => { stamp(store, r); DB[store].set(r.id, r); });
  setSaveState('saving');
  return storage.putMany(store, recs).then(() => setSaveState('saved')).catch(e => { setSaveState('err'); toast('저장하지 못했어요: ' + e.message, { error: true }); });
}
/** 지우면서 '지움 표시'를 남긴다 — 다른 기기 기록을 합칠 때 다시 살아나지 않게 */
function del(store, id) {
  DB[store].delete(id);
  const t = { id: store + '|' + id, store, recId: id, at: Date.now() };
  if (DB.tombstones) { DB.tombstones.set(t.id, t); storage.put('tombstones', t).catch(() => {}); }
  return storage.remove(store, id).catch(e => toast('삭제하지 못했어요: ' + e.message, { error: true }));
}
const meta = { get(k, d) { const r = DB.meta.get(k); return r ? r.value : d; }, set(k, v) { return save('meta', { id: k, value: v }); } };

/* ---------- 도메인 헬퍼 ---------- */
const SHOPS = {
  gift: { name: '기념품숍', icon: '🛍', color: '#1f5a3a', sales: '판매', salesLong: '이번 달 누적 판매 수량' },
  exp: { name: '체험장', icon: '🌱', color: '#1e6b63', sales: '체험 사용', salesLong: '이번 달 누적 체험 사용 수량' },
};
const S = {
  shop: 'gift', page: 'count',
  countQ: '', onlyEmpty: false, collapsed: new Set(),
  invCat: 'all', invQ: '', invSt: '',
  countDate: todayStr(), // 재고 세기에서 '센 날짜' (종이에 적어 와서 다음 날 넣을 때 바꿈)
  monthYm: curYm(), movYm: curYm(), movFilter: { item: '', type: '', date: '' },
  mgTab: 'cat', showArchived: false,
  countDirty: false, noticeHidden: false,
};
const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.createdAt || 0) - (b.createdAt || 0);
function catOf(item) { return DB.categories.get(item.categoryId); }
function shopOf(item) { const c = catOf(item); return c ? c.shop : 'gift'; }
function isCommon(item) { return shopOf(item) === 'common'; }
function catsFor(shop) {
  const all = [...DB.categories.values()].filter(c => c.shop === shop || c.shop === 'common');
  return all.sort((a, b) => (a.shop === 'common') - (b.shop === 'common') || byOrder(a, b));
}
function itemsFor(shop, opts = {}) {
  const cats = catsFor(shop); const ci = new Map(cats.map((c, i) => [c.id, i]));
  return [...DB.items.values()]
    .filter(it => ci.has(it.categoryId) && (opts.archived ? true : !it.archived))
    .sort((a, b) => ci.get(a.categoryId) - ci.get(b.categoryId) || byOrder(a, b));
}
function movsOf(itemId) { return [...DB.movements.values()].filter(m => m.itemId === itemId); }
function mdKey(ym, itemId) { return ym + '|' + itemId; }
function md(ym, itemId) { return DB.monthData.get(mdKey(ym, itemId)) || null; }
function ensureMd(ym, itemId) {
  let m = md(ym, itemId);
  if (!m) { m = { id: mdKey(ym, itemId), ym, itemId, box: null, ea: null, sales: null, reason: '', prevManual: null }; DB.monthData.set(m.id, m); }
  return m;
}
function monthRec(shop, ym) { return DB.months.get(shop + '|' + ym) || null; }
function isConfirmed(shop, ym) { const r = monthRec(shop, ym); return !!(r && r.confirmed); }
function isLocked(item, ym) { const s = shopOf(item); return s === 'common' ? (isConfirmed('gift', ym) || isConfirmed('exp', ym)) : isConfirmed(s, ym); }
function prevStock(item, ym) {
  const pm = md(addMonth(ym, -1), item.id);
  if (pm && pm.final !== undefined && pm.final !== null) return { value: pm.final, auto: true };
  const m = md(ym, item.id);
  return { value: m && m.prevManual != null ? m.prevManual : 0, auto: false, manual: !!(m && m.prevManual != null) };
}
/** 재고 세기 화면이 보고 있는 달 = 센 날짜의 달 */
function countYm() { return S.countDate.slice(0, 7); }
/** upto: 반입·반출을 이 날짜까지 더한다 (기본: 이번 달이면 오늘, 지난달이면 말일) */
function monthCalc(item, ym, upto) {
  const m = md(ym, item.id);
  if (m && m.snap) return { ...m.snap, prevAuto: true, locked: true, reason: m.reason || '', box: m.box, ea: m.ea };
  const p = prevStock(item, ym);
  const { inQ, outQ } = Calc.sumMovements(movsOf(item.id), ym, upto || (ym === curYm() ? todayStr() : monthEnd(ym)));
  const sales = m && m.sales != null ? m.sales : 0;
  const expected = Calc.expected(p.value, inQ, outQ, sales);
  const counted = !!m && (m.box != null || m.ea != null);
  const actual = counted ? Calc.countTotal(m.box, item.boxQty, m.ea) : null;
  const diff = counted ? Calc.diff(actual, expected) : null;
  return { prev: p.value, prevAuto: p.auto, inQ, outQ, sales, salesSet: !!(m && m.sales != null), expected, actual, diff, counted,
    locked: isLocked(item, ym), box: m ? m.box : null, ea: m ? m.ea : null, reason: m ? m.reason || '' : '', countedShop: m ? m.countedShop : null };
}
function latestCount(item) {
  let best = null;
  for (const m of DB.monthData.values()) {
    if (m.itemId !== item.id) continue;
    let c = null;
    if (m.snap) c = { value: m.snap.actual, date: m.countDate && m.snap.counted ? m.countDate : monthEnd(m.ym), ts: m.snap.counted ? (m.countedAt || 0) : Infinity };
    else if (m.box != null || m.ea != null) c = { value: Calc.countTotal(m.box, item.boxQty, m.ea), date: m.countDate || monthEnd(m.ym), ts: m.countedAt || 0 };
    if (c && (!best || c.date > best.date || (c.date === best.date && c.ts > best.ts))) best = c;
  }
  return best;
}
function currentStock(item) { return Calc.currentStock(latestCount(item), movsOf(item.id), monthCalc(item, curYm()).expected); }
function stockStatus(item, v) {
  if (v <= 0) return { key: 'none', label: '없음', ic: '✕' };
  if (item.lowStock != null && item.lowStock !== '' && v <= item.lowStock) return { key: 'low', label: '부족', ic: '▲' };
  return { key: 'ok', label: '넉넉', ic: '●' };
}
/** 차이(오차)를 숫자와 뜻으로 함께 보여 준다: 3 부족 / 2 더 많음 / 딱 맞아요 */
function diffHTML(d) {
  if (d === null || d === undefined) return '<span class="muted">–</span>';
  if (d === 0) return '<span class="diff match">✓ 딱 맞아요</span>';
  return d < 0 ? `<span class="diff minus">${fmtS(d)} <small>부족</small></span>` : `<span class="diff plus">${fmtS(d)} <small>더 많음</small></span>`;
}
/** 사진이 없을 때 쓰는 글자: '유리병 소' → '유소'처럼 첫 낱말과 끝 낱말의 첫 글자 */
function initials(name) {
  const w = String(name || '?').trim().split(/\s+/).filter(Boolean);
  return w.length > 1 ? w[0].charAt(0) + w[w.length - 1].charAt(0) : (w[0] || '?').charAt(0);
}
function avatar(item, size = '', zoom = false) {
  const cls = `av ${size} ${item.photo ? '' : 'ph'}`;
  const inner = item.photo ? `<img src="${item.photo}" alt="">` : esc(initials(item.name));
  return zoom ? `<button type="button" class="${cls}" data-act="zoom" data-id="${item.id}" aria-label="${esc(item.name)} 사진 크게 보기">${inner}</button>`
    : `<span class="${cls}" aria-hidden="true">${inner}</span>`;
}
/** 낱개 칸의 이름: 단위가 개·ea면 '낱개', 포대·g 같은 단위면 그 단위 (흙 0.3포대처럼 소수점도 됨) */
function unitLabel(item) { const u = String(item?.unit || '').trim(); return !u || /^(개|ea)$/i.test(u) ? '낱개' : u; }
const commonBadge = item => isCommon(item) ? ' <span class="badge common">공용</span>' : '';
const boxInfo = item => item.boxQty ? `1박스=${fmt(item.boxQty)}${esc(item.unit || 'ea')}` : '박스 기준 없음';
const salesLabel = () => SHOPS[S.shop].sales;
