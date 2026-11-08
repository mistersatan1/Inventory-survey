'use strict';
/* 데이터 저장 (IndexedDB, 안 되면 localStorage) */

/* =====================================================================
 * 1. storage 모듈
 *    - 저장/불러오기는 모두 여기서만 한다.
 *    - 나중에 Supabase 등 서버 저장소로 바꿀 때 이 객체의 메서드
 *      (init, getAll, put, putMany, remove, exportAll, importAll, clearAll)
 *      만 같은 모양으로 다시 구현하면 된다.
 *    - IndexedDB를 못 쓰는 환경(일부 브라우저의 file:// 등)에서는
 *      localStorage로 자동 대체한다.
 * ===================================================================== */
const storage = (() => {
  const DB_NAME = 'inventory-survey';
  const VERSION = 2; // 2: tombstones(지움 표시) 저장소 추가 — 기존 데이터는 그대로
  const STORES = ['meta', 'categories', 'items', 'groups', 'movements', 'monthData', 'months', 'checkpoints', 'tombstones'];
  let db = null;
  let mode = 'idb';
  const mem = {};

  const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const txDone = t => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('aborted')); });

  function loadLocal() {
    STORES.forEach(s => {
      try { mem[s] = JSON.parse(localStorage.getItem('inv:' + s) || '{}'); } catch (e) { mem[s] = {}; }
    });
  }
  function persistLocal(s) {
    try { localStorage.setItem('inv:' + s, JSON.stringify(mem[s])); }
    catch (e) { throw new Error('저장 공간이 부족해요. 사진을 줄이거나 백업 후 정리해 주세요.'); }
  }

  async function init() {
    try {
      if (!window.indexedDB) throw new Error('IndexedDB 없음');
      db = await new Promise((res, rej) => {
        const r = indexedDB.open(DB_NAME, VERSION);
        r.onupgradeneeded = () => {
          const d = r.result;
          STORES.forEach(s => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' }); });
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
        // 다른 탭이 예전 버전으로 열려 있으면 업그레이드가 막힌다 → 빈 임시 저장소로 넘어가지 말고 알린다
        r.onblocked = () => { const e = new Error('이 앱이 다른 탭이나 창에서도 열려 있어요. 다른 탭을 모두 닫고 새로고침해 주세요.'); e.blocked = true; rej(e); };
      });
      db.onversionchange = () => { db.close(); }; // 새 버전이 열리면 이 탭은 양보
      mode = 'idb';
    } catch (e) {
      if (e && e.blocked) throw e;
      console.warn('IndexedDB를 쓸 수 없어 localStorage로 저장합니다.', e);
      mode = 'local';
      loadLocal();
    }
    return mode;
  }

  async function getAll(s) {
    if (mode === 'idb') return reqP(db.transaction(s, 'readonly').objectStore(s).getAll());
    return Object.values(mem[s] || {});
  }
  async function put(s, rec) {
    if (mode === 'idb') {
      const t = db.transaction(s, 'readwrite'); t.objectStore(s).put(rec); return txDone(t);
    }
    mem[s][rec.id] = JSON.parse(JSON.stringify(rec)); persistLocal(s);
  }
  async function putMany(s, recs) {
    if (mode === 'idb') {
      const t = db.transaction(s, 'readwrite'); const os = t.objectStore(s); recs.forEach(r => os.put(r)); return txDone(t);
    }
    recs.forEach(r => { mem[s][r.id] = JSON.parse(JSON.stringify(r)); }); persistLocal(s);
  }
  async function remove(s, id) {
    if (mode === 'idb') { const t = db.transaction(s, 'readwrite'); t.objectStore(s).delete(id); return txDone(t); }
    delete mem[s][id]; persistLocal(s);
  }
  async function clearAll() {
    if (mode === 'idb') {
      const t = db.transaction(STORES, 'readwrite'); STORES.forEach(s => t.objectStore(s).clear()); return txDone(t);
    }
    STORES.forEach(s => { mem[s] = {}; persistLocal(s); });
  }
  async function exportAll() {
    const out = { app: 'inventory-survey', version: 1, exportedAt: new Date().toISOString(), stores: {} };
    for (const s of STORES) out.stores[s] = await getAll(s);
    return out;
  }
  async function importAll(data) {
    if (!data || data.app !== 'inventory-survey' || !data.stores) throw new Error('이 앱의 백업 파일이 아니에요.');
    if (mode === 'idb') {
      const t = db.transaction(STORES, 'readwrite');
      STORES.forEach(s => { const os = t.objectStore(s); os.clear(); (data.stores[s] || []).forEach(r => os.put(r)); });
      return txDone(t);
    }
    STORES.forEach(s => { mem[s] = {}; (data.stores[s] || []).forEach(r => { mem[s][r.id] = r; }); persistLocal(s); });
  }
  return { STORES, init, getAll, put, putMany, remove, clearAll, exportAll, importAll, get mode() { return mode; } };
})();
