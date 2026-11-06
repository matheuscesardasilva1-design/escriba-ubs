// ============================================================================
// MOTOR PRINCIPAL: GRAVAÇÃO ANTI-CRASH, ANEXO DISCRETO DE PDFs DE EXAMES,
// FILA ASSÍNCRONA, CONTROLE DE TOKENS E INTEGRAÇÃO GEMINI API (SOAP + REGULAÇÃO)
// ============================================================================

(function() {
  const state = {
    selectedTemplateId: 'geral',
    templateLocked: false,
    templates: {},
    activeConsultationId: null,
    recordingConsultationId: null,
    isContinuingConsultation: false,
    isRecording: false,
    isPaused: false,
    recordingSeconds: 0,
    silenceSeconds: 0,
    chunkIndex: 0,
    pendingExamFiles: [], // PDFs/Imagens de exames anexados para a consulta atual
    preTranscribedExamsText: '', // Resultado dos exames transcritos na hora durante a gravação
    autoCloudSync: localStorage.getItem('ubs_auto_cloud_sync') === 'true',
    mediaRecorder: null,
    mediaStream: null,
    audioContext: null,
    analyser: null,
    vuAnimationFrame: null,
    timerWorker: null,
    wakeLock: null,
    queueRunning: false,
    activeProcessingProgress: null, // { consultId, patientLabel, percent, stageLabel, elapsedSec, extraQueueCount, modelStatus }
    dailyTokensUsed: 0,
    dailyConsultationsProcessed: 0,
    recentApiCallsTimestamps: [], // Monitora o limite real de Requisições Por Minuto (RPM) da API
    activeReferralId: null,
    selectedMicDeviceId: localStorage.getItem('ubs_selected_mic') || ''
  };

  // Descoberta inteligente e auto-adaptativa do modelo Gemini Flash ativo na chave do usuário:
  // - Chaves novas (2026+) usam a geração Gemini 3 Flash (ex.: gemini-3.8-flash / gemini-3.0-flash / gemini-3-flash-preview) e bloqueiam gemini-2.5-flash com "no longer available to new users".
  // Lista robusta de modelos do Google AI Studio priorizados por capacidade e cota disponível:
  // 1. Alta Cota: Gemini 3.5 Flash Lite e 3.1 Flash Lite (500 atendimentos/dia cada — 496 livres hoje!)
  // 2. Ultra Cota: Gemma 4 31B / 26B (14.400 atendimentos/dia)
  // 3. Flash Completo com Cota Livre: Gemini 2.5 Flash (20 atendimentos/dia — 20 livres hoje)
  // 4. Flash 3: Gemini 3 Flash e 3 Flash Preview (20 atendimentos/dia — restam 2 hoje)
  // 5. Modelos com cota diária esgotada hoje (25/20): Gemini 3.8 Flash e 3.6 Flash (restabelecem amanhã)
  const GEMINI_MODELS = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemma-4-31b',
    'gemma-4-26b',
    'gemini-3-flash',
    'gemini-3-flash-preview',
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-2.5-flash-lite'
  ];

  const cachedDiscoveredModelsByKey = {};
  const modelOutputTokenLimits = {};

  function getKeyShortHash(apiKey) {
    const k = String(apiKey || '').trim();
    return k ? k.slice(-8) : 'default';
  }

  function getDisabledModelsForKey(apiKey) {
    try {
      return JSON.parse(localStorage.getItem('ubs_disabled_models_' + getKeyShortHash(apiKey)) || '[]');
    } catch (_) {
      return [];
    }
  }

  function markModelAsDisabledForKey(modelName, apiKey) {
    const clean = String(modelName || '').replace(/^models\//, '').trim();
    if (!clean) return;
    const storageKey = 'ubs_disabled_models_' + getKeyShortHash(apiKey);
    const list = getDisabledModelsForKey(apiKey);
    if (!list.includes(clean)) {
      list.push(clean);
      localStorage.setItem(storageKey, JSON.stringify(list));
    }
    const workKey = 'ubs_working_model_' + getKeyShortHash(apiKey);
    if (localStorage.getItem(workKey) === clean) {
      localStorage.removeItem(workKey);
    }
  }

  function getExhaustedModelsForToday(apiKey) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const storageKey = `ubs_exhausted_${today}_${getKeyShortHash(apiKey)}`;
      return JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch (_) {
      return [];
    }
  }

  function markModelExhaustedForToday(modelName, apiKey) {
    const clean = String(modelName || '').replace(/^models\//, '').trim();
    if (!clean) return;
    const today = new Date().toISOString().slice(0, 10);
    const storageKey = `ubs_exhausted_${today}_${getKeyShortHash(apiKey)}`;
    const list = getExhaustedModelsForToday(apiKey);
    if (!list.includes(clean)) {
      list.push(clean);
      localStorage.setItem(storageKey, JSON.stringify(list));
    }
    const workKey = 'ubs_working_model_' + getKeyShortHash(apiKey);
    if (localStorage.getItem(workKey) === clean) {
      localStorage.removeItem(workKey);
    }
  }

  function rememberWorkingModelForKey(modelName, apiKey) {
    const clean = String(modelName || '').replace(/^models\//, '').trim();
    if (clean) {
      localStorage.setItem('ubs_working_model_' + getKeyShortHash(apiKey), clean);
    }
  }

  async function getActiveGeminiModels(apiKey) {
    const disabled = getDisabledModelsForKey(apiKey);
    const exhaustedToday = getExhaustedModelsForToday(apiKey);
    const workKey = 'ubs_working_model_' + getKeyShortHash(apiKey);
    const remembered = localStorage.getItem(workKey) || '';
    const preferredModel = localStorage.getItem('ubs_preferred_model') || 'auto';
    const keyHash = getKeyShortHash(apiKey);

    const filterAndOrder = (rawList) => {
      const valid = rawList.filter(m => !disabled.includes(m) && !exhaustedToday.includes(m));
      // 1. Se o usuário escolheu um modelo preferido fixo na interface, coloca-o no topo absoluto!
      if (preferredModel && preferredModel !== 'auto' && valid.includes(preferredModel)) {
        return [preferredModel, ...valid.filter(m => m !== preferredModel)];
      }
      // 2. Prioriza modelo que já funcionou com sucesso na chave se não for Lite (ou se só restarem Lites)
      const hasFullOrLive = valid.some(m => !m.includes('lite'));
      if (remembered && valid.includes(remembered) && (!remembered.includes('lite') || !hasFullOrLive)) {
        return [remembered, ...valid.filter(m => m !== remembered)];
      }
      return valid;
    };

    if (cachedDiscoveredModelsByKey[keyHash] && cachedDiscoveredModelsByKey[keyHash].length > 0) {
      const activeFromCache = filterAndOrder(cachedDiscoveredModelsByKey[keyHash]);
      if (activeFromCache.length > 0) return activeFromCache;
    }

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
      if (res.ok) {
        const data = await res.json();
        (data.models || []).forEach(m => {
          const shortName = (m.name || '').replace(/^models\//, '');
          if (shortName && m.outputTokenLimit) {
            modelOutputTokenLimits[shortName] = m.outputTokenLimit;
          }
        });
        const allCapable = (data.models || [])
          .filter(m => {
            const methods = Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
            return methods.includes('generateContent') || methods.includes('bidiGenerateContent');
          })
          .map(m => (m.name || '').replace(/^models\//, ''))
          .filter(name => {
            if (!name) return false;
            // Filtros de exclusão: modelos sem saída de texto clínico
            if (name.includes('tts')) return false;
            if (name.includes('embedding')) return false;
            if (name.includes('imagen') || name.includes('banana') || name.includes('image')) return false;
            if (name.includes('veo')) return false;
            if (name.includes('pro')) return false; // Cota 0/0 na conta gratuita do usuário
            if (name.includes('robotics') || name.includes('computer-use')) return false;
            if (name.includes('1.0') || name.includes('1.5')) return false;
            if (name.includes('2.0') || name.startsWith('gemini-2-flash')) return false;

            // Modelos permitidos da conta: Live, Transcrição, Antigravity, Flash completo, Gemma e Flash-Lite
            const isLive = name.includes('live') || name.includes('native-audio-dialog');
            const isTranscribe = name.includes('transcribe');
            const isAntigravity = name.includes('antigravity');
            const isFlash = name.includes('flash');
            const isGemma = name.includes('gemma');

            return isLive || isTranscribe || isAntigravity || isFlash || isGemma;
          });

        // Hierarquia de pontuação dos modelos:
        // 1) Modelos Ilimitados da Live API e de Transcrição: 300 pontos
        // 2) Agente Antigravity (100 atendimentos/dia, 60 RPM): 250 pontos
        // 3) Modelos Flash Completos sem corte (3.8, 3.6, 3, 2.5): 200 pontos
        // 4) Gemma 4 (14.400 requisições/dia): 150 pontos
        // 5) Flash-Lite de emergência (500 requisições/dia): 50 pontos
        const scoreModel = (name) => {
          const isLive = name.includes('live') || name.includes('native-audio-dialog');
          const isTranscribe = name.includes('transcribe');
          const isAntigravity = name.includes('antigravity');
          const isFullFlash = name.includes('flash') && !name.includes('lite');
          const isGemma = name.includes('gemma');
          const isLite = name.includes('lite');

          let baseScore = 0;
          if (isLive || isTranscribe) {
            baseScore = 300;
          } else if (isAntigravity) {
            baseScore = 250;
          } else if (isFullFlash) {
            baseScore = 200;
          } else if (isGemma) {
            baseScore = 150;
          } else if (isLite) {
            baseScore = 50;
          } else {
            baseScore = 100;
          }

          const verMatch = name.match(/(\d+(?:\.\d+)?)/);
          const ver = verMatch ? parseFloat(verMatch[1]) : 0;
          const stableBonus = (!name.includes('preview') && !name.includes('exp')) ? 0.2 : 0;
          return baseScore + ver + stableBonus;
        };

        allCapable.sort((a, b) => scoreModel(b) - scoreModel(a));

        if (allCapable.length > 0) {
          cachedDiscoveredModelsByKey[keyHash] = allCapable;
          const ordered = filterAndOrder(allCapable);
          if (ordered.length > 0) return ordered;
        }
      }
    } catch (_) {}

    const fallback = filterAndOrder(GEMINI_MODELS);
    // Se todos foram marcados como esgotados hoje, limpa a lista de esgotados para tentar novamente caso a cota tenha virado
    if (fallback.length === 0) {
      return GEMINI_MODELS.filter(m => !disabled.includes(m));
    }
    return fallback;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    loadCustomOrDefaultTemplates();
    loadDailyTokenStats();
    renderTemplateSelector();
    initTimerWorker();
    await tryRestoreApiKeyFromChromeCredentialManager();
    await populateMicrophones();
    await checkCrashRecoveryAndLoadHistory();
    bindUIEvents();
    updateApiKeyStatusBadge();
    updateStorageStatsUI();
    renderPendingExamFilesUI();
    updateDocumentTitle();

    try {
      await window.ScribeDB.autoCleanupOldAudio(30, 15); // 15 dias para "Evoluído no PEC" e 30 dias para os demais
      await refreshQueueSidebar();
    } catch (_) {}

    // Verifica limpeza automática de 15 e 30 dias a cada hora caso a aba fique aberta
    setInterval(async () => {
      try {
        const removed = await window.ScribeDB.autoCleanupOldAudio(30, 15);
        if (removed > 0) await refreshQueueSidebar();
      } catch (_) {}
    }, 3600 * 1000);
  });

  function loadCustomOrDefaultTemplates() {
    const saved = localStorage.getItem('ubs_custom_templates_v10');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        state.templates = { ...window.DEFAULT_TEMPLATES, ...parsed };
        return;
      } catch (_) {}
    }
    state.templates = JSON.parse(JSON.stringify(window.DEFAULT_TEMPLATES));
  }

  function saveTemplatesToLocal() {
    localStorage.setItem('ubs_custom_templates_v10', JSON.stringify(state.templates));
  }

  function getTodayKey() {
    return 'ubs_tokens_' + new Date().toISOString().slice(0, 10);
  }

  function loadDailyTokenStats() {
    try {
      const raw = localStorage.getItem(getTodayKey());
      if (raw) {
        const data = JSON.parse(raw);
        state.dailyTokensUsed = data.tokens || 0;
        state.dailyConsultationsProcessed = data.count || 0;
      }
    } catch (_) {}
    updateTokenMonitorUI();
  }

  function addDailyTokenUsage(tokensAdded) {
    state.dailyTokensUsed += (tokensAdded || 0);
    state.dailyConsultationsProcessed += 1;
    state.recentApiCallsTimestamps.push(Date.now());
    localStorage.setItem(getTodayKey(), JSON.stringify({
      tokens: state.dailyTokensUsed,
      count: state.dailyConsultationsProcessed
    }));
    updateTokenMonitorUI();
  }

  function formatModelName(model) {
    if (!model) return '';
    const clean = String(model).replace(/^models\//, '');
    if (clean.includes('3-flash-live')) return 'Gemini 3 Flash Live (Ilimitado)';
    if (clean.includes('3.8-live')) return 'Gemini 3.8 Live (Ilimitado)';
    if (clean.includes('native-audio-dialog')) return 'Gemini 2.5 Native Audio (Ilimitado)';
    if (clean.includes('transcribe-live')) return 'Gemini 3.5 Transcribe Live (Ilimitado)';
    if (clean.includes('3.5-transcribe')) return 'Gemini 3.5 Transcribe';
    if (clean.includes('antigravity')) return 'Antigravity Managed Agent';
    if (clean.includes('3.8-flash')) return 'Gemini 3.8 Flash';
    if (clean.includes('3.6-flash')) return 'Gemini 3.6 Flash';
    if (clean.includes('2.5-flash') && !clean.includes('lite')) return 'Gemini 2.5 Flash';
    if (clean.includes('gemma')) return 'Gemma 4';
    if (clean.includes('3.5-flash-lite')) return 'Gemini 3.5 Flash Lite';
    if (clean.includes('3.1-flash-lite')) return 'Gemini 3.1 Flash Lite';
    if (clean.includes('2.5-flash-lite')) return 'Gemini 2.5 Flash Lite';
    return clean;
  }

  function updateTokenMonitorUI(modelUsed) {
    const now = Date.now();
    state.recentApiCallsTimestamps = (state.recentApiCallsTimestamps || []).filter(ts => now - ts < 60000);
    const rpmLastMinute = state.recentApiCallsTimestamps.length;
    const usedCalls = state.dailyConsultationsProcessed || 0;
    const activeModel = modelUsed || localStorage.getItem('ubs_working_model_' + getKeyShortHash(getSavedApiKey())) || '';
    const activeModelStr = activeModel ? ` • ${formatModelName(activeModel)}` : '';

    const elDaily = document.getElementById('dailyTokenCounter');
    if (elDaily) {
      if (rpmLastMinute >= 12) {
        elDaily.textContent = `🟡 Aguardando fila rápida (${usedCalls} hoje)${activeModelStr}`;
        elDaily.style.color = '#d97706';
      } else {
        elDaily.textContent = `🟢 Sistema Pronto (${usedCalls} hoje)${activeModelStr}`;
        elDaily.style.color = '#059669';
      }
    }
  }

  function initTimerWorker() {
    const workerCode = `
      let interval = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          if (interval) clearInterval(interval);
          interval = setInterval(() => self.postMessage('tick'), 1000);
        } else if (e.data === 'stop') {
          if (interval) clearInterval(interval);
          interval = null;
        }
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    state.timerWorker = new Worker(URL.createObjectURL(blob));
    state.timerWorker.onmessage = () => {
      if (state.isRecording && !state.isPaused) {
        state.recordingSeconds++;
        updateRecordingTimerUI();
        updateTokenMonitorUI();
        updateDocumentTitle();
      }
    };
  }

  let faviconCanvas = null;
  let lastFaviconKey = '';

  function updateDynamicFavicon(mode, percent = 0) {
    const key = `${mode}_${Math.round(percent / 5) * 5}`;
    if (key === lastFaviconKey) return;
    lastFaviconKey = key;

    try {
      if (!faviconCanvas) {
        faviconCanvas = document.createElement('canvas');
        faviconCanvas.width = 64;
        faviconCanvas.height = 64;
      }
      const ctx = faviconCanvas.getContext('2d');
      ctx.clearRect(0, 0, 64, 64);

      if (mode === 'recording') {
        // Círculo vermelho vivo de gravação ativa
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(32, 32, 29, 0, Math.PI * 2);
        ctx.fill();

        // Anel branco interno + ponto central de gravação
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(32, 32, 20, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(32, 32, 10, 0, Math.PI * 2);
        ctx.fill();
      } else if (mode === 'paused') {
        // Círculo âmbar com barras de pausa
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.arc(32, 32, 29, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(21, 18, 8, 28);
        ctx.fillRect(35, 18, 8, 28);
      } else if (mode === 'transcribing') {
        // Círculo azul/índigo com arco de progresso e porcentagem
        ctx.fillStyle = '#312e81';
        ctx.beginPath();
        ctx.arc(32, 32, 29, 0, Math.PI * 2);
        ctx.fill();

        // Trilha do arco
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(32, 32, 24, 0, Math.PI * 2);
        ctx.stroke();

        // Arco de progresso (0% a 100%)
        const pct = Math.min(100, Math.max(5, percent));
        const endAngle = -Math.PI / 2 + (Math.PI * 2 * (pct / 100));
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(32, 32, 24, -Math.PI / 2, endAngle);
        ctx.stroke();

        // Número da porcentagem no centro
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.round(pct)}`, 32, 33);
      } else {
        // Pronto para próxima gravação: círculo verde esmeralda com check branco
        ctx.fillStyle = '#059669';
        ctx.beginPath();
        ctx.arc(32, 32, 29, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(19, 33);
        ctx.lineTo(28, 42);
        ctx.lineTo(46, 22);
        ctx.stroke();
      }

      let link = document.getElementById('dynamicFavicon') || document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.id = 'dynamicFavicon';
        link.rel = 'icon';
        link.type = 'image/png';
        document.head.appendChild(link);
      }
      link.href = faviconCanvas.toDataURL('image/png');
    } catch (_) {}
  }

  function updateDocumentTitle() {
    if (state.isRecording) {
      const mm = String(Math.floor(state.recordingSeconds / 60)).padStart(2, '0');
      const ss = String(state.recordingSeconds % 60).padStart(2, '0');
      if (state.isPaused) {
        document.title = `⏸️ Pausado (${mm}:${ss}) • Prontuário APS`;
        updateDynamicFavicon('paused');
      } else {
        document.title = `🔴 Gravando (${mm}:${ss}) • Prontuário APS`;
        updateDynamicFavicon('recording');
      }
    } else if (state.queueRunning && state.activeProcessingProgress) {
      const pct = Math.min(100, Math.max(0, Math.round(state.activeProcessingProgress.percent || 0)));
      document.title = `⏳ ${pct}% Transcrevendo • Prontuário APS`;
      updateDynamicFavicon('transcribing', pct);
    } else if (state.queueRunning) {
      document.title = `⏳ Transcrevendo • Prontuário APS`;
      updateDynamicFavicon('transcribing', 15);
    } else {
      document.title = `🟢 Pronto • Prontuário APS`;
      updateDynamicFavicon('ready');
    }
  }

  async function requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        state.wakeLock = await navigator.wakeLock.request('screen');
      } catch (_) {}
    }
  }

  function releaseWakeLock() {
    if (state.wakeLock) {
      try { state.wakeLock.release(); } catch (_) {}
      state.wakeLock = null;
    }
  }

  async function populateMicrophones() {
    const select = document.getElementById('micSelect');
    if (!select || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(d => d.kind === 'audioinput');
      select.innerHTML = '<option value="">🎤 Microfone Padrão</option>';
      mics.forEach((m, idx) => {
        const opt = document.createElement('option');
        opt.value = m.deviceId;
        opt.textContent = m.label || `Microfone ${idx + 1}`;
        if (m.deviceId === state.selectedMicDeviceId) opt.selected = true;
        select.appendChild(opt);
      });
    } catch (_) {}
  }

  function renderTemplateSelector() {
    const container = document.getElementById('templateGrid');
    const promptHeader = document.getElementById('templatePromptHeader');
    const compactBar = document.getElementById('selectedTemplateCompactBar');
    const btnChange = document.getElementById('btnChangeTemplateModel');
    if (!container) return;

    const activeTpl = state.templates[state.selectedTemplateId] || Object.values(state.templates)[0];

    // Se o médico já selecionou o tipo de consulta ou já está gravando, esconde os outros tipos e a pergunta "Qual atendimento você vai realizar?"
    if (state.templateLocked || state.isRecording) {
      if (promptHeader) promptHeader.style.display = 'none';
      container.style.display = 'none';
      if (compactBar && activeTpl) {
        compactBar.style.display = 'flex';
        const iconEl = document.getElementById('compactTplIcon');
        const nameEl = document.getElementById('compactTplName');
        const subEl = document.getElementById('compactTplSub');
        if (iconEl) iconEl.textContent = activeTpl.icon || '🩺';
        if (nameEl) nameEl.textContent = activeTpl.name;
        if (subEl) subEl.textContent = state.isRecording ? 'Atendimento em andamento' : (activeTpl.badge || 'Modalidade selecionada');
      }
      if (btnChange) {
        btnChange.style.display = state.isRecording ? 'none' : 'inline-flex';
      }
      togglePuericulturaZScorePanel();
      return;
    }

    if (promptHeader) promptHeader.style.display = 'block';
    if (compactBar) compactBar.style.display = 'none';
    container.style.display = 'grid';
    container.innerHTML = '';

    Object.values(state.templates).forEach(tpl => {
      const isSelected = tpl.id === state.selectedTemplateId;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `template-card ${isSelected ? 'active' : ''}`;
      btn.innerHTML = `
        <div class="tpl-left">
          <div class="tpl-icon-box">${tpl.icon || '📋'}</div>
          <div>
            <div class="tpl-name">${tpl.name}</div>
            <div class="tpl-sub">${tpl.badge || 'APS'}</div>
          </div>
        </div>
        <span class="tpl-arrow">›</span>
      `;
      btn.addEventListener('click', () => {
        state.selectedTemplateId = tpl.id;
        state.templateLocked = true;
        renderTemplateSelector();
        togglePuericulturaZScorePanel();
        showToast(`📋 Formato selecionado: ${tpl.name}`);
      });
      container.appendChild(btn);
    });
    togglePuericulturaZScorePanel();
  }

  function getSelectedSoapSubtypeHeader() {
    const selectedRadio = document.querySelector('input[name="soapVisitSubtype"]:checked');
    const mode = selectedRadio ? selectedRadio.value : 'DEMANDA ESPONTÂNEA';
    if (mode === 'CONSULTA AGENDADA - 0800' || mode === 'CONSULTA AGENDADA') {
      return '## CONSULTA AGENDADA - 0800 ##';
    }
    if (mode === 'RETORNO MÉDICO') {
      return '## RETORNO MÉDICO ##';
    }
    return '## DEMANDA ESPONTÂNEA ##';
  }

  function togglePuericulturaZScorePanel() {
    const soapPanel = document.getElementById('geralSoapSubtypeBox');
    const pueriPanel = document.getElementById('puericulturaZScoreBox');
    const pnPanel = document.getElementById('prenatalObjectiveBox');
    if (soapPanel) {
      soapPanel.style.display = state.selectedTemplateId === 'geral' ? 'block' : 'none';
    }
    if (pueriPanel) {
      pueriPanel.style.display = state.selectedTemplateId === 'puericultura' ? 'block' : 'none';
    }
    if (pnPanel) {
      pnPanel.style.display = state.selectedTemplateId === 'prenatal' ? 'block' : 'none';
    }
  }

  // --- Gerenciamento Discreto de PDFs e Imagens de Exames Complementares ---
  function normalizeExamMimeType(file) {
    const raw = (file.type || '').toLowerCase();
    const ext = (file.name || '').toLowerCase().split('.').pop();
    if (raw === 'application/pdf' || ext === 'pdf') return 'application/pdf';
    if (raw.startsWith('image/')) return raw;
    if (ext === 'png') return 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'webp') return 'image/webp';
    return 'application/pdf';
  }

  function addExamFilesToCurrentSession(fileList) {
    if (!fileList || fileList.length === 0) return;
    let added = 0;
    Array.from(fileList).forEach(file => {
      const mime = normalizeExamMimeType(file);
      state.pendingExamFiles.push({
        id: 'tmp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: file.name || `Exame_${state.pendingExamFiles.length + 1}.pdf`,
        mimeType: mime,
        size: file.size,
        blob: file
      });
      added++;
    });
    if (added > 0) {
      renderPendingExamFilesUI();
      updateTokenMonitorUI();
      showToast(`📎 ${added} laudo(s) anexado(s) para incluir na evolução.`);
    }
  }

  function renderPendingExamFilesUI() {
    const listEl = document.getElementById('pendingExamFilesList');
    const countEl = document.getElementById('examCountBadge');
    const btnNow = document.getElementById('btnTranscribeExamsNow');
    if (countEl) {
      countEl.textContent = state.pendingExamFiles.length > 0
        ? `${state.pendingExamFiles.length} anexo(s)`
        : '0';
    }
    if (btnNow) {
      btnNow.style.display = state.pendingExamFiles.length > 0 ? 'inline-flex' : 'none';
    }
    if (!listEl) return;
    if (state.pendingExamFiles.length === 0) {
      listEl.style.display = 'none';
      listEl.innerHTML = '';
      return;
    }
    listEl.style.display = 'flex';
    listEl.innerHTML = '';
    state.pendingExamFiles.forEach(item => {
      const chip = document.createElement('div');
      chip.className = 'exam-chip';
      const kb = Math.max(1, Math.round(item.size / 1024));
      chip.innerHTML = `
        <span>📄 ${escapeHtml(item.name.slice(0, 26))} (${kb} KB)</span>
        <button type="button" class="exam-chip-del" title="Remover anexo">✕</button>
      `;
      chip.querySelector('.exam-chip-del').addEventListener('click', () => {
        state.pendingExamFiles = state.pendingExamFiles.filter(f => f.id !== item.id);
        renderPendingExamFilesUI();
        updateTokenMonitorUI();
      });
      listEl.appendChild(chip);
    });
  }

  // Transcreve os PDFs/imagens anexados IMEDIATAMENTE durante a consulta (sem precisar finalizar a gravação!)
  function updateQuickNotesExamBadge() {
    const quickNotesInput = document.getElementById('quickNotesInput');
    const badge = document.getElementById('quickNotesExamBadge');
    const btnFormat = document.getElementById('btnFormatNotesExamNow');
    const raw = quickNotesInput ? quickNotesInput.value : '';
    const detected = window.detectExamsInText ? window.detectExamsInText(raw) : { hasLab: false, hasImaging: false, hasAny: false };

    if (!badge || !btnFormat) return;
    if (!detected.hasAny) {
      badge.style.display = 'none';
      btnFormat.style.display = 'none';
      return;
    }

    badge.style.display = 'inline-flex';
    btnFormat.style.display = 'inline-flex';
    if (detected.hasLab && detected.hasImaging) {
      badge.textContent = '🧪🖥️ Exames Laboratorial + Imagem detectados (irão formatados p/ EXAMES COMPLEMENTARES)';
      badge.style.background = '#f0fdf4';
      badge.style.color = '#166534';
      badge.style.borderColor = '#86efac';
    } else if (detected.hasLab) {
      badge.textContent = '🧪 Exame Laboratorial detectado -> formato: - LABS DD/MM/AAAA: ... | ...';
      badge.style.background = '#e0f2fe';
      badge.style.color = '#0369a1';
      badge.style.borderColor = '#7dd3fc';
    } else {
      badge.textContent = '🖥️ Exame de Imagem detectado -> formato: - EXAME DD/MM/AAAA: texto corrido';
      badge.style.background = '#f3e8ff';
      badge.style.color = '#6b21a8';
      badge.style.borderColor = '#d8b4fe';
    }
  }

  async function transcribePendingExamsNow() {
    const quickNotesVal = document.getElementById('quickNotesInput')?.value.trim() || '';
    const hasAttachedFiles = state.pendingExamFiles && state.pendingExamFiles.length > 0;
    if (!hasAttachedFiles && !quickNotesVal) {
      showToast('📎 Anexe um PDF/foto de exame ou cole o exame nas Anotações Rápidas primeiro.');
      return;
    }
    const apiKey = getSavedApiKey();
    if (!apiKey) {
      openApiKeyModal();
      return;
    }

    const btnNow = document.getElementById('btnTranscribeExamsNow');
    const btnNotesNow = document.getElementById('btnFormatNotesExamNow');
    const liveBox = document.getElementById('liveExamTranscriptionBox');
    const liveEditor = document.getElementById('liveExamTranscriptionEditor');

    if (liveBox) liveBox.style.display = 'block';
    if (liveEditor) liveEditor.value = '⏳ [10%] Lendo e formatando os exames no padrão Laboratorial (- LABS ... | ...) / Imagem (- EXAME: texto corrido)...';
    if (btnNow) {
      btnNow.disabled = true;
      btnNow.textContent = '⏳ 10% Transcrevendo...';
    }
    if (btnNotesNow) {
      btnNotesNow.disabled = true;
      btnNotesNow.textContent = '⏳ 10% Formatando...';
    }

    let examPct = 10;
    const examTimer = setInterval(() => {
      if (examPct < 92) {
        examPct += Math.max(2, Math.round((94 - examPct) * 0.18));
        if (btnNow && btnNow.disabled) btnNow.textContent = `⏳ ${examPct}% Transcrevendo...`;
        if (btnNotesNow && btnNotesNow.disabled) btnNotesNow.textContent = `⏳ ${examPct}% Formatando...`;
        if (liveEditor && liveEditor.value.startsWith('⏳')) {
          liveEditor.value = `⏳ [${examPct}%] Lendo e organizando resultados laboratoriais e laudos de imagem...`;
        }
      }
    }, 500);

    try {
      const parts = [];
      for (const exam of state.pendingExamFiles) {
        if (exam.blob && exam.blob.size > 0) {
          const mime = exam.mimeType || 'application/pdf';
          if (exam.blob.size > 15 * 1024 * 1024) {
            const fileUri = await uploadLargeFileToGeminiFileAPI(exam.blob, mime, apiKey);
            parts.push({ fileData: { mimeType: mime, fileUri } });
          } else {
            const base64Doc = await blobToBase64(exam.blob);
            parts.push({ inlineData: { mimeType: mime, data: base64Doc } });
          }
        }
      }
      parts.push({ text: window.buildInstantExamTranscriptionPrompt(quickNotesVal) });

      const requestBody = {
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.1 }
      };

      const { responseJson } = await callGeminiWithFallbackAndRetry(requestBody, apiKey);
      clearInterval(examTimer);
      let examText = (responseJson?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
      examText = fixBrazilianMedicationSpelling(examText);

      state.preTranscribedExamsText = examText;
      if (liveEditor) liveEditor.value = examText;

      // Se já houver uma consulta sendo gravada, salva os exames pré-transcritos nela imediatamente
      if (state.recordingConsultationId) {
        const existing = await window.ScribeDB.getConsultation(state.recordingConsultationId);
        if (existing) {
          existing.preTranscribedExamsText = examText;
          await window.ScribeDB.saveConsultation(existing);
        }
      }

      addDailyTokenUsage(responseJson?.usageMetadata?.totalTokenCount || 800);
      showToast('🧪 100% — Exames formatados na hora! Você já pode ler/copiar e eles entrarão em EXAMES COMPLEMENTARES.');
    } catch (err) {
      clearInterval(examTimer);
      if (liveEditor) liveEditor.value = `⚠️ Erro ao formatar exames: ${err.message}`;
    } finally {
      clearInterval(examTimer);
      if (btnNow) {
        btnNow.disabled = false;
        btnNow.textContent = '⚡ Transcrever Anexo na Hora';
      }
      if (btnNotesNow) {
        btnNotesNow.disabled = false;
        btnNotesNow.textContent = '⚡ Formatar Exame das Notas na Hora';
      }
    }
  }

  // --- Gravação Anti-Crash (Streaming de Chunks de 3s direto pro HD/IndexedDB) ---
  function getSupportedAudioMimeType() {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ];
    for (const mime of candidates) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    }
    return '';
  }

  async function startRecording() {
    if (state.isRecording) return;

    try {
      // Configuração de alta sensibilidade para consultório médico:
      // - echoCancellation: false evita que o Chrome corte/abafe a voz mais baixa do(a) paciente sentado(a) mais longe
      //   quando o médico fala "Uhum/Tá" ou digita no teclado (já que não há som saindo da caixa de som durante a gravação).
      // - autoGainControl: true amplifica automaticamente falas baixas ou distantes do microfone.
      const audioConstraints = {
        echoCancellation: false,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1
      };
      if (state.selectedMicDeviceId) {
        audioConstraints.deviceId = { exact: state.selectedMicDeviceId };
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      state.mediaStream = stream;
      await populateMicrophones();

      const mimeType = getSupportedAudioMimeType();
      const recorderOptions = mimeType
        ? { mimeType, audioBitsPerSecond: 64000 }
        : { audioBitsPerSecond: 64000 };

      const recorder = new MediaRecorder(stream, recorderOptions);
      state.mediaRecorder = recorder;

      const patientInput = document.getElementById('patientIdentifier');
      const quickNotesInput = document.getElementById('quickNotesInput');
      const prevConsultInput = document.getElementById('previousConsultationInput');
      const tpl = state.templates[state.selectedTemplateId] || window.DEFAULT_TEMPLATES.geral;
      const now = Date.now();

      let consultId;
      if (state.isContinuingConsultation && state.recordingConsultationId) {
        // Continuação de atendimento do MESMO paciente (após já ter parado/encaminhado a 1ª parte)
        consultId = state.recordingConsultationId;
        const existing = await window.ScribeDB.getConsultation(consultId);
        if (existing) {
          existing.previousEvolutionText = existing.evolutionText || existing.previousEvolutionText || '';
          existing.previousRawTranscript = existing.rawTranscript || existing.previousRawTranscript || '';
          if (prevConsultInput && prevConsultInput.value.trim()) {
            existing.previousConsultationText = prevConsultInput.value.trim();
          }
          existing.soapSubtypeHeader = getSelectedSoapSubtypeHeader();
          await window.ScribeDB.deleteAudioChunksOnly(consultId);
          existing.status = 'recording';
          existing.chunkCount = 0;
          existing.audioDeleted = false;
          existing.mimeType = recorder.mimeType || mimeType || 'audio/webm';
          existing.updatedAt = now;
          await window.ScribeDB.saveConsultation(existing);
        }
      } else {
        consultId = 'cons_' + now + '_' + Math.random().toString(36).slice(2, 6);
        const newConsultation = {
          id: consultId,
          patientLabel: (patientInput && patientInput.value.trim()) || `Atendimento ${new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
          templateId: tpl.id,
          templateName: tpl.name,
          templateIcon: tpl.icon,
          soapSubtypeHeader: getSelectedSoapSubtypeHeader(),
          createdAt: now,
          updatedAt: now,
          status: 'recording',
          durationSeconds: 0,
          chunkCount: 0,
          examFileCount: 0,
          audioBytes: 0,
          mimeType: recorder.mimeType || mimeType || 'audio/webm',
          quickNotes: (quickNotesInput && quickNotesInput.value) || '',
          previousConsultationText: (prevConsultInput && prevConsultInput.value.trim()) || '',
          preTranscribedExamsText: state.preTranscribedExamsText || '',
          zScoreSummary: getCalculatedZScoreText(),
          evolutionText: '',
          soapParts: null,
          referralText: '',
          auditAlerts: [],
          tokensUsed: 0,
          errorMessage: ''
        };
        await window.ScribeDB.saveConsultation(newConsultation);
      }

      state.recordingConsultationId = consultId;
      state.isRecording = true;
      state.isPaused = false;
      state.recordingSeconds = 0;
      state.silenceSeconds = 0;
      state.chunkIndex = 0;
      state.lastChunkSavePromise = Promise.resolve();

      // Alerta caso o cabo do microfone desconecte no meio da consulta
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.onended = () => {
          if (state.isRecording) {
            const silenceBanner = document.getElementById('silenceWarningBanner');
            if (silenceBanner) {
              silenceBanner.style.display = 'flex';
              silenceBanner.innerHTML = `<span>⚠️ Microfone desconectado! Reconecte ou salve a folha atual.</span>`;
            }
          }
        };
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          const idx = state.chunkIndex++;
          const blobChunk = event.data;
          const chunkMime = recorder.mimeType || mimeType || 'audio/webm';
          state.lastChunkSavePromise = state.lastChunkSavePromise.then(async () => {
            try {
              await window.ScribeDB.saveAudioChunk(consultId, idx, blobChunk, chunkMime);
              const diskBadge = document.getElementById('diskSaveIndicator');
              if (diskBadge) {
                diskBadge.textContent = `💾 Sincronizado no disco (${idx + 1})`;
                diskBadge.classList.add('pulse-ok');
                setTimeout(() => diskBadge.classList.remove('pulse-ok'), 600);
              }
            } catch (err) {
              console.error('Erro ao salvar chunk no disco:', err);
            }
          });
        }
      };

      recorder.start(3000);
      showToast(`🎙️ Gravando atendimento: ${tpl.name}`);
      state.templateLocked = true;
      renderTemplateSelector();
      state.timerWorker.postMessage('start');
      await requestWakeLock();
      startVUMeterAndSilenceDetector(stream);
      updateRecordingControlsUI();
      updateDocumentTitle();
      await refreshQueueSidebar();
    } catch (err) {
      alert('Não foi possível acessar o microfone. Verifique se está conectado e com permissão liberada.\n\nDetalhe: ' + err.message);
    }
  }

  function togglePauseRecording() {
    if (!state.isRecording || !state.mediaRecorder) return;
    if (state.isPaused) {
      state.mediaRecorder.resume();
      state.isPaused = false;
      state.silenceSeconds = 0;
    } else {
      state.mediaRecorder.pause();
      state.isPaused = true;
    }
    updateRecordingControlsUI();
    updateDocumentTitle();
  }

  function resetCurrentConsultationFormFields() {
    state.templateLocked = false;
    state.selectedTemplateId = 'geral';
    state.pendingExamFiles = [];
    state.preTranscribedExamsText = '';

    const patientInput = document.getElementById('patientIdentifier');
    const quickNotesInput = document.getElementById('quickNotesInput');
    const prevConsultInput = document.getElementById('previousConsultationInput');
    const liveBox = document.getElementById('liveExamTranscriptionBox');
    const liveEditor = document.getElementById('liveExamTranscriptionEditor');

    if (patientInput) patientInput.value = '';
    if (quickNotesInput) quickNotesInput.value = '';
    if (prevConsultInput) prevConsultInput.value = '';
    if (liveBox) liveBox.style.display = 'none';
    if (liveEditor) liveEditor.value = '';

    const defaultRadio = document.querySelector('input[name="soapVisitSubtype"][value="DEMANDA ESPONTÂNEA"]');
    if (defaultRadio) defaultRadio.checked = true;

    clearZScoreInputs();
    renderPendingExamFilesUI();
    renderTemplateSelector();
    updateQuickNotesExamBadge();
  }

  async function clearAllCurrentSheet() {
    if (state.isRecording) {
      await cancelCurrentRecording();
      return;
    }

    const patientInput = document.getElementById('patientIdentifier');
    const quickNotesInput = document.getElementById('quickNotesInput');
    const prevConsultInput = document.getElementById('previousConsultationInput');
    const hasAnyData = Boolean(
      (patientInput && patientInput.value.trim()) ||
      (quickNotesInput && quickNotesInput.value.trim()) ||
      (prevConsultInput && prevConsultInput.value.trim()) ||
      (state.pendingExamFiles && state.pendingExamFiles.length > 0) ||
      state.preTranscribedExamsText
    );

    if (hasAnyData) {
      const ok = confirm('🧹 Deseja limpar todos os campos, anexos e anotações preenchidos nesta tela?');
      if (!ok) return;
    }

    resetCurrentConsultationFormFields();
    updateTokenMonitorUI();
    showToast('🧹 Tudo limpo! Tela pronta para o próximo atendimento.');
  }

  // Cancela e exclui a gravação em andamento (com confirmação de segurança) e limpa todos os campos
  async function cancelCurrentRecording() {
    if (!state.isRecording || !state.mediaRecorder) return;

    // Se ainda não estava pausado, pausa preventivamente enquanto pergunta
    const wasPaused = state.isPaused;
    if (!wasPaused) {
      try {
        state.mediaRecorder.pause();
        state.isPaused = true;
        updateRecordingControlsUI();
      } catch (_) {}
    }

    const confirmed = confirm(
      '⚠️ CONFIRMAÇÃO DE EXCLUSÃO:\n\nTem certeza que deseja CANCELAR a gravação e LIMPAR todos os dados deste atendimento?\n\nTodo o áudio e os campos preenchidos nesta folha serão descartados.'
    );

    if (!confirmed) {
      // Se o médico desistiu de cancelar e antes estava gravando, pode retomar ou manter pausado
      return;
    }

    const cancelingId = state.recordingConsultationId;

    await new Promise((resolve) => {
      state.mediaRecorder.onstop = () => resolve();
      try {
        state.mediaRecorder.stop();
      } catch (_) {
        resolve();
      }
    });
    if (state.lastChunkSavePromise) {
      try { await state.lastChunkSavePromise; } catch (_) {}
    }

    stopStreamAndMeters();
    state.timerWorker.postMessage('stop');
    releaseWakeLock();

    const wasContinuing = state.isContinuingConsultation;
    state.isRecording = false;
    state.isPaused = false;
    state.isContinuingConsultation = false;
    state.recordingConsultationId = null;
    state.recordingSeconds = 0;

    resetCurrentConsultationFormFields();
    updateRecordingControlsUI();
    updateRecordingTimerUI();
    updateTokenMonitorUI();
    updateDocumentTitle();

    if (cancelingId) {
      if (wasContinuing) {
        // Se estava apenas gravando uma continuação e desistiu, restaura a 1ª parte intacta!
        const existing = await window.ScribeDB.getConsultation(cancelingId);
        if (existing && existing.previousEvolutionText) {
          await window.ScribeDB.deleteAudioChunksOnly(cancelingId);
          existing.evolutionText = existing.previousEvolutionText;
          existing.status = 'done';
          await window.ScribeDB.saveConsultation(existing);
        }
      } else {
        await window.ScribeDB.deleteConsultation(cancelingId);
      }
    }

    await refreshQueueSidebar();
    updateStorageStatsUI();
    showToast('🧹 Atendimento cancelado e todos os campos limpos!');
  }

  async function finishRecordingAndQueue() {
    if (!state.isRecording || !state.mediaRecorder) return;

    const finishingId = state.recordingConsultationId;
    const finalSeconds = state.recordingSeconds;
    const patientInput = document.getElementById('patientIdentifier');
    const quickNotesInput = document.getElementById('quickNotesInput');
    const prevConsultInput = document.getElementById('previousConsultationInput');
    const currentLabel = patientInput ? patientInput.value.trim() : '';
    const currentNotes = quickNotesInput ? quickNotesInput.value : '';
    const currentPrevConsult = prevConsultInput ? prevConsultInput.value.trim() : '';
    const liveExamEditor = document.getElementById('liveExamTranscriptionEditor');
    const currentPreTranscribedExams = (liveExamEditor && liveExamEditor.value && !liveExamEditor.value.startsWith('⏳') && !liveExamEditor.value.startsWith('⚠️'))
      ? liveExamEditor.value.trim()
      : (state.preTranscribedExamsText || '');
    const currentZScore = getCalculatedZScoreText();
    const currentTpl = state.templates[state.selectedTemplateId];
    const attachedExams = [...state.pendingExamFiles];

    await new Promise((resolve) => {
      state.mediaRecorder.onstop = () => resolve();
      try {
        if (state.mediaRecorder.state === 'recording') {
          state.mediaRecorder.requestData();
        }
        state.mediaRecorder.stop();
      } catch (_) {
        resolve();
      }
    });
    if (state.lastChunkSavePromise) {
      try { await state.lastChunkSavePromise; } catch (_) {}
    }

    stopStreamAndMeters();
    state.timerWorker.postMessage('stop');
    releaseWakeLock();

    state.isRecording = false;
    state.isPaused = false;
    state.isContinuingConsultation = false;
    state.templateLocked = false;
    state.selectedTemplateId = 'geral'; // Reseta com segurança para Consulta Geral (SOAP) para o próximo atendimento
    state.recordingConsultationId = null;
    state.recordingSeconds = 0;
    state.pendingExamFiles = [];
    state.preTranscribedExamsText = '';
    const liveBox = document.getElementById('liveExamTranscriptionBox');
    if (liveBox) liveBox.style.display = 'none';
    if (liveExamEditor) liveExamEditor.value = '';
    const defaultRadio = document.querySelector('input[name="soapVisitSubtype"][value="DEMANDA ESPONTÂNEA"]');
    if (defaultRadio) defaultRadio.checked = true;
    renderPendingExamFilesUI();
    renderTemplateSelector();
    updateRecordingControlsUI();
    updateRecordingTimerUI();
    updateDocumentTitle();

    // Salva todos os PDFs/imagens de exames anexados durante a consulta
    for (const examFile of attachedExams) {
      await window.ScribeDB.saveExamFile(finishingId, examFile);
    }

    const consult = await window.ScribeDB.getConsultation(finishingId);
    if (consult) {
      if (currentLabel) consult.patientLabel = currentLabel;
      consult.templateId = currentTpl.id;
      consult.templateName = currentTpl.name;
      consult.templateIcon = currentTpl.icon;
      consult.soapSubtypeHeader = getSelectedSoapSubtypeHeader();
      consult.durationSeconds = finalSeconds;
      consult.examFileCount = attachedExams.length;
      consult.quickNotes = currentNotes;
      if (currentPrevConsult) consult.previousConsultationText = currentPrevConsult;
      if (currentPreTranscribedExams) consult.preTranscribedExamsText = currentPreTranscribedExams;
      consult.zScoreSummary = currentZScore;
      consult.status = 'queued';
      consult.updatedAt = Date.now();
      await window.ScribeDB.saveConsultation(consult);

      if (window.ScribeDB.hasPhysicalFolder()) {
        const fullBlob = await window.ScribeDB.assembleAudioBlob(finishingId, consult.mimeType);
        await window.ScribeDB.saveBackupToPhysicalFolder(consult, fullBlob);
      }
    }

    if (patientInput) patientInput.value = '';
    if (quickNotesInput) quickNotesInput.value = '';
    if (prevConsultInput) prevConsultInput.value = '';
    clearZScoreInputs();

    showToast('✅ Atendimento salvo e enviado para o Histórico! Tela pronta para o próximo paciente.');
    await refreshQueueSidebar();
    updateStorageStatsUI();

    processQueueInBackground();
  }

  function stopStreamAndMeters() {
    if (state.vuAnimationFrame) {
      cancelAnimationFrame(state.vuAnimationFrame);
      state.vuAnimationFrame = null;
    }
    if (state.audioContext) {
      try { state.audioContext.close(); } catch (_) {}
      state.audioContext = null;
    }
    if (state.mediaStream) {
      state.mediaStream.getTracks().forEach(t => t.stop());
      state.mediaStream = null;
    }
    const vuFill = document.getElementById('vuMeterFill');
    if (vuFill) vuFill.style.width = '0%';
    const silenceAlert = document.getElementById('silenceWarningBanner');
    if (silenceAlert) silenceAlert.style.display = 'none';
  }

  function startVUMeterAndSilenceDetector(stream) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      state.audioContext = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      state.analyser = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let lastSecondCheck = Date.now();

      function tickVU() {
        if (!state.isRecording) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        const pct = Math.min(100, Math.round((avg / 90) * 100));

        const vuFill = document.getElementById('vuMeterFill');
        if (vuFill) {
          // Barrinha de áudio se move em tempo real com a voz para confirmar que está captando o som
          vuFill.style.width = state.isPaused ? '0%' : `${Math.max(4, pct)}%`;
          vuFill.style.backgroundColor = pct > 35 ? '#10b981' : '#3b82f6';
        }

        const now = Date.now();
        if (now - lastSecondCheck >= 1000) {
          lastSecondCheck = now;
          if (!state.isPaused) {
            if (pct < 3) {
              state.silenceSeconds++;
            } else {
              state.silenceSeconds = 0;
            }
            const silenceBanner = document.getElementById('silenceWarningBanner');
            if (silenceBanner) {
              // NUNCA pausa sozinho para não correr risco de perder a fala final do médico (ex.: prescrição)!
              if (state.silenceSeconds >= 20) {
                silenceBanner.style.display = 'flex';
                silenceBanner.innerHTML = `<span>⚠️ Sinal de áudio muito baixo — verifique se o microfone não está no mudo.</span>`;
              } else {
                silenceBanner.style.display = 'none';
              }
            }
          }
        }

        state.vuAnimationFrame = requestAnimationFrame(tickVU);
      }
      tickVU();
    } catch (_) {}
  }

  function normalizeAudioMimeType(fileOrBlob, fileName = '') {
    const rawType = (fileOrBlob?.type || '').toLowerCase().split(';')[0].trim();
    const ext = (fileName || '').toLowerCase().split('.').pop();

    if (ext === 'ogg' || ext === 'opus' || rawType.includes('ogg') || rawType.includes('opus')) {
      return 'audio/ogg';
    }
    if (ext === 'm4a' || ext === 'mp4' || ext === 'aac' || rawType.includes('mp4') || rawType.includes('m4a') || rawType.includes('aac')) {
      return 'audio/mp4';
    }
    if (ext === 'mp3' || rawType.includes('mpeg') || rawType.includes('mp3')) {
      return 'audio/mp3';
    }
    if (ext === 'wav' || rawType.includes('wav')) {
      return 'audio/wav';
    }
    if (rawType && rawType.startsWith('audio/')) {
      return rawType;
    }
    return 'audio/webm';
  }

  async function handleExternalAudioUpload(fileList) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const patientInput = document.getElementById('patientIdentifier');
    const quickNotesInput = document.getElementById('quickNotesInput');
    const prevConsultInput = document.getElementById('previousConsultationInput');
    const tpl = state.templates[state.selectedTemplateId];
    const baseLabel = patientInput ? patientInput.value.trim() : '';
    const currentNotes = (quickNotesInput && quickNotesInput.value) || '';
    const currentPrevConsult = (prevConsultInput && prevConsultInput.value.trim()) || '';
    const liveExamEditor = document.getElementById('liveExamTranscriptionEditor');
    const currentPreTranscribedExams = (liveExamEditor && liveExamEditor.value && !liveExamEditor.value.startsWith('⏳') && !liveExamEditor.value.startsWith('⚠️'))
      ? liveExamEditor.value.trim()
      : (state.preTranscribedExamsText || '');
    const currentZScore = getCalculatedZScoreText();
    const attachedExams = [...state.pendingExamFiles];

    let lastCreatedId = null;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const now = Date.now() + i;
      const consultId = 'cons_' + now + '_up' + i;
      const cleanMime = normalizeAudioMimeType(file, file.name);
      const cleanFileName = file.name.replace(/\.[^.]+$/, '').replace(/WhatsApp Ptt /i, 'Visita ');

      const label = files.length === 1
        ? (baseLabel || cleanFileName)
        : (baseLabel ? `${baseLabel} (${i + 1})` : cleanFileName);

      const newConsultation = {
        id: consultId,
        patientLabel: label,
        templateId: tpl.id,
        templateName: tpl.name,
        templateIcon: tpl.icon,
        soapSubtypeHeader: getSelectedSoapSubtypeHeader(),
        createdAt: now,
        updatedAt: now,
        status: 'queued',
        durationSeconds: Math.max(5, Math.round(file.size / 3000)),
        chunkCount: 1,
        examFileCount: i === 0 ? attachedExams.length : 0,
        audioBytes: file.size,
        mimeType: cleanMime,
        fileName: file.name,
        quickNotes: currentNotes,
        previousConsultationText: currentPrevConsult,
        preTranscribedExamsText: i === 0 ? currentPreTranscribedExams : '',
        zScoreSummary: currentZScore,
        evolutionText: '',
        soapParts: null,
        referralText: '',
        auditAlerts: [],
        tokensUsed: 0,
        errorMessage: ''
      };

      await window.ScribeDB.saveConsultation(newConsultation);
      await window.ScribeDB.saveAudioChunk(consultId, 0, file, cleanMime);

      if (i === 0 && attachedExams.length > 0) {
        for (const exam of attachedExams) {
          await window.ScribeDB.saveExamFile(consultId, exam);
        }
      }
      lastCreatedId = consultId;
    }

    state.pendingExamFiles = [];
    state.preTranscribedExamsText = '';
    const liveBox = document.getElementById('liveExamTranscriptionBox');
    if (liveBox) liveBox.style.display = 'none';
    if (liveExamEditor) liveExamEditor.value = '';
    renderPendingExamFilesUI();
    if (patientInput) patientInput.value = '';
    if (quickNotesInput) quickNotesInput.value = '';
    if (prevConsultInput) prevConsultInput.value = '';
    updateQuickNotesExamBadge();
    showToast(`📂 ${files.length} áudio(s) importado(s) para a fila!`);
    await refreshQueueSidebar();
    if (lastCreatedId) {
      await selectConsultationToView(lastCreatedId);
    }
    processQueueInBackground();
  }

  // --- Processar apenas Laudos PDF Anexados e/ou Notas Rápidas (Sem Áudio) ---
  async function handleProcessNotesOrExamsOnly() {
    const quickNotesInput = document.getElementById('quickNotesInput');
    const prevConsultInput = document.getElementById('previousConsultationInput');
    const notes = quickNotesInput ? quickNotesInput.value.trim() : '';
    const prevConsultText = prevConsultInput ? prevConsultInput.value.trim() : '';
    const attachedExams = [...state.pendingExamFiles];

    const liveExamEditor = document.getElementById('liveExamTranscriptionEditor');
    const currentPreTranscribedExams = (liveExamEditor && liveExamEditor.value && !liveExamEditor.value.startsWith('⏳') && !liveExamEditor.value.startsWith('⚠️'))
      ? liveExamEditor.value.trim()
      : (state.preTranscribedExamsText || '');

    if (!notes && attachedExams.length === 0 && !prevConsultText && !currentPreTranscribedExams) {
      alert('Anexe pelo menos um PDF/imagem de exame ou digite os dados clínicos no campo de Notas Rápidas.');
      return;
    }

    const patientInput = document.getElementById('patientIdentifier');
    const tpl = state.templates[state.selectedTemplateId];
    const now = Date.now();
    const consultId = 'cons_' + now + '_txt';

    const newConsultation = {
      id: consultId,
      patientLabel: (patientInput && patientInput.value.trim()) || `Atendimento ${new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      templateId: tpl.id,
      templateName: tpl.name,
      templateIcon: tpl.icon,
      soapSubtypeHeader: getSelectedSoapSubtypeHeader(),
      createdAt: now,
      updatedAt: now,
      status: 'queued',
      durationSeconds: 0,
      chunkCount: 0,
      examFileCount: attachedExams.length,
      audioBytes: 0,
      mimeType: 'text/plain',
      quickNotes: notes,
      previousConsultationText: prevConsultText,
      preTranscribedExamsText: currentPreTranscribedExams,
      zScoreSummary: getCalculatedZScoreText(),
      evolutionText: '',
      soapParts: null,
      referralText: '',
      auditAlerts: [],
      tokensUsed: 0,
      errorMessage: ''
    };

    await window.ScribeDB.saveConsultation(newConsultation);
    for (const exam of attachedExams) {
      await window.ScribeDB.saveExamFile(consultId, exam);
    }

    state.pendingExamFiles = [];
    state.preTranscribedExamsText = '';
    const liveBox = document.getElementById('liveExamTranscriptionBox');
    if (liveBox) liveBox.style.display = 'none';
    if (liveExamEditor) liveExamEditor.value = '';
    renderPendingExamFilesUI();
    if (patientInput) patientInput.value = '';
    if (quickNotesInput) quickNotesInput.value = '';
    if (prevConsultInput) prevConsultInput.value = '';
    updateQuickNotesExamBadge();
    showToast('📄 Laudos / Notas enviados para a fila de estruturação!');
    await refreshQueueSidebar();
    await selectConsultationToView(consultId);
    processQueueInBackground();
  }

  // Atualiza em tempo real todos os indicadores visuais de porcentagem (0% a 100%) e etapa de transcrição/organização
  function getStageDescriptionForPercent(pct) {
    if (pct < 12) return '📦 Lendo áudio gravado no disco local...';
    if (pct < 22) return '📄 Preparando anexos, evolução anterior e máscara...';
    if (pct < 56) return '🎙️ Transcrevendo diálogo completo da consulta...';
    if (pct < 78) return '📋 Organizando # Condições, Subjetivo e Objetivo...';
    if (pct < 93) return '💊 Estruturando Exames, Avaliação e Conduta...';
    if (pct < 100) return '🏷️ Validando cabeçalho, exames anteriores e CIAP-2 / CID-10...';
    return '✅ Evolução 100% transcrita e organizada!';
  }

  function updateLiveProcessingUI(progressObj) {
    state.activeProcessingProgress = progressObj;
    updateDocumentTitle();

    const banner = document.getElementById('liveProcessingBanner');
    const bannerText = document.getElementById('liveProcessingText');
    const pctBadge = document.getElementById('liveProcessingPercentBadge');
    const barWrap = document.getElementById('liveProcessingBarWrap');
    const barFill = document.getElementById('liveProcessingBarFill');
    const spinner = document.getElementById('liveProcSpinner');

    if (!progressObj) {
      return;
    }

    const pct = Math.min(100, Math.max(0, Math.round(progressObj.percent || 0)));
    const stageText = progressObj.stageLabel || getStageDescriptionForPercent(pct);
    const extraQueue = progressObj.extraQueueCount > 0 ? ` (+${progressObj.extraQueueCount} na fila)` : '';
    const modelSuffix = progressObj.modelStatus ? ` • ${progressObj.modelStatus}` : '';

    // 1. Atualiza a barra fixa no topo da tela
    if (banner && bannerText) {
      banner.style.display = 'block';
      banner.style.background = '#eef2ff';
      banner.style.color = '#3730a3';
      if (spinner) spinner.style.display = 'inline-block';
      if (pctBadge) {
        pctBadge.style.display = 'inline-block';
        pctBadge.style.background = '#4f46e5';
        pctBadge.textContent = `${pct}%`;
      }
      if (barWrap) barWrap.style.display = 'block';
      if (barFill) barFill.style.width = `${pct}%`;
      bannerText.textContent = `${stageText} "${progressObj.patientLabel}" (${progressObj.elapsedSec || 0}s)${modelSuffix}${extraQueue}`;
    }

    // 2. Atualiza o card do paciente em "Meu Histórico"
    const cardStatusEl = document.getElementById(`qstatus_${progressObj.consultId}`);
    if (cardStatusEl) {
      cardStatusEl.textContent = `⚡ ${pct}% — ${stageText.replace(/^[^\s]+\s*/, '')}`;
    }
    const cardBarWrap = document.getElementById(`qbar_wrap_${progressObj.consultId}`);
    const cardBarFill = document.getElementById(`qbar_fill_${progressObj.consultId}`);
    if (cardBarWrap && cardBarFill) {
      cardBarWrap.style.display = 'block';
      cardBarFill.style.width = `${pct}%`;
    }
    const cardSnippetEl = document.getElementById(`qsnippet_${progressObj.consultId}`);
    if (cardSnippetEl) {
      cardSnippetEl.textContent = `${stageText} (${pct}% concluído • ${progressObj.elapsedSec || 0}s)`;
    }

    // 3. Atualiza o painel de progresso dentro da janela do paciente (se estiver aberta)
    if (state.activeConsultationId === progressObj.consultId) {
      const modalBox = document.getElementById('modalLiveProgressBox');
      const modalStage = document.getElementById('modalProgressStageText');
      const modalPct = document.getElementById('modalProgressPercentText');
      const modalFill = document.getElementById('modalProgressBarFill');
      const modalSteps = document.getElementById('modalProgressStepsRow');
      const editor = document.getElementById('mainEvolutionEditor');

      if (modalBox) modalBox.style.display = 'block';
      if (modalStage) modalStage.textContent = `${stageText}${modelSuffix}`;
      if (modalPct) modalPct.textContent = `${pct}%`;
      if (modalFill) modalFill.style.width = `${pct}%`;
      if (modalSteps) {
        const steps = [
          { label: '1. Áudio & Anexos', done: pct >= 20, active: pct < 20 },
          { label: '2. Transcrição da Fala', done: pct >= 56, active: pct >= 20 && pct < 56 },
          { label: '3. # Condições, Subjetivo & Objetivo', done: pct >= 78, active: pct >= 56 && pct < 78 },
          { label: '4. Exames, Avaliação & Conduta', done: pct >= 93, active: pct >= 78 && pct < 93 },
          { label: '5. Revisão Final & CIAP/CID', done: pct >= 100, active: pct >= 93 && pct < 100 }
        ];
        modalSteps.innerHTML = steps.map(s => {
          const icon = s.done ? '✅' : (s.active ? '⏳' : '⚪');
          const bg = s.done ? '#dcfce7' : (s.active ? '#e0e7ff' : '#f1f5f9');
          const col = s.done ? '#166534' : (s.active ? '#3730a3' : '#64748b');
          return `<span style="background:${bg};color:${col};padding:3px 8px;border-radius:99px;">${icon} ${s.label}</span>`;
        }).join('');
      }
      if (editor) {
        editor.value = `⏳ [${pct}% CONCLUÍDO] ${stageText}\nTempo decorrido: ${progressObj.elapsedSec || 0}s${modelSuffix}\n\nAguarde alguns instantes — a evolução organizada aparecerá nesta tela automaticamente assim que chegar em 100% (não precisa clicar em Atualizar).`;
      }
    }
  }

  // --- FILA ASSÍNCRONA EM SEGUNDO PLANO ---
  async function processQueueInBackground() {
    if (state.queueRunning) return;
    const apiKey = getSavedApiKey();
    if (!apiKey) {
      openApiKeyModal();
      return;
    }

    state.queueRunning = true;
    updateDocumentTitle();

    const banner = document.getElementById('liveProcessingBanner');
    const bannerText = document.getElementById('liveProcessingText');
    const pctBadge = document.getElementById('liveProcessingPercentBadge');
    const barWrap = document.getElementById('liveProcessingBarWrap');
    const barFill = document.getElementById('liveProcessingBarFill');
    const spinner = document.getElementById('liveProcSpinner');
    let elapsedSec = 0;
    let procInterval = null;

    try {
      while (true) {
        const all = await window.ScribeDB.getAllConsultations();
        const queuedItems = [...all].reverse().filter(c => c.status === 'queued');
        const nextItem = queuedItems[0];
        if (!nextItem) break;

        nextItem.status = 'uploading';
        nextItem.errorMessage = '';
        await window.ScribeDB.saveConsultation(nextItem);
        await refreshQueueSidebar();

        elapsedSec = 0;
        const extraQueueCount = Math.max(0, queuedItems.length - 1);
        // Tempo estimado adaptativo conforme a duração da gravação e quantidade de exames anexados
        const estTotalSec = Math.max(10, Math.min(35, Math.round((nextItem.durationSeconds || 60) / 28) + 9 + (nextItem.examFileCount || 0) * 3));

        updateLiveProcessingUI({
          consultId: nextItem.id,
          patientLabel: nextItem.patientLabel,
          percent: 5,
          stageLabel: getStageDescriptionForPercent(5),
          elapsedSec: 0,
          extraQueueCount,
          modelStatus: ''
        });

        if (state.activeConsultationId === nextItem.id) {
          await renderActiveConsultationView(nextItem);
        }

        if (procInterval) clearInterval(procInterval);
        procInterval = setInterval(() => {
          elapsedSec += 0.5;
          const prevPct = state.activeProcessingProgress?.percent || 5;
          // Curva assintótica suave até 94% enquanto aguarda a conclusão da IA
          const timeRatio = elapsedSec / estTotalSec;
          const targetByTime = Math.min(94, Math.round(18 + 76 * (1 - Math.exp(-1.55 * timeRatio))));
          const nextPct = Math.min(94, Math.max(prevPct, targetByTime));
          updateLiveProcessingUI({
            consultId: nextItem.id,
            patientLabel: nextItem.patientLabel,
            percent: nextPct,
            stageLabel: getStageDescriptionForPercent(nextPct),
            elapsedSec: Math.floor(elapsedSec),
            extraQueueCount,
            modelStatus: state.activeProcessingProgress?.modelStatus || ''
          });
        }, 500);

        try {
          const result = await processSingleConsultationWithGemini(nextItem, apiKey, (milestonePct, customStage, modelInfo) => {
            const currentPct = Math.max(state.activeProcessingProgress?.percent || 0, milestonePct || 0);
            updateLiveProcessingUI({
              consultId: nextItem.id,
              patientLabel: nextItem.patientLabel,
              percent: currentPct,
              stageLabel: customStage || getStageDescriptionForPercent(currentPct),
              elapsedSec: Math.floor(elapsedSec),
              extraQueueCount,
              modelStatus: modelInfo !== undefined ? modelInfo : (state.activeProcessingProgress?.modelStatus || '')
            });
          });
          if (procInterval) clearInterval(procInterval);

          updateLiveProcessingUI({
            consultId: nextItem.id,
            patientLabel: nextItem.patientLabel,
            percent: 100,
            stageLabel: '✅ Evolução 100% transcrita e organizada!',
            elapsedSec: Math.max(1, Math.round(elapsedSec)),
            extraQueueCount,
            modelStatus: ''
          });

          nextItem.status = 'done';
          nextItem.evolutionText = result.evolutionText;
          nextItem.cidCiapCodes = result.cidCiapCodes || [];
          nextItem.rawTranscript = nextItem.previousRawTranscript
            ? `${nextItem.previousRawTranscript}\n\n--- [CONTINUAÇÃO DO ATENDIMENTO] ---\n${result.rawTranscript || ''}`
            : (result.rawTranscript || '');
          nextItem.previousEvolutionText = '';
          nextItem.previousRawTranscript = '';
          nextItem.soapParts = result.soapParts;
          nextItem.auditAlerts = result.auditAlerts || [];
          nextItem.suggestedSpecialty = result.suggestedSpecialty || '';
          nextItem.tokensUsed = result.tokensUsed || 0;
          nextItem.modelUsed = result.modelUsed || '';
          nextItem.updatedAt = Date.now();
          await window.ScribeDB.saveConsultation(nextItem);

          addDailyTokenUsage(result.tokensUsed || 0);
          showToast(`✅ 100% — Evolução pronta: ${nextItem.patientLabel}`);

          if (state.autoCloudSync) {
            pushConsultationsToGeminiCloud(true).catch(() => {});
          }

          if (banner && bannerText) {
            banner.style.background = '#dcfce7';
            banner.style.color = '#166534';
            if (spinner) spinner.style.display = 'none';
            if (pctBadge) {
              pctBadge.style.background = '#166534';
              pctBadge.textContent = '100%';
            }
            if (barFill) barFill.style.width = '100%';
            bannerText.innerHTML = `✅ Prontuário de <strong>${escapeHtml(nextItem.patientLabel)}</strong> 100% concluído em ${Math.max(1, Math.round(elapsedSec))}s! <button type="button" id="btnBannerOpenFinished" style="margin-left:10px;padding:3px 10px;border-radius:6px;border:1px solid #166534;background:#fff;color:#166534;font-weight:700;cursor:pointer;">Abrir Evolução Agora</button>`;
            document.getElementById('btnBannerOpenFinished')?.addEventListener('click', () => {
              selectConsultationToView(nextItem.id);
            });
            setTimeout(() => {
              if (!state.queueRunning && banner) banner.style.display = 'none';
            }, 8000);
          }
        } catch (err) {
          if (procInterval) clearInterval(procInterval);
          console.error('Erro ao processar consulta na fila:', err);
          nextItem.status = 'error';
          nextItem.errorMessage = err.message || 'Falha na conexão ou limite da API';
          nextItem.updatedAt = Date.now();
          await window.ScribeDB.saveConsultation(nextItem);
          if (banner && bannerText) {
            banner.style.background = '#fee2e2';
            banner.style.color = '#991b1b';
            if (spinner) spinner.style.display = 'none';
            if (pctBadge) {
              pctBadge.style.background = '#dc2626';
              pctBadge.textContent = 'Pausa';
            }
            if (barWrap) barWrap.style.display = 'none';
            bannerText.innerHTML = `⚠️ Pausa no envio de "<strong>${escapeHtml(nextItem.patientLabel)}</strong>": ${escapeHtml(nextItem.errorMessage)} <button type="button" id="btnBannerRetryNow" style="margin-left:10px;padding:3px 10px;border-radius:6px;border:1px solid #991b1b;background:#fff;color:#991b1b;font-weight:700;cursor:pointer;">Reenviar Agora</button>`;
            document.getElementById('btnBannerRetryNow')?.addEventListener('click', async () => {
              nextItem.status = 'queued';
              nextItem.errorMessage = '';
              if (nextItem.chunkCount > 0) nextItem.rawTranscript = '';
              await window.ScribeDB.saveConsultation(nextItem);
              await refreshQueueSidebar();
              processQueueInBackground();
            });
          }
        }

        state.activeProcessingProgress = null;
        await refreshQueueSidebar();
        if (state.activeConsultationId === nextItem.id) {
          const updated = await window.ScribeDB.getConsultation(nextItem.id);
          await renderActiveConsultationView(updated);
        }
      }
    } finally {
      if (procInterval) clearInterval(procInterval);
      state.activeProcessingProgress = null;
      state.queueRunning = false;
      updateDocumentTitle();
    }
  }

  // --- Envio Multimodal (Áudio + PDFs de Exames + Notas) para o Gemini ---
  async function processSingleConsultationWithGemini(consultation, apiKey, onProgressMilestone) {
    const tpl = state.templates[consultation.templateId] || window.DEFAULT_TEMPLATES.geral;
    const examFiles = await window.ScribeDB.getExamFilesForConsultation(consultation.id);
    const preExams = consultation.preTranscribedExamsText || '';
    const soapSubtypeHeader = consultation.soapSubtypeHeader || getSelectedSoapSubtypeHeader();

    if (onProgressMilestone) onProgressMilestone(8, '📦 Lendo áudio gravado no disco local...');

    const isPrenatalConsult = consultation.templateId === 'prenatal';
    const hasNotesExams = window.detectExamsInText ? window.detectExamsInText(consultation.quickNotes).hasAny : false;

    // 1. Prepara o Áudio da consulta (local, na nuvem via remoteFileUri, ou transcrição literal salva)
    let hasAudioAttached = false;
    let audioPart = null;
    if (consultation.chunkCount > 0 && !consultation.audioDeleted) {
      const audioBlob = await window.ScribeDB.assembleAudioBlob(consultation.id, consultation.mimeType);
      if (audioBlob && audioBlob.size > 0) {
        hasAudioAttached = true;
        const cleanMime = normalizeAudioMimeType(audioBlob, consultation.fileName || '');
        if (audioBlob.size > 12 * 1024 * 1024) {
          if (onProgressMilestone) onProgressMilestone(14, '☁️ Enviando arquivo de áudio longo...');
          const fileUri = await uploadLargeFileToGeminiFileAPI(audioBlob, cleanMime, apiKey);
          audioPart = { fileData: { mimeType: cleanMime, fileUri } };
        } else {
          const base64Audio = await blobToBase64(audioBlob);
          audioPart = { inlineData: { mimeType: cleanMime, data: base64Audio } };
        }
      }
    }
    if (!hasAudioAttached && consultation.remoteFileUri) {
      hasAudioAttached = true;
      audioPart = {
        fileData: {
          mimeType: consultation.mimeType || 'audio/webm',
          fileUri: consultation.remoteFileUri
        }
      };
    }

    let totalTokensUsed = 0;
    let lastModelUsed = '';
    let verbatimTranscript = '';

    // =========================================================================
    // ETAPA 1 DE 2 (DEDICADA EXCLUSIVAMENTE À TRANSCRIÇÃO LITERAL DE 100% DO ÁUDIO):
    // Quando o modelo faz apenas a transcrição em texto puro (sem dividir tokens nem
    // atenção com as 150 linhas de regras da máscara SOAP e sem JSON), ele transcreve
    // PALAVRA POR PALAVRA do segundo 00:00 até o fim sem resumir e sem pular queixas!
    // =========================================================================
    if (hasAudioAttached && audioPart && window.buildVerbatimAudioTranscriptionPrompt) {
      if (onProgressMilestone) {
        onProgressMilestone(22, '🎙️ Etapa 1/2: Transcrevendo 100% do áudio palavra por palavra...');
      }
      try {
        const verbatimPrompt = window.buildVerbatimAudioTranscriptionPrompt(consultation.durationSeconds);
        const stage1Body = {
          contents: [{
            role: 'user',
            parts: [
              audioPart,
              { text: verbatimPrompt }
            ]
          }],
          generationConfig: {
            temperature: 0.0,
            maxOutputTokens: 65536
          }
        };
        const stage1Res = await callGeminiWithFallbackAndRetry(stage1Body, apiKey, (statusMsg) => {
          if (onProgressMilestone) {
            onProgressMilestone(null, null, statusMsg.replace(/^⚡\s*Estruturando\s*/i, '').replace(/^\(|\)\.\.\.$/g, ''));
          }
        });
        const stage1Text = (stage1Res.responseJson?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
        totalTokensUsed += stage1Res.responseJson?.usageMetadata?.totalTokenCount || 0;
        lastModelUsed = stage1Res.modelUsed || lastModelUsed;

        if (stage1Text && stage1Text.length >= 15) {
          verbatimTranscript = consultation.previousRawTranscript
            ? `${consultation.previousRawTranscript}\n\n--- CONTINUAÇÃO DO ATENDIMENTO ---\n${stage1Text}`
            : stage1Text;
          // Salva imediatamente a transcrição literal completa no banco de dados local!
          consultation.rawTranscript = fixBrazilianMedicationSpelling(verbatimTranscript);
          await window.ScribeDB.saveConsultation(consultation);
        }
      } catch (stage1Err) {
        console.warn('Etapa 1 (transcrição dedicada) falhou, seguindo com envio multimodal direto na Etapa 2:', stage1Err);
      }
    }

    if (!verbatimTranscript && consultation.rawTranscript) {
      verbatimTranscript = consultation.rawTranscript;
    }

    // =========================================================================
    // ETAPA 2 DE 2 (ESTRUTURAÇÃO CLÍNICA COMPLETA A PARTIR DA TRANSCRIÇÃO INTEGRAL):
    // Com toda a conversa já transcrita palavra por palavra em texto, o modelo lê
    // cada linha do diálogo e converte 100% das queixas, história, exame físico e
    // condutas para a máscara clínica sem omitir absolutamente nada!
    // =========================================================================
    const hasPreTranscribedDialogue = Boolean(verbatimTranscript && verbatimTranscript.length >= 15);
    const promptText = window.buildMedicalEvolutionPrompt(
      tpl,
      consultation.quickNotes,
      consultation.zScoreSummary,
      examFiles.length > 0 || Boolean(preExams) || hasNotesExams || (isPrenatalConsult && Boolean(consultation.previousConsultationText)),
      consultation.previousEvolutionText || '',
      consultation.previousConsultationText || '',
      preExams,
      soapSubtypeHeader,
      hasPreTranscribedDialogue
    );

    const parts = [];
    if (hasPreTranscribedDialogue) {
      parts.push({
        text: `=== TRANSCRIÇÃO LITERAL COMPLETA DO ÁUDIO DA CONSULTA DE HOJE (LEIA DO INÍCIO AO FIM E INCLUA 100% DAS QUEIXAS, INTERROGATÓRIO, HISTÓRIA, EXAME FÍSICO E CONDUTAS NA EVOLUÇÃO!) ===\n${verbatimTranscript}`
      });
      // Adiciona também o áudio original na Etapa 2 para que os modelos multimodais possam
      // ouvir diretamente os minutos finais caso alguma prescrição tenha sido rápida ou abafada:
      if (hasAudioAttached && audioPart && (!audioPart.inlineData || audioPart.inlineData.data.length < 9000000)) {
        parts.push(audioPart);
      }
    } else if (hasAudioAttached && audioPart) {
      parts.push(audioPart);
    }

    // 2. Inclui PDFs / Imagens de Exames (se já não tiverem sido transcritos na hora durante a consulta)
    if (!preExams) {
      if (examFiles.length > 0 && onProgressMilestone) {
        onProgressMilestone(60, '📄 Lendo PDFs / imagens de exames anexados...');
      }
      for (const exam of examFiles) {
        if (exam.blob && exam.blob.size > 0) {
          const mime = exam.mimeType || 'application/pdf';
          if (exam.blob.size > 15 * 1024 * 1024) {
            const fileUri = await uploadLargeFileToGeminiFileAPI(exam.blob, mime, apiKey);
            parts.push({ fileData: { mimeType: mime, fileUri } });
          } else {
            const base64Doc = await blobToBase64(exam.blob);
            parts.push({ inlineData: { mimeType: mime, data: base64Doc } });
          }
        }
      }
    }

    // 3. Inclui as instruções clínicas e a máscara exata
    parts.push({ text: promptText });

    const medicalSystemInstruction = {
      parts: [{
        text: `Você é um Médico de Família e Comunidade experiente registrando a consulta no prontuário oficial (PEC / e-SUS).
Você redige o prontuário como o PRÓPRIO MÉDICO ASSISTENTE (primeira pessoa profissional ou impessoal médico), NUNCA como uma IA ou observador externo de 3ª pessoa narrando o que aconteceu.
É TERMINANTEMENTE PROIBIDO escrever frases como "Médico orientou", "Médico reforçou", "Médico explicou", "Após esclarecimento médico" no SUBJETIVO.
O SUBJETIVO contém EXCLUSIVAMENTE a anamnese e o relato do paciente (queixas, sintomas, história da doença atual, tolerabilidade a remédios, hábitos de vida referidos, sintomas negados e demandas trazidas).
Toda e qualquer conduta, conselho, orientação médica dada durante a consulta, prescrição de medicamentos, solicitação de exames e encaminhamento via GERCON pertencem OBRIGATORIAMENTE à CONDUTA.`
      }]
    };

    const requestBody = {
      systemInstruction: medicalSystemInstruction,
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 65536,
        responseMimeType: 'application/json'
      }
    };

    if (onProgressMilestone) {
      onProgressMilestone(
        hasPreTranscribedDialogue ? 66 : 24,
        hasPreTranscribedDialogue
          ? '📋 Etapa 2/2: Organizando 100% da transcrição no modelo clínico...'
          : '🎙️ Transcrevendo e estruturando diálogo completo da consulta...'
      );
    }

    const { responseJson, modelUsed } = await callGeminiWithFallbackAndRetry(requestBody, apiKey, (statusMsg) => {
      if (onProgressMilestone) {
        onProgressMilestone(null, null, statusMsg.replace(/^⚡\s*Estruturando\s*/i, '').replace(/^\(|\)\.\.\.$/g, ''));
      }
    });

    if (onProgressMilestone) {
      onProgressMilestone(95, '🏷️ Validando cabeçalho #, exames e CIAP-2 / CID-10...', '');
    }

    const rawText = responseJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    totalTokensUsed += responseJson?.usageMetadata?.totalTokenCount || 0;
    let tokensUsed = totalTokensUsed || Math.round((consultation.durationSeconds || 60) * 32 + 1200);
    lastModelUsed = modelUsed || lastModelUsed;

    let parsed = parseGeminiEvolutionResponse(rawText);
    let finalEvolution = (parsed.evolucao_completa || '').trim();
    const transcriptCandidate = (verbatimTranscript || parsed.transcricao_literal_do_audio || '').trim();

    // AUTOCORREÇÃO AUTOMÁTICA: Se por qualquer motivo a IA devolveu apenas a transcrição bruta sem o modelo SOAP estruturado
    // (mas sem ser o alerta de áudio sem conteúdo clínico), faz uma passagem rápida de estruturação!
    const isNonClinicalWarning = /Áudio sem conteúdo de consulta médica/i.test(finalEvolution);
    const looksLikeStructuredEvolution = isNonClinicalWarning
      || (/(?:SUBJETIVO|OBJETIVO|AVALIAÇÃO|CONDUTA|IDENTIFICAÇÃO E ORIGEM)/i.test(finalEvolution)
        && !/^\[(?:MÉDICO|PACIENTE)\]:/i.test(finalEvolution));

    if (!looksLikeStructuredEvolution && (transcriptCandidate || finalEvolution || rawText)) {
      const sourceDialogue = transcriptCandidate || finalEvolution || rawText;
      const rescuePrompt = window.buildMedicalEvolutionPrompt(
        tpl,
        consultation.quickNotes,
        consultation.zScoreSummary,
        Boolean(preExams) || hasNotesExams || (isPrenatalConsult && Boolean(consultation.previousConsultationText)),
        consultation.previousEvolutionText || '',
        consultation.previousConsultationText || '',
        preExams,
        soapSubtypeHeader
      );
      const rescueBody = {
        systemInstruction: medicalSystemInstruction,
        contents: [{
          role: 'user',
          parts: [
            { text: `=== TRANSCRIÇÃO DO ATENDIMENTO PARA ESTRUTURAR NO MODELO ===\n${sourceDialogue}` },
            { text: rescuePrompt }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      };
      try {
        const rescueRes = await callGeminiWithFallbackAndRetry(rescueBody, apiKey);
        const rescueRaw = rescueRes.responseJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const rescueParsed = parseGeminiEvolutionResponse(rescueRaw);
        if (rescueParsed.evolucao_completa) {
          finalEvolution = rescueParsed.evolucao_completa;
          if (!parsed.codigos_cid_ciap && rescueParsed.codigos_cid_ciap) {
            parsed.codigos_cid_ciap = rescueParsed.codigos_cid_ciap;
          }
          if (!parsed.transcricao_literal_do_audio) {
            parsed.transcricao_literal_do_audio = sourceDialogue;
          }
        }
      } catch (_) {}
    }

    if (!finalEvolution) {
      finalEvolution = rawText;
    }

    // Se não houve exames complementares novos (e não é Pré-Natal com exames anteriores), garante que não fique um bloco "EXAMES COMPLEMENTARES\n-" vazio
    if (examFiles.length === 0 && !preExams && !hasNotesExams && (!isPrenatalConsult || !consultation.previousConsultationText)) {
      finalEvolution = finalEvolution.replace(/\n*EXAMES COMPLEMENTARES\s*\n\s*-\s*(?:Sem novos exames[^\n]*)?\n*/gi, '\n\n');
    }

    const { cleanText, codes } = cleanAndExtractCidFromEvolution(
      finalEvolution,
      Array.isArray(parsed.codigos_cid_ciap) ? parsed.codigos_cid_ciap : [],
      consultation.templateId,
      consultation.previousConsultationText || '',
      soapSubtypeHeader
    );

    return {
      evolutionText: cleanText,
      cidCiapCodes: codes,
      rawTranscript: fixBrazilianMedicationSpelling(transcriptCandidate || parsed.transcricao_literal_do_audio || ''),
      soapParts: {
        subjetivo: extractSectionFromText(cleanText, 'subjetivo'),
        objetivo: extractSectionFromText(cleanText, 'objetivo'),
        exames: extractSectionFromText(cleanText, 'exames'),
        avaliacao: extractSectionFromText(cleanText, 'avaliacao'),
        conduta: extractSectionFromText(cleanText, 'conduta')
      },
      auditAlerts: Array.isArray(parsed.alertas_auditoria) ? parsed.alertas_auditoria : [],
      suggestedSpecialty: parsed.especialidade_sugerida_encaminhamento || '',
      tokensUsed,
      modelUsed: lastModelUsed
    };
  }

  // Corretor determinístico de ortografia farmacológica oficial do Brasil (DCB / ANVISA / RENAME)
  function fixBrazilianMedicationSpelling(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/\bSimvastatina\b/g, 'Sinvastatina')
      .replace(/\bsimvastatina\b/g, 'sinvastatina')
      .replace(/\bSIMVASTATINA\b/g, 'SINVASTATINA')
      .replace(/\bAmlodipin([oa])\b/g, 'Anlodipin$1')
      .replace(/\bamlodipin([oa])\b/g, 'anlodipin$1')
      .replace(/\bAMLODIPIN([OA])\b/g, 'ANLODIPIN$1')
      .replace(/\bHydroclorotiazida\b/g, 'Hidroclorotiazida')
      .replace(/\bhydroclorotiazida\b/g, 'hidroclorotiazida')
      .replace(/\bLevothyroxin([ae])\b/g, 'Levotiroxina')
      .replace(/\blevothyroxin([ae])\b/g, 'levotiroxina')
      .replace(/\bAmoxycilin([ae])\b/g, 'Amoxicilina')
      .replace(/\bamoxycilin([ae])\b/g, 'amoxicilina')
      .replace(/\bAzithromicin([ae])\b/g, 'Azitromicina')
      .replace(/\bazithromicin([ae])\b/g, 'azitromicina')
      .replace(/\bOmeprasol\b/g, 'Omeprazol')
      .replace(/\bomeprasol\b/g, 'omeprazol')
      .replace(/\bPantoprasol\b/g, 'Pantoprazol')
      .replace(/\bpantoprasol\b/g, 'pantoprazol')
      .replace(/\bLozartana\b/g, 'Losartana')
      .replace(/\blozartana\b/g, 'losartana');
  }

  // Extrator à prova de falhas: NUNCA permite que código JSON bruto ({ "transcricao_literal_do_audio": ... }) apareça na caixa de evolução!
  function parseGeminiEvolutionResponse(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      return { evolucao_completa: '' };
    }
    let cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

    // 1. Tenta parse direto
    try {
      const obj = JSON.parse(cleaned);
      return Array.isArray(obj) ? (obj[0] || {}) : obj;
    } catch (_) {}

    // 2. Tenta remover colchetes/chaves extras que a IA às vezes adiciona no final (ex.: "} ] }")
    const strippedEnd = cleaned.replace(/\}\s*\]\s*\}\s*$/, '}').replace(/\}\s*\]\s*$/, '}');
    try {
      const obj2 = JSON.parse(strippedEnd);
      return Array.isArray(obj2) ? (obj2[0] || {}) : obj2;
    } catch (_) {}

    // 3. Extração direta campo a campo via Regex (mesmo se o JSON tiver sido truncado no final!)
    const extractField = (key) => {
      const re = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 's');
      const m = cleaned.match(re);
      if (m) {
        try {
          return JSON.parse(`"${m[1]}"`);
        } catch (__) {
          return m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
      }
      // Fallback caso o campo tenha sido truncado antes da aspa final
      const reTrunc = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)`, 's');
      const mTrunc = cleaned.match(reTrunc);
      if (mTrunc && mTrunc[1]) {
        return mTrunc[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
      return '';
    };

    const evo = extractField('evolucao_completa');
    const trans = extractField('transcricao_literal_do_audio');
    if (evo || trans) {
      return {
        transcricao_literal_do_audio: trans,
        evolucao_completa: evo,
        especialidade_sugerida_encaminhamento: extractField('especialidade_sugerida_encaminhamento')
      };
    }

    return { evolucao_completa: cleaned };
  }

  // Limpa e compacta linhas de exames laboratoriais no formato padrão limpo da APS (sem unidades prolixas e sem índices redundantes)
  function formatCleanCompactLabLine(rawLine) {
    if (!rawLine || typeof rawLine !== 'string') return '';
    let l = rawLine.trim();
    if (!l.startsWith('- LABS')) return l;

    // Remove unidades de medida desnecessárias no prontuário médico
    l = l.replace(/\s*(?:milh\.\/mm³|milhões\/mm³|g\/dL|mg\/dL|µg\/dL|ug\/dL|pg|fL|%|U\/L|u\/L|µUI\/mL|uUI\/mL|ng\/mL|mEq\/L|segundos|seg|\/mm³|\/µL|\/uL)\b/gi, '');

    // Remove redundâncias laboratoriais
    l = l.replace(/Glicemia estimada média\s*:\s*[^|)]+/gi, '');
    l = l.replace(/Colesterol Não-HDL\s*:\s*[^|)]+/gi, '');
    l = l.replace(/Relação Colesterol Total\/HDL\s*:\s*[^|)]+/gi, '');
    l = l.replace(/Atividade de protrombina\s*:\s*[^|)]+\s*\|\s*RNI/gi, 'TAP RNI');
    l = l.replace(/Proteína C Reativa Quantitativa/gi, 'PCR');
    l = l.replace(/Proteína C Reativa/gi, 'PCR');
    l = l.replace(/Pesquisa Quantitativa\s*:\s*/gi, '');
    l = l.replace(/TIBC \(Capacidade de Ligação do Ferro\)/gi, 'TIBC');
    l = l.replace(/TGO \(AST\)/gi, 'TGO');
    l = l.replace(/TGP \(ALT\)/gi, 'TGP');
    l = l.replace(/Hemoglobina Glicada \(HbA1c\)/gi, 'HbA1c');
    l = l.replace(/Hemoglobina Glicada/gi, 'HbA1c');
    l = l.replace(/Colesterol Total/gi, 'CT');
    l = l.replace(/Colesterol HDL/gi, 'HDL');
    l = l.replace(/Colesterol LDL/gi, 'LDL');
    l = l.replace(/Triglicerídeos/gi, 'TAG');
    l = l.replace(/Glicose/gi, 'GJ');
    l = l.replace(/Creatinina/gi, 'Creat');
    l = l.replace(/Uréia/gi, 'Ureia');
    l = l.replace(/Fosfatase Alcalina/gi, 'FA');
    l = l.replace(/Ferro Sérico/gi, 'Ferro');
    l = l.replace(/T4 Livre/gi, 'T4L');
    l = l.replace(/Vitamina B12/gi, 'B12');
    l = l.replace(/Potássio/gi, 'K');
    l = l.replace(/Sódio/gi, 'Na');
    l = l.replace(/Parasitológico de Fezes\s*:\s*Negativo/gi, 'EPF negativo');
    l = l.replace(/Sangue Oculto nas Fezes\s*:\s*Negativa?/gi, 'SOF negativo');
    l = l.replace(/Leucócitos Fecais\s*:\s*Negativa?/gi, 'Leucócitos fecais negativos');

    // Descompacta Hemograma prolixo com parênteses
    l = l.replace(/Hemograma\s*\(([^)]+)\)/gi, (_, inner) => {
      const parts = inner.split('|').map(s => s.trim());
      const extracted = [];
      for (const p of parts) {
        const hbMatch = p.match(/^Hemoglobina:\s*([0-9,.]+)/i);
        if (hbMatch) { extracted.push(`Hb ${hbMatch[1]}`); continue; }
        const htMatch = p.match(/^Hematócrito:\s*([0-9,.]+)/i);
        if (htMatch) { extracted.push(`Ht ${htMatch[1]}`); continue; }
        const vcmMatch = p.match(/^VCM:\s*([0-9,.]+)/i);
        if (vcmMatch) { extracted.push(`VCM ${vcmMatch[1]}`); continue; }
        const leucoMatch = p.match(/^Leucócitos:\s*([0-9,.]+)/i);
        if (leucoMatch) { extracted.push(`Leuco ${leucoMatch[1]}`); continue; }
        const plaqMatch = p.match(/^Plaquetas:\s*([0-9,.]+)/i);
        if (plaqMatch) { extracted.push(`Plaq ${plaqMatch[1]}`); continue; }
      }
      return extracted.length > 0 ? extracted.join(' | ') : inner;
    });

    // Descompacta Bilirrubinas prolixas
    l = l.replace(/Bilirrubinas\s*\(\s*Total:\s*([0-9,.]+)\s*\|\s*Direta:\s*([0-9,.]+)\s*\|\s*Indireta:\s*([0-9,.]+)\s*\)/gi, 'BT $1 (BD $2 / BI $3)');

    // Descompacta EQU prolixo
    l = l.replace(/EQU\s*\([^)]*Elementos anormais negativos[^)]*\)/gi, 'EQU sem alterações');

    // Limpa dois-pontos desnecessários entre sigla e valor
    l = l.replace(/\b(Hb|Ht|VCM|Leuco|Plaq|GJ|HbA1c|CT|HDL|LDL|TAG|Creat|Ureia|TGO|TGP|GGT|FA|PCR|Ferro|Ferritina|Transferrina|TIBC|TSH|T4L|B12|Na|K)\s*:\s*([0-9,.]+)/g, '$1 $2');
    l = l.replace(/\b(TAP|KPTT)\s*:\s*/gi, '$1 ');

    // Limpa separadores duplicados ou vazios
    l = l.replace(/\s*\|\s*\|\s*/g, ' | ')
         .replace(/\s*\|\s*$/g, '')
         .replace(/:\s*\|\s*/g, ': ')
         .replace(/\s+/g, ' ')
         .trim();

    return l;
  }

  // Garante deterministicamente via código que NENHUMA condição de saúde anterior ("#"), NENHUMA sub-linha ("- "),
  // NENHUMA informação de Ecografia na IG, NENHUM exame anterior e NENHUMA formatação de Vacinas/Sorologias/Paridade sejam perdidos!
  function enforcePreviousHeaderAndExams(evolutionText, previousConsultationText, templateId, soapSubtypeHeader) {
    let text = String(evolutionText || '');
    if (!text || /Áudio sem conteúdo de consulta médica/i.test(text)) return text;

    // 1. Garante o cabeçalho da modalidade na Consulta Geral (SOAP):
    // ## CONSULTA AGENDADA - 0800 ## | ## RETORNO MÉDICO ## | ## DEMANDA ESPONTÂNEA ##
    if (templateId === 'geral' && soapSubtypeHeader) {
      if (/^\s*##\s*(?:DEMANDA ESPONTÂNEA|CONSULTA AGENDADA[^\n#]*|RETORNO MÉDICO|ATENDIMENTO SOAP)\s*##/i.test(text)) {
        text = text.replace(/^\s*##\s*(?:DEMANDA ESPONTÂNEA|CONSULTA AGENDADA[^\n#]*|RETORNO MÉDICO|ATENDIMENTO SOAP)\s*##/i, soapSubtypeHeader);
      } else {
        text = `${soapSubtypeHeader}\n\n${text.trimStart()}`;
      }
    }

    // 2. Padroniza a paridade obstétrica para o formato compacto "# G01PV0PC0A0" (sem espaços entre G, PV, PC, A)
    text = text.replace(/^#\s*G\s*0*(\d+)\s*P?\s*V?\s*0*(\d+)\s*P?\s*C\s*0*(\d+)\s*A\s*0*(\d+)\b/gim, (_, g, pv, pc, a) => {
      const gPad = String(parseInt(g, 10)).padStart(2, '0');
      return `# G${gPad}PV${parseInt(pv, 10)}PC${parseInt(pc, 10)}A${parseInt(a, 10)}`;
    });
    // Caso a IA tenha escrito "# G1 P0 V0 PC0 A0" (com P e V separados)
    text = text.replace(/^#\s*G\s*0*(\d+)\s+P\s*0*(\d+)\s+V\s*0*(\d+)\s+PC\s*0*(\d+)\s+A\s*0*(\d+)\b/gim, (_, g, p, v, pc, a) => {
      const gPad = String(parseInt(g, 10)).padStart(2, '0');
      const pvVal = Math.max(parseInt(p, 10) || 0, parseInt(v, 10) || 0);
      return `# G${gPad}PV${pvVal}PC${parseInt(pc, 10)}A${parseInt(a, 10)}`;
    });

    // 3. Padroniza "# IG POR ECO COM X SEM E Y DIAS EM DD/MM/AAAA: 33 sem e 0 dias..." -> "# IG 33+0 POR ECO COM 08 SEM E 3 DIAS EM 15/05/2026"
    text = text.replace(/^#\s*IG\s+(?:(\d+\+\d+)\s+)?(POR\s+ECO\s+COM\s+[^\n:]+?)(?:\s*(?::|->)\s*(\d+)\s*sem(?:anas?)?(?:\s*e\s*(\d+)\s*d(?:ias?)?)?[^\n]*)?$/gim, (full, igPrefix, porEcoPart, wAfter, dAfter) => {
      if (igPrefix) {
        return `# IG ${igPrefix} ${porEcoPart.trim()}`;
      }
      if (wAfter !== undefined) {
        const dNum = dAfter !== undefined ? parseInt(dAfter, 10) : 0;
        return `# IG ${parseInt(wAfter, 10)}+${dNum} ${porEcoPart.trim()}`;
      }
      return full;
    });

    // 4. Desagrupa "# VACINAS: DT: 15/10/2026 | DTPA: Pendente | ..." em linhas individuais "- Vacina: status"
    text = text.replace(/^#\s*VACINAS:\s*([^\n]+)$/gim, (full, inlineContent) => {
      const trimmed = inlineContent.trim();
      if (!trimmed) return '# VACINAS:';
      if (trimmed.includes('|')) {
        const items = trimmed.split('|').map(s => s.trim()).filter(Boolean);
        return '# VACINAS:\n' + items.map(it => (it.startsWith('-') ? it : `- ${it}`)).join('\n');
      }
      // Se separou várias vacinas por vírgula na mesma linha (ex.: "Hep B, DT, Influenza, COVID, VSR (01/10/26), DTPA (04/08/26)")
      if (/,/.test(trimmed) && /(?:DT|DTPA|VSR|Hep|Influenza|COVID)/i.test(trimmed)) {
        const items = trimmed.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
        if (items.length >= 2) {
          return '# VACINAS:\n' + items.map(it => (it.startsWith('-') ? it : `- ${it}`)).join('\n');
        }
      }
      return `# VACINAS:\n- ${trimmed.replace(/^-\s*/, '')}`;
    });

    // 5. Desagrupa "# SOROLOGIAS: 29/08/2026: TR HIV NR | ... | 27/10/2026: HTLV..." em uma linha "- DD/MM/AAAA: ..." por data
    text = text.replace(/^#\s*SOROLOGIAS:\s*([^\n]+)$/gim, (full, inlineContent) => {
      const trimmed = inlineContent.trim();
      if (!trimmed) return '# SOROLOGIAS:';
      // Quebra sempre que houver "| DD/MM/AAAA:" (nova data de sorologia na mesma linha)
      const splitByDate = trimmed.replace(/\s*\|\s*(?=\d{2}\/\d{2}\/\d{2,4}\s*:)/g, '\n');
      const dateLines = splitByDate.split('\n').map(s => s.trim()).filter(Boolean);
      return '# SOROLOGIAS:\n' + dateLines.map(dl => (dl.startsWith('-') ? dl : `- ${dl.replace(/^-\s*/, '')}`)).join('\n');
    });

    // 6. Se houver Evolução Anterior colada, garante que NENHUMA "#" anterior, NENHUMA sub-linha "- " e NENHUM exame anterior tenham sido omitidos
    const parsedPrev = (previousConsultationText && window.parsePreviousConsultationData)
      ? window.parsePreviousConsultationData(previousConsultationText)
      : null;

    if (parsedPrev) {
      // 6a. Garante que se a evolução anterior tinha "# IG ... POR ECO COM ... EM DD/MM/AAAA" e a IA omitiu a parte da ECO, ela seja restaurada
      if (parsedPrev.updatedIgLine) {
        if (/^#\s*IG\b[^\n]*$/im.test(text)) {
          text = text.replace(/^#\s*IG\b[^\n]*$/im, (currentIgLine) => {
            if (!/POR\s+ECO/i.test(currentIgLine) && /POR\s+ECO/i.test(parsedPrev.updatedIgLine)) {
              return parsedPrev.updatedIgLine;
            }
            return currentIgLine;
          });
        }
      }

      // 6b. Verifica todas as condições "#" e sub-linhas ("- " ou ">> ") do cabeçalho anterior + diagnósticos promovidos da AVALIAÇÃO anterior (nos 7 modelos!)
      const subjSplit = text.match(/^([\s\S]*?)(\n\s*(?:\d+\.\s*)?SUBJETIVO\b[\s\S]*)$/i);
      if (subjSplit) {
        let headerPart = subjSplit[1];
        const restPart = subjSplit[2];

        const normalizeCompare = (s) => s
          .toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '');

        // Agrupa o cabeçalho anterior em blocos: cada linha "#" + suas sub-linhas ("- " ou ">> ") imediatamente abaixo
        const prevSourceLines = [
          ...(parsedPrev.headerLines || [])
        ];
        const prevBlocks = [];
        for (const line of prevSourceLines) {
          const t = line.trim();
          if (!t || t === '#') continue;
          if (t.startsWith('#')) {
            prevBlocks.push({ main: t, subs: [] });
          } else if ((t.startsWith('-') || t.startsWith('>')) && prevBlocks.length > 0) {
            const formattedSub = t.startsWith('>>') ? t : t.replace(/^>\s*/, '- ');
            prevBlocks[prevBlocks.length - 1].subs.push(formattedSub);
          }
        }

        // Limpeza de frases descritivas da Avaliação que tenham sido indevidamente colocadas no cabeçalho "#":
        headerPart = headerPart
          .replace(/^#\s*Hip[óo]tese\s*:[^\n]*\n?/gim, '')
          .replace(/^#\s*.*(?:controle irregular|controle insatisfat[óo]rio|em tratamento|achado em TC|achado de imagem|expelida clinicamente)[^\n]*\n?/gim, '')
          .replace(/^#\s*(?:S[íi]ndrome\s+d[ie]sabsortiva|Cistos?\s+hep[áa]ticos?|Nefrolit[íi]ase|SOF\s+positivo)[^\n]*\n?/gim, '');

        for (const block of prevBlocks) {
          const mainUpper = block.main.toUpperCase();
          // Campos estruturais fixos dos 7 modelos (G/P, IG, TS, TOXO, SOROLOGIAS, VACINAS, MUC, TABAGISTA, ALERGIAS, ODONTO, HISTÓRICO DO PARTO, TRIAGEM NEONATAL, EQUIPE VD, FAMILIAR VD)
          const isStructuralKey = /^#\s*(?:G\d|IG\b|TS\b|TOXO\b|SOROLOGIAS\b|VACINAS\b|MUC\b|TABAGIS|ALERGIA|CONSULTA\s+ODONTO|DUM\b|HIST[ÓO]RICO\s+DO\s+PARTO|TRIAGEM\s+NEONATAL|EQUIPE\s+PRESENTE|FAMILIAR\s*\/\s*CUIDADOR|$)/i.test(mainUpper);

          if (isStructuralKey) {
            // 1) Se um campo estrutural de linha única (ex.: # Tabagista: nega, # Alergias: dipirona, # TS: O positivo) ficou em branco na evolução nova, restaura o valor anterior!
            const kvMatch = block.main.match(/^#\s*(TS|TABAGISTA|ALERGIAS|CONSULTA\s+ODONTOLOGIA)\s*:\s*(.+)$/i);
            if (kvMatch && kvMatch[2].trim()) {
              const keyName = kvMatch[1].trim();
              const emptyKeyRe = new RegExp(`^#\\s*${keyName.replace(/\s+/g, '\\s+')}\\s*:\\s*$`, 'im');
              if (emptyKeyRe.test(headerPart)) {
                headerPart = headerPart.replace(emptyKeyRe, block.main);
              }
            }

            // 2) Se na evolução anterior havia a paridade preenchida (ex.: "# G01PV0PC0A0") e na nova ficou o esqueleto em branco "# G PV PC A", substitui pela paridade real da paciente!
            if (/^#\s*G\d/i.test(mainUpper) && /^#\s*G\s+PV\s+PC\s+A\s*$/im.test(headerPart)) {
              headerPart = headerPart.replace(/^#\s*G\s+PV\s+PC\s+A\s*$/im, block.main);
            }

            // 3) Se o campo estrutural tem sub-linhas na evolução anterior (ex.: "# G01PV0PC0A0" -> "- Gestação atual não planejada", ou "# Histórico do parto" -> "- Idade por capurro...", ou "# Triagem neonatal:" -> ">> Orelhinha..."), garante que todas as sub-linhas preenchidas sejam mantidas na ordem original!
            if (block.subs.length > 0 && /^#\s*(?:G\d|HIST[ÓO]RICO\s+DO\s+PARTO|TRIAGEM\s+NEONATAL|VACINAS|SOROLOGIAS)/i.test(mainUpper)) {
              const keyPrefixMatch = block.main.match(/^#\s*(G\d\S*|HIST[ÓO]RICO\s+DO\s+PARTO[^\n]*|TRIAGEM\s+NEONATAL[^\n]*|VACINAS\s*:|SOROLOGIAS\s*:)/i);
              if (keyPrefixMatch) {
                const missingSubs = block.subs.filter(sub => {
                  const subNorm = normalizeCompare(sub);
                  return subNorm && !normalizeCompare(headerPart).includes(subNorm);
                });
                if (missingSubs.length > 0) {
                  const anchorRe = new RegExp(`^(#\\s*${keyPrefixMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\n]*)$`, 'im');
                  if (anchorRe.test(headerPart)) {
                    headerPart = headerPart.replace(anchorRe, `$1\n${missingSubs.join('\n')}`);
                  }
                }
              }
            }
            continue;
          }

          // É uma condição clínica/cirúrgica/hábito/diagnóstico (ex.: "# Hipertensão arterial", "# ovolactovegetariana", "# Risco aumentado para pré-eclâmpsia", etc.)
          const mainNorm = normalizeCompare(block.main);
          if (mainNorm && !normalizeCompare(headerPart).includes(mainNorm)) {
            const fullBlockText = [block.main, ...block.subs].join('\n');
            // Insere no local exato conforme o modelo (Pré-Natal, LGBTQIAP+, Puericultura, Visita Domiciliar, Interconsulta ou SOAP Geral)
            if (/^Medica[çc][õo]es em uso:/im.test(headerPart)) {
              // Modelos LGBTQIAP+ (1ª Consulta e Seguimento): insere antes de "Medicações em uso:" mantendo a ordem cronológica
              headerPart = headerPart.replace(/^(Medica[çc][õo]es em uso:)/im, `${fullBlockText}\n$1`);
            } else if (/^#\s*TS:/im.test(headerPart)) {
              // Modelo Pré-Natal
              headerPart = headerPart.replace(/^(#\s*TS:)/im, `${fullBlockText}\n$1`);
            } else if (/^#\s*MUC:/im.test(headerPart)) {
              // Modelos Geral (SOAP), Puericultura, Visita Domiciliar e Interconsulta
              headerPart = headerPart.replace(/^(#\s*MUC:)/im, `${fullBlockText}\n$1`);
            } else {
              headerPart = `${headerPart.trimEnd()}\n${fullBlockText}\n`;
            }
          } else if (block.subs.length > 0) {
            // A condição "#" existe, mas verifica se alguma sub-linha ("- " ou ">> ") abaixo dela foi omitida
            const missingCondSubs = block.subs.filter(sub => {
              const subNorm = normalizeCompare(sub);
              return subNorm && !normalizeCompare(headerPart).includes(subNorm);
            });
            if (missingCondSubs.length > 0) {
              const escapedMain = block.main.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const reMain = new RegExp(`^(${escapedMain}[^\\n]*)$`, 'im');
              if (reMain.test(headerPart)) {
                headerPart = headerPart.replace(reMain, `$1\n${missingCondSubs.join('\n')}`);
              }
            }
          }
        }

        // Se já houver condições "#" reais preenchidas, remove linhas "#" vazias soltas ("# ") que sobraram do esqueleto
        if (/^#\s+\S+/m.test(headerPart)) {
          headerPart = headerPart.replace(/^#\s*$\n?/gm, '');
        }

        text = `${headerPart}${restPart}`;
      }
    }

    // 7. Separa rigorosamente EXAMES COMPLEMENTARES (- LABS) de ULTRASSONOGRAFIA (- US):
    // - No PRÉ-NATAL: mantém cumulativamente os exames anteriores da evolução antiga + inclui os novos abaixo.
    // - No SOAP GERAL e demais consultas: NUNCA copia os exames da evolução antiga (inclusive remove caso a IA tenha copiado algum exame antigo!).
    const isPrenatal = (templateId === 'prenatal') || /CONSULTA DE PRÉ-NATAL/i.test(text);
    const hasPrevLabs = isPrenatal && parsedPrev && parsedPrev.labLines && parsedPrev.labLines.length > 0;
    const hasPrevUsg = isPrenatal && parsedPrev && parsedPrev.usgLines && parsedPrev.usgLines.length > 0;

    // Ancora os blocos de exames antes de "7. RASTREAMENTOS" (nos modelos LGBTQIAP+) ou antes de "AVALIAÇÃO" (nos outros 5 modelos)
    const afterExamsBoundaryRegex = /\n(\s*(?:7\.\s*RASTREAMENTOS|(?:\d+\.\s*)?AVALIAÇÃO)\b)/i;
    if (afterExamsBoundaryRegex.test(text)) {
      const boundaryMatch = text.match(afterExamsBoundaryRegex);
      let preEval = text.slice(0, boundaryMatch.index);
      const evalAndAfter = text.slice(boundaryMatch.index);

      // Extrai blocos EXAMES COMPLEMENTARES e/ou ULTRASSONOGRAFIA atuais no final de preEval (mesmo que só exista ULTRASSONOGRAFIA)
      const examSectionRegex = /\n*(?:EXAMES COMPLEMENTARES|ULTRASSONOGRAFIA)\s*\n([\s\S]*?)$/i;
      const examMatch = preEval.match(examSectionRegex);

      if (examMatch || hasPrevLabs || hasPrevUsg) {
        const bodyBeforeExams = examMatch ? preEval.slice(0, examMatch.index) : preEval;
        const rawExamArea = examMatch ? preEval.slice(examMatch.index) : '';

        const currentLabLines = [];
        const currentUsgLines = [];
        let inUsgSubblock = false;

        for (const rawL of rawExamArea.split('\n')) {
          const t = rawL.trim();
          if (!t || t === '-' || /^-\s*(?:Sem novos exames|Nenhum exame|Não realizado)/i.test(t)) continue;
          if (/^ULTRASSONOGRAFIA\b/i.test(t)) {
            inUsgSubblock = true;
            continue;
          }
          if (/^EXAMES COMPLEMENTARES\b/i.test(t)) {
            inUsgSubblock = false;
            continue;
          }
          const isUsgLine = /^-\s*(?:US\b|USG\b|ECO\b|ECOGRAFIA|ULTRASSOM|ULTRASSONOGRAFIA)/i.test(t)
            || /\b(?:DMSG|CCN|saco gestacional|feto único|placenta|líquido amniótico|biometria fetal)\b/i.test(t);

          if (inUsgSubblock || isUsgLine) {
            currentUsgLines.push(t);
          } else {
            currentLabLines.push(t);
          }
        }

        const normLineKey = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
        const extractExamDate = (s) => {
          const m = String(s || '').match(/\b(\d{2}\/\d{2}\/\d{2,4})\b/);
          return m ? m[1] : '';
        };
        const prevOldLabKeys = (!isPrenatal && parsedPrev && parsedPrev.labLines)
          ? parsedPrev.labLines.map(l => normLineKey(l))
          : [];
        const prevOldLabDates = (!isPrenatal && parsedPrev && parsedPrev.labLines)
          ? parsedPrev.labLines.map(extractExamDate).filter(Boolean)
          : [];
        const prevOldUsgKeys = (!isPrenatal && parsedPrev && parsedPrev.usgLines)
          ? parsedPrev.usgLines.map(l => normLineKey(l))
          : [];
        const prevOldUsgDates = (!isPrenatal && parsedPrev && parsedPrev.usgLines)
          ? parsedPrev.usgLines.map(extractExamDate).filter(Boolean)
          : [];

        // Mescla exames laboratoriais (apenas no Pré-Natal inclui os antigos; no SOAP remove se a IA tiver copiado da evolução antiga)
        const finalLabs = [];
        if (hasPrevLabs) {
          for (const pl of parsedPrev.labLines) {
            finalLabs.push(pl.trim());
          }
        }
        for (const cl of currentLabLines) {
          const dateMatch = cl.match(/\b(\d{2}\/\d{2}\/\d{2,4})\b/);
          if (!isPrenatal && (prevOldLabKeys.includes(normLineKey(cl)) || (dateMatch && prevOldLabDates.includes(dateMatch[1])))) {
            continue; // Bloqueia cópia de exame antigo no SOAP!
          }
          const alreadyHasSameLine = finalLabs.some(existing => normLineKey(existing) === normLineKey(cl));
          if (!alreadyHasSameLine) {
            if (dateMatch && finalLabs.some(existing => existing.includes(dateMatch[1]) && existing.length >= cl.length)) {
              continue;
            }
            finalLabs.push(cl);
          }
        }

        // Mescla ultrassonografias (apenas no Pré-Natal inclui as antigas; no SOAP remove se a IA tiver copiado da evolução antiga)
        const finalUsgs = [];
        if (hasPrevUsg) {
          for (const pu of parsedPrev.usgLines) {
            finalUsgs.push(pu.trim());
          }
        }
        for (const cu of currentUsgLines) {
          const dateMatch = cu.match(/\b(\d{2}\/\d{2}\/\d{2,4})\b/);
          if (!isPrenatal && (prevOldUsgKeys.includes(normLineKey(cu)) || (dateMatch && prevOldUsgDates.includes(dateMatch[1])))) {
            continue; // Bloqueia cópia de USG antigo no SOAP!
          }
          const alreadyHasSameUsg = finalUsgs.some(existing => normLineKey(existing) === normLineKey(cu));
          if (!alreadyHasSameUsg) {
            if (dateMatch && finalUsgs.some(existing => existing.includes(dateMatch[1]) && existing.length >= cu.length)) {
              continue;
            }
            finalUsgs.push(cu);
          }
        }

        const rebuiltSections = [];
        const cleanedFinalLabs = finalLabs.map(formatCleanCompactLabLine);
        if (!isPrenatal) {
          // No SOAP Geral e demais consultas fora do Pré-Natal:
          // Unifica todos os exames complementares sob o título "EXAMES COMPLEMENTARES" (sem criar "ULTRASSONOGRAFIA" para abrigar TC, RX ou Ecocardio!)
          const allExams = [...cleanedFinalLabs, ...finalUsgs];
          if (allExams.length > 0) {
            rebuiltSections.push(`EXAMES COMPLEMENTARES\n${allExams.join('\n')}`);
          }
        } else {
          // No Pré-Natal: separa EXAMES COMPLEMENTARES (- LABS) e ULTRASSONOGRAFIA (- US obstétrica/morfológica)
          if (cleanedFinalLabs.length > 0) {
            rebuiltSections.push(`EXAMES COMPLEMENTARES\n${cleanedFinalLabs.join('\n')}`);
          }
          if (finalUsgs.length > 0) {
            rebuiltSections.push(`ULTRASSONOGRAFIA\n${finalUsgs.join('\n')}`);
          }
        }

        if (rebuiltSections.length > 0) {
          text = `${bodyBeforeExams.trimEnd()}\n\n${rebuiltSections.join('\n\n')}${evalAndAfter}`;
        } else {
          text = `${bodyBeforeExams.trimEnd()}${evalAndAfter}`;
        }
      }
    }

    return text;
  }

  // Sanitizador que remove julgamentos de IA em 3ª pessoa do SUBJETIVO e limpa contaminações com conduta médica
  function sanitizeSubjectiveAndConductPerspectives(text) {
    if (!text || typeof text !== 'string') return '';

    // Regex para identificar início e fim do bloco SUBJETIVO
    const subjMatch = text.match(/(^|\n)((\d+\.\s*)?SUBJETIVO[^\n]*\n)([\s\S]*?)(\n(\d+\.\s*)?(?:5\.|6\.|TERAPIA|OBJETIVO|EXAMES|AVALIAÇÃO)\b)/i);
    if (!subjMatch) return text;

    const beforeSubj = text.slice(0, subjMatch.index + subjMatch[1].length + subjMatch[2].length);
    let subjContent = subjMatch[4];
    const afterSubj = text.slice(subjMatch.index + subjMatch[1].length + subjMatch[2].length + subjContent.length);

    // 1. Remove julgamentos narrativos de IA e frases em 3ª pessoa sobre o médico
    subjContent = subjContent
      .replace(/,?\s*contradizendo\s+relato\s+anterior\s+de\s+abstin[êe]ncia\s+total/gi, '')
      .replace(/Paciente\s+nega\s+ser\s+doador\s+de\s+[óo]rg[ãa]os,?\s*(?:mas\s*)?(?:ap[óo]s\s+esclarecimento\s+m[ée]dico,?\s*)?manifestou\s+interesse\s+em\s+ser\s+doador[^.\n]*/gi, 'Manifesta interesse em ser doador de órgãos.')
      .replace(/ap[óo]s\s+esclarecimento\s+m[ée]dico,?\s*/gi, '');

    // 2. Remove condutas/orientações médicas que vazaram para dentro do SUBJETIVO
    subjContent = subjContent.replace(
      /(?:(?:O\s+)?M[ée]dico\s+(?:refor[çc]ou|orientou|explicou|solicitou|prescreveu|enfatizou|reiterou|esclareceu)|Realizado\s+encaminhamento|Orientado\s+(?:o\s+)?paciente\s+a\s+acompanhar)[^.\n]*\.?\s*/gi,
      ''
    );

    // 3. Limpa espaços e quebras repetidas
    subjContent = subjContent
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim();

    return beforeSubj + subjContent + '\n' + afterSubj;
  }

  function cleanAndExtractCidFromEvolution(evolutionText, existingCodes, templateId, previousConsultationText = '', soapSubtypeHeader = '') {
    let text = fixBrazilianMedicationSpelling(evolutionText || '');

    // 1. Limpeza de linguagem informal / gírias no Subjetivo para adequação à semiologia médica formal
    text = text
      .replace(/\b(?:tipo\s+["']?pruft["']?|pruft)\b/gi, 'explosiva de consistência pastosa')
      .replace(/\bdor de barriga\b/gi, 'dor abdominal')
      .replace(/["']?desandou["']?(?:\s+novamente)?/gi, 'apresentou novo episódio diarreico')
      .replace(/\bfedorenta\b/gi, 'de odor fétido')
      .replace(/\bfezes brancas\b/gi, 'fezes esbranquiçadas (hipocolia fecal)')
      .replace(/ardor semelhante a azia\/refluxo/gi, 'epigastralgia em queimação e pirose')
      .replace(/dor no meio do estômago/gi, 'dor em região epigástrica');

    // 1.1 Limpeza estrita de contaminação do SUBJETIVO com condutas médicas ou frases de IA em 3ª pessoa
    text = sanitizeSubjectiveAndConductPerspectives(text);

    // 2. Remove frases metalinguísticas inaceitáveis no Objetivo e garante ectoscopia padrão
    text = text.replace(/OBJETIVO\s*\n\s*(?:Exame\s+f[íi]sico\s+n[ãa]o\s+detalhado[^\n]*|Exame\s+f[íi]sico\s+n[ãa]o\s+mencionado[^\n]*|N[ãa]o\s+detalhado\s+na\s+transcri[çc][ãa]o[^\n]*)\n*/gi, 'OBJETIVO\nBEG, LOC, corada, hidratada, anictérica, acianótica.\n\n');

    // 3. Se média domiciliar de PA ou HGT foi parar no Objetivo, move automaticamente para o final do Subjetivo
    const homePaInObjMatch = text.match(/\nOBJETIVO\s*\n([\s\S]*?)(\n\s*(?:EXAMES|ULTRASSONOGRAFIA|AVALIAÇÃO)\b)/i);
    if (homePaInObjMatch) {
      const objBody = homePaInObjMatch[1];
      const paDomMatch = objBody.match(/^.*Controle\s+de\s+(?:PA|HGT)\s*:\s*Refere[^\n]*$/im);
      if (paDomMatch) {
        text = text.replace(paDomMatch[0], '');
        text = text.replace(/(\n\s*OBJETIVO\b)/i, `\n${paDomMatch[0].trim()}\n$1`);
      }
    }

    text = enforcePreviousHeaderAndExams(text, previousConsultationText, templateId, soapSubtypeHeader);
    const extractedCodes = Array.isArray(existingCodes) ? [...existingCodes] : [];

    // Na Puericultura, garante que nunca apareça "# Alimentação:" ou "# Aleitamento:" no cabeçalho "#" inicial
    if (templateId === 'puericultura' || /CONSULTA DE PUERICULTURA/i.test(text)) {
      text = text.replace(/^#\s*(?:Aleitamento\s*\/\s*)?Alimenta[çc][ãa]o:[^\n]*\n?/gim, '');
    }

    // Captura qualquer "(CID-10: ... / CIAP-2: ...)" que esteja na Avaliação para colocar fora da evolução
    const lines = text.split('\n');
    lines.forEach(line => {
      const cidMatch = line.match(/^(?:-\s*)?([^(\n]+?)\s*\(((?:CID|CIAP)[^)]+)\)/i);
      if (cidMatch) {
        const label = `${cidMatch[2].trim()} — ${cidMatch[1].trim()}`;
        if (!extractedCodes.includes(label)) extractedCodes.push(label);
      }
    });

    // Remove os parênteses de CID/CIAP de dentro do texto da evolução
    text = text.replace(/\s*\((?:CID(?:-1[01])?|CIAP(?:-2)?)[^)]*\)/gi, '');

    // Remove traços ("- ") no início das linhas dos blocos AVALIAÇÃO e CONDUTA e evita duplicação de "Oriento sinais de alarme"
    let inAvaliacaoOrConduta = false;
    const allLines = text.split('\n');
    const hasDetailedAlarmLine = allLines.some(l => /Oriento sinais de alarme\s*\(/i.test(l));

    const cleanedLines = [];
    for (let rawLine of allLines) {
      const trimmed = rawLine.trim();
      if (/^(?:\d+\.\s*)?(?:AVALIAÇÃO|CONDUTA|>>\s*PENDÊNCIAS)/i.test(trimmed)) {
        inAvaliacaoOrConduta = true;
        cleanedLines.push(rawLine);
        continue;
      }
      if (/^(?:\d+\.\s*)?(?:SUBJETIVO|OBJETIVO|EXAMES COMPLEMENTARES|ULTRASSONOGRAFIA|RASTREAMENTOS|SOROLOGIAS)/i.test(trimmed)) {
        inAvaliacaoOrConduta = false;
      }
      if (inAvaliacaoOrConduta) {
        rawLine = rawLine.replace(/^\s*-\s+/, '');
        // Garante que qualquer resquício de narrador de 3ª pessoa ou particípio na conduta vire 1ª pessoa profissional médica
        rawLine = rawLine
          .replace(/^(?:O\s+)?M[ée]dico\s+prescreveu\s+/i, 'Prescrevo ')
          .replace(/^(?:O\s+)?M[ée]dico\s+orientou\s+/i, 'Oriento ')
          .replace(/^(?:O\s+)?M[ée]dico\s+refor[çc]ou\s+(?:orienta[çc][õo]es\s+sobre\s+)?/i, 'Reforço orientações sobre ')
          .replace(/^(?:O\s+)?M[ée]dico\s+solicitou\s+/i, 'Solicito ')
          .replace(/^Realizado\s+encaminhamento\s+/i, 'Encaminho ')
          .replace(/^Parabenizada\s+(?:a\s+)?(?:m[ãa]e|paciente|familiar)\b/i, 'Parabenizo a mãe')
          .replace(/^Explicado\s+[àa]\s+(?:m[ãa]e|paciente|familiar)\b/i, 'Explico à mãe')
          .replace(/^Orientad[ao]s?\s+manuten[çc][ãa]o\b/i, 'Oriento manutenção')
          .replace(/^Orientad[ao]s?\s+medidas\b/i, 'Oriento medidas')
          .replace(/^Orientad[ao]s?\s+sobre\b/i, 'Oriento sobre')
          .replace(/^Reiterad[ao]\s+(?:a\s+)?import[âa]ncia\b/i, 'Reitero a importância')
          .replace(/^Renovad[ao]\s+receita\b/i, 'Renovo receita')
          .replace(/^Retorno\s+agendado\b/i, 'Agendo retorno')
          .replace(/^Agendad[ao]\s+retorno\b/i, 'Agendo retorno');
        // Se já descreveu os sinais de alarme específicos, remove a frase genérica duplicada
        if (hasDetailedAlarmLine && /^Oriento sinais de alarme e(?:,\s*)? na presença/i.test(rawLine.trim())) {
          continue;
        }
      }
      cleanedLines.push(rawLine);
    }

    return { cleanText: cleanedLines.join('\n').trim(), codes: extractedCodes };
  }

  async function callGeminiLiveWebSocket(requestBody, apiKey, modelName, onStatusUpdate) {
    return new Promise((resolve, reject) => {
      const cleanModel = String(modelName || '').replace(/^models\//, '').trim();
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(apiKey)}`;

      let ws;
      try {
        ws = new WebSocket(wsUrl);
      } catch (err) {
        return reject(err);
      }

      let accumulatedText = '';
      let isSetupDone = false;
      let hasFinished = false;

      const timer = setTimeout(() => {
        if (!hasFinished) {
          hasFinished = true;
          try { ws.close(); } catch (_) {}
          if (accumulatedText.trim().length >= 15) {
            resolve({
              responseJson: {
                candidates: [{
                  content: {
                    parts: [{ text: accumulatedText.trim() }]
                  }
                }]
              },
              modelUsed: cleanModel
            });
          } else {
            reject(new Error(`Timeout na comunicação WebSocket Live API com modelo ${cleanModel}`));
          }
        }
      }, 75000);

      ws.onopen = () => {
        if (onStatusUpdate) onStatusUpdate(`⚡ Conectado ao ${formatModelName(cleanModel)} (Live)...`);
        const setupMsg = {
          setup: {
            model: `models/${cleanModel}`,
            generationConfig: {
              responseModalities: ['TEXT']
            },
            ...(requestBody?.systemInstruction ? { systemInstruction: requestBody.systemInstruction } : {})
          }
        };
        try {
          ws.send(JSON.stringify(setupMsg));
        } catch (sendErr) {
          clearTimeout(timer);
          reject(sendErr);
        }
      };

      ws.onmessage = (event) => {
        try {
          const rawData = event.data;
          if (typeof rawData !== 'string') return;
          const msg = JSON.parse(rawData);

          if (msg.error) {
            if (!hasFinished) {
              hasFinished = true;
              clearTimeout(timer);
              try { ws.close(); } catch (_) {}
              reject(new Error(msg.error.message || `Erro Live API (${cleanModel})`));
            }
            return;
          }

          // 1. Confirmação do Setup pelo Google
          if (msg.setupComplete && !isSetupDone) {
            isSetupDone = true;
            if (onStatusUpdate) onStatusUpdate(`🎙️ Processando com ${formatModelName(cleanModel)}...`);

            const userContent = (requestBody.contents || [])[0];
            const parts = userContent?.parts || [];

            // A) Envia chunks de áudio se presentes (fatiados em 24KB para fluxo contínuo e sem estouro de frame no WebSocket)
            for (const p of parts) {
              if (p.inlineData && p.inlineData.data) {
                const rawBase64 = p.inlineData.data;
                const chunkSize = 24576; // 24KB por pedaço
                for (let offset = 0; offset < rawBase64.length; offset += chunkSize) {
                  const slice = rawBase64.slice(offset, offset + chunkSize);
                  ws.send(JSON.stringify({
                    realtimeInput: {
                      mediaChunks: [{
                        mimeType: p.inlineData.mimeType || 'audio/webm',
                        data: slice
                      }]
                    }
                  }));
                }
              }
            }

            // B) Envia instruções / texto / prompt no turno do usuário
            const textParts = parts.filter(p => p.text).map(p => ({ text: p.text }));
            if (textParts.length > 0) {
              ws.send(JSON.stringify({
                clientContent: {
                  turns: [{
                    role: 'user',
                    parts: textParts
                  }],
                  turnComplete: true
                }
              }));
            } else {
              ws.send(JSON.stringify({
                clientContent: {
                  turns: [{
                    role: 'user',
                    parts: [{ text: 'Processe o áudio da consulta na íntegra.' }]
                  }],
                  turnComplete: true
                }
              }));
            }
            return;
          }

          // 2. Fragmentos de texto do modelo retornando
          if (msg.serverContent?.modelTurn?.parts) {
            for (const part of msg.serverContent.modelTurn.parts) {
              if (part.text) {
                accumulatedText += part.text;
              }
            }
          }

          // 3. Fim do turno do modelo
          if (msg.serverContent?.turnComplete) {
            if (!hasFinished) {
              hasFinished = true;
              clearTimeout(timer);
              try { ws.close(); } catch (_) {}
              resolve({
                responseJson: {
                  candidates: [{
                    content: {
                      parts: [{ text: accumulatedText.trim() }]
                    }
                  }],
                  usageMetadata: {
                    totalTokenCount: Math.ceil(accumulatedText.length / 3.5)
                  }
                },
                modelUsed: cleanModel
              });
            }
          }
        } catch (msgErr) {
          console.warn('Erro ao processar mensagem do WebSocket Live API:', msgErr);
        }
      };

      ws.onerror = (err) => {
        if (!hasFinished) {
          hasFinished = true;
          clearTimeout(timer);
          try { ws.close(); } catch (_) {}
          reject(new Error(`Falha na conexão Live WebSocket com ${cleanModel}: ${err?.message || 'erro de rede'}`));
        }
      };

      ws.onclose = (ev) => {
        if (!hasFinished) {
          hasFinished = true;
          clearTimeout(timer);
          if (accumulatedText.trim().length >= 15) {
            resolve({
              responseJson: {
                candidates: [{
                  content: {
                    parts: [{ text: accumulatedText.trim() }]
                  }
                }]
              },
              modelUsed: cleanModel
            });
          } else {
            reject(new Error(`WebSocket Live API encerrou (${ev.code}: ${ev.reason || 'sem dados'})`));
          }
        }
      };
    });
  }

  async function callGeminiWithFallbackAndRetry(requestBody, apiKey, onStatusUpdate) {
    let lastError = null;
    let allFailedByDailyQuota = false;
    const keysToTry = getSavedApiKeysList(apiKey);

    for (let kIdx = 0; kIdx < keysToTry.length; kIdx++) {
      const currentKey = keysToTry[kIdx];
      const modelsToTry = [...(await getActiveGeminiModels(currentKey))];

      for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
        const model = modelsToTry[mIdx];
        const maxAttempts = 2;
        let disableThinkingForThisModel = false;
        let fallbackMaxTokens = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            if (onStatusUpdate) {
              onStatusUpdate(attempt > 1 ? `⏳ Tentativa ${attempt} (${formatModelName(model)})...` : `⚡ Estruturando (${formatModelName(model)})...`);
            }

            // Se for modelo da Live API (WebSocket)
            const isLiveModel = model.includes('live') || model.includes('native-audio-dialog');
            if (isLiveModel) {
              try {
                const liveResult = await callGeminiLiveWebSocket(requestBody, currentKey, model, onStatusUpdate);
                if (liveResult && liveResult.responseJson) {
                  rememberWorkingModelForKey(model, currentKey);
                  updateTokenMonitorUI(model);
                  return liveResult;
                }
              } catch (wsErr) {
                console.warn(`Tentativa Live API via WebSocket com ${model} falhou, tentando fallback:`, wsErr);
              }
            }

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(currentKey)}`;
            // Garante maxOutputTokens no teto do modelo (65536) para NUNCA truncar ou resumir falas longas
            const maxSupported = fallbackMaxTokens || 65536;
            const bodyForModel = {
              ...requestBody,
              generationConfig: {
                ...(requestBody.generationConfig || {}),
                maxOutputTokens: Math.min(requestBody.generationConfig?.maxOutputTokens || 65536, maxSupported)
              }
            };
            if (!disableThinkingForThisModel && !model.includes('lite') && !model.includes('live') && !model.includes('transcribe') && !model.includes('gemma') && (model.startsWith('gemini-2.5') || model.startsWith('gemini-3')) && !bodyForModel.generationConfig.thinkingConfig) {
              bodyForModel.generationConfig.thinkingConfig = { thinkingBudget: 512 };
            }

            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(bodyForModel)
            });

            if (res.ok) {
              const responseJson = await res.json();
              rememberWorkingModelForKey(model, currentKey);
              updateTokenMonitorUI(model);
              return { responseJson, modelUsed: model };
            }

            const errData = await res.json().catch(() => ({}));
            const errMsg = errData?.error?.message || `HTTP ${res.status}`;

            // Se o erro indicar que o modelo aceita apenas BidiGenerateContent via WebSocket:
            if ((res.status === 400 || res.status === 404) && !isLiveModel && /bidi|websocket|live/i.test(errMsg)) {
              try {
                const liveResult = await callGeminiLiveWebSocket(bodyForModel, currentKey, model, onStatusUpdate);
                if (liveResult && liveResult.responseJson) {
                  rememberWorkingModelForKey(model, currentKey);
                  updateTokenMonitorUI(model);
                  return liveResult;
                }
              } catch (_) {}
            }

            if (res.status === 400 && errMsg.toLowerCase().includes('api key')) {
              if (kIdx === keysToTry.length - 1) {
                const elDaily = document.getElementById('dailyTokenCounter');
                if (elDaily) {
                  elDaily.textContent = `🔴 Chave API inválida`;
                  elDaily.style.color = '#dc2626';
                }
                throw new Error('Credencial de API inválida. Clique em "Credencial API" no topo para verificar.');
              }
              break;
            }

            // Caso um modelo específico não aceite thinkingConfig, reenvia imediatamente sem thinkingConfig
            if (res.status === 400 && !disableThinkingForThisModel && /thinking/i.test(errMsg)) {
              disableThinkingForThisModel = true;
              attempt--;
              continue;
            }

            // Caso um modelo tenha limite menor de maxOutputTokens (ex: 8192), ajusta imediatamente e reenvia
            if (res.status === 400 && !fallbackMaxTokens && /max_output_tokens|maxOutputTokens|token/i.test(errMsg)) {
              fallbackMaxTokens = 8192;
              attempt--;
              continue;
            }

            // Se o modelo não estiver disponível na conta (404 ou "no longer available to new users"):
            // 1) Marca como desativado permanentemente no navegador para NUNCA mais gerar erro 404
            // 2) Se a mensagem do Google indicar o modelo substituto (ex.: "use models/gemini-3.8-flash"), usa-o imediatamente!
            if (res.status === 404 || errMsg.toLowerCase().includes('no longer available') || errMsg.toLowerCase().includes('not found')) {
              markModelAsDisabledForKey(model, currentKey);
              const suggestedMatch = errMsg.match(/use\s+(?:models\/)?(gemini-[a-z0-9.-]+)/i);
              if (suggestedMatch && suggestedMatch[1]) {
                const suggestedModel = suggestedMatch[1].replace(/\.$/, '').trim();
                if (suggestedModel && !modelsToTry.includes(suggestedModel)) {
                  modelsToTry.splice(mIdx + 1, 0, suggestedModel);
                  rememberWorkingModelForKey(suggestedModel, currentKey);
                }
              }
              lastError = new Error(errMsg);
              break;
            }

            if (res.status === 429 || res.status === 503) {
              const elDaily = document.getElementById('dailyTokenCounter');
              const isZeroLimit = /\blimit:\s*0\b/i.test(errMsg);
              const isDailyQuota = /per day|daily|quota exceeded.*day|free_tier_requests|retry in \d+h|\blimit:\s*20\b/i.test(errMsg);

              // Se o modelo tem cota 0/0 na conta (limit: 0), desativa permanentemente para nunca mais tentar
              if (isZeroLimit) {
                markModelAsDisabledForKey(model, currentKey);
                lastError = new Error(`Limite (${res.status}): ${errMsg}`);
                break;
              }

              // Se atingiu o limite diário deste modelo específico (ex: 20/dia no gemini-3.6-flash ou 3.8-flash),
              // marca este modelo como esgotado hoje e pula IMEDIATAMENTE (0s de espera) para o próximo modelo da conta (ex: gemini-3.5-flash-lite com 500/dia)!
              if (isDailyQuota) {
                markModelExhaustedForToday(model, currentKey);
                allFailedByDailyQuota = true;
                const nextModel = modelsToTry[mIdx + 1] || (keysToTry[kIdx + 1] ? 'próxima chave' : '');
                if (elDaily && nextModel) {
                  elDaily.textContent = `🔄 ${formatModelName(model)} esgotado hoje (429). Alternando para ${formatModelName(nextModel)}...`;
                  elDaily.style.color = '#2563eb';
                }
                if (onStatusUpdate && nextModel) {
                  onStatusUpdate(`⚠️ Cota diária do ${formatModelName(model)} esgotada (429). Alternando para ${formatModelName(nextModel)}...`);
                }
                showToast(`⚠️ ${formatModelName(model)} esgotou cota diária (429). Alternando para ${formatModelName(nextModel)} para não perder o atendimento.`);
                lastError = new Error(`Limite (${res.status}): ${errMsg}`);
                break; // Sai imediatamente deste modelo e vai para o próximo modelo com cota livre!
              }

              allFailedByDailyQuota = false;
              if (elDaily) {
                if (res.status === 503) {
                  elDaily.textContent = `🟡 Servidor Google ocupado (alternando)...`;
                  elDaily.style.color = '#d97706';
                } else {
                  elDaily.textContent = `🟡 Aguardando limite por minuto...`;
                  elDaily.style.color = '#d97706';
                }
              }
              lastError = new Error(`Limite (${res.status}): ${errMsg}`);
              // Se houver outros modelos na fila, tenta apenas 1 vez rápido (2s) antes de pular para outro modelo!
              if (attempt < maxAttempts && mIdx === modelsToTry.length - 1) {
                const waitSec = res.status === 503 ? 3 : 4;
                if (onStatusUpdate) onStatusUpdate(`⏳ Aguardando servidor (${waitSec}s)...`);
                await sleep(waitSec * 1000);
                continue;
              }
              break;
            }

            allFailedByDailyQuota = false;
            lastError = new Error(errMsg);
            break;
          } catch (networkErr) {
            lastError = networkErr;
            if (networkErr.message && networkErr.message.includes('Credencial de API')) {
              throw networkErr;
            }
            if (attempt < maxAttempts) {
              if (onStatusUpdate) onStatusUpdate(`🌐 Reconectando em 3s...`);
              await sleep(3000);
            }
          }
        }
      }
    }

    if (allFailedByDailyQuota) {
      const elDaily = document.getElementById('dailyTokenCounter');
      if (elDaily) {
        elDaily.textContent = `🔴 Cota diária atingida (adicione outra chave em Credencial Ativa)`;
        elDaily.style.color = '#dc2626';
      }
    }

    throw lastError || new Error('Falha de conexão. Os arquivos permanecem salvos no disco para reprocessar.');
  }

  async function uploadLargeFileToGeminiFileAPI(blob, mimeType, apiKey) {
    const startUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${encodeURIComponent(apiKey)}`;
    const startRes = await fetch(startUrl, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(blob.size),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ file: { display_name: 'ubs_file_' + Date.now() } })
    });
    const uploadUrl = startRes.headers.get('X-Goog-Upload-URL');
    if (!uploadUrl) throw new Error('Falha ao iniciar upload de arquivo grande.');

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Length': String(blob.size),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize'
      },
      body: blob
    });
    const fileInfo = await uploadRes.json();
    return fileInfo?.file?.uri;
  }

  async function generateStateReferral() {
    if (!state.activeConsultationId) {
      alert('Selecione um atendimento primeiro para gerar o encaminhamento.');
      return;
    }
    const apiKey = getSavedApiKey();
    if (!apiKey) {
      openApiKeyModal();
      return;
    }

    const consult = await window.ScribeDB.getConsultation(state.activeConsultationId);
    if (!consult) return;

    const evolutionTextarea = document.getElementById('mainEvolutionEditor');
    const currentEvolutionText = (evolutionTextarea && evolutionTextarea.value.trim()) || consult.evolutionText;
    if (!currentEvolutionText) {
      alert('A evolução clínica ainda está vazia.');
      return;
    }

    const specialtySelect = document.getElementById('referralSpecialtySelect');
    const customSpecialty = document.getElementById('referralCustomSpecialty');
    const prioritySelect = document.getElementById('referralPrioritySelect');
    const extraDataInput = document.getElementById('referralExtraDataInput');
    const btnGenerate = document.getElementById('btnGenerateReferral');

    const especialidade = (customSpecialty && customSpecialty.value.trim())
      ? customSpecialty.value.trim()
      : (specialtySelect ? specialtySelect.value : 'Especialidade Médica');
    const prioridade = prioritySelect ? prioritySelect.value : 'Prioritário (Amarelo)';
    const dadosExtrasRegulacao = extraDataInput ? extraDataInput.value.trim() : '';

    if (btnGenerate) {
      btnGenerate.disabled = true;
      btnGenerate.textContent = '⏳ Formatando protocolo de Regulação Estadual...';
    }

    try {
      const prompt = window.buildReferralPrompt({
        templateId: consult.templateId,
        templateName: consult.templateName,
        evolucaoTexto: currentEvolutionText,
        especialidade,
        prioridade,
        dadosExtrasRegulacao,
        quickNotes: consult.quickNotes
      });

      const requestBody = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 }
      };

      const { responseJson } = await callGeminiWithFallbackAndRetry(requestBody, apiKey);
      const rawRefText = (responseJson?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
      const refText = rawRefText
        .replace(/^\d+\.\s*[A-ZÀ-Ú\s/()-]+:\s*\n?/gm, '')
        .replace(/^ENCAMINHAMENTO MÉDICO[^\n]*\n?/gim, '')
        .trim();
      const tokens = responseJson?.usageMetadata?.totalTokenCount || 800;

      if (!Array.isArray(consult.referrals)) {
        consult.referrals = [];
        if (consult.referralText) {
          consult.referrals.push({
            id: 'ref_legacy',
            specialty: consult.referralSpecialty || 'Especialidade',
            priority: 'Prioritário',
            text: consult.referralText,
            createdAt: consult.updatedAt || Date.now()
          });
        }
      }

      const newRefItem = {
        id: 'ref_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        specialty: especialidade,
        priority: prioridade,
        text: refText,
        createdAt: Date.now()
      };

      consult.referrals.push(newRefItem);
      consult.referralText = refText;
      consult.referralSpecialty = especialidade;
      await window.ScribeDB.saveConsultation(consult);
      addDailyTokenUsage(tokens);

      // Limpa campo customizado para facilitar gerar a próxima especialidade sem travar!
      if (customSpecialty) customSpecialty.value = '';

      state.activeReferralId = newRefItem.id;
      renderSavedReferralsForConsultation(consult);
      openSpecificReferralInEditor(consult, newRefItem.id);
      showToast(`🏛️ Encaminhamento #${consult.referrals.length} (${especialidade}) salvo!`);
    } catch (err) {
      alert('Erro ao gerar encaminhamento: ' + err.message);
    } finally {
      if (btnGenerate) {
        btnGenerate.disabled = false;
        btnGenerate.textContent = '🏛️ Gerar e Salvar Encaminhamento para esta Especialidade';
      }
    }
  }

  function toggleReferralDrawer(forceOpen) {
    const body = document.getElementById('referralDrawerBody');
    const btn = document.getElementById('referralDrawerToggleBtn');
    if (!body) return;
    const isHidden = body.style.display === 'none';
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : isHidden;
    body.style.display = shouldOpen ? 'block' : 'none';
    if (btn) {
      btn.textContent = shouldOpen ? '▲ Minimizar' : '▼ Abrir Encaminhamentos';
    }
  }

  function renderSavedReferralsForConsultation(consult) {
    const listWrap = document.getElementById('savedReferralsListContainer');
    const listEl = document.getElementById('savedReferralsList');
    const countBadge = document.getElementById('savedReferralsCountBadge');
    const outBox = document.getElementById('referralOutputContainer');

    let refs = Array.isArray(consult?.referrals) ? consult.referrals : [];
    if (refs.length === 0 && consult?.referralText) {
      refs = [{
        id: 'ref_legacy',
        specialty: consult.referralSpecialty || 'Especialidade',
        priority: 'Prioritário',
        text: consult.referralText,
        createdAt: consult.updatedAt || Date.now()
      }];
    }

    if (countBadge) {
      countBadge.textContent = `${refs.length} salvo(s)`;
    }

    if (!listWrap || !listEl) return;

    if (refs.length === 0) {
      listWrap.style.display = 'none';
      listEl.innerHTML = '';
      if (outBox) outBox.style.display = 'none';
      return;
    }

    listWrap.style.display = 'block';
    listEl.innerHTML = '';

    refs.forEach((refItem, idx) => {
      const row = document.createElement('div');
      row.className = `saved-ref-item ${state.activeReferralId === refItem.id ? 'active' : ''}`;
      row.innerHTML = `
        <div style="font-weight: 700; font-size: 13px; color: #3b0764;">
          ${idx + 1}. ${escapeHtml(refItem.specialty)}
          <span style="font-size: 11px; font-weight: 500; color: #6b21a8; margin-left: 6px;">(${escapeHtml(refItem.priority || '')})</span>
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
          <button type="button" class="btn btn-secondary btn-ref-open" style="padding: 4px 10px; font-size: 12px;">
            ${state.activeReferralId === refItem.id ? '👁️ Aberto' : 'Abrir'}
          </button>
          <button type="button" class="btn btn-primary btn-ref-copy" style="padding: 4px 10px; font-size: 12px;">
            📋 Copiar
          </button>
          <button type="button" class="btn btn-secondary btn-ref-del" style="padding: 4px 8px; font-size: 12px; color: #dc2626;" title="Excluir este encaminhamento">
            🗑️
          </button>
        </div>
      `;

      row.querySelector('.btn-ref-open').addEventListener('click', () => {
        if (state.activeReferralId === refItem.id) {
          state.activeReferralId = null;
          if (outBox) outBox.style.display = 'none';
          renderSavedReferralsForConsultation(consult);
        } else {
          openSpecificReferralInEditor(consult, refItem.id);
        }
      });

      row.querySelector('.btn-ref-copy').addEventListener('click', () => {
        copyToClipboard(refItem.text, `🏛️ Encaminhamento #${idx + 1} (${refItem.specialty}) copiado!`);
      });

      row.querySelector('.btn-ref-del').addEventListener('click', async () => {
        if (!confirm(`Excluir o encaminhamento "${idx + 1}. ${refItem.specialty}"?`)) return;
        consult.referrals = refs.filter(r => r.id !== refItem.id);
        if (consult.referrals.length === 0) {
          consult.referralText = '';
          consult.referralSpecialty = '';
        }
        if (state.activeReferralId === refItem.id) {
          state.activeReferralId = null;
          if (outBox) outBox.style.display = 'none';
        }
        await window.ScribeDB.saveConsultation(consult);
        renderSavedReferralsForConsultation(consult);
      });

      listEl.appendChild(row);
    });
  }

  function openSpecificReferralInEditor(consult, refId) {
    const refs = Array.isArray(consult?.referrals) ? consult.referrals : [];
    const target = refs.find(r => r.id === refId);
    const outBox = document.getElementById('referralOutputContainer');
    const editor = document.getElementById('referralResultEditor');
    const titleEl = document.getElementById('activeReferralTitleLabel');
    if (!target || !outBox || !editor) return;

    state.activeReferralId = refId;
    const idx = refs.indexOf(target) + 1;
    if (titleEl) {
      titleEl.textContent = `${idx}. Encaminhamento — ${target.specialty}:`;
    }
    editor.value = target.text;
    outBox.style.display = 'block';
    renderSavedReferralsForConsultation(consult);

    editor.oninput = async () => {
      target.text = editor.value;
      await window.ScribeDB.saveConsultation(consult);
    };
  }

  async function checkCrashRecoveryAndLoadHistory() {
    const all = await window.ScribeDB.getAllConsultations();
    let recoveredCount = 0;
    let nextDayAutoQueuedCount = 0;
    const todayStr = new Date().toDateString();

    for (const c of all) {
      if (c.status === 'recording' || c.status === 'uploading') {
        if (c.chunkCount > 0 || c.examFileCount > 0 || (c.quickNotes && c.quickNotes.trim())) {
          c.status = 'queued';
          c.errorMessage = 'Recuperado automaticamente do disco local';
          await window.ScribeDB.saveConsultation(c);
          recoveredCount++;
        } else {
          await window.ScribeDB.deleteConsultation(c.id);
        }
      } else if (c.status === 'error') {
        // Se falhou por limite de um modelo específico (ex: 429 limit: 20 no gemini-3.6-flash ou 404/503),
        // marca o modelo citado como esgotado hoje e coloca de volta na fila imediatamente para transcrever nos outros modelos!
        const errStr = String(c.errorMessage || '');
        const modelMatch = errStr.match(/model:\s*(?:models\/)?(gemini-[a-z0-9.-]+)/i);
        if (modelMatch && modelMatch[1]) {
          markModelExhaustedForToday(modelMatch[1].replace(/[.,;]+$/, ''), getSavedApiKey());
        }
        const lastAttemptDay = new Date(c.updatedAt || c.createdAt).toDateString();
        const isQuotaOrModelError = /429|503|404|quota|limite|no longer available|not found/i.test(errStr);
        if (lastAttemptDay !== todayStr || isQuotaOrModelError) {
          c.status = 'queued';
          c.errorMessage = '';
          c.updatedAt = Date.now();
          await window.ScribeDB.saveConsultation(c);
          nextDayAutoQueuedCount++;
        }
      } else if (c.status === 'done' && c.evolutionText) {
        let needsSave = false;
        // Repara automaticamente qualquer evolução anterior que tenha ficado com JSON bruto ou CID no meio do texto!
        if (c.evolutionText.includes('"evolucao_completa"') || /\((?:CID(?:-1[01])?|CIAP(?:-2)?)\s*:/i.test(c.evolutionText)) {
          if (c.evolutionText.includes('"evolucao_completa"')) {
            const repaired = parseGeminiEvolutionResponse(c.evolutionText);
            if (repaired.evolucao_completa) {
              c.evolutionText = repaired.evolucao_completa;
              if (repaired.transcricao_literal_do_audio && !c.rawTranscript) {
                c.rawTranscript = repaired.transcricao_literal_do_audio;
              }
            }
          }
          const { cleanText, codes } = cleanAndExtractCidFromEvolution(
            c.evolutionText,
            c.cidCiapCodes,
            c.templateId,
            c.previousConsultationText || '',
            c.soapSubtypeHeader || ''
          );
          c.evolutionText = cleanText;
          c.cidCiapCodes = codes;
          needsSave = true;
        }
        // Limpa automaticamente evoluções já geradas que tenham ficado com linguagem informal, exames laboratoriais prolixos, cabeçalho duplicado ou TC em ultrassonografia!
        if (
          c.evolutionText.includes('Exame físico não detalhado') ||
          c.evolutionText.includes('pruft') ||
          c.evolutionText.includes('desandou') ||
          c.evolutionText.includes('dor de barriga') ||
          c.evolutionText.includes('# Hipótese:') ||
          /ULTRASSONOGRAFIA\s*\n\s*-\s*TC\b/i.test(c.evolutionText) ||
          /Hemograma\s*\(/i.test(c.evolutionText)
        ) {
          const { cleanText, codes } = cleanAndExtractCidFromEvolution(
            c.evolutionText,
            c.cidCiapCodes,
            c.templateId,
            c.previousConsultationText || '',
            c.soapSubtypeHeader || ''
          );
          if (cleanText !== c.evolutionText) {
            c.evolutionText = cleanText;
            c.cidCiapCodes = codes;
            needsSave = true;
          }
        }

        // Se for uma consulta SOAP (não Pré-Natal) que tinha evolução anterior colada e copiou exames antigos por engano, limpa os exames antigos!
        if (c.templateId !== 'prenatal' && c.previousConsultationText && /(?:EXAMES COMPLEMENTARES|ULTRASSONOGRAFIA)/i.test(c.evolutionText)) {
          const cleanedSoap = enforcePreviousHeaderAndExams(c.evolutionText, c.previousConsultationText, c.templateId);
          if (cleanedSoap !== c.evolutionText) {
            c.evolutionText = cleanedSoap;
            needsSave = true;
          }
        }
        if (needsSave) {
          await window.ScribeDB.saveConsultation(c);
        }
      }
    }

    await refreshQueueSidebar();

    if (recoveredCount > 0 || nextDayAutoQueuedCount > 0) {
      const total = recoveredCount + nextDayAutoQueuedCount;
      showToast(`🔄 ${total} gravação(ões) pendente(s) entrou(aram) na fila automática de envio!`);
      if (getSavedApiKey()) {
        processQueueInBackground();
      }
    } else if ((await window.ScribeDB.getAllConsultations()).some(c => c.status === 'queued') && getSavedApiKey()) {
      processQueueInBackground();
    }
  }

  async function retryAllPendingConsultations() {
    const all = await window.ScribeDB.getAllConsultations();
    let count = 0;
    for (const c of all) {
      if (c.status === 'error') {
        c.status = 'queued';
        c.errorMessage = '';
        if (c.chunkCount > 0) {
          c.rawTranscript = ''; // Limpa transcrição prévia incompleta para forçar nova transcrição integral com o modelo ativo
        }
        c.updatedAt = Date.now();
        await window.ScribeDB.saveConsultation(c);
        count++;
      }
    }
    await refreshQueueSidebar();
    if (count > 0) {
      showToast(`🔄 Reenviando ${count} gravação(ões) pendente(s)...`);
      processQueueInBackground();
    }
  }

  // --- Navegação entre as 2 Telas ("Novo Atendimento" e "Meu Histórico") ---
  function switchMainPage(targetPageId) {
    const pageRec = document.getElementById('pageRecord');
    const pageHist = document.getElementById('pageHistory');
    const btnRec = document.getElementById('tabBtnRecord');
    const btnHist = document.getElementById('tabBtnHistory');

    if (targetPageId === 'pageHistory') {
      if (pageRec) pageRec.style.display = 'none';
      if (pageHist) pageHist.style.display = 'block';
      btnRec?.classList.remove('active');
      btnHist?.classList.add('active');
      refreshQueueSidebar();
    } else {
      if (pageRec) pageRec.style.display = 'block';
      if (pageHist) pageHist.style.display = 'none';
      btnRec?.classList.add('active');
      btnHist?.classList.remove('active');
    }
  }

  function closePatientDetailModal() {
    state.activeConsultationId = null;
    const modal = document.getElementById('patientDetailModal');
    if (modal) modal.style.display = 'none';
  }

  async function refreshQueueSidebar() {
    const listContainer = document.getElementById('consultationQueueList');
    if (!listContainer) return;

    const all = await window.ScribeDB.getAllConsultations();
    const countBadge = document.getElementById('queueTotalBadge');
    if (countBadge) countBadge.textContent = String(all.length);

    const errorCount = all.filter(c => c.status === 'error').length;
    const btnRetryAll = document.getElementById('btnRetryAllPending');
    if (btnRetryAll) {
      if (errorCount > 0) {
        btnRetryAll.style.display = 'inline-flex';
        btnRetryAll.textContent = `🔄 Enviar Pendentes (${errorCount})`;
      } else {
        btnRetryAll.style.display = 'none';
      }
    }

    const searchQuery = (document.getElementById('historySearchInput')?.value || '').toLowerCase().trim();
    const filterMode = document.getElementById('historyFilterSelect')?.value || 'all';
    const templateFilter = document.getElementById('historyTemplateFilter')?.value || 'all';
    const dateFilter = document.getElementById('historyDateFilter')?.value || ''; // YYYY-MM-DD

    const filtered = all.filter(item => {
      if (filterMode === 'pending_pec' && item.evolvedInPEC) return false;
      if (filterMode === 'done_pec' && !item.evolvedInPEC) return false;
      if (templateFilter !== 'all' && item.templateId !== templateFilter) return false;
      if (dateFilter) {
        const dt = new Date(item.createdAt);
        const yyyy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        if (`${yyyy}-${mm}-${dd}` !== dateFilter) return false;
      }
      if (searchQuery) {
        const dateStr = new Date(item.createdAt).toLocaleDateString('pt-BR');
        const hay = `${item.patientLabel} ${item.templateName} ${dateStr} ${item.evolutionText || ''}`.toLowerCase();
        if (!hay.includes(searchQuery)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="card" style="text-align: center; padding: 36px 20px; color: var(--text-muted);">
          <p style="font-size: 15px; font-weight: 700; margin-bottom: 4px;">Nenhum atendimento encontrado para este filtro.</p>
          <small>As evoluções ficam salvas automaticamente por 30 dias em Meu Histórico.</small>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = '';
    let lastDateHeader = '';

    filtered.forEach(item => {
      const dt = new Date(item.createdAt);
      const dateHeaderStr = dt.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }).toUpperCase();

      if (dateHeaderStr !== lastDateHeader) {
        lastDateHeader = dateHeaderStr;
        const headerEl = document.createElement('div');
        headerEl.className = 'date-group-header';
        headerEl.textContent = dateHeaderStr;
        listContainer.appendChild(headerEl);
      }

      const timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      // Cria um resumo de 2 linhas da Avaliação/Conduta ou Subjetivo para exibir no card (igual ao print 2)
      const isActivelyProcessingThis = (item.status === 'uploading' && state.activeProcessingProgress && state.activeProcessingProgress.consultId === item.id);
      const activePct = isActivelyProcessingThis ? Math.min(100, Math.max(0, Math.round(state.activeProcessingProgress.percent || 5))) : (item.status === 'uploading' ? 8 : 0);
      const activeStage = isActivelyProcessingThis
        ? (state.activeProcessingProgress.stageLabel || getStageDescriptionForPercent(activePct))
        : '🎙️ Transcrevendo e organizando evolução clínica...';

      let snippet = '';
      if (item.status === 'done' && item.evolutionText) {
        const cleanEvo = item.evolutionText
          .replace(/^#.*$/gm, '')
          .replace(/\n+/g, ' • ')
          .trim();
        snippet = cleanEvo.slice(0, 240);
      } else if (item.status === 'uploading') {
        snippet = `${activeStage} (${activePct}% concluído)`;
      } else if (item.status === 'queued') {
        snippet = 'Na fila — aguardando vez para transcrever e organizar (0%)...';
      } else if (item.status === 'error') {
        snippet = 'Pendente de processamento — clique para abrir e atualizar.';
      } else {
        snippet = 'Atendimento em andamento...';
      }

      let statusHTML = '';
      if (item.status === 'recording') {
        statusHTML = `<span class="q-status st-rec" id="qstatus_${item.id}">Em andamento</span>`;
      } else if (item.status === 'queued') {
        statusHTML = `<span class="q-status st-queue" id="qstatus_${item.id}">⏳ 0% Na fila</span>`;
      } else if (item.status === 'uploading') {
        statusHTML = `<span class="q-status st-up" id="qstatus_${item.id}">⚡ ${activePct}% — ${escapeHtml(activeStage.replace(/^[^\s]+\s*/, ''))}</span>`;
      } else if (item.status === 'done') {
        statusHTML = `<span class="q-status st-done" id="qstatus_${item.id}">✅ 100% Pronto</span>`;
      } else if (item.status === 'error') {
        statusHTML = `<span class="q-status st-err" id="qstatus_${item.id}">⚠️ Atualizar</span>`;
      }

      const pecBadge = item.evolvedInPEC
        ? `<span class="q-status st-done" style="background:#dcfce7;color:#166534;">☑️ Evoluído no PEC</span>`
        : `<span class="q-status" style="background:#f1f5f9;color:#475569;">📌 Falta Evoluir</span>`;

      const showProgressBar = (item.status === 'uploading' || item.status === 'queued');
      const card = document.createElement('div');
      card.className = 'history-card';
      card.innerHTML = `
        <div class="h-card-left">
          <div class="h-doc-icon">${item.templateIcon || '📄'}</div>
          <div class="h-card-body">
            <div class="h-patient-row">
              <span class="h-patient-name">${escapeHtml(item.patientLabel)}</span>
              <span class="h-tpl-tag">${escapeHtml(item.templateName)}</span>
              ${statusHTML}
              ${pecBadge}
            </div>
            <div class="h-snippet" id="qsnippet_${item.id}">${escapeHtml(snippet)}</div>
            <div id="qbar_wrap_${item.id}" style="display:${showProgressBar ? 'block' : 'none'};width:100%;max-width:440px;height:6px;background:#e0e7ff;border-radius:99px;overflow:hidden;margin-top:6px;">
              <div id="qbar_fill_${item.id}" style="width:${activePct}%;height:100%;background:linear-gradient(90deg,#4f46e5,#0d9488);border-radius:99px;transition:width 0.35s ease;"></div>
            </div>
          </div>
        </div>
        <div class="h-card-right">
          <span class="h-time">${timeStr}</span>
          <span style="color:#94a3b8;font-size:18px;font-weight:700;">›</span>
        </div>
      `;

      card.addEventListener('click', () => {
        selectConsultationToView(item.id);
      });
      listContainer.appendChild(card);
    });
  }

  async function selectConsultationToView(id) {
    state.activeConsultationId = id;
    const consult = await window.ScribeDB.getConsultation(id);
    await renderActiveConsultationView(consult);
  }

  async function renderActiveConsultationView(consult) {
    const modal = document.getElementById('patientDetailModal');
    if (!consult) {
      if (modal) modal.style.display = 'none';
      return;
    }

    if (modal) modal.style.display = 'flex';

    const dt = new Date(consult.createdAt);
    const fullDateStr = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) +
      ', ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    document.getElementById('viewPatientTitle').textContent = consult.patientLabel;
    document.getElementById('viewTemplateBadge').textContent = `${consult.templateIcon || '🩺'} ${consult.templateName}`;
    const viewDateEl = document.getElementById('viewDateLabel');
    if (viewDateEl) viewDateEl.textContent = fullDateStr;

    // Sincroniza a Barra de Troca de Modelo do Histórico
    const modalTplSelect = document.getElementById('modalChangeConsultationTemplate');
    const modalSoapSubtypeWrap = document.getElementById('modalSoapSubtypeWrapper');
    const modalSoapSubtypeSelect = document.getElementById('modalChangeSoapSubtype');
    if (modalTplSelect) {
      modalTplSelect.value = consult.templateId || 'geral';
      if (modalSoapSubtypeWrap) {
        modalSoapSubtypeWrap.style.display = (consult.templateId === 'geral' || !consult.templateId) ? 'inline-flex' : 'none';
      }
      if (modalSoapSubtypeSelect) {
        modalSoapSubtypeSelect.value = consult.soapSubtypeHeader || '## DEMANDA ESPONTÂNEA ##';
      }
    }

    const btnPec = document.getElementById('btnToggleEvolvedPEC');
    if (btnPec) {
      if (consult.evolvedInPEC) {
        btnPec.textContent = '☑️ Já Evoluído no PEC';
        btnPec.style.background = '#dcfce7';
        btnPec.style.color = '#166534';
      } else {
        btnPec.textContent = '📌 Marcar como Evoluído no PEC';
        btnPec.style.background = '#e2e8f0';
        btnPec.style.color = '#1e293b';
      }
    }

    const errBanner = document.getElementById('viewErrorBanner');
    if (consult.status === 'error') {
      errBanner.style.display = 'flex';
      document.getElementById('viewErrorText').textContent = `Registro salvo no disco local. Detalhe: ${consult.errorMessage}`;
    } else {
      errBanner.style.display = 'none';
    }

    const auditBox = document.getElementById('auditAlertsBox');
    if (consult.auditAlerts && consult.auditAlerts.length > 0) {
      auditBox.style.display = 'block';
      auditBox.innerHTML = `<strong>🔎 Revisão de Campos:</strong> ${consult.auditAlerts.map(a => `<span class="audit-tag">${escapeHtml(a)}</span>`).join(' ')}`;
    } else {
      auditBox.style.display = 'none';
    }

    const editor = document.getElementById('mainEvolutionEditor');
    const modalProgressBox = document.getElementById('modalLiveProgressBox');
    if (consult.status === 'uploading' || consult.status === 'queued') {
      const isCurrentActive = state.activeProcessingProgress && state.activeProcessingProgress.consultId === consult.id;
      const pct = isCurrentActive ? Math.round(state.activeProcessingProgress.percent || 5) : (consult.status === 'uploading' ? 5 : 0);
      const stage = isCurrentActive ? state.activeProcessingProgress.stageLabel : '⏳ Aguardando na fila para transcrever e organizar...';
      if (modalProgressBox) modalProgressBox.style.display = 'block';
      if (isCurrentActive) {
        updateLiveProcessingUI(state.activeProcessingProgress);
      } else {
        const modalStage = document.getElementById('modalProgressStageText');
        const modalPct = document.getElementById('modalProgressPercentText');
        const modalFill = document.getElementById('modalProgressBarFill');
        if (modalStage) modalStage.textContent = stage;
        if (modalPct) modalPct.textContent = `${pct}%`;
        if (modalFill) modalFill.style.width = `${pct}%`;
        editor.value = `⏳ [${pct}% CONCLUÍDO] ${stage}\n\nAguarde alguns instantes — a evolução organizada aparecerá nesta tela automaticamente assim que chegar em 100% (não é necessário clicar em Atualizar).`;
      }
    } else {
      if (modalProgressBox) modalProgressBox.style.display = 'none';
      editor.value = consult.evolutionText || '';
    }

    // Exibe os códigos CIAP-2 e CID-10 fora da evolução (em painel separado com cópia em 1 clique)
    const cidBox = document.getElementById('cidCiapOutsideBox');
    const cidList = document.getElementById('cidCiapChipsList');
    if (cidBox && cidList) {
      const codes = Array.isArray(consult.cidCiapCodes) ? consult.cidCiapCodes.filter(Boolean) : [];
      if (codes.length > 0) {
        cidBox.style.display = 'block';
        cidList.innerHTML = '';
        codes.forEach(codeStr => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn btn-secondary';
          btn.style.cssText = 'padding: 4px 10px; font-size: 12px; background: #ffffff; border-color: #86efac; color: #14532d; font-weight: 700;';
          btn.textContent = `📋 ${codeStr}`;
          btn.addEventListener('click', () => {
            copyToClipboard(codeStr, `🏷️ Código copiado: ${codeStr}`);
          });
          cidList.appendChild(btn);
        });
      } else {
        cidBox.style.display = 'none';
        cidList.innerHTML = '';
      }
    }

    const rawBox = document.getElementById('rawTranscriptBox');
    const rawTextEl = document.getElementById('rawTranscriptText');
    if (rawBox && rawTextEl) {
      if (consult.rawTranscript) {
        rawTextEl.textContent = consult.rawTranscript;
      } else {
        rawTextEl.textContent = 'Transcrição literal disponível nos novos atendimentos gravados.';
      }
    }

    if (consult.suggestedSpecialty) {
      const customSpec = document.getElementById('referralCustomSpecialty');
      if (customSpec && !customSpec.value) {
        customSpec.value = consult.suggestedSpecialty;
      }
    }

    state.activeReferralId = null;
    renderSavedReferralsForConsultation(consult);
    toggleReferralDrawer(false); // Inicia minimizado para deixar a tela limpa!

    const audioPlayer = document.getElementById('savedAudioPlayer');
    const btnDownloadAudio = document.getElementById('btnDownloadAudio');
    if (consult.chunkCount > 0 && !consult.audioDeleted) {
      const blob = await window.ScribeDB.assembleAudioBlob(consult.id, consult.mimeType);
      if (blob) {
        const url = URL.createObjectURL(blob);
        audioPlayer.src = url;
        audioPlayer.style.display = 'none'; // Oculto para manter discrição visual no consultório
        btnDownloadAudio.style.display = 'inline-flex';
        btnDownloadAudio.textContent = '⬇️ Arquivo';
        btnDownloadAudio.onclick = () => {
          const a = document.createElement('a');
          a.href = url;
          a.download = `${consult.patientLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}.webm`;
          a.click();
        };
      }
    } else {
      audioPlayer.style.display = 'none';
      btnDownloadAudio.style.display = 'none';
    }
  }

  function getCalculatedZScoreText(forcePreview = false) {
    if (state.selectedTemplateId === 'puericultura') {
      const sex = document.getElementById('zSex')?.value || 'M';
      const months = document.getElementById('zMonths')?.value;
      const birthGA = document.getElementById('zBirthGA')?.value;
      const weight = document.getElementById('zWeight')?.value;
      const height = document.getElementById('zHeight')?.value;
      const hc = document.getElementById('zHC')?.value;
      const includeZ = document.getElementById('chkIncludeZScoreInEvolution')?.checked;
      const feedingType = document.getElementById('pueriFeedingType')?.value || '';
      const formulaDetails = document.getElementById('pueriFormulaDetails')?.value.trim() || '';

      const lines = [];
      if (months !== undefined && months !== null && String(months).trim() !== '') {
        lines.push(`Idade da criança: ${months} meses${birthGA ? ` (IG ao nascer: ${birthGA} semanas)` : ''}`);
      }
      if (feedingType || formulaDetails) {
        lines.push(`Alimentação Infantil (incluir apenas no SUBJETIVO): ${feedingType}${formulaDetails ? ' — Detalhes (fórmula/volume/frequência): ' + formulaDetails : ''}`);
      }

      const hasAnyMeasure = Boolean(weight || height || hc);
      const hasMonths = months !== undefined && months !== null && String(months).trim() !== '';

      // Se o médico marcou "Incluir Z-Score desta calculadora no Objetivo" (ou no preview visual) E informou a idade + medidas:
      if (hasMonths && hasAnyMeasure && (includeZ || forcePreview)) {
        const calc = window.ZScoreCalculator.calculate({
          sex,
          months,
          birthGAWeeks: birthGA,
          weightKg: weight,
          heightCm: height,
          hcCm: hc
        });
        if (calc && calc.summaryText) {
          lines.push(calc.summaryText);
        }
      } else if (hasAnyMeasure) {
        // Caso não queira Z-Score automático, envia apenas as medidas brutas sem Z-Score!
        if (weight) lines.push(`Peso informado: ${weight}`);
        if (height) lines.push(`Altura/Comprimento informado: ${height} cm`);
        if (hc) lines.push(`PC informado: ${hc} cm`);
      }
      return lines.join('\n');
    }

    if (state.selectedTemplateId === 'prenatal') {
      const pnCalc = calculatePrenatalGestationalAge();
      const ig = document.getElementById('pnIG')?.value.trim() || (pnCalc ? pnCalc.finalIgShort : '');
      const pa = document.getElementById('pnPA')?.value.trim() || '';
      const weight = document.getElementById('pnWeight')?.value.trim() || '';
      const au = document.getElementById('pnAU')?.value.trim() || '';
      const bcf = document.getElementById('pnBCF')?.value.trim() || '';
      const mf = document.getElementById('pnMF')?.value || '';
      const edema = document.getElementById('pnEdema')?.value || '';

      if (!pnCalc && !ig && !pa && !weight && !au && !bcf) return '';
      const pnLines = ['DADOS OBJETIVOS E CÁLCULO OBSTÉTRICO (PROTOCOLO FEBRASGO / MINISTÉRIO DA SAÚDE) INFORMADOS PELO MÉDICO:'];
      if (pnCalc && pnCalc.evolutionHeaderBlock) {
        pnLines.push(pnCalc.evolutionHeaderBlock);
      } else if (ig) {
        pnLines.push(`- IG atual: ${ig}`);
      }
      if (au) pnLines.push(`- AU: ${au} cm`);
      if (bcf) pnLines.push(`- BCF: ${bcf} bpm`);
      if (mf) pnLines.push(`- MF: ${mf}`);
      if (edema) pnLines.push(`- Edema em membros inferiores: ${edema}`);
      if (weight) pnLines.push(`- Peso: ${weight} kg`);
      if (pa) pnLines.push(`- PA: ${pa} mmHg`);
      return pnLines.join('\n');
    }

    return '';
  }

  // ============================================================================
  // CALCULADORA DE IDADE GESTACIONAL (IG) E DPP — PROTOCOLO FEBRASGO / MS
  // ============================================================================
  function parseLocalNoonDate(isoStr) {
    if (!isoStr || typeof isoStr !== 'string') return null;
    const parts = isoStr.split('-');
    if (parts.length !== 3) return null;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
    return new Date(y, m - 1, d, 12, 0, 0);
  }

  function formatDateBR(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = dateObj.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  function formatIGWeeksDays(totalDays) {
    const safe = Math.max(0, Math.round(totalDays));
    const w = Math.floor(safe / 7);
    const d = safe % 7;
    return {
      weeks: w,
      days: d,
      w,
      d,
      shortText: `${w}s ${d}d`,
      longText: `${w} sem e ${d} dias`
    };
  }

  function getFebrasgoRedatingRule(usgAtExamDays) {
    // Critérios oficiais FEBRASGO / Ministério da Saúde / ACOG para redatação pela Ecografia:
    if (usgAtExamDays <= 62) {
      return { maxToleranceDays: 5, phaseLabel: '1º Trimestre precoce (até 8s 6d — CCN)' };
    }
    if (usgAtExamDays <= 97) {
      return { maxToleranceDays: 7, phaseLabel: '1º Trimestre (9s 0d a 13s 6d — CCN)' };
    }
    if (usgAtExamDays <= 111) {
      return { maxToleranceDays: 7, phaseLabel: '2º Trimestre inicial (14s 0d a 15s 6d)' };
    }
    if (usgAtExamDays <= 153) {
      return { maxToleranceDays: 10, phaseLabel: '2º Trimestre (16s 0d a 21s 6d)' };
    }
    if (usgAtExamDays <= 195) {
      return { maxToleranceDays: 14, phaseLabel: '2º Trimestre tardio (22s 0d a 27s 6d)' };
    }
    return { maxToleranceDays: 21, phaseLabel: '3º Trimestre (≥ 28s 0d — atenção: baixa precisão p/ redatação; avaliar RCIU)' };
  }

  function calculatePrenatalGestationalAge() {
    const dumStr = document.getElementById('pnDUM')?.value || '';
    const cycleRaw = parseInt(document.getElementById('pnCycleDays')?.value, 10);
    const cycleDays = (!isNaN(cycleRaw) && cycleRaw >= 15 && cycleRaw <= 60) ? cycleRaw : 28;

    const usgDateStr = document.getElementById('pnUsgDate')?.value || '';
    const usgWeeksVal = document.getElementById('pnUsgWeeks')?.value;
    const usgDaysVal = document.getElementById('pnUsgDays')?.value;

    const now = new Date();
    const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);

    // 1. Cálculo pela DUM (com ajuste pela duração do ciclo menstrual — Regra de Naegele modificada / FEBRASGO)
    let dumResult = null;
    const dumDate = parseLocalNoonDate(dumStr);
    if (dumDate && dumDate <= todayNoon) {
      const rawDaysFromDUM = Math.round((todayNoon - dumDate) / 86400000);
      // Ovulação ocorre ~14 dias antes da menstruação seguinte -> deslocamento = (cycleDays - 28) dias
      const cycleAdjustment = cycleDays - 28;
      const adjustedDaysFromDUM = Math.max(0, rawDaysFromDUM - cycleAdjustment);
      const dppAdjustedDate = new Date(dumDate.getTime() + (280 + cycleAdjustment) * 86400000);
      const dppStandard28Date = new Date(dumDate.getTime() + 280 * 86400000);

      dumResult = {
        dumDate,
        dumDateBR: formatDateBR(dumDate),
        cycleDays,
        cycleAdjustment,
        rawDaysFromDUM,
        rawIG: formatIGWeeksDays(rawDaysFromDUM),
        adjustedDaysFromDUM,
        adjustedIG: formatIGWeeksDays(adjustedDaysFromDUM),
        dppAdjustedBR: formatDateBR(dppAdjustedDate),
        dppStandard28BR: formatDateBR(dppStandard28Date)
      };
    }

    // 2. Cálculo pela Ecografia Obstétrica Anterior (USG)
    let usgResult = null;
    const usgDate = parseLocalNoonDate(usgDateStr);
    const hasUsgWeeks = usgWeeksVal !== undefined && usgWeeksVal !== null && String(usgWeeksVal).trim() !== '';
    if (usgDate && hasUsgWeeks && usgDate <= todayNoon) {
      const usgW = Math.max(0, parseInt(usgWeeksVal, 10) || 0);
      const usgD = Math.min(6, Math.max(0, parseInt(usgDaysVal, 10) || 0));
      const usgAtExamDays = (usgW * 7) + usgD;
      const daysElapsedSinceUsg = Math.round((todayNoon - usgDate) / 86400000);
      const totalDaysByUsgToday = usgAtExamDays + daysElapsedSinceUsg;
      const dppUsgDate = new Date(usgDate.getTime() + (280 - usgAtExamDays) * 86400000);

      usgResult = {
        usgDate,
        usgDateBR: formatDateBR(usgDate),
        usgW,
        usgD,
        usgAtExamDays,
        usgAtExamShort: `${usgW}s ${usgD}d`,
        usgAtExamLong: `${usgW} sem e ${usgD} dias`,
        totalDaysByUsgToday,
        currentIG: formatIGWeeksDays(totalDaysByUsgToday),
        dppUsgBR: formatDateBR(dppUsgDate)
      };
    }

    if (!dumResult && !usgResult) return null;

    // 3. Comparação DUM vs Ecografia e Protocolo Oficial de Redatação (FEBRASGO / Ministério da Saúde)
    const previewLines = [];
    const headerLines = [];
    let finalIgShort = '';
    let finalDppBR = '';
    let decisionSummary = '';

    if (dumResult) {
      const cycleNote = dumResult.cycleDays !== 28
        ? ` (Ciclo de ${dumResult.cycleDays}d -> ajuste ovulatório de ${dumResult.cycleAdjustment > 0 ? '+' : ''}${dumResult.cycleAdjustment}d; sem ajuste 28d seria ${dumResult.rawIG.shortText})`
        : ' (Ciclo regular 28 dias)';
      previewLines.push(`📅 Pela DUM (${dumResult.dumDateBR})${cycleNote}: IG Hoje = ${dumResult.adjustedIG.longText} (${dumResult.adjustedIG.w}+${dumResult.adjustedIG.d}) | DPP (DUM) = ${dumResult.dppAdjustedBR}`);
      headerLines.push(`# IG ${dumResult.adjustedIG.w}+${dumResult.adjustedIG.d} POR DUM EM ${dumResult.dumDateBR}${dumResult.cycleDays !== 28 ? ` (CICLO ${dumResult.cycleDays} DIAS)` : ''}`);
    }

    if (usgResult) {
      const usgWPad = String(usgResult.usgW).padStart(2, '0');
      const usgDaysPart = usgResult.usgD > 0 ? ` E ${usgResult.usgD} DIAS` : '';
      previewLines.push(`🖥️ Pela Ecografia (${usgResult.usgDateBR} com ${usgResult.usgAtExamLong}): IG Hoje = ${usgResult.currentIG.longText} (${usgResult.currentIG.w}+${usgResult.currentIG.d}) | DPP (Eco) = ${usgResult.dppUsgBR}`);
      headerLines.push(`# IG ${usgResult.currentIG.w}+${usgResult.currentIG.d} POR ECO COM ${usgWPad} SEM${usgDaysPart} EM ${usgResult.usgDateBR}`);
    }

    if (dumResult && usgResult) {
      const diffDays = Math.abs(dumResult.adjustedDaysFromDUM - usgResult.totalDaysByUsgToday);
      const rule = getFebrasgoRedatingRule(usgResult.usgAtExamDays);
      if (diffDays > rule.maxToleranceDays) {
        finalIgShort = `${usgResult.currentIG.shortText} (por Eco — DPP ${usgResult.dppUsgBR})`;
        finalDppBR = usgResult.dppUsgBR;
        decisionSummary = `✅ CONDUTA FEBRASGO / MS: REDATAR PELA ECOGRAFIA! Discrepância de ${diffDays} dias (> ${rule.maxToleranceDays} dias tolerados no ${rule.phaseLabel}).\n👉 IG Oficial Considerada Hoje: ${usgResult.currentIG.longText} (${usgResult.currentIG.shortText}) | DPP Oficial: ${usgResult.dppUsgBR}`;
        headerLines.push(`# IG CONSIDERADA (CRITÉRIO FEBRASGO/MS): ${usgResult.currentIG.longText} (Redatada pela Eco — discrepância de ${diffDays}d > ${rule.maxToleranceDays}d) | DPP: ${usgResult.dppUsgBR}`);
      } else {
        finalIgShort = `${dumResult.adjustedIG.shortText} (por DUM — DPP ${dumResult.dppAdjustedBR})`;
        finalDppBR = dumResult.dppAdjustedBR;
        decisionSummary = `✅ CONDUTA FEBRASGO / MS: MANTER IG PELA DUM! Discrepância de ${diffDays} dia(s) está dentro do limite de até ${rule.maxToleranceDays} dias para ${rule.phaseLabel}.\n👉 IG Oficial Considerada Hoje: ${dumResult.adjustedIG.longText} (${dumResult.adjustedIG.shortText}) | DPP Oficial: ${dumResult.dppAdjustedBR}`;
        headerLines.push(`# IG CONSIDERADA (CRITÉRIO FEBRASGO/MS): ${dumResult.adjustedIG.longText} (Mantida pela DUM — discrepância de ${diffDays}d <= ${rule.maxToleranceDays}d) | DPP: ${dumResult.dppAdjustedBR}`);
      }
      previewLines.push(decisionSummary);
    } else if (dumResult) {
      finalIgShort = `${dumResult.adjustedIG.shortText} (por DUM — DPP ${dumResult.dppAdjustedBR})`;
      finalDppBR = dumResult.dppAdjustedBR;
      previewLines.push(`👉 IG Considerada Hoje (pela DUM): ${dumResult.adjustedIG.longText} | DPP: ${dumResult.dppAdjustedBR}`);
    } else if (usgResult) {
      finalIgShort = `${usgResult.currentIG.shortText} (por Eco — DPP ${usgResult.dppUsgBR})`;
      finalDppBR = usgResult.dppUsgBR;
      previewLines.push(`👉 IG Considerada Hoje (pela Ecografia): ${usgResult.currentIG.longText} | DPP: ${usgResult.dppUsgBR}`);
    }

    return {
      dumResult,
      usgResult,
      finalIgShort,
      finalDppBR,
      previewText: previewLines.join('\n'),
      evolutionHeaderBlock: [
        'CÁLCULO OBSTÉTRICO DE IDADE GESTACIONAL E DPP (INCLUIR NAS LINHAS "#" DO TOPO DA EVOLUÇÃO DE PRÉ-NATAL):',
        ...headerLines
      ].join('\n')
    };
  }

  function updatePrenatalLivePreview() {
    const previewEl = document.getElementById('pnCalcPreviewResult');
    const igInput = document.getElementById('pnIG');
    const calc = calculatePrenatalGestationalAge();
    if (!calc) {
      if (previewEl) {
        previewEl.textContent = 'Preencha a DUM ou a Ecografia acima para calcular a IG e a DPP.';
      }
      return;
    }
    if (previewEl) {
      previewEl.textContent = calc.previewText;
    }
    if (igInput) {
      igInput.value = calc.finalIgShort;
    }
  }

  function updateZScoreLivePreview() {
    const preview = document.getElementById('zScorePreviewResult');
    if (!preview) return;
    const includeZ = document.getElementById('chkIncludeZScoreInEvolution')?.checked;
    const text = getCalculatedZScoreText(true);
    if (!text) {
      preview.textContent = 'Preencha os dados acima para calcular.';
      return;
    }
    preview.textContent = includeZ
      ? `✅ Z-Score incluído no Objetivo:\n${text}`
      : `${text}`;
  }

  function clearZScoreInputs() {
    ['zMonths', 'zBirthGA', 'zWeight', 'zHeight', 'zHC', 'pueriFeedingType', 'pueriFormulaDetails', 'pnDUM', 'pnUsgDate', 'pnUsgWeeks', 'pnUsgDays', 'pnIG', 'pnPA', 'pnWeight', 'pnAU', 'pnBCF'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const mfEl = document.getElementById('pnMF');
    if (mfEl) mfEl.value = 'Presente';
    const edemaEl = document.getElementById('pnEdema');
    if (edemaEl) edemaEl.value = 'Ausente';
    const cycleEl = document.getElementById('pnCycleDays');
    if (cycleEl) cycleEl.value = '28';
    const chkZ = document.getElementById('chkIncludeZScoreInEvolution');
    if (chkZ) chkZ.checked = false;
    updateZScoreLivePreview();
    updatePrenatalLivePreview();
    updateQuickNotesExamBadge();
  }

  function getSavedApiKeysList(overrideRaw) {
    const raw = String(overrideRaw || localStorage.getItem('ubs_gemini_api_key') || sessionStorage.getItem('ubs_gemini_api_key') || '').trim();
    if (!raw) return [];
    const matches = raw.match(/AIza[0-9A-Za-z_-]{20,}/g);
    if (matches && matches.length > 0) {
      return [...new Set(matches)];
    }
    return [raw];
  }

  function getSavedApiKey() {
    const list = getSavedApiKeysList();
    return list[0] || '';
  }

  // Integração oficial com o Gerenciador de Senhas do Google Chrome (Credential Management API)
  async function tryRestoreApiKeyFromChromeCredentialManager() {
    if (getSavedApiKey()) return;
    try {
      if (navigator.credentials && navigator.credentials.get && window.PasswordCredential) {
        const cred = await navigator.credentials.get({ password: true, mediation: 'optional' });
        if (cred && cred.password && cred.password.startsWith('AIza')) {
          localStorage.setItem('ubs_gemini_api_key', cred.password);
          updateApiKeyStatusBadge();
          showToast('🔑 Chave Gemini recuperada automaticamente do Gerenciador de Senhas do Chrome!');
        }
      }
    } catch (_) {}
  }

  // ============================================================================
  // SINCRONIZAÇÃO EM NUVEM POR PIN FIXO PESSOAL (AES-256-GCM + NUVEM INSTANTÂNEA)
  // ============================================================================
  function getSavedSyncPin() {
    return (localStorage.getItem('ubs_sync_fixed_pin') || '').trim();
  }

  function setSavedSyncPin(pin) {
    const clean = (pin || '').trim();
    if (clean) {
      localStorage.setItem('ubs_sync_fixed_pin', clean);
    } else {
      localStorage.removeItem('ubs_sync_fixed_pin');
    }
  }

  // Gera tópico anônimo determinístico via SHA-256 do PIN para ninguém descobrir o endereço na nuvem
  async function getTopicForPin(pin) {
    const enc = new TextEncoder();
    const data = enc.encode('ubs_plantao_secret_salt_2026_' + pin.trim().toLowerCase());
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return 'ubs_plantao_' + hashHex.slice(0, 24);
  }

  function uint8ArrayToBase64(uint8) {
    let binary = '';
    const len = uint8.byteLength;
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
      const chunk = uint8.subarray(i, Math.min(i + chunkSize, len));
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  }

  function base64ToUint8Array(base64) {
    const binary = atob(base64.replace(/\s+/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // Criptografa o JSON com AES-256-GCM usando chave derivada de PBKDF2 (50.000 iterações)
  async function encryptWithPin(plainText, pin) {
    const enc = new TextEncoder();
    const pinBytes = enc.encode(pin.trim());
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      pinBytes,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const key = await window.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 50000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(plainText)
    );

    const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

    return uint8ArrayToBase64(combined);
  }

  // Descriptografa os dados com o PIN
  async function decryptWithPin(base64Cipher, pin) {
    const combined = base64ToUint8Array(base64Cipher);
    if (combined.length < 28) {
      throw new Error('Arquivo de plantão corrompido ou incompleto.');
    }

    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const ciphertext = combined.slice(28);

    const enc = new TextEncoder();
    const pinBytes = enc.encode(pin.trim());

    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      pinBytes,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const key = await window.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 50000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  }

  async function pushConsultationsToCloud(silent = false) {
    const pinInput = document.getElementById('syncFixedPinInput');
    let pin = (pinInput?.value || '').trim() || getSavedSyncPin();
    const statusEl = document.getElementById('cloudSyncStatusText');

    if (!pin) {
      if (!silent) {
        if (statusEl) {
          statusEl.innerHTML = '⚠️ <strong>Por favor, defina seu PIN Fixo no campo acima</strong> antes de salvar.';
        }
        pinInput?.focus();
      }
      return;
    }
    setSavedSyncPin(pin);

    if (!silent && statusEl) {
      statusEl.textContent = '🔒 Criptografando atendimentos com seu PIN e enviando para a nuvem...';
    }

    try {
      const all = await window.ScribeDB.getAllConsultations();
      const recent = all.slice(0, 60);
      const syncItems = [];

      for (const c of recent) {
        const copy = {
          id: c.id,
          patientLabel: c.patientLabel,
          templateId: c.templateId,
          templateName: c.templateName,
          templateIcon: c.templateIcon,
          soapSubtypeHeader: c.soapSubtypeHeader || '',
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          status: c.status === 'uploading' ? 'queued' : c.status,
          durationSeconds: c.durationSeconds,
          mimeType: c.mimeType,
          quickNotes: c.quickNotes || '',
          previousConsultationText: c.previousConsultationText || '',
          preTranscribedExamsText: c.preTranscribedExamsText || '',
          zScoreSummary: c.zScoreSummary || '',
          evolutionText: c.evolutionText || '',
          cidCiapCodes: c.cidCiapCodes || [],
          rawTranscript: c.rawTranscript || '',
          referrals: c.referrals || c.savedReferrals || [],
          savedReferrals: c.referrals || c.savedReferrals || [],
          referralText: c.referralText || '',
          referralSpecialty: c.referralSpecialty || '',
          evolvedInPEC: Boolean(c.evolvedInPEC),
          evolvedAt: c.evolvedAt || null
        };

        // Se ainda não foi transcrito e tem áudio recente, embute para poder transcrever em casa
        if (c.status !== 'done' && c.chunkCount > 0 && !c.audioDeleted) {
          try {
            const blob = await window.ScribeDB.assembleAudioBlob(c.id, c.mimeType);
            if (blob && blob.size > 0 && blob.size < 12 * 1024 * 1024) {
              copy.embeddedAudioBase64 = await blobToBase64(blob);
            }
          } catch (_) {}
        }

        syncItems.push(copy);
      }

      const payloadRaw = JSON.stringify({
        syncVersion: 2,
        syncedAt: Date.now(),
        consultations: syncItems
      });

      // Criptografia AES-256 de ponta a ponta com o PIN fixo do médico
      const encryptedData = await encryptWithPin(payloadRaw, pin);
      const topic = await getTopicForPin(pin);

      const res = await fetch(`https://ntfy.sh/${topic}`, {
        method: 'POST',
        headers: {
          'Title': 'Plantao UBS Sincronizado',
          'Priority': 'low',
          'Tags': 'hospital,stethoscope'
        },
        body: encryptedData
      });

      if (!res.ok) {
        throw new Error(`Servidor de sincronização retornou status ${res.status}`);
      }

      const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      if (!silent) {
        if (statusEl) {
          statusEl.innerHTML = `✅ <strong>${syncItems.length} atendimento(s) salvos na nuvem às ${timeStr}!</strong><br>Ao chegar em casa, abra o sistema com o seu PIN e clique em <em>"Puxar Plantão em Casa"</em>.`;
        }
        showToast(`☁️ Plantão (${syncItems.length} atendimentos) sincronizado na nuvem!`);
      }
    } catch (err) {
      if (!silent && statusEl) {
        statusEl.textContent = `⚠️ Erro ao salvar na nuvem: ${err.message}. Você também pode usar a Opção 2 (Baixar Arquivo) abaixo.`;
      }
    }
  }

  async function pullConsultationsFromCloud() {
    const pinInput = document.getElementById('syncFixedPinInput');
    let pin = (pinInput?.value || '').trim() || getSavedSyncPin();
    const statusEl = document.getElementById('cloudSyncStatusText');

    if (!pin) {
      if (statusEl) {
        statusEl.innerHTML = '⚠️ <strong>Digite seu PIN Fixo no campo acima</strong> (o mesmo que você usou no Posto).';
      }
      pinInput?.focus();
      return;
    }
    setSavedSyncPin(pin);

    if (statusEl) {
      statusEl.textContent = '⏳ Conectando à nuvem e localizando seu plantão com seu PIN...';
    }

    try {
      const topic = await getTopicForPin(pin);
      const res = await fetch(`https://ntfy.sh/${topic}/json?poll=1`);
      if (!res.ok) {
        throw new Error(`Erro ao conectar à nuvem (${res.status})`);
      }

      const text = await res.text();
      const lines = text.trim().split('\n').filter(Boolean);
      if (lines.length === 0) {
        if (statusEl) {
          statusEl.textContent = 'ℹ️ Nenhum plantão recente encontrado para este PIN. No computador do posto, clique em "Salvar Plantão no Posto" antes de sair.';
        }
        return;
      }

      // Encontra a mensagem mais recente enviada para o tópico do PIN
      let latestMsg = null;
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const obj = JSON.parse(lines[i]);
          if (obj.event === 'message') {
            latestMsg = obj;
            break;
          }
        } catch (_) {}
      }

      if (!latestMsg) {
        throw new Error('Nenhum dado de plantão válido encontrado no servidor.');
      }

      let encryptedPayload = '';
      if (latestMsg.attachment && latestMsg.attachment.url) {
        if (statusEl) statusEl.textContent = '⏳ Baixando pacote do plantão da nuvem...';
        const attRes = await fetch(latestMsg.attachment.url);
        if (!attRes.ok) throw new Error('Falha ao baixar pacote completo do plantão.');
        encryptedPayload = await attRes.text();
      } else {
        encryptedPayload = latestMsg.message || '';
      }

      if (!encryptedPayload) {
        throw new Error('Conteúdo vazio recebido do servidor.');
      }

      if (statusEl) statusEl.textContent = '🔓 Descriptografando atendimentos com seu PIN...';
      let decryptedRaw = '';
      try {
        decryptedRaw = await decryptWithPin(encryptedPayload, pin);
      } catch (decErr) {
        throw new Error('PIN incorreto ou dados corrompidos. Verifique se o PIN digitado é exatamente o mesmo cadastrado no Posto.');
      }

      const parsed = JSON.parse(decryptedRaw);
      const remoteList = Array.isArray(parsed.consultations) ? parsed.consultations : [];

      let importedCount = 0;
      for (const item of remoteList) {
        if (!item || !item.id) continue;
        const local = await window.ScribeDB.getConsultation(item.id);
        const embeddedB64 = item.embeddedAudioBase64;
        delete item.embeddedAudioBase64;

        if (!local || (item.updatedAt || 0) > (local.updatedAt || 0) || (!local.evolutionText && item.evolutionText)) {
          await window.ScribeDB.saveConsultation({
            ...(local || {}),
            ...item
          });
          if (embeddedB64) {
            try {
              const byteChars = atob(embeddedB64);
              const byteNumbers = new Array(byteChars.length);
              for (let i = 0; i < byteChars.length; i++) {
                byteNumbers[i] = byteChars.charCodeAt(i);
              }
              const audioBlob = new Blob([new Uint8Array(byteNumbers)], { type: item.mimeType || 'audio/webm' });
              await window.ScribeDB.saveAudioChunk(item.id, 0, audioBlob, item.mimeType || 'audio/webm');
            } catch (_) {}
          }
          importedCount++;
        }
      }

      await refreshQueueSidebar();
      updateStorageStatsUI();

      if (statusEl) {
        statusEl.innerHTML = `✅ <strong>${remoteList.length} atendimento(s) sincronizados com sucesso (${importedCount} novos/atualizados)!</strong><br>Disponíveis agora no seu <em>"Meu Histórico"</em> para evoluir no PEC.`;
      }
      showToast(`📥 ${remoteList.length} atendimento(s) puxados da nuvem com sucesso!`);
      switchMainPage('pageHistory');
      processQueueInBackground();
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = `⚠️ Falha ao puxar da nuvem: ${err.message}`;
      }
    }
  }

  // Aliases para compatibilidade reversa
  const pushConsultationsToGeminiCloud = pushConsultationsToCloud;
  const pullConsultationsFromGeminiCloud = pullConsultationsFromCloud;

  async function exportPlantaoToFile() {
    try {
      const all = await window.ScribeDB.getAllConsultations();
      const exportList = [];
      for (const c of all.slice(0, 60)) {
        const copy = { ...c };
        // Se o atendimento ainda não foi transcrito e tem áudio no disco, embute o áudio em base64 para poder transcrever em casa!
        if (c.status !== 'done' && c.chunkCount > 0 && !c.audioDeleted) {
          const blob = await window.ScribeDB.assembleAudioBlob(c.id, c.mimeType);
          if (blob && blob.size > 0 && blob.size < 25 * 1024 * 1024) {
            copy.embeddedAudioBase64 = await blobToBase64(blob);
          }
        }
        exportList.push(copy);
      }

      const dataStr = JSON.stringify({
        ubsExportVersion: 1,
        exportedAt: Date.now(),
        consultations: exportList
      }, null, 2);

      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const a = document.createElement('a');
      a.href = url;
      a.download = `Plantao_UBS_${dateStr}.ubs.json`;
      a.click();
      showToast(`📤 Arquivo do plantão (${exportList.length} pacientes) baixado!`);
    } catch (err) {
      alert('Erro ao exportar plantão: ' + err.message);
    }
  }

  async function importPlantaoFromFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed.consultations) ? parsed.consultations : [];
      let count = 0;

      for (const item of list) {
        if (!item || !item.id) continue;
        const embeddedB64 = item.embeddedAudioBase64;
        delete item.embeddedAudioBase64;

        await window.ScribeDB.saveConsultation(item);
        if (embeddedB64) {
          const byteChars = atob(embeddedB64);
          const byteNumbers = new Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) {
            byteNumbers[i] = byteChars.charCodeAt(i);
          }
          const audioBlob = new Blob([new Uint8Array(byteNumbers)], { type: item.mimeType || 'audio/webm' });
          await window.ScribeDB.saveAudioChunk(item.id, 0, audioBlob, item.mimeType || 'audio/webm');
        }
        count++;
      }

      await refreshQueueSidebar();
      updateStorageStatsUI();
      document.getElementById('cloudSyncModal').style.display = 'none';
      switchMainPage('pageHistory');
      showToast(`📂 ${count} atendimento(s) importados para este computador!`);
      processQueueInBackground();
    } catch (err) {
      alert('Arquivo de plantão inválido: ' + err.message);
    }
  }

  function updateApiKeyStatusBadge() {
    const key = getSavedApiKey();
    const btn = document.getElementById('btnOpenApiKeyModal');
    if (!btn) return;
    if (key) {
      btn.innerHTML = `🔒 Credencial Ativa`;
      btn.classList.add('key-ok');
    } else {
      btn.innerHTML = `🔑 Credencial API`;
      btn.classList.remove('key-ok');
    }
  }

  function openApiKeyModal() {
    const modal = document.getElementById('apiKeyModal');
    const input = document.getElementById('apiKeyInput');
    if (input) input.value = getSavedApiKey();
    const sel = document.getElementById('preferredModelSelect');
    if (sel) sel.value = localStorage.getItem('ubs_preferred_model') || 'auto';
    if (modal) modal.style.display = 'flex';
  }

  function bindUIEvents() {
    document.getElementById('btnStartRec')?.addEventListener('click', startRecording);
    document.getElementById('btnPauseRec')?.addEventListener('click', togglePauseRecording);
    document.getElementById('btnStopRec')?.addEventListener('click', finishRecordingAndQueue);
    document.getElementById('btnCancelRec')?.addEventListener('click', cancelCurrentRecording);
    document.getElementById('btnClearAllSheetTop')?.addEventListener('click', clearAllCurrentSheet);
    document.getElementById('btnClearAllSheetBottom')?.addEventListener('click', clearAllCurrentSheet);
    document.getElementById('btnChangeTemplateModel')?.addEventListener('click', () => {
      state.templateLocked = false;
      state.selectedTemplateId = 'geral';
      renderTemplateSelector();
    });

    // Navegação entre as 2 Telas ("Novo Atendimento" e "Meu Histórico") e clique em "Prontuário APS" para voltar à primeira página
    document.getElementById('brandHomeBtn')?.addEventListener('click', () => {
      closePatientDetailModal();
      switchMainPage('pageRecord');
      if (!state.isRecording) {
        state.selectedTemplateId = 'geral';
        state.templateLocked = false;
        renderTemplateSelector();
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.getElementById('tabBtnRecord')?.addEventListener('click', () => {
      closePatientDetailModal();
      switchMainPage('pageRecord');
      if (!state.isRecording) {
        state.selectedTemplateId = 'geral';
        state.templateLocked = false;
        renderTemplateSelector();
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.getElementById('tabBtnHistory')?.addEventListener('click', () => switchMainPage('pageHistory'));

    // Botão [ ✕ Fechar ] da Evolução do Paciente + clique fora do cartão + tecla ESC
    document.getElementById('btnClosePatientModal')?.addEventListener('click', closePatientDetailModal);
    document.getElementById('patientDetailModal')?.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'patientDetailModal') {
        closePatientDetailModal();
      }
    });

    // Atalho discreto de teclado (Alt + R) e Tecla ESC para fechar evolução
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const pModal = document.getElementById('patientDetailModal');
        if (pModal && pModal.style.display === 'flex') {
          closePatientDetailModal();
        }
      }
      if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        if (state.isRecording) {
          finishRecordingAndQueue();
        } else {
          startRecording();
        }
      }
      if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        if (state.isRecording) {
          e.preventDefault();
          togglePauseRecording();
          showToast(state.isPaused ? '⏸️ Folha em espera (pausado para interrupção)' : '▶️ Atendimento retomado');
        }
      }
    });

    document.getElementById('micSelect')?.addEventListener('change', (e) => {
      state.selectedMicDeviceId = e.target.value;
      localStorage.setItem('ubs_selected_mic', state.selectedMicDeviceId);
    });

    // Anexo Discreto de PDFs / Imagens de Exames (Botão, Drag-and-Drop e Ctrl+V global!)
    document.getElementById('examFilesInput')?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        addExamFilesToCurrentSession(e.target.files);
        e.target.value = '';
      }
    });

    const examDropZone = document.getElementById('examDropZone');
    if (examDropZone) {
      examDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        examDropZone.classList.add('drag-active');
      });
      examDropZone.addEventListener('dragleave', () => {
        examDropZone.classList.remove('drag-active');
      });
      examDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        examDropZone.classList.remove('drag-active');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          addExamFilesToCurrentSession(e.dataTransfer.files);
        }
      });
    }

    // Ctrl+V em qualquer lugar da tela para colar print ou PDF de exame discretamente!
    document.addEventListener('paste', (e) => {
      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        const files = Array.from(e.clipboardData.files).filter(f =>
          f.type === 'application/pdf' || f.type.startsWith('image/') || /\.pdf$/i.test(f.name)
        );
        if (files.length > 0) {
          e.preventDefault();
          addExamFilesToCurrentSession(files);
        }
      }
    });

    // Upload de Áudio (WhatsApp / iPhone 14)
    document.getElementById('audioFileInput')?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleExternalAudioUpload(e.target.files);
        e.target.value = '';
      }
    });

    const dropZone = document.getElementById('whatsappDropZone');
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-active');
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-active');
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-active');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const allFiles = Array.from(e.dataTransfer.files);
          const examDocs = allFiles.filter(f => f.type === 'application/pdf' || f.type.startsWith('image/') || /\.pdf$/i.test(f.name));
          const audioDocs = allFiles.filter(f => !examDocs.includes(f));
          if (examDocs.length > 0) addExamFilesToCurrentSession(examDocs);
          if (audioDocs.length > 0) handleExternalAudioUpload(audioDocs);
        }
      });
    }

    document.getElementById('btnProcessNotesOnly')?.addEventListener('click', handleProcessNotesOrExamsOnly);

    // Transcrição instantânea de exames anexados ou colados nas Anotações Rápidas sem precisar finalizar a gravação
    document.getElementById('btnTranscribeExamsNow')?.addEventListener('click', transcribePendingExamsNow);
    document.getElementById('btnFormatNotesExamNow')?.addEventListener('click', transcribePendingExamsNow);
    document.getElementById('quickNotesInput')?.addEventListener('input', updateQuickNotesExamBadge);
    document.getElementById('quickNotesInput')?.addEventListener('paste', () => {
      setTimeout(updateQuickNotesExamBadge, 20);
    });
    document.getElementById('btnCopyLiveExams')?.addEventListener('click', () => {
      const txt = document.getElementById('liveExamTranscriptionEditor')?.value || '';
      copyToClipboard(txt, '📋 Resultado dos exames copiado!');
    });
    document.getElementById('btnClearLiveExams')?.addEventListener('click', () => {
      const liveBox = document.getElementById('liveExamTranscriptionBox');
      if (liveBox) liveBox.style.display = 'none';
    });
    document.getElementById('liveExamTranscriptionEditor')?.addEventListener('input', (e) => {
      state.preTranscribedExamsText = e.target.value;
    });

    document.getElementById('btnClearPrevEvolution')?.addEventListener('click', () => {
      const prevInput = document.getElementById('previousConsultationInput');
      if (prevInput) prevInput.value = '';
    });

    ['zSex', 'zMonths', 'zBirthGA', 'zWeight', 'zHeight', 'zHC', 'chkIncludeZScoreInEvolution', 'pueriFeedingType', 'pueriFormulaDetails'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', updateZScoreLivePreview);
      document.getElementById(id)?.addEventListener('change', updateZScoreLivePreview);
    });

    ['pnDUM', 'pnCycleDays', 'pnUsgDate', 'pnUsgWeeks', 'pnUsgDays'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', updatePrenatalLivePreview);
      document.getElementById(id)?.addEventListener('change', updatePrenatalLivePreview);
    });

    document.getElementById('btnCopyPrenatalCalc')?.addEventListener('click', () => {
      const calc = calculatePrenatalGestationalAge();
      if (!calc) {
        showToast('ℹ️ Preencha a DUM e/ou a Ecografia primeiro para copiar o cálculo.');
        return;
      }
      copyToClipboard(calc.previewText, '🤰 Cálculo de IG e DPP copiado!');
    });

    // Busca e Filtros dos Últimos 30 Dias (Nome, Tipo de Atendimento, Data e Status PEC)
    document.getElementById('historySearchInput')?.addEventListener('input', refreshQueueSidebar);
    document.getElementById('historyFilterSelect')?.addEventListener('change', refreshQueueSidebar);
    document.getElementById('historyTemplateFilter')?.addEventListener('change', refreshQueueSidebar);
    document.getElementById('historyDateFilter')?.addEventListener('change', refreshQueueSidebar);
    document.getElementById('btnResetHistoryFilters')?.addEventListener('click', () => {
      const s = document.getElementById('historySearchInput');
      const f = document.getElementById('historyFilterSelect');
      const t = document.getElementById('historyTemplateFilter');
      const d = document.getElementById('historyDateFilter');
      if (s) s.value = '';
      if (f) f.value = 'all';
      if (t) t.value = 'all';
      if (d) d.value = '';
      refreshQueueSidebar();
    });

    // Retomar / Continuar gravando para o mesmo paciente (após já ter parado e transcrito a 1ª parte)
    document.getElementById('btnContinueRecordingPatient')?.addEventListener('click', async () => {
      if (!state.activeConsultationId) return;
      if (state.isRecording) {
        alert('Já existe uma folha de atendimento aberta no momento. Salve ou cancele a atual antes de continuar outra.');
        return;
      }
      const c = await window.ScribeDB.getConsultation(state.activeConsultationId);
      if (!c) return;

      closePatientDetailModal();
      switchMainPage('pageRecord');

      state.selectedTemplateId = c.templateId || 'geral';
      state.templateLocked = true;
      state.recordingConsultationId = c.id;
      state.isContinuingConsultation = true;

      const patientInput = document.getElementById('patientIdentifier');
      const quickNotesInput = document.getElementById('quickNotesInput');
      const prevConsultInput = document.getElementById('previousConsultationInput');
      if (patientInput) patientInput.value = c.patientLabel || '';
      if (quickNotesInput) quickNotesInput.value = c.quickNotes || '';
      if (prevConsultInput) prevConsultInput.value = c.previousConsultationText || '';

      renderTemplateSelector();
      await startRecording();
      showToast(`➕ Continuando atendimento de: ${c.patientLabel}`);
    });

    // Marcar / Desmarcar como Evoluído no PEC (exclui tudo em 15 dias; o áudio bruto fica disponível por 24h caso precise reprocessar no dia)
    document.getElementById('btnToggleEvolvedPEC')?.addEventListener('click', async () => {
      if (!state.activeConsultationId) return;
      const c = await window.ScribeDB.getConsultation(state.activeConsultationId);
      if (c) {
        c.evolvedInPEC = !c.evolvedInPEC;
        c.evolvedAt = c.evolvedInPEC ? Date.now() : null;
        await window.ScribeDB.saveConsultation(c);
        await renderActiveConsultationView(c);
        await refreshQueueSidebar();
        updateStorageStatsUI();
        showToast(c.evolvedInPEC ? '☑️ Evoluído no PEC (exclusão automática em 15 dias)!' : '📌 Marcado como Pendente de Evoluir no PEC (retido por 30 dias).');
      }
    });

    document.getElementById('mainEvolutionEditor')?.addEventListener('input', async (e) => {
      if (!state.activeConsultationId) return;
      const c = await window.ScribeDB.getConsultation(state.activeConsultationId);
      if (c) {
        c.evolutionText = e.target.value;
        await window.ScribeDB.saveConsultation(c);
      }
    });

    document.getElementById('btnCopyFullEvolution')?.addEventListener('click', async () => {
      const text = document.getElementById('mainEvolutionEditor')?.value || '';
      copyToClipboard(text, '📋 Evolução completa copiada e marcada como Evoluída no PEC!');
      if (state.activeConsultationId) {
        const c = await window.ScribeDB.getConsultation(state.activeConsultationId);
        if (c && !c.evolvedInPEC) {
          c.evolvedInPEC = true;
          c.evolvedAt = Date.now();
          await window.ScribeDB.saveConsultation(c);
          await renderActiveConsultationView(c);
          await refreshQueueSidebar();
          updateStorageStatsUI();
        }
      }
    });

    document.querySelectorAll('.btn-copy-section').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sec = btn.getAttribute('data-sec');
        const fullText = document.getElementById('mainEvolutionEditor')?.value || '';
        const extracted = extractSectionFromText(fullText, sec);
        if (!extracted) {
          showToast(`ℹ️ Nenhum bloco de ${sec.toUpperCase()} presente nesta evolução.`);
          return;
        }
        copyToClipboard(extracted, `📋 Bloco ${sec.toUpperCase()} copiado!`);
      });
    });

    // Mudança de modelo diretamente no modal de detalhes do paciente
    document.getElementById('modalChangeConsultationTemplate')?.addEventListener('change', async (e) => {
      if (!state.activeConsultationId) return;
      const c = await window.ScribeDB.getConsultation(state.activeConsultationId);
      if (!c) return;
      const newTplId = e.target.value;
      const newTpl = state.templates[newTplId] || window.DEFAULT_TEMPLATES[newTplId];
      if (newTpl) {
        c.templateId = newTpl.id;
        c.templateName = newTpl.name;
        c.templateIcon = newTpl.icon;
        const badge = document.getElementById('viewTemplateBadge');
        if (badge) badge.textContent = `${c.templateIcon || '🩺'} ${c.templateName}`;
      }
      const soapWrap = document.getElementById('modalSoapSubtypeWrapper');
      if (soapWrap) {
        soapWrap.style.display = (newTplId === 'geral') ? 'inline-flex' : 'none';
      }
      if (newTplId === 'geral') {
        const soapSelect = document.getElementById('modalChangeSoapSubtype');
        if (soapSelect) c.soapSubtypeHeader = soapSelect.value;
      }
      await window.ScribeDB.saveConsultation(c);
      await refreshQueueSidebar();
      showToast(`📋 Formato alterado para "${newTpl ? newTpl.name : newTplId}". Clique em "Reprocessar no Formato Escolhido" para gerar a nova evolução.`);
    });

    document.getElementById('modalChangeSoapSubtype')?.addEventListener('change', async (e) => {
      if (!state.activeConsultationId) return;
      const c = await window.ScribeDB.getConsultation(state.activeConsultationId);
      if (!c) return;
      c.soapSubtypeHeader = e.target.value;
      await window.ScribeDB.saveConsultation(c);
      showToast(`Modalidade definida como "${c.soapSubtypeHeader}". Clique em "Reprocessar no Formato Escolhido".`);
    });

    const triggerReprocessCurrent = async () => {
      if (!state.activeConsultationId) return;
      const c = await window.ScribeDB.getConsultation(state.activeConsultationId);
      if (c) {
        const tplSelect = document.getElementById('modalChangeConsultationTemplate');
        const soapSelect = document.getElementById('modalChangeSoapSubtype');
        if (tplSelect && tplSelect.value) {
          const chosenTpl = state.templates[tplSelect.value] || window.DEFAULT_TEMPLATES[tplSelect.value];
          if (chosenTpl) {
            c.templateId = chosenTpl.id;
            c.templateName = chosenTpl.name;
            c.templateIcon = chosenTpl.icon;
          }
        }
        if (c.templateId === 'geral' && soapSelect && soapSelect.value) {
          c.soapSubtypeHeader = soapSelect.value;
        }
        c.status = 'queued';
        c.errorMessage = '';
        if (c.chunkCount > 0) {
          c.rawTranscript = ''; // Limpa para re-transcrever o áudio completo do zero sem omissões
        }
        await window.ScribeDB.saveConsultation(c);
        await refreshQueueSidebar();
        await renderActiveConsultationView(c);
        processQueueInBackground();
        showToast(`🔄 Reprocessando "${c.patientLabel}" em ${c.templateName || 'Consulta Geral (SOAP)'}...`);
      }
    };

    document.getElementById('btnReprocessWithNewTemplate')?.addEventListener('click', triggerReprocessCurrent);
    document.getElementById('btnReprocessConsultation')?.addEventListener('click', triggerReprocessCurrent);

    document.getElementById('btnDeleteConsultation')?.addEventListener('click', async () => {
      if (!state.activeConsultationId) return;
      if (!confirm('Deseja excluir este registro do disco?')) return;
      await window.ScribeDB.deleteConsultation(state.activeConsultationId);
      state.activeConsultationId = null;
      await refreshQueueSidebar();
      await renderActiveConsultationView(null);
      updateStorageStatsUI();
    });

    document.getElementById('btnGenerateReferral')?.addEventListener('click', generateStateReferral);
    document.getElementById('btnCopyReferral')?.addEventListener('click', () => {
      const text = document.getElementById('referralResultEditor')?.value || '';
      copyToClipboard(text, '🏛️ Encaminhamento copiado para a Regulação Estadual!');
    });
    document.getElementById('btnToggleReferralDrawer')?.addEventListener('click', () => {
      toggleReferralDrawer();
    });
    document.getElementById('btnCloseActiveReferralView')?.addEventListener('click', async () => {
      state.activeReferralId = null;
      const outBox = document.getElementById('referralOutputContainer');
      if (outBox) outBox.style.display = 'none';
      if (state.activeConsultationId) {
        const c = await window.ScribeDB.getConsultation(state.activeConsultationId);
        if (c) renderSavedReferralsForConsultation(c);
      }
    });

    // Modal de Sincronização entre Computadores / Evoluir de Casa (PIN Fixo Pessoal)
    const openCloudSync = () => {
      const chk = document.getElementById('chkAutoCloudSync');
      if (chk) chk.checked = state.autoCloudSync;
      const pinInput = document.getElementById('syncFixedPinInput');
      if (pinInput) pinInput.value = getSavedSyncPin();
      const modal = document.getElementById('cloudSyncModal');
      if (modal) modal.style.display = 'flex';
    };
    document.getElementById('btnOpenCloudSyncModal')?.addEventListener('click', openCloudSync);
    document.getElementById('btnHistoryCloudSync')?.addEventListener('click', openCloudSync);
    document.getElementById('btnCloseCloudSyncModal')?.addEventListener('click', () => {
      const modal = document.getElementById('cloudSyncModal');
      if (modal) modal.style.display = 'none';
    });
    document.getElementById('chkAutoCloudSync')?.addEventListener('change', (e) => {
      state.autoCloudSync = Boolean(e.target.checked);
      localStorage.setItem('ubs_auto_cloud_sync', String(state.autoCloudSync));
    });
    document.getElementById('btnSaveSyncFixedPin')?.addEventListener('click', () => {
      const pinInput = document.getElementById('syncFixedPinInput');
      const pin = (pinInput?.value || '').trim();
      if (!pin) {
        showToast('⚠️ Digite seu PIN fixo pessoal antes de salvar.');
        return;
      }
      setSavedSyncPin(pin);
      showToast('💾 PIN Fixo Pessoal salvo neste navegador!');
    });
    document.getElementById('syncFixedPinInput')?.addEventListener('change', (e) => {
      setSavedSyncPin(e.target.value);
    });
    document.getElementById('btnPushCloudSync')?.addEventListener('click', () => pushConsultationsToCloud(false));
    document.getElementById('btnPullCloudSync')?.addEventListener('click', pullConsultationsFromCloud);
    document.getElementById('btnExportPlantaoFile')?.addEventListener('click', exportPlantaoToFile);
    document.getElementById('importPlantaoFileInput')?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        importPlantaoFromFile(e.target.files[0]);
        e.target.value = '';
      }
    });

    document.getElementById('btnOpenApiKeyModal')?.addEventListener('click', openApiKeyModal);
    document.getElementById('btnCloseApiKeyModal')?.addEventListener('click', () => {
      document.getElementById('apiKeyModal').style.display = 'none';
    });

    const saveApiKeyHandler = async (e) => {
      if (e && e.preventDefault) e.preventDefault();
      const key = document.getElementById('apiKeyInput')?.value.trim() || '';
      const mode = document.querySelector('input[name="keyStorageMode"]:checked')?.value || 'permanent';
      if (!key) {
        localStorage.removeItem('ubs_gemini_api_key');
        sessionStorage.removeItem('ubs_gemini_api_key');
      } else if (mode === 'session') {
        sessionStorage.setItem('ubs_gemini_api_key', key);
        localStorage.removeItem('ubs_gemini_api_key');
      } else {
        localStorage.setItem('ubs_gemini_api_key', key);
        sessionStorage.removeItem('ubs_gemini_api_key');
      }

      // Salva no Gerenciador de Senhas do Google Chrome vinculado à conta fixa "Chave API Gemini - Prontuário APS"
      try {
        if (key && window.PasswordCredential && navigator.credentials && navigator.credentials.store) {
          const cred = new window.PasswordCredential({
            id: 'Chave API Gemini - Prontuário APS',
            name: 'Chave API Gemini - Prontuário APS',
            password: key
          });
          await navigator.credentials.store(cred);
        }
      } catch (_) {}

      updateApiKeyStatusBadge();
      const prefModel = document.getElementById('preferredModelSelect')?.value || 'auto';
      localStorage.setItem('ubs_preferred_model', prefModel);
      if (prefModel !== 'auto') {
        rememberWorkingModelForKey(prefModel, key);
      }
      delete cachedDiscoveredModelsByKey[getKeyShortHash(key)];

      document.getElementById('apiKeyModal').style.display = 'none';
      showToast('🔒 Credencial salva com sucesso!');
      retryAllPendingConsultations();
      processQueueInBackground();
    };

    document.getElementById('preferredModelSelect')?.addEventListener('change', (e) => {
      const chosen = e.target.value;
      localStorage.setItem('ubs_preferred_model', chosen);
      const key = getSavedApiKey();
      if (key && chosen !== 'auto') {
        rememberWorkingModelForKey(chosen, key);
        delete cachedDiscoveredModelsByKey[getKeyShortHash(key)];
      }
      showToast(`⚡ Modelo preferido alterado para: ${formatModelName(chosen)}`);
    });

    document.getElementById('apiKeyForm')?.addEventListener('submit', saveApiKeyHandler);
    document.getElementById('btnSaveApiKey')?.addEventListener('click', saveApiKeyHandler);

    document.getElementById('btnRetryAllPending')?.addEventListener('click', retryAllPendingConsultations);

    document.getElementById('btnOpenTemplatesModal')?.addEventListener('click', openTemplateEditorModal);
    document.getElementById('btnCloseTemplatesModal')?.addEventListener('click', () => {
      document.getElementById('templatesModal').style.display = 'none';
    });
    document.getElementById('tplEditorSelect')?.addEventListener('change', (e) => {
      const tpl = state.templates[e.target.value];
      if (tpl) document.getElementById('tplEditorTextarea').value = tpl.templateText;
    });
    document.getElementById('btnSaveTemplateEdit')?.addEventListener('click', () => {
      const id = document.getElementById('tplEditorSelect').value;
      if (state.templates[id]) {
        state.templates[id].templateText = document.getElementById('tplEditorTextarea').value;
        saveTemplatesToLocal();
        showToast('✅ Modelo atualizado!');
        document.getElementById('templatesModal').style.display = 'none';
      }
    });
    document.getElementById('btnResetTemplatesDefault')?.addEventListener('click', () => {
      if (confirm('Restaurar todos os 7 modelos para o texto original padrão?')) {
        localStorage.removeItem('ubs_custom_templates_v10');
        loadCustomOrDefaultTemplates();
        openTemplateEditorModal();
        showToast('🔄 Modelos originais restaurados!');
      }
    });

    // Proteção contra fechamento acidental da aba enquanto uma folha de atendimento estiver aberta
    window.addEventListener('beforeunload', (e) => {
      if (state.isRecording) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    document.getElementById('btnSelectDiskFolder')?.addEventListener('click', async () => {
      try {
        const folderName = await window.ScribeDB.selectPhysicalFolder();
        document.getElementById('btnSelectDiskFolder').textContent = `📁 Pasta: ${folderName}`;
        showToast(`📁 Backup ativado na pasta "${folderName}"!`);
      } catch (err) {
        if (err.name !== 'AbortError') alert(err.message);
      }
    });

    document.getElementById('btnClearOldAudios')?.addEventListener('click', async () => {
      if (!confirm('Deseja limpar todos os registros salvos neste navegador?')) return;
      await window.ScribeDB.clearAllData();
      state.activeConsultationId = null;
      await refreshQueueSidebar();
      await renderActiveConsultationView(null);
      updateStorageStatsUI();
      showToast('🧹 Registros locais limpos!');
    });
  }

  function openTemplateEditorModal() {
    const modal = document.getElementById('templatesModal');
    const select = document.getElementById('tplEditorSelect');
    const textarea = document.getElementById('tplEditorTextarea');
    select.innerHTML = '';
    Object.values(state.templates).forEach(tpl => {
      const opt = document.createElement('option');
      opt.value = tpl.id;
      opt.textContent = `${tpl.icon} ${tpl.name}`;
      if (tpl.id === state.selectedTemplateId) opt.selected = true;
      select.appendChild(opt);
    });
    textarea.value = state.templates[state.selectedTemplateId]?.templateText || '';
    modal.style.display = 'flex';
  }

  function extractSectionFromText(fullText, sectionKey) {
    const mapHeaders = {
      subjetivo: /^([\s\S]*?(?:4\.\s*)?SUBJETIVO\s*\n[\s\S]*?)(?=\n(?:5\.|6\.|\s*OBJETIVO)|\s*$)/i,
      objetivo: /(?:6\.\s*)?OBJETIVO(?:\s*\(EXAME FÍSICO\))?\s*\n([\s\S]*?)(?=\n(?:EXAMES COMPLEMENTARES|ULTRASSONOGRAFIA|7\.|9\.|\s*AVALIAÇÃO)|\s*$)/i,
      exames: /((?:EXAMES COMPLEMENTARES|ULTRASSONOGRAFIA)\s*\n[\s\S]*?)(?=\n(?:7\.|9\.|\s*AVALIAÇÃO)|\s*$)/i,
      avaliacao: /(?:9\.\s*)?AVALIAÇÃO[^\n]*\n([\s\S]*?)(?=\n(?:10\.|\s*CONDUTA)|\s*$)/i,
      conduta: /(?:10\.\s*)?CONDUTA\s*\n([\s\S]*?)$/i
    };
    const regex = mapHeaders[sectionKey];
    if (!regex) return fullText;
    const match = fullText.match(regex);
    return match && match[1] ? match[1].trim() : '';
  }

  function updateRecordingControlsUI() {
    const btnStart = document.getElementById('btnStartRec');
    const btnPause = document.getElementById('btnPauseRec');
    const btnStop = document.getElementById('btnStopRec');
    const btnCancel = document.getElementById('btnCancelRec');
    const statusDot = document.getElementById('recStatusDot');
    const statusLabel = document.getElementById('recStatusLabel');

    if (state.isRecording) {
      btnStart.style.display = 'none';
      btnPause.style.display = 'inline-flex';
      btnStop.style.display = 'inline-flex';
      if (btnCancel) btnCancel.style.display = 'inline-flex';
      btnPause.textContent = state.isPaused ? '▶️ Retomar' : '⏸️ Pausar';
      statusDot.className = state.isPaused ? 'rec-dot paused' : 'rec-dot active';
      statusLabel.textContent = state.isPaused
        ? 'Atendimento pausado'
        : 'Atendimento em andamento';
    } else {
      btnStart.style.display = 'inline-flex';
      btnPause.style.display = 'none';
      btnStop.style.display = 'none';
      if (btnCancel) btnCancel.style.display = 'none';
      statusDot.className = 'rec-dot';
      statusLabel.textContent = 'Pronto para iniciar';
    }
  }

  function updateRecordingTimerUI() {
    const el = document.getElementById('recTimerDisplay');
    if (!el) return;
    const mm = String(Math.floor(state.recordingSeconds / 60)).padStart(2, '0');
    const ss = String(state.recordingSeconds % 60).padStart(2, '0');
    el.textContent = `${mm}:${ss}`;
  }

  async function updateStorageStatsUI() {
    const stats = await window.ScribeDB.getStorageStats();
    const el = document.getElementById('diskUsageBadge');
    if (el) {
      el.textContent = `💽 ${stats.totalAudioMB} MB (${stats.consultationCount})`;
    }
  }

  function copyToClipboard(text, message) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      showToast(message || 'Copiado!');
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast(message || 'Copiado!');
    });
  }

  function showToast(msg) {
    const toast = document.getElementById('toastNotification');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('visible'), 4000);
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result || '';
        const base64 = res.includes(',') ? res.split(',')[1] : res;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
