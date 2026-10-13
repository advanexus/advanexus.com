/* Local calculation and display navigation: no storage, telemetry or AI calls. */
(() => {
  'use strict';
  const guideLinks = Array.from(document.querySelectorAll('[data-guide-link]'));
  if (guideLinks.length) {
    const syncGuideTheme = () => {
      const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
      guideLinks.forEach(link => {
        const destination = new URL(link.getAttribute('href'), window.location.href);
        destination.searchParams.set('theme', theme);
        link.setAttribute('href', destination.pathname + destination.search + destination.hash);
      });
    };
    // pitch.js is loaded first; defer theme clicks until its handler applies
    // the new theme. Direct generated-page links retain this query on Pages.
    syncGuideTheme();
    document.querySelector('button[data-theme]')?.addEventListener('click', () => {
      window.requestAnimationFrame(syncGuideTheme);
    });
  }
  document.addEventListener('input', event => {
    const calculator = event.target.closest('[data-calculator]');
    if (!calculator) return;
    const sr = calculator.dataset.locale === 'rs';
    const output = calculator.querySelector('[data-calc-result]');
    const raw = ['cycles', 'before', 'after', 'maintenance'].map(key => calculator.querySelector('[data-calc="' + key + '"]').value);
    const values = raw.map(Number);
    if (raw.some(value => value.trim() === '') || values.some(value => !Number.isFinite(value) || value < 0)) {
      output.textContent = sr ? 'Unesite četiri nenegativne vrednosti.' : 'Enter four non-negative values.';
      return;
    }
    const [cycles, before, after, maintenance] = values;
    const hours = cycles * (before - after) / 60 - maintenance;
    if (!Number.isFinite(hours)) {
      output.textContent = sr ? 'Vrednosti su izvan opsega obračuna.' : 'Values exceed the calculation range.';
      return;
    }
    output.textContent = new Intl.NumberFormat(sr ? 'sr-Latn-RS' : 'en-GB', {maximumFractionDigits: 1}).format(hours) + (sr ? ' sati kapaciteta mesečno, pre troškova rešenja.' : ' capacity hours per month, before solution costs.');
  });
})();
