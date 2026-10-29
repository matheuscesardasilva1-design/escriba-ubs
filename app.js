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
    recentApiCallsTimestamps: [], // Monitora o limite real de Requisições Por Minuto (RPM) da API
    activeReferralId: null,
    selectedMicDeviceId: localStorage.getItem('ubs_selected_mic') || ''
  };

  // Prioriza os modelos FLASH COMPLETOS (muito mais precisos em áudio médico e prescrições do que o Lite!)
  const GEMINI_MODELS = [
    'gemini-2.5-flash',
    'gemini-3-flash-preview',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite'
  ];

  let cachedDiscoveredModels = null;

  async function getActiveGeminiModels(apiKey) {
    if (cachedDiscoveredModels && cachedDiscoveredModels.length > 0) {
      return cachedDiscoveredModels;
    }
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
      if (res.ok) {
        const data = await res.json();
        const available = (data.models || [])
          .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => m.name.replace(/^models\//, ''))
          .filter(name => name.includes('gemini') && !name.includes('embedding') && !name.includes('imagen') && !name.includes('veo') && !name.includes('tts'));

        // Prioriza os modelos Flash completos (não-lite) primeiro para máxima precisão clínica!
        const preferredOrder = [
          'gemini-2.5-flash',
          'gemini-3-flash',
          'gemini-3-flash-preview',
          'gemini-3.5-flash',
          'gemini-2.5-pro',
          'gemini-3.5-flash-lite'
        ];
        const sorted = [];
        preferredOrder.forEach(pref => {
          const match = available.find(a => a === pref || (a.startsWith(pref) && !a.includes('lite')));
          if (match && !sorted.includes(match)) sorted.push(match);
        });
        // Adiciona outros flash não-lite
        available.forEach(a => {
          if (a.includes('flash') && !a.includes('lite') && !sorted.includes(a)) sorted.push(a);
        });
        // Deixa os modelos lite apenas como último fallback de segurança
        available.forEach(a => {
          if (a.includes('lite') && !sorted.includes(a)) sorted.push(a);
        });

        if (sorted.length > 0) {
          cachedDiscoveredModels = sorted.slice(0, 6);
          return cachedDiscoveredModels;
        }
      }
    } catch (_) {}
    return GEMINI_MODELS;
  }

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
    renderPendingExamFilesUI();

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
    const saved = localStorage.getItem('ubs_custom_templates_v6');
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
    localStorage.setItem('ubs_custom_templates_v6', JSON.stringify(state.templates));
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

  function updateTokenMonitorUI() {
    const now = Date.now();
    state.recentApiCallsTimestamps = (state.recentApiCallsTimestamps || []).filter(ts => now - ts < 60000);
    const rpmLastMinute = state.recentApiCallsTimestamps.length;
    const usedCalls = state.dailyConsultationsProcessed || 0;

    const elDaily = document.getElementById('dailyTokenCounter');
    if (elDaily) {
      if (rpmLastMinute >= 12) {
        elDaily.textContent = `🟡 Aguardando fila rápida (${usedCalls} hoje)`;
        elDaily.style.color = '#d97706';
      } else {
        elDaily.textContent = `🟢 Sistema Pronto (${usedCalls} hoje)`;
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

  function updateDocumentTitle() {
    if (state.isRecording) {
      document.title = state.isPaused
        ? `e-SUS APS • Em espera`
        : `e-SUS APS • Em atendimento`;
    } else if (state.queueRunning) {
      document.title = `e-SUS APS • Sincronizando`;
    } else {
      document.title = `Prontuário Clínico APS - Evolução & Regulação`;
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
      });
      container.appendChild(btn);
    });
    togglePuericulturaZScorePanel();
  }

  function togglePuericulturaZScorePanel() {
    const pueriPanel = document.getElementById('puericulturaZScoreBox');
    const pnPanel = document.getElementById('prenatalObjectiveBox');
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
    if (countEl) {
      countEl.textContent = state.pendingExamFiles.length > 0
        ? `${state.pendingExamFiles.length} anexo(s)`
        : 'Nenhum anexo';
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
      await populateMicrophones();

      const mimeType = getSupportedAudioMimeType();
      const recorderOptions = mimeType
        ? { mimeType, audioBitsPerSecond: 24000 }
        : { audioBitsPerSecond: 24000 };

      const recorder = new MediaRecorder(stream, recorderOptions);
      state.mediaRecorder = recorder;

      const patientInput = document.getElementById('patientIdentifier');
      const quickNotesInput = document.getElementById('quickNotesInput');
      const tpl = state.templates[state.selectedTemplateId];
      const now = Date.now();

      let consultId;
      if (state.isContinuingConsultation && state.recordingConsultationId) {
        // Continuação de atendimento do MESMO paciente (após já ter parado/encaminhado a 1ª parte)
        consultId = state.recordingConsultationId;
        const existing = await window.ScribeDB.getConsultation(consultId);
        if (existing) {
          existing.previousEvolutionText = existing.evolutionText || existing.previousEvolutionText || '';
          existing.previousRawTranscript = existing.rawTranscript || existing.previousRawTranscript || '';
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
          createdAt: now,
          updatedAt: now,
          status: 'recording',
          durationSeconds: 0,
          chunkCount: 0,
          examFileCount: 0,
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
      state.templateLocked = true;
      renderTemplateSelector();
      state.timerWorker.postMessage('start');
      await requestWakeLock();
      startVUMeterAndSilenceDetector(stream);
      updateRecordingControlsUI();
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

  // Cancela e exclui a gravação em andamento (com confirmação de segurança)
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
      '⚠️ CONFIRMAÇÃO DE EXCLUSÃO:\n\nTem certeza que deseja CANCELAR e EXCLUIR a gravação deste atendimento?\n\nTodo o áudio captado nesta folha será apagado e não poderá ser recuperado.'
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
    state.templateLocked = false;
    state.recordingConsultationId = null;
    state.recordingSeconds = 0;
    state.pendingExamFiles = [];
    renderPendingExamFilesUI();
    renderTemplateSelector();
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
    showToast('🗑️ Atendimento cancelado e excluído com sucesso.');
  }

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
    const attachedExams = [...state.pendingExamFiles];

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

    state.isRecording = false;
    state.isPaused = false;
    state.isContinuingConsultation = false;
    state.templateLocked = false;
    state.recordingConsultationId = null;
    state.recordingSeconds = 0;
    state.pendingExamFiles = [];
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
      consult.durationSeconds = finalSeconds;
      consult.examFileCount = attachedExams.length;
      consult.quickNotes = currentNotes;
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
          // Linha discreta estática (não dança na tela com a voz para o acompanhante não perceber)
          vuFill.style.width = state.isPaused ? '0%' : '100%';
          vuFill.style.backgroundColor = pct > 3 ? '#93c5fd' : '#cbd5e1';
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
    const tpl = state.templates[state.selectedTemplateId];
    const baseLabel = patientInput ? patientInput.value.trim() : '';
    const currentNotes = (quickNotesInput && quickNotesInput.value) || '';
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
    renderPendingExamFilesUI();
    if (patientInput) patientInput.value = '';
    if (quickNotesInput) quickNotesInput.value = '';
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
    const notes = quickNotesInput ? quickNotesInput.value.trim() : '';
    const attachedExams = [...state.pendingExamFiles];

    if (!notes && attachedExams.length === 0) {
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
      createdAt: now,
      updatedAt: now,
      status: 'queued',
      durationSeconds: 0,
      chunkCount: 0,
      examFileCount: attachedExams.length,
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
    for (const exam of attachedExams) {
      await window.ScribeDB.saveExamFile(consultId, exam);
    }

    state.pendingExamFiles = [];
    renderPendingExamFilesUI();
    if (patientInput) patientInput.value = '';
    if (quickNotesInput) quickNotesInput.value = '';
    showToast('📄 Laudos / Notas enviados para a fila de estruturação!');
    await refreshQueueSidebar();
    await selectConsultationToView(consultId);
    processQueueInBackground();
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
        if (state.activeConsultationId === nextItem.id) {
          await renderActiveConsultationView(nextItem);
        }

        elapsedSec = 0;
        if (banner && bannerText) {
          banner.style.display = 'block';
          banner.style.background = '#eef2ff';
          banner.style.color = '#3730a3';
          bannerText.textContent = `⏳ Transcrevendo e estruturando prontuário: "${nextItem.patientLabel}" (0s)...`;
        }
        if (procInterval) clearInterval(procInterval);
        procInterval = setInterval(() => {
          elapsedSec++;
          if (bannerText) {
            const extraQueue = queuedItems.length > 1 ? ` (+${queuedItems.length - 1} na fila)` : '';
            bannerText.textContent = `⏳ Transcrevendo e estruturando prontuário: "${nextItem.patientLabel}" (${elapsedSec}s)...${extraQueue}`;
          }
          if (state.activeConsultationId === nextItem.id) {
            const editor = document.getElementById('mainEvolutionEditor');
            if (editor && (nextItem.status === 'uploading' || nextItem.status === 'queued')) {
              editor.value = `⏳ Transcrevendo áudio e estruturando evolução clínica... (${elapsedSec}s decorridos)\n\nAguarde alguns instantes — o texto aparecerá nesta tela automaticamente assim que concluir (não precisa clicar em Atualizar).`;
            }
          }
        }, 1000);

        try {
          const result = await processSingleConsultationWithGemini(nextItem, apiKey);
          if (procInterval) clearInterval(procInterval);

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
          showToast(`✅ Evolução pronta: ${nextItem.patientLabel}`);

          if (banner && bannerText) {
            banner.style.background = '#dcfce7';
            banner.style.color = '#166534';
            bannerText.innerHTML = `✅ Prontuário de <strong>${escapeHtml(nextItem.patientLabel)}</strong> concluído em ${elapsedSec}s! <button type="button" id="btnBannerOpenFinished" style="margin-left:10px;padding:3px 10px;border-radius:6px;border:1px solid #166534;background:#fff;color:#166534;font-weight:700;cursor:pointer;">Abrir Evolução Agora</button>`;
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
            bannerText.textContent = `⚠️ Pausa no envio de "${nextItem.patientLabel}": ${nextItem.errorMessage}`;
          }
        }

        await refreshQueueSidebar();
        if (state.activeConsultationId === nextItem.id) {
          const updated = await window.ScribeDB.getConsultation(nextItem.id);
          await renderActiveConsultationView(updated);
        }
      }
    } finally {
      if (procInterval) clearInterval(procInterval);
      state.queueRunning = false;
      updateDocumentTitle();
    }
  }

  // --- Envio Multimodal (Áudio + PDFs de Exames + Notas) para o Gemini ---
  async function processSingleConsultationWithGemini(consultation, apiKey) {
    const tpl = state.templates[consultation.templateId] || window.DEFAULT_TEMPLATES.geral;
    const examFiles = await window.ScribeDB.getExamFilesForConsultation(consultation.id);

    const promptText = window.buildMedicalEvolutionPrompt(
      tpl,
      consultation.quickNotes,
      consultation.zScoreSummary,
      examFiles.length > 0,
      consultation.previousEvolutionText || ''
    );

    const parts = [];

    // 1. Inclui o Áudio da consulta (se houver no disco) ou usa a transcrição literal já salva (caso reprocessado dias depois)
    let hasAudioAttached = false;
    if (consultation.chunkCount > 0 && !consultation.audioDeleted) {
      const audioBlob = await window.ScribeDB.assembleAudioBlob(consultation.id, consultation.mimeType);
      if (audioBlob && audioBlob.size > 0) {
        hasAudioAttached = true;
        const cleanMime = normalizeAudioMimeType(audioBlob, consultation.fileName || '');
        if (audioBlob.size > 15 * 1024 * 1024) {
          const fileUri = await uploadLargeFileToGeminiFileAPI(audioBlob, cleanMime, apiKey);
          parts.push({ fileData: { mimeType: cleanMime, fileUri } });
        } else {
          const base64Audio = await blobToBase64(audioBlob);
          parts.push({ inlineData: { mimeType: cleanMime, data: base64Audio } });
        }
      }
    }
    if (!hasAudioAttached && consultation.rawTranscript) {
      parts.push({ text: `=== TRANSCRIÇÃO LITERAL DO ÁUDIO SALVA ANTERIORMENTE ===\n${consultation.rawTranscript}` });
    }

    // 2. Inclui todos os PDFs / Imagens de Exames Complementares anexados
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

    // 3. Inclui as instruções clínicas e a máscara exata
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

    const parsed = parseGeminiEvolutionResponse(rawText);

    let finalEvolution = parsed.evolucao_completa || rawText;
    // Se não houve exames complementares anexados nem citados, garante que não fique um bloco "EXAMES COMPLEMENTARES\n-" vazio
    if (examFiles.length === 0 && (!parsed.resumo_exames || parsed.resumo_exames.trim() === '' || parsed.resumo_exames.trim() === '-')) {
      finalEvolution = finalEvolution.replace(/\n*EXAMES COMPLEMENTARES\s*\n\s*-\s*(?:Sem novos exames[^\n]*)?\n*/gi, '\n\n');
    }

    const { cleanText, codes } = cleanAndExtractCidFromEvolution(
      finalEvolution,
      Array.isArray(parsed.codigos_cid_ciap) ? parsed.codigos_cid_ciap : []
    );

    return {
      evolutionText: cleanText,
      cidCiapCodes: codes,
      rawTranscript: parsed.transcricao_literal_do_audio || '',
      soapParts: {
        subjetivo: parsed.resumo_subjetivo || '',
        objetivo: parsed.resumo_objetivo || '',
        exames: parsed.resumo_exames || '',
        avaliacao: parsed.resumo_avaliacao || '',
        conduta: parsed.resumo_conduta || ''
      },
      auditAlerts: Array.isArray(parsed.alertas_auditoria) ? parsed.alertas_auditoria : [],
      suggestedSpecialty: parsed.especialidade_sugerida_encaminhamento || '',
      tokensUsed,
      modelUsed
    };
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

    // 3. Extração direta campo a campo via Regex (caso haja aspas ou quebras de linha não escapadas no JSON)
    const extractField = (key) => {
      const re = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 's');
      const m = cleaned.match(re);
      if (!m) return '';
      try {
        return JSON.parse(`"${m[1]}"`);
      } catch (__) {
        return m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
    };

    const evo = extractField('evolucao_completa');
    if (evo) {
      return {
        transcricao_literal_do_audio: extractField('transcricao_literal_do_audio'),
        evolucao_completa: evo,
        resumo_subjetivo: extractField('resumo_subjetivo'),
        resumo_objetivo: extractField('resumo_objetivo'),
        resumo_exames: extractField('resumo_exames'),
        resumo_avaliacao: extractField('resumo_avaliacao'),
        resumo_conduta: extractField('resumo_conduta'),
        especialidade_sugerida_encaminhamento: extractField('especialidade_sugerida_encaminhamento')
      };
    }

    return { evolucao_completa: cleaned };
  }

  function cleanAndExtractCidFromEvolution(evolutionText, existingCodes) {
    let text = evolutionText || '';
    const extractedCodes = Array.isArray(existingCodes) ? [...existingCodes] : [];

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
      if (/^(?:\d+\.\s*)?(?:SUBJETIVO|OBJETIVO|EXAMES COMPLEMENTARES|RASTREAMENTOS|SOROLOGIAS)/i.test(trimmed)) {
        inAvaliacaoOrConduta = false;
      }
      if (inAvaliacaoOrConduta) {
        rawLine = rawLine.replace(/^\s*-\s+/, '');
        // Se já descreveu os sinais de alarme específicos, remove a frase genérica duplicada
        if (hasDetailedAlarmLine && /^Oriento sinais de alarme e(?:,\s*)? na presença/i.test(rawLine.trim())) {
          continue;
        }
      }
      cleanedLines.push(rawLine);
    }

    return { cleanText: cleanedLines.join('\n').trim(), codes: extractedCodes };
  }

  async function callGeminiWithFallbackAndRetry(requestBody, apiKey, onStatusUpdate) {
    let lastError = null;
    const modelsToTry = await getActiveGeminiModels(apiKey);

    for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
      const model = modelsToTry[mIdx];
      const maxAttempts = 2;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          if (onStatusUpdate) {
            onStatusUpdate(attempt > 1 ? `⏳ Tentativa ${attempt} (${model})...` : `⚡ Estruturando (${model})...`);
          }

          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });

          if (res.ok) {
            const responseJson = await res.json();
            updateTokenMonitorUI();
            return { responseJson, modelUsed: model };
          }

          const errData = await res.json().catch(() => ({}));
          const errMsg = errData?.error?.message || `HTTP ${res.status}`;

          if (res.status === 400 && errMsg.toLowerCase().includes('api key')) {
            const elDaily = document.getElementById('dailyTokenCounter');
            if (elDaily) {
              elDaily.textContent = `🔴 Chave API inválida`;
              elDaily.style.color = '#dc2626';
            }
            throw new Error('Credencial de API inválida. Clique em "Credencial API" no topo para verificar.');
          }

          // Se o modelo não estiver disponível na conta (404 ou "no longer available"), pula imediatamente para o próximo modelo!
          if (res.status === 404 || errMsg.toLowerCase().includes('no longer available') || errMsg.toLowerCase().includes('not found')) {
            lastError = new Error(errMsg);
            break;
          }

          if (res.status === 429 || res.status === 503) {
            const elDaily = document.getElementById('dailyTokenCounter');
            const isDailyQuota = /per day|daily|quota exceeded.*day/i.test(errMsg);
            if (elDaily) {
              if (isDailyQuota) {
                elDaily.textContent = `🔴 Cota diária da chave atingida`;
                elDaily.style.color = '#dc2626';
              } else {
                elDaily.textContent = `🟡 Aguardando limite por minuto da chave...`;
                elDaily.style.color = '#d97706';
              }
            }
            lastError = new Error(`Limite (${res.status}): ${errMsg}`);
            if (attempt < maxAttempts) {
              const waitSec = 8 * attempt;
              if (onStatusUpdate) onStatusUpdate(`⏳ Aguardando fila (${waitSec}s)...`);
              await sleep(waitSec * 1000);
              continue;
            }
            break;
          }

          lastError = new Error(errMsg);
          break;
        } catch (networkErr) {
          lastError = networkErr;
          if (networkErr.message && networkErr.message.includes('Credencial de API')) {
            throw networkErr;
          }
          if (attempt < maxAttempts) {
            if (onStatusUpdate) onStatusUpdate(`🌐 Reconectando em 5s...`);
            await sleep(5000);
          }
        }
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
        // Se ficou pendente por limite/cota em um dia anterior, reenvia sozinho ao abrir no outro dia!
        const lastAttemptDay = new Date(c.updatedAt || c.createdAt).toDateString();
        if (lastAttemptDay !== todayStr) {
          c.status = 'queued';
          c.errorMessage = '';
          c.updatedAt = Date.now();
          await window.ScribeDB.saveConsultation(c);
          nextDayAutoQueuedCount++;
        }
      } else if (c.status === 'done' && c.evolutionText && (c.evolutionText.includes('"evolucao_completa"') || /\((?:CID|CIAP)/i.test(c.evolutionText) || /\n-\s+/m.test(c.evolutionText))) {
        // Repara automaticamente qualquer evolução anterior que tenha ficado com JSON bruto, CID ou traços "- " na Avaliação/Conduta!
        if (c.evolutionText.includes('"evolucao_completa"')) {
          const repaired = parseGeminiEvolutionResponse(c.evolutionText);
          if (repaired.evolucao_completa) {
            c.evolutionText = repaired.evolucao_completa;
            if (repaired.transcricao_literal_do_audio && !c.rawTranscript) {
              c.rawTranscript = repaired.transcricao_literal_do_audio;
            }
          }
        }
        const { cleanText, codes } = cleanAndExtractCidFromEvolution(c.evolutionText, c.cidCiapCodes);
        c.evolutionText = cleanText;
        c.cidCiapCodes = codes;
        await window.ScribeDB.saveConsultation(c);
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
      let snippet = '';
      if (item.status === 'done' && item.evolutionText) {
        const cleanEvo = item.evolutionText
          .replace(/^#.*$/gm, '')
          .replace(/\n+/g, ' • ')
          .trim();
        snippet = cleanEvo.slice(0, 240);
      } else if (item.status === 'uploading' || item.status === 'queued') {
        snippet = 'Processando evolução clínica em segundo plano...';
      } else if (item.status === 'error') {
        snippet = 'Pendente de processamento — clique para abrir e atualizar.';
      } else {
        snippet = 'Atendimento em andamento...';
      }

      let statusHTML = '';
      if (item.status === 'recording') {
        statusHTML = `<span class="q-status st-rec" id="qstatus_${item.id}">Em andamento</span>`;
      } else if (item.status === 'queued') {
        statusHTML = `<span class="q-status st-queue" id="qstatus_${item.id}">⏳ Na fila</span>`;
      } else if (item.status === 'uploading') {
        statusHTML = `<span class="q-status st-up" id="qstatus_${item.id}">⚡ Estruturando...</span>`;
      } else if (item.status === 'done') {
        statusHTML = `<span class="q-status st-done" id="qstatus_${item.id}">✅ Pronto</span>`;
      } else if (item.status === 'error') {
        statusHTML = `<span class="q-status st-err" id="qstatus_${item.id}">⚠️ Atualizar</span>`;
      }

      const pecBadge = item.evolvedInPEC
        ? `<span class="q-status st-done" style="background:#dcfce7;color:#166534;">☑️ Evoluído no PEC</span>`
        : `<span class="q-status" style="background:#f1f5f9;color:#475569;">📌 Falta Evoluir</span>`;

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
            <div class="h-snippet">${escapeHtml(snippet)}</div>
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
    if (consult.status === 'uploading' || consult.status === 'queued') {
      editor.value = '⏳ Transcrevendo áudio e estruturando evolução clínica...\n\nAguarde alguns instantes — o texto aparecerá nesta tela automaticamente assim que concluir (não é necessário clicar em Atualizar).';
    } else {
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

  function getCalculatedZScoreText() {
    if (state.selectedTemplateId === 'puericultura') {
      const sex = document.getElementById('zSex')?.value || 'M';
      const months = document.getElementById('zMonths')?.value;
      const weight = document.getElementById('zWeight')?.value;
      const height = document.getElementById('zHeight')?.value;
      const hc = document.getElementById('zHC')?.value;
      const feedingType = document.getElementById('pueriFeedingType')?.value || '';
      const formulaDetails = document.getElementById('pueriFormulaDetails')?.value.trim() || '';

      const lines = [];
      if (months) {
        lines.push(`Idade da criança: ${months} meses`);
      }
      if (feedingType || formulaDetails) {
        lines.push(`Aleitamento / Alimentação Infantil: ${feedingType}${formulaDetails ? ' — Detalhes (fórmula/volume/frequência): ' + formulaDetails : ''}`);
      }

      if (months || weight || height || hc) {
        const calc = window.ZScoreCalculator.calculate({
          sex,
          months: months || 0,
          weightKg: weight,
          heightCm: height,
          hcCm: hc
        });
        if (calc && calc.summaryText) {
          lines.push(calc.summaryText);
        }
      }
      return lines.join('\n');
    }

    if (state.selectedTemplateId === 'prenatal') {
      const ig = document.getElementById('pnIG')?.value.trim() || '';
      const pa = document.getElementById('pnPA')?.value.trim() || '';
      const weight = document.getElementById('pnWeight')?.value.trim() || '';
      const au = document.getElementById('pnAU')?.value.trim() || '';
      const bcf = document.getElementById('pnBCF')?.value.trim() || '';
      const mf = document.getElementById('pnMF')?.value || '';
      const edema = document.getElementById('pnEdema')?.value || '';

      if (!ig && !pa && !weight && !au && !bcf) return '';
      const pnLines = ['DADOS OBJETIVOS DO PRÉ-NATAL INFORMADOS PELO MÉDICO:'];
      if (ig) pnLines.push(`- IG atual: ${ig}`);
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

  function updateZScoreLivePreview() {
    const preview = document.getElementById('zScorePreviewResult');
    if (!preview) return;
    const text = getCalculatedZScoreText();
    preview.textContent = text || 'Preencha idade (meses), medidas e aleitamento acima para incluir automaticamente na evolução.';
  }

  function clearZScoreInputs() {
    ['zMonths', 'zWeight', 'zHeight', 'zHC', 'pueriFeedingType', 'pueriFormulaDetails', 'pnIG', 'pnPA', 'pnWeight', 'pnAU', 'pnBCF'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    updateZScoreLivePreview();
  }

  function getSavedApiKey() {
    return localStorage.getItem('ubs_gemini_api_key') || sessionStorage.getItem('ubs_gemini_api_key') || '';
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
    if (modal) modal.style.display = 'flex';
  }

  function bindUIEvents() {
    document.getElementById('btnStartRec')?.addEventListener('click', startRecording);
    document.getElementById('btnPauseRec')?.addEventListener('click', togglePauseRecording);
    document.getElementById('btnStopRec')?.addEventListener('click', finishRecordingAndQueue);
    document.getElementById('btnCancelRec')?.addEventListener('click', cancelCurrentRecording);
    document.getElementById('btnChangeTemplateModel')?.addEventListener('click', () => {
      state.templateLocked = false;
      renderTemplateSelector();
    });

    // Navegação entre as 2 Telas ("Novo Atendimento" e "Meu Histórico")
    document.getElementById('tabBtnRecord')?.addEventListener('click', () => switchMainPage('pageRecord'));
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

    ['zSex', 'zMonths', 'zWeight', 'zHeight', 'zHC', 'pueriFeedingType', 'pueriFormulaDetails'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', updateZScoreLivePreview);
      document.getElementById(id)?.addEventListener('change', updateZScoreLivePreview);
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
      if (patientInput) patientInput.value = c.patientLabel || '';
      if (quickNotesInput) quickNotesInput.value = c.quickNotes || '';

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
      showToast('🔒 Credencial salva com sucesso!');
      retryAllPendingConsultations();
      processQueueInBackground();
    });

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
        localStorage.removeItem('ubs_custom_templates_v6');
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
      objetivo: /(?:6\.\s*)?OBJETIVO(?:\s*\(EXAME FÍSICO\))?\s*\n([\s\S]*?)(?=\n(?:EXAMES COMPLEMENTARES|7\.|9\.|\s*AVALIAÇÃO)|\s*$)/i,
      exames: /EXAMES COMPLEMENTARES\s*\n([\s\S]*?)(?=\n(?:7\.|9\.|\s*AVALIAÇÃO)|\s*$)/i,
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
      btnPause.textContent = state.isPaused ? 'Retomar Folha' : 'Aguardar';
      statusDot.className = state.isPaused ? 'rec-dot paused' : 'rec-dot active';
      statusLabel.textContent = state.isPaused
        ? 'Folha em espera'
        : 'Folha de atendimento aberta';
    } else {
      btnStart.style.display = 'inline-flex';
      btnPause.style.display = 'none';
      btnStop.style.display = 'none';
      if (btnCancel) btnCancel.style.display = 'none';
      statusDot.className = 'rec-dot';
      statusLabel.textContent = 'Aguardando abertura de folha';
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
