// ============================================================================
// MOTOR PRINCIPAL: GRAVAÇÃO ANTI-CRASH, FILA ASSÍNCRONA, CONTROLE DE TOKENS
// E INTEGRAÇÃO GEMINI API (SOAP + ENCAMINHAMENTO REGULAÇÃO ESTADUAL)
// ============================================================================

(function() {
  // --- Estado Global ---
  const state = {
    selectedTemplateId: 'geral',
    templates: {},
    activeConsultationId: null, // Consulta sendo visualizada na direita
    recordingConsultationId: null, // Consulta sendo gravada agora
    isRecording: false,
    isPaused: false,
    recordingSeconds: 0,
    silenceSeconds: 0,
    chunkIndex: 0,
    mediaRecorder: null,
    mediaStream: null,
    audioContext: null,
    analyser: null,
    vuAnimationFrame: null,
    timerWorker: null,
    wakeLock: null,
    queueRunning: false,
    dailyTokensUsed: 0,
    dailyConsultationsProcessed: 0,
    selectedMicDeviceId: localStorage.getItem('ubs_selected_mic') || ''
  };

  // Modelos Gemini em cascata (Fallback automático se um atingir Rate Limit 429/503)
  const GEMINI_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite'
  ];

  // --- Inicialização ---
  document.addEventListener('DOMContentLoaded', async () => {
    loadCustomOrDefaultTemplates();
    loadDailyTokenStats();
    renderTemplateSelector();
    initTimerWorker();
    await populateMicrophones();
    await checkCrashRecoveryAndLoadHistory();
    bindUIEvents();
    updateApiKeyStatusBadge();
    updateStorageStatsUI();

    // Auto-limpeza de áudios finalizados com mais de 48h (preserva os textos)
    try {
      await window.ScribeDB.autoCleanupOldAudio(48);
    } catch (_) {}
  });

  // --- Carregamento de Modelos (6 padrões + edições do usuário) ---
  function loadCustomOrDefaultTemplates() {
    const saved = localStorage.getItem('ubs_custom_templates_v1');
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
    localStorage.setItem('ubs_custom_templates_v1', JSON.stringify(state.templates));
  }

  // --- Estatísticas de Tokens do Dia ---
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
    localStorage.setItem(getTodayKey(), JSON.stringify({
      tokens: state.dailyTokensUsed,
      count: state.dailyConsultationsProcessed
    }));
    updateTokenMonitorUI();
  }

  function updateTokenMonitorUI() {
    const estCurrentAudioTokens = Math.round(state.recordingSeconds * 32) + (state.isRecording ? 1200 : 0);
    const elCurrent = document.getElementById('liveTokenEstimate');
    const elDaily = document.getElementById('dailyTokenCounter');
    if (elCurrent) {
      elCurrent.textContent = estCurrentAudioTokens.toLocaleString('pt-BR') + ' tok';
    }
    if (elDaily) {
      elDaily.textContent = `${state.dailyTokensUsed.toLocaleString('pt-BR')} tok (${state.dailyConsultationsProcessed} cons.)`;
    }
  }

  // --- Web Worker em Segundo Plano (Evita Chrome congelar o timer em outra aba) ---
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

  function updateDocumentTitle() {
    if (state.isRecording) {
      const mm = String(Math.floor(state.recordingSeconds / 60)).padStart(2, '0');
      const ss = String(state.recordingSeconds % 60).padStart(2, '0');
      document.title = state.isPaused
        ? `⏸️ ${mm}:${ss} Pausado | Escriba UBS`
        : `🔴 ${mm}:${ss} Gravando... | Escriba UBS`;
    } else if (state.queueRunning) {
      document.title = `⏳ Processando fila... | Escriba UBS`;
    } else {
      document.title = `Escriba Médico UBS - SOAP & Regulação`;
    }
  }

  // --- Wake Lock (Impede tela/PC de dormir durante gravação) ---
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

  // --- Listagem e Seleção de Microfones ---
  async function populateMicrophones() {
    const select = document.getElementById('micSelect');
    if (!select || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(d => d.kind === 'audioinput');
      select.innerHTML = '<option value="">🎤 Microfone Padrão do Sistema</option>';
      mics.forEach((m, idx) => {
        const opt = document.createElement('option');
        opt.value = m.deviceId;
        opt.textContent = m.label || `Microfone ${idx + 1}`;
        if (m.deviceId === state.selectedMicDeviceId) opt.selected = true;
        select.appendChild(opt);
      });
    } catch (_) {}
  }

  // --- Renderização dos 6 Botões de Modelos da UBS ---
  function renderTemplateSelector() {
    const container = document.getElementById('templateGrid');
    if (!container) return;
    container.innerHTML = '';

    Object.values(state.templates).forEach(tpl => {
      const isSelected = tpl.id === state.selectedTemplateId;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `template-card ${isSelected ? 'active' : ''}`;
      btn.innerHTML = `
        <div class="tpl-top">
          <span class="tpl-icon">${tpl.icon || '📋'}</span>
          <span class="tpl-badge">${tpl.badge || 'UBS'}</span>
        </div>
        <div class="tpl-name">${tpl.name}</div>
      `;
      btn.addEventListener('click', () => {
        state.selectedTemplateId = tpl.id;
        renderTemplateSelector();
        togglePuericulturaZScorePanel();
      });
      container.appendChild(btn);
    });
    togglePuericulturaZScorePanel();
  }

  function togglePuericulturaZScorePanel() {
    const panel = document.getElementById('puericulturaZScoreBox');
    if (!panel) return;
    panel.style.display = state.selectedTemplateId === 'puericultura' ? 'block' : 'none';
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
      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 16000
      };
      if (state.selectedMicDeviceId) {
        audioConstraints.deviceId = { exact: state.selectedMicDeviceId };
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      state.mediaStream = stream;
      await populateMicrophones(); // Atualiza nomes dos microfones após permissão concedida

      const mimeType = getSupportedAudioMimeType();
      // 24 kbps Opus: voz nítida e 20 min de consulta pesam apenas ~3.5 MB!
      const recorderOptions = mimeType
        ? { mimeType, audioBitsPerSecond: 24000 }
        : { audioBitsPerSecond: 24000 };

      const recorder = new MediaRecorder(stream, recorderOptions);
      state.mediaRecorder = recorder;

      const patientInput = document.getElementById('patientIdentifier');
      const quickNotesInput = document.getElementById('quickNotesInput');
      const tpl = state.templates[state.selectedTemplateId];
      const now = Date.now();
      const consultId = 'cons_' + now + '_' + Math.random().toString(36).slice(2, 6);

      const newConsultation = {
        id: consultId,
        patientLabel: (patientInput && patientInput.value.trim()) || `Paciente ${new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        templateId: tpl.id,
        templateName: tpl.name,
        templateIcon: tpl.icon,
        createdAt: now,
        updatedAt: now,
        status: 'recording', // recording -> queued -> uploading -> done | error | interrupted
        durationSeconds: 0,
        chunkCount: 0,
        audioBytes: 0,
        mimeType: recorder.mimeType || mimeType || 'audio/webm',
        quickNotes: (quickNotesInput && quickNotesInput.value) || '',
        zScoreSummary: getCalculatedZScoreText(),
        evolutionText: '',
        soapParts: null,
        referralText: '',
        auditAlerts: [],
        tokensUsed: 0,
        errorMessage: ''
      };

      await window.ScribeDB.saveConsultation(newConsultation);

      state.recordingConsultationId = consultId;
      state.isRecording = true;
      state.isPaused = false;
      state.recordingSeconds = 0;
      state.silenceSeconds = 0;
      state.chunkIndex = 0;

      // A cada 3 segundos despeja o chunk no disco (IndexedDB) e limpa a RAM da aba!
      recorder.ondataavailable = async (event) => {
        if (event.data && event.data.size > 0) {
          const idx = state.chunkIndex++;
          try {
            await window.ScribeDB.saveAudioChunk(
              consultId,
              idx,
              event.data,
              recorder.mimeType || mimeType || 'audio/webm'
            );
            const diskBadge = document.getElementById('diskSaveIndicator');
            if (diskBadge) {
              diskBadge.textContent = `💾 Salvo no disco (${idx + 1} blocos)`;
              diskBadge.classList.add('pulse-ok');
              setTimeout(() => diskBadge.classList.remove('pulse-ok'), 600);
            }
          } catch (err) {
            console.error('Erro ao salvar chunk no disco:', err);
          }
        }
      };

      recorder.start(3000); // 3000 ms = 3 segundos por bloco no disco
      state.timerWorker.postMessage('start');
      await requestWakeLock();
      startVUMeterAndSilenceDetector(stream);
      updateRecordingControlsUI();
      await refreshQueueSidebar();
    } catch (err) {
      alert('Não foi possível acessar o microfone. Verifique se o microfone está conectado e com permissão liberada no Chrome.\n\nDetalhe: ' + err.message);
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

  // Finaliza gravação atual, joga para a Fila em Segundo Plano e LIBERA O GRAVADOR NA HORA!
  async function finishRecordingAndQueue() {
    if (!state.isRecording || !state.mediaRecorder) return;

    const finishingId = state.recordingConsultationId;
    const finalSeconds = state.recordingSeconds;
    const patientInput = document.getElementById('patientIdentifier');
    const quickNotesInput = document.getElementById('quickNotesInput');
    const currentLabel = patientInput ? patientInput.value.trim() : '';
    const currentNotes = quickNotesInput ? quickNotesInput.value : '';
    const currentZScore = getCalculatedZScoreText();
    const currentTpl = state.templates[state.selectedTemplateId];

    // Para o MediaRecorder e aguarda o último chunk ser gravado no disco
    await new Promise((resolve) => {
      state.mediaRecorder.onstop = () => resolve();
      try {
        state.mediaRecorder.stop();
      } catch (_) {
        resolve();
      }
    });

    stopStreamAndMeters();
    state.timerWorker.postMessage('stop');
    releaseWakeLock();

    state.isRecording = false;
    state.isPaused = false;
    state.recordingConsultationId = null;
    state.recordingSeconds = 0;
    updateRecordingControlsUI();
    updateRecordingTimerUI();
    updateDocumentTitle();

    // Atualiza os dados finais da consulta e coloca na fila ('queued')
    const consult = await window.ScribeDB.getConsultation(finishingId);
    if (consult) {
      if (currentLabel) consult.patientLabel = currentLabel;
      consult.templateId = currentTpl.id;
      consult.templateName = currentTpl.name;
      consult.templateIcon = currentTpl.icon;
      consult.durationSeconds = finalSeconds;
      consult.quickNotes = currentNotes;
      consult.zScoreSummary = currentZScore;
      consult.status = 'queued';
      consult.updatedAt = Date.now();
      await window.ScribeDB.saveConsultation(consult);

      // Se o médico escolheu uma pasta física no PC, salva cópia do arquivo .webm lá também
      if (window.ScribeDB.hasPhysicalFolder()) {
        const fullBlob = await window.ScribeDB.assembleAudioBlob(finishingId, consult.mimeType);
        await window.ScribeDB.saveBackupToPhysicalFolder(consult, fullBlob);
      }
    }

    // Limpa os campos rápidos para o PRÓXIMO paciente imediatamente!
    if (patientInput) patientInput.value = '';
    if (quickNotesInput) quickNotesInput.value = '';
    clearZScoreInputs();

    showToast('✅ Gravação salva no disco e enviada para a fila! Gravador já está livre para o próximo paciente.');
    await refreshQueueSidebar();
    updateStorageStatsUI();

    // Seleciona a consulta recém-finalizada caso nenhuma esteja aberta
    if (!state.activeConsultationId) {
      await selectConsultationToView(finishingId);
    }

    // Dispara o processador de fila em segundo plano (sem travar nada)
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

  // --- Medidor de Voz (VU Meter) + Detector de Microfone Mudo / Silêncio Prolongado ---
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
          vuFill.style.width = (state.isPaused ? 0 : pct) + '%';
          vuFill.style.backgroundColor = pct > 8 ? '#10b981' : '#f59e0b';
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
              if (state.silenceSeconds >= 180) {
                // 3 minutos de silêncio -> auto-pausa para economizar tokens!
                togglePauseRecording();
                silenceBanner.style.display = 'flex';
                silenceBanner.innerHTML = `<span>⚠️ <strong>Auto-Pausado por 3 min de silêncio</strong> (economia de tokens). Clique em Retomar quando voltar a falar.</span>`;
              } else if (state.silenceSeconds >= 12) {
                silenceBanner.style.display = 'flex';
                silenceBanner.innerHTML = `<span>🔇 Sem som captado há ${state.silenceSeconds}s — verifique se o microfone não está mudo.</span>`;
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

  // --- Normalizador de MimeType para Áudios do WhatsApp (.ogg/.opus) e iPhone 14 (.m4a) ---
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

  // --- Upload de Múltiplos Arquivos de Áudio (WhatsApp .ogg / iPhone 14 .m4a) ---
  async function handleExternalAudioUpload(fileList) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const patientInput = document.getElementById('patientIdentifier');
    const quickNotesInput = document.getElementById('quickNotesInput');
    const tpl = state.templates[state.selectedTemplateId];
    const baseLabel = patientInput ? patientInput.value.trim() : '';
    const currentNotes = (quickNotesInput && quickNotesInput.value) || '';
    const currentZScore = getCalculatedZScoreText();

    let lastCreatedId = null;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const now = Date.now() + i;
      const consultId = 'cons_' + now + '_up' + i;
      const cleanMime = normalizeAudioMimeType(file, file.name);
      const cleanFileName = file.name.replace(/\.[^.]+$/, '').replace(/WhatsApp Ptt /i, 'Áudio WhatsApp ');

      const label = files.length === 1
        ? (baseLabel || cleanFileName)
        : (baseLabel ? `${baseLabel} (${i + 1})` : cleanFileName);

      const newConsultation = {
        id: consultId,
        patientLabel: label,
        templateId: tpl.id,
        templateName: tpl.name,
        templateIcon: tpl.icon,
        createdAt: now,
        updatedAt: now,
        status: 'queued',
        durationSeconds: Math.max(5, Math.round(file.size / 3000)),
        chunkCount: 1,
        audioBytes: file.size,
        mimeType: cleanMime,
        fileName: file.name,
        quickNotes: currentNotes,
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
      lastCreatedId = consultId;
    }

    if (patientInput) patientInput.value = '';
    if (quickNotesInput) quickNotesInput.value = '';
    showToast(`📂 ${files.length} áudio(s) do WhatsApp/iPhone importado(s) para a fila!`);
    await refreshQueueSidebar();
    if (lastCreatedId) {
      await selectConsultationToView(lastCreatedId);
    }
    processQueueInBackground();
  }

  // --- Processamento apenas por Notas/Ditado Escrito (Sem Áudio) ---
  async function handleProcessNotesOnly() {
    const quickNotesInput = document.getElementById('quickNotesInput');
    const notes = quickNotesInput ? quickNotesInput.value.trim() : '';
    if (!notes) {
      alert('Digite os dados do caso clínico, sinais vitais ou exame físico no campo de Notas Rápidas para gerar a evolução sem áudio.');
      return;
    }

    const patientInput = document.getElementById('patientIdentifier');
    const tpl = state.templates[state.selectedTemplateId];
    const now = Date.now();
    const consultId = 'cons_' + now + '_txt';

    const newConsultation = {
      id: consultId,
      patientLabel: (patientInput && patientInput.value.trim()) || `Paciente ${new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      templateId: tpl.id,
      templateName: tpl.name,
      templateIcon: tpl.icon,
      createdAt: now,
      updatedAt: now,
      status: 'queued',
      durationSeconds: 0,
      chunkCount: 0,
      audioBytes: 0,
      mimeType: 'text/plain',
      quickNotes: notes,
      zScoreSummary: getCalculatedZScoreText(),
      evolutionText: '',
      soapParts: null,
      referralText: '',
      auditAlerts: [],
      tokensUsed: 0,
      errorMessage: ''
    };

    await window.ScribeDB.saveConsultation(newConsultation);
    if (patientInput) patientInput.value = '';
    if (quickNotesInput) quickNotesInput.value = '';
    showToast('📝 Notas enviadas para a fila de estruturação SOAP!');
    await refreshQueueSidebar();
    await selectConsultationToView(consultId);
    processQueueInBackground();
  }

  // --- FILA ASSÍNCRONA EM SEGUNDO PLANO (Com Auto-Retry & Fallback de Modelo) ---
  async function processQueueInBackground() {
    if (state.queueRunning) return;
    const apiKey = getSavedApiKey();
    if (!apiKey) {
      openApiKeyModal();
      return;
    }

    state.queueRunning = true;
    updateDocumentTitle();

    try {
      while (true) {
        const all = await window.ScribeDB.getAllConsultations();
        // Pega a consulta mais antiga que está 'queued'
        const nextItem = [...all].reverse().find(c => c.status === 'queued');
        if (!nextItem) break;

        nextItem.status = 'uploading';
        nextItem.errorMessage = '';
        await window.ScribeDB.saveConsultation(nextItem);
        await refreshQueueSidebar();
        if (state.activeConsultationId === nextItem.id) {
          await renderActiveConsultationView(nextItem);
        }

        try {
          const result = await processSingleConsultationWithGemini(nextItem, apiKey);
          nextItem.status = 'done';
          nextItem.evolutionText = result.evolutionText;
          nextItem.soapParts = result.soapParts;
          nextItem.auditAlerts = result.auditAlerts || [];
          nextItem.suggestedSpecialty = result.suggestedSpecialty || '';
          nextItem.tokensUsed = result.tokensUsed || 0;
          nextItem.modelUsed = result.modelUsed || '';
          nextItem.updatedAt = Date.now();
          await window.ScribeDB.saveConsultation(nextItem);

          addDailyTokenUsage(result.tokensUsed || 0);
          showToast(`✅ Evolução pronta: ${nextItem.patientLabel}`);
        } catch (err) {
          console.error('Erro ao processar consulta na fila:', err);
          nextItem.status = 'error';
          nextItem.errorMessage = err.message || 'Falha na conexão ou limite da API';
          nextItem.updatedAt = Date.now();
          await window.ScribeDB.saveConsultation(nextItem);
        }

        await refreshQueueSidebar();
        if (state.activeConsultationId === nextItem.id) {
          const updated = await window.ScribeDB.getConsultation(nextItem.id);
          await renderActiveConsultationView(updated);
        }
      }
    } finally {
      state.queueRunning = false;
      updateDocumentTitle();
    }
  }

  // --- Chamada à API do Gemini com Auto-Retry (429/503/Rede) e Cascata de Modelos ---
  async function processSingleConsultationWithGemini(consultation, apiKey) {
    const tpl = state.templates[consultation.templateId] || window.DEFAULT_TEMPLATES.geral;
    const promptText = window.buildMedicalEvolutionPrompt(
      tpl,
      consultation.quickNotes,
      consultation.zScoreSummary
    );

    let audioPart = null;
    if (consultation.chunkCount > 0) {
      const audioBlob = await window.ScribeDB.assembleAudioBlob(consultation.id, consultation.mimeType);
      if (audioBlob && audioBlob.size > 0) {
        const cleanMime = normalizeAudioMimeType(audioBlob, consultation.fileName || '');
        // Se o áudio tiver mais de 15 MB, usa a File API do Gemini; caso contrário inlineData base64
        if (audioBlob.size > 15 * 1024 * 1024) {
          const fileUri = await uploadLargeAudioToGeminiFileAPI(audioBlob, cleanMime, apiKey);
          audioPart = { fileData: { mimeType: cleanMime, fileUri } };
        } else {
          const base64Audio = await blobToBase64(audioBlob);
          audioPart = { inlineData: { mimeType: cleanMime, data: base64Audio } };
        }
      }
    }

    const parts = [];
    if (audioPart) parts.push(audioPart);
    parts.push({ text: promptText });

    const requestBody = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.15,
        responseMimeType: 'application/json'
      }
    };

    const { responseJson, modelUsed } = await callGeminiWithFallbackAndRetry(requestBody, apiKey, (statusMsg) => {
      const badge = document.getElementById(`qstatus_${consultation.id}`);
      if (badge) badge.textContent = statusMsg;
    });

    const rawText = responseJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const tokensUsed = responseJson?.usageMetadata?.totalTokenCount || Math.round((consultation.durationSeconds || 60) * 32 + 1200);

    let parsed = null;
    try {
      parsed = JSON.parse(rawText);
    } catch (_) {
      // Caso o modelo retorne blocos ```json ... ```
      const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch (__) {
        parsed = { evolucao_completa: rawText };
      }
    }

    return {
      evolutionText: parsed.evolucao_completa || rawText,
      soapParts: {
        subjetivo: parsed.resumo_subjetivo || '',
        objetivo: parsed.resumo_objetivo || '',
        avaliacao: parsed.resumo_avaliacao || '',
        conduta: parsed.resumo_conduta || ''
      },
      auditAlerts: Array.isArray(parsed.alertas_auditoria) ? parsed.alertas_auditoria : [],
      suggestedSpecialty: parsed.especialidade_sugerida_encaminhamento || '',
      tokensUsed,
      modelUsed
    };
  }

  async function callGeminiWithFallbackAndRetry(requestBody, apiKey, onStatusUpdate) {
    let lastError = null;

    for (let mIdx = 0; mIdx < GEMINI_MODELS.length; mIdx++) {
      const model = GEMINI_MODELS[mIdx];
      const maxAttempts = 2;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          if (onStatusUpdate) {
            onStatusUpdate(attempt > 1 ? `⏳ Tentativa ${attempt} (${model})...` : `⚡ Processando (${model})...`);
          }

          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });

          if (res.ok) {
            const responseJson = await res.json();
            return { responseJson, modelUsed: model };
          }

          const errData = await res.json().catch(() => ({}));
          const errMsg = errData?.error?.message || `HTTP ${res.status}`;

          // Se a chave for inválida (400 API_KEY_INVALID ou 403), interrompe na hora
          if (res.status === 400 && errMsg.toLowerCase().includes('api key')) {
            throw new Error('Chave da API do Gemini inválida. Clique em "Chave API" no topo para conferir.');
          }

          // Se for Rate Limit (429) ou Servidor Ocupado (503), aguarda ou tenta próximo modelo da cascata
          if (res.status === 429 || res.status === 503) {
            lastError = new Error(`Limite temporário da API (${res.status}): ${errMsg}`);
            if (attempt < maxAttempts) {
              const waitSec = 10 * attempt;
              if (onStatusUpdate) onStatusUpdate(`⏳ Cota por minuto cheia, aguardando ${waitSec}s...`);
              await sleep(waitSec * 1000);
              continue;
            }
            break; // Tenta o próximo modelo da lista GEMINI_MODELS
          }

          throw new Error(errMsg);
        } catch (networkErr) {
          lastError = networkErr;
          if (networkErr.message && networkErr.message.includes('Chave da API')) {
            throw networkErr;
          }
          // Se a internet da UBS oscilou, espera 6 segundos e tenta de novo
          if (attempt < maxAttempts) {
            if (onStatusUpdate) onStatusUpdate(`🌐 Oscilação de rede, reconectando em 6s...`);
            await sleep(6000);
          }
        }
      }
    }

    throw lastError || new Error('Não foi possível conectar à API do Gemini. O áudio permanece salvo com segurança no disco para reprocessar.');
  }

  // Upload resumível para áudios muito grandes (> 15 MB) via Gemini File API
  async function uploadLargeAudioToGeminiFileAPI(blob, mimeType, apiKey) {
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
      body: JSON.stringify({ file: { display_name: 'consulta_ubs_' + Date.now() } })
    });
    const uploadUrl = startRes.headers.get('X-Goog-Upload-URL');
    if (!uploadUrl) throw new Error('Falha ao iniciar upload de arquivo grande na File API.');

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

  // --- Gerador de Encaminhamento (Regulação Estadual) para Qualquer dos 6 Modelos ---
  async function generateStateReferral() {
    if (!state.activeConsultationId) {
      alert('Selecione ou gere uma consulta primeiro para criar o encaminhamento.');
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
      alert('A evolução clínica ainda está vazia. Aguarde o processamento ou digite os dados clínicos.');
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
      btnGenerate.textContent = '⏳ Gerando Encaminhamento no Padrão Regulação Estadual...';
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
      const refText = responseJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const tokens = responseJson?.usageMetadata?.totalTokenCount || 800;

      consult.referralText = refText.trim();
      consult.referralSpecialty = especialidade;
      await window.ScribeDB.saveConsultation(consult);
      addDailyTokenUsage(tokens);

      const refEditor = document.getElementById('referralResultEditor');
      const refBox = document.getElementById('referralOutputContainer');
      if (refEditor) refEditor.value = consult.referralText;
      if (refBox) refBox.style.display = 'block';
      showToast('🏥 Encaminhamento para Regulação Estadual gerado com sucesso!');
    } catch (err) {
      alert('Erro ao gerar encaminhamento: ' + err.message);
    } finally {
      if (btnGenerate) {
        btnGenerate.disabled = false;
        btnGenerate.textContent = '🏛️ Gerar Texto de Encaminhamento (Sistema Estadual)';
      }
    }
  }

  // --- Recuperação Automática de Crash (Se o Chrome fechou durante uma consulta) ---
  async function checkCrashRecoveryAndLoadHistory() {
    const all = await window.ScribeDB.getAllConsultations();
    let recoveredCount = 0;

    for (const c of all) {
      if (c.status === 'recording' || c.status === 'uploading') {
        if (c.chunkCount > 0 || (c.quickNotes && c.quickNotes.trim())) {
          c.status = 'queued'; // Coloca automaticamente na fila para não perder nada!
          c.errorMessage = 'Recuperado automaticamente após fechamento da aba';
          await window.ScribeDB.saveConsultation(c);
          recoveredCount++;
        } else {
          await window.ScribeDB.deleteConsultation(c.id);
        }
      }
    }

    await refreshQueueSidebar();

    const updatedList = await window.ScribeDB.getAllConsultations();
    if (updatedList.length > 0) {
      await selectConsultationToView(updatedList[0].id);
    }

    if (recoveredCount > 0) {
      showToast(`🛡️ Recuperação Automática: ${recoveredCount} gravação(ões) interrompida(s) foram recuperadas do disco!`);
      if (getSavedApiKey()) {
        processQueueInBackground();
      }
    } else if (updatedList.some(c => c.status === 'queued') && getSavedApiKey()) {
      processQueueInBackground();
    }
  }

  // --- Renderização da Fila Lateral e Histórico do Dia ---
  async function refreshQueueSidebar() {
    const listContainer = document.getElementById('consultationQueueList');
    if (!listContainer) return;

    const all = await window.ScribeDB.getAllConsultations();
    const countBadge = document.getElementById('queueTotalBadge');
    if (countBadge) countBadge.textContent = String(all.length);

    if (all.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-queue">
          <p>Nenhum atendimento gravado hoje.</p>
          <small>Selecione o modelo ao lado e clique em <strong>Iniciar Gravação</strong>.</small>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = '';
    all.forEach(item => {
      const card = document.createElement('div');
      card.className = `queue-item ${item.id === state.activeConsultationId ? 'selected' : ''}`;

      const timeStr = new Date(item.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const durMin = Math.floor((item.durationSeconds || 0) / 60);
      const durSec = (item.durationSeconds || 0) % 60;
      const durLabel = item.durationSeconds ? `${durMin}m${String(durSec).padStart(2, '0')}s` : 'Notas';
      const mbSize = item.audioBytes ? (item.audioBytes / (1024 * 1024)).toFixed(1) + ' MB' : '';

      let statusHTML = '';
      if (item.status === 'recording') {
        statusHTML = `<span class="q-status st-rec" id="qstatus_${item.id}">🔴 Gravando agora...</span>`;
      } else if (item.status === 'queued') {
        statusHTML = `<span class="q-status st-queue" id="qstatus_${item.id}">⏳ Na fila p/ enviar</span>`;
      } else if (item.status === 'uploading') {
        statusHTML = `<span class="q-status st-up" id="qstatus_${item.id}">⚡ Subindo e gerando SOAP...</span>`;
      } else if (item.status === 'done') {
        statusHTML = `<span class="q-status st-done" id="qstatus_${item.id}">✅ Pronto (${item.tokensUsed || 0} tok)</span>`;
      } else if (item.status === 'error') {
        statusHTML = `<span class="q-status st-err" id="qstatus_${item.id}">⚠️ Pendente (clique p/ reprocessar)</span>`;
      }

      card.innerHTML = `
        <div class="q-header">
          <span class="q-patient">${escapeHtml(item.patientLabel)}</span>
          <span class="q-time">${timeStr}</span>
        </div>
        <div class="q-meta">
          <span>${item.templateIcon || '🩺'} ${escapeHtml(item.templateName)}</span>
          <span>${durLabel} ${mbSize ? '• ' + mbSize : ''}</span>
        </div>
        <div class="q-footer">
          ${statusHTML}
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
    await refreshQueueSidebar();
    const consult = await window.ScribeDB.getConsultation(id);
    await renderActiveConsultationView(consult);
  }

  async function renderActiveConsultationView(consult) {
    const emptyState = document.getElementById('viewerEmptyState');
    const contentState = document.getElementById('viewerContentState');
    if (!consult) {
      if (emptyState) emptyState.style.display = 'flex';
      if (contentState) contentState.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (contentState) contentState.style.display = 'block';

    document.getElementById('viewPatientTitle').textContent = consult.patientLabel;
    document.getElementById('viewTemplateBadge').textContent = `${consult.templateIcon || '🩺'} ${consult.templateName}`;

    // Banner de Erro com botão de Reprocessar se houver falha de internet/cota
    const errBanner = document.getElementById('viewErrorBanner');
    if (consult.status === 'error') {
      errBanner.style.display = 'flex';
      document.getElementById('viewErrorText').textContent = `Áudio salvo com segurança no disco! Motivo da pausa: ${consult.errorMessage}`;
    } else {
      errBanner.style.display = 'none';
    }

    // Alertas de auditoria (campos que não foram falados no áudio)
    const auditBox = document.getElementById('auditAlertsBox');
    if (consult.auditAlerts && consult.auditAlerts.length > 0) {
      auditBox.style.display = 'block';
      auditBox.innerHTML = `<strong>🔎 Conferência Rápida (Resguardo Jurídico):</strong> Verifique/preencha se necessário: ${consult.auditAlerts.map(a => `<span class="audit-tag">${escapeHtml(a)}</span>`).join(' ')}`;
    } else {
      auditBox.style.display = 'none';
    }

    // Editor principal da evolução
    const editor = document.getElementById('mainEvolutionEditor');
    if (consult.status === 'uploading' || consult.status === 'queued') {
      editor.value = '⏳ Processando áudio da consulta em segundo plano...\n\nVocê já pode gravar o próximo paciente normalmente no painel à esquerda!';
    } else {
      editor.value = consult.evolutionText || '';
    }

    // Pré-seleciona especialidade sugerida se a IA detectou encaminhamento na fala
    if (consult.suggestedSpecialty) {
      const customSpec = document.getElementById('referralCustomSpecialty');
      if (customSpec && !customSpec.value) {
        customSpec.value = consult.suggestedSpecialty;
      }
    }

    // Se já gerou encaminhamento para esta consulta, mostra
    const refBox = document.getElementById('referralOutputContainer');
    const refEditor = document.getElementById('referralResultEditor');
    if (consult.referralText) {
      refBox.style.display = 'block';
      refEditor.value = consult.referralText;
    } else {
      refBox.style.display = 'none';
      refEditor.value = '';
    }

    // Player de áudio local salvo no disco
    const audioPlayer = document.getElementById('savedAudioPlayer');
    const btnDownloadAudio = document.getElementById('btnDownloadAudio');
    if (consult.chunkCount > 0 && !consult.audioDeleted) {
      const blob = await window.ScribeDB.assembleAudioBlob(consult.id, consult.mimeType);
      if (blob) {
        const url = URL.createObjectURL(blob);
        audioPlayer.src = url;
        audioPlayer.style.display = 'inline-block';
        btnDownloadAudio.style.display = 'inline-flex';
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

  // --- Calculadora de Z-Score (Puericultura) ---
  function getCalculatedZScoreText() {
    if (state.selectedTemplateId !== 'puericultura') return '';
    const sex = document.getElementById('zSex')?.value || 'M';
    const months = document.getElementById('zMonths')?.value;
    const weight = document.getElementById('zWeight')?.value;
    const height = document.getElementById('zHeight')?.value;
    const hc = document.getElementById('zHC')?.value;

    if (!months && !weight && !height && !hc) return '';
    const calc = window.ZScoreCalculator.calculate({
      sex,
      months: months || 0,
      weightKg: weight,
      heightCm: height,
      hcCm: hc
    });
    return calc ? calc.summaryText : '';
  }

  function updateZScoreLivePreview() {
    const preview = document.getElementById('zScorePreviewResult');
    if (!preview) return;
    const text = getCalculatedZScoreText();
    preview.textContent = text || 'Preencha idade (meses) e medidas acima para calcular os Z-Scores (OMS) automaticamente.';
  }

  function clearZScoreInputs() {
    ['zMonths', 'zWeight', 'zHeight', 'zHC'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    updateZScoreLivePreview();
  }

  // --- Gerenciamento da Chave API Gemini (Isolada por Usuário do Windows/Mac) ---
  function getSavedApiKey() {
    return localStorage.getItem('ubs_gemini_api_key') || sessionStorage.getItem('ubs_gemini_api_key') || '';
  }

  function updateApiKeyStatusBadge() {
    const key = getSavedApiKey();
    const btn = document.getElementById('btnOpenApiKeyModal');
    if (!btn) return;
    if (key) {
      const masked = key.slice(0, 6) + '...' + key.slice(-4);
      btn.innerHTML = `🔑 Chave Ativa (${masked})`;
      btn.classList.add('key-ok');
    } else {
      btn.innerHTML = `🔑 Configurar Chave Gemini (Grátis)`;
      btn.classList.remove('key-ok');
    }
  }

  function openApiKeyModal() {
    const modal = document.getElementById('apiKeyModal');
    const input = document.getElementById('apiKeyInput');
    if (input) input.value = getSavedApiKey();
    if (modal) modal.style.display = 'flex';
  }

  // --- Eventos da Interface ---
  function bindUIEvents() {
    // Botões de Gravação
    document.getElementById('btnStartRec')?.addEventListener('click', startRecording);
    document.getElementById('btnPauseRec')?.addEventListener('click', togglePauseRecording);
    document.getElementById('btnStopRec')?.addEventListener('click', finishRecordingAndQueue);

    // Seletor de Microfone
    document.getElementById('micSelect')?.addEventListener('change', (e) => {
      state.selectedMicDeviceId = e.target.value;
      localStorage.setItem('ubs_selected_mic', state.selectedMicDeviceId);
    });

    // Upload de Áudio (Múltiplos arquivos do WhatsApp / iPhone 14 + Drag & Drop) e Processar Só Notas
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
          handleExternalAudioUpload(e.dataTransfer.files);
        }
      });
    }

    document.getElementById('btnProcessNotesOnly')?.addEventListener('click', handleProcessNotesOnly);

    // Calculadora Z-Score em tempo real
    ['zSex', 'zMonths', 'zWeight', 'zHeight', 'zHC'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', updateZScoreLivePreview);
    });

    // Salvar edições manuais feitas no editor de evolução
    document.getElementById('mainEvolutionEditor')?.addEventListener('input', async (e) => {
      if (!state.activeConsultationId) return;
      const c = await window.ScribeDB.getConsultation(state.activeConsultationId);
      if (c) {
        c.evolutionText = e.target.value;
        await window.ScribeDB.saveConsultation(c);
      }
    });

    // Botões de Copiar (Evolução Completa ou Blocos Separados S / O / A / P)
    document.getElementById('btnCopyFullEvolution')?.addEventListener('click', () => {
      const text = document.getElementById('mainEvolutionEditor')?.value || '';
      copyToClipboard(text, '📋 Evolução completa copiada para colar no PEC / e-SUS!');
    });

    document.querySelectorAll('.btn-copy-section').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sec = btn.getAttribute('data-sec');
        const fullText = document.getElementById('mainEvolutionEditor')?.value || '';
        const extracted = extractSectionFromText(fullText, sec);
        copyToClipboard(extracted || fullText, `📋 Bloco ${sec.toUpperCase()} copiado!`);
      });
    });

    // Reprocessar consulta
    document.getElementById('btnReprocessConsultation')?.addEventListener('click', async () => {
      if (!state.activeConsultationId) return;
      const c = await window.ScribeDB.getConsultation(state.activeConsultationId);
      if (c) {
        c.status = 'queued';
        c.errorMessage = '';
        await window.ScribeDB.saveConsultation(c);
        await refreshQueueSidebar();
        processQueueInBackground();
      }
    });

    // Excluir consulta individual
    document.getElementById('btnDeleteConsultation')?.addEventListener('click', async () => {
      if (!state.activeConsultationId) return;
      if (!confirm('Deseja excluir esta consulta e seu áudio do disco?')) return;
      await window.ScribeDB.deleteConsultation(state.activeConsultationId);
      state.activeConsultationId = null;
      await refreshQueueSidebar();
      await renderActiveConsultationView(null);
      updateStorageStatsUI();
    });

    // Gerador de Encaminhamento Estadual
    document.getElementById('btnGenerateReferral')?.addEventListener('click', generateStateReferral);
    document.getElementById('btnCopyReferral')?.addEventListener('click', () => {
      const text = document.getElementById('referralResultEditor')?.value || '';
      copyToClipboard(text, '🏛️ Encaminhamento copiado! Pronto para colar no sistema de regulação do Estado.');
    });

    // Modal Chave API Gemini
    document.getElementById('btnOpenApiKeyModal')?.addEventListener('click', openApiKeyModal);
    document.getElementById('btnCloseApiKeyModal')?.addEventListener('click', () => {
      document.getElementById('apiKeyModal').style.display = 'none';
    });
    document.getElementById('btnSaveApiKey')?.addEventListener('click', () => {
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
      updateApiKeyStatusBadge();
      document.getElementById('apiKeyModal').style.display = 'none';
      showToast('🔑 Configuração de Chave API salva no seu usuário!');
      processQueueInBackground();
    });

    // Modal Editor de Modelos (Máscaras)
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
        showToast('✅ Modelo atualizado com sucesso!');
        document.getElementById('templatesModal').style.display = 'none';
      }
    });
    document.getElementById('btnResetTemplatesDefault')?.addEventListener('click', () => {
      if (confirm('Restaurar todos os 6 modelos para o texto original padrão?')) {
        localStorage.removeItem('ubs_custom_templates_v1');
        loadCustomOrDefaultTemplates();
        openTemplateEditorModal();
        showToast('🔄 Modelos originais restaurados!');
      }
    });

    // Selecionar Pasta Física no Windows/Mac & Limpeza de Disco
    document.getElementById('btnSelectDiskFolder')?.addEventListener('click', async () => {
      try {
        const folderName = await window.ScribeDB.selectPhysicalFolder();
        document.getElementById('btnSelectDiskFolder').textContent = `📁 Pasta Ativa: ${folderName}`;
        showToast(`📁 Gravações também serão salvas na pasta "${folderName}"!`);
      } catch (err) {
        if (err.name !== 'AbortError') alert(err.message);
      }
    });

    document.getElementById('btnClearOldAudios')?.addEventListener('click', async () => {
      if (!confirm('Deseja limpar todos os atendimentos e áudios salvos neste navegador?')) return;
      await window.ScribeDB.clearAllData();
      state.activeConsultationId = null;
      await refreshQueueSidebar();
      await renderActiveConsultationView(null);
      updateStorageStatsUI();
      showToast('🧹 Histórico e áudios locais apagados com sucesso!');
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

  // --- Extrator Inteligente de Blocos (Subjetivo / Objetivo / Avaliação / Conduta) para o PEC ---
  function extractSectionFromText(fullText, sectionKey) {
    const mapHeaders = {
      subjetivo: /(?:4\.\s*)?SUBJETIVO\s*\n([\s\S]*?)(?=\n(?:5\.|6\.|\s*OBJETIVO)|\s*$)/i,
      objetivo: /(?:6\.\s*)?OBJETIVO(?:\s*\(EXAME FÍSICO\))?\s*\n([\s\S]*?)(?=\n(?:7\.|9\.|\s*AVALIAÇÃO)|\s*$)/i,
      avaliacao: /(?:9\.\s*)?AVALIAÇÃO[^\n]*\n([\s\S]*?)(?=\n(?:10\.|\s*CONDUTA)|\s*$)/i,
      conduta: /(?:10\.\s*)?CONDUTA\s*\n([\s\S]*?)$/i
    };
    const regex = mapHeaders[sectionKey];
    if (!regex) return fullText;
    const match = fullText.match(regex);
    return match && match[1] ? match[1].trim() : fullText;
  }

  // --- Utilitários de UI ---
  function updateRecordingControlsUI() {
    const btnStart = document.getElementById('btnStartRec');
    const btnPause = document.getElementById('btnPauseRec');
    const btnStop = document.getElementById('btnStopRec');
    const statusDot = document.getElementById('recStatusDot');
    const statusLabel = document.getElementById('recStatusLabel');

    if (state.isRecording) {
      btnStart.style.display = 'none';
      btnPause.style.display = 'inline-flex';
      btnStop.style.display = 'inline-flex';
      btnPause.textContent = state.isPaused ? '▶️ Retomar Gravação' : '⏸️ Pausar';
      statusDot.className = state.isPaused ? 'rec-dot paused' : 'rec-dot active';
      statusLabel.textContent = state.isPaused
        ? 'Gravação Pausada (blocos salvos no disco)'
        : 'Gravando consulta (salvando no disco a cada 3s)...';
    } else {
      btnStart.style.display = 'inline-flex';
      btnPause.style.display = 'none';
      btnStop.style.display = 'none';
      statusDot.className = 'rec-dot';
      statusLabel.textContent = 'Pronto para gravar';
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
      el.textContent = `💽 Disco: ${stats.totalAudioMB} MB (${stats.consultationCount} atend.)`;
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
