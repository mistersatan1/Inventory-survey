// 재고 계산 규칙 테스트 — 브라우저 없이 실행: node tests/calc.test.js
// js/inventory.js 의 Calc 부분만 읽어 엑셀 예시값과 비교한다.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'inventory.js'), 'utf8');
const start = src.indexOf('const Calc = {');
const end = src.indexOf('if (typeof window');
if (start < 0 || end < 0) { console.error('js/inventory.js 에서 Calc를 찾지 못했어요.'); process.exit(1); }

const ctx = { console: { log() {} } };
vm.createContext(ctx);
vm.runInContext(src.slice(start, end) + '\nthis.Calc = Calc;', ctx);

const r = ctx.Calc.selfTest();
r.lines.forEach(l => console.log(l));
console.log(r.summary);
process.exit(r.ok ? 0 : 1);
