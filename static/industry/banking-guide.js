/* A deterministic, local walkthrough. No requests, credentials, storage or AI calls. */
(() => {
  'use strict';
  const {copy: ui, scenarios, locale} = JSON.parse(document.getElementById('guide-data').textContent);
  const $ = (id) => document.getElementById(id);
  const t = (sr, en) => locale === 'rs' ? sr : en;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const steps = ui.steps;
  const memory = new Map();
  let scenario = null;
  let stepIndex = 0;
  let playing = false;
  let playTimer = null;
  let animationTimer = null;
  let animationPaused = false;
  let dialogOpener = null;
  const languageBase = $('language-link').getAttribute('href');
  const presentationBase = $('presentation-link').getAttribute('href').split('#')[0];
  const simulationStates = () => {
    if (!memory.has(scenario.id)) memory.set(scenario.id, {pipeline: -1, consent: false, connected: false, answered: false, visited: new Set()});
    return memory.get(scenario.id);
  };
  const tone = (status) => ({SUCCEEDED:'success', PASSED:'success', RECORDED:'success', FAILED:'danger', NOT_STARTED:'muted', RUNNING:'warning', READY:'muted'}[status] || 'muted');
  const explanations = {
    SUCCEEDED: t('Korak je završen', 'The step completed'),
    PASSED: t('Pravilo je zadovoljeno', 'The rule passed'),
    FAILED: t('Korak ili kontrola nije prošla', 'The step or check did not pass'),
    NOT_STARTED: t('Korak nije pokrenut', 'The step was not started'),
    RECORDED: t('Događaj je evidentiran', 'The event was recorded'),
    RUNNING: t('Prikaz koraka u toku', 'Step preview in progress'),
    READY: t('Prikaz još nije pokrenut', 'Preview has not started')
  };
  const pill = status => `<span class="status-pill" data-tone="${tone(status)}" title="${esc(explanations[status] || status)}">${esc(status)}</span>`;
  const metrics = items => `<div class="metric-grid">${items.map(item => `<div class="metric ${esc(item.tone || 'neutral')}"><strong class="metric-value">${esc(item.value)}</strong><span class="metric-label">${esc(item.label)}</span></div>`).join('')}</div>`;
  const table = (columns, rows, caption) => `<div class="data-table-wrap" tabindex="0" role="region" aria-label="${esc(caption)}"><table class="data-table"><caption class="sr-only">${esc(caption)}</caption><thead><tr>${columns.map(column => `<th scope="col">${esc(column.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.cells.map(cell => `<td>${esc(cell.text)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const action = (name, text, secondary = false) => `<button type="button" class="${secondary ? 'secondary' : 'primary'} screen-action" data-action="${name}">${esc(text)}</button>`;
  const panel = (title, content, label = '') => `<section class="panel"><div class="panel-heading"><div>${label ? `<p class="section-eyebrow">${esc(label)}</p>` : ''}<h2 class="panel-title">${esc(title)}</h2></div></div>${content}</section>`;
  const callout = (text, kind = 'info') => `<p class="callout ${kind}">${esc(text)}</p>`;
  const ref = (reference, eventIndex) => `<button class="reference-link code" type="button" data-evidence="${eventIndex}">${esc(reference)}</button>`;
  function evidenceEntries() {
    const state = simulationStates();
    const entries = [...scenario.evidence];
    const prefix = `SIM-${scenario.id.toUpperCase()}`;
    if (state.connected) entries.push({
      time: '07:02:00 UTC', status: 'RECORDED', reference: `${prefix}-ACCESS-01`,
      event: t('Potvrđen izabrani AI obuhvat', 'Selected AI scope confirmed'),
      detail: t('U simulaciji je potvrđen pregled ', 'The simulation confirmed the review ') + scenario.connection.resource + '. ' + ui.connection_boundary
    });
    if (state.connected && state.answered) entries.push({
      time: '07:02:10 UTC', status: 'RECORDED', reference: `${prefix}-ANSWER-01`,
      event: t('Odgovor vezan za isti odobreni rezultat', 'Answer linked to the same approved result'),
      detail: `${scenario.question} ${ui.chat_scope} ${ui.chat_subtitle}`
    });
    return entries;
  }

  function updateLinks() {
    const theme = document.body.dataset.theme;
    const hash = scenario ? `#${scenario.id}/${steps[stepIndex].id}` : '';
    $('language-link').href = `${languageBase}?theme=${theme}${hash}`;
    $('presentation-link').href = `${presentationBase}?theme=${theme}#delivery`;
    document.querySelector('.guide-brand').href = $('presentation-link').href;
  }

  function setTheme(theme) {
    document.body.dataset.theme = theme === 'light' ? 'light' : 'dark';
    const light = document.body.dataset.theme === 'light';
    document.querySelector('.guide-brand img').src = `/assets/src/img/public/advanexus-wordmark-${light ? 'color' : 'light'}.webp`;
    $('theme-toggle').setAttribute('aria-pressed', String(light));
    const url = new URL(window.location.href);
    url.searchParams.set('theme', light ? 'light' : 'dark');
    history.replaceState(null, '', url);
    updateLinks();
  }

  function syncAddress() {
    const url = new URL(window.location.href);
    url.hash = scenario ? `${scenario.id}/${steps[stepIndex].id}` : '';
    history.replaceState(null, '', url);
    updateLinks();
  }

  function playbackLabel() {
    $('autoplay').textContent = playing ? ui.pause : ui.play;
    $('autoplay').setAttribute('aria-pressed', String(playing));
    $('playback-status').textContent = playing ? ui.playing : ui.paused;
  }

  function pause() {
    playing = false;
    clearTimeout(playTimer);
    playTimer = null;
    if (animationTimer !== null) {
      clearTimeout(animationTimer);
      animationTimer = null;
      animationPaused = true;
      if (scenario && steps[stepIndex].id === 'pipeline') $('workspace-body').innerHTML = renderPipeline();
    }
    playbackLabel();
  }

  function finishAnimation() {
    clearTimeout(animationTimer);
    animationTimer = null;
    if (scenario && simulationStates().pipeline >= 0 && simulationStates().pipeline < scenario.pipeline.stages.length) animationPaused = true;
  }

  function showChooser(focus = true) {
    pause();
    finishAnimation();
    scenario = null;
    $('tour').hidden = true;
    $('chooser').hidden = false;
    syncAddress();
    if (focus) $('chooser-title').focus({preventScroll: true});
    window.scrollTo({top: 0, behavior: 'instant'});
  }

  function startScenario(id, index = 0, focus = true) {
    const selected = scenarios.find(item => item.id === id);
    if (!selected) return showChooser(focus);
    pause();
    finishAnimation();
    scenario = selected;
    stepIndex = Math.max(0, Math.min(steps.length - 1, index));
    $('chooser').hidden = true;
    $('tour').hidden = false;
    render(focus);
  }

  function go(index, focus = true) {
    if (!scenario) return;
    finishAnimation();
    stepIndex = Math.max(0, Math.min(steps.length - 1, index));
    render(focus);
  }

  function renderSources() {
    const rows = scenario.sources.map((source, index) => `<tr><td><button class="reference-link" type="button" data-source="${index}">${esc(source.name)}</button></td><td>${esc(source.role)}</td><td class="code">${esc(source.records)}</td><td class="code">${esc(source.stamp)}</td></tr>`).join('');
    return panel(ui.sources, `<div class="data-table-wrap" role="region" tabindex="0" aria-label="${esc(ui.sources)}"><table class="data-table"><thead><tr><th scope="col">${esc(ui.source)}</th><th scope="col">${esc(ui.role)}</th><th scope="col">${esc(ui.records)}</th><th scope="col">${esc(ui.observed)}</th></tr></thead><tbody>${rows}</tbody></table></div>${callout(ui.source_note)}`, 'Sources') + callout(scenario.benefit, 'success');
  }

  function renderPipeline() {
    const state = simulationStates();
    const flow = scenario.pipeline;
    const completed = state.pipeline >= flow.stages.length;
    const started = state.pipeline >= 0;
    const status = completed ? flow.status : started ? 'RUNNING' : 'READY';
    const stageList = flow.stages.map((stage, index) => {
      const currentStatus = completed || index < state.pipeline ? stage.status : index === state.pipeline ? 'RUNNING' : 'NOT_STARTED';
      return `<li class="flow-node"><span class="flow-index">${index + 1}</span><div class="flow-copy"><strong>${esc(stage.name)}</strong><span>${esc(explanations[currentStatus])}</span></div>${pill(currentStatus)}</li>`;
    }).join('');
    return panel(flow.name, `<div class="detail-grid"><div class="detail-pair"><span>Status</span>${pill(status)}</div><div class="detail-pair"><span>${esc(ui.reference)}</span><span class="code">${esc(flow.reference)}</span></div></div><ol class="flow-list">${stageList}</ol>${callout(completed ? flow.explanation : started ? animationPaused ? ui.pipeline_paused : ui.pipeline_running : ui.pipeline_before, completed && flow.status === 'FAILED' ? 'warn' : 'info')}${action('run-preview', completed ? ui.pipeline_replay : started && animationPaused ? ui.pipeline_resume : ui.pipeline_run)}`, 'Pipelines');
  }

  function renderQuality() {
    const quality = scenario.quality;
    return panel(quality.name, `${pill(quality.status)}${metrics(quality.metrics)}${callout(quality.explanation, quality.status === 'FAILED' ? 'warn' : 'success')}${table(quality.columns, quality.rows, quality.name)}<p class="muted">${esc(ui.quality_note)}</p>`, 'Data Quality');
  }

  function renderResult() {
    const result = scenario.result;
    const chart = result.chart;
    const bars = chart ? `<figure class="result-chart"><figcaption>${esc(chart.title)} <span class="muted">(${esc(chart.unit)})</span></figcaption><div class="preview-bars">${chart.bars.map(bar => `<div class="preview-bar ${esc(bar.tone)}"><span>${esc(bar.label)}</span><span class="bar-track" aria-hidden="true"><span class="bar-fill" style="--bar-width:${Math.max(0, Math.min(100, Number(bar.value) / Number(chart.max) * 100))}%"></span></span><strong>${Number(bar.value).toLocaleString(locale === 'rs' ? 'sr-Latn-RS' : 'en-GB')}</strong></div>`).join('')}</div></figure>` : '';
    return panel(result.title, `<p class="result-lead">${esc(result.lead)}</p><div class="detail-grid"><div class="detail-pair"><span>Status</span><strong>${esc(result.status)}</strong></div><div class="detail-pair"><span>${esc(ui.version)}</span><strong>${esc(ui.version_value)}</strong></div></div>${metrics(result.metrics)}${bars}${table(result.columns, result.rows, result.title)}${callout(result.boundary)}`, ui.result_label);
  }

  function renderConnection() {
    const state = simulationStates();
    return panel(ui.connection_title, `<p>${esc(ui.connection_intro)}</p><div class="consent-card"><div class="detail-grid"><div class="detail-pair"><span>${esc(ui.client)}</span><strong>${esc(ui.client_name)}</strong></div><div class="detail-pair"><span>${esc(ui.project)}</span><strong>Banks</strong></div></div><div class="resource-scope"><p class="section-eyebrow">${esc(ui.connection_resource)}</p><h3>${esc(scenario.connection.resource)}</h3><p>${esc(ui.selected_fields)}</p><div class="scope-fields">${scenario.connection.fields.map(field => `<span class="scope-field code">${esc(field.name)}</span>`).join('')}</div></div><p class="muted">✓ ${esc(ui.help)}</p>${state.connected ? `<div class="connection-state">${pill('SUCCEEDED')}<p>${esc(ui.consent_confirmed)}</p></div>` : `<label class="consent-check"><input id="consent-toggle" type="checkbox" ${state.consent ? 'checked' : ''}><span>${esc(ui.consent)}</span></label><button type="button" class="primary screen-action" data-action="confirm-preview" ${state.consent ? '' : 'disabled'}>${esc(ui.consent_button)}</button>`}</div>${callout(ui.connection_boundary)}`, 'AI Control & Evidence');
  }

  function renderChat() {
    const state = simulationStates();
    const answer = scenario.answer;
    const links = scenario.evidence.map((event, index) => ({event, index})).filter(({event}) => event.status === 'FAILED' || event.status === 'SUCCEEDED').slice(0, 2);
    const response = !state.connected ? `<div class="chat-empty">${callout(ui.access_required, 'warn')}${action('review-access', ui.review_access)}</div>` : state.answered
      ? `<article class="message-assistant"><div class="chat-avatar" aria-hidden="true">a</div><div class="chat-text"><p class="section-eyebrow">${esc(ui.assistant)} · ${esc(ui.answer_ready)}</p><h3>${esc(answer.headline)}</h3>${answer.paragraphs.map(paragraph => `<p>${esc(paragraph.text)}</p>`).join('')}<div class="chat-next"><strong>${esc(ui.next_evidence)}</strong><p>${esc(answer.next)}</p></div>${callout(answer.boundary)}<div class="chat-citations">${links.map(({event, index}) => ref(event.reference, index)).join('')}</div>${action('open-trail', ui.open_evidence, true)}</div></article>`
      : `<div class="chat-empty"><p>${esc(ui.chat_empty)}</p>${action('show-answer', ui.show_answer)}</div>`;
    return `<section class="chat-window"><div class="chat-header"><span class="chat-avatar" aria-hidden="true">a</span><div><h2>${esc(ui.chat_title)}</h2><p>${esc(ui.chat_subtitle)}</p></div></div><article class="message-user"><p class="section-eyebrow">${esc(ui.you)}</p><p class="chat-question">${esc(scenario.question)}</p></article>${response}<p class="chat-footer">${esc(ui.chat_scope)}</p></section>`;
  }

  function renderEvidence() {
    const events = evidenceEntries().map((event, index) => `<li class="evidence-event"><button type="button" data-evidence="${index}"><span class="event-time code">${esc(event.time)}</span><span class="event-dot" data-tone="${tone(event.status)}" aria-hidden="true"></span><span class="event-copy"><strong>${esc(event.event)}</strong><span class="event-reference code">${esc(event.reference)}</span></span>${pill(event.status)}</button></li>`).join('');
    return panel(ui.evidence_title, `<p>${esc(ui.evidence_intro)}</p><ol class="evidence-list">${events}</ol>${callout(ui.evidence_boundary)}${scenario.comparison ? action('comparison', ui.comparison, true) : ''}`, 'Assurance · Execution Story') + `<section class="finish-card"><p class="section-eyebrow">${esc(t('ŠTA OVAJ PRIMER POKAZUJE', 'WHAT THIS EXAMPLE SHOWS'))}</p><h2>${esc(scenario.benefit)}</h2><p>${esc(ui.end_note)}</p><div class="coach-actions">${action('chooser', ui.finish, true)}<a class="primary screen-action" href="mailto:mt@advanexus.com?subject=${encodeURIComponent('advanexus | ' + scenario.title)}">${esc(ui.contact)}</a></div></section>`;
  }

  const screens = {sources: renderSources, pipeline: renderPipeline, quality: renderQuality, result: renderResult, connection: renderConnection, chat: renderChat, evidence: renderEvidence};

  function render(focus = false) {
    if (!scenario) return;
    const step = steps[stepIndex];
    const visited = simulationStates().visited;
    visited.add(stepIndex);
    $('workspace-breadcrumb').textContent = `${ui.workspace} / ${step.module}`;
    $('workspace-title').textContent = scenario.title;
    $('workspace-body').innerHTML = screens[step.id]();
    $('module-nav').innerHTML = steps.map((item, index) => `<button type="button" data-step="${index}" class="${index === stepIndex ? 'is-active' : ''}" ${index === stepIndex ? 'aria-current="step"' : ''}><span class="nav-symbol" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><span>${esc(item.module)}</span></button>`).join('');
    $('step-nav').innerHTML = steps.map((item, index) => `<li><button type="button" class="${index === stepIndex ? 'current' : visited.has(index) ? 'done' : ''}" data-step="${index}" ${index === stepIndex ? 'aria-current="step"' : ''} title="${esc(visited.has(index) ? t('Prikazano u vodiču', 'Viewed in the guide') : item.label)}"><span aria-hidden="true">${index + 1}</span>${esc(item.label)}</button></li>`).join('');
    const activeModule = $('module-nav').querySelector('[aria-current="step"]');
    $('module-nav').scrollLeft = Math.max(0, activeModule.offsetLeft - $('module-nav').offsetLeft - $('module-nav').clientWidth / 3);
    $('step-count').textContent = `${stepIndex + 1} / ${steps.length}`;
    $('step-progress').style.width = `${(stepIndex + 1) / steps.length * 100}%`;
    $('coach-title').textContent = step.title;
    $('coach-body').textContent = step.body;
    $('previous').disabled = stepIndex === 0;
    $('next').disabled = step.id === 'connection' && !simulationStates().connected;
    $('next').textContent = stepIndex === steps.length - 1 ? ui.finish : ui.next;
    playbackLabel();
    syncAddress();
    if (focus) {
      $('workspace-title').focus({preventScroll: true});
      window.scrollTo({top: 0, behavior: 'instant'});
    }
  }

  function runPreview() {
    if (!scenario) return;
    clearTimeout(animationTimer);
    const state = simulationStates();
    const count = scenario.pipeline.stages.length;
    // NOT_STARTED steps are never animated as running after a blocking failure.
    if (state.pipeline < 0 || state.pipeline >= count) state.pipeline = 0;
    animationPaused = false;
    const advance = () => {
      if (!scenario || steps[stepIndex].id !== 'pipeline') return;
      if (state.pipeline < count && scenario.pipeline.stages[state.pipeline].status === 'NOT_STARTED') state.pipeline = count;
      $('workspace-body').innerHTML = renderPipeline();
      if (state.pipeline < count) {
        animationTimer = setTimeout(() => { state.pipeline += 1; advance(); }, reducedMotion.matches ? 20 : 850);
      } else animationTimer = null;
    };
    advance();
  }

  function openDialog(title, html, opener) {
    pause();
    dialogOpener = opener || document.activeElement;
    $('dialog-title').textContent = title;
    $('dialog-content').innerHTML = html;
    if (!$('evidence-dialog').open) $('evidence-dialog').showModal();
    $('evidence-dialog').querySelector('.dialog-close').focus();
  }

  function showEvidence(index, opener) {
    const event = scenario ? evidenceEntries()[index] : null;
    if (!event) return;
    openDialog(event.event, `<div class="detail-grid"><div class="detail-pair"><span>Status</span>${pill(event.status)}</div><div class="detail-pair"><span>${esc(ui.observed)}</span><strong>${esc(event.time)}</strong></div></div><p class="code">${esc(event.reference)}</p><p>${esc(event.detail)}</p>${callout(ui.evidence_boundary)}`, opener);
  }

  function showSource(index, opener) {
    const source = scenario?.sources[index];
    if (!source) return;
    openDialog(source.name, `<p>${esc(source.role)}</p><div class="detail-grid"><div class="detail-pair"><span>${esc(ui.records)}</span><strong>${esc(source.records)}</strong></div><div class="detail-pair"><span>${esc(ui.observed)}</span><strong>${esc(source.stamp)}</strong></div></div>${callout(ui.source_detail)}`, opener);
  }

  function showComparison(opener) {
    const comparison = scenario?.comparison;
    if (!comparison) return;
    openDialog(comparison.title, `<p>${esc(comparison.intro)}</p><div class="comparison-grid">${[['before', ui.before], ['after', ui.after]].map(([key, label]) => `<section class="panel"><h3>${esc(label)}</h3>${pill(comparison[key].status)}<p class="metric-value">${esc(comparison[key].value)}</p><p class="code">${esc(comparison[key].reference)}</p></section>`).join('')}</div>${callout(comparison.boundary, 'warn')}`, opener);
  }

  function schedulePlayback() {
    clearTimeout(playTimer);
    if (!playing || !scenario || document.hidden) return;
    const id = steps[stepIndex].id;
    const state = simulationStates();
    if (id === 'pipeline' && state.pipeline < scenario.pipeline.stages.length) runPreview();
    if (id === 'connection' && !state.connected) {
      pause();
      $('playback-status').textContent = ui.consent_pause;
      return;
    }
    if (id === 'chat' && !state.connected) { pause(); return; }
    if (id === 'chat' && !state.answered) {
      playTimer = setTimeout(() => {
        if (!playing || !scenario || steps[stepIndex].id !== 'chat') return;
        simulationStates().answered = true;
        render();
        schedulePlayback();
      }, 1800);
      return;
    }
    // Long enough to read; visitors can pause or move at any point.
    const delay = id === 'chat' ? 22000 : id === 'evidence' ? 14000 : 11000;
    playTimer = setTimeout(() => {
      if (!playing) return;
      if (stepIndex === steps.length - 1) return pause();
      go(stepIndex + 1, false);
      schedulePlayback();
    }, delay);
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('button, a');
    if (!target) return;
    if (target.id === 'theme-toggle') { pause(); setTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark'); return; }
    if (target.dataset.scenario) return startScenario(target.dataset.scenario);
    if (target.dataset.step !== undefined) { pause(); go(Number(target.dataset.step)); return; }
    if (target.dataset.evidence !== undefined) return showEvidence(Number(target.dataset.evidence), target);
    if (target.dataset.source !== undefined) return showSource(Number(target.dataset.source), target);
    const name = target.dataset.action;
    if (!name) return;
    if (name === 'autoplay') {
      if (playing) return pause();
      playing = true;
      playbackLabel();
      schedulePlayback();
      return;
    }
    pause();
    if (name === 'close-dialog') return $('evidence-dialog').close();
    if (!scenario) return;
    if (name === 'chooser') return showChooser();
    if (name === 'restart') { memory.delete(scenario.id); go(0); return; }
    if (name === 'next') return stepIndex === steps.length - 1 ? showChooser() : go(stepIndex + 1);
    if (name === 'previous') return go(stepIndex - 1);
    if (name === 'run-preview') return runPreview();
    if (name === 'review-access') return go(steps.findIndex(step => step.id === 'connection'));
    if (name === 'show-answer' && simulationStates().connected) { simulationStates().answered = true; render(); return; }
    if (name === 'confirm-preview' && simulationStates().consent) { simulationStates().connected = true; render(); return; }
    if (name === 'open-trail') return go(steps.length - 1);
    if (name === 'comparison') return showComparison(target);
  });

  document.addEventListener('change', event => {
    if (event.target.id !== 'consent-toggle' || !scenario) return;
    pause();
    simulationStates().consent = event.target.checked;
    const button = document.querySelector('[data-action="confirm-preview"]');
    if (button) button.disabled = !event.target.checked;
  });
  $('evidence-dialog').addEventListener('close', () => { if (dialogOpener?.isConnected) dialogOpener.focus(); });
  $('evidence-dialog').addEventListener('click', event => {
    if (event.target !== $('evidence-dialog')) return;
    const bounds = $('evidence-dialog').getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) $('evidence-dialog').close();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('pagehide', () => { pause(); finishAnimation(); });
  const readAddress = () => {
    const [id, step] = window.location.hash.slice(1).split('/');
    const index = steps.findIndex(item => item.id === step);
    if (scenarios.some(item => item.id === id)) startScenario(id, index < 0 ? 0 : index, false);
    else showChooser(false);
  };
  window.addEventListener('hashchange', readAddress);
  // Respect a linked presentation theme. Nothing is stored on the device.
  setTheme(new URLSearchParams(window.location.search).get('theme') === 'light' ? 'light' : 'dark');
  readAddress();
})();
