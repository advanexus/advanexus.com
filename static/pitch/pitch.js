/* Local presentation navigation. No telemetry, storage, AI calls or external runtime. */
(() => {
  'use strict';
  const root = document.documentElement;
  const slides = Array.from(document.querySelectorAll('[data-slide]'));
  if (!slides.length) return;
  const query = new URLSearchParams(window.location.search);
  let reading = query.get('view') === 'reading';
  let index = 0;
  let theme = query.get('theme') === 'light' ? 'light' : 'dark';
  const contents = document.getElementById('contents');
  const notes = document.getElementById('notes');
  const review = document.getElementById('review');
  const previous = document.querySelector('[data-prev]');
  const next = document.querySelector('[data-next]');
  const language = document.querySelector('[data-language]');
  const themeButton = document.querySelector('button[data-theme]');
  const readingButton = document.querySelector('[data-reading]');
  const closeDialogs = () => document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  const mapTabs = Array.from(document.querySelectorAll('[data-map-tab]'));
  function selectMap(id, focus = false) {
    if (!mapTabs.some(tab => tab.dataset.mapTab === id)) id = mapTabs[0]?.dataset.mapTab;
    mapTabs.forEach(tab => {
      const active = tab.dataset.mapTab === id;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });
    document.querySelectorAll('[data-map-panel]').forEach(panel => { panel.hidden = panel.dataset.mapPanel !== id; });
  }
  mapTabs.forEach((tab, number) => {
    tab.addEventListener('click', () => selectMap(tab.dataset.mapTab));
    tab.addEventListener('keydown', event => {
      const move = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (move) { event.preventDefault(); event.stopPropagation(); selectMap(mapTabs[(number + move + mapTabs.length) % mapTabs.length].dataset.mapTab, true); }
    });
  });
  // Categorical coordinates share a cell when the cited focus is the same.
  // Selecting a name exposes its evidence without moving the plotted position.
  const vendorChoices = Array.from(document.querySelectorAll('[data-vendor-select]'));
  function selectVendor(id) {
    if (!vendorChoices.some(choice => choice.dataset.vendorSelect === id)) return;
    vendorChoices.forEach(choice => choice.setAttribute('aria-pressed', String(choice.dataset.vendorSelect === id)));
    document.querySelectorAll('[data-vendor-detail]').forEach(detail => {
      detail.hidden = detail.dataset.vendorDetail !== id;
    });
  }
  vendorChoices.forEach(choice => choice.addEventListener('click', () => selectVendor(choice.dataset.vendorSelect)));
  selectVendor('advanexus');
  // Full offers share one business-scope category; selection reveals scope,
  // never a fabricated quality or performance ranking.
  document.querySelectorAll('[data-offer-map]').forEach(map => {
    const choices = Array.from(map.querySelectorAll('[data-offer-select]'));
    const details = Array.from(map.querySelectorAll('[data-offer-detail]'));
    const select = (id, focus = false) => {
      const selected = choices.find(choice => choice.dataset.offerSelect === id);
      if (!selected) return;
      choices.forEach(choice => choice.setAttribute('aria-pressed', String(choice === selected)));
      details.forEach(detail => { detail.hidden = detail.dataset.offerDetail !== id; });
      if (focus) selected.focus({preventScroll: true});
    };
    choices.forEach((choice, number) => {
      choice.addEventListener('click', () => select(choice.dataset.offerSelect));
      choice.addEventListener('keydown', event => {
        const move = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
        if (!move && event.key !== 'Home' && event.key !== 'End') return;
        event.preventDefault(); event.stopPropagation();
        const position = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : (number + move + choices.length) % choices.length;
        select(choices[position].dataset.offerSelect, true);
      });
    });
    select('advanexus');
  });
  // Coordinates are authored ordinal categories. Equal coordinates remain one
  // marker; selecting an offer changes its explanation, never its position.
  document.querySelectorAll('[data-coordinate-map]').forEach(map => {
    const choices = Array.from(map.querySelectorAll('[data-point-select]'));
    const markers = Array.from(map.querySelectorAll('[data-coordinate]'));
    const details = Array.from(map.querySelectorAll('[data-point-detail]'));
    let selectedId = choices.find(choice => choice.dataset.pointSelect === 'advanexus')?.dataset.pointSelect || choices[0]?.dataset.pointSelect;
    const selectPoint = (id, focus = false) => {
      const selected = choices.find(choice => choice.dataset.pointSelect === id);
      if (!selected) return;
      selectedId = id;
      choices.forEach(choice => choice.setAttribute('aria-pressed', String(choice === selected)));
      markers.forEach(marker => {
        const active = marker.dataset.coordinate === selected.dataset.pointCoordinate;
        marker.setAttribute('aria-pressed', String(active));
      });
      details.forEach(detail => { detail.hidden = detail.dataset.pointDetail !== id; });
      if (focus) selected.focus({preventScroll: true});
    };
    choices.forEach((choice, number) => {
      choice.addEventListener('click', () => selectPoint(choice.dataset.pointSelect));
      choice.addEventListener('keydown', event => {
        const move = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
        if (!move && event.key !== 'Home' && event.key !== 'End') return;
        event.preventDefault(); event.stopPropagation();
        const position = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : (number + move + choices.length) % choices.length;
        selectPoint(choices[position].dataset.pointSelect, true);
      });
    });
    markers.forEach(marker => marker.addEventListener('click', () => {
      const ids = marker.dataset.pointIds.split(' ');
      const current = ids.indexOf(selectedId);
      selectPoint(ids[(current + 1) % ids.length]);
    }));
    selectPoint(selectedId);
  });
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('[data-flow-demo]').forEach(flow => {
    const toggle = flow.querySelector('[data-flow-toggle]');
    if (!toggle) return;
    let pausedByUser = flow.dataset.flowPaused === 'true';
    const updateFlow = () => {
      const paused = reducedMotion.matches || pausedByUser;
      flow.dataset.flowPaused = String(paused);
      toggle.setAttribute('aria-pressed', String(paused));
      toggle.disabled = reducedMotion.matches;
      toggle.textContent = paused ? toggle.dataset.playLabel : toggle.dataset.pauseLabel;
    };
    toggle.addEventListener('click', () => { pausedByUser = !pausedByUser; updateFlow(); });
    reducedMotion.addEventListener('change', updateFlow);
    updateFlow();
  });
  function syncURL() {
    const url = new URL(window.location.href);
    url.searchParams.set('theme', theme);
    if (reading) url.searchParams.set('view', 'reading'); else url.searchParams.delete('view');
    url.hash = '/' + slides[index].id;
    window.history.replaceState(null, '', url);
    const other = new URL(language.getAttribute('href'), window.location.href);
    other.search = url.search;
    other.hash = url.hash;
    language.href = other.href;
  }
  function show(requested, updateURL = true) {
    index = Math.max(0, Math.min(slides.length - 1, requested));
    root.classList.toggle('reading', reading);
    slides.forEach((slide, number) => {
      slide.hidden = !reading && number !== index;
      slide.classList.toggle('is-active', number === index);
    });
    previous.disabled = index === 0;
    next.disabled = index === slides.length - 1;
    document.querySelector('[data-position]').textContent = String(index + 1).padStart(2, '0') + ' / ' + slides.length;
    document.querySelector('[data-chapter]').textContent = document.querySelector(slides[index].dataset.appendix === 'true' ? '[data-appendix-label]' : '[data-main-label]').textContent;
    document.querySelector('progress').value = index + 1;
    readingButton.setAttribute('aria-pressed', String(reading));
    if (!reading) slides[index].scrollTop = 0;
    if (updateURL) syncURL();
  }
  function fromHash() {
    const id = window.location.hash.replace(/^#\/?/, '');
    const found = slides.findIndex(slide => slide.id === id);
    show(found < 0 ? 0 : found);
    if (reading) slides[index].scrollIntoView({block: 'start'});
  }
  function applyTheme() {
    root.dataset.theme = theme;
    themeButton.setAttribute('aria-pressed', String(theme === 'light'));
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#151c24' : '#f7f7f2';
  }
  function navigate(number) {
    closeDialogs();
    show(number);
    if (reading) slides[index].scrollIntoView({block: 'start'});
    else window.scrollTo(0, 0);
  }
  previous.addEventListener('click', () => navigate(index - 1));
  next.addEventListener('click', () => navigate(index + 1));
  document.querySelector('[data-contents]').addEventListener('click', () => contents.showModal());
  document.querySelectorAll('[data-review],[data-review-section]').forEach(button => button.addEventListener('click', () => {
    closeDialogs();
    review.showModal();
    const section = button.dataset.reviewSection;
    if (section) document.getElementById('review-' + section)?.scrollIntoView({block: 'start'});
    else review.scrollTop = 0;
  }));
  document.querySelectorAll('[data-go]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    navigate(slides.findIndex(slide => slide.id === link.dataset.go));
    document.getElementById('deck').focus({preventScroll: true});
  }));
  document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', closeDialogs));
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } }));
  document.querySelectorAll('[data-open-notes]').forEach(button => button.addEventListener('click', () => {
    const content = document.getElementById('notes-' + button.dataset.openNotes);
    document.querySelector('[data-note-body]').replaceChildren(content.content.cloneNode(true));
    notes.showModal();
  }));
  themeButton.addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; applyTheme(); syncURL(); });
  readingButton.addEventListener('click', () => { reading = !reading; show(index); if (reading) slides[index].scrollIntoView({block: 'start'}); else window.scrollTo(0, 0); });
  const fullscreen = document.querySelector('[data-fullscreen]');
  if (!document.fullscreenEnabled) fullscreen.hidden = true;
  fullscreen.addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await root.requestFullscreen(); }
    catch (_) { /* Presentation navigation remains available when fullscreen is denied. */ }
  });
  document.querySelector('[data-print]').addEventListener('click', () => { closeDialogs(); window.print(); });
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || document.querySelector('dialog[open]') || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    const editableKey = event.target.closest('button,a');
    if (event.key === 'ArrowRight' || event.key === 'PageDown' || (event.key === ' ' && !editableKey)) { event.preventDefault(); navigate(index + 1); }
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); navigate(index - 1); }
    if (event.key === 'Home') { event.preventDefault(); navigate(0); }
    if (event.key === 'End') { event.preventDefault(); navigate(slides.length - 1); }
  });
  let pointer = null;
  const deck = document.getElementById('deck');
  deck.addEventListener('pointerdown', event => { if (event.pointerType === 'touch' && !event.target.closest('a,button,table')) pointer = {x: event.clientX, y: event.clientY}; });
  deck.addEventListener('pointerup', event => {
    if (!pointer) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    pointer = null;
    if (Math.abs(dx) > 75 && Math.abs(dx) > Math.abs(dy) * 2) navigate(index + (dx < 0 ? 1 : -1));
  });
  deck.addEventListener('pointercancel', () => { pointer = null; });
  window.addEventListener('hashchange', fromHash);
  applyTheme();
  root.classList.add('enhanced');
  if (mapTabs.length) selectMap(mapTabs[0].dataset.mapTab);
  fromHash();
})();
