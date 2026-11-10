'use strict';
/* 모달 · 토스트 · 확인 창 */

/* =====================================================================
 * 5. 모달 · 토스트 · 확인 창
 * ===================================================================== */
function openModal({ title, body, actions = [], wide = false, onMount, dismissable = true }) {
  return new Promise(resolve => {
    const prevFocus = document.activeElement;
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-h"><h3>${esc(title)}</h3>${dismissable ? `<button class="icon-btn" data-close aria-label="닫기">${svg('x')}</button>` : ''}</div>
      <div class="modal-b">${body}</div>
      ${actions.length ? `<div class="modal-f">${actions.map((a, i) => `<button type="button" class="btn ${a.cls || ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div>` : ''}
    </div>`;
    $('#modalRoot').appendChild(back);
    const el = $('.modal', back);
    let done = false;
    const close = v => { if (done) return; done = true; back.remove(); document.removeEventListener('keydown', onKey, true); if (prevFocus && prevFocus.focus) prevFocus.focus(); resolve(v); };
    const onKey = e => {
      if (e.key === 'Escape' && dismissable) { e.preventDefault(); close(null); }
      if (e.key === 'Tab') {
        const f = $$('button,input,select,textarea,[tabindex]:not([tabindex="-1"])', el).filter(x => !x.disabled && x.offsetParent !== null);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    back.addEventListener('click', e => { if (e.target === back && dismissable) close(null); });
    $$('[data-close]', el).forEach(b => b.addEventListener('click', () => close(null)));
    const ctx = { el, close };
    $$('.modal-f [data-i]', el).forEach(b => b.addEventListener('click', async () => {
      const a = actions[+b.dataset.i];
      if (a.onClick) { const r = await a.onClick(ctx); if (r === false) return; close(r === undefined ? a.value : r); }
      else close(a.value);
    }));
    if (onMount) onMount(ctx);
    const first = $('input:not([type=hidden]):not([disabled]),select,textarea', $('.modal-b', el)) || $('.modal-f .btn.primary,.modal-f .btn.danger', el) || el;
    setTimeout(() => first.focus && first.focus(), 30);
  });
}
function confirmDialog({ title, message, ok, danger = false, cancel = '취소' }) {
  return openModal({ title, body: `<div style="font-size:15px">${message}</div>`,
    actions: [{ label: cancel, value: false }, { label: ok, value: true, cls: danger ? 'danger solid' : 'primary' }] }).then(v => !!v);
}
function toast(msg, opts = {}) {
  const t = document.createElement('div');
  t.className = 'toast' + (opts.error ? ' err' : '');
  t.innerHTML = `<span>${esc(msg)}</span>${opts.undo ? '<button type="button">되돌리기</button>' : ''}`;
  const root = $('#toastRoot'); while (root.children.length >= 2) root.firstElementChild.remove();
  root.appendChild(t);
  const timer = setTimeout(() => t.remove(), opts.undo ? 5000 : 2800);
  if (opts.undo) $('button', t).addEventListener('click', () => { clearTimeout(timer); t.remove(); opts.undo(); });
}
function zoomItem(item) {
  openModal({ title: item.name, body: item.photo ? `<img class="zoom-img" src="${item.photo}" alt="${esc(item.name)}">`
    : `<div class="zoom-ph">${esc(item.name.charAt(0))}</div><p class="muted small" style="text-align:center">아직 사진이 없어요. 품목 수정에서 사진을 넣을 수 있어요.</p>`,
    actions: [{ label: '사진·정보 수정', value: 'edit' }, { label: '닫기', value: null, cls: 'primary' }] })
    .then(v => { if (v === 'edit') openItemEditor(item.id); });
}
