// 다른 기기 기록 합치기 규칙 테스트 — node tests/merge.test.js
'use strict';
const assert = require('assert');
const { computeMerge, recTs } = require('../js/merge.js');

const STORES = ['meta', 'categories', 'items', 'groups', 'movements', 'monthData', 'months', 'checkpoints', 'tombstones'];
const toMaps = o => Object.fromEntries(STORES.map(s => [s, new Map((o[s] || []).map(r => [r.id, r]))]));
const cases = [];
const t = (name, fn) => cases.push([name, fn]);

t('이 기기에 없는 기록은 들어온다', () => {
  const p = computeMerge(toMaps({}), { movements: [{ id: 'm1', qty: 5, createdAt: 10 }] }, STORES);
  assert.deepStrictEqual(p.puts.movements.map(r => r.id), ['m1']);
  assert.strictEqual(p.stats.movements.add, 1);
});
t('같은 기록이 다르면 더 나중에 고친 쪽이 남는다', () => {
  const local = toMaps({ items: [{ id: 'i1', name: '볼펜', updatedAt: 100 }] });
  const p = computeMerge(local, { items: [{ id: 'i1', name: '볼펜(파랑)', updatedAt: 200 }] }, STORES);
  assert.strictEqual(p.puts.items[0].name, '볼펜(파랑)');
  const p2 = computeMerge(local, { items: [{ id: 'i1', name: '옛 이름', updatedAt: 50 }] }, STORES);
  assert.strictEqual(p2.puts.items.length, 0); assert.strictEqual(p2.stats.items.keep, 1);
});
t('완전히 같은 기록은 아무것도 하지 않는다 (칸 순서 달라도)', () => {
  const local = toMaps({ items: [{ id: 'i1', name: 'a', unit: '개', updatedAt: 1 }] });
  const p = computeMerge(local, { items: [{ unit: '개', updatedAt: 1, name: 'a', id: 'i1' }] }, STORES);
  assert.strictEqual(p.puts.items.length + p.stats.items.keep, 0);
});
t('다른 기기에서 지운 기록은 여기서도 지워진다', () => {
  const local = toMaps({ movements: [{ id: 'm1', createdAt: 10 }] });
  const p = computeMerge(local, { movements: [], tombstones: [{ id: 'movements|m1', store: 'movements', recId: 'm1', at: 20 }] }, STORES);
  assert.deepStrictEqual(p.removes.movements, ['m1']); assert.strictEqual(p.tombs.length, 1);
});
t('지운 뒤에 이 기기에서 다시 고친 기록은 지우지 않는다', () => {
  const local = toMaps({ movements: [{ id: 'm1', updatedAt: 30 }] });
  const p = computeMerge(local, { tombstones: [{ id: 'movements|m1', store: 'movements', recId: 'm1', at: 20 }] }, STORES);
  assert.deepStrictEqual(p.removes.movements, []);
});
t('이 기기에서 지운 기록은 옛 백업에서 다시 살아나지 않는다', () => {
  const local = toMaps({ tombstones: [{ id: 'items|i9', store: 'items', recId: 'i9', at: 50 }] });
  const p = computeMerge(local, { items: [{ id: 'i9', name: '없앤 품목', createdAt: 10 }] }, STORES);
  assert.strictEqual(p.puts.items.length, 0);
});
t('meta(이 기기 설정)는 합치지 않는다', () => {
  const p = computeMerge(toMaps({}), { meta: [{ id: 'lastShop', value: 'exp' }] }, STORES);
  assert.strictEqual(p.puts.meta, undefined);
});
t('옛 버전 기록(updatedAt 없음)은 다른 시각으로 비교한다', () => {
  assert.strictEqual(recTs({ countedAt: 7, createdAt: 3 }), 7);
  assert.strictEqual(recTs({ updatedAt: 9, countedAt: 99 }), 9);
});

let pass = 0;
for (const [name, fn] of cases) { try { fn(); pass++; console.log('✅ ' + name); } catch (e) { console.log('❌ ' + name + '\n   ' + e.message); } }
console.log(`합치기 테스트: ${pass}/${cases.length} 통과`);
process.exit(pass === cases.length ? 0 : 1);
