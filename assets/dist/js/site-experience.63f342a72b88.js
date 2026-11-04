/* Progressive, local-only navigation. All meaningful copy is rendered in HTML. */
(() => {
  'use strict';
  for (const spotlight of document.querySelectorAll('[data-scenario-spotlight]')) {
    const controls = spotlight.querySelector('[data-scenario-controls]');
    const buttons = [...spotlight.querySelectorAll('[data-scenario-select]')];
    const panels = [...spotlight.querySelectorAll('[data-scenario-panel]')];
    const caseJumps = [...spotlight.querySelectorAll('[data-scenario-jump]')];
    if (!controls || buttons.length !== panels.length || !panels.length) continue;
    const textView = spotlight.querySelector('.scenario-spotlight__panels');
    const visualView = spotlight.querySelector('[data-connected-scene]');
    const viewControls = spotlight.querySelector('[data-scenario-views]');
    const viewButtons = [...spotlight.querySelectorAll('[data-scenario-view]')];
    const cubeRoot = visualView?.querySelector('[data-cube-conceptual]');
    let selected = 0;
    let visual = false;
    let cube = null;
    let resumeMotion = true;
    let frame = 0;
    const story = () => ({
      question: panels[selected].querySelector('h2').textContent.trim(),
      answer: panels[selected].querySelector('.scenario-flow__result p').textContent.trim(),
    });
    const refreshVisual = () => {
      if (!visualView) return;
      const selectedStory = story();
      visualView.querySelector('[data-connected-sources]').textContent = panels[selected].querySelector('.scenario-flow__sources p').textContent;
      visualView.querySelector('[data-connected-link]').href = panels[selected].querySelector('.scenario-panel__link').href;
      cubeRoot?.querySelectorAll('.home-cube__question').forEach((copy) => { copy.textContent = selectedStory.question; });
      cubeRoot?.querySelectorAll('.home-cube__answer').forEach((copy) => { copy.textContent = selectedStory.answer; });
      if (cube && !cube.error) cube.setStory(selectedStory);
    };
    const revealCube = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!visual || !cubeRoot || !window.AdvanexusCube) return;
        if (!cube) {
          let labels;
          try { labels = JSON.parse(cubeRoot.dataset.cubeLabels); } catch (_) { return; }
          if (!Array.isArray(labels) || labels.length !== 4) return;
          cube = window.AdvanexusCube.mount(cubeRoot, {
            conceptual: true, prominentConversation: true,
            ...story(), labels,
            accent: '#0ab39c', background: '#343541', labelColor: '#ffffff',
            logoUrl: cubeRoot.dataset.cubeSymbol,
            accessibleLabel: cubeRoot.dataset.cubeDescription,
            pauseLabel: cubeRoot.dataset.cubePause, resumeLabel: cubeRoot.dataset.cubeResume,
            pausedLabel: cubeRoot.dataset.cubeResume,
            autoPlay: true, autoRotate: false, ground: false, pixelRatio: 1.5, glow: .16,
          });
          cubeRoot.dataset.cubeReady = String(!cube.error);
        } else if (!cube.error) {
          cube.resize();
          if (resumeMotion) cube.play();
        }
      });
    };
    const select = (index) => {
      if (!Number.isInteger(index) || index < 0 || index >= panels.length) return;
      selected = index;
      buttons.forEach((button, position) => button.setAttribute('aria-pressed', String(index === position)));
      caseJumps.forEach((button, position) => button.setAttribute('aria-pressed', String(index === position)));
      panels.forEach((panel, position) => { panel.hidden = index !== position; });
      refreshVisual();
    };
    buttons.forEach((button, index) => button.addEventListener('click', () => select(index)));
    caseJumps.forEach((button) => button.addEventListener('click', () => select(Number(button.dataset.scenarioJump))));
    select(0);
    controls.hidden = false;
    spotlight.dataset.enhanced = 'true';
    if (textView && visualView && viewControls) {
      const setView = (nextVisual) => {
        if (visual === nextVisual) return;
        if (!nextVisual && cube && !cube.error) {
          resumeMotion = cube.getState().running;
          cube.pause();
        }
        visual = nextVisual;
        textView.hidden = visual;
        visualView.hidden = !visual;
        spotlight.dataset.view = visual ? 'visual' : 'text';
        viewButtons.forEach((viewButton) => viewButton.setAttribute('aria-pressed', String((viewButton.dataset.scenarioView === 'visual') === visual)));
        buttons.forEach((caseButton, index) => caseButton.setAttribute('aria-controls', visual ? visualView.id : panels[index].id));
        if (visual) revealCube();
      };
      viewButtons.forEach((button) => button.addEventListener('click', () => setView(button.dataset.scenarioView === 'visual')));
      viewControls.hidden = false;
      setView(true);
      // Deferred renderer assets may finish after this shared enhancement.
      document.addEventListener('DOMContentLoaded', () => { if (visual && !cube) revealCube(); }, {once: true});
      // A bfcache return retains the selected case and the user's pause choice.
      window.addEventListener('pagehide', () => {
        cancelAnimationFrame(frame);
        if (cube && !cube.error && visual) { resumeMotion = cube.getState().running; cube.pause(); }
      });
      window.addEventListener('pageshow', () => { if (visual) revealCube(); });
    }
  }

  if (!('IntersectionObserver' in window)) return;
  for (const compass of document.querySelectorAll('[data-page-compass]')) {
    const entries = [...compass.querySelectorAll('a[href^="#"]')]
      .map((link) => ({link, target: document.getElementById(link.hash.slice(1))}))
      .filter((entry) => entry.target);
    const observer = new IntersectionObserver((changes) => {
      const visible = changes.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (!visible.length) return;
      for (const entry of entries) {
        if (entry.target === visible[0].target) entry.link.setAttribute('aria-current', 'location');
        else entry.link.removeAttribute('aria-current');
      }
    }, {rootMargin: '-15% 0px -55% 0px', threshold: 0});
    entries.forEach((entry) => observer.observe(entry.target));
    window.addEventListener('pagehide', () => observer.disconnect());
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) entries.forEach((entry) => observer.observe(entry.target));
    });
  }
})();
