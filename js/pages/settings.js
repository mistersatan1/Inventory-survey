'use strict';
/* 화면: 설정·백업 */

/* =====================================================================
 * 12. 설정·백업
 * ===================================================================== */
function renderSettings(main) {
  const last = meta.get('lastBackupAt', null);
  const n = s => DB[s].size;
  main.innerHTML = `
    <section class="card"><h2><span class="h2-ico">${svg('settings')}</span>백업</h2>
      <dl class="kv"><dt>마지막 백업</dt><dd class="num">${last ? `${fmtDateTime(last)} (${daysAgo(last) === 0 ? '오늘' : daysAgo(last) + '일 전'})` : '<span class="minus">아직 없음</span>'}</dd>
        <dt>저장된 데이터</dt><dd class="num">품목 ${n('items')}개 · 카테고리 ${n('categories')}개 · 반출입 ${n('movements')}건 · 남긴 기록 ${n('checkpoints')}건</dd>
        <dt>저장 위치</dt><dd>이 기기의 브라우저 (${storage.mode === 'idb' ? 'IndexedDB' : 'localStorage'}) · 인터넷 없이도 저장돼요</dd></dl>
      <div class="btn-row" style="margin-top:14px"><button class="btn primary" data-act="backup">전체 데이터 백업(JSON) 다운로드</button>
        <label class="btn" style="position:relative">백업 불러오기<input type="file" accept="application/json,.json" id="restoreFile" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%" aria-label="백업 파일 고르기"></label></div>
      <p class="small" style="margin:12px 0 0">📱 기기를 바꿀 때: 새 기기에서 <b>[백업 불러오기]</b>를 하면 그 기기 내용이 백업 파일로 <b>바뀌어요(덮어쓰기)</b>. 여러 기기를 같이 쓰려면 아래 [다른 기기 기록 합치기]를 쓰세요.</p>
      <p class="small muted" style="margin:4px 0 0">백업 파일에는 사진까지 모두 들어 있어요. 공개 저장소(GitHub 등)에 올리지 마세요.</p></section>
    <section class="card"><h2><span class="h2-ico">${svg('mov')}</span>여러 기기 같이 쓰기</h2>
      <p class="small" style="margin:0 0 10px">인터넷 서버 없이, 기기끼리 백업 파일을 주고받아 기록을 <b>합쳐요</b>. 이 기기의 기록은 지워지지 않아요.</p>
      <ol class="howto small"><li>각 기기에서 <b>[백업 파일 보내기]</b>로 파일을 한 기기(예: 사무실 휴대폰)에 보내요. 카톡 ‘나에게 보내기’도 돼요.</li>
        <li>받은 기기에서 <b>[다른 기기 기록 합치기]</b>로 파일을 골라요. 같은 기록은 더 나중에 고친 쪽이 남아요.</li>
        <li>다 합친 기기에서 다시 백업 파일을 보내서, 다른 기기도 합치면 모두 똑같아져요.</li></ol>
      <div class="btn-row"><button class="btn primary" data-act="share-backup">백업 파일 보내기</button>
        <label class="btn" style="position:relative">다른 기기 기록 합치기<input type="file" accept="application/json,.json" id="mergeFile" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%" aria-label="합칠 백업 파일 고르기"></label></div>
      <p class="small muted" style="margin:8px 0 0">두 사람이 같은 품목을 같은 날 따로 세면 나중에 넣은 숫자만 남아요. 품목을 나눠서 세는 게 좋아요.</p></section>
    <section class="card"><h2>계산 자체 테스트</h2><p class="small muted" style="margin:0 0 10px">계산 규칙이 엑셀 예시와 같은 결과를 내는지 확인해요. (콘솔에서 <code>Calc.selfTest()</code>로도 실행 가능)</p>
      <button class="btn" data-act="selftest">계산 테스트 실행</button><div id="testOut"></div></section>
    <section class="card danger-zone"><h2>처음부터 다시</h2><p class="small muted" style="margin:0 0 10px">모든 품목·기록·사진을 이 기기에서 지워요. 먼저 백업을 받아 두세요.</p>
      <button class="btn danger" data-act="wipe">모든 데이터 지우기</button></section>`;
  $('#mergeFile').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (f) openMerge(f); });
  $('#restoreFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    let data; try { data = JSON.parse(await f.text()); if (data.app !== 'inventory-survey') throw new Error(); } catch { toast('이 앱의 백업 파일이 아니에요. 파일을 다시 확인해 주세요.', { error: true }); return; }
    const c = (data.stores.items || []).length;
    const ok = await confirmDialog({ title: '백업 불러오기 (덮어쓰기)', danger: true, ok: '덮어쓰고 불러오기',
      message: `<p style="margin-top:0"><b>${esc(f.name)}</b><br><span class="small muted">백업 시각 ${esc((data.exportedAt || '').replace('T', ' ').slice(0, 16))} · 품목 ${c}개</span></p>
        <div class="banner warn" style="margin:0"><div><b>지금 이 기기의 데이터는 모두 지워지고</b> 백업 파일 내용으로 바뀌어요. 필요하면 먼저 현재 데이터를 백업하세요.</div></div>` });
    if (!ok) return;
    try { await storage.importAll(data); await loadAll(); S.shop = meta.get('lastShop', 'gift'); S.countDirty = false; toast('백업을 불러왔어요'); render(); }
    catch (err) { toast('불러오지 못했어요: ' + err.message, { error: true }); }
  });
}
async function doBackup() {
  const data = await storage.exportAll();
  download(new Blob([JSON.stringify(data)], { type: 'application/json' }), `재고백업_${todayStr()}.json`);
  await meta.set('lastBackupAt', Date.now());
  S.noticeHidden = false;
  toast('백업 파일을 저장했어요. 안전한 곳에 보관하세요.');
  render();
}
async function wipeAll() {
  const a = await confirmDialog({ title: '모든 데이터 지우기', message: '품목, 사진, 반출입, 점검·정산 기록이 <b>모두</b> 지워져요. 계속할까요?', ok: '다음 단계', danger: true });
  if (!a) return;
  const b = await confirmDialog({ title: '정말 지울까요?', message: '되돌릴 수 없어요. 백업 파일이 없으면 복구할 수 없어요.', ok: '모든 데이터 지우기', danger: true });
  if (!b) return;
  await storage.clearAll(); await loadAll(); S.countDirty = false; await firstRun();
}
