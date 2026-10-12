/* Local, opt-in calculation only: no storage, telemetry, network or AI calls. */
(() => {
  'use strict';
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
