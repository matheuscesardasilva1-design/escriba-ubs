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
    pendingAudioFiles: [], // Áudios externos (VD / WhatsApp) preparados na folha aguardando clique para transcrever
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
    'gemini-4-hydrogen',
    'gemini-2.5-flash',
    'gemini-3-flash',
    'gemini-3-flash-preview',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.6-flash'
  ];

  const cachedDiscoveredModelsByKey = {};
  // Pausa curta (2 min) de modelos que responderam 503 "high demand", para as próximas consultas não perderem tempo neles
  const modelCooldownUntil = {};
  const cachedEmergencyLiveModelsByKey = {};
  const cachedEmergencyGemmaModelsByKey = {};
  const modelOutputTokenLimits = {};

  function getKeyShortHash(apiKey) {
    const k = String(apiKey || '').trim();
    return k ? k.slice(-8) : 'default';
  }

  function normalizeCompare(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
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
    if (clean && !clean.includes('3.7') && !clean.includes('live') && !clean.includes('gemma')) {
      localStorage.setItem('ubs_working_model_' + getKeyShortHash(apiKey), clean);
    }
  }

  async function getActiveGeminiModels(apiKey) {
    const disabled = getDisabledModelsForKey(apiKey);
    const exhaustedToday = getExhaustedModelsForToday(apiKey);
    const workKey = 'ubs_working_model_' + getKeyShortHash(apiKey);
    let remembered = localStorage.getItem(workKey) || '';
    let preferredModel = localStorage.getItem('ubs_preferred_model') || 'auto';
    if (remembered.includes('3.7') || remembered.includes('live') || remembered.includes('gemma')) {
      localStorage.removeItem(workKey);
      remembered = '';
    }
    if (preferredModel.includes('3.7') || preferredModel.includes('live') || preferredModel.includes('gemma')) {
      localStorage.removeItem('ubs_preferred_model');
      preferredModel = 'auto';
    }
    const keyHash = getKeyShortHash(apiKey);

    const filterAndOrder = (rawList) => {
      const valid = rawList.filter(m => !disabled.includes(m) && !exhaustedToday.includes(m) && !m.includes('3.7') && !m.includes('live') && !m.includes('gemma') && !m.includes('pro'));
      // 1. Se o usuário escolheu um modelo preferido fixo na interface, coloca-o no topo absoluto (sem precisar de F5)!
      if (preferredModel && preferredModel !== 'auto') {
        const cleanPref = preferredModel.replace(/^models\//, '');
        const otherValid = valid.filter(m => m !== cleanPref);
        return [cleanPref, ...otherValid];
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
        const rawModels = Array.isArray(data.models) ? data.models : [];
        cachedEmergencyLiveModelsByKey[keyHash] = rawModels
          .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('bidiGenerateContent'))
          .map(m => (m.name || '').replace(/^models\//, ''))
          .filter(n => n && !n.includes('tts') && !n.includes('translate'));
        cachedEmergencyGemmaModelsByKey[keyHash] = rawModels
          .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => (m.name || '').replace(/^models\//, ''))
          .filter(n => n && n.includes('gemma-4'));

        const allCapable = rawModels
          .filter(m => {
            const methods = Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
            return methods.includes('generateContent') || methods.includes('bidiGenerateContent');
          })
          .map(m => (m.name || '').replace(/^models\//, ''))
          .filter(name => {
            if (!name) return false;
            // Filtros de exclusão: modelos sem saída de texto clínico ou instáveis/incompatíveis com JSON clínico estrito
            if (name.includes('tts')) return false;
            if (name.includes('embedding')) return false;
            if (name.includes('imagen') || name.includes('banana') || name.includes('image')) return false;
            if (name.includes('veo')) return false;
            if (name.includes('pro')) return false; // Cota 0/0 na conta gratuita do usuário
            if (name.includes('robotics') || name.includes('computer-use')) return false;
            if (name.includes('1.0') || name.includes('1.5')) return false;
            if (name.includes('2.0') || name.startsWith('gemini-2-flash')) return false;
            // Bloqueia modelos experimentais que travam em respostas longas (ex: gemini-3.7-flash), cota 0/0 (omni) ou não seguem schema JSON SOAP
            if (name.includes('3.7') || name.includes('live') || name.includes('native-audio-dialog') || name.includes('gemma') || name.includes('omni')) return false;

            const isFlash = name.includes('flash');
            const isHydrogen = name.includes('hydrogen');
            return isFlash || isHydrogen;
          });

        // Hierarquia de pontuação dos modelos clínicos estáveis (garante rapidez e fidelidade idêntica ao padrão em todos os atendimentos):
        // 1) Gemini 4 Hydrogen, Gemini 3.5 Flash, Gemini 2.5 Flash e Gemini 3 Flash (modelos clínicos principais mais fiéis): 260+ pontos
        // 2) Gemini 3.5 Flash-Lite e 3.1 Flash-Lite (alta velocidade e 500 req/dia): 220 pontos
        // 3) Outros modelos Flash (3.8, 3.6, 2.5-lite): 180 pontos
        const scoreModel = (name) => {
          if (name.includes('hydrogen')) {
            return 268;
          }
          if (name === 'gemini-2.5-flash' || name === 'gemini-3.5-flash' || name === 'gemini-3-flash' || name === 'gemini-3-flash-preview') {
            return 260 + (name === 'gemini-3.5-flash' ? 6 : name === 'gemini-2.5-flash' ? 5 : 2);
          }
          if (name === 'gemini-3.5-flash-lite' || name === 'gemini-3.1-flash-lite') {
            return 220 + (name.includes('3.5') ? 3 : 1);
          }
          const isFullFlash = name.includes('flash') && !name.includes('lite');
          const verMatch = name.match(/(\d+(?:\.\d+)?)/);
          const ver = verMatch ? parseFloat(verMatch[1]) : 0;
          const stableBonus = (!name.includes('preview') && !name.includes('exp')) ? 0.2 : 0;
          return (isFullFlash ? 190 : 160) + ver + stableBonus;
        };

        const filteredCapable = allCapable.filter((n, _, arr) => {
          if (n.endsWith('-latest')) return false;
          if (n.endsWith('-preview') && arr.includes(n.replace(/-preview$/, ''))) return false;
          return true;
        });
        const finalCapable = (filteredCapable.length > 0 ? filteredCapable : allCapable);
        finalCapable.sort((a, b) => scoreModel(b) - scoreModel(a));

        if (finalCapable.length > 0) {
          cachedDiscoveredModelsByKey[keyHash] = finalCapable.slice(0, 6);
          const ordered = filterAndOrder(cachedDiscoveredModelsByKey[keyHash]);
          if (ordered.length > 0) return ordered;
        }
      }
    } catch (_) {}

    const fallback = filterAndOrder(GEMINI_MODELS);
    // Se todos foram marcados como esgotados hoje, limpa a lista de esgotados para tentar novamente caso a cota tenha virado
    if (fallback.length === 0) {
      const today = new Date().toISOString().slice(0, 10);
      try {
        localStorage.removeItem(`ubs_exhausted_${today}_${keyHash}`);
      } catch (_) {}
      return GEMINI_MODELS.filter(m => !disabled.includes(m));
    }
    return fallback;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    loadCustomOrDefaultTemplates();
    loadDailyTokenStats();
    renderTemplateSelector();
    initTimerWorker();
    await tryRestoreApiKeyFromChromeCredentialManager();
    await populateMicrophones();
    await checkCrashRecoveryAndLoadHistory();
    bindUIEvents();
    updateApiKeyStatusBadge();
    updateWhisperModeUI();
    checkWhisperCapabilitiesUI();
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

    // Reenvio automático das consultas que falharam por instabilidade do Google (503 / limite / timeout):
    // não precisa mais clicar em "Processar Agora" nos dias de muito movimento.
    setInterval(() => { autoRetryTransientErrors(); }, 60 * 1000);
  });

  // --- MODO ESCURO (DARK MODE) SELECIONÁVEL PELO USUÁRIO ---
  function initTheme() {
    const saved = localStorage.getItem('ubs_theme') || 'light';
    applyTheme(saved);
  }

  function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark-mode', isDark);
    if (document.body) {
      document.body.classList.toggle('dark-mode', isDark);
    }
    const btn = document.getElementById('btnToggleDarkMode');
    if (btn) {
      btn.innerHTML = isDark ? '☀️ Modo Claro' : '🌙 Modo Escuro';
      btn.title = isDark ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro';
    }
  }

  window.__toggleDarkMode = function() {
    const isDark = !document.documentElement.classList.contains('dark-mode');
    const nextTheme = isDark ? 'dark' : 'light';
    try {
      localStorage.setItem('ubs_theme', nextTheme);
    } catch (_) {}
    applyTheme(nextTheme);
    showToast(isDark ? '🌙 Modo Escuro ativado!' : '☀️ Modo Claro ativado!');
  };

  function loadCustomOrDefaultTemplates() {
    const saved = localStorage.getItem('ubs_custom_templates_v11');
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
    localStorage.setItem('ubs_custom_templates_v11', JSON.stringify(state.templates));
  }

  // Limites diários oficiais por Chave API no Google AI Studio (Modelos Multimodais de Áudio)
  const MODEL_QUOTA_CATALOG = [
    { id: 'gemini-3.5-flash-lite', label: '⚡ Gemini 3.5 Flash Lite', dailyLimit: 500, rpmLimit: 15 },
    { id: 'gemini-3.1-flash-lite', label: '⚡ Gemini 3.1 Flash Lite', dailyLimit: 500, rpmLimit: 15 },
    { id: 'gemini-4-hydrogen',     label: '🚀 Gemini 4 Hydrogen',     dailyLimit: 20,  rpmLimit: 10 },
    { id: 'gemini-2.5-flash',      label: '💎 Gemini 2.5 Flash',      dailyLimit: 20,  rpmLimit: 10 },
    { id: 'gemini-3-flash',        label: '💎 Gemini 3 Flash',        dailyLimit: 20,  rpmLimit: 10 },
    { id: 'gemini-3.8-flash',      label: '💎 Gemini 3.8 Flash',      dailyLimit: 20,  rpmLimit: 10 },
    { id: 'gemini-3.6-flash',      label: '💎 Gemini 3.6 Flash',      dailyLimit: 20,  rpmLimit: 10 },
    { id: 'gemini-2.5-flash-lite', label: '⚡ Gemini 2.5 Flash Lite', dailyLimit: 500, rpmLimit: 15 }
  ];

  function normalizeModelForQuota(modelName) {
    const clean = String(modelName || '').replace(/^models\//, '').trim();
    if (clean === 'gemini-3-flash-preview') return 'gemini-3-flash';
    return clean;
  }

  function getModelDailyLimit(modelName) {
    const norm = normalizeModelForQuota(modelName);
    const found = MODEL_QUOTA_CATALOG.find(m => m.id === norm);
    if (found) return found.dailyLimit;
    if (norm.includes('lite')) return 500;
    if (norm.includes('gemma')) return 14400;
    return 20;
  }

  function getTodayKey() {
    return 'ubs_tokens_' + new Date().toISOString().slice(0, 10);
  }

  function getTodayPerKeyQuotaStorageKey() {
    return 'ubs_per_key_quota_' + new Date().toISOString().slice(0, 10);
  }

  function loadTodayPerKeyQuotaMap() {
    try {
      const raw = localStorage.getItem(getTodayPerKeyQuotaStorageKey());
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function saveTodayPerKeyQuotaMap(mapObj) {
    try {
      localStorage.setItem(getTodayPerKeyQuotaStorageKey(), JSON.stringify(mapObj || {}));
    } catch (_) {}
  }

  function recordKeyModelUsage(apiKey, modelName, tokensUsed = 0) {
    const keyHash = getKeyShortHash(apiKey);
    const normModel = normalizeModelForQuota(modelName);
    const map = loadTodayPerKeyQuotaMap();
    if (!map[keyHash]) {
      map[keyHash] = { totalRequests: 0, totalTokens: 0, lastModel: '', updatedAt: 0, byModel: {} };
    }
    if (!map[keyHash].byModel[normModel]) {
      map[keyHash].byModel[normModel] = { requests: 0, tokens: 0 };
    }
    map[keyHash].totalRequests += 1;
    map[keyHash].totalTokens += (tokensUsed || 0);
    map[keyHash].lastModel = normModel;
    map[keyHash].updatedAt = Date.now();
    map[keyHash].byModel[normModel].requests += 1;
    map[keyHash].byModel[normModel].tokens += (tokensUsed || 0);
    saveTodayPerKeyQuotaMap(map);
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
    renderApiKeysQuotaDashboard();
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
    if (clean.includes('hydrogen')) return 'Gemini 4 Hydrogen';
    if (clean.includes('2.5-flash') && !clean.includes('lite')) return 'Gemini 2.5 Flash';
    if (clean.includes('3-flash')) return 'Gemini 3 Flash';
    if (clean.includes('gemma')) return 'Gemma 4';
    if (clean.includes('3.5-flash-lite')) return 'Gemini 3.5 Flash Lite';
    if (clean.includes('3.1-flash-lite')) return 'Gemini 3.1 Flash Lite';
    if (clean.includes('2.5-flash-lite')) return 'Gemini 2.5 Flash Lite';
    return clean;
  }

  function getAggregatedQuotaSummaryForTopbar(overrideModel) {
    const keys = getSavedApiKeysList();
    const pref = localStorage.getItem('ubs_preferred_model') || 'auto';
    const targetModel = normalizeModelForQuota(
      overrideModel
      || (pref !== 'auto' ? pref : '')
      || localStorage.getItem('ubs_working_model_' + getKeyShortHash(keys[0] || ''))
      || 'gemini-3.5-flash-lite'
    );
    const modelLimitPerKey = getModelDailyLimit(targetModel);
    const quotaMap = loadTodayPerKeyQuotaMap();

    if (keys.length === 0) {
      return {
        keysCount: 0,
        targetModel,
        totalLimit: modelLimitPerKey,
        totalUsed: 0,
        totalAvail: 0
      };
    }

    let totalLimit = 0;
    let totalUsed = 0;
    let totalAvail = 0;

    for (const k of keys) {
      const kHash = getKeyShortHash(k);
      const exhausted = getExhaustedModelsForToday(k).map(normalizeModelForQuota);
      const disabled = getDisabledModelsForKey(k).map(normalizeModelForQuota);
      const usedOnKeyModel = quotaMap[kHash]?.byModel?.[targetModel]?.requests || 0;

      if (disabled.includes(targetModel)) {
        continue;
      }
      totalLimit += modelLimitPerKey;
      if (exhausted.includes(targetModel)) {
        totalUsed += modelLimitPerKey;
      } else {
        const cappedUsed = Math.min(modelLimitPerKey, usedOnKeyModel);
        totalUsed += cappedUsed;
        totalAvail += Math.max(0, modelLimitPerKey - cappedUsed);
      }
    }

    // Se o modelo atual atingiu o limite (ex: 20/20) mas ainda há cotas abundantes no Gemini 3.5 Flash Lite (500/dia):
    if (totalAvail === 0 && targetModel !== 'gemini-3.5-flash-lite') {
      const fallbackModel = 'gemini-3.5-flash-lite';
      const fallbackLimit = getModelDailyLimit(fallbackModel);
      let fbAvail = 0;
      let fbUsed = 0;
      for (const k of keys) {
        const kHash = getKeyShortHash(k);
        const exhausted = getExhaustedModelsForToday(k).map(normalizeModelForQuota);
        const used = quotaMap[kHash]?.byModel?.[fallbackModel]?.requests || 0;
        if (!exhausted.includes(fallbackModel)) {
          const cap = Math.min(fallbackLimit, used);
          fbUsed += cap;
          fbAvail += Math.max(0, fallbackLimit - cap);
        }
      }
      if (fbAvail > 0) {
        return {
          keysCount: keys.length,
          targetModel: fallbackModel,
          totalLimit: fallbackLimit * keys.length,
          totalUsed: fbUsed,
          totalAvail: fbAvail,
          isFallbackActive: true
        };
      }
    }

    return {
      keysCount: keys.length,
      targetModel,
      totalLimit,
      totalUsed,
      totalAvail
    };
  }

  function updateTokenMonitorUI(modelUsed) {
    const now = Date.now();
    state.recentApiCallsTimestamps = (state.recentApiCallsTimestamps || []).filter(ts => now - ts < 60000);
    const rpmLastMinute = state.recentApiCallsTimestamps.length;
    const summary = getAggregatedQuotaSummaryForTopbar(modelUsed);
    const modelShort = formatModelName(summary.targetModel).replace(/^Gemini\s+/i, '');
    const keyLabel = summary.keysCount > 1 ? `${summary.keysCount} Chaves` : '1 Chave';

    const elDaily = document.getElementById('dailyTokenCounter');
    if (elDaily) {
      if (summary.keysCount === 0) {
        elDaily.textContent = `🔑 Sem Chave API (Clique para configurar)`;
        elDaily.style.color = '#dc2626';
      } else if (rpmLastMinute >= 12) {
        elDaily.textContent = `🟡 Fila rápida • Usado: ${summary.totalUsed}/${summary.totalLimit} (${summary.totalAvail} disp.)`;
        elDaily.style.color = '#d97706';
      } else if (summary.isFallbackActive) {
        elDaily.textContent = `🟢 ${keyLabel}: ${summary.totalAvail}/${summary.totalLimit} disp. (${modelShort} livre)`;
        elDaily.style.color = '#059669';
      } else if (summary.totalAvail === 0 && summary.totalLimit > 0) {
        elDaily.textContent = `🟠 ${modelShort}: ${summary.totalUsed}/${summary.totalLimit} (0 disp. — alterna auto)`;
        elDaily.style.color = '#d97706';
      } else {
        elDaily.textContent = `🟢 ${keyLabel}: ${summary.totalUsed} usados • ${summary.totalAvail}/${summary.totalLimit} disp. (${modelShort})`;
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
        document.title = `🩺 Em atendimento (${mm}:${ss}) • Prontuário APS`;
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

    // Se o modelo selecionado for Pré-Natal, o sexo do paciente é sempre Feminino (F)
    if (state.selectedTemplateId === 'prenatal') {
      const sexSelect = document.getElementById('patientSexSelect');
      if (sexSelect && sexSelect.value !== 'F') {
        sexSelect.value = 'F';
      }
    }

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
        if (tpl.id === 'prenatal') {
          const sexSelect = document.getElementById('patientSexSelect');
          if (sexSelect) sexSelect.value = 'F';
        }
        renderTemplateSelector();
        togglePuericulturaZScorePanel();
        showToast(`📋 Formato selecionado: ${tpl.name}`);
      });
      container.appendChild(btn);
    });
    togglePuericulturaZScorePanel();
  }

  function getSelectedSoapSubtypeHeader() {
    if (state.selectedTemplateId === 'interconsulta') {
      const selectedInter = document.querySelector('input[name="interconsultaSubtype"]:checked');
      return selectedInter && selectedInter.value === 'resumida' ? 'resumida' : 'completa';
    }
    const selectedRadio = document.querySelector('input[name="soapVisitSubtype"]:checked');
    if (!selectedRadio) {
      return ''; // Desmarcado por padrão = Sem título ##
    }
    const mode = selectedRadio.value;
    if (mode === 'NENHUM' || mode === 'NONE' || !mode) {
      return '';
    }
    if (mode === 'CONSULTA AGENDADA - 0800' || mode === 'CONSULTA AGENDADA') {
      return '## CONSULTA AGENDADA - 0800 ##';
    }
    if (mode === 'RETORNO MÉDICO') {
      return '## RETORNO MÉDICO ##';
    }
    if (mode === 'DEMANDA ESPONTÂNEA') {
      return '## DEMANDA ESPONTÂNEA ##';
    }
    return '';
  }

  function getFormattedVdVisitDate() {
    const vdDateEl = document.getElementById('vdVisitDateInput');
    const raw = vdDateEl ? vdDateEl.value.trim() : '';
    if (!raw) return '';
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return raw;
  }

  function togglePuericulturaZScorePanel() {
    const soapPanel = document.getElementById('geralSoapSubtypeBox');
    const interPanel = document.getElementById('interconsultaSubtypeBox');
    const pueriPanel = document.getElementById('puericulturaZScoreBox');
    const pnPanel = document.getElementById('prenatalObjectiveBox');
    const vdPanel = document.getElementById('vdSpecificBox');
    const importExtText = document.getElementById('btnImportExternalAudioText');
    const dropZone = document.getElementById('whatsappDropZone');
    const isVd = state.selectedTemplateId === 'visita_domiciliar';
    if (soapPanel) {
      soapPanel.style.display = state.selectedTemplateId === 'geral' ? 'block' : 'none';
    }
    if (interPanel) {
      interPanel.style.display = state.selectedTemplateId === 'interconsulta' ? 'block' : 'none';
    }
    if (pueriPanel) {
      pueriPanel.style.display = state.selectedTemplateId === 'puericultura' ? 'block' : 'none';
    }
    if (pnPanel) {
      pnPanel.style.display = state.selectedTemplateId === 'prenatal' ? 'block' : 'none';
    }
    if (vdPanel) {
      vdPanel.style.display = isVd ? 'block' : 'none';
    }
    if (importExtText) {
      importExtText.textContent = isVd
        ? '📂 Importar Áudio da VD / WhatsApp'
        : '📂 Importar Áudio para Transcrição';
    }
    if (dropZone) {
      dropZone.textContent = isVd
        ? 'Arraste áudios de Visita Domiciliar ou PDFs para cá (ou pressione Ctrl+V)'
        : 'Arraste arquivos de áudio ou PDFs de exames para cá (ou pressione Ctrl+V)';
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
    const detected = window.detectExamsInText ? window.detectExamsInText(raw) : { hasLab: false, hasImaging: false, hasAny: false, hasHgtControl: false, hasPaControl: false };

    if (!badge || !btnFormat) return;
    if (!detected.hasAny && !detected.hasHgtControl && !detected.hasPaControl) {
      badge.style.display = 'none';
      btnFormat.style.display = 'none';
      return;
    }

    badge.style.display = 'inline-flex';
    btnFormat.style.display = detected.hasAny ? 'inline-flex' : 'none';
    const homeControlsLabel = [
      detected.hasHgtControl ? 'HGT' : '',
      detected.hasPaControl ? 'PA' : ''
    ].filter(Boolean).join(' + ');

    if (detected.hasLab && detected.hasImaging) {
      badge.textContent = `🧪🖥️ Exames Laboratorial + Imagem${homeControlsLabel ? ` + Controle de ${homeControlsLabel}` : ''} detectados`;
      badge.style.background = '#f0fdf4';
      badge.style.color = '#166534';
      badge.style.borderColor = '#86efac';
    } else if (detected.hasLab) {
      badge.textContent = `🧪 Exame Laboratorial${homeControlsLabel ? ` + Controle de ${homeControlsLabel}` : ''} detectado`;
      badge.style.background = '#e0f2fe';
      badge.style.color = '#0369a1';
      badge.style.borderColor = '#7dd3fc';
    } else if (detected.hasImaging) {
      badge.textContent = `🖥️ Exame de Imagem${homeControlsLabel ? ` + Controle de ${homeControlsLabel}` : ''} detectado`;
      badge.style.background = '#f3e8ff';
      badge.style.color = '#6b21a8';
      badge.style.borderColor = '#d8b4fe';
    } else {
      badge.textContent = `📊 Controle de ${homeControlsLabel} detectado (será importado p/ SUBJETIVO)`;
      badge.style.background = '#fefce8';
      badge.style.color = '#854d0e';
      badge.style.borderColor = '#fde047';
    }
  }

  function getCurrentPatientAgeAndSex() {
    const ageInput = document.getElementById('patientAgeInput');
    const sexSelect = document.getElementById('patientSexSelect');
    const rawAge = ageInput ? parseInt(ageInput.value, 10) : NaN;
    const age = (!isNaN(rawAge) && rawAge >= 1 && rawAge <= 125) ? String(rawAge) : '';
    let rawSex = sexSelect ? sexSelect.value.trim().toUpperCase() : '';
    // No Pré-Natal o sexo é obrigatoriamente Feminino (F)
    if (state.selectedTemplateId === 'prenatal') {
      rawSex = 'F';
      if (sexSelect && sexSelect.value !== 'F') {
        sexSelect.value = 'F';
      }
    }
    const sex = (rawSex === 'M' || rawSex === 'F') ? rawSex : '';
    return { age, sex };
  }

  function renderLiveExamCalculatedSummaryBanner(calculations) {
    const summaryEl = document.getElementById('liveExamCalculatedSummary');
    if (!summaryEl) return;
    if (!Array.isArray(calculations) || calculations.length === 0) {
      summaryEl.style.display = 'none';
      summaryEl.innerHTML = '';
      return;
    }

    const badges = [];
    for (const item of calculations) {
      if (item.type === 'ckdepi') {
        const isReduced = item.egfr < 60;
        const bg = isReduced ? '#fef3c7' : '#dcfce7';
        const border = isReduced ? '#f59e0b' : '#22c55e';
        const color = isReduced ? '#92400e' : '#166534';
        badges.push(
          `<span style="display:inline-flex;align-items:center;gap:5px;background:${bg};color:${color};border:1px solid ${border};padding:3px 9px;border-radius:99px;font-weight:700;">` +
          `🧮 TFG CKD-EPI: ${item.egfr} mL/min/1,73m² — Classificação ${item.stageCode} (${item.stageDesc}) • [Creat ${item.scr} | ${item.age}a, ${item.sex}]` +
          `</span>`
        );
      } else if (item.type === 'ckdepi_missing') {
        const missingParts = [];
        if (item.missingAge) missingParts.push('idade');
        if (item.missingSex) missingParts.push('sexo');
        badges.push(
          `<span style="display:inline-flex;align-items:center;gap:5px;background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;padding:3px 9px;border-radius:99px;font-weight:600;">` +
          `ℹ️ Creat ${item.scr} detectada — TFG CKD-EPI não calculada por falta de confirmação de ${missingParts.join(' e ')} (preencha no topo se desejar calcular)` +
          `</span>`
        );
      } else if (item.type === 'ist') {
        badges.push(
          `<span style="display:inline-flex;align-items:center;gap:5px;background:#e0f2fe;color:#0369a1;border:1px solid #7dd3fc;padding:3px 9px;border-radius:99px;font-weight:700;">` +
          `🩸 Índice de Saturação de Transferrina: IST ${item.istFormatted} (calculado)` +
          `</span>`
        );
      }
    }

    if (badges.length === 0) {
      summaryEl.style.display = 'none';
      summaryEl.innerHTML = '';
      return;
    }

    summaryEl.style.display = 'flex';
    summaryEl.style.flexWrap = 'wrap';
    summaryEl.style.gap = '6px';
    summaryEl.innerHTML = badges.join('');
  }

  function refreshLiveExamCalculationsFromInputs() {
    if (!state.rawPreTranscribedExamsText) return;
    const liveBox = document.getElementById('liveExamTranscriptionBox');
    const liveEditor = document.getElementById('liveExamTranscriptionEditor');
    if (!liveBox || liveBox.style.display === 'none' || !liveEditor) return;
    const { age, sex } = getCurrentPatientAgeAndSex();
    const { formattedText, calculations } = formatAllExamLinesWithCalculations(state.rawPreTranscribedExamsText, age, sex);
    state.preTranscribedExamsText = formattedText;
    liveEditor.value = formattedText;
    renderLiveExamCalculatedSummaryBanner(calculations);
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
    const summaryEl = document.getElementById('liveExamCalculatedSummary');

    if (liveBox) liveBox.style.display = 'block';
    if (summaryEl) {
      summaryEl.style.display = 'none';
      summaryEl.innerHTML = '';
    }
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
      const { age: patientAge, sex: patientSex } = getCurrentPatientAgeAndSex();
      parts.push({ text: window.buildInstantExamTranscriptionPrompt(quickNotesVal, patientAge, patientSex) });

      const requestBody = {
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.1 }
      };

      const { responseJson } = await callGeminiWithFallbackAndRetry(requestBody, apiKey);
      clearInterval(examTimer);
      let rawExamText = (responseJson?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
      rawExamText = fixBrazilianMedicationSpelling(rawExamText);
      state.rawPreTranscribedExamsText = rawExamText;

      const { formattedText: examText, calculations } = formatAllExamLinesWithCalculations(rawExamText, patientAge, patientSex);
      state.preTranscribedExamsText = examText;
      if (liveEditor) liveEditor.value = examText;
      renderLiveExamCalculatedSummaryBanner(calculations);

      // Se já houver uma consulta sendo gravada, salva os exames pré-transcritos nela imediatamente
      if (state.recordingConsultationId) {
        const existing = await window.ScribeDB.getConsultation(state.recordingConsultationId);
        if (existing) {
          existing.preTranscribedExamsText = examText;
          existing.patientAge = patientAge;
          existing.patientSex = patientSex;
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
      // 32 kbps Opus mono mantém 100% da nitidez de voz humana e reduz 1 hora de consulta para ~14 MB (cabendo direto sem falhar após 1h!)
      const recorderOptions = mimeType
        ? { mimeType, audioBitsPerSecond: 32000 }
        : { audioBitsPerSecond: 32000 };

      const recorder = new MediaRecorder(stream, recorderOptions);
      state.mediaRecorder = recorder;

      const patientInput = document.getElementById('patientIdentifier');
      const quickNotesInput = document.getElementById('quickNotesInput');
      const prevConsultInput = document.getElementById('previousConsultationInput');
      const tpl = state.templates[state.selectedTemplateId] || window.DEFAULT_TEMPLATES.geral;
      const now = Date.now();

      let consultId;
      const currentSoapSubtype = getSelectedSoapSubtypeHeader();
      const currentVdVisitDate = getFormattedVdVisitDate();
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
          existing.soapSubtypeHeader = currentSoapSubtype || existing.soapSubtypeHeader || '';
          if (currentVdVisitDate) existing.vdVisitDate = currentVdVisitDate;
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
        const { age: patientAge, sex: patientSex } = getCurrentPatientAgeAndSex();
        const newConsultation = {
          id: consultId,
          patientLabel: (patientInput && patientInput.value.trim()) || `Atendimento ${new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
          patientAge,
          patientSex,
          templateId: tpl.id,
          templateName: tpl.name,
          templateIcon: tpl.icon,
          soapSubtypeHeader: currentSoapSubtype,
          vdVisitDate: currentVdVisitDate,
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
      showToast(`🩺 Atendimento em andamento: ${tpl.name}`);
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
    state.rawPreTranscribedExamsText = '';

    const patientInput = document.getElementById('patientIdentifier');
    const ageInput = document.getElementById('patientAgeInput');
    const sexSelect = document.getElementById('patientSexSelect');
    const quickNotesInput = document.getElementById('quickNotesInput');
    const prevConsultInput = document.getElementById('previousConsultationInput');
    const liveBox = document.getElementById('liveExamTranscriptionBox');
    const liveEditor = document.getElementById('liveExamTranscriptionEditor');
    const summaryEl = document.getElementById('liveExamCalculatedSummary');
    const vdDateEl = document.getElementById('vdVisitDateInput');

    state.pendingExamFiles = [];
    state.pendingAudioFiles = [];
    state.preTranscribedExamsText = '';
    state.rawPreTranscribedExamsText = '';

    if (patientInput) patientInput.value = '';
    if (ageInput) ageInput.value = '';
    if (sexSelect) sexSelect.value = '';
    if (vdDateEl) vdDateEl.value = '';
    if (quickNotesInput) quickNotesInput.value = '';
    if (prevConsultInput) prevConsultInput.value = '';
    const liveRefCustom = document.getElementById('liveReferralCustomSpecialty');
    const liveRefCond = document.getElementById('liveReferralConditionInput');
    const liveRefExtra = document.getElementById('liveReferralExtraDataInput');
    const liveRefEditor = document.getElementById('liveReferralResultEditor');
    if (liveRefCustom) liveRefCustom.value = '';
    if (liveRefCond) liveRefCond.value = '';
    if (liveRefExtra) liveRefExtra.value = '';
    if (liveRefEditor) liveRefEditor.value = '';
    if (liveBox) liveBox.style.display = 'none';
    if (liveEditor) liveEditor.value = '';
    if (summaryEl) {
      summaryEl.style.display = 'none';
      summaryEl.innerHTML = '';
    }

    document.querySelectorAll('input[name="soapVisitSubtype"]').forEach(r => { r.checked = false; });

    clearZScoreInputs();
    renderPendingExamFilesUI();
    renderPendingExternalAudioUI();
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
      (state.pendingAudioFiles && state.pendingAudioFiles.length > 0) ||
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
    const currentSoapSubtype = getSelectedSoapSubtypeHeader();
    const currentVdVisitDate = getFormattedVdVisitDate();
    const attachedExams = [...state.pendingExamFiles];
    const { age: currentPatientAge, sex: currentPatientSex } = getCurrentPatientAgeAndSex();
    const ageInput = document.getElementById('patientAgeInput');
    const sexSelect = document.getElementById('patientSexSelect');
    const vdDateEl = document.getElementById('vdVisitDateInput');
    const summaryEl = document.getElementById('liveExamCalculatedSummary');

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
    state.pendingAudioFiles = [];
    state.preTranscribedExamsText = '';
    state.rawPreTranscribedExamsText = '';
    const liveBox = document.getElementById('liveExamTranscriptionBox');
    if (liveBox) liveBox.style.display = 'none';
    if (liveExamEditor) liveExamEditor.value = '';
    if (summaryEl) {
      summaryEl.style.display = 'none';
      summaryEl.innerHTML = '';
    }
    document.querySelectorAll('input[name="soapVisitSubtype"]').forEach(r => { r.checked = false; });
    renderPendingExamFilesUI();
    renderPendingExternalAudioUI();
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
      if (currentPatientAge) consult.patientAge = currentPatientAge;
      if (currentPatientSex) consult.patientSex = currentPatientSex;
      consult.templateId = currentTpl.id;
      consult.templateName = currentTpl.name;
      consult.templateIcon = currentTpl.icon;
      consult.soapSubtypeHeader = currentSoapSubtype !== undefined ? currentSoapSubtype : (consult.soapSubtypeHeader || '');
      if (currentVdVisitDate) consult.vdVisitDate = currentVdVisitDate;
      consult.durationSeconds = finalSeconds;
      consult.examFileCount = attachedExams.length;
      consult.quickNotes = currentNotes;
      if (currentPrevConsult) consult.previousConsultationText = currentPrevConsult;
      if (currentPreTranscribedExams) consult.preTranscribedExamsText = currentPreTranscribedExams;
      consult.zScoreSummary = currentZScore;
      const liveRefText = (document.getElementById('liveReferralResultEditor')?.value || '').trim();
      const liveRefSpec = (document.getElementById('liveReferralCustomSpecialty')?.value || '').trim()
        || (document.getElementById('liveReferralSpecialtySelect')?.value || '').trim();
      if (liveRefText) {
        if (!Array.isArray(consult.referrals)) consult.referrals = [];
        consult.referrals.push({
          id: 'ref_' + Date.now() + '_live',
          specialty: liveRefSpec || 'Especialidade',
          text: liveRefText,
          createdAt: Date.now()
        });
        consult.referralText = liveRefText;
        consult.referralSpecialty = liveRefSpec || 'Especialidade';
      }
      consult.status = 'queued';
      consult.updatedAt = Date.now();
      await window.ScribeDB.saveConsultation(consult);

      if (window.ScribeDB.hasPhysicalFolder()) {
        const fullBlob = await window.ScribeDB.assembleAudioBlob(finishingId, consult.mimeType);
        await window.ScribeDB.saveBackupToPhysicalFolder(consult, fullBlob);
      }
    }

    if (patientInput) patientInput.value = '';
    if (ageInput) ageInput.value = '';
    if (sexSelect) sexSelect.value = '';
    if (vdDateEl) vdDateEl.value = '';
    if (quickNotesInput) quickNotesInput.value = '';
    if (prevConsultInput) prevConsultInput.value = '';
    const liveRefCustom = document.getElementById('liveReferralCustomSpecialty');
    const liveRefCond = document.getElementById('liveReferralConditionInput');
    const liveRefExtra = document.getElementById('liveReferralExtraDataInput');
    const liveRefEditor = document.getElementById('liveReferralResultEditor');
    if (liveRefCustom) liveRefCustom.value = '';
    if (liveRefCond) liveRefCond.value = '';
    if (liveRefExtra) liveRefExtra.value = '';
    if (liveRefEditor) liveRefEditor.value = '';
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

  function renderPendingExternalAudioUI() {
    const box = document.getElementById('pendingExternalAudioBox');
    const listEl = document.getElementById('pendingExternalAudioList');
    if (!box || !listEl) return;
    if (!state.pendingAudioFiles || state.pendingAudioFiles.length === 0) {
      box.style.display = 'none';
      listEl.innerHTML = '';
      return;
    }
    box.style.display = 'block';
    listEl.innerHTML = state.pendingAudioFiles.map((f, idx) => {
      const kb = Math.max(1, Math.round((f.size || 0) / 1024));
      return `<span>🔊 ${idx + 1}. ${escapeHtml(f.name)} (${kb} KB)</span>`;
    }).join(' &nbsp;•&nbsp; ');
  }

  // Ao importar arquivo de áudio externo (VD / WhatsApp), prepara o arquivo na folha atual
  // para que o médico possa colar a Evolução Anterior, Notas Rápidas, Data da VD e PDFs antes de clicar em Transcrever!
  async function handleExternalAudioUpload(fileList) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    files.forEach(f => {
      state.pendingAudioFiles.push(f);
    });
    const patientInput = document.getElementById('patientIdentifier');
    if (patientInput && !patientInput.value.trim() && state.pendingAudioFiles.length === 1) {
      const cleanFileName = state.pendingAudioFiles[0].name.replace(/\.[^.]+$/, '').replace(/WhatsApp Ptt /i, 'Visita ');
      patientInput.value = cleanFileName;
    }
    renderPendingExternalAudioUI();
    showToast(`🎙️ ${files.length} áudio(s) anexado(s) na folha! Cole a Evolução Anterior/Notas (se desejar) e clique em "▶️ Transcrever Áudio e Gerar Evolução".`);
  }

  async function startStagedExternalAudioTranscription() {
    if (!state.pendingAudioFiles || state.pendingAudioFiles.length === 0) {
      showToast('⚠️ Nenhum arquivo de áudio externo anexado.');
      return;
    }
    const files = [...state.pendingAudioFiles];
    const patientInput = document.getElementById('patientIdentifier');
    const quickNotesInput = document.getElementById('quickNotesInput');
    const prevConsultInput = document.getElementById('previousConsultationInput');
    const tpl = state.templates[state.selectedTemplateId] || window.DEFAULT_TEMPLATES.geral;
    const currentSoapSubtype = getSelectedSoapSubtypeHeader();
    const currentVdVisitDate = getFormattedVdVisitDate();
    const baseLabel = patientInput ? patientInput.value.trim() : '';
    const currentNotes = (quickNotesInput && quickNotesInput.value) || '';
    const currentPrevConsult = (prevConsultInput && prevConsultInput.value.trim()) || '';
    const liveExamEditor = document.getElementById('liveExamTranscriptionEditor');
    const currentPreTranscribedExams = (liveExamEditor && liveExamEditor.value && !liveExamEditor.value.startsWith('⏳') && !liveExamEditor.value.startsWith('⚠️'))
      ? liveExamEditor.value.trim()
      : (state.preTranscribedExamsText || '');
    const currentZScore = getCalculatedZScoreText();
    const attachedExams = [...state.pendingExamFiles];
    const { age: currentPatientAge, sex: currentPatientSex } = getCurrentPatientAgeAndSex();
    const ageInput = document.getElementById('patientAgeInput');
    const sexSelect = document.getElementById('patientSexSelect');
    const vdDateEl = document.getElementById('vdVisitDateInput');
    const summaryEl = document.getElementById('liveExamCalculatedSummary');

    const now = Date.now();
    const consultId = 'cons_' + now + '_up';
    const firstFile = files[0];
    const firstMime = normalizeAudioMimeType(firstFile, firstFile.name);
    const cleanFileName = firstFile.name.replace(/\.[^.]+$/, '').replace(/WhatsApp Ptt /i, 'Visita ');
    const totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
    const label = baseLabel || (files.length > 1 ? `${cleanFileName} (+${files.length - 1} áudio)` : cleanFileName);

    const newConsultation = {
      id: consultId,
      patientLabel: label,
      patientAge: currentPatientAge,
      patientSex: currentPatientSex,
      templateId: tpl.id,
      templateName: tpl.name,
      templateIcon: tpl.icon,
      soapSubtypeHeader: currentSoapSubtype,
      vdVisitDate: currentVdVisitDate,
      createdAt: now,
      updatedAt: now,
      status: 'queued',
      durationSeconds: Math.max(5, Math.round(totalBytes / 3000)),
      chunkCount: 0,
      isMultiFileExternalAudio: files.length > 1,
      audioFilesCount: files.length,
      examFileCount: attachedExams.length,
      audioBytes: 0,
      mimeType: firstMime,
      fileName: files.map(f => f.name).join(' + '),
      quickNotes: currentNotes,
      previousConsultationText: currentPrevConsult,
      preTranscribedExamsText: currentPreTranscribedExams,
      zScoreSummary: currentZScore,
      evolutionText: '',
      soapParts: null,
      referralText: '',
      auditAlerts: [],
      tokensUsed: 0,
      errorMessage: ''
    };

    await window.ScribeDB.saveConsultation(newConsultation);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const cleanMime = normalizeAudioMimeType(file, file.name);
      await window.ScribeDB.saveAudioChunk(consultId, i, file, cleanMime);
    }

    if (attachedExams.length > 0) {
      for (const exam of attachedExams) {
        await window.ScribeDB.saveExamFile(consultId, exam);
      }
    }
    const lastCreatedId = consultId;

    state.pendingExamFiles = [];
    state.pendingAudioFiles = [];
    state.preTranscribedExamsText = '';
    state.rawPreTranscribedExamsText = '';
    const liveBox = document.getElementById('liveExamTranscriptionBox');
    if (liveBox) liveBox.style.display = 'none';
    if (liveExamEditor) liveExamEditor.value = '';
    if (summaryEl) {
      summaryEl.style.display = 'none';
      summaryEl.innerHTML = '';
    }
    document.querySelectorAll('input[name="soapVisitSubtype"]').forEach(r => { r.checked = false; });
    renderPendingExamFilesUI();
    renderPendingExternalAudioUI();
    if (patientInput) patientInput.value = '';
    if (ageInput) ageInput.value = '';
    if (sexSelect) sexSelect.value = '';
    if (vdDateEl) vdDateEl.value = '';
    if (quickNotesInput) quickNotesInput.value = '';
    if (prevConsultInput) prevConsultInput.value = '';
    const liveRefCustom = document.getElementById('liveReferralCustomSpecialty');
    const liveRefCond = document.getElementById('liveReferralConditionInput');
    const liveRefExtra = document.getElementById('liveReferralExtraDataInput');
    const liveRefEditor = document.getElementById('liveReferralResultEditor');
    if (liveRefCustom) liveRefCustom.value = '';
    if (liveRefCond) liveRefCond.value = '';
    if (liveRefExtra) liveRefExtra.value = '';
    if (liveRefEditor) liveRefEditor.value = '';
    updateQuickNotesExamBadge();
    showToast(`▶️ Transcrevendo ${files.length} áudio(s) com os dados preenchidos!`);
    await refreshQueueSidebar();
    if (lastCreatedId) {
      await selectConsultationToView(lastCreatedId);
    }
    processQueueInBackground();
  }

  // --- Processar apenas Laudos PDF Anexados e/ou Notas Rápidas (Sem Áudio) ---
  async function handleProcessNotesOrExamsOnly() {
    if (state.pendingAudioFiles && state.pendingAudioFiles.length > 0) {
      await startStagedExternalAudioTranscription();
      return;
    }
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
    const ageInput = document.getElementById('patientAgeInput');
    const sexSelect = document.getElementById('patientSexSelect');
    const vdDateEl = document.getElementById('vdVisitDateInput');
    const summaryEl = document.getElementById('liveExamCalculatedSummary');
    const { age: currentPatientAge, sex: currentPatientSex } = getCurrentPatientAgeAndSex();
    const currentSoapSubtype = getSelectedSoapSubtypeHeader();
    const currentVdVisitDate = getFormattedVdVisitDate();
    const tpl = state.templates[state.selectedTemplateId] || window.DEFAULT_TEMPLATES.geral;
    const now = Date.now();
    const consultId = 'cons_' + now + '_txt';

    const newConsultation = {
      id: consultId,
      patientLabel: (patientInput && patientInput.value.trim()) || `Atendimento ${new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      patientAge: currentPatientAge,
      patientSex: currentPatientSex,
      templateId: tpl.id,
      templateName: tpl.name,
      templateIcon: tpl.icon,
      soapSubtypeHeader: currentSoapSubtype,
      vdVisitDate: currentVdVisitDate,
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
    state.pendingAudioFiles = [];
    state.preTranscribedExamsText = '';
    state.rawPreTranscribedExamsText = '';
    const liveBox = document.getElementById('liveExamTranscriptionBox');
    if (liveBox) liveBox.style.display = 'none';
    if (liveExamEditor) liveExamEditor.value = '';
    if (summaryEl) {
      summaryEl.style.display = 'none';
      summaryEl.innerHTML = '';
    }
    document.querySelectorAll('input[name="soapVisitSubtype"]').forEach(r => { r.checked = false; });
    renderPendingExamFilesUI();
    renderPendingExternalAudioUI();
    if (patientInput) patientInput.value = '';
    if (ageInput) ageInput.value = '';
    if (sexSelect) sexSelect.value = '';
    if (vdDateEl) vdDateEl.value = '';
    if (quickNotesInput) quickNotesInput.value = '';
    if (prevConsultInput) prevConsultInput.value = '';
    const liveRefCustom = document.getElementById('liveReferralCustomSpecialty');
    const liveRefCond = document.getElementById('liveReferralConditionInput');
    const liveRefExtra = document.getElementById('liveReferralExtraDataInput');
    const liveRefEditor = document.getElementById('liveReferralResultEditor');
    if (liveRefCustom) liveRefCustom.value = '';
    if (liveRefCond) liveRefCond.value = '';
    if (liveRefExtra) liveRefExtra.value = '';
    if (liveRefEditor) liveRefEditor.value = '';
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
          const existingCustomStage = state.activeProcessingProgress?.customStageLabel || '';
          const isWhisperRunning = /Whisper|Decodificando|Baixando/i.test(existingCustomStage);
          // Enquanto o Whisper reporta progresso real bloco a bloco, NÃO dispara a barra artificialmente até 94% nem apaga o texto dele!
          const timeRatio = elapsedSec / estTotalSec;
          const targetByTime = isWhisperRunning
            ? prevPct
            : Math.min(94, Math.round(18 + 76 * (1 - Math.exp(-1.55 * timeRatio))));
          const nextPct = Math.min(94, Math.max(prevPct, targetByTime));
          updateLiveProcessingUI({
            consultId: nextItem.id,
            patientLabel: nextItem.patientLabel,
            percent: nextPct,
            stageLabel: existingCustomStage || getStageDescriptionForPercent(nextPct),
            customStageLabel: existingCustomStage,
            elapsedSec: Math.floor(elapsedSec),
            extraQueueCount,
            modelStatus: state.activeProcessingProgress?.modelStatus || ''
          });
        }, 500);

        try {
          const result = await processSingleConsultationWithGemini(nextItem, apiKey, (milestonePct, customStage, modelInfo) => {
            const prevPct = state.activeProcessingProgress?.percent || 0;
            const currentPct = (milestonePct !== null && milestonePct !== undefined)
              ? Math.max(prevPct, milestonePct)
              : prevPct;
            const resolvedCustomStage = (customStage !== null && customStage !== undefined)
              ? customStage
              : (state.activeProcessingProgress?.customStageLabel || '');
            updateLiveProcessingUI({
              consultId: nextItem.id,
              patientLabel: nextItem.patientLabel,
              percent: currentPct,
              stageLabel: resolvedCustomStage || getStageDescriptionForPercent(currentPct),
              customStageLabel: resolvedCustomStage,
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
          // REDE DE SEGURANÇA: guarda a versão anterior da evolução (últimas 3) antes de sobrescrever,
          // para o médico poder restaurar com 1 clique caso algo saia errado.
          try {
            const oldEvo = String(nextItem.evolutionText || '').trim();
            if (oldEvo.length >= 100 && oldEvo !== String(result.evolutionText || '').trim()) {
              nextItem.evolutionBackups = [{ at: Date.now(), text: oldEvo }, ...(nextItem.evolutionBackups || [])].slice(0, 3);
            }
          } catch (_) {}
          nextItem.evolutionText = result.evolutionText;
          nextItem.cidCiapCodes = result.cidCiapCodes || [];
          // A transcrição retornada já é CUMULATIVA (partes anteriores + continuação). Não duplica.
          const prevRawKept = String(nextItem.previousRawTranscript || '');
          const newRaw = String(result.rawTranscript || '');
          nextItem.rawTranscript = (prevRawKept && !newRaw.includes(prevRawKept.slice(0, 60)))
            ? `${prevRawKept}\n\n--- [CONTINUAÇÃO DO ATENDIMENTO] ---\n${newRaw}`
            : newRaw;
          // NÃO apaga mais previousEvolutionText / previousRawTranscript: ficam guardados como base durável
          // para que "Atualizar"/"Reprocessar" nunca percam as partes anteriores do atendimento.
          nextItem.soapParts = result.soapParts;
          nextItem.auditAlerts = result.auditAlerts || [];
          nextItem.suggestedSpecialty = result.suggestedSpecialty || '';
          nextItem.tokensUsed = result.tokensUsed || 0;
          nextItem.modelUsed = result.modelUsed || '';
          nextItem.updatedAt = Date.now();
          await window.ScribeDB.saveConsultation(nextItem);

          addDailyTokenUsage(result.tokensUsed || 0);
          if (nextItem.auditAlerts && nextItem.auditAlerts.length > 0) {
            showToast(`⚠️ ${nextItem.patientLabel} concluído com aviso: ${nextItem.auditAlerts.join(' • ')}`);
          } else {
            showToast(`✅ 100% — Evolução pronta: ${nextItem.patientLabel}`);
          }

          if (state.autoCloudSync || getSavedSyncPin()) {
            pushConsultationsToCloud(true).catch(() => {});
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
            const alertBadgeHtml = (nextItem.auditAlerts && nextItem.auditAlerts.length > 0)
              ? ` <span style="background:#fee2e2;color:#991b1b;border:1px solid #ef4444;padding:2px 8px;border-radius:6px;font-size:11.5px;font-weight:700;margin-left:6px;">${escapeHtml(nextItem.auditAlerts.join(' • '))}</span>`
              : '';
            bannerText.innerHTML = `✅ Prontuário de <strong>${escapeHtml(nextItem.patientLabel)}</strong> 100% concluído em ${Math.max(1, Math.round(elapsedSec))}s!${alertBadgeHtml} <button type="button" id="btnBannerOpenFinished" style="margin-left:10px;padding:3px 10px;border-radius:6px;border:1px solid #166534;background:#fff;color:#166534;font-weight:700;cursor:pointer;">Abrir Evolução Agora</button>`;
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
              // Preserva a transcrição já concluída da Etapa 1 (Whisper ou Gemini) para não re-transcrever 40 min de áudio à toa em erro temporário da Etapa 2!
              const hasFreshStage1Transcript = Boolean(
                nextItem.rawTranscript
                && nextItem.rawTranscript.trim().length >= 30
                && nextItem.rawTranscript.trim() !== String(nextItem.previousRawTranscript || '').trim()
              );
              if (nextItem.chunkCount > 0 && !hasFreshStage1Transcript) {
                if (nextItem.previousRawTranscript && nextItem.previousRawTranscript.length >= 50) {
                  nextItem.previousEvolutionText = '';
                }
                nextItem.rawTranscript = nextItem.previousRawTranscript || '';
              }
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

  // =========================================================================
  // WHISPER LOCAL NO NAVEGADOR (WEBGPU / WASM — INDEPENDENTE POR COMPUTADOR)
  // =========================================================================
  let whisperWorkerInstance = null;
  let whisperReqSeq = 0;
  const whisperPendingRequests = new Map();
  let whisperCachedCaps = null;
  let lastGeminiAudioOverloadAt = 0;

  // Modos de transcrição de áudio salvos por computador:
  // 'cloud'   -> Somente Gemini (Nuvem)
  // 'auto'    -> Automático Inteligente (usa Gemini e alterna sozinho p/ Whisper se 503/limite/consulta >50 min)
  // 'whisper' -> Sempre Whisper Local primeiro (com fallback automático p/ Gemini se falhar)
  function getAudioEngineMode() {
    const saved = localStorage.getItem('ubs_audio_engine_mode');
    if (saved === 'cloud' || saved === 'auto' || saved === 'whisper') return saved;
    if (localStorage.getItem('ubs_whisper_enabled') === 'true') return 'whisper';
    return 'cloud';
  }

  function setAudioEngineMode(mode) {
    const safe = (mode === 'auto' || mode === 'whisper') ? mode : 'cloud';
    localStorage.setItem('ubs_audio_engine_mode', safe);
    localStorage.setItem('ubs_whisper_enabled', safe === 'whisper' ? 'true' : 'false');
    updateWhisperModeUI();
  }

  function isLocalWhisperEnabled() {
    return getAudioEngineMode() === 'whisper';
  }

  function isAutoAudioFallbackEnabled() {
    return getAudioEngineMode() === 'auto';
  }

  function setLocalWhisperEnabled(enabled) {
    setAudioEngineMode(enabled ? 'whisper' : 'cloud');
  }

  function getLocalWhisperProfileSetting() {
    const p = localStorage.getItem('ubs_whisper_profile');
    return (p === 'auto' || p === 'small' || p === 'turbo' || p === 'turbo_compact') ? p : 'auto';
  }

  function getRecommendedWhisperProfileForThisPC() {
    const caps = whisperCachedCaps || { hasWebGpu: false, hasF16: false, ramGB: 0, cores: 0 };
    if (caps.hasWebGpu) {
      // Com WebGPU (Mac M1-M5 ou PC moderno com GPU): Turbo Intermediário (~540 MB) é o ponto doce entre velocidade, tamanho e precisão médica
      if (caps.ramGB && caps.ramGB <= 4) return 'small';
      return 'turbo_compact';
    }
    // Sem WebGPU (CPU/WASM — típico PC simples de UBS): Small (~240 MB) para não travar a máquina
    return 'small';
  }

  function getLocalWhisperProfile() {
    const setting = getLocalWhisperProfileSetting();
    if (setting === 'auto') {
      return getRecommendedWhisperProfileForThisPC();
    }
    return setting;
  }

  function setLocalWhisperProfile(profile) {
    const safe = (profile === 'auto' || profile === 'small' || profile === 'turbo' || profile === 'turbo_compact') ? profile : 'auto';
    localStorage.setItem('ubs_whisper_profile', safe);
    updateWhisperModeUI();
  }

  function formatWhisperProfileLabel(profileKey) {
    if (profileKey === 'auto') {
      const rec = getRecommendedWhisperProfileForThisPC();
      return `Automático (${formatWhisperProfileLabel(rec)})`;
    }
    if (profileKey === 'small') return 'Whisper Small (~240 MB)';
    if (profileKey === 'turbo') return 'Whisper Turbo FP16 (~1,4 GB)';
    return 'Whisper Turbo Intermediário (~540 MB)';
  }

  function updateWhisperModeUI() {
    const mode = getAudioEngineMode();
    const setting = getLocalWhisperProfileSetting();
    const effective = getLocalWhisperProfile();
    const topBtn = document.getElementById('btnToggleWhisperMode');
    if (topBtn) {
      topBtn.classList.remove('whisper-active', 'auto-active');
      if (mode === 'whisper') {
        topBtn.textContent = '🎙️ Whisper';
        topBtn.classList.add('whisper-active');
        topBtn.title = `Sempre Whisper Local (${formatWhisperProfileLabel(effective)}) — fallback automático p/ Gemini se falhar. Clique para trocar.`;
      } else if (mode === 'auto') {
        topBtn.textContent = '🔄 Auto';
        topBtn.classList.add('auto-active');
        topBtn.title = `Automático Inteligente: usa Gemini e alterna sozinho p/ ${formatWhisperProfileLabel(effective)} se der erro 503, limite ou consulta >50 min. Clique para trocar.`;
      } else {
        topBtn.textContent = '☁️ Gemini';
        topBtn.title = 'Somente Gemini na nuvem — clique para alternar para 🔄 Automático Inteligente ou 🎙️ Whisper Local.';
      }
    }
    const modeSel = document.getElementById('audioEngineModeSelect');
    if (modeSel) modeSel.value = mode;
    const sel = document.getElementById('whisperProfileSelect');
    if (sel) sel.value = setting;
  }

  function getOrCreateWhisperWorker() {
    if (whisperWorkerInstance) return whisperWorkerInstance;
    const worker = new Worker('whisper-worker.js?v=20261127_75', { type: 'module' });
    worker.onmessage = (event) => {
      const msg = event.data || {};
      const entry = whisperPendingRequests.get(msg.requestId);
      if (!entry) return;
      if (msg.type === 'download_progress' || msg.type === 'status') {
        if (typeof entry.resetTimeout === 'function') entry.resetTimeout();
        if (typeof entry.onProgress === 'function') entry.onProgress(msg);
        return;
      }
      if (entry.timeoutId) clearTimeout(entry.timeoutId);
      whisperPendingRequests.delete(msg.requestId);
      if (msg.type === 'error') {
        entry.reject(new Error(msg.message || 'Erro no Whisper Local'));
      } else {
        entry.resolve(msg);
      }
    };
    worker.onerror = (err) => {
      const message = err?.message || 'Erro ao executar o Web Worker do Whisper Local';
      for (const [, entry] of whisperPendingRequests.entries()) {
        if (entry.timeoutId) clearTimeout(entry.timeoutId);
        entry.reject(new Error(message));
      }
      whisperPendingRequests.clear();
      try { worker.terminate(); } catch (_) {}
      if (whisperWorkerInstance === worker) whisperWorkerInstance = null;
    };
    whisperWorkerInstance = worker;
    return worker;
  }

  function sendWhisperWorkerRequest(payload, transferables = [], onProgress = null, timeoutMs = 45000) {
    return new Promise((resolve, reject) => {
      try {
        const worker = getOrCreateWhisperWorker();
        const requestId = ++whisperReqSeq;
        const entry = { resolve, reject, onProgress, timeoutId: null, resetTimeout: null };
        const armTimer = () => {
          if (entry.timeoutId) clearTimeout(entry.timeoutId);
          if (timeoutMs > 0) {
            entry.timeoutId = setTimeout(() => {
              whisperPendingRequests.delete(requestId);
              // Encerra o worker travado para liberar GPU/RAM imediatamente e permitir fallback limpo ao Gemini!
              try { worker.terminate(); } catch (_) {}
              if (whisperWorkerInstance === worker) whisperWorkerInstance = null;
              for (const [, other] of whisperPendingRequests.entries()) {
                if (other.timeoutId) clearTimeout(other.timeoutId);
                other.reject(new Error('Whisper Local travou/excedeu o tempo limite.'));
              }
              whisperPendingRequests.clear();
              reject(new Error(`Tempo limite excedido no Whisper Local (${Math.round(timeoutMs / 1000)}s sem resposta).`));
            }, timeoutMs);
          }
        };
        entry.resetTimeout = armTimer;
        armTimer();
        whisperPendingRequests.set(requestId, entry);
        worker.postMessage({ ...payload, requestId }, transferables);
      } catch (e) {
        reject(e);
      }
    });
  }

  async function unloadWhisperWorker() {
    if (!whisperWorkerInstance) return;
    try {
      await sendWhisperWorkerRequest({ type: 'unload' }, [], null, 5000);
    } catch (_) {}
    for (const [, entry] of whisperPendingRequests.entries()) {
      if (entry.timeoutId) clearTimeout(entry.timeoutId);
    }
    try { whisperWorkerInstance.terminate(); } catch (_) {}
    whisperWorkerInstance = null;
    whisperPendingRequests.clear();
  }

  async function checkWhisperCapabilitiesUI() {
    const badge = document.getElementById('whisperHardwareBadge');
    try {
      let hasWebGpu = false;
      let hasF16 = false;
      const ramGB = Number(navigator.deviceMemory || 0);
      const cores = Number(navigator.hardwareConcurrency || 0);
      if (navigator.gpu) {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          hasWebGpu = true;
          hasF16 = Boolean(adapter.features && adapter.features.has('shader-f16'));
        }
      }
      whisperCachedCaps = { hasWebGpu, hasF16, ramGB, cores };
      const recProfile = getRecommendedWhisperProfileForThisPC();
      const recLabel = formatWhisperProfileLabel(recProfile);

      // Atualiza o texto da opção "Automático" no seletor para mostrar exatamente qual modelo foi escolhido para este PC
      const sel = document.getElementById('whisperProfileSelect');
      if (sel && sel.options && sel.options[0] && sel.options[0].value === 'auto') {
        sel.options[0].textContent = `✨ Automático (Indicado p/ este PC: ${recLabel})`;
      }

      if (badge) {
        if (hasWebGpu) {
          badge.textContent = hasF16
            ? `⚡ WebGPU FP16 • Indicado: ${recLabel}`
            : `⚡ WebGPU • Indicado: ${recLabel}`;
        } else {
          badge.textContent = `💻 CPU/WASM • Indicado: ${recLabel}`;
        }
      }
      updateWhisperModeUI();
    } catch (_) {
      whisperCachedCaps = { hasWebGpu: false, hasF16: false, ramGB: 0, cores: 0 };
      if (badge) badge.textContent = '💻 CPU/WASM • Indicado: Whisper Small (~240 MB)';
    }
  }

  let whisperDownloadCancelled = false;

  function cancelLocalWhisperDownload() {
    whisperDownloadCancelled = true;
    if (whisperWorkerInstance) {
      try { whisperWorkerInstance.terminate(); } catch (_) {}
      whisperWorkerInstance = null;
    }
    for (const [, entry] of whisperPendingRequests.entries()) {
      if (entry.timeoutId) clearTimeout(entry.timeoutId);
      entry.reject(new Error('CANCELLED_BY_USER'));
    }
    whisperPendingRequests.clear();

    const btn = document.getElementById('btnPreloadWhisper');
    const btnCancel = document.getElementById('btnCancelWhisperDownload');
    const progWrap = document.getElementById('whisperDownloadProgressWrap');
    const progLabel = document.getElementById('whisperProgressLabel');
    const statusText = document.getElementById('whisperConfigStatusText');

    if (btn) {
      btn.disabled = false;
      btn.textContent = '⬇️ Baixar / Testar Whisper Agora';
    }
    if (btnCancel) btnCancel.style.display = 'none';
    if (progWrap) progWrap.style.display = 'none';
    if (progLabel) progLabel.textContent = '';
    if (statusText) {
      statusText.innerHTML = '⏹️ <strong>Download interrompido.</strong> Você pode escolher outro perfil acima (ex.: <strong>Intermediário ~540 MB</strong> ou <strong>Leve ~240 MB</strong>) ou continuar usando o Gemini normalmente.';
    }
    showToast('⏹️ Download do Whisper cancelado!');
  }

  async function preloadLocalWhisperModel() {
    whisperDownloadCancelled = false;
    if (!whisperCachedCaps) {
      await checkWhisperCapabilitiesUI();
    }
    const profile = getLocalWhisperProfile();
    const label = formatWhisperProfileLabel(profile);
    const btn = document.getElementById('btnPreloadWhisper');
    const btnCancel = document.getElementById('btnCancelWhisperDownload');
    const progWrap = document.getElementById('whisperDownloadProgressWrap');
    const progLabel = document.getElementById('whisperProgressLabel');
    const progPct = document.getElementById('whisperProgressPct');
    const progFill = document.getElementById('whisperProgressBarFill');
    const statusText = document.getElementById('whisperConfigStatusText');

    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Carregando...';
    }
    if (btnCancel) btnCancel.style.display = 'inline-flex';
    if (progWrap) progWrap.style.display = 'block';
    if (progLabel) progLabel.textContent = `Preparando ${label}...`;
    if (progPct) progPct.textContent = '0%';
    if (progFill) progFill.style.width = '5%';

    try {
      const res = await sendWhisperWorkerRequest({ type: 'preload', profile }, [], (ev) => {
        if (whisperDownloadCancelled) return;
        if (ev.type === 'download_progress') {
          const pct = Math.max(1, Math.min(99, ev.percent || 0));
          const mbInfo = ev.totalMB > 0 ? ` (${ev.loadedMB}/${ev.totalMB} MB)` : '';
          if (progLabel) progLabel.textContent = `Baixando ${label} p/ cache do navegador${mbInfo}...`;
          if (progPct) progPct.textContent = `${pct}%`;
          if (progFill) progFill.style.width = `${pct}%`;
        } else if (ev.type === 'status' && ev.message) {
          if (progLabel) progLabel.textContent = ev.message;
        }
      }, 90000);
      if (whisperDownloadCancelled) return;
      if (progPct) progPct.textContent = '100%';
      if (progFill) progFill.style.width = '100%';
      const devLabel = res.device === 'webgpu' ? 'WebGPU (Acelerado)' : 'CPU / WASM';
      if (progLabel) progLabel.textContent = `✅ ${res.label || label} pronto na memória (${devLabel})!`;
      if (statusText) {
        statusText.innerHTML = `✅ <strong>${res.label || label} carregado e salvo no cache deste navegador (${devLabel})!</strong> Nas próximas consultas não precisará baixar novamente.`;
      }
      if (getAudioEngineMode() === 'cloud') {
        setAudioEngineMode('auto');
      }
      showToast(`✅ ${res.label || label} pronto neste computador (${devLabel})!`);
    } catch (err) {
      if (whisperDownloadCancelled || err?.message === 'CANCELLED_BY_USER') return;
      if (progLabel) progLabel.textContent = `⚠️ Não foi possível carregar: ${err.message}`;
      if (statusText) {
        statusText.innerHTML = `⚠️ <strong>Falha ao carregar o Whisper neste PC:</strong> ${escapeHtml(err.message)}. (Pode ser bloqueio de rede ao Hugging Face na UBS — o sistema continuará usando o Gemini normalmente.)`;
      }
      showToast(`⚠️ Whisper indisponível neste PC: ${err.message}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '⬇️ Baixar / Testar Whisper Agora';
      }
      if (btnCancel) btnCancel.style.display = 'none';
    }
  }

  async function decodeAudioBlobTo16kMono(blob) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      throw new Error('Navegador sem suporte a Web Audio API para decodificar áudio.');
    }
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new AudioCtx({ sampleRate: 16000 });
    try {
      const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
      const targetSampleRate = 16000;

      // Mistura canais para mono se já estiver em 16 kHz, ou reamostra com OfflineAudioContext (anti-aliasing)
      if (decoded.sampleRate === targetSampleRate) {
        const len = decoded.length;
        if (decoded.numberOfChannels === 1) {
          return new Float32Array(decoded.getChannelData(0));
        }
        const mono = new Float32Array(len);
        const chCount = decoded.numberOfChannels;
        for (let c = 0; c < chCount; c++) {
          const chData = decoded.getChannelData(c);
          for (let i = 0; i < len; i++) mono[i] += chData[i] / chCount;
        }
        return mono;
      }

      const targetLength = Math.max(1, Math.ceil(decoded.duration * targetSampleRate));
      const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (OfflineCtx) {
        const offline = new OfflineCtx(1, targetLength, targetSampleRate);
        const src = offline.createBufferSource();
        src.buffer = decoded;
        src.connect(offline.destination);
        src.start(0);
        const rendered = await offline.startRendering();
        return new Float32Array(rendered.getChannelData(0));
      }

      // Fallback linear simples caso OfflineAudioContext não exista
      const monoSrc = decoded.getChannelData(0);
      const ratio = decoded.sampleRate / targetSampleRate;
      const out = new Float32Array(targetLength);
      for (let i = 0; i < targetLength; i++) {
        const idx = Math.min(monoSrc.length - 1, Math.floor(i * ratio));
        out[i] = monoSrc[idx];
      }
      return out;
    } finally {
      try { await audioCtx.close(); } catch (_) {}
    }
  }

  function computePcmRms(float32Arr) {
    if (!float32Arr || float32Arr.length === 0) return 0;
    let sumSq = 0;
    const step = Math.max(1, Math.floor(float32Arr.length / 8000));
    let count = 0;
    for (let i = 0; i < float32Arr.length; i += step) {
      const v = float32Arr[i];
      sumSq += v * v;
      count++;
    }
    return count > 0 ? Math.sqrt(sumSq / count) : 0;
  }

  async function transcribeAudioBlobsWithLocalWhisper(blobsArray, onProgressMilestone) {
    if (!whisperCachedCaps) {
      await checkWhisperCapabilitiesUI();
    }
    const profile = getLocalWhisperProfile();
    const profileLabel = formatWhisperProfileLabel(profile);

    if (onProgressMilestone) {
      onProgressMilestone(12, `🎙️ Preparando ${profileLabel} local no navegador...`);
    }

    // 1. Garante o modelo carregado no Web Worker (timeout de 90s sem progresso de download/warmup)
    const preloadInfo = await sendWhisperWorkerRequest({ type: 'preload', profile }, [], (ev) => {
      if (!onProgressMilestone) return;
      if (ev.type === 'download_progress') {
        const mbInfo = ev.totalMB > 0 ? ` (${ev.loadedMB}/${ev.totalMB} MB)` : '';
        const mappedPct = 12 + Math.round(((ev.percent || 0) / 100) * 14);
        onProgressMilestone(mappedPct, `⬇️ Baixando ${profileLabel} (1ª vez — fica em cache)${mbInfo}...`);
      } else if (ev.type === 'status' && ev.message) {
        onProgressMilestone(null, `🎙️ ${ev.message}`);
      }
    }, 90000);

    const devTag = preloadInfo.device === 'webgpu' ? 'WebGPU' : 'CPU';
    const fileTranscripts = [];
    const SAMPLE_RATE = 16000;
    // Janelas nativas de 28 segundos (com 1,5s de sobreposição) -> elimina 100% os travamentos de chunking/timestamp do WebGPU e dá progresso real a cada bloco!
    const SEGMENT_SAMPLES = 28 * SAMPLE_RATE;
    const OVERLAP_SAMPLES = Math.round(1.5 * SAMPLE_RATE);

    const mergeOverlapText = (prevText, nextText) => {
      if (!prevText) return nextText;
      if (!nextText) return prevText;
      const pWords = prevText.trim().split(/\s+/);
      const nWords = nextText.trim().split(/\s+/);
      const maxCheck = Math.min(5, pWords.length, nWords.length);
      const normW = (w) => w.toLowerCase().replace(/[^a-zà-ÿ0-9]/gi, '');
      for (let k = maxCheck; k >= 1; k--) {
        const pTail = pWords.slice(-k).map(normW).join(' ');
        const nHead = nWords.slice(0, k).map(normW).join(' ');
        if (pTail && pTail === nHead) {
          return `${prevText.trim()} ${nWords.slice(k).join(' ')}`.trim();
        }
      }
      return `${prevText.trim()} ${nextText.trim()}`.trim();
    };

    for (let fIdx = 0; fIdx < blobsArray.length; fIdx++) {
      const blob = blobsArray[fIdx];
      if (!blob || blob.size === 0) continue;

      if (onProgressMilestone) {
        onProgressMilestone(27, blobsArray.length > 1
          ? `🔊 Decodificando áudio ${fIdx + 1}/${blobsArray.length} para 16 kHz...`
          : '🔊 Decodificando áudio gravado para 16 kHz...');
      }

      const pcm = await decodeAudioBlobTo16kMono(blob);
      if (!pcm || pcm.length < SAMPLE_RATE * 0.5) continue;

      // Divide em janelas nativas de <= 28 segundos
      const segments = [];
      if (pcm.length <= SEGMENT_SAMPLES + OVERLAP_SAMPLES) {
        segments.push(pcm);
      } else {
        let offset = 0;
        while (offset < pcm.length) {
          const end = Math.min(pcm.length, offset + SEGMENT_SAMPLES);
          segments.push(pcm.slice(offset, end));
          if (end >= pcm.length) break;
          offset = end - OVERLAP_SAMPLES;
        }
      }

      let mergedFileText = '';
      for (let sIdx = 0; sIdx < segments.length; sIdx++) {
        const segPcm = segments[sIdx];
        const segPct = 28 + Math.round(((fIdx + ((sIdx + 0.2) / Math.max(1, segments.length))) / Math.max(1, blobsArray.length)) * 34);
        if (onProgressMilestone) {
          const blockInfo = segments.length > 1 ? ` — bloco ${sIdx + 1}/${segments.length}` : '';
          const fileInfo = blobsArray.length > 1 ? ` (áudio ${fIdx + 1}/${blobsArray.length})` : '';
          onProgressMilestone(segPct, `🎙️ Etapa 1/2 (${profileLabel} • ${devTag})${fileInfo}${blockInfo}...`);
        }

        // Pula janelas de silêncio absoluto (evita alucinação em pausas longas)
        if (computePcmRms(segPcm) < 0.0012) {
          continue;
        }

        const segCopy = new Float32Array(segPcm);
        // Watchdog de 40s por bloco de 28s: se o WebGPU travar, encerra e cai imediatamente para o Gemini!
        const segRes = await sendWhisperWorkerRequest(
          { type: 'transcribe_segment', profile, segmentIndex: sIdx, audio: segCopy },
          [segCopy.buffer],
          null,
          40000
        );
        if (segRes && segRes.text && segRes.text.trim()) {
          mergedFileText = mergeOverlapText(mergedFileText, segRes.text.trim());
        }
      }

      const joinedFile = mergedFileText.replace(/\s{2,}/g, ' ').trim();
      if (joinedFile) {
        fileTranscripts.push(blobsArray.length > 1 ? `--- ÁUDIO ${fIdx + 1} ---\n${joinedFile}` : joinedFile);
      }
    }

    const fullTranscript = fileTranscripts.join('\n\n').trim();
    if (!fullTranscript || fullTranscript.length < 10) {
      throw new Error('Whisper Local não detectou fala compreensível neste áudio.');
    }

    return {
      transcript: fullTranscript,
      modelLabel: `${profileLabel} (${devTag})`,
      device: preloadInfo.device
    };
  }

  // --- Envio Multimodal (Áudio + PDFs de Exames + Notas) para o Gemini ---
  async function processSingleConsultationWithGemini(consultation, apiKey, onProgressMilestone) {
    const tpl = state.templates[consultation.templateId] || window.DEFAULT_TEMPLATES.geral;
    const examFiles = await window.ScribeDB.getExamFilesForConsultation(consultation.id);
    const preExams = consultation.preTranscribedExamsText || '';
    const soapSubtypeHeader = (consultation.soapSubtypeHeader !== undefined && consultation.soapSubtypeHeader !== null)
      ? consultation.soapSubtypeHeader
      : getSelectedSoapSubtypeHeader();
    const consultVdVisitDate = consultation.vdVisitDate || '';

    if (onProgressMilestone) onProgressMilestone(8, '📦 Lendo áudio gravado no disco local...');

    const isPrenatalConsult = consultation.templateId === 'prenatal';
    const hasNotesExams = window.detectExamsInText ? window.detectExamsInText(consultation.quickNotes).hasAny : false;

    // 1. Prepara o(s) Áudio(s) da consulta (primeiro coleta Blobs locais; só sobe/converte p/ Gemini se NÃO usar Whisper Local ou se Whisper falhar!)
    const localAudioBlobs = [];
    const audioParts = [];
    let hasAudioAttached = false;
    let audioPartsPrepared = false;

    if (consultation.chunkCount > 0 && !consultation.audioDeleted) {
      if (consultation.isMultiFileExternalAudio && window.ScribeDB.getAudioChunks) {
        const chunkRecords = await window.ScribeDB.getAudioChunks(consultation.id);
        for (let cIdx = 0; cIdx < chunkRecords.length; cIdx++) {
          const rec = chunkRecords[cIdx];
          if (rec && rec.blob && rec.blob.size > 0) {
            localAudioBlobs.push(rec.blob);
          }
        }
        hasAudioAttached = localAudioBlobs.length > 0;
      } else {
        const audioBlob = await window.ScribeDB.assembleAudioBlob(consultation.id, consultation.mimeType);
        if (audioBlob && audioBlob.size > 0) {
          localAudioBlobs.push(audioBlob);
          hasAudioAttached = true;
        }
      }
    }
    if (!hasAudioAttached && consultation.remoteFileUri) {
      hasAudioAttached = true;
    }

    const blobToGeminiAudioPart = async (blobItem, fName) => {
      const cleanMime = normalizeAudioMimeType(blobItem, fName || '');
      if (blobItem.size > 19 * 1024 * 1024) {
        try {
          if (onProgressMilestone) onProgressMilestone(14, '☁️ Enviando arquivo de áudio longo (>1h)...');
          const fileUri = await uploadLargeFileToGeminiFileAPI(blobItem, cleanMime, apiKey);
          if (fileUri) return { fileData: { mimeType: cleanMime, fileUri } };
        } catch (upErr) {
          console.warn('Upload resumable falhou, usando envio direto em base64:', upErr);
        }
      }
      const base64Audio = await blobToBase64(blobItem);
      return { inlineData: { mimeType: cleanMime, data: base64Audio } };
    };

    const ensureGeminiAudioPartsPrepared = async () => {
      if (audioPartsPrepared) return audioParts;
      audioPartsPrepared = true;
      for (let i = 0; i < localAudioBlobs.length; i++) {
        const p = await blobToGeminiAudioPart(localAudioBlobs[i], consultation.fileName || '');
        audioParts.push(p);
      }
      if (audioParts.length === 0 && consultation.remoteFileUri) {
        audioParts.push({
          fileData: {
            mimeType: consultation.mimeType || 'audio/webm',
            fileUri: consultation.remoteFileUri
          }
        });
      }
      return audioParts;
    };

    let totalTokensUsed = 0;
    let lastModelUsed = '';
    let verbatimTranscript = '';
    let activeTranscriptionSource = consultation.transcriptionEngine || 'gemini-cloud';

    // Se a Etapa 1 já foi concluída anteriormente para este áudio (ex.: Etapa 1 ok, Etapa 2 deu 503 temporário e está retentando),
    // reaproveita a transcrição salva e pula direto para a Etapa 2 — economiza tempo e cota!
    const existingSavedRaw = String(consultation.rawTranscript || '').trim();
    const existingPrevRaw = String(consultation.previousRawTranscript || '').trim();
    const hasAlreadyCompletedStage1 = Boolean(
      !consultation.forceCloudAudioTranscription
      && existingSavedRaw.length >= 30
      && (!existingPrevRaw || existingSavedRaw.length > existingPrevRaw.length + 20)
    );
    if (hasAlreadyCompletedStage1) {
      verbatimTranscript = existingSavedRaw;
      if (onProgressMilestone) {
        onProgressMilestone(58, '⚡ Transcrição já pronta! Pulando direto para organização clínica (Etapa 2/2)...');
      }
    }

    // =========================================================================
    // ETAPA 1 DE 2 (DEDICADA EXCLUSIVAMENTE À TRANSCRIÇÃO LITERAL DE 100% DO ÁUDIO):
    // - Modo 'whisper': tenta Whisper Local primeiro (economiza ~85% cota) -> fallback automático p/ Gemini se falhar.
    // - Modo 'auto' (Automático Inteligente): usa Gemini normalmente; se consulta >=50min ou Gemini deu 503/limite
    //   recentemente (ou falhar agora), alterna AUTOMATICAMENTE para o Whisper Local sem travar o plantão!
    // - Modo 'cloud' (ou botão "Re-transcrever no Gemini"): envia áudio direto ao Gemini.
    // =========================================================================
    const audioEngineMode = getAudioEngineMode();
    const isLongConsultForAuto = (consultation.durationSeconds || 0) >= 50 * 60;
    const geminiRecentlyOverloaded = (Date.now() - lastGeminiAudioOverloadAt) < 10 * 60 * 1000;
    let triedWhisperThisRun = false;

    const runLocalWhisperStage1 = async (reasonMsg) => {
      if (triedWhisperThisRun || localAudioBlobs.length === 0) return false;
      triedWhisperThisRun = true;
      if (reasonMsg) showToast(reasonMsg);
      const whisperRes = await transcribeAudioBlobsWithLocalWhisper(localAudioBlobs, onProgressMilestone);
      if (whisperRes && whisperRes.transcript && whisperRes.transcript.length >= 15) {
        verbatimTranscript = consultation.previousRawTranscript
          ? `${consultation.previousRawTranscript}\n\n--- CONTINUAÇÃO DO ATENDIMENTO ---\n${whisperRes.transcript}`
          : whisperRes.transcript;
        activeTranscriptionSource = 'whisper-local';
        consultation.transcriptionEngine = 'whisper-local';
        consultation.whisperModelUsed = whisperRes.modelLabel;
        consultation.forceCloudAudioTranscription = false;
        consultation.rawTranscript = fixBrazilianMedicationSpelling(verbatimTranscript);
        await window.ScribeDB.saveConsultation(consultation);
        return true;
      }
      return false;
    };

    const shouldTryLocalWhisperFirst = !verbatimTranscript
      && hasAudioAttached
      && localAudioBlobs.length > 0
      && !consultation.forceCloudAudioTranscription
      && (audioEngineMode === 'whisper' || (audioEngineMode === 'auto' && (isLongConsultForAuto || geminiRecentlyOverloaded)));

    if (shouldTryLocalWhisperFirst) {
      try {
        const autoNote = (audioEngineMode === 'auto')
          ? (isLongConsultForAuto
              ? '🔄 Modo Auto: consulta longa (>50 min) — usando Whisper Local para não falhar!'
              : '🔄 Modo Auto: Google instável recentemente — usando Whisper Local!')
          : '';
        await runLocalWhisperStage1(autoNote);
      } catch (whisperErr) {
        const shortWhisperReason = String(whisperErr?.message || 'indisponível').slice(0, 90);
        console.warn('Whisper Local falhou, fazendo fallback automático para Gemini (nuvem):', whisperErr);
        showToast(`⚠️ Whisper Local falhou (${shortWhisperReason}) — enviando automaticamente ao Gemini...`);
        if (onProgressMilestone) {
          onProgressMilestone(20, `☁️ Whisper falhou (${shortWhisperReason}) — subindo áudio para o Gemini...`);
        }
      }
    }

    if (!verbatimTranscript && hasAudioAttached && window.buildVerbatimAudioTranscriptionPrompt) {
      await ensureGeminiAudioPartsPrepared();
      if (audioParts.length > 0) {
        if (onProgressMilestone) {
          onProgressMilestone(22, audioParts.length > 1
            ? `🎙️ Etapa 1/2 (Gemini): Juntando e transcrevendo os ${audioParts.length} arquivos de áudio...`
            : '🎙️ Etapa 1/2 (Gemini): Transcrevendo 100% do áudio palavra por palavra...');
        }
        try {
          const prevHeaderLines = (consultation.previousConsultationText || '')
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.startsWith('#'))
            .slice(0, 12)
            .join('\n');
          const verbatimPrompt = window.buildVerbatimAudioTranscriptionPrompt(consultation.durationSeconds, {
            templateName: tpl.name,
            quickNotes: consultation.quickNotes || '',
            previousHeaderSummary: prevHeaderLines,
            audioFilesCount: audioParts.length
          });
          const stage1Body = {
            contents: [{
              role: 'user',
              parts: [
                ...audioParts,
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
          }, { allowLiveFallback: true, maxRounds: 1, disableThinking: true });
          const stage1Text = (stage1Res.responseJson?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
          totalTokensUsed += stage1Res.responseJson?.usageMetadata?.totalTokenCount || 0;
          lastModelUsed = stage1Res.modelUsed || lastModelUsed;

          if (stage1Text && stage1Text.length >= 15) {
            verbatimTranscript = consultation.previousRawTranscript
              ? `${consultation.previousRawTranscript}\n\n--- CONTINUAÇÃO DO ATENDIMENTO ---\n${stage1Text}`
              : stage1Text;
            activeTranscriptionSource = 'gemini-cloud';
            consultation.transcriptionEngine = 'gemini-cloud';
            consultation.whisperModelUsed = '';
            consultation.forceCloudAudioTranscription = false;
            // Salva imediatamente a transcrição literal completa no banco de dados local!
            consultation.rawTranscript = fixBrazilianMedicationSpelling(verbatimTranscript);
            await window.ScribeDB.saveConsultation(consultation);
          }
        } catch (stage1Err) {
          console.warn('Etapa 1 (Gemini) falhou:', stage1Err);
          const errStr = String(stage1Err?.message || '');
          if (/503|429|high\s+demand|overloaded|quota|limite|timeout|rede|network/i.test(errStr)) {
            lastGeminiAudioOverloadAt = Date.now();
          }

          // MODO AUTOMÁTICO INTELIGENTE: Gemini falhou (503 / limite / sobrecarga) -> alterna automaticamente para o Whisper Local!
          if (audioEngineMode === 'auto' && !consultation.forceCloudAudioTranscription && !triedWhisperThisRun && localAudioBlobs.length > 0) {
            try {
              if (onProgressMilestone) {
                onProgressMilestone(20, '🔄 Modo Auto: Gemini ocupado (503/limite) — alternando para Whisper Local...');
              }
              await runLocalWhisperStage1('🔄 Modo Auto: Gemini ocupado (503/limite) — alternando sozinho para o Whisper Local!');
            } catch (autoWhisperErr) {
              console.warn('Fallback automático p/ Whisper também falhou:', autoWhisperErr);
            }
          }

          // Atendimento continuado: se ainda ficou sem transcrição, preserva a evolução anterior intacta
          if (!verbatimTranscript && (consultation.previousRawTranscript || consultation.previousEvolutionText)) {
            throw new Error('Não foi possível transcrever a continuação agora. A evolução anterior foi preservada — clique em "Atualizar" para tentar novamente.');
          }
        }
      }
    }

    if (!verbatimTranscript && consultation.rawTranscript) {
      verbatimTranscript = consultation.rawTranscript;
    }
    if (!verbatimTranscript && hasAudioAttached) {
      await ensureGeminiAudioPartsPrepared();
    }
    if (consultation.forceCloudAudioTranscription) {
      consultation.forceCloudAudioTranscription = false;
    }

    // =========================================================================
    // ETAPA 2 DE 2 (ESTRUTURAÇÃO CLÍNICA COMPLETA A PARTIR DA TRANSCRIÇÃO INTEGRAL):
    // Com toda a conversa já transcrita palavra por palavra em texto, o modelo lê
    // cada linha do diálogo e converte 100% das queixas, história, exame físico e
    // condutas para a máscara clínica sem omitir absolutamente nada!
    // =========================================================================
    const hasPreTranscribedDialogue = Boolean(verbatimTranscript && verbatimTranscript.length >= 15);
    const consultPatientAge = consultation.patientAge || getCurrentPatientAgeAndSex().age || '';
    const consultPatientSex = (consultation.templateId === 'prenatal' || state.selectedTemplateId === 'prenatal')
      ? 'F'
      : (consultation.patientSex || getCurrentPatientAgeAndSex().sex || '');
    const promptText = window.buildMedicalEvolutionPrompt(
      tpl,
      consultation.quickNotes,
      consultation.zScoreSummary,
      examFiles.length > 0 || Boolean(preExams) || hasNotesExams || (isPrenatalConsult && Boolean(consultation.previousConsultationText)),
      consultation.previousEvolutionText || '',
      consultation.previousConsultationText || '',
      preExams,
      soapSubtypeHeader,
      hasPreTranscribedDialogue,
      consultPatientAge,
      consultPatientSex,
      consultVdVisitDate,
      activeTranscriptionSource
    );

    const parts = [];
    // 1. Instruções clínicas e máscara
    parts.push({ text: promptText });

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

    // 3. Por último (máxima atenção do modelo!), entrega a transcrição integral + reforço obrigatório de dados digitados pelo médico
    if (hasPreTranscribedDialogue) {
      const typedReinforcement = [
        consultation.zScoreSummary ? `DADOS ANTROPOMÉTRICOS / Z-SCORE / CÁLCULO OBSTÉTRICO DIGITADOS PELO MÉDICO (INCLUIR 100% NO TÍTULO/OBJETIVO/SUBJETIVO!):\n${consultation.zScoreSummary}` : '',
        consultation.quickNotes && consultation.quickNotes.trim() ? `ANOTAÇÕES RÁPIDAS DIGITADAS PELO MÉDICO (INCLUIR 100% NA EVOLUÇÃO!):\n${consultation.quickNotes.trim()}` : ''
      ].filter(Boolean).join('\n\n');
      parts.push({
        text: `=== TRANSCRIÇÃO LITERAL COMPLETA DO ÁUDIO DA CONSULTA DE HOJE ===\n${verbatimTranscript}\n${typedReinforcement ? `\n=== REFORÇO FINAL OBRIGATÓRIO — DADOS DIGITADOS PELO MÉDICO HOJE ===\n${typedReinforcement}\n` : ''}\nLEMBRETE FINAL OBRIGATÓRIO: Inclua 100% das queixas, Controle de HGT e Controle de PA (sempre no SUBJETIVO com TODOS os valores descritos!), exame físico (somente o que foi avaliado, respeitando alterações de estado geral como REG/MEG se houver), dados digitados acima, TODAS as condutas com as DOSES EXATAS faladas (ml, gotas, mg, posologia — proibido trocar por "conforme peso/orientação") e crie a seção PLANO ao final sempre que houver ação/seguimento/exame para próximas consultas!`
      });
    } else if (hasAudioAttached && audioParts.length > 0) {
      parts.push(...audioParts);
    }

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
    }, { allowGemmaFallback: hasPreTranscribedDialogue && (Boolean(preExams) || examFiles.length === 0) });

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
        soapSubtypeHeader,
        true,
        consultPatientAge,
        consultPatientSex,
        consultVdVisitDate,
        activeTranscriptionSource
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
        const rescueRes = await callGeminiWithFallbackAndRetry(rescueBody, apiKey, null, { allowGemmaFallback: true });
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

    // VERIFICAÇÃO AUTOMÁTICA DE COMPLETUDE NA 1ª PASSAGEM:
    // Se a transcrição literal for longa e a evolução gerada vier resumida/curta demais em relação ao diálogo,
    // expande e converte 100% dos achados, avaliações e orientações para terminologia médica técnica antes de concluir!
    const isShortFormatTemplate = consultation.templateId === 'telessaude'
      || (consultation.templateId === 'interconsulta' && soapSubtypeHeader && /resumid/i.test(soapSubtypeHeader));
    if (
      hasPreTranscribedDialogue &&
      !isNonClinicalWarning &&
      !isShortFormatTemplate &&
      verbatimTranscript.length >= 900 &&
      finalEvolution.length < Math.min(1800, verbatimTranscript.length * 0.45)
    ) {
      if (onProgressMilestone) {
        onProgressMilestone(82, '🩺 Completando 100% dos achados e termos médicos técnicos...');
      }
      const expandBody = {
        systemInstruction: medicalSystemInstruction,
        contents: [{
          role: 'user',
          parts: [
            { text: `=== TRANSCRIÇÃO LITERAL COMPLETA DO ATENDIMENTO ===\n${verbatimTranscript}` },
            { text: `=== RASCUNHO ATUAL (FICOU RESUMIDO — EXPANDA E COMPLETE 100%!) ===\n${finalEvolution}` },
            {
              text: `Compare o rascunho acima linha por linha com a transcrição literal completa. O rascunho omitiu detalhes importantes do atendimento.\nReescreva a "evolucao_completa" mantendo rigorosamente a mesma máscara clínica, porém garantindo que 100% do que foi falado, perguntado, examinado, avaliado e orientado conste de forma integral em terminologia médica técnica formal (ex.: dispneia, disúria, cefaleia, artralgia, parestesia, pirose, etc.), sem resumir nada e sem inventar dados.\nResponda em JSON válido com a chave "evolucao_completa".`
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 65536,
          responseMimeType: 'application/json'
        }
      };
      try {
        const expandRes = await callGeminiWithFallbackAndRetry(expandBody, apiKey);
        const expandRaw = expandRes.responseJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const expandParsed = parseGeminiEvolutionResponse(expandRaw);
        if (expandParsed.evolucao_completa && expandParsed.evolucao_completa.length > finalEvolution.length) {
          finalEvolution = expandParsed.evolucao_completa;
          totalTokensUsed += expandRes.responseJson?.usageMetadata?.totalTokenCount || 0;
        }
      } catch (_) {}
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
      soapSubtypeHeader,
      consultPatientAge,
      consultPatientSex,
      transcriptCandidate,
      consultVdVisitDate,
      consultation.quickNotes || '',
      consultation.zScoreSummary || ''
    );

    // Filtra alertas falsos gerados pela IA sobre alergia/tabagismo e faz auditoria determinística real sobre o texto final limpo
    const combinedAuditAlerts = (Array.isArray(parsed.alertas_auditoria) ? [...parsed.alertas_auditoria] : [])
      .filter(a => !/alergia|tabag|fumo|fumante/i.test(String(a || '')));

    // Auditoria Determinística de Alergias e Tabagismo para atendimentos clínicos estruturados (exceto Telessaúde)
    if (consultation.templateId !== 'telessaude') {
      const dynamicAlerts = getActiveAuditAlertsForEvolution(cleanText, consultation.templateId);
      combinedAuditAlerts.push(...dynamicAlerts);
    }

    // Se este atendimento for uma CONTINUAÇÃO (retomada da gravação do mesmo paciente),
    // FUSIONA CUMULATIVAMENTE a 1ª parte com a continuação, garantindo que NUNCA apague
    // Subjetivo, Objetivo ou as Condutas já prescritas na 1ª parte!
    let finalMergedEvolution = cleanText;
    if (consultation.previousEvolutionText && consultation.previousEvolutionText.trim().length >= 30) {
      finalMergedEvolution = mergeContinuedEvolutionText(
        consultation.previousEvolutionText,
        cleanText,
        transcriptCandidate,
        consultation.templateId
      );
    }

    return {
      evolutionText: finalMergedEvolution,
      cidCiapCodes: codes,
      rawTranscript: fixBrazilianMedicationSpelling(transcriptCandidate || parsed.transcricao_literal_do_audio || ''),
      soapParts: {
        subjetivo: extractSectionFromText(finalMergedEvolution, 'subjetivo'),
        objetivo: extractSectionFromText(finalMergedEvolution, 'objetivo'),
        exames: extractSectionFromText(finalMergedEvolution, 'exames'),
        avaliacao: extractSectionFromText(finalMergedEvolution, 'avaliacao'),
        conduta: extractSectionFromText(finalMergedEvolution, 'conduta'),
        plano: extractSectionFromText(finalMergedEvolution, 'plano')
      },
      auditAlerts: combinedAuditAlerts,
      suggestedSpecialty: parsed.especialidade_sugerida_encaminhamento || '',
      tokensUsed,
      modelUsed: lastModelUsed
    };
  }

  // Divisão determinística das seções do prontuário para preservação e fusão contínua
  function splitSoapIntoSections(text) {
    const sections = {
      header: '',
      subjetivo: '',
      objetivo: '',
      exames: '',
      avaliacao: '',
      conduta: '',
      plano: ''
    };

    const raw = String(text || '').trim();
    if (!raw) return sections;

    const reSubj = /\n\s*(?:4\.\s*)?SUBJETIVO(?=[ \t]*(?:\n|$))/;
    const reObj = /\n\s*(?:5\.|6\.\s*)?OBJETIVO(?:\s*\(EXAME FÍSICO\))?(?=[ \t]*(?:\n|$))/;
    const reExams = /\n\s*(?:EXAMES COMPLEMENTARES|ULTRASSONOGRAFIA)(?=[ \t]*(?:\n|$))/;
    const reEval = /\n\s*(?:7\.|8\.|9\.\s*)?AVALIAÇÃO(?=[ \t]*(?:\n|$))/;
    const reCond = /\n\s*(?:10\.\s*)?CONDUTA(?=[ \t]*(?:\n|$))/;
    const rePlan = /\n\s*(?:11\.\s*)?PLANO(?=[ \t]*(?:\n|$))/;

    const mSubj = raw.match(reSubj);
    if (mSubj) {
      sections.header = raw.slice(0, mSubj.index).trim();
      let rest = raw.slice(mSubj.index);

      const mObj = rest.match(reObj);
      if (mObj) {
        sections.subjetivo = rest.slice(0, mObj.index).replace(reSubj, '').trim();
        rest = rest.slice(mObj.index);

        const mEval = rest.match(reEval);
        const mExams = rest.match(reExams);

        if (mExams && (!mEval || mExams.index < mEval.index)) {
          sections.objetivo = rest.slice(0, mExams.index).replace(reObj, '').trim();
          rest = rest.slice(mExams.index);

          const mEvalAfter = rest.match(reEval);
          if (mEvalAfter) {
            sections.exames = rest.slice(0, mEvalAfter.index).trim();
            rest = rest.slice(mEvalAfter.index);
          }
        } else if (mEval) {
          sections.objetivo = rest.slice(0, mEval.index).replace(reObj, '').trim();
          rest = rest.slice(mEval.index);
        }

        const mCond = rest.match(reCond);
        if (mCond) {
          sections.avaliacao = rest.slice(0, mCond.index).replace(reEval, '').trim();
          rest = rest.slice(mCond.index);

          const mPlan = rest.match(rePlan);
          if (mPlan) {
            sections.conduta = rest.slice(0, mPlan.index).replace(reCond, '').trim();
            sections.plano = rest.slice(mPlan.index).replace(rePlan, '').trim();
          } else {
            sections.conduta = rest.replace(reCond, '').trim();
          }
        } else {
          sections.avaliacao = rest.replace(reEval, '').trim();
        }
      } else {
        sections.subjetivo = rest.replace(reSubj, '').trim();
      }
    } else {
      sections.header = raw;
    }

    return sections;
  }

  // Fusão cumulativa e inteligente da 1ª parte com a continuação da consulta
  function mergeContinuedEvolutionText(prevEvolution, newEvolution, newTranscript, templateId) {
    if (!prevEvolution || !prevEvolution.trim()) return newEvolution;
    if (!newEvolution || !newEvolution.trim()) return prevEvolution;

    const prevSections = splitSoapIntoSections(prevEvolution);
    const newSections = splitSoapIntoSections(newEvolution);

    if (!prevSections.subjetivo && !prevSections.conduta) {
      return `${prevEvolution}\n\n\n${newEvolution}`;
    }

    // 1. Cabeçalho (# MUC, Alergias, Condições Crônicas):
    // Preserva 100% o cabeçalho já aprovado da 1ª parte
    let mergedHeader = prevSections.header || '';
    if (newSections.header) {
      const newCondLines = (newSections.header.match(/^#\s+[^\n]+/gm) || []).filter(line => {
        const norm = normalizeCompare(line.replace(/^#\s+/i, ''));
        return norm && !normalizeCompare(mergedHeader).includes(norm) && !norm.startsWith('muc') && !norm.startsWith('alergia') && !norm.startsWith('tabag');
      });
      if (newCondLines.length > 0 && mergedHeader) {
        mergedHeader = mergedHeader.replace(/(?=\n*#\s*MUC:|\n*#\s*Tabagista:|\s*$)/i, `\n${newCondLines.join('\n')}`);
      } else if (!mergedHeader) {
        mergedHeader = newSections.header;
      }
    }

    // 2. SUBJETIVO: Preserva integralmente a história clínica da 1ª parte!
    let mergedSubjetivo = prevSections.subjetivo || '';
    if (newSections.subjetivo) {
      const prevNorm = normalizeCompare(mergedSubjetivo);
      const newNorm = normalizeCompare(newSections.subjetivo);
      if (newNorm && !prevNorm.includes(newNorm)) {
        const newSentences = newSections.subjetivo
          .split(/(?<=[.!?])\s+|\n+/)
          .map(s => s.trim())
          .filter(s => s.length > 15 && !prevNorm.includes(normalizeCompare(s)));

        if (newSentences.length > 0) {
          mergedSubjetivo += `\n\n${newSentences.join(' ')}`;
        }
      }
    } else if (!mergedSubjetivo) {
      mergedSubjetivo = newSections.subjetivo || '';
    }

    // 3. OBJETIVO: Preserva integralmente o exame físico da 1ª parte!
    let mergedObjetivo = prevSections.objetivo || '';
    if (newSections.objetivo) {
      const prevNorm = normalizeCompare(mergedObjetivo);
      const newNorm = normalizeCompare(newSections.objetivo);
      if (newNorm && !prevNorm.includes(newNorm)) {
        const newObjLines = newSections.objetivo
          .split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 5 && !prevNorm.includes(normalizeCompare(l)) && !/sem alterações adicionais|exame mantido/i.test(l));
        if (newObjLines.length > 0) {
          mergedObjetivo += `\n${newObjLines.join('\n')}`;
        }
      }
    } else if (!mergedObjetivo) {
      mergedObjetivo = newSections.objetivo || '';
    }

    // 4. EXAMES COMPLEMENTARES
    let mergedExames = prevSections.exames || '';
    if (newSections.exames) {
      const prevNorm = normalizeCompare(mergedExames);
      const newExamLines = newSections.exames
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 5 && !prevNorm.includes(normalizeCompare(l)) && !/^EXAMES COMPLEMENTARES/i.test(l));
      if (newExamLines.length > 0) {
        mergedExames += (mergedExames ? '\n' : 'EXAMES COMPLEMENTARES\n') + newExamLines.join('\n');
      }
    }

    // 5. AVALIAÇÃO: Cada diagnóstico em sua própria linha separada, sem numeração
    let mergedAvaliacao = prevSections.avaliacao || '';
    if (newSections.avaliacao) {
      const prevNorm = normalizeCompare(mergedAvaliacao);
      const newEvalLines = newSections.avaliacao
        .split('\n')
        .map(l => l.trim().replace(/^\s*(?:\d+[\.\)]|-)\s*/, ''))
        .filter(l => l.length > 5 && !prevNorm.includes(normalizeCompare(l)));
      if (newEvalLines.length > 0) {
        mergedAvaliacao += (mergedAvaliacao ? '\n' : '') + newEvalLines.join('\n');
      }
    }

    // 6. CONDUTA: Preserva todas as condutas da 1ª parte e concatena novas da continuação sem numeração
    let mergedConduta = prevSections.conduta || '';
    if (newSections.conduta) {
      const prevItems = (mergedConduta.split('\n') || [])
        .map(item => item.trim().replace(/^\s*(?:\d+[\.\)]|-)\s*/, ''))
        .filter(Boolean);

      const newItems = (newSections.conduta.split('\n') || [])
        .map(item => item.trim().replace(/^\s*(?:\d+[\.\)]|-)\s*/, ''))
        .filter(Boolean);

      if (prevItems.length === 0) {
        mergedConduta = newItems.join('\n');
      } else {
        const prevNorm = normalizeCompare(mergedConduta);
        const trulyNewItems = [];

        newItems.forEach(itemText => {
          const itemNorm = normalizeCompare(itemText);
          if (itemNorm.length >= 8 && !prevNorm.includes(itemNorm)) {
            trulyNewItems.push(itemText);
          }
        });

        if (trulyNewItems.length > 0) {
          mergedConduta = `${prevItems.join('\n')}\n${trulyNewItems.join('\n')}`;
        }
      }
    }

    // 7. PLANO: Ações futuras planejadas para próximas consultas, sem numeração e sem texto genérico
    let mergedPlano = prevSections.plano || '';
    const isPlanBoilerplate = (str) => /seguimento ambulatorial na aps|sem pend[êe]ncias|nenhuma a[çc][ãa]o/i.test(str || '');
    if (isPlanBoilerplate(mergedPlano)) mergedPlano = '';
    if (newSections.plano) {
      const prevNorm = normalizeCompare(mergedPlano);
      const newPlanLines = (newSections.plano.split('\n') || [])
        .map(l => l.trim().replace(/^\s*(?:\d+[\.\)]|-)\s*/, ''))
        .filter(l => l.length > 5 && !prevNorm.includes(normalizeCompare(l)) && !isPlanBoilerplate(l));
      if (newPlanLines.length > 0) {
        mergedPlano += (mergedPlano ? '\n' : '') + newPlanLines.join('\n');
      }
    }
    if (isPlanBoilerplate(mergedPlano)) mergedPlano = '';

    let result = '';
    if (mergedHeader) result += `${mergedHeader}\n\n\n`;
    if (mergedSubjetivo) result += `SUBJETIVO\n${mergedSubjetivo}\n\n\n`;
    if (mergedObjetivo) result += `OBJETIVO\n${mergedObjetivo}\n\n\n`;
    if (mergedExames) result += `${mergedExames}\n\n\n`;
    if (mergedAvaliacao) result += `AVALIAÇÃO\n${mergedAvaliacao}\n\n\n`;
    if (mergedConduta) result += `CONDUTA\n${mergedConduta}`;
    if (mergedPlano) result += `\n\n\nPLANO\n${mergedPlano}`;

    return result.trim();
  }

  // Auditoria Determinística de Alergias e Tabagismo para atendimentos clínicos estruturados (elimina falsos positivos)
  function getActiveAuditAlertsForEvolution(evolutionText, templateId) {
    if (templateId === 'telessaude') return [];
    const text = String(evolutionText || '');
    if (!text.trim()) return [];
    if (templateId === 'interconsulta' && !/^\s*SUBJETIVO\b/im.test(text)) return [];

    const alerts = [];

    // Auditoria de Alergias
    const alergiasMatch = text.match(/^#\s*Alergias?\s*:\s*(.*)$/im);
    const alergiasUnstructured = /^#\s*(?:Nega\s+alergias|Sem\s+alergias|Alergia\s+a\s+\S+)/im.test(text)
      || /\b(?:Alergias?\s*:\s*\S+|Alergia\s+medicamentosa|Nega\s+alergias)\b/i.test(text);
    const alergiasFilled = (alergiasMatch && alergiasMatch[1].trim().length > 0) || alergiasUnstructured;
    if (!alergiasFilled) {
      alerts.push('⚠️ Campo ALERGIAS ausente/não informado');
    }

    // Auditoria de Tabagismo (Tabagista ativo, Tabagista passiva/passivo, Ex-tabagista, Nega tabagismo, Esposo tabagista)
    const tabagistaMatch = text.match(/^#\s*Tabagist[ao]\s*:\s*(.*)$/im);
    const tabagistaUnstructured = /^#\s*(?:Tabagist[ao]\s+passiv[oa]|Ex-?tabagista|Tabagismo\s*:\s*\S+|Nega\s+tabagismo|Sem\s+tabagismo)/im.test(text)
      || /\b(?:Tabagist[ao]\s*:\s*\S+|Tabagist[ao]\s+passiv[oa]|Ex-?tabagista|Nega\s+tabagismo|Esposo\s+tabagista)\b/i.test(text);
    const tabagistaFilled = (tabagistaMatch && tabagistaMatch[1].trim().length > 0) || tabagistaUnstructured;
    if (!tabagistaFilled) {
      alerts.push('⚠️ Campo TABAGISMO ausente/não informado');
    }

    // Auditoria específica da Puericultura: Z-score (nunca percentil) e coerência das vacinas
    if (templateId === 'puericultura') {
      if (/percentil|\bP\s?(?:3|5|10|15|25|50|75|85|90|95|97)\b(?!\s*[:=]?\s*\d)/i.test(text)) {
        alerts.push('⚠️ Puericultura cita PERCENTIL — o padrão é Z-score (OMS). Revisar antropometria');
      }
      const vacBlock = (text.match(/^#\s*Vacinas?\s*:[^\n]*(?:\n(?!#|\s*$|SUBJETIVO)[^\n]*)*/im) || [''])[0];
      const vacSaysOk = /atualizad|em\s+dia|completas?\b/i.test(vacBlock);
      const textSaysLate = /vacinas?[^.\n]{0,80}(?:atraso|pendente|atrasad)|(?:atraso|pendente|atrasad)[^.\n]{0,80}vacinas?/i.test(text.replace(vacBlock, ''));
      if (vacSaysOk && textSaysLate) {
        alerts.push('⚠️ Vacinas: consta "atualizadas/em dia" mas há menção de atraso/pendência — conferir');
      }
      if (/^\s*-?\s*atualizadas?\s*:\s*pendente/im.test(vacBlock)) {
        alerts.push('⚠️ Vacinas: campo inconsistente ("atualizadas: Pendente") — corrigir manualmente');
      }
    }

    return alerts;
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

  // Calculadora determinística da TFG pela equação CKD-EPI (2021) + Classificação KDIGO (G1 a G5)
  // Regra de segurança estrita: SÓ calcula quando Creatinina, Idade (>= 18 anos) e Sexo ('M' ou 'F') são 100% confirmados.
  function calculateCkdEpi2021(scrRaw, ageRaw, sexRaw) {
    const scr = parseFloat(String(scrRaw || '').replace(',', '.'));
    const age = parseInt(String(ageRaw || ''), 10);
    const sex = String(sexRaw || '').trim().toUpperCase();
    if (isNaN(scr) || scr <= 0 || scr >= 35) return null;
    if (isNaN(age) || age < 18 || age > 125) return null;
    if (sex !== 'M' && sex !== 'F') return null;

    const kappa = sex === 'F' ? 0.7 : 0.9;
    const alpha = sex === 'F' ? -0.241 : -0.302;
    const sexFactor = sex === 'F' ? 1.012 : 1.0;
    const ratio = scr / kappa;
    const egfrExact = 142 * Math.pow(Math.min(ratio, 1), alpha) * Math.pow(Math.max(ratio, 1), -1.200) * Math.pow(0.9938, age) * sexFactor;
    const egfr = Math.round(egfrExact);

    let stageCode = 'G1';
    let stageDesc = 'Normal ou elevada';
    if (egfr >= 90) {
      stageCode = 'G1';
      stageDesc = 'Normal ou elevada';
    } else if (egfr >= 60) {
      stageCode = 'G2';
      stageDesc = 'Levemente diminuída';
    } else if (egfr >= 45) {
      stageCode = 'G3a';
      stageDesc = 'Leve a moderadamente diminuída';
    } else if (egfr >= 30) {
      stageCode = 'G3b';
      stageDesc = 'Moderada a gravemente diminuída';
    } else if (egfr >= 15) {
      stageCode = 'G4';
      stageDesc = 'Gravemente diminuída';
    } else {
      stageCode = 'G5';
      stageDesc = 'Falência renal';
    }

    return { egfr, stageCode, stageDesc, age, sex };
  }

  // Limpa e compacta linhas de exames laboratoriais no formato padrão limpo da APS (sem unidades prolixas e sem índices redundantes)
  // Também executa os cálculos determinísticos de TFG (CKD-EPI 2021), IST % (calculado) e padronização de SOF.
  function formatCleanCompactLabLine(rawLine, manualAge = '', manualSex = '', calcCollector = null) {
    if (!rawLine || typeof rawLine !== 'string') return '';
    let l = rawLine.trim();
    if (!l.startsWith('- LABS')) return l;

    // Extrai eventual idade e sexo que o modelo tenha lido diretamente do cabeçalho do PDF dentro da tag CKD-EPI
    let pdfAge = '';
    let pdfSex = '';
    const pdfMetaMatch = l.match(/CKD-EPI[^)]*?\b([1-9][0-9]{1,2})\s*(?:a|anos)\b[^)]*?\b(M|F|Masculino|Feminino)\b/i)
      || l.match(/\b([1-9][0-9]{1,2})\s*(?:a|anos)\s*,\s*(M|F|Masculino|Feminino)\b/i);
    if (pdfMetaMatch) {
      pdfAge = pdfMetaMatch[1];
      const sRaw = pdfMetaMatch[2].toUpperCase();
      pdfSex = sRaw.startsWith('F') ? 'F' : (sRaw.startsWith('M') ? 'M' : '');
    }

    // Remove unidades de medida desnecessárias no prontuário médico (preservando % para HbA1c e IST!)
    l = l.replace(/\s*(?:milh\.\/mm³|milhões\/mm³|mL\/min\/1[.,]73\s*m²|mL\/min|g\/dL|mg\/dL|µg\/dL|ug\/dL|pg|fL|U\/L|u\/L|µUI\/mL|uUI\/mL|ng\/mL|mEq\/L|segundos|seg|\/mm³|\/µL|\/uL)\b/gi, '');

    // Remove redundâncias laboratoriais
    l = l.replace(/Glicemia estimada média\s*:\s*[^|)]+/gi, '');
    l = l.replace(/Colesterol Não-HDL\s*:\s*[^|)]+/gi, '');
    l = l.replace(/Relação Colesterol Total\/HDL\s*:\s*[^|)]+/gi, '');
    l = l.replace(/Atividade de protrombina\s*:\s*[^|)]+\s*\|\s*RNI/gi, 'TAP RNI');
    l = l.replace(/Proteína C Reativa Quantitativa/gi, 'PCR');
    l = l.replace(/Proteína C Reativa/gi, 'PCR');
    l = l.replace(/Pesquisa Quantitativa\s*:\s*/gi, '');
    l = l.replace(/TIBC\s*\(Capacidade[^)]+\)/gi, 'TIBC');
    l = l.replace(/Capacidade Total de Liga[çc][ãa]o do Ferro(?:\s*\(TIBC\)|\s*\(CTLF\))?/gi, 'TIBC');
    l = l.replace(/Capacidade Latente de Liga[çc][ãa]o do Ferro(?:\s*\(CLLF\))?/gi, 'CLLF');
    l = l.replace(/[ÍI]ndice de Satura[çc][ãa]o d[ae] Transferrina(?:\s*\(IST\))?/gi, 'IST');
    l = l.replace(/Satura[çc][ãa]o d[ae] Transferrina(?:\s*\(IST\))?/gi, 'IST');
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

    // Padronização estrita de Sangue Oculto nas Fezes com a sigla SOF
    l = l.replace(/(?:Pesquisa\s+de\s+)?Sangue\s+Oculto(?:\s+nas\s+Fezes)?\s*(?:\([^)]*\))?\s*:?\s*(Negativ[oa]|Ausente|N[ãa]o\s+reagente)/gi, 'SOF negativo');
    l = l.replace(/(?:Pesquisa\s+de\s+)?Sangue\s+Oculto(?:\s+nas\s+Fezes)?\s*(?:\([^)]*\))?\s*:?\s*(Positiv[oa]|Presente|Reagente)/gi, 'SOF positivo');
    l = l.replace(/\b(?:PSOF|SOF)\s*:?\s*(Negativ[oa]|Ausente|N[ãa]o\s+reagente)\b/gi, 'SOF negativo');
    l = l.replace(/\b(?:PSOF|SOF)\s*:?\s*(Positiv[oa]|Presente|Reagente)\b/gi, 'SOF positivo');
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
    l = l.replace(/\b(Hb|Ht|VCM|Leuco|Plaq|GJ|HbA1c|CT|HDL|LDL|TAG|Creat|Ureia|TGO|TGP|GGT|FA|PCR|Ferro|Ferritina|Transferrina|TIBC|CTLF|CLLF|IST|TSH|T4L|B12|Na|K)\s*:\s*([0-9,.]+)/g, '$1 $2');
    l = l.replace(/\b(TAP|KPTT)\s*:\s*/gi, '$1 ');

    // 1) CÁLCULO AUTOMÁTICO DO PERFIL DO FERRO -> IST % (calculado)
    const ferroMatch = l.match(/\bFerro\s+([0-9]+(?:[.,][0-9]+)?)/i);
    const tibcMatch = l.match(/\b(?:TIBC|CTLF|CLF)\s+([0-9]+(?:[.,][0-9]+)?)/i);
    const cllfMatch = l.match(/\b(?:CLLF|UIBC)\s+([0-9]+(?:[.,][0-9]+)?)/i);
    const transfMatch = l.match(/\bTransferrina\s+([0-9]+(?:[.,][0-9]+)?)/i);

    if (ferroMatch) {
      const ferroVal = parseFloat(ferroMatch[1].replace(',', '.'));
      let tibcVal = NaN;
      if (tibcMatch) {
        tibcVal = parseFloat(tibcMatch[1].replace(',', '.'));
      } else if (cllfMatch) {
        const cllfVal = parseFloat(cllfMatch[1].replace(',', '.'));
        if (!isNaN(cllfVal) && cllfVal > 0) tibcVal = ferroVal + cllfVal;
      } else if (transfMatch) {
        const transfVal = parseFloat(transfMatch[1].replace(',', '.'));
        if (!isNaN(transfVal) && transfVal > 0) tibcVal = transfVal * 1.25;
      }

      if (!isNaN(ferroVal) && ferroVal > 0 && !isNaN(tibcVal) && tibcVal > 0) {
        const istNum = (ferroVal / tibcVal) * 100;
        const istRounded = Math.round(istNum * 10) / 10;
        const istFormatted = Number.isInteger(istRounded)
          ? `${istRounded}%`
          : `${istRounded.toFixed(1).replace('.', ',')}%`;
        const istTargetTag = `IST ${istFormatted} (calculado)`;

        if (/\bIST\s+[0-9.,]+\s*%?(?:\s*\(calculado\))?/i.test(l)) {
          l = l.replace(/\bIST\s+[0-9.,]+\s*%?(?:\s*\(calculado\))?/gi, istTargetTag);
        } else {
          // Insere logo após o último marcador do perfil de ferro (TIBC, CTLF, CLLF, Transferrina, Ferritina ou Ferro)
          const ironAnchorRe = /(\b(?:TIBC|CTLF|CLLF|Transferrina|Ferritina|Ferro)\s+[0-9]+(?:[.,][0-9]+)?)(?!.*\b(?:TIBC|CTLF|CLLF|Transferrina|Ferritina|Ferro)\s+[0-9])/i;
          if (ironAnchorRe.test(l)) {
            l = l.replace(ironAnchorRe, `$1 | ${istTargetTag}`);
          } else {
            l += ` | ${istTargetTag}`;
          }
        }

        if (Array.isArray(calcCollector)) {
          calcCollector.push({ type: 'ist', istFormatted });
        }
      } else if (/\bIST\s+([0-9]+(?:[.,][0-9]+)?)\s*%?\s*\(calculado\)/i.test(l)) {
        const mIst = l.match(/\bIST\s+([0-9]+(?:[.,][0-9]+)?)\s*%?\s*\(calculado\)/i);
        const istFormatted = `${mIst[1].replace('.', ',')}%`;
        l = l.replace(/\bIST\s+[0-9.,]+\s*%?\s*\(calculado\)/gi, `IST ${istFormatted} (calculado)`);
        if (Array.isArray(calcCollector)) {
          calcCollector.push({ type: 'ist', istFormatted });
        }
      }
    }

    // 2) CÁLCULO AUTOMÁTICO DA TFG (CKD-EPI 2021) + CLASSIFICAÇÃO KDIGO (SOMENTE SE IDADE E SEXO CONFIRMADOS)
    const creatMatch = l.match(/\bCreat\s+([0-9]+(?:[.,][0-9]+)?)/i);
    if (creatMatch) {
      const scrStr = creatMatch[1].replace('.', ',');
      const effectiveAge = manualAge || pdfAge;
      const effectiveSex = manualSex || pdfSex;
      const ckd = calculateCkdEpi2021(scrStr, effectiveAge, effectiveSex);

      // Remove qualquer segmento TFG prévio junto à Creatinina (inclusive "- tfg 139" duplicado) para substituir pelo valor determinístico exato (ou omitir se incerto)
      l = l.replace(/\bCreat\s+[0-9]+(?:[.,][0-9]+)?(?:\s*\|\s*TFG\s*[^|]+|\s*\(\s*TFG\s*[^)]+\))?(?:\s*[-–]\s*tfg\s*[0-9.,]+)?/gi, `Creat ${scrStr}`);
      l = l.replace(/\s*[-–]\s*tfg\s*[0-9.,]+/gi, '');
      l = l.replace(/\|\s*TFG\s+[0-9.,]+(?:\s*\(CKD-EPI[^)]*\))?\s*(?=\||$)/gi, '');

      if (ckd) {
        l = l.replace(new RegExp(`\\bCreat\\s+${scrStr.replace(',', '[.,]')}`, 'i'), `Creat ${scrStr} | TFG ${ckd.egfr} (CKD-EPI ${ckd.stageCode})`);
        if (Array.isArray(calcCollector)) {
          calcCollector.push({
            type: 'ckdepi',
            scr: scrStr,
            egfr: ckd.egfr,
            stageCode: ckd.stageCode,
            stageDesc: ckd.stageDesc,
            age: ckd.age,
            sex: ckd.sex
          });
        }
      } else if (Array.isArray(calcCollector)) {
        calcCollector.push({
          type: 'ckdepi_missing',
          scr: scrStr,
          missingAge: !effectiveAge || parseInt(effectiveAge, 10) < 18,
          missingSex: !effectiveSex
        });
      }
    }

    // Limpa separadores duplicados ou vazios e padroniza espaços ao redor de "|"
    l = l.replace(/\s*\|\s*/g, ' | ')
         .replace(/(?:\s*\|\s*){2,}/g, ' | ')
         .replace(/\s*\|\s*$/g, '')
         .replace(/:\s*\|\s*/g, ': ')
         .replace(/\s+/g, ' ')
         .trim();

    return l;
  }

  // Formata todas as linhas de exames (unificando eventual linha separada de SOF dentro de - LABS e coletando cálculos)
  function formatAllExamLinesWithCalculations(examBlockText, manualAge = '', manualSex = '') {
    if (!examBlockText || typeof examBlockText !== 'string') {
      return { formattedText: '', calculations: [] };
    }
    const rawLines = examBlockText.split('\n');
    const pendingSofItems = [];
    const keptLines = [];

    for (const rawL of rawLines) {
      const t = rawL.trim();
      // Se o modelo colocou Sangue Oculto nas Fezes (SOF) em uma linha separada, captura para juntar na linha - LABS
      const standaloneSofMatch = t.match(/^-\s*(?:(?:Pesquisa\s+de\s+)?Sangue\s+Oculto(?:\s+nas\s+Fezes)?|PSOF|SOF)(?:\s*\([^)]*\))?\s*:?\s*(Negativ[oa]|Positiv[oa]|Ausente|Presente|N[ãa]o\s+reagente|Reagente)\b/i);
      if (standaloneSofMatch) {
        const isPos = /positiv|presente|^(?!n[ãa]o\s+)reagente/i.test(standaloneSofMatch[1]);
        pendingSofItems.push(isPos ? 'SOF positivo' : 'SOF negativo');
        continue;
      }
      keptLines.push(rawL);
    }

    if (pendingSofItems.length > 0) {
      const labsIdx = keptLines.findIndex(l => l.trim().startsWith('- LABS'));
      const sofSuffix = pendingSofItems.join(' | ');
      if (labsIdx >= 0) {
        if (!/\bSOF\s+(?:negativo|positivo)/i.test(keptLines[labsIdx])) {
          keptLines[labsIdx] = `${keptLines[labsIdx].trim()} | ${sofSuffix}`;
        }
      } else {
        keptLines.unshift(`- LABS: ${sofSuffix}`);
      }
    }

    const calculations = [];
    const formattedLines = keptLines.map(line => {
      if (line.trim().startsWith('- LABS')) {
        return formatCleanCompactLabLine(line, manualAge, manualSex, calculations);
      }
      return line;
    });

    return {
      formattedText: formattedLines.join('\n'),
      calculations
    };
  }

  // Extrai timestamp numérico (ms) de uma data DD/MM/AAAA ou DD/MM/AA presente em uma linha de exame/vacina/sorologia para ordenação cronológica crescente
  function parseExamDateToTimestamp(lineStr) {
    const m = String(lineStr || '').match(/\b(\d{2})\/(\d{2})\/(\d{2,4})\b/);
    if (!m) return Number.MAX_SAFE_INTEGER;
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    let year = parseInt(m[3], 10);
    if (year < 100) {
      year += year > 50 ? 1900 : 2000;
    }
    const dt = new Date(year, month - 1, day, 12, 0, 0);
    return isNaN(dt.getTime()) ? Number.MAX_SAFE_INTEGER : dt.getTime();
  }

  // Consolida, desduplica e ordena "# VACINAS:" no Pré-Natal:
  // - Nunca mantém "- DTPA: Pendente" se já houver "- DTPA: DD/MM/AAAA"
  // - Unifica sinônimos (DT / ANTITETANICA, VSR / VVSR, COVID / COVID19, Hepatite B, Influenza, DTPA)
  function normalizeAndDeduplicatePrenatalVaccines(headerText) {
    if (!headerText || !/^#\s*VACINAS\s*:/im.test(headerText)) return headerText;

    const lines = headerText.split('\n');
    const collectedVaccineLines = [];
    let firstVacHeaderIdx = -1;
    const indicesToRemove = new Set();

    let inVacBlock = false;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (/^#\s*VACINAS\s*:/i.test(trimmed)) {
        if (firstVacHeaderIdx === -1) {
          firstVacHeaderIdx = i;
        } else {
          indicesToRemove.add(i);
        }
        inVacBlock = true;
        const afterColon = trimmed.replace(/^#\s*VACINAS\s*:\s*/i, '').trim();
        if (afterColon) {
          collectedVaccineLines.push(afterColon.startsWith('-') ? afterColon : `- ${afterColon}`);
        }
        continue;
      }
      if (inVacBlock) {
        if (trimmed.startsWith('-')) {
          collectedVaccineLines.push(trimmed);
          indicesToRemove.add(i);
        } else if (!trimmed) {
          indicesToRemove.add(i);
        } else {
          inVacBlock = false;
        }
      }
    }

    if (firstVacHeaderIdx === -1 || collectedVaccineLines.length === 0) return headerText;

    const canonicalOrder = ['DT', 'DTPA', 'VSR', 'HEPATITE_B', 'INFLUENZA', 'COVID'];
    const canonicalLabels = {
      DT: 'DT',
      DTPA: 'DTPA',
      VSR: 'VSR',
      HEPATITE_B: 'Hepatite B',
      INFLUENZA: 'Influenza',
      COVID: 'COVID'
    };
    const vaccineBuckets = new Map();

    const classifyVaccine = (rawName) => {
      const clean = rawName.replace(/^-\s*/, '').trim();
      if (/^DTPa\b/i.test(clean)) return { key: 'DTPA', label: 'DTPA' };
      if (/^(?:DT\b|Dupla\s+Adulto|Antitet[âa]nica|T[ée]tano)/i.test(clean)) return { key: 'DT', label: 'DT' };
      if (/^V+SR\b/i.test(clean)) return { key: 'VSR', label: 'VSR' };
      if (/^Hep(?:atite)?\s*B\b/i.test(clean)) return { key: 'HEPATITE_B', label: 'Hepatite B' };
      if (/^(?:Influenza|Gripe)\b/i.test(clean)) return { key: 'INFLUENZA', label: 'Influenza' };
      if (/^COVID(?:-?19)?\b/i.test(clean)) return { key: 'COVID', label: 'COVID' };
      return { key: clean.toUpperCase(), label: clean };
    };

    for (const rawLine of collectedVaccineLines) {
      const m = rawLine.match(/^-\s*([^:()]+?)(?:\s*:\s*|\s+\(([^)]+)\)\s*$)(.*)$/);
      let vName = '';
      let vStatus = '';
      if (m) {
        vName = m[1].trim();
        vStatus = (m[2] || m[3] || '').trim();
      } else {
        vName = rawLine.replace(/^-\s*/, '').trim();
        vStatus = '';
      }
      if (!vName) continue;
      const { key, label } = classifyVaccine(vName);
      if (!vaccineBuckets.has(key)) {
        vaccineBuckets.set(key, { label: canonicalLabels[key] || label, dates: [], nonPendingNotes: [], sawPending: false });
      }
      const bucket = vaccineBuckets.get(key);
      const datesInLine = vStatus.match(/\b\d{2}\/\d{2}\/\d{2,4}\b/g) || [];
      if (datesInLine.length > 0) {
        for (const d of datesInLine) {
          if (!bucket.dates.includes(d)) bucket.dates.push(d);
        }
      } else if (/^(?:pendente|aguardando|n[ãa]o\s+realizada|em\s+falta|-|)$/i.test(vStatus)) {
        bucket.sawPending = true;
      } else if (vStatus) {
        if (!bucket.nonPendingNotes.some(n => n.toLowerCase() === vStatus.toLowerCase())) {
          bucket.nonPendingNotes.push(vStatus);
        }
      }
    }

    const orderedKeys = [
      ...canonicalOrder.filter(k => vaccineBuckets.has(k)),
      ...Array.from(vaccineBuckets.keys()).filter(k => !canonicalOrder.includes(k))
    ];

    const finalVacLines = ['# VACINAS:'];
    for (const k of orderedKeys) {
      const b = vaccineBuckets.get(k);
      if (b.dates.length > 0) {
        b.dates.sort((d1, d2) => parseExamDateToTimestamp(d1) - parseExamDateToTimestamp(d2));
        finalVacLines.push(`- ${b.label}: ${b.dates.join(', ')}`);
      } else if (b.nonPendingNotes.length > 0) {
        finalVacLines.push(`- ${b.label}: ${b.nonPendingNotes.join(', ')}`);
      } else {
        finalVacLines.push(`- ${b.label}: Pendente`);
      }
    }

    const rebuiltHeaderLines = [];
    for (let i = 0; i < lines.length; i++) {
      if (i === firstVacHeaderIdx) {
        rebuiltHeaderLines.push(finalVacLines.join('\n'));
      } else if (!indicesToRemove.has(i)) {
        rebuiltHeaderLines.push(lines[i]);
      }
    }
    return rebuiltHeaderLines.join('\n');
  }

  // Ordena cronologicamente e desduplica as linhas de "# SOROLOGIAS:" no Pré-Natal
  function normalizeAndSortPrenatalSorologias(headerText) {
    if (!headerText || !/^#\s*SOROLOGIAS\s*:/im.test(headerText)) return headerText;
    return headerText.replace(/(^#\s*SOROLOGIAS\s*:\s*\n)((?:\s*-[^\n]+\n?)+)/gim, (_, title, block) => {
      const rawLines = block.split('\n').map(l => l.trim()).filter(Boolean);
      const uniqueByNorm = [];
      const seenNorms = new Set();
      for (const l of rawLines) {
        const norm = l.toLowerCase().replace(/\s+/g, ' ');
        if (!seenNorms.has(norm)) {
          seenNorms.add(norm);
          uniqueByNorm.push(l);
        }
      }
      uniqueByNorm.sort((a, b) => parseExamDateToTimestamp(a) - parseExamDateToTimestamp(b));
      return `${title}${uniqueByNorm.join('\n')}\n`;
    });
  }

  // Extrai e padroniza deterministicamente Tabagismo (Ativo, Ex-tabagista, Tabagista passivo, Nega) e Alergias
  // a partir de linhas "#" desestruturadas, do SUBJETIVO, da transcrição literal do áudio e da evolução anterior
  function normalizeAndExtractSmokingAndAllergies(text, rawTranscript = '', previousConsultationText = '') {
    if (!text || !/SUBJETIVO\b/i.test(text)) return text;
    const subjSplit = text.match(/^([\s\S]*?)(\n\s*(?:\d+\.\s*)?SUBJETIVO\b[\s\S]*)$/i);
    if (!subjSplit) return text;

    let headerPart = subjSplit[1];
    const restPart = subjSplit[2];

    // 1. Converte linhas "#" desestruturadas de tabagismo (ex: "# Tabagista passiva\n- Esposo tabagista", "# Ex-tabagista", "# Nega tabagismo")
    // para o formato oficial "# Tabagista: <valor>" sem perder sub-linhas como "- Esposo tabagista"
    let extractedTabagismoFromHeader = '';
    headerPart = headerPart.replace(/^#\s*Tabagist([ao])\s+passiv([oa])\s*\n\s*-\s*([^\n]+)$/gim, (_, g1, g2, extra) => {
      const val = `Tabagista passiv${g2} (${extra.trim()})`;
      extractedTabagismoFromHeader = val;
      return `# Tabagista: ${val}`;
    });
    headerPart = headerPart.replace(/^#\s*Tabagist([ao])\s+passiv([oa])(?:\s*[:\-–]\s*([^\n]+))?\s*$/gim, (_, g1, g2, extra) => {
      const val = extra ? `Tabagista passiv${g2} (${extra.trim()})` : `Tabagista passiv${g2}`;
      extractedTabagismoFromHeader = val;
      return `# Tabagista: ${val}`;
    });
    // Se a IA escreveu "# Tabagista: Ex-tabagista..." ou "# Tabagismo: Ex-tabagista...", converte para "# Ex-tabagista..." (nunca ao lado de Tabagista/Tabagismo!)
    headerPart = headerPart.replace(/^#\s*Tabagis(?:ta|to|mo)\s*:\s*(Ex-?tabagista[^\n]*)$/gim, (_, val) => {
      const cleanedVal = val.replace(/^Ex-?tabagista\s*:\s*/i, 'Ex-tabagista ').trim();
      extractedTabagismoFromHeader = cleanedVal;
      return `# ${cleanedVal}`;
    });
    headerPart = headerPart.replace(/^#\s*(Ex-?tabagista[^\n]*)$/gim, (_, val) => {
      const cleanedVal = val.replace(/^Ex-?tabagista\s*:\s*/i, 'Ex-tabagista ').trim();
      extractedTabagismoFromHeader = cleanedVal;
      return `# ${cleanedVal}`;
    });
    headerPart = headerPart.replace(/^#\s*Tabagismo\s*:\s*(.+)$/gim, (_, val) => {
      const v = val.trim();
      if (/^ex-?tabagista/i.test(v)) return `# ${v.replace(/^ex-?tabagista/i, 'Ex-tabagista')}`;
      return `# Tabagista: ${v}`;
    });
    headerPart = headerPart.replace(/^#\s*Nega\s+tabagismo(?:\s*(?:\/|e)\s*etilismo)?\s*$/gim, (full) => {
      extractedTabagismoFromHeader = 'Nega';
      if (/etilismo/i.test(full) && !/#\s*(?:Nega\s+etilismo|Etilismo)/i.test(headerPart)) {
        return `# Nega etilismo\n# Tabagista: Nega`;
      }
      return `# Tabagista: Nega`;
    });

    // Se já existe "# Ex-tabagista", remove QUALQUER outra linha "# Tabagista:" / "# Tabagismo:" e desduplica "# Ex-tabagista" repetido!
    if (/^#\s*Ex-?tabagista\b/im.test(headerPart)) {
      headerPart = headerPart.replace(/^#\s*Tabagis(?:ta|to|mo)\s*:.*\n?/gim, '');
      let keptEx = false;
      headerPart = headerPart.replace(/^#\s*Ex-?tabagista[^\n]*\n?/gim, (full) => {
        if (!keptEx) {
          keptEx = true;
          return full;
        }
        return '';
      });
    }

    // Se havia tanto uma linha "# Tabagista:" vazia quanto uma preenchida, remove duplicadas
    const tabMatches = headerPart.match(/^#\s*Tabagis(?:ta|to|mo)\s*:.*$/gim) || [];
    if (tabMatches.length > 1) {
      let keptFilled = false;
      headerPart = headerPart.replace(/^#\s*Tabagis(?:ta|to|mo)\s*:\s*(.*)\n?/gim, (full, val) => {
        if (val && val.trim()) {
          if (!keptFilled) {
            keptFilled = true;
            return full;
          }
          return '';
        }
        return '';
      });
    }

    // Se "# Tabagista: Tabagista passiva" tem logo abaixo "- Esposo tabagista", incorpora ou preserva
    headerPart = headerPart.replace(/^(#\s*Tabagist[ao]\s*:\s*Tabagist[ao]\s+passiv[oa])\s*\n\s*-\s*([^\n]+)$/gim, '$1 ($2)');

    // 2. Converte linhas "#" desestruturadas de alergias (ex: "# Nega alergias", "# Sem alergias medicamentosas")
    headerPart = headerPart.replace(/^#\s*(?:Nega\s+alergias?(?:\s+medicamentosas)?|Sem\s+alergias?(?:\s+conhecidas)?)\s*$/gim, '# Alergias: Nega');
    const alergMatches = headerPart.match(/^#\s*Alergias?\s*:.*$/gim) || [];
    if (alergMatches.length > 1) {
      let keptFilled = false;
      headerPart = headerPart.replace(/^#\s*Alergias?\s*:\s*(.*)\n?/gim, (full, val) => {
        if (val && val.trim()) {
          if (!keptFilled) {
            keptFilled = true;
            return full;
          }
          return '';
        }
        return '';
      });
    }

    // 3. Inspeção determinística do SUBJETIVO + Transcrição Literal + Evolução Anterior para preencher ou corrigir Tabagismo (ex: Ex-tabagista!) e Alergias
    const combinedEvidence = `${restPart}\n${rawTranscript || ''}\n${previousConsultationText || ''}`;

    const exSmokerMatch = combinedEvidence.match(/\b(?:ex-?tabagista|ex-?fumante|parou\s+de\s+fumar(?:\s+h[áa]\s+[^.,;\n)]+)?|cessou\s+(?:o\s+)?tabagismo(?:\s+h[áa]\s+[^.,;\n)]+)?|abst[êe]mi[oa]\s+do\s+tabaco(?:\s+h[áa]\s+[^.,;\n)]+)?|fumou\s+por\s+[^.,;\n]+\s+e\s+parou(?:\s+h[áa]\s+[^.,;\n)]+)?)\b/i);
    const passiveSmokerMatch = combinedEvidence.match(/\b(?:tabagist[ao]\s+passiv[oa]|fumante\s+passiv[oa]|espos[oa]\s+tabagista|esposo\s+fuma|marido\s+fuma)\b/i);
    const deniesSmokingMatch = combinedEvidence.match(/\b(?:nega\s+tabagismo|n[ãa]o\s+fuma|nunca\s+fumou|sem\s+tabagismo|tabagist[ao]\s*:\s*nega)\b/i);
    const activeSmokerMatch = combinedEvidence.match(/\b(?:tabagista\s+ativ[oa]|fuma\s+(?:cerca\s+de\s+)?\d+\s*(?:cigarros|ma[çc]os|carteiras)|h[áa]bito\s+de\s+fumar|tabagista\s+h[áa]\s+\d+)\b/i);

    const currentTabMatch = headerPart.match(/^#\s*Tabagist[ao]\s*:\s*(.*)$/im);
    const currentTabVal = currentTabMatch ? currentTabMatch[1].trim() : '';

    // Se o paciente é EX-TABAGISTA (parou de fumar), usa linha própria "# Ex-tabagista..." e NUNCA coloca dentro de "# Tabagista:" / "# Tabagismo:"!
    const hasExTabagistaHeader = /^#\s*Ex-?tabagista\b/im.test(headerPart);
    if (exSmokerMatch && !hasExTabagistaHeader && (!currentTabVal || /^(?:sim|ativ[oa]|tabagista|nega)$/i.test(currentTabVal))) {
      const rawEx = exSmokerMatch[0].trim();
      const formattedEx = /^ex-?tabagista/i.test(rawEx)
        ? rawEx.replace(/^ex-?tabagista/i, 'Ex-tabagista')
        : `Ex-tabagista (${rawEx})`;
      if (currentTabMatch) {
        headerPart = headerPart.replace(/^#\s*Tabagis(?:ta|to|mo)\s*:\s*.*$/im, `# ${formattedEx}`);
      } else {
        headerPart = `${headerPart.trimEnd()}\n# ${formattedEx}\n`;
      }
      headerPart = headerPart.replace(/^#\s*Tabagis(?:ta|to|mo)\s*:.*\n?/gim, '');
    } else if (!currentTabVal && !hasExTabagistaHeader) {
      let inferredTab = '';
      if (extractedTabagismoFromHeader) {
        inferredTab = extractedTabagismoFromHeader;
      } else if (passiveSmokerMatch) {
        inferredTab = 'Tabagista passiva';
      } else if (activeSmokerMatch && !deniesSmokingMatch) {
        inferredTab = 'Sim';
      } else if (deniesSmokingMatch) {
        inferredTab = 'Nega';
      }
      if (inferredTab) {
        if (currentTabMatch) {
          headerPart = headerPart.replace(/^#\s*Tabagist[ao]\s*:\s*$/im, `# Tabagista: ${inferredTab}`);
        } else {
          headerPart = `${headerPart.trimEnd()}\n# Tabagista: ${inferredTab}\n`;
        }
      }
    }

    // 4. Verifica se "# Alergias:" está em branco e preenche se constar no Subjetivo, Áudio ou Evolução Anterior
    const currentAlergMatch = headerPart.match(/^#\s*Alergias?\s*:\s*(.*)$/im);
    const currentAlergVal = currentAlergMatch ? currentAlergMatch[1].trim() : '';
    if (!currentAlergVal) {
      const posAlergMatch = combinedEvidence.match(/\b(?:alergia\s+(?:medicamentosa\s+)?a|al[ée]rgic[oa]\s+a)\s+([A-Za-zÀ-ÿ0-9\s,/-]{3,45}?)(?:\.|;|\n|,?\s+nega\b|$)/i);
      const deniesAlergMatch = combinedEvidence.match(/\b(?:nega\s+alergia[s]?(?:\s+medicamentosas|\s+conhecidas)?|sem\s+alergia[s]?(?:\s+conhecidas)?|n[ãa]o\s+tem\s+alergia[s]?|alergias?\s*:\s*nega)\b/i);
      let inferredAlerg = '';
      if (posAlergMatch && !/^(?:nega|nenhuma|n[ãa]o)\b/i.test(posAlergMatch[1].trim())) {
        inferredAlerg = posAlergMatch[1].trim();
      } else if (deniesAlergMatch) {
        inferredAlerg = 'Nega';
      }
      if (inferredAlerg) {
        if (currentAlergMatch) {
          headerPart = headerPart.replace(/^#\s*Alergias?\s*:\s*$/im, `# Alergias: ${inferredAlerg}`);
        } else {
          headerPart = `${headerPart.trimEnd()}\n# Alergias: ${inferredAlerg}\n`;
        }
      }
    }

    return `${headerPart}${restPart}`;
  }

  // Garante deterministicamente via código que NENHUMA condição de saúde anterior ("#"), NENHUMA sub-linha ("- "),
  // NENHUMA informação de Ecografia na IG, NENHUM exame anterior e NENHUMA formatação de Vacinas/Sorologias/Paridade sejam perdidos!
  function enforcePreviousHeaderAndExams(evolutionText, previousConsultationText, templateId, soapSubtypeHeader, patientAge = '', patientSex = '', rawTranscript = '', vdVisitDate = '', quickNotes = '', zScoreSummary = '') {
    let text = String(evolutionText || '');
    if (!text || /Áudio sem conteúdo de consulta médica/i.test(text)) return text;

    // 0. Detecta se o médico declarou "registro posterior de atendimento" (no áudio ou nas Anotações Rápidas)
    // para garantir que NUNCA seja ignorado nem sobrescrito em nenhum dos 8 modelos!
    const combinedPosteriorSource = `${rawTranscript || ''}\n${quickNotes || ''}`;
    const isPosteriorRecord = /\b(?:registro\s+posterior(?:\s+(?:de|do)\s+atendimento)?|evolu[çc][ãa]o\s+posterior|registro\s+(?:tardio|retroativo)|atendimento\s+(?:foi\s+)?(?:realizado\s+)?(?:ontem|anteriormente|no\s+dia\s+\d{1,2}\/\d{1,2}))\b/i.test(combinedPosteriorSource);
    const posteriorDateMatch = combinedPosteriorSource.match(/(?:registro\s+posterior(?:\s+(?:de|do)\s+atendimento)?|evolu[çc][ãa]o\s+posterior|registro\s+(?:tardio|retroativo)|atendimento\s+(?:foi\s+)?(?:realizado\s+)?|consulta\s+(?:foi\s+)?(?:realizada\s+)?)\s*(?:d[eo]\s+dia|em|no\s+dia|de|do)?\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
    const posteriorDateStr = posteriorDateMatch ? posteriorDateMatch[1].trim() : '';

    const applyPosteriorHeaderIfNeeded = (txt) => {
      if (!isPosteriorRecord) return txt;
      const suffix = posteriorDateStr ? ` - REGISTRO POSTERIOR (${posteriorDateStr})` : ' - REGISTRO POSTERIOR';
      if (/^\s*##\s*([^\n#]+?)\s*##/i.test(txt)) {
        return txt.replace(/^\s*##\s*([^\n#]+?)\s*##/i, (full, inner) => {
          const cleanInner = inner.trim();
          if (/REGISTRO\s+POSTERIOR/i.test(cleanInner)) {
            if (posteriorDateStr && !cleanInner.includes(posteriorDateStr)) {
              return `## ${cleanInner} (${posteriorDateStr}) ##`;
            }
            return full;
          }
          return `## ${cleanInner}${suffix} ##`;
        });
      }
      return `## REGISTRO POSTERIOR DE ATENDIMENTO${posteriorDateStr ? ` (${posteriorDateStr})` : ''} ##\n\n${txt.trimStart()}`;
    };

    // 1. Garante o cabeçalho da modalidade na Consulta Geral (SOAP):
    // ## CONSULTA AGENDADA - 0800 ## | ## RETORNO MÉDICO ## | ## DEMANDA ESPONTÂNEA ## | Sem ##
    if (templateId === 'geral') {
      if (soapSubtypeHeader) {
        if (/^\s*##\s*[^\n#]+##\s*\n*/i.test(text)) {
          text = text.replace(/^\s*##\s*[^\n#]+##\s*\n*/i, soapSubtypeHeader + '\n\n');
        } else {
          text = `${soapSubtypeHeader}\n\n${text.trimStart()}`;
        }
      } else if (soapSubtypeHeader === '') {
        // Se escolheu "Sem título ##", remove qualquer cabeçalho ## no topo
        text = text.replace(/^\s*##\s*(?:DEMANDA ESPONTÂNEA|CONSULTA AGENDADA[^\n#]*|RETORNO MÉDICO|ATENDIMENTO SOAP)\s*##\s*\n*/i, '');
      }
    }

    // 1.05 Se for VISITA DOMICILIAR (VD):
    // - Nunca assume a data da transcrição como data da VD a menos que `vdVisitDate` tenha sido preenchida ou falada no áudio/notas!
    // - Limpa "(Vínculo: )" vazio no cabeçalho da VD.
    if (templateId === 'visita_domiciliar' || /##\s*VISITA DOMICILIAR/i.test(text)) {
      if (vdVisitDate) {
        const vdHeaderWithDate = `## VISITA DOMICILIAR - DATA: ${vdVisitDate} ##`;
        if (/^\s*##\s*VISITA DOMICILIAR[^\n#]*##/im.test(text)) {
          text = text.replace(/^\s*##\s*VISITA DOMICILIAR[^\n#]*##/im, vdHeaderWithDate);
        } else {
          text = `${vdHeaderWithDate}\n\n${text.trimStart()}`;
        }
      } else {
        // Verifica se a IA inventou a data de hoje no título sem ter sido informada
        const headerDateMatch = text.match(/^\s*##\s*VISITA DOMICILIAR\s*-\s*DATA:\s*(\d{2}\/\d{2}\/\d{2,4}|\[[^\]]*\]|)\s*##/im);
        if (headerDateMatch) {
          const citedDate = (headerDateMatch[1] || '').trim();
          const combinedInputSource = `${rawTranscript || ''}\n${quickNotes || ''}`;
          const wasDateExplicitlyMentioned = citedDate
            && !citedDate.startsWith('[')
            && combinedInputSource.includes(citedDate);
          if (!wasDateExplicitlyMentioned) {
            text = text.replace(/^\s*##\s*VISITA DOMICILIAR[^\n#]*##/im, '## VISITA DOMICILIAR - REGISTRO POSTERIOR ##');
          }
        } else if (!/^\s*##\s*VISITA DOMICILIAR/im.test(text)) {
          text = `## VISITA DOMICILIAR - REGISTRO POSTERIOR ##\n\n${text.trimStart()}`;
        }
      }
      // Remove "(Vínculo: )" vazio ou "(Vínculo: não informado)"
      text = text.replace(/\s*\(\s*V[íi]nculo\s*:\s*(?:n[ãa]o\s+informado|n[ãa]o\s+especificado|-|)\s*\)/gi, '');

      // Remove do cabeçalho "#" as linhas "# Equipe presente na VD:" e "# Familiar / Cuidador(a) presente na visita:"
      // e, se tiverem conteúdo preenchido, move para o início do SUBJETIVO!
      const vdHeaderPresenceNotes = [];
      text = text.replace(/^#\s*(?:Equipe\s+presente\s+na\s+VD|Familiar\s*\/\s*Cuidador(?:\(a\))?\s+presente\s+na\s+visita)\s*:\s*([^\n]*)\n?/gim, (_, val) => {
        const cleaned = (val || '')
          .replace(/Enfermeir[oa](?:\(a\))?\s*:\s*(?=\||$)/gi, '')
          .replace(/ACS\s*:\s*$/gi, '')
          .replace(/^\s*\|\s*|\s*\|\s*$/g, '')
          .trim();
        if (cleaned && !/^(?:n[ãa]o\s+informad[oa]|-|nenhum)$/i.test(cleaned)) {
          vdHeaderPresenceNotes.push(cleaned);
        }
        return '';
      });
      if (vdHeaderPresenceNotes.length > 0 && /\n\s*SUBJETIVO\b/i.test(text)) {
        const presenceSentence = `Presença na visita: ${vdHeaderPresenceNotes.join(' | ')}.`;
        text = text.replace(/(\n\s*SUBJETIVO\s*\n+)/i, `$1${presenceSentence}\n`);
      }
    }

    // 1.1 Se for DISCUSSÃO COM TELESSAÚDE, garante que mantenha EXCLUSIVAMENTE a CONDUTA:
    if (templateId === 'telessaude' || /DISCUSSÃO COM TELESSAÚDE/i.test(text)) {
      const condutaMatch = text.match(/(?:10\.\s*)?CONDUTA\s*([\s\S]*)$/i);
      if (condutaMatch) {
        text = `## DISCUSSÃO COM TELESSAÚDE (TELECONSULTORIA) ##\n\nCONDUTA\n${condutaMatch[1].trim()}`;
      }
    }

    // 1.2 Se for INTERCONSULTA COM A ENFERMAGEM (VERSÃO RESUMIDA), remove qualquer cabeçalho "#", MUC, Alergias e subdivisões SOAP:
    if (templateId === 'interconsulta' && soapSubtypeHeader && /resumid/i.test(soapSubtypeHeader)) {
      text = text
        .replace(/^\s*##\s*INTERCONSULTA[^\n#]*##\s*\n*/im, '')
        .replace(/^\s*#[^\n]*\n?/gm, '')
        .replace(/^\s*(?:\d+\.\s*)?(?:SUBJETIVO|OBJETIVO(?:\s*\(EXAME FÍSICO\))?|EXAMES COMPLEMENTARES|AVALIAÇÃO|CONDUTA|PLANO)\s*:?\s*$/gim, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      return applyPosteriorHeaderIfNeeded(`## INTERCONSULTA COM A ENFERMAGEM ##\n\n${text}`);
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

    // 6. Se houver Evolução Anterior colada, garante que NENHUMA "#" anterior, NENHUMA patologia crônica/importante da AVALIAÇÃO anterior,
    // NENHUMA sub-linha "- " e NENHUM exame anterior (no Pré-Natal) tenham sido omitidos
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

      // 6b. Verifica todas as condições "#" e sub-linhas ("- " ou ">> ") do cabeçalho anterior + patologias crônicas/importantes promovidas da AVALIAÇÃO anterior
      const subjSplit = text.match(/^([\s\S]*?)(\n\s*(?:\d+\.\s*)?SUBJETIVO\b[\s\S]*)$/i);
      if (subjSplit) {
        let headerPart = subjSplit[1];
        const restPart = subjSplit[2];

        const normalizeCompare = (s) => s
          .toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '');

        // Agrupa o cabeçalho anterior + patologias crônicas promovidas da AVALIAÇÃO anterior em blocos
        const prevSourceLines = [
          ...(parsedPrev.headerLines || []),
          ...(parsedPrev.promotedFromAvaliacao || [])
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

        // Normaliza apenas prefixo "# Hipótese:" e remove queixas agudas pontuais do cabeçalho "#" (preservando demais descrições clínicas!)
        headerPart = headerPart
          .replace(/^#\s*Hip[óo]tese\s*:\s*/gim, '# ')
          .replace(/^#\s*(?:IVAS|Infec[çc][ãa]o\s+de\s+vias\s+a[ée]reas\s+superiores|Nasofaringite\s+aguda|Resfriado\s+comum|S[íi]ndrome\s+gripal|Gripe|Amigdalite\s+aguda|Faringoamigdalite|Faringite\s+aguda|Sinusite\s+aguda|Rinossinusite\s+aguda|Otite\s+m[ée]dia\s+aguda|Otite\s+externa\s+aguda|Gastroenterite\s+aguda|GECA|Diarreia\s+aguda|Viroses?|Dengue|Cistite\s+aguda|Infec[çc][ãa]o\s+do\s+trato\s+urin[áa]rio|ITU\s+baixa|ITU\s+aguda|Lombalgia\s+aguda|Cervicalgia\s+aguda|Cefaleia\s+aguda|SOF\s+positivo|Puericultura\s+de\s+rotina|Consulta\s+de\s+rotina|Check-?up|Renova[çc][ãa]o\s+de\s+receita)[^\n]*\n?/gim, '');

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
                  } else if (/^#\s*MUC:/im.test(headerPart)) {
                    headerPart = headerPart.replace(/^(#\s*MUC:)/im, `${block.main}\n${missingSubs.join('\n')}\n$1`);
                  } else {
                    headerPart = `${headerPart.trimEnd()}\n${block.main}\n${missingSubs.join('\n')}\n`;
                  }
                }
              }
            }
            continue;
          }

          // É uma condição clínica/cirúrgica/hábito/diagnóstico crônico (ex.: "# Hipertensão arterial sistêmica", "# DM2", "# Hipotireoidismo", etc.)
          const mainNorm = normalizeCompare(block.main);
          const existingHeaderLines = headerPart.split('\n').map(l => l.trim()).filter(l => l.startsWith('#'));
          const alreadyEquivalentInHeader = existingHeaderLines.some(existingLine =>
            normalizeCompare(existingLine).includes(mainNorm) ||
            (window.areMedicalConditionsEquivalent && window.areMedicalConditionsEquivalent(existingLine, block.main))
          );

          if (mainNorm && !normalizeCompare(headerPart).includes(mainNorm) && !alreadyEquivalentInHeader) {
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

    // 6c. Consolidação determinística do cabeçalho "#" (mesmo quando não há evolução anterior ou após mesclar com a evolução anterior):
    // - Remove sub-linhas soltas de medicamentos com traço ("- Omeprazol 20mg (1-0-0)") abaixo de diagnósticos "#"
    // - Consolida e desduplica "# VACINAS:" (nunca mantendo "Pendente" se já houver data para a mesma vacina e unificando DT/ANTITETANICA, VSR/VVSR, COVID/COVID19)
    // - Ordena cronologicamente "# SOROLOGIAS:"
    // - Extrai e padroniza "# Tabagista:" (incluindo Ex-tabagista e Tabagista passiva) e "# Alergias:"
    const headerSubjSplit = text.match(/^([\s\S]*?)(\n\s*(?:\d+\.\s*)?SUBJETIVO\b[\s\S]*)$/i);
    if (headerSubjSplit) {
      let cleanHeader = headerSubjSplit[1];
      const restBody = headerSubjSplit[2];

      // Remove sub-linhas "- Medicamento Xmg (1-0-0)" que tenham vazado abaixo de patologias "#" (movendo para # MUC se necessário)
      const hLines = cleanHeader.split('\n');
      const filteredHLines = [];
      const rescuedMeds = [];
      let currentHSection = '';
      for (const hl of hLines) {
        const tr = hl.trim();
        if (tr.startsWith('#')) {
          currentHSection = tr.toUpperCase();
          filteredHLines.push(hl);
          continue;
        }
        if (tr.startsWith('-') && !/^#\s*(?:VACINAS|SOROLOGIAS|HIST[ÓO]RICO\s+DO\s+PARTO|TRIAGEM\s+NEONATAL)/i.test(currentHSection)) {
          const isLooseMedicationSubline = /^-\s*[A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,2}\s+\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|ui|ml|%)\b/i.test(tr)
            || /\b\([0-9]+\s*-\s*[0-9]+\s*-\s*[0-9]+\)/.test(tr);
          if (isLooseMedicationSubline) {
            rescuedMeds.push(tr.replace(/^-\s*/, '').trim());
            continue;
          }
        }
        filteredHLines.push(hl);
      }
      cleanHeader = filteredHLines.join('\n');
      if (rescuedMeds.length > 0 && /^#\s*MUC\s*:/im.test(cleanHeader)) {
        cleanHeader = cleanHeader.replace(/^(#\s*MUC\s*:\s*)(.*)$/im, (full, prefix, mucVal) => {
          let updatedMuc = mucVal.trim();
          for (const med of rescuedMeds) {
            const medFirstWord = med.split(/\s+/)[0].toLowerCase();
            if (medFirstWord && !updatedMuc.toLowerCase().includes(medFirstWord)) {
              updatedMuc = updatedMuc ? `${updatedMuc}, ${med}` : med;
            }
          }
          return `${prefix}${updatedMuc}`;
        });
      }

      if (templateId === 'prenatal' || /CONSULTA DE PRÉ-NATAL/i.test(text)) {
        cleanHeader = normalizeAndDeduplicatePrenatalVaccines(cleanHeader);
        cleanHeader = normalizeAndSortPrenatalSorologias(cleanHeader);
      } else if (templateId === 'puericultura' || /CONSULTA DE PUERICULTURA/i.test(text)) {
        // Na Puericultura, NUNCA roda o normalizador de vacinas do Pré-Natal (que criava "- atualizado: Pendente"!)
        cleanHeader = cleanHeader.replace(/^\s*-\s*atualizad[oa]s?\s*:\s*pendente\s*\n?/gim, '');
      }
      text = `${cleanHeader}${restBody}`;
    }

    // Na PUERICULTURA: garante deterministicamente a idade da criança no cabeçalho "## CONSULTA DE PUERICULTURA - ... ##"
    // e garante que Peso, Altura, PC, IMC e Z-Score preenchidos na calculadora SEMPRE apareçam no OBJETIVO!
    if ((templateId === 'puericultura' || /CONSULTA DE PUERICULTURA/i.test(text)) && zScoreSummary) {
      const ageLabelMatch = zScoreSummary.match(/^Idade da crian[çc]a:\s*([^\n(]+)/im);
      const icMatch = zScoreSummary.match(/Idade Corrigida OMS[^:]*:\s*([^\n]+)/im);
      const headerAgeText = ageLabelMatch ? ageLabelMatch[1].trim() : (patientAge ? String(patientAge).trim() : '');
      if (headerAgeText && /^\s*##\s*CONSULTA DE PUERICULTURA(?:\s*-\s*X\s*MESES)?\s*##/im.test(text)) {
        const icSuffix = icMatch ? ` (IC: ${icMatch[1].trim()})` : '';
        text = text.replace(
          /^\s*##\s*CONSULTA DE PUERICULTURA(?:\s*-\s*X\s*MESES)?\s*##/im,
          `## CONSULTA DE PUERICULTURA - ${headerAgeText.toUpperCase()}${icSuffix.toUpperCase()} ##`
        );
      }
      const anthroLines = zScoreSummary
        .split('\n')
        .map(l => l.trim())
        .filter(l => /^(?:Idade Cronol[óo]gica|Peso|Altura\/Comprimento|PC|IMC)\s*:/i.test(l));
      if (anthroLines.length > 0 && /\nOBJETIVO\b/i.test(text)) {
        const objMatch = text.match(/(\nOBJETIVO\s*\n[^\n]*\n)([\s\S]*?)(\n\s*(?:EXAMES|AVALIAÇÃO|CONDUTA)\b|$)/i);
        if (objMatch) {
          const existingObjBody = objMatch[2] || '';
          const missingAnthro = anthroLines.filter(al => {
            const prefix = al.split(':')[0].trim().replace(/\/.*/, '');
            return !(new RegExp(`\\b${prefix}\\s*:`, 'i').test(existingObjBody));
          });
          if (missingAnthro.length > 0) {
            text = text.replace(objMatch[0], `${objMatch[1]}${missingAnthro.join('\n')}\n${existingObjBody}${objMatch[3]}`);
          }
        }
      }
    }

    text = normalizeAndExtractSmokingAndAllergies(text, rawTranscript, previousConsultationText);

    // 7. Separa rigorosamente EXAMES COMPLEMENTARES (- LABS) de ULTRASSONOGRAFIA (- US):
    // - No PRÉ-NATAL: mantém cumulativamente os exames anteriores da evolução antiga + inclui os novos, desduplica mesma data e ordena por data crescente (DD/MM/AAAA).
    // - No SOAP GERAL e demais consultas: NUNCA copia os exames da evolução antiga (inclusive remove caso a IA tenha copiado algum exame antigo!).
    const isPrenatal = (templateId === 'prenatal') || /CONSULTA DE PRÉ-NATAL/i.test(text);
    const hasPrevLabs = isPrenatal && parsedPrev && parsedPrev.labLines && parsedPrev.labLines.length > 0;
    const hasPrevUsg = isPrenatal && parsedPrev && parsedPrev.usgLines && parsedPrev.usgLines.length > 0;

    // Ancora os blocos de exames antes de "7. RASTREAMENTOS" (nos modelos LGBTQIAP+) ou antes de "AVALIAÇÃO" (nos outros 5 modelos)
    const afterExamsBoundaryRegex = /\n(\s*(?:7\.\s*RASTREAMENTOS|(?:\d+\.\s*)?AVALIAÇÃO)\b)/i;
    if (afterExamsBoundaryRegex.test(text)) {
      const boundaryMatch = text.match(afterExamsBoundaryRegex);
      let preEval = text.slice(0, boundaryMatch.index);
      let evalAndAfter = text.slice(boundaryMatch.index);

      // Extrai blocos EXAMES COMPLEMENTARES e/ou ULTRASSONOGRAFIA(S) atuais no final de preEval
      const examSectionRegex = /\n*(?:EXAMES\s+COMPLEMENTARES|ULTRASSONOGRAFIAS?(?:\s*\/\s*IMAGEM)?|EXAMES\s+DE\s+IMAGEM|EXAMES\s+LABORATORIAIS)\s*\n([\s\S]*?)$/i;
      const examMatch = preEval.match(examSectionRegex);

      if (examMatch || hasPrevLabs || hasPrevUsg) {
        const bodyBeforeExams = examMatch ? preEval.slice(0, examMatch.index) : preEval;
        const rawExamArea = examMatch ? preEval.slice(examMatch.index) : '';

        const currentLabLines = [];
        const currentUsgLines = [];
        const standaloneSofs = [];
        let inUsgSubblock = false;

        for (const rawL of rawExamArea.split('\n')) {
          const t = rawL.trim();
          if (!t || t === '-' || /^-\s*(?:Sem novos exames|Nenhum exame|Não realizado)/i.test(t)) continue;
          // Filtra qualquer subtítulo espúrio ou replicado ("ULTRASSONOGRAFIAS / IMAGEM", "ULTRASSONOGRAFIA", "- LABORATORIAIS:", "EXAMES DE IMAGEM")
          if (/^(?:-?\s*)?(?:ULTRASSONOGRAFIAS?(?:\s*\/\s*IMAGEM)?|ECOGRAFIAS?|EXAMES\s+DE\s+IMAGEM|IMAGEM)\s*:?\s*$/i.test(t)) {
            inUsgSubblock = true;
            continue;
          }
          if (/^(?:-?\s*)?(?:EXAMES\s+COMPLEMENTARES|EXAMES\s+LABORATORIAIS|LABORATORIAIS)\s*:?\s*$/i.test(t)) {
            inUsgSubblock = false;
            continue;
          }
          const sofLineMatch = t.match(/^-\s*(?:(?:Pesquisa\s+de\s+)?Sangue\s+Oculto(?:\s+nas\s+Fezes)?|PSOF|SOF)(?:\s*\([^)]*\))?\s*:?\s*(Negativ[oa]|Positiv[oa]|Ausente|Presente|N[ãa]o\s+reagente|Reagente)\b/i);
          if (sofLineMatch) {
            const isPos = /positiv|presente|^(?!n[ãa]o\s+)reagente/i.test(sofLineMatch[1]);
            standaloneSofs.push(isPos ? 'SOF positivo' : 'SOF negativo');
            continue;
          }
          const isUsgLine = /^-\s*(?:US\b|USG\b|ECO\b|ECOGRAFIA|ULTRASSOM|ULTRASSONOGRAFIA)/i.test(t)
            || /\b(?:DMSG|CCN|saco gestacional|feto único|placenta|líquido amniótico|biometria fetal|peso fetal estimado|morfologia fetal)\b/i.test(t);
          const isLabLine = /^-\s*LABS\b/i.test(t);

          if (isLabLine) {
            currentLabLines.push(t);
          } else if (inUsgSubblock || isUsgLine) {
            currentUsgLines.push(t);
          } else {
            currentLabLines.push(t);
          }
        }

        if (standaloneSofs.length > 0) {
          const sofJoined = standaloneSofs.join(' | ');
          const targetLabIdx = currentLabLines.findIndex(l => l.startsWith('- LABS'));
          if (targetLabIdx >= 0) {
            if (!/\bSOF\s+(?:negativo|positivo)/i.test(currentLabLines[targetLabIdx])) {
              currentLabLines[targetLabIdx] = `${currentLabLines[targetLabIdx]} | ${sofJoined}`;
            }
          } else {
            currentLabLines.unshift(`- LABS: ${sofJoined}`);
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

        // Mescla e desduplica exames laboratoriais por data (garantindo que a mesma data NUNCA fique duplicada!)
        const rawCandidateLabs = [];
        if (hasPrevLabs) {
          for (const pl of parsedPrev.labLines) {
            rawCandidateLabs.push(pl.trim());
          }
        }
        for (const cl of currentLabLines) {
          const dateStr = extractExamDate(cl);
          if (!isPrenatal && (prevOldLabKeys.includes(normLineKey(cl)) || (dateStr && prevOldLabDates.includes(dateStr)))) {
            continue; // Bloqueia cópia de exame antigo no SOAP!
          }
          rawCandidateLabs.push(cl.trim());
        }

        const cleanedFinalLabs = [];
        for (const rawLab of rawCandidateLabs) {
          const formattedLab = formatCleanCompactLabLine(rawLab, patientAge, patientSex);
          if (!formattedLab) continue;
          const dateStr = extractExamDate(formattedLab);
          const normCur = normLineKey(formattedLab);
          if (cleanedFinalLabs.some(ex => normLineKey(ex) === normCur)) {
            continue;
          }
          if (dateStr && /^-\s*LABS\b/i.test(formattedLab)) {
            const sameDateIdx = cleanedFinalLabs.findIndex(ex => /^-\s*LABS\b/i.test(ex) && extractExamDate(ex) === dateStr);
            if (sameDateIdx >= 0) {
              // Se já existe um - LABS da mesma data, mantém a versão com mais marcadores ou mais completa sem duplicar a linha!
              const existingPipes = cleanedFinalLabs[sameDateIdx].split('|').length;
              const newPipes = formattedLab.split('|').length;
              if (newPipes > existingPipes || (newPipes === existingPipes && formattedLab.length > cleanedFinalLabs[sameDateIdx].length)) {
                cleanedFinalLabs[sameDateIdx] = formattedLab;
              }
              continue;
            }
          }
          cleanedFinalLabs.push(formattedLab);
        }

        // Ordena - LABS em ordem cronológica crescente (do mais antigo para o mais recente)
        cleanedFinalLabs.sort((a, b) => parseExamDateToTimestamp(a) - parseExamDateToTimestamp(b));

        // Mescla, desduplica e ordena ultrassonografias em ordem cronológica crescente
        const finalUsgs = [];
        const addOrMergeUsgLine = (uLine) => {
          const cleanU = uLine.trim().replace(/^-\s*(\d{2}\/\d{2}\/\d{2,4})\s*:/, '- US ($1):');
          if (!cleanU) return;
          const dateStr = extractExamDate(cleanU);
          const normU = normLineKey(cleanU);
          if (finalUsgs.some(ex => normLineKey(ex) === normU)) return;
          if (dateStr) {
            const sameDateIdx = finalUsgs.findIndex(ex => extractExamDate(ex) === dateStr);
            if (sameDateIdx >= 0) {
              if (cleanU.length > finalUsgs[sameDateIdx].length) {
                finalUsgs[sameDateIdx] = cleanU;
              }
              return;
            }
          }
          finalUsgs.push(cleanU);
        };

        if (hasPrevUsg) {
          for (const pu of parsedPrev.usgLines) {
            addOrMergeUsgLine(pu);
          }
        }
        for (const cu of currentUsgLines) {
          const dateStr = extractExamDate(cu);
          if (!isPrenatal && (prevOldUsgKeys.includes(normLineKey(cu)) || (dateStr && prevOldUsgDates.includes(dateStr)))) {
            continue; // Bloqueia cópia de USG antigo no SOAP!
          }
          addOrMergeUsgLine(cu);
        }

        finalUsgs.sort((a, b) => parseExamDateToTimestamp(a) - parseExamDateToTimestamp(b));

        // Sincroniza o valor exato da TFG CKD-EPI calculada em EXAMES COMPLEMENTARES com a AVALIAÇÃO (evita "TFG 20" nos exames e "TFG 19" na Avaliação!)
        for (const labLine of cleanedFinalLabs) {
          const tfgMatch = labLine.match(/\bTFG\s+(\d+)\s*\(CKD-EPI\s+(G[1-5][ab]?)\)/i);
          if (tfgMatch) {
            const exactEgfr = parseInt(tfgMatch[1], 10);
            evalAndAfter = evalAndAfter.replace(/\b(TFG\s*(?:de\s*|:\s*|~\s*|aproximada\s+de\s*)?)(\d+)\b/gi, (full, prefix, numStr) => {
              const citedNum = parseInt(numStr, 10);
              if (!isNaN(citedNum) && Math.abs(citedNum - exactEgfr) <= 5) {
                return `${prefix}${exactEgfr}`;
              }
              return full;
            });
          }
        }

        const rebuiltSections = [];
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

    text = applyPosteriorHeaderIfNeeded(text);
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

    // 2. Evita frases em 3ª pessoa sobre o médico dentro do SUBJETIVO sem apagar informações clínicas reais
    subjContent = subjContent.replace(
      /\b(?:O\s+)?M[ée]dico\s+(?:refor[çc]ou|orientou|explicou|solicitou|prescreveu|enfatizou|reiterou|esclareceu)\s+/gi,
      ''
    );

    // 3. Limpa espaços e quebras repetidas
    subjContent = subjContent
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim();

    return beforeSubj + subjContent + '\n' + afterSubj;
  }

  function cleanAndExtractCidFromEvolution(evolutionText, existingCodes, templateId, previousConsultationText = '', soapSubtypeHeader = '', patientAge = '', patientSex = '', rawTranscript = '', vdVisitDate = '', quickNotes = '', zScoreSummary = '') {
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

    // 1.2 Garante padronização dos títulos de seções em formatos diversos/antigos para o padrão oficial UBS (SOAP)
    text = text
      .replace(/^(?:\d+[\.\-\)]\s*)?S\s*[:\-]\s*/gim, 'SUBJETIVO\n')
      .replace(/^(?:\d+[\.\-\)]\s*)?ANAMNESE\s*[:\-]?\s*$/gim, 'SUBJETIVO')
      .replace(/^(?:\d+[\.\-\)]\s*)?O\s*[:\-]\s*/gim, 'OBJETIVO\n')
      .replace(/^(?:\d+[\.\-\)]\s*)?EXAME\s+F[ÍI]SICO\s*[:\-]?\s*$/gim, 'OBJETIVO')
      .replace(/^(?:\d+[\.\-\)]\s*)?A\s*[:\-]\s*/gim, 'AVALIAÇÃO\n')
      .replace(/^(?:\d+[\.\-\)]\s*)?HIP[ÓO]TESE(?:S)?(?:\s+DIAGN[ÓO]STICA[S]?)?\s*[:\-]?\s*$/gim, 'AVALIAÇÃO')
      .replace(/^(?:\d+[\.\-\)]\s*)?(?:P|CD)\s*[:\-]\s*/gim, 'CONDUTA\n')
      .replace(/^(?:\d+[\.\-\)]\s*)?PLANO\s+TERAP[ÊE]UTICO\s*[:\-]?\s*$/gim, 'CONDUTA');

    // 1.3 Se for Consulta Geral (SOAP) e faltar os campos # Alergias: ou # Tabagista: no cabeçalho, garante sua estrutura
    if (templateId === 'geral' && /SUBJETIVO\b/i.test(text)) {
      if (!/#\s*(?:Tabagist[ao]|Ex-?tabagista|Nega\s+tabagismo)\b/i.test(text)) {
        text = text.replace(/(\n\s*(?:\d+[\.\-\)]\s*)?SUBJETIVO\b)/i, '\n# Tabagista:\n$1');
      }
      if (!/#\s*(?:Alergias?|Nega\s+alergias)\b/i.test(text)) {
        text = text.replace(/(\n\s*(?:\d+[\.\-\)]\s*)?SUBJETIVO\b)/i, '\n# Alergias:\n$1');
      }
    }

    // 2. Remove frases metalinguísticas inaceitáveis no Objetivo e padroniza formato fixo + bloqueia sistemas não avaliados
    text = text.replace(/OBJETIVO\s*\n\s*(?:Exame\s+f[íi]sico\s+n[ãa]o\s+detalhado[^\n]*|Exame\s+f[íi]sico\s+n[ãa]o\s+mencionado[^\n]*|N[ãa]o\s+detalhado\s+na\s+transcri[çc][ãa]o[^\n]*)\n*/gi, 'OBJETIVO\nBEG, LOC, MUC\n\n');

    // 2.1 Normalização determinística do bloco OBJETIVO: mantém siglas padronizadas fixas e remove sistemas inventados que não constam no áudio/notas
    const objSectionMatch = text.match(/(\nOBJETIVO\s*\n)([\s\S]*?)(\n\s*(?:EXAMES COMPLEMENTARES|ULTRASSONOGRAFIA|AVALIAÇÃO|CONDUTA|PLANO)\b|$)/i);
    if (objSectionMatch) {
      const objHeader = objSectionMatch[1];
      let objBody = objSectionMatch[2] || '';
      const objTail = objSectionMatch[3] || '';
      const isPueri = templateId === 'puericultura' || /CONSULTA DE PUERICULTURA/i.test(text);
      const isPrenatal = templateId === 'prenatal' || /CONSULTA DE PRÉ-NATAL/i.test(text);
      const isLgbt = templateId === 'lgbt_primeira' || templateId === 'lgbt_seguimento';
      const todayExamEvidence = `${rawTranscript || ''}\n${quickNotes || ''}\n${zScoreSummary || ''}`;
      const hasEvidenceToAudit = todayExamEvidence.trim().length >= 30;

      const normalizedObjLines = objBody.split('\n').map(l => {
        let ln = l.trim().replace(/^[-•*]\s*/, '');
        if (!ln) return '';
        // Padroniza ectoscopia normal expandida por extenso para "BEG, LOC, MUC", preservando SEMPRE qualquer alteração (REG, MEG, hipocorado, desidratado, desorientado, prostrado, etc.)
        const hasAbnormalEctoscopy = /\b(?:REG|MEG|regular|mau\s+estado|hipocorad|descorad|p[áa]lid|desidratad|desorientad|confus|sonolent|prostrad|acamad|restrit[oa]\s+ao\s+leito|ict[ée]ric|cian[óo]tic|febril|dispneic|taquipneic|choros|ansios|agitad|irritad|emagrecid|desnutrid|caqu[ée]tic|torporos|let[áa]rgic|hipoativ|ast[êe]nic|sudoreic|gemente|secas|ressecad|f[áa]cies\s+de\s+dor)\b/i.test(ln);
        if (!isPueri && !isLgbt && !hasAbnormalEctoscopy && /^(?:Bom\s+estado\s+geral|BEG\s*,\s*LOC\s*,\s*(?:corad|hidratad|mucosas))/i.test(ln)) {
          ln = 'BEG, LOC, MUC';
        }
        // Padroniza rótulos por extenso para as siglas fixas
        ln = ln
          .replace(/^Ausculta\s+pulmonar\s*:\s*/i, 'AP: ')
          .replace(/^Aparelho\s+respirat[óo]rio\s*:\s*/i, 'AP: ')
          .replace(/^Ausculta\s+card[íi]aca\s*:\s*/i, 'AC: ')
          .replace(/^Aparelho\s+cardiovascular\s*:\s*/i, 'AC: ')
          .replace(/^Abd[ôo]men?\s*:\s*/i, 'ABD: ')
          .replace(/^Membros\s+inferiores\s*:\s*/i, 'MMII: ')
          .replace(/^Sistema\s+nervoso\s*:\s*/i, 'SN: ')
          .replace(/^Press[ãa]o\s+arterial\s*:\s*/i, 'PA: ')
          .replace(/^Glicemia\s+capilar\s*:\s*/i, 'HGT: ')
          .replace(/^Frequ[êe]ncia\s+card[íi]aca\s*:\s*/i, 'FC: ')
          .replace(/^Frequ[êe]ncia\s+respirat[óo]ria\s*:\s*/i, 'FR: ')
          .replace(/^Temperatura(?:\s+axilar)?\s*:\s*/i, 'Tax: ')
          .replace(/^Satura[çc][ãa]o(?:\s+de\s+O2)?\s*:\s*/i, 'SpO2: ');
        return ln;
      }).filter(ln => {
        if (!ln) return false;
        if (!hasEvidenceToAudit) return true;
        // Remove sistemas extras que a IA costuma inventar como "normais" quando NÃO foram citados no áudio nem nas notas
        if (/^SN\s*:/i.test(ln) && !/\b(?:men[íi]ng|rigidez|nuca|neurol[óo]g|reflexo|pupila|for[çc]a\s+muscular|marcha|glasgow|sensibilidade|parestesia|kernig|brudzinski)\b/i.test(todayExamEvidence)) {
          return false;
        }
        if (/^Pele\s*:/i.test(ln) && !/\b(?:pele|exantema|mancha|les[ãa]o|les[õo]es|pet[ée]quia|eritema|prurido|descama|ferida|cicatriz|n[óo]dulo|p[áa]pula|ves[íi]cula|bolha|urtic[áa]ria)\b/i.test(todayExamEvidence)) {
          return false;
        }
        // Em SOAP Geral / VD / Interconsulta (onde o modelo base tem apenas BEG, LOC, MUC), não permite inventar AC/AP/ABD/MMII "normais" se não avaliados
        if (!isPueri && !isPrenatal && !isLgbt) {
          if (/^AC\s*:/i.test(ln) && !/\b(?:cora[çc][ãa]o|card[íi]ac|ausculta|sopro|ritmo|bulha|rcr|bnf|2t|ac\b|batimento)\b/i.test(todayExamEvidence)) return false;
          if (/^AP\s*:/i.test(ln) && !/\b(?:pulm[ãa]o|pulmonar|ausculta|respir|murm[úu]rio|sibilo|ronco|estertor|mv\+|mvud|sra|ap\b|tosse|falta\s+de\s+ar|dispneia|peito)\b/i.test(todayExamEvidence)) return false;
          if (/^ABD\s*:/i.test(ln) && !/\b(?:abd[ôo]m|barriga|palpa[çc][ãa]o|epig[áa]str|fossa\s+il[íi]aca|hipoc[ôo]ndrio|rha|visceromegal|blumberg|murphy|giordano|abd\b|deita|maca)\b/i.test(todayExamEvidence)) return false;
          if (/^MMII\s*:/i.test(ln) && !/\b(?:mmii|membro[s]?\s+inferior|perna|tornozelo|p[ée]s?|edema|incha[çc]o|panturrilha|pulso[s]?\s+pedios|homans|cacifo)\b/i.test(todayExamEvidence)) return false;
        }
        return true;
      });

      if (normalizedObjLines.length > 0) {
        text = text.replace(objSectionMatch[0], `${objHeader}${normalizedObjLines.join('\n')}${objTail}`);
      }
    }

    // 3. Resgata qualquer Controle de HGT / Controle de PA domiciliar que tenha ido parar em OBJETIVO ou EXAMES COMPLEMENTARES
    // e move para o final do SUBJETIVO (antes do normalizador de exames para nunca ser alterado/descartado)
    const isHomeHgtLineRe = /^(?:[-•*]\s*)?(?:Controle\s+(?:de\s+|domiciliar\s+de\s+)?(?:HGT|glic[êe]mico|de\s+glicemia(?:\s+capilar)?)|Perfil\s+glic[êe]mico|HGT\s+domiciliar|HGTs|Glicemias?\s+capilar(?:es)?\s+domiciliar(?:es)?|Dextro(?:s)?\s+domiciliar(?:es)?)\s*[:\-]\s*(.+)$/i;
    const isHomePaLineRe = /^(?:[-•*]\s*)?(?:Controle\s+(?:de\s+|domiciliar\s+de\s+)?(?:PA|press[ãa]o(?:\s+arterial)?|press[óo]rico)|MRPA|PA\s+domiciliar|Press[ãa]o(?:\s+arterial)?\s+domiciliar|PAs\s+domiciliar(?:es)?)\s*[:\-]\s*(.+)$/i;
    const isHomeSummaryLineRe = /(?:m[ée]dias?\s+domiciliar(?:es)?|aferi[çc][õo]es?\s+domiciliar(?:es)?|caderneta\s+de|em\s+domic[íi]lio).*\b(?:PA|press[ãa]o|HGT|glicemia|mmHg|mg\/dL)\b|\b(?:PA|press[ãa]o|HGT|glicemia)\b.*(?:m[ée]dias?\s+domiciliar(?:es)?|aferi[çc][õo]es?\s+domiciliar(?:es)?|em\s+domic[íi]lio)/i;

    const appendLineToSubjetivo = (evoText, lineToInsert) => {
      if (!lineToInsert || !/\n\s*(?:\d+\.\s*)?SUBJETIVO\b/i.test(evoText)) return evoText;
      const objBoundary = evoText.match(/(\n\s*(?:\d+\.\s*)?OBJETIVO\b)/i);
      if (objBoundary) {
        const beforeObj = evoText.slice(0, objBoundary.index).trimEnd();
        const fromObj = evoText.slice(objBoundary.index);
        return `${beforeObj}\n${lineToInsert.trim()}${fromObj}`;
      }
      return evoText;
    };

    const formatRescuedControlLine = (rawLine) => {
      const cleaned = rawLine.trim().replace(/^[-•*]\s*/, '');
      const hm = cleaned.match(isHomeHgtLineRe);
      if (hm) return `Controle de HGT: ${hm[1].trim()}`;
      const pm = cleaned.match(isHomePaLineRe);
      if (pm) return `Controle de PA: ${pm[1].trim()}`;
      return cleaned;
    };

    const rescuedFromObjOrExams = [];
    if (/\n\s*(?:\d+\.\s*)?SUBJETIVO\b/i.test(text)) {
      // 3a. Verifica no bloco OBJETIVO
      const objBlockMatch = text.match(/(\nOBJETIVO\s*\n)([\s\S]*?)(\n\s*(?:EXAMES COMPLEMENTARES|ULTRASSONOGRAFIA|AVALIAÇÃO|CONDUTA|PLANO)\b|$)/i);
      if (objBlockMatch) {
        const keptObj = [];
        for (const l of (objBlockMatch[2] || '').split('\n')) {
          const tr = l.trim();
          if (tr && (isHomeHgtLineRe.test(tr) || isHomePaLineRe.test(tr) || isHomeSummaryLineRe.test(tr))) {
            rescuedFromObjOrExams.push(formatRescuedControlLine(tr));
          } else {
            keptObj.push(l);
          }
        }
        if (rescuedFromObjOrExams.length > 0) {
          text = text.replace(objBlockMatch[0], `${objBlockMatch[1]}${keptObj.join('\n').trim()}${objBlockMatch[3]}`);
        }
      }

      // 3b. Verifica no bloco EXAMES COMPLEMENTARES (caso a IA tenha jogado Controle de HGT/PA lá)
      const examsBlockMatch = text.match(/(\nEXAMES\s+COMPLEMENTARES\s*\n)([\s\S]*?)(\n\s*(?:ULTRASSONOGRAFIA|AVALIAÇÃO|CONDUTA|PLANO)\b|$)/i);
      if (examsBlockMatch) {
        const keptExams = [];
        let movedAnyExamLine = false;
        for (const l of (examsBlockMatch[2] || '').split('\n')) {
          const tr = l.trim();
          if (tr && (isHomeHgtLineRe.test(tr) || isHomePaLineRe.test(tr))) {
            rescuedFromObjOrExams.push(formatRescuedControlLine(tr));
            movedAnyExamLine = true;
          } else {
            keptExams.push(l);
          }
        }
        if (movedAnyExamLine) {
          const remainingExams = keptExams.join('\n').trim();
          if (remainingExams) {
            text = text.replace(examsBlockMatch[0], `${examsBlockMatch[1]}${remainingExams}${examsBlockMatch[3]}`);
          } else {
            text = text.replace(examsBlockMatch[0], `${examsBlockMatch[3]}`);
          }
        }
      }

      for (const rescuedLine of rescuedFromObjOrExams) {
        if (!text.toLowerCase().includes(rescuedLine.toLowerCase())) {
          text = appendLineToSubjetivo(text, rescuedLine);
        }
      }
    }

    text = enforcePreviousHeaderAndExams(text, previousConsultationText, templateId, soapSubtypeHeader, patientAge, patientSex, rawTranscript, vdVisitDate, quickNotes, zScoreSummary);

    // 3.1 Garantia determinística de importação do Controle de HGT e Controle de PA descritos nas Anotações Rápidas
    if (quickNotes && quickNotes.trim() && /\n\s*(?:\d+\.\s*)?SUBJETIVO\b/i.test(text)) {
      const extractTypedHomeControls = (notesRaw) => {
        const noteLines = String(notesRaw || '').split(/\r?\n/);
        const hgtItems = [];
        const paItems = [];
        let activeMode = null; // 'hgt' | 'pa' | null
        let activeBuffer = [];

        const flushActive = () => {
          if (!activeMode || activeBuffer.length === 0) {
            activeMode = null;
            activeBuffer = [];
            return;
          }
          const joined = activeBuffer.map(s => s.trim()).filter(Boolean).join(' | ');
          if (joined) {
            if (activeMode === 'hgt') hgtItems.push(joined);
            else if (activeMode === 'pa') paItems.push(joined);
          }
          activeMode = null;
          activeBuffer = [];
        };

        const isUnrelatedNewHeader = (s) => /^(?:[-•*]\s*)?(?:LABS\b|EXAMES\b|US\b|USG\b|TC\b|RX\b|RM\b|ECG\b|ECO\b|OBJETIVO\b|AVALIA[ÇC][ÃA]O\b|CONDUTA\b|PLANO\b|AP\s*:|AC\s*:|ABD\s*:|MMII\s*:|FC\s*:|FR\s*:|SpO2\s*:|Tax\s*:|Peso\s*:|Altura\s*:|IMC\s*:|PC\s*:|AU\s*:|BCF\s*:|#|PA\s*:\s*\d{2,3}\s*[\/x×]\s*\d{2,3}\s*(?:mmhg)?\s*$)/i.test(s);
        const hgtHeaderRe = /^(?:[-•*]\s*)?(?:Controle\s+(?:de\s+|domiciliar\s+de\s+)?(?:HGT|glic[êe]mico|de\s+glicemia(?:\s+capilar)?)|Perfil\s+glic[êe]mico|HGT\s+domiciliar|HGTs|Glicemias?\s+capilar(?:es)?|Dextro(?:s)?)\s*[:\-]?\s*(.*)$/i;
        const paHeaderRe = /^(?:[-•*]\s*)?(?:Controle\s+(?:de\s+|domiciliar\s+de\s+)?(?:PA|press[ãa]o(?:\s+arterial)?|press[óo]rico)|MRPA|PA\s+domiciliar|Press[ãa]o(?:\s+arterial)?\s+domiciliar|PAs)\s*[:\-]?\s*(.*)$/i;

        for (const rawLine of noteLines) {
          const ln = rawLine.trim();
          if (!ln) {
            flushActive();
            continue;
          }

          const hgtExplicit = ln.match(hgtHeaderRe);
          const hgtInlineMulti = !hgtExplicit && ln.match(/^(?:[-•*]\s*)?HGT\s*[:\-]?\s*(.+)$/i);
          const isHgtInlineControl = Boolean(
            hgtInlineMulti && (
              /\b(?:jejum|p[óo]s|pr[ée]|almo[çc]o|caf[ée]|jantar|deitar|madrugada|manh[ãa]|tarde|noite|domiciliar|m[ée]dia)\b/i.test(hgtInlineMulti[1])
              || ((hgtInlineMulti[1].match(/\b\d{2,3}\b/g) || []).length >= 2)
            )
          );

          const paExplicit = ln.match(paHeaderRe);
          const paInlineMulti = !paExplicit && ln.match(/^(?:[-•*]\s*)?PA\s*[:\-]?\s*(.+)$/i);
          const isPaInlineControl = Boolean(
            paInlineMulti && (
              /\b(?:domiciliar|m[ée]dia|mrpa|manh[ãa]|noite|tarde|caderneta)\b/i.test(paInlineMulti[1])
              || ((paInlineMulti[1].match(/\b\d{2,3}\s*[\/x×]\s*\d{2,3}\b/g) || []).length >= 2)
            )
          );

          if (hgtExplicit || isHgtInlineControl) {
            flushActive();
            activeMode = 'hgt';
            const content = (hgtExplicit ? hgtExplicit[1] : hgtInlineMulti[1] || '').trim();
            if (content) activeBuffer.push(content);
            continue;
          }
          if (paExplicit || isPaInlineControl) {
            flushActive();
            activeMode = 'pa';
            const content = (paExplicit ? paExplicit[1] : paInlineMulti[1] || '').trim();
            if (content) activeBuffer.push(content);
            continue;
          }

          if (activeMode) {
            if (isUnrelatedNewHeader(ln)) {
              flushActive();
              continue;
            }
            const looksLikeHgtContinuation = activeMode === 'hgt' && (/\d{2,3}/.test(ln) || /\b(?:jejum|p[óo]s|pr[ée]|almo[çc]o|caf[ée]|jantar|deitar|madrugada|hipo|hiper|sem\s+hipo)/i.test(ln));
            const looksLikePaContinuation = activeMode === 'pa' && (/\d{2,3}\s*[\/x×]\s*\d{2,3}/.test(ln) || /\b(?:manh[ãa]|tarde|noite|m[ée]dia|pico|mmhg)\b/i.test(ln));
            if (looksLikeHgtContinuation || looksLikePaContinuation) {
              activeBuffer.push(ln.replace(/^[-•*]\s*/, ''));
            } else {
              flushActive();
            }
          }
        }
        flushActive();

        return {
          hgt: hgtItems.join(' | ').trim(),
          pa: paItems.join(' | ').trim()
        };
      };

      const typedControls = extractTypedHomeControls(quickNotes);
      const subjBlock = text.match(/\n\s*(?:\d+\.\s*)?SUBJETIVO\s*\n([\s\S]*?)(?=\n\s*(?:\d+\.\s*)?(?:OBJETIVO|EXAMES|ULTRASSONOGRAFIA|AVALIAÇÃO|CONDUTA)\b|$)/i);
      const subjBodyNow = subjBlock ? subjBlock[1] : '';

      const hasValuesRepresented = (sourceVal, targetText) => {
        const nums = Array.from(new Set((sourceVal.match(/\b\d{2,3}\b/g) || [])));
        if (nums.length === 0) return false;
        const foundCount = nums.filter(n => new RegExp(`\\b${n}\\b`).test(targetText)).length;
        return foundCount >= Math.ceil(nums.length * 0.5);
      };

      if (typedControls.hgt) {
        const alreadyHasHgt = /\b(?:controle\s+de\s+hgt|hgt|glicemia[s]?\s+capilar|perfil\s+glic[êe]mico)\b/i.test(subjBodyNow)
          && (hasValuesRepresented(typedControls.hgt, subjBodyNow) || !/\d{2,3}/.test(typedControls.hgt));
        if (!alreadyHasHgt) {
          text = appendLineToSubjetivo(text, `Controle de HGT: ${typedControls.hgt}`);
        }
      }

      if (typedControls.pa) {
        const alreadyHasPa = /\b(?:controle\s+de\s+pa|controle\s+press[óo]rico|mrpa|pa\s+domiciliar|m[ée]dias?\s+domiciliar(?:es)?)\b/i.test(subjBodyNow)
          && (hasValuesRepresented(typedControls.pa, subjBodyNow) || !/\d{2,3}/.test(typedControls.pa));
        if (!alreadyHasPa) {
          text = appendLineToSubjetivo(text, `Controle de PA: ${typedControls.pa}`);
        }
      }
    }

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
    let currentSectionName = '';
    for (let rawLine of allLines) {
      const trimmed = rawLine.trim();
      if (/^(?:\d+\.\s*)?(?:AVALIAÇÃO|CONDUTA|PLANO)\s*:?\s*$|^>>\s*PENDÊNCIAS/.test(trimmed)) {
        inAvaliacaoOrConduta = true;
        currentSectionName = trimmed.toUpperCase();
        cleanedLines.push(rawLine);
        continue;
      }
      if (/^(?:\d+\.\s*)?(?:SUBJETIVO|OBJETIVO|EXAMES COMPLEMENTARES|ULTRASSONOGRAFIA|RASTREAMENTOS|SOROLOGIAS)/i.test(trimmed)) {
        inAvaliacaoOrConduta = false;
        currentSectionName = '';
      }
      if (inAvaliacaoOrConduta) {
        // Remove numeração ("1. ", "2. ", "1) ", etc.) e traços ("- ") para que fique em linhas limpas
        rawLine = rawLine.replace(/^\s*(?:\d+[\.\)]|-)\s*/, '');

        if (/CONDUTA/i.test(currentSectionName)) {
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

          // Garante que qualquer menção a renovação de MUC na Conduta seja escrita por extenso e nunca como #MUC
          rawLine = rawLine
            .replace(/renov(?:o|ada[s]?|ação)?\s+(?:de\s+)?receitas?\s+(?:de\s+uso\s+cont[íi]nuo\s+)?\(?conforme\s+#\s*MUC\)?/gi, 'Renovo medicações de uso contínuo')
            .replace(/renov(?:o|ada[s]?|ação)?\s+(?:de\s+)?(?:receitas?\s+)?#\s*MUC\b/gi, 'Renovo medicações de uso contínuo')
            .replace(/\s*\(#\s*MUC\)/gi, '')
            .replace(/#\s*MUC\b/gi, 'medicações de uso contínuo')
            .replace(/\(conforme\s+medicações\s+de\s+uso\s+contínuo\)/gi, 'de uso contínuo')
            .replace(/\(conforme\s+#\s*MUC\)/gi, 'de uso contínuo');

          // Bloqueia alucinação comum: se a IA escreveu "Renovo medicações de uso contínuo" mas o áudio/notas de hoje NÃO mencionam renovação/receita/uso contínuo, remove a linha
          if (/^Renovo\s+(?:receitas?\s+de\s+)?medica[çc][õo]es\s+de\s+uso\s+cont[íi]nuo\b/i.test(rawLine.trim())) {
            const todayEvidence = `${rawTranscript || ''}\n${quickNotes || ''}`;
            if (todayEvidence.trim().length >= 20 && !/\b(?:renov|receita|receitu[áa]rio|uso\s+cont[íi]nuo|mantenho|manter\s+(?:as?\s+)?medica|mesmos?\s+rem[ée]dio)/i.test(todayEvidence)) {
              continue;
            }
          }

          // Se já descreveu os sinais de alarme específicos, remove a frase genérica duplicada
          if (hasDetailedAlarmLine && /^Oriento sinais de alarme e(?:,\s*)? na presença/i.test(rawLine.trim())) {
            continue;
          }

          // Se a IA gerou múltiplas condutas coladas em texto corrido na mesma linha, quebra em linhas individuais!
          const splitSubActions = rawLine
            .replace(/(?<=[.!?])\s+(?=(?:Prescrevo|Oriento|Solicito|Encaminho|Renovo|Agendo|Explico|Parabenizo|Mantenho|Reforço|Ciente|Familiar)\b)/gi, '\n')
            .split('\n')
            .map(a => a.trim().replace(/^\s*(?:\d+[\.\)]|-)\s*/, ''))
            .filter(Boolean);

          if (splitSubActions.length > 1) {
            splitSubActions.forEach(action => cleanedLines.push(action));
            continue;
          }
        }
      }
      cleanedLines.push(rawLine);
    }

    let spacedText = cleanedLines.join('\n').trim();

    // Remove boilerplate genérico, placeholder de prompt ou clichê da seção PLANO (somente quando "PLANO" está sozinho em sua própria linha)
    spacedText = spacedText
      .replace(/\n+^[ \t]*PLANO[ \t]*\n+[ \t]*(?:\[Apenas se o m[ée]dico citou[^\]]*\]|Seguimento ambulatorial na APS(?: conforme necessidade cl[íi]nica)?\.?|Sem pend[êe]ncias(?: futuras)?\.?|Nenhuma a[çc][ãa]o futura espec[íi]fica\.?)[ \t]*$/gm, '')
      .replace(/\n+^[ \t]*PLANO[ \t]*$(?=\s*$)/gm, '');

    // Se a IA colocou ações da próxima consulta / seguimento futuro dentro de CONDUTA sem criar a seção PLANO, promove-as para PLANO automaticamente
    if (!/^[ \t]*PLANO[ \t]*$/m.test(spacedText) && /^[ \t]*CONDUTA[ \t]*$/m.test(spacedText)) {
      const condutaBlockMatch = spacedText.match(/(^[ \t]*CONDUTA[ \t]*\n)([\s\S]*?)(\n+[ \t]*>>\s*PENDÊNCIAS[\s\S]*)?$/m);
      if (condutaBlockMatch) {
        const condHeader = condutaBlockMatch[1];
        const condBody = condutaBlockMatch[2] || '';
        const pendSuffix = condutaBlockMatch[3] || '';
        const condLines = condBody.split('\n');
        const keptCondLines = [];
        const extractedPlanLines = [];
        const isFuturePlanLine = (ln) => {
          const t = ln.trim();
          if (!t) return false;
          if (/^(?:Agendo|Oriento)\s+retorno\b/i.test(t) && !/\b(?:na\s+pr[óo]xima|para\s+(?:solicitar|pedir|encaminhar|avaliar|reavaliar|checar|repetir|coletar|definir))/i.test(t)) {
            return false;
          }
          return /\b(?:na\s+pr[óo]xima\s+consulta|em\s+pr[óo]xima\s+consulta|na\s+pr[óo]xima\s+avalia[çc][ãa]o|na\s+pr[óo]xima\s+visita|no\s+pr[óo]ximo\s+atendimento|na\s+consulta\s+seguinte|na\s+consulta\s+subsequente|no\s+pr[óo]ximo\s+retorno|no\s+pr[óo]ximo\s+acompanhamento|para\s+a\s+pr[óo]xima\s+consulta|segunda\s+etapa\s+da\s+triagem|M-CHAT-R\/F|para\s+definir\s+necessidade\s+de\s+(?:investiga|encaminh))\b/i.test(t)
            || /\b(?:no\s+retorno|em\s+retorno|ap[óo]s\s+retorno)\b[^.\n]{0,60}\b(?:solicitar|solicitarei|pedir|pedirei|encaminhar|encaminharei|avaliar|avaliarei|reavaliar|considerar|iniciar|trocar|ajustar|titular|repetir|checar|verificar|definir|decidir|coletar|dosar|exame)\b/i.test(t)
            || /^(?:Planejo|Programo|Fica\s+planejad[oa]|Fica\s+programad[oa]|Plano\s*:|Aguardar\s+resultado[^.\n]*para\s+(?:definir|avaliar|encaminhar|solicitar))\b/i.test(t)
            || /\b(?:se\s+mantiver|se\s+persistir|caso\s+persista|caso\s+mantenha|se\s+n[ãa]o\s+houver\s+melhora)\b[^.\n]{0,60}\b(?:encaminh|solicit|pedir|iniciar|trocar|associar)\b/i.test(t);
        };
        for (const ln of condLines) {
          if (isFuturePlanLine(ln)) {
            extractedPlanLines.push(ln.trim());
          } else {
            keptCondLines.push(ln);
          }
        }
        if (extractedPlanLines.length > 0 && keptCondLines.some(l => l.trim().length > 0)) {
          const newCondutaPart = `${condHeader}${keptCondLines.join('\n').trimEnd()}\n\n\nPLANO\n${extractedPlanLines.join('\n')}${pendSuffix}`;
          spacedText = spacedText.replace(condutaBlockMatch[0], newCondutaPart);
        }
      }
    }

    // Garante espaçamento visual nítido entre os grandes blocos para colar no PEC / e-SUS.
    // IMPORTANTE: só reconhece o TÍTULO da seção quando ele está SOZINHO e em MAIÚSCULAS no início da linha.
    // (Nunca pode casar palavras comuns dentro de frases, como "avaliação dos marcos" ou "conduta".)
    spacedText = spacedText
      .replace(/\n*^[ \t]*(SUBJETIVO)[ \t]*$/gm, '\n\n\n$1')
      .replace(/\n*^[ \t]*(OBJETIVO(?:[ \t]*\(EXAME FÍSICO\))?)[ \t]*$/gm, '\n\n\n$1')
      .replace(/\n*^[ \t]*(EXAMES COMPLEMENTARES|ULTRASSONOGRAFIA)[ \t]*$/gm, '\n\n\n$1')
      .replace(/\n*^[ \t]*(AVALIAÇÃO)[ \t]*$/gm, '\n\n\n$1')
      .replace(/\n*^[ \t]*(CONDUTA)[ \t]*$/gm, '\n\n\n$1')
      .replace(/\n*^[ \t]*(PLANO)[ \t]*$/gm, '\n\n\n$1')
      .replace(/\n*^[ \t]*(>>\s*PENDÊNCIAS[^\n]*)$/gm, '\n\n\n$1')
      .replace(/^\n+/, '');

    return { cleanText: spacedText, codes: extractedCodes };
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
          // Nunca aceita transcrição cortada/incompleta em caso de timeout
          reject(new Error(`Timeout na comunicação WebSocket Live API com modelo ${cleanModel}`));
        }
      }, 60000);

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

  async function callGeminiWithFallbackAndRetry(requestBody, apiKey, onStatusUpdate, options = {}) {
    let lastError = null;
    let allFailedByDailyQuota = false;
    const keysToTry = getSavedApiKeysList(apiKey);
    const maxTransientRounds = options.maxRounds || 2;
    const callStartedAt = Date.now();
    const overallDeadlineMs = options.overallTimeoutMs || 150000; // Teto global de 2m30s (evita ficar travado em 94% por 5+ min!)

    for (let round = 1; round <= maxTransientRounds; round++) {
      if (Date.now() - callStartedAt > overallDeadlineMs) {
        throw lastError || new Error('Tempo limite global atingido (servidor do Google demorou demais). Clique em "Atualizar" para tentar novamente.');
      }
      let sawTransientFailure = false;
      allFailedByDailyQuota = false;

      for (let kIdx = 0; kIdx < keysToTry.length; kIdx++) {
        if (Date.now() - callStartedAt > overallDeadlineMs) break;
        const currentKey = keysToTry[kIdx];
        const keyTag = keysToTry.length > 1 ? ` [Chave ${kIdx + 1}/${keysToTry.length}]` : '';
        let modelsToTry = [...(await getActiveGeminiModels(currentKey))];
        const cooldownNow = Date.now();
        const notCooling = modelsToTry.filter(m => !(modelCooldownUntil[currentKey.slice(-8) + '|' + m] > cooldownNow));
        if (notCooling.length > 0) modelsToTry = notCooling;

      for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
        if (Date.now() - callStartedAt > overallDeadlineMs) break;
        const model = modelsToTry[mIdx];
        const maxAttempts = (keysToTry.length > 1 || mIdx < modelsToTry.length - 1) ? 1 : 2;
        let disableThinkingForThisModel = false;
        let fallbackMaxTokens = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            if (onStatusUpdate) {
              onStatusUpdate(attempt > 1 ? `⏳ Tentativa ${attempt} (${formatModelName(model)})${keyTag}...` : `⚡ Estruturando (${formatModelName(model)})${keyTag}...`);
            }

            // Se for modelo da Live API (WebSocket)
            const isLiveModel = model.includes('live') || model.includes('native-audio-dialog');
            if (isLiveModel) {
              try {
                const liveResult = await callGeminiLiveWebSocket(requestBody, currentKey, model, onStatusUpdate);
                if (liveResult && liveResult.responseJson) {
                  rememberWorkingModelForKey(model, currentKey);
                  recordKeyModelUsage(currentKey, model, liveResult.responseJson?.usageMetadata?.totalTokenCount || 0);
                  updateTokenMonitorUI(model);
                  renderApiKeysQuotaDashboard();
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
            if (!options.disableThinking && !disableThinkingForThisModel && !model.includes('lite') && !model.includes('live') && !model.includes('transcribe') && !model.includes('gemma') && (model.startsWith('gemini-2.5') || model.startsWith('gemini-3')) && !bodyForModel.generationConfig.thinkingConfig) {
              bodyForModel.generationConfig.thinkingConfig = { thinkingBudget: 512 };
            }

            const abortCtrl = new AbortController();
            const serializedBody = JSON.stringify(bodyForModel);
            // Timeout enxuto por tentativa (55s p/ texto/áudio curto, 110s p/ áudio >3.5MB) respeitando sempre o teto global
            const remainingBudgetMs = Math.max(15000, overallDeadlineMs - (Date.now() - callStartedAt));
            const baseTimeoutMs = options.fastTimeoutMs || (serializedBody.length > 3500000 ? 110000 : 55000);
            const timeoutMs = Math.min(baseTimeoutMs, remainingBudgetMs);
            const fetchTimeoutId = setTimeout(() => abortCtrl.abort(), timeoutMs);
            let res;
            try {
              res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: serializedBody,
                signal: abortCtrl.signal
              });
            } finally {
              clearTimeout(fetchTimeoutId);
            }

            if (res.ok) {
              const responseJson = await res.json();
              rememberWorkingModelForKey(model, currentKey);
              recordKeyModelUsage(currentKey, model, responseJson?.usageMetadata?.totalTokenCount || 0);
              updateTokenMonitorUI(model);
              renderApiKeysQuotaDashboard();
              allFailedByDailyQuota = false;
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
                  recordKeyModelUsage(currentKey, model, liveResult.responseJson?.usageMetadata?.totalTokenCount || 0);
                  updateTokenMonitorUI(model);
                  renderApiKeysQuotaDashboard();
                  allFailedByDailyQuota = false;
                  return liveResult;
                }
              } catch (_) {}
            }

            if (res.status === 400 && errMsg.toLowerCase().includes('api key')) {
              console.warn(`Chave API #${kIdx + 1} (${getKeyShortHash(currentKey)}) retornou erro de credencial no Google: ${errMsg}`);
              if (kIdx === keysToTry.length - 1) {
                const elDaily = document.getElementById('dailyTokenCounter');
                if (elDaily) {
                  elDaily.textContent = `🔴 Chave API inválida`;
                  elDaily.style.color = '#dc2626';
                }
                throw new Error('Credencial de API inválida. Clique em "Credencial API" no topo para verificar.');
              }
              showToast(`⚠️ Chave #${kIdx + 1} inválida no Google. Alternando para a Chave reserva #${kIdx + 2}...`);
              mIdx = modelsToTry.length;
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
                updateTokenMonitorUI();
                renderApiKeysQuotaDashboard();
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
              sawTransientFailure = true;
              if (res.status === 503) {
                modelCooldownUntil[currentKey.slice(-8) + '|' + model] = Date.now() + 120000;
              }
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
              // Se houver outros modelos na fila, tenta apenas 1 vez rápido antes de pular para outro modelo; se for o último da chave, aguarda rápido antes de tentar de novo
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
            if (networkErr && networkErr.name === 'AbortError') {
              sawTransientFailure = true;
              lastError = new Error(`Tempo limite excedido no modelo ${formatModelName(model)}, alternando automaticamente...`);
              if (onStatusUpdate) onStatusUpdate(`⚡ Alternando modelo (${formatModelName(model)} demorou)...`);
              // Não marca como esgotado hoje por timeout! Timeout é apenas lentidão temporária ou áudio longo.
              break; // Pula imediatamente para o próximo modelo sem travar!
            }
            lastError = networkErr;
            if (networkErr.message && networkErr.message.includes('Credencial de API')) {
              throw networkErr;
            }
            sawTransientFailure = true;
            if (attempt < maxAttempts) {
              if (onStatusUpdate) onStatusUpdate(`🌐 Reconectando em 3s...`);
              await sleep(3000);
            }
          }
        }
      }
      }

      if (!allFailedByDailyQuota && sawTransientFailure && round < maxTransientRounds) {
        const roundWaitSec = round * 4;
        if (onStatusUpdate) {
          onStatusUpdate(`⏳ Servidor Google instável (503). Nova tentativa automática (${round + 1}/${maxTransientRounds}) em ${roundWaitSec}s...`);
        }
        await sleep(roundWaitSec * 1000);
        continue;
      }
      break;
    }

    // FALLBACK DE EMERGÊNCIA (se todos os modelos REST Flash falharem por 503 ou cota):
    // 1) Para transcrição de áudio (Etapa 1), tenta os modelos Live API (cota Ilimitada) via WebSocket
    if (options.allowLiveFallback) {
      for (const currentKey of keysToTry) {
        const kHash = getKeyShortHash(currentKey);
        const liveCandidates = ((cachedEmergencyLiveModelsByKey[kHash] && cachedEmergencyLiveModelsByKey[kHash].length > 0)
          ? cachedEmergencyLiveModelsByKey[kHash]
          : ['gemini-3.5-transcribe-live', 'gemini-3-flash-live']).slice(0, 2);
        for (const liveModel of liveCandidates) {
          try {
            if (onStatusUpdate) onStatusUpdate(`🎙️ Fallback Live API (${formatModelName(liveModel)})...`);
            const liveRes = await callGeminiLiveWebSocket(requestBody, currentKey, liveModel, onStatusUpdate);
            if (liveRes && liveRes.responseJson) {
              recordKeyModelUsage(currentKey, liveModel, liveRes.responseJson?.usageMetadata?.totalTokenCount || 0);
              updateTokenMonitorUI(liveModel);
              renderApiKeysQuotaDashboard();
              return liveRes;
            }
          } catch (_) {}
        }
      }
    }

    // 2) Para estruturação de texto (Etapa 2 já com transcrição pronta), tenta Gemma 4 (14.4K/dia)
    if (options.allowGemmaFallback) {
      for (const currentKey of keysToTry) {
        const kHash = getKeyShortHash(currentKey);
        const gemmaCandidates = (cachedEmergencyGemmaModelsByKey[kHash] && cachedEmergencyGemmaModelsByKey[kHash].length > 0)
          ? cachedEmergencyGemmaModelsByKey[kHash]
          : ['gemma-4-31b-it', 'gemma-4-26b-it'];
        for (const gemmaModel of gemmaCandidates) {
          try {
            if (onStatusUpdate) onStatusUpdate(`⚡ Fallback de emergência (${formatModelName(gemmaModel)})...`);
            const gemmaBody = {
              contents: requestBody.contents,
              generationConfig: {
                temperature: requestBody.generationConfig?.temperature ?? 0.1,
                maxOutputTokens: Math.min(requestBody.generationConfig?.maxOutputTokens || 8192, 8192)
              }
            };
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${gemmaModel}:generateContent?key=${encodeURIComponent(currentKey)}`;
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(gemmaBody)
            });
            if (res.ok) {
              const responseJson = await res.json();
              recordKeyModelUsage(currentKey, gemmaModel, responseJson?.usageMetadata?.totalTokenCount || 0);
              updateTokenMonitorUI(gemmaModel);
              renderApiKeysQuotaDashboard();
              return { responseJson, modelUsed: gemmaModel };
            }
          } catch (_) {}
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
    const abortCtrl = new AbortController();
    const timeoutId = setTimeout(() => abortCtrl.abort(), 120000);
    try {
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
        body: JSON.stringify({ file: { display_name: 'ubs_file_' + Date.now() } }),
        signal: abortCtrl.signal
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
        body: blob,
        signal: abortCtrl.signal
      });
      const fileInfo = await uploadRes.json();
      return fileInfo?.file?.uri;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  const TELESSAUDE_SLUG_MAP = {
    'oftalmologia pediátrica': 'protocolo-de-oftalmologia-pediatrica',
    'oftalmologia pediatrica': 'protocolo-de-oftalmologia-pediatrica',
    'oftalmo pediátrica': 'protocolo-de-oftalmologia-pediatrica',
    'oftalmo pediatrica': 'protocolo-de-oftalmologia-pediatrica',
    'oftalmo infantil': 'protocolo-de-oftalmologia-pediatrica',
    'oftalmologia infantil': 'protocolo-de-oftalmologia-pediatrica',
    'endocrinologia pediátrica': 'protocolo-de-endocrinologia-pediatrica-ses',
    'endocrinologia pediatrica': 'protocolo-de-endocrinologia-pediatrica-ses',
    'urologia pediátrica': 'protocolo-de-encaminhamento-urologia-pediatrica',
    'urologia pediatrica': 'protocolo-de-encaminhamento-urologia-pediatrica',
    'neurologia pediátrica': 'protocolo-de-neurologia-pediatrica',
    'neurologia pediatrica': 'protocolo-de-neurologia-pediatrica',
    'neuropediatria': 'protocolo-de-neurologia-pediatrica',
    'hematologia pediátrica': 'protocolo-de-hematologia-pediatrica',
    'hematologia pediatrica': 'protocolo-de-hematologia-pediatrica',
    'saúde mental infantil': 'protocolo-de-saude-mental-infantil',
    'cardiologia': 'protocolo-de-cardiologia',
    'pneumologia': 'protocolo-de-pneumologia-adulto',
    'pna': 'protocolo-de-obstetricia',
    'pré-natal': 'protocolo-de-obstetricia',
    'prenatal': 'protocolo-de-obstetricia',
    'obstetrícia': 'protocolo-de-obstetricia',
    'endocrinologia': 'protocolo-de-endocrinologia-adulto-ses',
    'ortopedia': 'protocolo-de-ortopedia-adulto-ses',
    'pediatria': 'protocolo-de-neurologia-pediatrica',
    'neurologia': 'protocolo-de-neurologia-adulto-ses',
    'ginecologia': 'protocolo-de-ginecologia-adulto',
    'mastologia': 'protocolo-de-mastologia',
    'oftalmologia': 'protocolo-de-oftalmologia-adulto',
    'otorrinolaringologia': 'protocolo-de-otorrinolaringologia-adulto',
    'otorrino': 'protocolo-de-otorrinolaringologia-adulto',
    'cirurgia geral': 'protocolo-de-cirurgia-geral',
    'urologia': 'protocolo-de-urologia-adulto',
    'gastroenterologia': 'protocolo-de-gastroenterologia',
    'gastro': 'protocolo-de-gastroenterologia',
    'reumatologia': 'protocolo-de-reumatologia-ses',
    'nefrologia': 'protocolo-de-nefrologia-adulto',
    'vascular': 'protocolo-de-cirurgia-vascular',
    'angiologia': 'protocolo-de-cirurgia-vascular',
    'psiquiatria': 'protocolo-de-psiquiatria-adulto',
    'saúde mental': 'protocolo-de-psiquiatria-adulto',
    'dermatologia': 'protocolo-de-dermatologia',
    'dermato': 'protocolo-de-dermatologia',
    'fonoaudiologia': 'protocolo-de-reabilitacao-auditiva-adulto',
    'reabilitação': 'protocolo-de-reabilitacao-fisica',
    'proctologia': 'protocolo-de-proctologia-adulto',
    'hematologia': 'protocolo-de-hematologia-adulto',
    'infectologia': 'protocolo-de-infectologia',
    'dor': 'protocolo-de-tratamento-da-dor',
    'plástica': 'protocolo-de-cirurgia-plastica'
  };

  function getTelessaudeSlug(especialidade) {
    const norm = String(especialidade || '').toLowerCase();
    for (const [key, slug] of Object.entries(TELESSAUDE_SLUG_MAP)) {
      if (norm.includes(key)) return slug;
    }
    return null;
  }

  const telessaudeMemoryCache = window.__telessaudeCache = window.__telessaudeCache || {};

  async function fetchTelessaudeProtocol(slug) {
    if (!slug) return null;
    if (telessaudeMemoryCache[slug]) return telessaudeMemoryCache[slug];

    try {
      const cached = sessionStorage.getItem('telessaude_' + slug);
      if (cached) {
        const parsed = JSON.parse(cached);
        telessaudeMemoryCache[slug] = parsed;
        return parsed;
      }
    } catch (e) {}

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`https://api-site.telessauders.ufrgs.br/protocolo/${slug}/`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      const data = await res.json();
      const result = {
        nome: data.nome,
        especialidade: data.especialidade,
        conteudo_extraido: data.conteudo_extraido || ''
      };
      telessaudeMemoryCache[slug] = result;
      try {
        sessionStorage.setItem('telessaude_' + slug, JSON.stringify(result));
      } catch (e) {}
      return result;
    } catch (err) {
      console.warn('Não foi possível conectar ao TelessaúdeRS em tempo real, usando base interna:', err);
      return null;
    }
  }

  function extractRelevantProtocolSection(fullProtocolText, caseEvidenceText, directCondition = '') {
    if (!fullProtocolText || fullProtocolText.length < 5000) return fullProtocolText;
    const normCase = String(caseEvidenceText || '').toLowerCase();
    const normDirect = String(directCondition || '').toLowerCase().trim();

    // Divide pelos blocos "Protocolo X –"
    const chunks = fullProtocolText.split(/(?=\bProtocolo\s+\d+\s*[-–])/i);
    if (chunks.length <= 1) {
      return fullProtocolText.slice(0, 50000);
    }

    const matchingChunks = [];
    const directWords = normDirect.match(/[a-záàâãéèêíïóôõöúçñ]{3,}/gi) || [];

    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      const firstLines = chunk.slice(0, 400).toLowerCase();
      const titleWords = firstLines.match(/[a-záàâãéèêíïóôõöúçñ]{3,}/gi) || [];
      const relevantWords = titleWords.filter(w => !['protocolo', 'adulto', 'pediatrico', 'condicoes', 'clinicas', 'necessidade', 'encaminhamento', 'servico', 'urgencia'].includes(w));

      let score = 0;

      // 1. Super bônus para condição/motivo específico digitado pelo médico
      for (const dw of directWords) {
        if (['investigacao', 'suspeita', 'quadro', 'caso', 'para', 'com'].includes(dw)) continue;
        if (firstLines.includes(dw)) {
          score += 30; // Prioridade máxima absoluta na busca direta!
        }
      }

      // 2. Pontuação adicional com base nos dados clínicos gerais da consulta
      for (const w of relevantWords) {
        if (normCase.includes(w)) {
          score += 2;
        }
      }

      if (score > 0 && /conte[úu]do\s+descritivo\s+m[íi]nimo/i.test(chunk)) {
        score += 5;
      }

      if (score > 0) {
        matchingChunks.push({ chunk, score });
      }
    }

    if (matchingChunks.length > 0) {
      matchingChunks.sort((a, b) => b.score - a.score);
      const topTexts = matchingChunks.slice(0, 2).map(m => m.chunk.trim());
      return topTexts.join('\n\n---\n\n');
    }

    return fullProtocolText.slice(0, 50000);
  }

  function cleanReferralOutputText(rawText) {
    return String(rawText || '')
      .replace(/^```[a-z]*\n?/gim, '')
      .replace(/```$/gim, '')
      .replace(/\*+/g, '')
      .replace(/^[ \t]*(?:EXAME\s+F[ÍI]SICO\s+(?:DIRECIONADO|FOCADO)|MOTIVO\s+DO\s+ENCAMINHAMENTO(?:\s+E\s+HIST[ÓO]RIA\s+CL[ÍI]NICA)?)\s*:\s*\n?/gim, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  async function generateLiveReferralDuringConsultation() {
    const apiKey = getSavedApiKey();
    if (!apiKey) {
      openApiKeyModal();
      return;
    }
    const specialtySelect = document.getElementById('liveReferralSpecialtySelect');
    const customSpecialty = document.getElementById('liveReferralCustomSpecialty');
    const conditionInput = document.getElementById('liveReferralConditionInput');
    const extraDataInput = document.getElementById('liveReferralExtraDataInput');
    const editor = document.getElementById('liveReferralResultEditor');
    const btn = document.getElementById('btnGenerateLiveReferralNow');

    const especialidade = (customSpecialty?.value.trim()) || (specialtySelect?.value.trim()) || 'Especialidade Médica';
    const motivoEncaminhamento = (conditionInput?.value.trim()) || '';
    const dadosExtrasRegulacao = (extraDataInput?.value.trim()) || '';
    const quickNotes = (document.getElementById('quickNotesInput')?.value || '').trim();
    const prevConsult = (document.getElementById('previousConsultationInput')?.value || '').trim();
    const preExams = (document.getElementById('liveExamTranscriptionEditor')?.value || state.preTranscribedExamsText || '').trim();
    const draftTyped = (editor?.value || '').trim();

    if (btn) {
      btn.disabled = true;
      btn.textContent = `⏳ Gerando encaminhamento (${especialidade}) sem parar gravação...`;
    }

    try {
      let liveAudioPart = null;
      let liveWhisperTranscript = '';
      if (state.isRecording && state.recordingConsultationId && state.mediaRecorder) {
        try {
          if (state.mediaRecorder.state === 'recording') {
            state.mediaRecorder.requestData();
            await sleep(350);
          }
          if (state.lastChunkSavePromise) {
            await state.lastChunkSavePromise;
          }
          const partialBlob = await window.ScribeDB.assembleAudioBlob(state.recordingConsultationId);
          if (partialBlob && partialBlob.size > 0) {
            // Se o modo for 'whisper', OU 'auto' com áudio grande (>15MB) / Gemini instável, transcreve o áudio parcial localmente
            const liveMode = getAudioEngineMode();
            const useWhisperLive = (liveMode === 'whisper')
              || (liveMode === 'auto' && (partialBlob.size > 15 * 1024 * 1024 || (Date.now() - lastGeminiAudioOverloadAt) < 10 * 60 * 1000));
            if (useWhisperLive) {
              try {
                const wRes = await transcribeAudioBlobsWithLocalWhisper([partialBlob], (pct, stageMsg) => {
                  if (btn && stageMsg) btn.textContent = `⏳ ${stageMsg}`;
                });
                if (wRes && wRes.transcript && wRes.transcript.length >= 10) {
                  liveWhisperTranscript = fixBrazilianMedicationSpelling(wRes.transcript);
                }
              } catch (wLiveErr) {
                console.warn('Whisper Local no encaminhamento ao vivo falhou, usando fallback Gemini:', wLiveErr);
              }
            }
            if (!liveWhisperTranscript && partialBlob.size <= 15 * 1024 * 1024) {
              const cleanMime = normalizeAudioMimeType(partialBlob, '');
              const b64 = await blobToBase64(partialBlob);
              liveAudioPart = { inlineData: { mimeType: cleanMime, data: b64 } };
            }
          }
        } catch (_) {}
      }

      const slug = getTelessaudeSlug(especialidade);
      let telessaudeProtocol = null;
      if (slug) {
        try {
          telessaudeProtocol = await fetchTelessaudeProtocol(slug);
        } catch (_) {}
      }

      const combinedContextText = [
        prevConsult ? `=== EVOLUÇÃO ANTERIOR DO PACIENTE ===\n${prevConsult}` : '',
        quickNotes ? `=== ANOTAÇÕES RÁPIDAS DE HOJE ===\n${quickNotes}` : '',
        draftTyped ? `=== RASCUNHO DIGITADO PELO MÉDICO NO ENCAMINHAMENTO ===\n${draftTyped}` : ''
      ].filter(Boolean).join('\n\n') || 'Consulta em andamento (utilize o áudio/transcrição gravados até o momento, motivo e dados adicionais informados).';

      const caseEvidence = `${especialidade}\n${motivoEncaminhamento}\n${dadosExtrasRegulacao}\n${combinedContextText}\n${liveWhisperTranscript}`;
      const targetedProtocol = extractRelevantProtocolSection(telessaudeProtocol?.conteudo_extraido || '', caseEvidence, motivoEncaminhamento);

      const prompt = window.buildReferralPrompt({
        templateId: state.selectedTemplateId,
        templateName: state.templates[state.selectedTemplateId]?.name || 'Consulta APS',
        evolucaoTexto: combinedContextText,
        rawTranscript: liveWhisperTranscript,
        preTranscribedExamsText: preExams,
        especialidade,
        motivoEncaminhamento,
        dadosExtrasRegulacao,
        quickNotes,
        telessaudeProtocolText: targetedProtocol
      });

      const userParts = [];
      if (liveAudioPart && !liveWhisperTranscript) userParts.push(liveAudioPart);
      userParts.push({ text: prompt });

      const requestBody = {
        contents: [{ role: 'user', parts: userParts }],
        generationConfig: { temperature: 0.15, maxOutputTokens: 8192 }
      };

      const onLiveRefStatus = (msg) => {
        if (btn) btn.textContent = `⏳ ${msg}`;
      };

      let responseJson;
      try {
        ({ responseJson } = await callGeminiWithFallbackAndRetry(requestBody, apiKey, onLiveRefStatus, {
          maxRounds: 1,
          fastTimeoutMs: 45000,
          disableThinking: true,
          allowGemmaFallback: Boolean(liveWhisperTranscript || !liveAudioPart)
        }));
      } catch (audioRefErr) {
        if (liveAudioPart) {
          // Fallback imediato só com texto (Evolução Anterior + Notas + Motivo + Exames) se o WebM ainda em gravação falhar
          const textOnlyBody = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.15, maxOutputTokens: 8192 }
          };
          ({ responseJson } = await callGeminiWithFallbackAndRetry(textOnlyBody, apiKey, onLiveRefStatus, { maxRounds: 1, fastTimeoutMs: 35000, disableThinking: true, allowGemmaFallback: true }));
        } else {
          throw audioRefErr;
        }
      }
      const refText = cleanReferralOutputText(responseJson?.candidates?.[0]?.content?.parts?.[0]?.text || '');
      if (editor) editor.value = refText;
      addDailyTokenUsage(responseJson?.usageMetadata?.totalTokenCount || 800);
      showToast(`🏛️ Encaminhamento (${especialidade}) gerado durante o atendimento!`);
    } catch (err) {
      alert('Erro ao gerar encaminhamento durante a consulta: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '⚡ Gerar Encaminhamento Agora (Sem Parar o Atendimento)';
      }
    }
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
    if (!currentEvolutionText || currentEvolutionText.length < 60 || currentEvolutionText.includes('A evolução estruturada aparecerá aqui...')) {
      alert('⚠️ A evolução clínica deste paciente ainda não foi finalizada pela IA. Aguarde a conclusão da transcrição (100%) antes de gerar o encaminhamento.');
      return;
    }

    const specialtySelect = document.getElementById('referralSpecialtySelect');
    const customSpecialty = document.getElementById('referralCustomSpecialty');
    const conditionInput = document.getElementById('referralConditionInput');
    const extraDataInput = document.getElementById('referralExtraDataInput');
    const btnGenerate = document.getElementById('btnGenerateReferral');

    // Se o médico preencheu manualmente o campo livre "Ou digite outra especialidade", usa ele;
    // caso contrário, usa estritamente a especialidade selecionada no dropdown!
    const customVal = (customSpecialty && customSpecialty.value.trim()) || '';
    const selectVal = (specialtySelect && specialtySelect.value.trim()) || '';
    const especialidade = customVal || selectVal || 'Especialidade Médica';
    const motivoEncaminhamento = (conditionInput && conditionInput.value.trim()) || '';
    const dadosExtrasRegulacao = extraDataInput ? extraDataInput.value.trim() : '';

    if (btnGenerate) {
      btnGenerate.disabled = true;
      btnGenerate.textContent = `⏳ Consultando Protocolo TelessaúdeRS (${especialidade})...`;
    }

    try {
      const slug = getTelessaudeSlug(especialidade);
      let telessaudeProtocol = null;
      if (slug) {
        try {
          telessaudeProtocol = await fetchTelessaudeProtocol(slug);
        } catch (e) {
          console.warn('Erro ao consultar TelessaúdeRS:', e);
        }
      }

      if (btnGenerate) {
        btnGenerate.textContent = motivoEncaminhamento
          ? `⏳ Buscando protocolo direto de "${motivoEncaminhamento}"...`
          : '⏳ Enquadrando caso no protocolo e checando pendências...';
      }

      const caseEvidence = `${especialidade}\n${motivoEncaminhamento}\n${dadosExtrasRegulacao}\n${currentEvolutionText}\n${consult.quickNotes || ''}`;
      const targetedProtocol = extractRelevantProtocolSection(telessaudeProtocol?.conteudo_extraido || '', caseEvidence, motivoEncaminhamento);

      const prompt = window.buildReferralPrompt({
        templateId: consult.templateId,
        templateName: consult.templateName,
        evolucaoTexto: currentEvolutionText,
        rawTranscript: consult.rawTranscript || '',
        preTranscribedExamsText: consult.preTranscribedExamsText || '',
        especialidade,
        motivoEncaminhamento,
        dadosExtrasRegulacao,
        quickNotes: consult.quickNotes,
        telessaudeProtocolText: targetedProtocol
      });

      const requestBody = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.15, maxOutputTokens: 65536 }
      };

      const { responseJson } = await callGeminiWithFallbackAndRetry(requestBody, apiKey);
      const rawRefText = (responseJson?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
      const refText = cleanReferralOutputText(rawRefText);
      const tokens = responseJson?.usageMetadata?.totalTokenCount || 800;

      if (!Array.isArray(consult.referrals)) {
        consult.referrals = [];
        if (consult.referralText) {
          consult.referrals.push({
            id: 'ref_legacy',
            specialty: consult.referralSpecialty || 'Especialidade',
            text: consult.referralText,
            createdAt: consult.updatedAt || Date.now()
          });
        }
      }

      // Extrai o enquadramento de condição do protocolo se existir no texto gerado
      const condMatch = refText.match(/•\s*Condição(?:\s*Clínica)?:\s*([^\n\r]+)/i);
      const protocolCondition = condMatch ? condMatch[1].trim() : '';

      const newRefItem = {
        id: 'ref_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        specialty: especialidade,
        protocolCondition,
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
      await refreshQueueSidebar();
      showToast(`🏛️ Encaminhamento #${consult.referrals.length} (${especialidade}) salvo com protocolo TelessaúdeRS!`);
    } catch (err) {
      alert('Erro ao gerar encaminhamento: ' + err.message);
    } finally {
      if (btnGenerate) {
        btnGenerate.disabled = false;
        btnGenerate.textContent = '🏛️ Gerar Encaminhamento conforme Protocolo TelessaúdeRS (Regulação Estadual)';
      }
    }
  }

  async function improveCurrentReferral() {
    if (!state.activeConsultationId) return;
    const apiKey = getSavedApiKey();
    if (!apiKey) {
      openApiKeyModal();
      return;
    }
    const editor = document.getElementById('referralResultEditor');
    const currentRefText = (editor && editor.value.trim()) || '';
    if (!currentRefText) {
      alert('Gere ou selecione um encaminhamento primeiro para poder melhorá-lo.');
      return;
    }
    const consult = await window.ScribeDB.getConsultation(state.activeConsultationId);
    if (!consult) return;

    const btn = document.getElementById('btnImproveReferral');
    const instrInput = document.getElementById('referralImproveInstruction');
    const improvementInstruction = (instrInput && instrInput.value.trim()) || '';
    const evolutionTextarea = document.getElementById('mainEvolutionEditor');
    const currentEvolutionText = (evolutionTextarea && evolutionTextarea.value.trim()) || consult.evolutionText || '';
    const extraDataInput = document.getElementById('referralExtraDataInput');
    const dadosExtrasRegulacao = extraDataInput ? extraDataInput.value.trim() : '';

    let activeSpec = consult.referralSpecialty || 'Especialidade Médica';
    if (Array.isArray(consult.referrals) && state.activeReferralId) {
      const found = consult.referrals.find(r => r.id === state.activeReferralId);
      if (found && found.specialty) activeSpec = found.specialty;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Melhorando...';
    }

    try {
      const prompt = window.buildImproveReferralPrompt({
        currentReferralText: currentRefText,
        evolucaoTexto: currentEvolutionText,
        rawTranscript: consult.rawTranscript || '',
        preTranscribedExamsText: consult.preTranscribedExamsText || '',
        quickNotes: consult.quickNotes || '',
        dadosExtrasRegulacao,
        especialidade: activeSpec,
        improvementInstruction
      });
      const requestBody = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.15, maxOutputTokens: 65536 }
      };
      const { responseJson } = await callGeminiWithFallbackAndRetry(requestBody, apiKey);
      const improvedText = cleanReferralOutputText(responseJson?.candidates?.[0]?.content?.parts?.[0]?.text || '');

      if (!improvedText || improvedText.length < 40) {
        throw new Error('A IA retornou uma resposta vazia ou muito curta.');
      }

      if (editor) editor.value = improvedText;
      if (instrInput) instrInput.value = '';
      if (Array.isArray(consult.referrals) && state.activeReferralId) {
        const idx = consult.referrals.findIndex(r => r.id === state.activeReferralId);
        if (idx >= 0) {
          consult.referrals[idx].text = improvedText;
        }
      }
      consult.referralText = improvedText;
      await window.ScribeDB.saveConsultation(consult);
      addDailyTokenUsage(responseJson?.usageMetadata?.totalTokenCount || 800);
      renderSavedReferralsForConsultation(consult);
      showToast('✨ Encaminhamento melhorado e enriquecido com sucesso!');
    } catch (err) {
      alert('Erro ao melhorar encaminhamento: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '✨ Melhorar Encaminhamento';
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
          ${refItem.protocolCondition ? `<span style="font-size: 11px; font-weight: 600; color: #7c3aed; margin-left: 6px;">[${escapeHtml(refItem.protocolCondition)}]</span>` : ''}
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
        await refreshQueueSidebar();
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

        // Repara evoluções salvas em que uma palavra comum (avaliação, conduta, plano...) no MEIO de uma frase
        // foi confundida com título de seção e separada por linhas em branco (bug de espaçamento).
        if (c.evolutionText) {
          const healedText = c.evolutionText.replace(
            /([^\n.!?:;>])[ \t]*\n{2,}[ \t]*(avaliação|conduta|plano|objetivo|subjetivo)\b/g,
            '$1 $2'
          );
          if (healedText !== c.evolutionText) {
            c.evolutionText = healedText;
            needsSave = true;
          }
        }

        // Repara evoluções já salvas que tinham subtítulos espúrios no Pré-Natal, vacinas duplicadas ou falso alerta de Tabagismo (ex: Tabagista passiva / Ex-tabagista)
        if (
          /ULTRASSONOGRAFIAS\s*\/\s*IMAGEM|-\s*LABORATORIAIS\s*:/i.test(c.evolutionText) ||
          /^#\s*(?:Tabagist[ao]\s+passiv[oa]|Ex-?tabagista|Nega\s+tabagismo)/im.test(c.evolutionText) ||
          (Array.isArray(c.auditAlerts) && c.auditAlerts.length > 0)
        ) {
          const { cleanText } = cleanAndExtractCidFromEvolution(
            c.evolutionText,
            c.cidCiapCodes,
            c.templateId,
            c.previousConsultationText || '',
            c.soapSubtypeHeader || '',
            c.patientAge || '',
            c.patientSex || '',
            c.rawTranscript || '',
            c.vdVisitDate || '',
            c.quickNotes || ''
          );
          if (cleanText !== c.evolutionText) {
            c.evolutionText = cleanText;
            needsSave = true;
          }
          if (Array.isArray(c.auditAlerts) && c.auditAlerts.length > 0) {
            const freshAlerts = getActiveAuditAlertsForEvolution(c.evolutionText, c.templateId);
            if (JSON.stringify(c.auditAlerts) !== JSON.stringify(freshAlerts)) {
              c.auditAlerts = freshAlerts;
              needsSave = true;
            }
          }
        }
        if (needsSave) {
          await window.ScribeDB.saveConsultation(c);
        }
      }
    }

    await refreshQueueSidebar();

    // Se o médico tem PIN fixo configurado, sincroniza silenciosamente atendimentos e limites de cotas da nuvem
    if (getSavedSyncPin()) {
      pullConsultationsFromCloud(true).catch(() => {});
    }

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

  async function autoRetryTransientErrors() {
    try {
      if (state.queueRunning || !getSavedApiKey()) return;
      const all = await window.ScribeDB.getAllConsultations();
      let count = 0;
      for (const c of all) {
        if (c.status !== 'error') continue;
        const msg = String(c.errorMessage || '');
        if (/Credencial de API inv/i.test(msg)) continue;
        if (!/503|429|demand|limite|limit|quota|timeout|tempo limite|network|fetch|conex|inst[áa]vel|overload|unavailable|transcrever a continua/i.test(msg)) continue;
        const tries = c.autoRetryCount || 0;
        if (tries >= 10) continue;
        // espera cresce a cada tentativa: 2, 4, 6, 8 e no máximo 10 minutos
        if (Date.now() - (c.updatedAt || 0) < 120000 * Math.min(5, tries + 1)) continue;
        c.autoRetryCount = tries + 1;
        c.status = 'queued';
        c.errorMessage = '';
        if (c.chunkCount > 0) {
          if (c.previousRawTranscript && c.previousRawTranscript.length >= 50) {
            c.previousEvolutionText = '';
          }
          c.rawTranscript = c.previousRawTranscript || '';
        }
        c.updatedAt = Date.now();
        await window.ScribeDB.saveConsultation(c);
        count++;
      }
      if (count > 0) {
        await refreshQueueSidebar();
        showToast(`🔄 Reenviando automaticamente ${count} consulta(s) que falharam por instabilidade do Google...`);
        processQueueInBackground();
      }
    } catch (_) {}
  }

  async function testSavedApiKeysValidity() {
    const out = document.getElementById('apiKeysTestResult');
    if (!out) return;
    const keys = getSavedApiKeysList();
    if (keys.length === 0) {
      out.innerHTML = '⚠️ Nenhuma chave detectada neste navegador. Cole a chave e salve.';
      return;
    }
    out.innerHTML = '⏳ Testando cada chave no Google...';
    const lines = [];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const masked = `${k.slice(0, 6)}...${k.slice(-4)}`;
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(k)}`);
        if (res.ok) {
          const d = await res.json();
          const rawList = d.models || [];
          const restAudioModels = rawList
            .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
            .map(m => (m.name || '').replace(/^models\//, ''))
            .filter(n => n && (n.includes('flash') || n.includes('hydrogen')) && !/tts|embedding|imagen|banana|image|veo|robotics|computer-use|1\.0|1\.5|2\.0|3\.7|live|native-audio-dialog|omni/i.test(n));
          const liveModels = rawList
            .filter(m => (m.supportedGenerationMethods || []).includes('bidiGenerateContent'))
            .map(m => (m.name || '').replace(/^models\//, ''))
            .filter(n => n && !/tts|translate/i.test(n));
          const gemma4Models = rawList
            .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
            .map(m => (m.name || '').replace(/^models\//, ''))
            .filter(n => n && n.includes('gemma-4'));

          lines.push(`✅ Chave ${i + 1} (${masked}): válida!`);
          lines.push(`   • Áudio + Evolução (Flash/Hydrogen): ${restAudioModels.length ? restAudioModels.join(', ') : 'nenhum encontrado'}`);
          lines.push(`   • Emergência Live (áudio): ${liveModels.length ? liveModels.join(', ') : 'nenhum'}`);
          if (gemma4Models.length) {
            lines.push(`   • Emergência Texto (Etapa 2): ${gemma4Models.join(', ')}`);
          }
        } else {
          const e = await res.json().catch(() => ({}));
          lines.push(`❌ Chave ${i + 1} (${masked}): ${e?.error?.message || 'HTTP ' + res.status}`);
        }
      } catch (err) {
        lines.push(`⚠️ Chave ${i + 1} (${masked}): falha de rede (${err.message})`);
      }
    }
    lines.push(keys.length < 2 ? '⚠️ Só 1 chave detectada neste navegador.' : `ℹ️ ${keys.length} chaves detectadas. Chaves do mesmo projeto/conta Google dividem a mesma cota e o mesmo erro 503.`);
    out.innerHTML = lines.map(l => escapeHtml(l)).join('<br>');
  }

  async function retryAllPendingConsultations() {
    const all = await window.ScribeDB.getAllConsultations();
    let count = 0;
    for (const c of all) {
      if (c.status === 'error') {
        c.status = 'queued';
        c.errorMessage = '';
        if (c.chunkCount > 0) {
          if (c.previousRawTranscript && c.previousRawTranscript.length >= 50) {
            c.previousEvolutionText = '';
          }
          c.rawTranscript = c.previousRawTranscript || '';
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

      const auditBadge = (item.auditAlerts && item.auditAlerts.length > 0)
        ? `<span class="q-status" style="background:#fee2e2;color:#991b1b;border:1px solid #ef4444;font-weight:700;" title="${escapeHtml(item.auditAlerts.join(' • '))}">⚠️ ${item.auditAlerts.length} aviso(s)</span>`
        : '';

      const refCount = (Array.isArray(item.referrals) && item.referrals.length) || (item.referralText ? 1 : 0);
      const refSummary = Array.isArray(item.referrals) && item.referrals.length > 0
        ? item.referrals.map(r => r.specialty).filter(Boolean).join(', ')
        : (item.referralSpecialty || '');
      const refBadge = refCount > 0
        ? `<span class="q-status" style="background:#f3e8ff;color:#6b21a8;border:1px solid #d8b4fe;font-weight:700;" title="Encaminhamento(s): ${escapeHtml(refSummary)}">🏛️ ${refCount === 1 ? escapeHtml(refSummary || 'Encaminhamento') : `${refCount} Encaminhamentos`}</span>`
        : '';

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
              ${auditBadge}
              ${refBadge}
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

  function updateVdPendenciesConvertButtonVisibility(evolutionText) {
    const btn = document.getElementById('btnConvertVdPendenciesToConduct');
    if (!btn) return;
    const hasPendencies = />>\s*PEND[ÊE]NCIAS[^\n]*\n([\s\S]+)$/i.test(String(evolutionText || ''));
    btn.style.display = hasPendencies ? 'inline-flex' : 'none';
  }

  // Converte um item de pendência administrativa pós-VD (no infinitivo) em frase clínica na 1ª pessoa para a CONDUTA
  function convertSingleVdPendencyLineToConduct(rawLine) {
    let l = String(rawLine || '').trim().replace(/^[-•*]\s*/, '').trim();
    if (!l || /^(?:nenhuma\s+pend[êe]ncia|sem\s+pend[êe]ncias|-)$/i.test(l)) return '';

    l = l
      .replace(/^Emitir\s+e\s+entregar\s+/i, 'Emito e entrego ')
      .replace(/^Emitir\s+/i, 'Emito ')
      .replace(/^Renovar\s+receitas?\s+(?:de\s+uso\s+cont[íi]nuo|#\s*MUC)/i, 'Renovo medicações de uso contínuo')
      .replace(/^Renovar\s+/i, 'Renovo ')
      .replace(/^Lan[çc]ar\s+solicita[çc][ãa]o\s+de\s+/i, 'Solicito ')
      .replace(/^Lan[çc]ar\s+no\s+(?:sistema|PEC|GERCON)\s+/i, 'Registro no sistema ')
      .replace(/^Lan[çc]ar\s+/i, 'Registro ')
      .replace(/^Solicitar\s+/i, 'Solicito ')
      .replace(/^Inserir\s*\/\s*encaminhar\s+/i, 'Encaminho ')
      .replace(/^Inserir\s+encaminhamento\s+/i, 'Encaminho ')
      .replace(/^Encaminhar\s+/i, 'Encaminho ')
      .replace(/^Notificar\s+/i, 'Notifico ')
      .replace(/^Agendar\s+/i, 'Agendo ')
      .replace(/^Alinhar\s*\/\s*Discutir\s+/i, 'Alinho e discuto ')
      .replace(/^Alinhar\s+/i, 'Alinho ')
      .replace(/^Discutir\s+/i, 'Discuto ')
      .replace(/^Verificar\s+/i, 'Verifico ')
      .replace(/^Prescrever\s+/i, 'Prescrevo ')
      .replace(/^Fornecer\s+/i, 'Forneço ')
      .replace(/^Orientar\s+/i, 'Oriento ')
      .replace(/^Entregar\s+/i, 'Entrego ')
      .replace(/^Cadastrar\s+/i, 'Cadastro ')
      .replace(/^Atualizar\s+/i, 'Atualizo ');

    if (!/[.!?;]$/.test(l)) {
      l += '.';
    }
    return l;
  }

  async function convertVdPendenciesToConduct() {
    const editor = document.getElementById('mainEvolutionEditor');
    if (!editor || !editor.value) return;
    const currentText = editor.value;
    const pendMatch = currentText.match(/\n*(>>\s*PEND[ÊE]NCIAS[^\n]*\n([\s\S]*))$/i);
    if (!pendMatch) {
      showToast('ℹ️ Nenhum bloco de pendências da VD encontrado nesta evolução.');
      updateVdPendenciesConvertButtonVisibility(currentText);
      return;
    }

    const beforePendencies = currentText.slice(0, pendMatch.index).trimEnd();
    const rawPendBody = pendMatch[2] || '';
    const convertedLines = rawPendBody
      .split('\n')
      .map(convertSingleVdPendencyLineToConduct)
      .filter(Boolean);

    let updatedEvolution = beforePendencies;
    if (convertedLines.length > 0) {
      // Filtra frases que já tenham equivalente idêntica na CONDUTA para não duplicar
      const existingLower = beforePendencies.toLowerCase();
      const nonDuplicateLines = convertedLines.filter(line => {
        const keySlice = line.toLowerCase().slice(0, Math.min(32, line.length - 1));
        return !existingLower.includes(keySlice);
      });
      const linesToInsert = nonDuplicateLines.length > 0 ? nonDuplicateLines : convertedLines;

      // Insere antes do fechamento "Ciente, concordante e sem dúvidas." (se existir na CONDUTA) ou ao final da CONDUTA
      const closingRe = /(\n\s*Ciente,\s*concordante\s+e\s+sem\s+d[úu]vidas\.?\s*)$/i;
      if (closingRe.test(updatedEvolution)) {
        updatedEvolution = updatedEvolution.replace(closingRe, `\n${linesToInsert.join('\n')}$1`);
      } else {
        updatedEvolution = `${updatedEvolution}\n${linesToInsert.join('\n')}`;
      }
    }

    editor.value = updatedEvolution;
    updateVdPendenciesConvertButtonVisibility(updatedEvolution);

    if (state.activeConsultationId) {
      const c = await window.ScribeDB.getConsultation(state.activeConsultationId);
      if (c) {
        c.evolutionText = updatedEvolution;
        c.soapParts = {
          subjetivo: extractSectionFromText(updatedEvolution, 'subjetivo'),
          objetivo: extractSectionFromText(updatedEvolution, 'objetivo'),
          exames: extractSectionFromText(updatedEvolution, 'exames'),
          avaliacao: extractSectionFromText(updatedEvolution, 'avaliacao'),
          conduta: extractSectionFromText(updatedEvolution, 'conduta')
        };
        await window.ScribeDB.saveConsultation(c);
        await refreshQueueSidebar();
      }
    }
    showToast('✅ Pendências pós-visita convertidas em CONDUTA realizada e bloco de pendências removido!');
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
    const srcBadge = document.getElementById('viewTranscriptionSourceBadge');
    if (srcBadge) {
      if (consult.transcriptionEngine === 'whisper-local') {
        srcBadge.style.display = 'inline-flex';
        srcBadge.textContent = `🎙️ ${consult.whisperModelUsed || 'Whisper Local'}`;
      } else if (consult.transcriptionEngine === 'gemini-cloud') {
        srcBadge.style.display = 'inline-flex';
        srcBadge.textContent = '☁️ Áudio: Gemini';
      } else {
        srcBadge.style.display = 'none';
      }
    }
    const viewDateEl = document.getElementById('viewDateLabel');
    if (viewDateEl) viewDateEl.textContent = fullDateStr;

    const btnUploadPostVdText = document.getElementById('btnUploadPostVdAudioText');
    if (btnUploadPostVdText) {
      btnUploadPostVdText.textContent = (consult.templateId === 'visita_domiciliar')
        ? '📂 + Enviar Áudio Pós-VD'
        : '📂 + Enviar Áudio Extra';
    }

    const btnRetranscribeGemini = document.getElementById('btnRetranscribeWithGemini');
    if (btnRetranscribeGemini) {
      const hasRawAudioSaved = Boolean((consult.chunkCount > 0 && !consult.audioDeleted) || consult.remoteFileUri);
      btnRetranscribeGemini.style.display = hasRawAudioSaved ? 'inline-flex' : 'none';
      if (consult.transcriptionEngine === 'whisper-local') {
        btnRetranscribeGemini.textContent = '☁️ Não gostou? Re-transcrever no Gemini';
      } else {
        btnRetranscribeGemini.textContent = '☁️ Re-transcrever no Gemini';
      }
    }

    // Sincroniza a Barra de Troca de Modelo do Histórico
    const modalTplSelect = document.getElementById('modalChangeConsultationTemplate');
    const modalSoapSubtypeWrap = document.getElementById('modalSoapSubtypeWrapper');
    const modalSoapSubtypeSelect = document.getElementById('modalChangeSoapSubtype');
    const modalInterWrap = document.getElementById('modalInterconsultaSubtypeWrapper');
    const modalInterSelect = document.getElementById('modalChangeInterconsultaSubtype');
    if (modalTplSelect) {
      modalTplSelect.value = consult.templateId || 'geral';
      if (modalSoapSubtypeWrap) {
        modalSoapSubtypeWrap.style.display = (consult.templateId === 'geral' || !consult.templateId) ? 'inline-flex' : 'none';
      }
      if (modalSoapSubtypeSelect) {
        modalSoapSubtypeSelect.value = consult.soapSubtypeHeader !== undefined ? consult.soapSubtypeHeader : '## DEMANDA ESPONTÂNEA ##';
      }
      if (modalInterWrap) {
        modalInterWrap.style.display = (consult.templateId === 'interconsulta') ? 'inline-flex' : 'none';
      }
      if (modalInterSelect) {
        modalInterSelect.value = (consult.soapSubtypeHeader && /resumid/i.test(consult.soapSubtypeHeader)) ? 'resumida' : 'completa';
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

    const btnRestoreVer = document.getElementById('btnRestorePrevVersion');
    if (btnRestoreVer) {
      btnRestoreVer.style.display = (Array.isArray(consult.evolutionBackups) && consult.evolutionBackups.length > 0) ? 'inline-flex' : 'none';
    }

    const errBanner = document.getElementById('viewErrorBanner');
    if (consult.status === 'error') {
      errBanner.style.display = 'flex';
      document.getElementById('viewErrorText').textContent = `Registro salvo no disco local. Detalhe: ${consult.errorMessage}`;
    } else {
      errBanner.style.display = 'none';
    }

    // Revalida deterministicamente alertas de auditoria da evolução aberta para eliminar qualquer falso positivo salvo anteriormente
    const activeAlerts = getActiveAuditAlertsForEvolution(consult.evolutionText, consult.templateId);
    if (consult.auditAlerts && JSON.stringify(consult.auditAlerts) !== JSON.stringify(activeAlerts)) {
      consult.auditAlerts = activeAlerts;
      window.ScribeDB.saveConsultation(consult).catch(() => {});
    }

    const auditBox = document.getElementById('auditAlertsBox');
    if (activeAlerts && activeAlerts.length > 0) {
      auditBox.style.display = 'block';
      auditBox.innerHTML = `<strong>⚠️ Revisão de Campos Obrigatórios:</strong> ${activeAlerts.map(a => `<span class="audit-tag" style="background:#fee2e2;border:1px solid #ef4444;color:#991b1b;font-weight:700;">${escapeHtml(a)}</span>`).join(' ')}`;
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
    updateVdPendenciesConvertButtonVisibility(editor.value);

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

    // Limpa completamente os campos de encaminhamento ao abrir qualquer atendimento (evita contaminação entre pacientes)
    const customSpec = document.getElementById('referralCustomSpecialty');
    if (customSpec) customSpec.value = '';

    const conditionInput = document.getElementById('referralConditionInput');
    if (conditionInput) conditionInput.value = '';

    const extraDataInput = document.getElementById('referralExtraDataInput');
    if (extraDataInput) extraDataInput.value = '';

    const refEditor = document.getElementById('referralResultEditor');
    if (refEditor) refEditor.value = '';

    const refOutBox = document.getElementById('referralOutputContainer');
    if (refOutBox) refOutBox.style.display = 'none';

    const specialtySelect = document.getElementById('referralSpecialtySelect');
    if (specialtySelect) {
      if (consult.suggestedSpecialty) {
        const cleanSug = String(consult.suggestedSpecialty).trim().toLowerCase();
        let matched = false;
        for (const opt of specialtySelect.options) {
          const optVal = opt.value.toLowerCase();
          const mainTerm = optVal.split('/')[0].trim();
          if (optVal === cleanSug || optVal.includes(cleanSug) || (mainTerm.length >= 4 && cleanSug.includes(mainTerm))) {
            specialtySelect.value = opt.value;
            matched = true;
            break;
          }
        }
        if (!matched && customSpec) {
          customSpec.value = consult.suggestedSpecialty.trim();
        }
      } else {
        specialtySelect.selectedIndex = 0;
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
      const years = document.getElementById('zYears')?.value;
      const months = document.getElementById('zMonths')?.value;
      const birthGA = document.getElementById('zBirthGA')?.value;
      const weight = document.getElementById('zWeight')?.value;
      const height = document.getElementById('zHeight')?.value;
      const hc = document.getElementById('zHC')?.value;
      const includeZ = document.getElementById('chkIncludeZScoreInEvolution')?.checked;
      const feedingType = document.getElementById('pueriFeedingType')?.value || '';
      const formulaDetails = document.getElementById('pueriFormulaDetails')?.value.trim() || '';

      const ageInfo = window.ZScoreCalculator?.computeAgeInfo
        ? window.ZScoreCalculator.computeAgeInfo({ years, months, birthGAWeeks: birthGA })
        : null;

      const lines = [];
      if (ageInfo) {
        const gaNote = ageInfo.gaRaw ? ` (IG ao nascer: ${ageInfo.gaRaw} sem)` : '';
        lines.push(`Idade da criança: ${ageInfo.chronologicalLabel}${gaNote}`);
        if (ageInfo.needsCorrection) {
          lines.push(`Idade Corrigida OMS (Prematuro ${ageInfo.gaRaw} sem): ${ageInfo.correctedLabel}`);
        }
      }
      if (feedingType || formulaDetails) {
        lines.push(`Alimentação Infantil (incluir apenas no SUBJETIVO): ${feedingType}${formulaDetails ? ' — Detalhes (fórmula/volume/frequência): ' + formulaDetails : ''}`);
      }

      const hasAnyMeasure = Boolean(weight || height || hc);
      if (ageInfo && hasAnyMeasure && (includeZ || forcePreview)) {
        const calc = window.ZScoreCalculator.calculate({
          sex,
          years,
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
        if (weight) lines.push(`Peso: ${weight}`);
        if (height) lines.push(`Altura/Comprimento: ${height} cm`);
        if (hc) lines.push(`PC: ${hc} cm`);
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
    ['zYears', 'zMonths', 'zBirthGA', 'zWeight', 'zHeight', 'zHC', 'pueriFeedingType', 'pueriFormulaDetails', 'pnDUM', 'pnUsgDate', 'pnUsgWeeks', 'pnUsgDays', 'pnIG', 'pnPA', 'pnWeight', 'pnAU', 'pnBCF'].forEach(id => {
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
    if (chkZ) chkZ.checked = true;
    updateZScoreLivePreview();
    updatePrenatalLivePreview();
    updateQuickNotesExamBadge();
  }

  function getSavedApiKeysList(preferredKey) {
    const mainRaw = String(localStorage.getItem('ubs_gemini_api_key') || sessionStorage.getItem('ubs_gemini_api_key') || '').trim();
    const secondRaw = String(localStorage.getItem('ubs_second_api_key') || sessionStorage.getItem('ubs_second_api_key') || '').trim();
    const extraRaw = String(localStorage.getItem('ubs_extra_api_keys') || sessionStorage.getItem('ubs_extra_api_keys') || '').trim();
    const domMain = document.getElementById('apiKeyInput')?.value?.trim() || '';
    const domSecond = document.getElementById('secondApiKeyInput')?.value?.trim() || '';
    const domExtra = document.getElementById('extraApiKeysInput')?.value?.trim() || '';
    const combined = `${mainRaw}\n${secondRaw}\n${extraRaw}\n${domMain}\n${domSecond}\n${domExtra}`;
    // Aceita chaves padrão AIza... e novas chaves Google AQ.... (que contêm ponto ".")
    const keyMatches = combined.match(/(?:AIza[0-9A-Za-z_-]{20,}|AQ\.[0-9A-Za-z._-]{20,})/g) || [];
    const tokenMatches = combined
      .split(/[\s,;]+/)
      .map(s => s.replace(/^['"]|['"]$/g, '').trim())
      .filter(s => s.length >= 25 && /^[A-Za-z0-9._-]+$/.test(s));
    let allKeys = [...new Set([...keyMatches, ...tokenMatches])];
    if (allKeys.length === 0 && mainRaw) {
      allKeys = [mainRaw];
    }
    if (preferredKey && typeof preferredKey === 'string') {
      const prefMatches = preferredKey.match(/(?:AIza[0-9A-Za-z_-]{20,}|AQ\.[0-9A-Za-z._-]{20,})/g) || [preferredKey.trim()];
      for (const pk of prefMatches.reverse()) {
        if (pk) allKeys = [pk, ...allKeys.filter(k => k !== pk)];
      }
    }
    return allKeys;
  }

  function getSavedApiKey() {
    const list = getSavedApiKeysList();
    return list[0] || '';
  }

  // Integração oficial com o Gerenciador de Senhas do Google Chrome (Credential Management API)
  async function tryRestoreApiKeyFromChromeCredentialManager() {
    if (localStorage.getItem('ubs_gemini_api_key') || sessionStorage.getItem('ubs_gemini_api_key')) return;
    try {
      if (navigator.credentials && navigator.credentials.get && window.PasswordCredential) {
        const cred = await navigator.credentials.get({ password: true, mediation: 'optional' });
        if (cred && cred.password && (cred.password.startsWith('AIza') || cred.password.startsWith('AQ.'))) {
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

  // Salva plantão e cotas de API na nuvem com criptografia E2EE (AES-256) dividida em chunks seguros de 3000 chars
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
      statusEl.textContent = '🔒 Criptografando atendimentos e limites de API com seu PIN...';
    }

    try {
      const all = await window.ScribeDB.getAllConsultations();
      const recent = all.slice(0, 50);
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
          vdVisitDate: c.vdVisitDate || '',
          patientAge: c.patientAge || '',
          patientSex: c.patientSex || '',
          transcriptionEngine: c.transcriptionEngine || '',
          whisperModelUsed: c.whisperModelUsed || '',
          referrals: c.referrals || c.savedReferrals || [],
          savedReferrals: c.referrals || c.savedReferrals || [],
          referralText: c.referralText || '',
          referralSpecialty: c.referralSpecialty || '',
          evolvedInPEC: Boolean(c.evolvedInPEC),
          evolvedAt: c.evolvedAt || null
        };
        syncItems.push(copy);
      }

      // Prepara mapa de cotas e limites do dia para sincronizar entre Posto e Casa
      const currentQuotaMap = loadTodayPerKeyQuotaMap();
      const keysList = getSavedApiKeysList();
      const currentExhaustedMap = {};
      for (const k of keysList) {
        const kh = getKeyShortHash(k);
        currentExhaustedMap[kh] = getExhaustedModelsForToday(k);
      }

      const payloadRaw = JSON.stringify({
        syncVersion: 3,
        syncedAt: Date.now(),
        todayDate: new Date().toISOString().slice(0, 10),
        todayQuotaMap: currentQuotaMap,
        todayExhaustedMap: currentExhaustedMap,
        consultations: syncItems
      });

      // Criptografia AES-256 de ponta a ponta com o PIN fixo do médico
      const encryptedData = await encryptWithPin(payloadRaw, pin);
      const topic = await getTopicForPin(pin);

      // Divide em chunks de no máximo 3000 caracteres para respeitar o limite de 4096 bytes do ntfy.sh
      // Isso garante retenção completa por 12 HORAS sem expirar em 3h e sem erro 413 Payload Too Large!
      const CHUNK_SIZE = 3000;
      const syncBatchId = 'sync_' + Date.now();
      const totalChunks = Math.ceil(encryptedData.length / CHUNK_SIZE) || 1;

      for (let i = 0; i < totalChunks; i++) {
        const chunkText = encryptedData.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const msgBody = JSON.stringify({
          syncBatchId,
          part: i + 1,
          total: totalChunks,
          chunk: chunkText
        });

        const res = await fetch(`https://ntfy.sh/${topic}`, {
          method: 'POST',
          headers: {
            'Title': `Plantao Part ${i + 1}/${totalChunks}`,
            'Priority': 'low',
            'Tags': 'hospital'
          },
          body: msgBody
        });

        if (!res.ok) {
          throw new Error(`Servidor de sincronização retornou status ${res.status} na parte ${i + 1}`);
        }
      }

      const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      if (!silent) {
        if (statusEl) {
          statusEl.innerHTML = `✅ <strong>${syncItems.length} atendimento(s) e limites da API salvos na nuvem às ${timeStr}!</strong><br>No outro computador, basta abrir o sistema com seu PIN para sincronizar automaticamente.`;
        }
        showToast(`☁️ Plantão (${syncItems.length} atendimentos + limites API) sincronizado na nuvem!`);
      }
    } catch (err) {
      if (!silent && statusEl) {
        statusEl.textContent = `⚠️ Erro ao salvar na nuvem: ${err.message}. Você também pode usar a Opção 2 (Baixar Arquivo) abaixo.`;
      }
    }
  }

  async function pullConsultationsFromCloud(silent = false) {
    const pinInput = document.getElementById('syncFixedPinInput');
    let pin = (pinInput?.value || '').trim() || getSavedSyncPin();
    const statusEl = document.getElementById('cloudSyncStatusText');

    if (!pin) {
      if (!silent) {
        if (statusEl) {
          statusEl.innerHTML = '⚠️ <strong>Digite seu PIN Fixo no campo acima</strong> (o mesmo que você usou no Posto).';
        }
        pinInput?.focus();
      }
      return;
    }
    setSavedSyncPin(pin);

    if (!silent && statusEl) {
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
        if (!silent && statusEl) {
          statusEl.textContent = 'ℹ️ Nenhum plantão recente encontrado para este PIN. No computador do posto, clique em "Salvar Plantão no Posto" antes de sair.';
        }
        return;
      }

      // Agrupa mensagens por syncBatchId
      const batches = {};
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          if (obj.event === 'message' && obj.message) {
            try {
              const msgData = JSON.parse(obj.message);
              if (msgData.syncBatchId && msgData.chunk && msgData.part && msgData.total) {
                if (!batches[msgData.syncBatchId]) {
                  batches[msgData.syncBatchId] = {
                    total: msgData.total,
                    parts: {}
                  };
                }
                batches[msgData.syncBatchId].parts[msgData.part] = msgData.chunk;
              }
            } catch (_) {
              // Formato antigo legacy (não-chunked)
              if (obj.message.length > 50 && !batches['legacy']) {
                batches['legacy'] = { total: 1, parts: { 1: obj.message } };
              }
            }
          }
        } catch (_) {}
      }

      // Encontra o batch mais recente completo
      const batchIds = Object.keys(batches).sort().reverse();
      let chosenBatch = null;
      for (const bid of batchIds) {
        const b = batches[bid];
        const partsCount = Object.keys(b.parts).length;
        if (partsCount === b.total) {
          chosenBatch = b;
          break;
        }
      }

      if (!chosenBatch) {
        if (!silent && statusEl) {
          statusEl.textContent = 'ℹ️ Nenhum pacote completo de plantão encontrado no servidor. Tente reenviar do Posto.';
        }
        return;
      }

      // Remonta os chunks em ordem
      let fullEncrypted = '';
      for (let p = 1; p <= chosenBatch.total; p++) {
        fullEncrypted += (chosenBatch.parts[p] || '');
      }

      if (!fullEncrypted) {
        throw new Error('Conteúdo vazio recebido do servidor.');
      }

      if (!silent && statusEl) statusEl.textContent = '🔓 Descriptografando atendimentos com seu PIN...';
      let decryptedRaw = '';
      try {
        decryptedRaw = await decryptWithPin(fullEncrypted, pin);
      } catch (decErr) {
        throw new Error('PIN incorreto ou dados corrompidos. Verifique se o PIN digitado é exatamente o mesmo cadastrado no Posto.');
      }

      const parsed = JSON.parse(decryptedRaw);
      const remoteList = Array.isArray(parsed.consultations) ? parsed.consultations : [];

      // 1. Sincroniza e importa Atendimentos
      let importedCount = 0;
      for (const item of remoteList) {
        if (!item || !item.id) continue;
        const local = await window.ScribeDB.getConsultation(item.id);
        if (!local || (item.updatedAt || 0) > (local.updatedAt || 0) || (!local.evolutionText && item.evolutionText)) {
          await window.ScribeDB.saveConsultation({
            ...(local || {}),
            ...item
          });
          importedCount++;
        }
      }

      // 2. Sincroniza e mescla os LIMITES E COTAS DA API USADOS NO POSTO HOJE!
      if (parsed.todayQuotaMap && typeof parsed.todayQuotaMap === 'object') {
        const localQuota = loadTodayPerKeyQuotaMap();
        const mergedQuota = { ...localQuota };
        for (const [kHash, cloudStats] of Object.entries(parsed.todayQuotaMap)) {
          if (!mergedQuota[kHash]) {
            mergedQuota[kHash] = cloudStats;
          } else {
            mergedQuota[kHash].totalRequests = Math.max(mergedQuota[kHash].totalRequests || 0, cloudStats.totalRequests || 0);
            mergedQuota[kHash].totalTokens = Math.max(mergedQuota[kHash].totalTokens || 0, cloudStats.totalTokens || 0);
            mergedQuota[kHash].lastModel = cloudStats.lastModel || mergedQuota[kHash].lastModel;
            mergedQuota[kHash].updatedAt = Math.max(mergedQuota[kHash].updatedAt || 0, cloudStats.updatedAt || 0);
            mergedQuota[kHash].byModel = mergedQuota[kHash].byModel || {};
            if (cloudStats.byModel) {
              for (const [mName, mStats] of Object.entries(cloudStats.byModel)) {
                if (!mergedQuota[kHash].byModel[mName]) {
                  mergedQuota[kHash].byModel[mName] = mStats;
                } else {
                  mergedQuota[kHash].byModel[mName].requests = Math.max(mergedQuota[kHash].byModel[mName].requests || 0, mStats.requests || 0);
                  mergedQuota[kHash].byModel[mName].tokens = Math.max(mergedQuota[kHash].byModel[mName].tokens || 0, mStats.tokens || 0);
                }
              }
            }
          }
        }
        saveTodayPerKeyQuotaMap(mergedQuota);
      }

      // 3. Sincroniza modelos que bateram 429 no Posto
      if (parsed.todayExhaustedMap) {
        const keys = getSavedApiKeysList();
        for (const [kHash, models] of Object.entries(parsed.todayExhaustedMap)) {
          if (Array.isArray(models)) {
            for (const k of keys) {
              if (getKeyShortHash(k) === kHash) {
                for (const m of models) {
                  markModelExhaustedForToday(m, k);
                }
              }
            }
          }
        }
      }

      await refreshQueueSidebar();
      updateStorageStatsUI();
      renderApiKeysQuotaDashboard();
      updateTokenMonitorUI();

      if (!silent) {
        if (statusEl) {
          statusEl.innerHTML = `✅ <strong>${remoteList.length} atendimento(s) e cotas de API sincronizados com sucesso (${importedCount} novos/atualizados)!</strong><br>Disponíveis agora no seu <em>"Meu Histórico"</em> para evoluir no PEC.`;
        }
        showToast(`📥 ${remoteList.length} atendimento(s) e cotas de API puxados da nuvem!`);
        switchMainPage('pageHistory');
      }
      processQueueInBackground();
    } catch (err) {
      if (!silent && statusEl) {
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
    const keys = getSavedApiKeysList();
    const btn = document.getElementById('btnOpenApiKeyModal');
    if (!btn) return;
    if (keys.length > 0) {
      btn.innerHTML = keys.length > 1
        ? `🔒 ${keys.length} Chaves Ativas`
        : `🔒 1 Chave Ativa`;
      btn.classList.add('key-ok');
    } else {
      btn.innerHTML = `🔑 Credencial API`;
      btn.classList.remove('key-ok');
    }
  }

  function renderApiKeysQuotaDashboard() {
    const container = document.getElementById('apiKeysQuotaDashboard');
    if (!container) return;

    const keys = getSavedApiKeysList();
    const quotaMap = loadTodayPerKeyQuotaMap();
    const pref = localStorage.getItem('ubs_preferred_model') || 'auto';

    if (keys.length === 0) {
      container.innerHTML = `
        <div style="padding:12px; border-radius:8px; background:#fef2f2; border:1px solid #fecaca; color:#991b1b; font-size:0.82rem;">
          ⚠️ <strong>Nenhuma Chave API cadastrada.</strong> Insira sua chave abaixo para visualizar os limites diários (usado vs. disponível) de cada chave e modelo.
        </div>
      `;
      return;
    }

    // Cálculo global somando todas as chaves configuradas
    let globalAllModelsLimit = 0;
    let globalAllModelsUsed = 0;
    let globalAllModelsAvail = 0;
    let globalRequestsTrackedToday = 0;
    let globalTokensTrackedToday = 0;

    const keyCardsHtml = keys.map((apiKey, idx) => {
      const kHash = getKeyShortHash(apiKey);
      const maskedKey = `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`;
      const keyStats = quotaMap[kHash] || { totalRequests: 0, totalTokens: 0, lastModel: '', byModel: {} };
      const exhaustedList = getExhaustedModelsForToday(apiKey).map(normalizeModelForQuota);
      const disabledList = getDisabledModelsForKey(apiKey).map(normalizeModelForQuota);
      const workingModel = normalizeModelForQuota(localStorage.getItem('ubs_working_model_' + kHash) || '');

      globalRequestsTrackedToday += (keyStats.totalRequests || 0);
      globalTokensTrackedToday += (keyStats.totalTokens || 0);

      let keyTotalLimit = 0;
      let keyTotalUsedEffective = 0;
      let keyTotalAvail = 0;
      let availableModelsCount = 0;

      const rowsHtml = MODEL_QUOTA_CATALOG.map(m => {
        const isDisabled = disabledList.includes(m.id);
        const isExhausted = exhaustedList.includes(m.id);
        const usedReqs = keyStats.byModel?.[m.id]?.requests || 0;
        const limit = m.dailyLimit;

        let avail = 0;
        let effectiveUsed = usedReqs;
        if (!isDisabled) {
          keyTotalLimit += limit;
          if (isExhausted) {
            avail = 0;
            effectiveUsed = Math.max(usedReqs, limit);
          } else {
            avail = Math.max(0, limit - usedReqs);
            if (avail > 0) availableModelsCount += 1;
          }
          keyTotalUsedEffective += Math.min(limit, effectiveUsed);
          keyTotalAvail += avail;
        }

        let statusBadge = '';
        if (isDisabled) {
          statusBadge = `<span style="color:#64748b; font-weight:600;">⚪ Indisponível na conta</span>`;
        } else if (isExhausted || avail === 0) {
          statusBadge = `<span style="color:#dc2626; font-weight:700;">🔴 Esgotado Hoje (0 disp.)</span>`;
        } else if (usedReqs > 0) {
          statusBadge = `<span style="color:#0284c7; font-weight:700;">🟢 Em uso (${avail} disp.)</span>`;
        } else {
          statusBadge = `<span style="color:#16a34a; font-weight:600;">🟢 100% Disponível</span>`;
        }

        const isActiveHighlight = (pref !== 'auto' && normalizeModelForQuota(pref) === m.id) || (pref === 'auto' && workingModel === m.id);

        return `
          <tr style="border-bottom:1px solid #e2e8f0; ${isActiveHighlight ? 'background:#eff6ff;' : ''}">
            <td style="padding:5px 6px; font-weight:${isActiveHighlight ? '700' : '500'}; color:#1e293b;">
              ${m.label} ${isActiveHighlight ? '<span style="font-size:0.68rem; background:#dbeafe; color:#1d4ed8; padding:1px 5px; border-radius:4px; margin-left:4px;">Em uso</span>' : ''}
            </td>
            <td style="padding:5px 6px; text-align:center; color:#475569; font-weight:600;">${limit}/dia</td>
            <td style="padding:5px 6px; text-align:center; color:${usedReqs > 0 || isExhausted ? '#0f172a' : '#94a3b8'}; font-weight:700;">
              ${isExhausted && usedReqs === 0 ? `${limit} (429)` : usedReqs}
            </td>
            <td style="padding:5px 6px; text-align:center; font-weight:800; color:${avail > 0 ? '#15803d' : '#dc2626'};">
              ${isDisabled ? '—' : avail}
            </td>
            <td style="padding:5px 6px; text-align:right; font-size:0.74rem;">${statusBadge}</td>
          </tr>
        `;
      }).join('');

      globalAllModelsLimit += keyTotalLimit;
      globalAllModelsUsed += keyTotalUsedEffective;
      globalAllModelsAvail += keyTotalAvail;

      const pctUsed = keyTotalLimit > 0 ? Math.min(100, Math.round((keyTotalUsedEffective / keyTotalLimit) * 100)) : 0;
      const pctAvail = Math.max(0, 100 - pctUsed);
      const barColor = availableModelsCount === 0
        ? '#dc2626'
        : (pctUsed >= 75 ? '#f59e0b' : '#16a34a');

      const keyStatusPill = availableModelsCount === 0
        ? `<span style="background:#fef2f2; color:#dc2626; border:1px solid #fecaca; padding:2px 8px; border-radius:999px; font-size:0.73rem; font-weight:700;">🔴 Limite Diário Atingido</span>`
        : (keyStats.totalRequests > 0 || exhaustedList.length > 0
          ? `<span style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; padding:2px 8px; border-radius:999px; font-size:0.73rem; font-weight:700;">🟢 Ativa • ${keyTotalAvail} req. disponíveis</span>`
          : `<span style="background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; padding:2px 8px; border-radius:999px; font-size:0.73rem; font-weight:700;">🟢 100% Livre (${keyTotalAvail} disp.)</span>`);

      return `
        <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:8px; padding:10px 12px; margin-bottom:10px; box-shadow:0 1px 2px rgba(0,0,0,0.03);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:6px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-weight:800; font-size:0.84rem; color:#0f172a;">🔑 Chave #${idx + 1}</span>
              <code style="background:#f1f5f9; color:#334155; padding:2px 6px; border-radius:4px; font-size:0.76rem; border:1px solid #e2e8f0;">${maskedKey}</code>
              ${idx === 0 ? '<span style="font-size:0.68rem; color:#0369a1; background:#e0f2fe; padding:1px 6px; border-radius:4px; font-weight:600;">Principal</span>' : '<span style="font-size:0.68rem; color:#6d28d9; background:#ede9fe; padding:1px 6px; border-radius:4px; font-weight:600;">Reserva Automática</span>'}
            </div>
            <div>${keyStatusPill}</div>
          </div>

          <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#475569; margin-bottom:4px;">
            <span>Usado nesta chave hoje: <strong>${keyStats.totalRequests || 0} chamadas</strong> (${(keyStats.totalTokens || 0).toLocaleString('pt-BR')} tokens)</span>
            <span>Capacidade restante na chave: <strong style="color:#15803d;">${keyTotalAvail}</strong> de <strong>${keyTotalLimit}</strong> req/dia (${pctAvail}% livre)</span>
          </div>

          <div style="width:100%; height:7px; background:#e2e8f0; border-radius:999px; overflow:hidden; margin-bottom:8px;">
            <div style="width:${pctUsed}%; height:100%; background:${barColor}; transition:width 0.3s ease;"></div>
          </div>

          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.76rem;">
              <thead>
                <tr style="background:#f8fafc; border-bottom:1px solid #cbd5e1; color:#475569;">
                  <th style="padding:4px 6px; text-align:left;">Modelo de Áudio/Texto</th>
                  <th style="padding:4px 6px; text-align:center;">Limite/Dia</th>
                  <th style="padding:4px 6px; text-align:center;">Usado Hoje</th>
                  <th style="padding:4px 6px; text-align:center;">Disponível</th>
                  <th style="padding:4px 6px; text-align:right;">Status Hoje</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');

    const topSummary = getAggregatedQuotaSummaryForTopbar();
    const activeModelLabel = formatModelName(topSummary.targetModel);

    container.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(145px, 1fr)); gap:8px; margin-bottom:10px;">
        <div style="background:#ffffff; border:1px solid #bae6fd; border-radius:8px; padding:8px 10px;">
          <div style="font-size:0.7rem; color:#0369a1; font-weight:700; text-transform:uppercase;">Chaves Configuradas</div>
          <div style="font-size:1.05rem; font-weight:800; color:#0f172a; margin-top:2px;">🔑 ${keys.length} ${keys.length === 1 ? 'Chave' : 'Chaves'}</div>
          <div style="font-size:0.71rem; color:#64748b;">Rotação automática ativa</div>
        </div>
        <div style="background:#ffffff; border:1px solid #bbf7d0; border-radius:8px; padding:8px 10px;">
          <div style="font-size:0.7rem; color:#15803d; font-weight:700; text-transform:uppercase;">Modelo Ativo (${activeModelLabel})</div>
          <div style="font-size:1.05rem; font-weight:800; color:#15803d; margin-top:2px;">🟢 ${topSummary.totalAvail} disp. / ${topSummary.totalLimit}</div>
          <div style="font-size:0.71rem; color:#64748b;">Usado hoje: <strong>${topSummary.totalUsed}</strong> req.</div>
        </div>
        <div style="background:#ffffff; border:1px solid #ddd6fe; border-radius:8px; padding:8px 10px;">
          <div style="font-size:0.7rem; color:#6d28d9; font-weight:700; text-transform:uppercase;">Soma Todos os Modelos</div>
          <div style="font-size:1.05rem; font-weight:800; color:#4c1d95; margin-top:2px;">⚡ ${globalAllModelsAvail} disponíveis</div>
          <div style="font-size:0.71rem; color:#64748b;">De ${globalAllModelsLimit} req/dia totais</div>
        </div>
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px;">
          <div style="font-size:0.7rem; color:#475569; font-weight:700; text-transform:uppercase;">Consumo Hoje</div>
          <div style="font-size:1.05rem; font-weight:800; color:#0f172a; margin-top:2px;">📊 ${state.dailyConsultationsProcessed} atend.</div>
          <div style="font-size:0.71rem; color:#64748b;">${globalRequestsTrackedToday} chamadas (${(state.dailyTokensUsed || globalTokensTrackedToday).toLocaleString('pt-BR')} tok)</div>
        </div>
      </div>
      ${keyCardsHtml}
    `;
  }

  async function probeAllKeysLiveQuota() {
    const keys = getSavedApiKeysList();
    if (keys.length === 0) {
      showToast('⚠️ Cadastre e salve pelo menos uma Chave API primeiro.');
      return;
    }

    const btn = document.getElementById('btnProbeKeysQuota');
    const origText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Verificando no Google...';
    }

    const modelsToProbe = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-4-hydrogen', 'gemini-2.5-flash', 'gemini-3-flash'];

    const syncDiscoveredModelsToSelect = (modelsList) => {
      const sel = document.getElementById('preferredModelSelect');
      if (!sel || !Array.isArray(modelsList)) return;
      const existingValues = new Set(Array.from(sel.options).map(o => o.value));
      const newOnes = modelsList
        .filter(m => {
          const methods = Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
          if (!methods.includes('generateContent')) return false;
          const n = String(m.name || '').replace(/^models\//, '').trim();
          if (!n || existingValues.has(n) || !n.startsWith('gemini-')) return false;
          if (/tts|embedding|imagen|banana|image|veo|robotics|computer-use|live|native-audio-dialog|gemma|1\.0|1\.5|2\.0|3\.7/i.test(n)) return false;
          return true;
        })
        .map(m => String(m.name || '').replace(/^models\//, '').trim());
      for (const modelId of newOnes) {
        const opt = document.createElement('option');
        opt.value = modelId;
        opt.textContent = `🆕 ${formatModelName(modelId)} (Descoberto na API)`;
        sel.appendChild(opt);
        existingValues.add(modelId);
      }
    };

    try {
      for (let kIdx = 0; kIdx < keys.length; kIdx++) {
        const apiKey = keys[kIdx];
        const kHash = getKeyShortHash(apiKey);
        if (btn) {
          btn.innerHTML = `⏳ Testando Chave #${kIdx + 1}/${keys.length}...`;
        }

        // 1. Verifica na listagem de modelos quais existem nessa conta
        let availableSet = null;
        try {
          const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
          if (listResp.ok) {
            const listData = await listResp.json();
            if (Array.isArray(listData.models)) {
              syncDiscoveredModelsToSelect(listData.models);
              availableSet = new Set(
                listData.models
                  .filter(m => !Array.isArray(m.supportedGenerationMethods) || m.supportedGenerationMethods.includes('generateContent'))
                  .map(m => normalizeModelForQuota(m.name))
              );
            }
          }
        } catch (_) {}

        // 2. Faz um ping ultraleve (1 token) nos modelos principais para detectar se já bateu 429 fora deste navegador
        for (const modelId of modelsToProbe) {
          if (availableSet && !availableSet.has(modelId) && !(modelId === 'gemini-3-flash' && availableSet.has('gemini-3-flash-preview'))) {
            continue;
          }
          const endpointModel = (modelId === 'gemini-3-flash' && availableSet && availableSet.has('gemini-3-flash-preview') && !availableSet.has('gemini-3-flash'))
            ? 'gemini-3-flash-preview'
            : modelId;

          try {
            const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${endpointModel}:generateContent?key=${encodeURIComponent(apiKey)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: 'ok' }] }],
                generationConfig: { maxOutputTokens: 1 }
              })
            });

            if (resp.ok) {
              // Se respondeu 200 OK, garante que não está marcado como esgotado indevidamente
              const storageKey = getDailyExhaustedModelsKey(apiKey);
              const currentExhausted = getExhaustedModelsForToday(apiKey).filter(
                m => normalizeModelForQuota(m) !== modelId
              );
              localStorage.setItem(storageKey, JSON.stringify(currentExhausted));
              recordKeyModelUsage(apiKey, modelId, 2);
            } else if (resp.status === 429) {
              const errJson = await resp.json().catch(() => ({}));
              const errMsg = errJson?.error?.message || '';
              if (/PerDay|daily|quota|exhausted/i.test(errMsg)) {
                markModelExhaustedForToday(modelId, apiKey);
              }
            } else if (resp.status === 404) {
              markModelDisabledForKey(modelId, apiKey);
            }
          } catch (_) {}
        }

        delete cachedDiscoveredModelsByKey[kHash];
      }

      updateTokenMonitorUI();
      renderApiKeysQuotaDashboard();
      showToast('✅ Saldo das chaves verificado em tempo real no Google!');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origText || '🔍 Verificar Saldo Real no Google';
      }
    }
  }

  function resetTodayQuotaStats() {
    if (!confirm('Deseja zerar os contadores locais de uso de hoje e limpar bloqueios 429 temporários das chaves?')) return;
    const keys = getSavedApiKeysList();
    for (const k of keys) {
      localStorage.removeItem(getDailyExhaustedModelsKey(k));
      localStorage.removeItem('ubs_disabled_models_' + getKeyShortHash(k));
    }
    localStorage.removeItem(getTodayPerKeyQuotaStorageKey());
    localStorage.removeItem(getTodayKey());
    state.dailyTokensUsed = 0;
    state.dailyConsultationsProcessed = 0;
    updateTokenMonitorUI();
    renderApiKeysQuotaDashboard();
    showToast('🔄 Mostrador de cotas de hoje reiniciado!');
  }

  function openApiKeyModal() {
    const modal = document.getElementById('apiKeyModal');
    const all = getSavedApiKeysList();
    const mainKey = String(localStorage.getItem('ubs_gemini_api_key') || sessionStorage.getItem('ubs_gemini_api_key') || all[0] || '').trim();
    const secondKey = String(localStorage.getItem('ubs_second_api_key') || sessionStorage.getItem('ubs_second_api_key') || all[1] || '').trim();
    const extraKeys = String(localStorage.getItem('ubs_extra_api_keys') || sessionStorage.getItem('ubs_extra_api_keys') || '').trim();
    const input = document.getElementById('apiKeyInput');
    const secondInput = document.getElementById('secondApiKeyInput');
    const extraInput = document.getElementById('extraApiKeysInput');
    if (input) input.value = mainKey;
    if (secondInput) secondInput.value = (secondKey && secondKey !== mainKey) ? secondKey : (all[1] || '');
    if (extraInput) {
      const remaining = all.filter(k => k !== mainKey && k !== secondKey);
      extraInput.value = remaining.join('\n') || (extraKeys !== secondKey ? extraKeys : '');
    }
    const sel = document.getElementById('preferredModelSelect');
    if (sel) sel.value = localStorage.getItem('ubs_preferred_model') || 'auto';
    updateWhisperModeUI();
    checkWhisperCapabilitiesUI();
    renderApiKeysQuotaDashboard();
    if (modal) modal.style.display = 'flex';
  }

  function bindUIEvents() {
    document.getElementById('btnStartRec')?.addEventListener('click', startRecording);
    document.getElementById('btnPauseRec')?.addEventListener('click', togglePauseRecording);
    document.getElementById('btnStopRec')?.addEventListener('click', finishRecordingAndQueue);
    document.getElementById('btnCancelRec')?.addEventListener('click', cancelCurrentRecording);
    document.getElementById('btnClearAllSheetTop')?.addEventListener('click', clearAllCurrentSheet);
    document.getElementById('btnClearAllSheetBottom')?.addEventListener('click', clearAllCurrentSheet);
    document.getElementById('patientAgeInput')?.addEventListener('input', refreshLiveExamCalculationsFromInputs);
    document.getElementById('patientAgeInput')?.addEventListener('change', refreshLiveExamCalculationsFromInputs);
    document.getElementById('patientSexSelect')?.addEventListener('change', refreshLiveExamCalculationsFromInputs);
    document.getElementById('btnClearVdDate')?.addEventListener('click', () => {
      const vdDateEl = document.getElementById('vdVisitDateInput');
      if (vdDateEl) vdDateEl.value = '';
    });
    document.getElementById('btnStartExternalAudioTranscription')?.addEventListener('click', startStagedExternalAudioTranscription);
    document.getElementById('btnClearExternalAudio')?.addEventListener('click', () => {
      state.pendingAudioFiles = [];
      renderPendingExternalAudioUI();
      showToast('🗑️ Áudio externo removido da folha.');
    });
    document.querySelectorAll('input[name="soapVisitSubtype"]').forEach(radio => {
      radio.addEventListener('change', async () => {
        const chosenHeader = getSelectedSoapSubtypeHeader();
        if (state.isRecording && state.recordingConsultationId) {
          const existing = await window.ScribeDB.getConsultation(state.recordingConsultationId);
          if (existing) {
            existing.soapSubtypeHeader = chosenHeader;
            await window.ScribeDB.saveConsultation(existing);
          }
        }
      });
    });
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

    // Proteção global contra comportamento padrão do navegador ao arrastar arquivos:
    // No Chrome/Edge/Safari (Windows e Mac), soltar um PDF/arquivo fora ou sobre elementos-filhos
    // da zona de drop faz o navegador navegar e abrir o PDF em uma nova guia!
    // Ouvir dragover/drop em window/document com preventDefault() e capturar os arquivos resolve definitivamente!
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, false);

    window.addEventListener('drop', (e) => {
      // Se soltar em qualquer lugar que não foi tratado especificamente, cancela para não abrir nova guia
      e.preventDefault();
      e.stopPropagation();
    }, false);

    const routeDroppedFiles = (filesList) => {
      if (!filesList || filesList.length === 0) return;
      const allFiles = Array.from(filesList);
      const isExam = (f) => {
        const type = (f.type || '').toLowerCase();
        const name = (f.name || '').toLowerCase();
        return type === 'application/pdf' || type.startsWith('image/') || /\.pdf$/i.test(name) || /\.(png|jpe?g|webp|bmp|gif)$/i.test(name);
      };
      const examDocs = allFiles.filter(isExam);
      const audioDocs = allFiles.filter(f => !isExam(f));

      if (examDocs.length > 0) {
        addExamFilesToCurrentSession(examDocs);
      }
      if (audioDocs.length > 0) {
        handleExternalAudioUpload(audioDocs);
      }
    };

    // Anexo Discreto de PDFs / Imagens de Exames (Botão, Drag-and-Drop e Ctrl+V global!)
    document.getElementById('examFilesInput')?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        addExamFilesToCurrentSession(e.target.files);
        e.target.value = '';
      }
    });

    const examDropZone = document.getElementById('examDropZone');
    if (examDropZone) {
      examDropZone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        examDropZone.classList.add('drag-active');
      });
      examDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        examDropZone.classList.add('drag-active');
      });
      examDropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Só remove se o mouse realmente saiu da caixa de exames
        if (!examDropZone.contains(e.relatedTarget)) {
          examDropZone.classList.remove('drag-active');
        }
      });
      examDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        examDropZone.classList.remove('drag-active');
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length > 0) {
          routeDroppedFiles(dt.files);
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

    // Upload de Áudio (WhatsApp / iPhone 14 / VD)
    document.getElementById('audioFileInput')?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleExternalAudioUpload(e.target.files);
        e.target.value = '';
      }
    });

    // Upload de Áudio Pós-VD / Extra para juntar em uma evolução já existente no Histórico
    document.getElementById('continuationAudioFileInput')?.addEventListener('change', async (e) => {
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0 || !state.activeConsultationId) return;
      const files = Array.from(fileList);
      e.target.value = '';
      const c = await window.ScribeDB.getConsultation(state.activeConsultationId);
      if (!c) return;
      if (c.evolutionText && c.evolutionText.trim().length > 20) {
        const prevBackups = Array.isArray(c.evolutionBackups) ? c.evolutionBackups : [];
        c.evolutionBackups = [{ at: Date.now(), text: c.evolutionText }, ...prevBackups].slice(0, 3);
      }
      c.previousEvolutionText = c.evolutionText || c.previousEvolutionText || '';
      c.previousRawTranscript = c.rawTranscript || c.previousRawTranscript || '';
      c.rawTranscript = c.previousRawTranscript || '';
      await window.ScribeDB.deleteAudioChunksOnly(c.id);
      c.chunkCount = 0;
      c.audioBytes = 0;
      c.audioDeleted = false;
      c.mimeType = normalizeAudioMimeType(files[0], files[0].name);
      c.fileName = files.map(f => f.name).join(' + ');
      c.isMultiFileExternalAudio = files.length > 1;
      c.audioFilesCount = files.length;
      c.status = 'queued';
      c.errorMessage = '';
      c.updatedAt = Date.now();
      await window.ScribeDB.saveConsultation(c);
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const cleanMime = normalizeAudioMimeType(f, f.name);
        await window.ScribeDB.saveAudioChunk(c.id, i, f, cleanMime);
      }
      await refreshQueueSidebar();
      const updated = await window.ScribeDB.getConsultation(c.id);
      await renderActiveConsultationView(updated);
      showToast(`🎙️ Relato pós-VD (${files.length} áudio) enviado! Integrando na evolução de "${c.patientLabel}"...`);
      processQueueInBackground();
    });

    // Botão rápido dentro do campo de VD para gravar o relato pós-VD na UBS e juntar nos áudios da visita
    let vdUbsReportRecorder = null;
    let vdUbsReportStream = null;
    let vdUbsReportChunks = [];
    document.getElementById('btnQuickRecordVdUbsReport')?.addEventListener('click', async () => {
      const btn = document.getElementById('btnQuickRecordVdUbsReport');
      if (vdUbsReportRecorder && vdUbsReportRecorder.state === 'recording') {
        vdUbsReportRecorder.stop();
        return;
      }
      try {
        vdUbsReportStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
        const mime = getSupportedAudioMimeType() || 'audio/webm';
        vdUbsReportChunks = [];
        vdUbsReportRecorder = new MediaRecorder(vdUbsReportStream, { mimeType: mime, audioBitsPerSecond: 32000 });
        vdUbsReportRecorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) vdUbsReportChunks.push(ev.data);
        };
        vdUbsReportRecorder.onstop = () => {
          try { vdUbsReportStream.getTracks().forEach(t => t.stop()); } catch (_) {}
          const blob = new Blob(vdUbsReportChunks, { type: mime });
          if (blob.size > 0) {
            const reportFile = new File([blob], `Relato_UBS_Pos_VD_${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')}.webm`, { type: mime });
            handleExternalAudioUpload([reportFile]);
          }
          if (btn) {
            btn.textContent = '🎙️ Gravar Relato Pós-VD na UBS';
            btn.style.background = '#7c3aed';
          }
        };
        vdUbsReportRecorder.start(1000);
        if (btn) {
          btn.textContent = '⏹️ Finalizar Relato Pós-VD na UBS';
          btn.style.background = '#dc2626';
        }
        showToast('🎙️ Relatando na UBS como foi a VD e o que foi feito... Clique novamente no botão para finalizar.');
      } catch (err) {
        alert('Não foi possível acessar o microfone: ' + err.message);
      }
    });

    const dropZone = document.getElementById('whatsappDropZone');
    if (dropZone) {
      dropZone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-active');
      });
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        dropZone.classList.add('drag-active');
      });
      dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!dropZone.contains(e.relatedTarget)) {
          dropZone.classList.remove('drag-active');
        }
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-active');
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length > 0) {
          routeDroppedFiles(dt.files);
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

    ['zSex', 'zYears', 'zMonths', 'zBirthGA', 'zWeight', 'zHeight', 'zHC', 'chkIncludeZScoreInEvolution', 'pueriFeedingType', 'pueriFormulaDetails'].forEach(id => {
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

      // PROTEÇÃO: só permite continuar quando a evolução atual já está pronta; senão o áudio da 1ª parte seria descartado.
      if (c.status !== 'done' || !c.evolutionText || c.evolutionText.trim().length < 60) {
        alert('⚠️ A evolução deste atendimento ainda não terminou de ser gerada (ou deu erro). Para não perder nada do que foi gravado, aguarde chegar a 100% ou clique em "Atualizar" antes de continuar o atendimento.');
        return;
      }

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
      updateVdPendenciesConvertButtonVisibility(e.target.value);
      if (!state.activeConsultationId) return;
      const c = await window.ScribeDB.getConsultation(state.activeConsultationId);
      if (c) {
        c.evolutionText = e.target.value;
        await window.ScribeDB.saveConsultation(c);
      }
    });

    document.getElementById('btnConvertVdPendenciesToConduct')?.addEventListener('click', convertVdPendenciesToConduct);

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
      const interWrap = document.getElementById('modalInterconsultaSubtypeWrapper');
      if (interWrap) {
        interWrap.style.display = (newTplId === 'interconsulta') ? 'inline-flex' : 'none';
      }
      if (newTplId === 'interconsulta') {
        const interSelect = document.getElementById('modalChangeInterconsultaSubtype');
        if (interSelect) c.soapSubtypeHeader = interSelect.value;
      }
      if (newTplId === 'prenatal') {
        c.patientSex = 'F';
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

    document.getElementById('modalChangeInterconsultaSubtype')?.addEventListener('change', async (e) => {
      if (!state.activeConsultationId) return;
      const c = await window.ScribeDB.getConsultation(state.activeConsultationId);
      if (!c) return;
      c.soapSubtypeHeader = e.target.value;
      await window.ScribeDB.saveConsultation(c);
      showToast(`Formato definido como "${e.target.value === 'resumida' ? 'Versão Resumida' : 'Versão Completa'}". Clique em "Reprocessar no Formato Escolhido".`);
    });

    document.getElementById('btnRestorePrevVersion')?.addEventListener('click', async () => {
      if (!state.activeConsultationId) return;
      const c = await window.ScribeDB.getConsultation(state.activeConsultationId);
      if (!c || !Array.isArray(c.evolutionBackups) || c.evolutionBackups.length === 0) return;
      if (!confirm('Restaurar a versão anterior da evolução? A versão atual será guardada e você poderá voltar a ela.')) return;
      const [prev, ...rest] = c.evolutionBackups;
      c.evolutionBackups = [{ at: Date.now(), text: c.evolutionText || '' }, ...rest].filter(b => b.text && b.text.trim()).slice(0, 3);
      c.evolutionText = prev.text;
      c.status = 'done';
      c.errorMessage = '';
      await window.ScribeDB.saveConsultation(c);
      await renderActiveConsultationView(c);
      await refreshQueueSidebar();
      showToast('↩️ Versão anterior da evolução restaurada!');
    });

    const triggerReprocessCurrent = async () => {
      if (!state.activeConsultationId) return;
      const c = await window.ScribeDB.getConsultation(state.activeConsultationId);
      if (c) {
        const tplSelect = document.getElementById('modalChangeConsultationTemplate');
        const soapSelect = document.getElementById('modalChangeSoapSubtype');
        const interSelect = document.getElementById('modalChangeInterconsultaSubtype');
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
        } else if (c.templateId === 'interconsulta') {
          c.soapSubtypeHeader = interSelect ? interSelect.value : 'completa';
        }
        c.status = 'queued';
        c.errorMessage = '';
        if (c.chunkCount > 0) {
          // Atendimento CONTINUADO: o áudio salvo contém só a última parte. As partes anteriores vivem em
          // previousRawTranscript (transcrição cumulativa). Preserva essa base e reestrutura TUDO junto,
          // sem fusão com a evolução antiga (evita perder exame físico/quadro das partes anteriores).
          if (c.previousRawTranscript && c.previousRawTranscript.length >= 50) {
            c.previousEvolutionText = '';
          }
          c.rawTranscript = c.previousRawTranscript || '';
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

    // Botão 1-clique: "Não gostou da transcrição do Whisper? Subir o áudio gravado direto para o Gemini"
    document.getElementById('btnRetranscribeWithGemini')?.addEventListener('click', async () => {
      if (!state.activeConsultationId) return;
      const c = await window.ScribeDB.getConsultation(state.activeConsultationId);
      if (!c) return;
      const hasRawAudioSaved = Boolean((c.chunkCount > 0 && !c.audioDeleted) || c.remoteFileUri);
      if (!hasRawAudioSaved) {
        showToast('⚠️ O áudio original deste atendimento já foi expirado/excluído.');
        return;
      }
      if (c.evolutionText && c.evolutionText.trim().length > 20) {
        const prevBackups = Array.isArray(c.evolutionBackups) ? c.evolutionBackups : [];
        c.evolutionBackups = [{ at: Date.now(), text: c.evolutionText }, ...prevBackups].slice(0, 3);
      }
      c.forceCloudAudioTranscription = true;
      c.status = 'queued';
      c.errorMessage = '';
      if (c.previousRawTranscript && c.previousRawTranscript.length >= 50) {
        c.previousEvolutionText = '';
      }
      c.rawTranscript = c.previousRawTranscript || '';
      await window.ScribeDB.saveConsultation(c);
      await refreshQueueSidebar();
      await renderActiveConsultationView(c);
      processQueueInBackground();
      showToast(`☁️ Enviando áudio de "${c.patientLabel}" direto para o Gemini na nuvem...`);
    });

    // Botão rápido da barra superior cicla os 3 modos neste computador: ☁️ Gemini → 🔄 Auto → 🎙️ Whisper
    const describeAudioModeToast = (mode) => {
      const profLabel = formatWhisperProfileLabel(getLocalWhisperProfile());
      if (mode === 'auto') {
        return `🔄 Modo Automático Inteligente ATIVADO: usa Gemini e alterna sozinho p/ ${profLabel} se der 503, cota cheia ou consulta >50 min!`;
      }
      if (mode === 'whisper') {
        return `🎙️ Sempre Whisper Local (${profLabel}) ATIVADO: economiza ~85% da cota e cai p/ Gemini se falhar.`;
      }
      return '☁️ Somente Gemini (Nuvem) ativado neste computador.';
    };

    document.getElementById('btnToggleWhisperMode')?.addEventListener('click', () => {
      const cur = getAudioEngineMode();
      const nextMode = cur === 'cloud' ? 'auto' : (cur === 'auto' ? 'whisper' : 'cloud');
      setAudioEngineMode(nextMode);
      showToast(describeAudioModeToast(nextMode));
    });

    document.getElementById('audioEngineModeSelect')?.addEventListener('change', (e) => {
      const nextMode = e.target.value;
      setAudioEngineMode(nextMode);
      showToast(describeAudioModeToast(nextMode));
    });

    document.getElementById('whisperProfileSelect')?.addEventListener('change', (e) => {
      setLocalWhisperProfile(e.target.value);
      showToast(`🎙️ Modelo Whisper selecionado: ${formatWhisperProfileLabel(e.target.value)}`);
    });

    document.getElementById('btnPreloadWhisper')?.addEventListener('click', preloadLocalWhisperModel);
    document.getElementById('btnCancelWhisperDownload')?.addEventListener('click', cancelLocalWhisperDownload);
    document.getElementById('btnUnloadWhisper')?.addEventListener('click', async () => {
      await unloadWhisperWorker();
      showToast('🧹 Whisper descarregado da memória RAM (o cache salvo no navegador foi mantido).');
    });

    document.getElementById('btnDeleteConsultation')?.addEventListener('click', async () => {
      if (!state.activeConsultationId) return;
      if (!confirm('Deseja excluir este registro do disco?')) return;
      await window.ScribeDB.deleteConsultation(state.activeConsultationId);
      state.activeConsultationId = null;
      await refreshQueueSidebar();
      await renderActiveConsultationView(null);
      updateStorageStatsUI();
    });

    document.getElementById('referralSpecialtySelect')?.addEventListener('change', () => {
      const customSpec = document.getElementById('referralCustomSpecialty');
      if (customSpec) customSpec.value = '';
    });

    document.getElementById('btnGenerateReferral')?.addEventListener('click', generateStateReferral);
    document.getElementById('btnImproveReferral')?.addEventListener('click', improveCurrentReferral);

    document.getElementById('btnToggleLiveReferralDrawer')?.addEventListener('click', () => {
      const body = document.getElementById('liveReferralDrawerBody');
      const btn = document.getElementById('liveReferralDrawerToggleBtn');
      if (!body) return;
      const isHidden = body.style.display === 'none' || !body.style.display;
      body.style.display = isHidden ? 'block' : 'none';
      if (btn) btn.textContent = isHidden ? '▲ Minimizar Encaminhamento' : '▼ Abrir Encaminhamento';
    });
    document.getElementById('liveReferralSpecialtySelect')?.addEventListener('change', () => {
      const customSpec = document.getElementById('liveReferralCustomSpecialty');
      if (customSpec) customSpec.value = '';
    });
    document.getElementById('btnGenerateLiveReferralNow')?.addEventListener('click', generateLiveReferralDuringConsultation);
    document.getElementById('btnCopyLiveJustificationOnly')?.addEventListener('click', () => {
      const fullText = document.getElementById('liveReferralResultEditor')?.value || '';
      const justMatch = fullText.match(/JUSTIFICATIVA CLÍNICA PARA A? REGULAÇÃO:\s*\n+([\s\S]+?)(?=\n+(?:ENQUADRAMENTO|⚠️\s*PENDÊNCIAS)|$)/i);
      const textToCopy = (justMatch && justMatch[1].trim()) ? justMatch[1].trim() : fullText;
      copyToClipboard(textToCopy, '📋 Justificativa clínica copiada para o GERCON/SISREG!');
    });
    document.getElementById('btnCopyLiveReferralAll')?.addEventListener('click', () => {
      const text = document.getElementById('liveReferralResultEditor')?.value || '';
      copyToClipboard(text, '🏛️ Encaminhamento completo copiado!');
    });
    document.getElementById('btnCopyJustificationOnly')?.addEventListener('click', () => {
      const fullText = document.getElementById('referralResultEditor')?.value || '';
      // Extrai apenas o bloco da justificativa clínica pronta para o GERCON/SISREG
      const justMatch = fullText.match(/JUSTIFICATIVA CLÍNICA PARA A? REGULAÇÃO:\s*\n+([\s\S]+?)(?=\n+(?:ENQUADRAMENTO|⚠️\s*PENDÊNCIAS)|$)/i);
      const textToCopy = (justMatch && justMatch[1].trim()) ? justMatch[1].trim() : fullText;
      copyToClipboard(textToCopy, '📋 Justificativa clínica copiada para o GERCON/SISREG!');
    });

    document.getElementById('btnCopyReferral')?.addEventListener('click', () => {
      const text = document.getElementById('referralResultEditor')?.value || '';
      copyToClipboard(text, '🏛️ Encaminhamento completo com Enquadramento e Pendências copiado!');
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
      state.autoCloudSync = true;
      localStorage.setItem('ubs_auto_cloud_sync', 'true');
      const chk = document.getElementById('chkAutoCloudSync');
      if (chk) chk.checked = true;
      showToast('💾 PIN salvo! Sincronizando com a nuvem...');
      pushConsultationsToCloud(false).catch(() => {});
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
    document.getElementById('btnOpenQuotaMonitor')?.addEventListener('click', openApiKeyModal);
    document.getElementById('btnProbeKeysQuota')?.addEventListener('click', probeAllKeysLiveQuota);
    document.getElementById('btnTestApiKeysValidity')?.addEventListener('click', testSavedApiKeysValidity);
    document.getElementById('btnResetTodayQuotaStats')?.addEventListener('click', resetTodayQuotaStats);
    document.getElementById('btnCloseApiKeyModal')?.addEventListener('click', () => {
      document.getElementById('apiKeyModal').style.display = 'none';
    });

    let lastApiKeySaveTs = 0;
    const persistKeysFromInputsNow = () => {
      const mainKey = document.getElementById('apiKeyInput')?.value.trim() || '';
      const secondKey = document.getElementById('secondApiKeyInput')?.value.trim() || '';
      const extraKeysRaw = document.getElementById('extraApiKeysInput')?.value.trim() || '';
      const combinedExtras = [secondKey, extraKeysRaw].filter(Boolean).join('\n');
      const mode = document.querySelector('input[name="keyStorageMode"]:checked')?.value || 'permanent';

      if (mode === 'session') {
        if (mainKey) sessionStorage.setItem('ubs_gemini_api_key', mainKey);
        else sessionStorage.removeItem('ubs_gemini_api_key');
        if (secondKey) sessionStorage.setItem('ubs_second_api_key', secondKey);
        else sessionStorage.removeItem('ubs_second_api_key');
        if (combinedExtras) sessionStorage.setItem('ubs_extra_api_keys', combinedExtras);
        else sessionStorage.removeItem('ubs_extra_api_keys');
        localStorage.removeItem('ubs_gemini_api_key');
        localStorage.removeItem('ubs_second_api_key');
        localStorage.removeItem('ubs_extra_api_keys');
      } else {
        if (mainKey) localStorage.setItem('ubs_gemini_api_key', mainKey);
        else localStorage.removeItem('ubs_gemini_api_key');
        if (secondKey) localStorage.setItem('ubs_second_api_key', secondKey);
        else localStorage.removeItem('ubs_second_api_key');
        if (combinedExtras) localStorage.setItem('ubs_extra_api_keys', combinedExtras);
        else localStorage.removeItem('ubs_extra_api_keys');
        sessionStorage.removeItem('ubs_gemini_api_key');
        sessionStorage.removeItem('ubs_second_api_key');
        sessionStorage.removeItem('ubs_extra_api_keys');
      }
      return { mainKey, secondKey, combinedExtras };
    };

    const saveApiKeyHandler = async (e) => {
      if (e && e.preventDefault) e.preventDefault();
      const nowTs = Date.now();
      if (nowTs - lastApiKeySaveTs < 300) return;
      lastApiKeySaveTs = nowTs;

      const { mainKey } = persistKeysFromInputsNow();

      // Salva no Gerenciador de Senhas do Google Chrome sem travar o fechamento do modal
      try {
        if (mainKey && window.PasswordCredential && navigator.credentials && navigator.credentials.store) {
          const cred = new window.PasswordCredential({
            id: 'Chave API Gemini - Prontuário APS',
            name: 'Chave API Gemini - Prontuário APS',
            password: mainKey
          });
          Promise.resolve(navigator.credentials.store(cred)).catch(() => {});
        }
      } catch (_) {}

      updateApiKeyStatusBadge();
      updateTokenMonitorUI();
      renderApiKeysQuotaDashboard();
      const prefModel = document.getElementById('preferredModelSelect')?.value || 'auto';
      localStorage.setItem('ubs_preferred_model', prefModel);
      const savedKeysList = getSavedApiKeysList();
      for (const k of savedKeysList) {
        if (prefModel !== 'auto') {
          rememberWorkingModelForKey(prefModel, k);
        }
        delete cachedDiscoveredModelsByKey[getKeyShortHash(k)];
      }

      document.getElementById('apiKeyModal').style.display = 'none';
      showToast(savedKeysList.length > 1
        ? `🔒 ${savedKeysList.length} Chaves API salvas com rotação automática!`
        : '🔒 Credencial salva com sucesso!');
      retryAllPendingConsultations();
      processQueueInBackground();
    };

    document.getElementById('preferredModelSelect')?.addEventListener('change', (e) => {
      const chosen = e.target.value;
      localStorage.setItem('ubs_preferred_model', chosen);
      const savedKeysList = getSavedApiKeysList();
      for (const k of savedKeysList) {
        if (chosen !== 'auto') {
          rememberWorkingModelForKey(chosen, k);
          delete cachedDiscoveredModelsByKey[getKeyShortHash(k)];
        }
      }
      updateTokenMonitorUI();
      renderApiKeysQuotaDashboard();
      showToast(`⚡ Modelo preferido alterado para: ${formatModelName(chosen)}`);
    });

    ['apiKeyInput', 'secondApiKeyInput', 'extraApiKeysInput'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const syncHandler = () => {
        persistKeysFromInputsNow();
        updateApiKeyStatusBadge();
        updateTokenMonitorUI();
        renderApiKeysQuotaDashboard();
      };
      el.addEventListener('input', syncHandler);
      el.addEventListener('change', syncHandler);
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
      if (confirm('Restaurar todos os 8 modelos para o texto original padrão?')) {
        localStorage.removeItem('ubs_custom_templates_v10');
        localStorage.removeItem('ubs_custom_templates_v11');
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
    // Leitura por LINHAS: um título de seção só vale quando está sozinho na linha e em MAIÚSCULAS
    // (jamais casa palavras comuns como "avaliação" ou "conduta" dentro de frases).
    const lines = String(fullText || '').split('\n');
    const reTitle = {
      subjetivo: /^\s*(?:4\.\s*)?SUBJETIVO\s*:?\s*$/,
      objetivo: /^\s*(?:5\.|6\.\s*)?OBJETIVO(?:\s*\(EXAME FÍSICO\))?\s*:?\s*$/,
      exames: /^\s*(?:EXAMES COMPLEMENTARES|ULTRASSONOGRAFIA)\s*:?\s*$/,
      avaliacao: /^\s*(?:7\.|8\.|9\.\s*)?AVALIAÇÃO\s*:?\s*$/,
      conduta: /^\s*(?:10\.\s*)?CONDUTA\s*:?\s*$/,
      plano: /^\s*(?:11\.\s*)?PLANO\s*:?\s*$/
    };
    if (!reTitle[sectionKey]) return fullText;
    const order = ['subjetivo', 'objetivo', 'exames', 'avaliacao', 'conduta', 'plano'];
    const isAnyTitle = (line) => order.some(k => reTitle[k].test(line));
    const idx = lines.findIndex(l => reTitle[sectionKey].test(l));
    if (idx < 0) return '';
    let end = lines.length;
    for (let i = idx + 1; i < lines.length; i++) {
      if (isAnyTitle(lines[i])) { end = i; break; }
    }
    if (sectionKey === 'subjetivo') {
      // Mantém o comportamento anterior: o bloco do Subjetivo inclui o cabeçalho "#" que vem antes dele
      return lines.slice(0, end).join('\n').trim();
    }
    if (sectionKey === 'exames') {
      // Exames inclui também a Ultrassonografia (Pré-Natal): só termina na Avaliação/Conduta/Plano
      let examEnd = lines.length;
      for (let i = idx + 1; i < lines.length; i++) {
        if (isAnyTitle(lines[i]) && !reTitle.exames.test(lines[i])) { examEnd = i; break; }
      }
      return lines.slice(idx, examEnd).join('\n').trim();
    }
    return lines.slice(idx + 1, end).join('\n').trim();
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
  window.showToast = showToast;

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
