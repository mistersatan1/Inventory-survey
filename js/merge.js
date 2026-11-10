'use strict';
/* 여러 기기 같이 쓰기 (서버 없이): 다른 기기의 백업 파일을 이 기기에 "합친다".
 * - 덮어쓰기(백업 불러오기)와 달리 이 기기의 기록을 지우지 않는다.
 * - 같은 기록이 양쪽에 있으면 더 나중에 고친 쪽을 남긴다 (updatedAt, 없으면 기록 안의 다른 시각).
 * - 지운 기록은 '지움 표시(tombstones)'로 전해져서, 다른 기기에서 다시 살아나지 않는다.
 * - meta(마지막 백업 시각 등 이 기기 설정)는 합치지 않는다. */

const MERGE_SKIP = new Set(['meta', 'tombstones']);
const MERGE_LABEL = { categories: '카테고리', items: '품목', groups: '조사 묶음', movements: '반출입', monthData: '센 수·월 기록', months: '마감 정보', checkpoints: '남긴 기록' };

/** 기록이 마지막으로 바뀐 시각 (옛 버전 기록은 updatedAt이 없어 다른 시각으로 대신) */
function recTs(r) {
  if (!r) return 0;
  if (r.updatedAt) return r.updatedAt;
  return Math.max(0, ...['countedAt', 'confirmedAt', 'unconfirmedAt', 'archivedAt', 'savedAt', 'createdAt'].map(k => Number(r[k]) || 0));
}
/** 순서와 상관없이 같은 내용인지 비교 */
function sameRec(a, b) {
  const st = v => v && typeof v === 'object' ? (Array.isArray(v) ? '[' + v.map(st).join(',') + ']' : '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + st(v[k])).join(',') + '}') : JSON.stringify(v);
  return st(a) === st(b);
}

/**
 * 합칠 계획을 세운다 (저장하지 않음). 순수 함수라 node 테스트가 가능하다.
 * @param local    { store: Map(id → 기록) }  이 기기
 * @param incoming { store: [기록, …] }        다른 기기 백업 파일의 stores
 * @returns { puts: {store: [기록]}, removes: {store: [id]}, tombs: [지움 표시], stats: {store: {add, update, remove, keep}} }
 */
function computeMerge(local, incoming, stores) {
  const puts = {}, removes = {}, stats = {};
  const locTomb = local.tombstones || new Map();
  const incTomb = new Map((incoming.tombstones || []).map(t => [t.id, t]));
  const tombs = [];
  for (const s of stores) {
    if (MERGE_SKIP.has(s)) continue;
    const lm = local[s] || new Map(); const st = stats[s] = { add: 0, update: 0, remove: 0, keep: 0 };
    puts[s] = []; removes[s] = [];
    for (const rec of incoming[s] || []) {
      if (!rec || rec.id == null) continue;
      const lt = locTomb.get(s + '|' + rec.id);
      if (lt && lt.at >= recTs(rec)) { st.keep++; continue; }          // 이 기기에서 그 뒤에 지움
      const loc = lm.get(rec.id);
      if (!loc) { puts[s].push(rec); st.add++; }
      else if (sameRec(loc, rec)) { /* 같음 */ }
      else if (recTs(rec) > recTs(loc)) { puts[s].push(rec); st.update++; }
      else st.keep++;                                                      // 이 기기 것이 더 최신
    }
    for (const t of incTomb.values()) {
      if (t.store !== s) continue;
      const loc = lm.get(t.recId);
      if (loc && recTs(loc) <= t.at) { removes[s].push(t.recId); st.remove++; }
    }
  }
  for (const t of incTomb.values()) {
    const lt = locTomb.get(t.id);
    if (!lt || lt.at < t.at) tombs.push(t);
  }
  return { puts, removes, tombs, stats };
}

async function applyMerge(plan) {
  for (const [s, recs] of Object.entries(plan.puts)) if (recs.length) await storage.putMany(s, recs);
  for (const [s, ids] of Object.entries(plan.removes)) for (const id of ids) await storage.remove(s, id);
  if (plan.tombs.length) await storage.putMany('tombstones', plan.tombs);
  await loadAll();
}

async function openMerge(file) {
  let data;
  try { data = JSON.parse(await file.text()); if (data.app !== 'inventory-survey' || !data.stores) throw new Error(); }
  catch { toast('이 앱의 백업 파일이 아니에요. 파일을 다시 확인해 주세요.', { error: true }); return; }
  const plan = computeMerge(DB, data.stores, storage.STORES);
  const rows = Object.entries(plan.stats).filter(([, v]) => v.add + v.update + v.remove + v.keep);
  const total = rows.reduce((n, [, v]) => n + v.add + v.update + v.remove, 0);
  const body = `<p style="margin-top:0"><b>${esc(file.name)}</b><br><span class="small muted">백업한 때 ${esc((data.exportedAt || '').replace('T', ' ').slice(0, 16))}</span></p>
    ${total ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>종류</th><th class="n">새로 들어옴</th><th class="n">더 최신으로 바뀜</th><th class="n">지워짐</th><th class="n">이 기기 것 유지</th></tr></thead><tbody>
      ${rows.map(([s, v]) => `<tr><td>${MERGE_LABEL[s] || s}</td><td class="n">${v.add || '–'}</td><td class="n">${v.update || '–'}</td><td class="n">${v.remove || '–'}</td><td class="n">${v.keep || '–'}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="small muted" style="margin:10px 0 0">같은 기록이 두 기기에 다르게 있으면 <b>더 나중에 고친 쪽</b>을 남겨요. 이 기기에만 있는 기록은 그대로예요.</p>`
    : '<div class="banner info" style="margin:0"><span class="b-ico">✓</span><div><b>새로 합칠 것이 없어요.</b>이 기기에 이미 같은 내용이 다 들어 있어요.</div></div>'}`;
  const ok = await openModal({ title: '다른 기기 기록 합치기', wide: true, body,
    actions: total ? [{ label: '취소', value: false }, { label: `${total}건 합치기`, value: true, cls: 'primary' }] : [{ label: '닫기', value: false, cls: 'primary' }] });
  if (!ok) return;
  try { await applyMerge(plan); toast(`${total}건을 합쳤어요. 이제 이 기기에서 다시 백업해 다른 기기에도 합쳐 주세요.`); render(); }
  catch (e) { toast('합치지 못했어요: ' + e.message, { error: true }); }
}

/** 백업 파일을 휴대폰 공유(카톡 등)로 바로 보내기. 안 되면 내려받기 */
async function shareBackup() {
  const data = await storage.exportAll();
  const name = `재고백업_${todayStr()}.json`;
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const file = typeof File === 'function' ? new File([blob], name, { type: 'application/json' }) : null;
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: '재고 백업' }); await meta.set('lastBackupAt', Date.now()); toast('백업 파일을 보냈어요.'); render(); }
    catch (e) { /* 공유 창을 닫음 */ }
    return;
  }
  download(blob, name); await meta.set('lastBackupAt', Date.now());
  toast('이 기기에서는 바로 보내기가 안 돼서 파일로 저장했어요. 메신저에 첨부해 보내 주세요.'); render();
}

if (typeof module !== 'undefined') module.exports = { computeMerge, recTs, sameRec };
