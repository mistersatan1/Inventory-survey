// 숫자 입력 읽기 테스트 — node tests/number.test.js
// 소수점(0.7), 일부 휴대폰 키보드의 쉼표 소수점(0,7), 천 단위 쉼표(1,200)를 구분하는지 확인
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'utils.js'), 'utf8');
const start = src.indexOf('/** 숫자 글자 정리');
const end = src.indexOf('function daysAgo');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src.slice(start, end) + '\nthis.parseNum = parseNum;', ctx);
const cases = [['0.7', 0.7], ['0,7', 0.7], ['1,25', 1.25], ['1,200', 1200], ['12,345,678', 12345678], ['0.3', 0.3], ['', null], ['abc', undefined], ['1.2.3', undefined]];
let pass = 0;
for (const [input, want] of cases) {
  const got = ctx.parseNum(input, true);
  const ok = got === want;
  if (ok) pass++;
  console.log(`${ok ? '✅' : '❌'} "${input}" → ${got}${ok ? '' : ` (기대 ${want})`}`);
}
console.log(`숫자 읽기 테스트: ${pass}/${cases.length} 통과`);
process.exit(pass === cases.length ? 0 : 1);
