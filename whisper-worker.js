// ============================================================================
// WHISPER LOCAL WORKER (WEBGPU / WASM NO NAVEGADOR — SEM INSTALAR NADA)
// Roda onnx-community/whisper-large-v3-turbo (Máxima Precisão Médica) ou
// onnx-community/whisper-small (Modo Leve p/ PC simples da UBS) em background.
// ============================================================================

let transformersModule = null;
let activePipeline = null;
let activeProfileKey = '';
let activeDeviceUsed = '';
let activeModelIdUsed = '';

const WHISPER_PROFILES = {
  turbo: {
    modelId: 'onnx-community/whisper-large-v3-turbo',
    label: 'Whisper Large V3 Turbo'
  },
  small: {
    modelId: 'onnx-community/whisper-small',
    label: 'Whisper Small'
  }
};

async function loadTransformersLibrary() {
  if (transformersModule) return transformersModule;
  const cdnUrls = [
    'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1',
    'https://esm.sh/@huggingface/transformers@3.8.1'
  ];
  let lastErr = null;
  for (const url of cdnUrls) {
    try {
      const mod = await import(url);
      if (mod && typeof mod.pipeline === 'function') {
        if (mod.env) {
          mod.env.allowLocalModels = false;
          mod.env.useBrowserCache = true;
        }
        transformersModule = mod;
        return mod;
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Não foi possível carregar o motor Transformers.js (${lastErr?.message || 'rede bloqueada'}).`);
}

async function detectWebGpuCapability() {
  try {
    if (typeof navigator === 'undefined' || !navigator.gpu) {
      return { hasWebGpu: false, hasF16: false };
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return { hasWebGpu: false, hasF16: false };
    }
    const hasF16 = Boolean(adapter.features && adapter.features.has('shader-f16'));
    return { hasWebGpu: true, hasF16 };
  } catch (_) {
    return { hasWebGpu: false, hasF16: false };
  }
}

function getDtypeForProfile(profileKey, device, hasF16) {
  if (profileKey === 'small') {
    if (device === 'webgpu') {
      return hasF16
        ? { encoder_model: 'fp16', decoder_model_merged: 'q4' }
        : { encoder_model: 'q4', decoder_model_merged: 'q4' };
    }
    return { encoder_model: 'q8', decoder_model_merged: 'q8' };
  }
  // Padrão: whisper-large-v3-turbo (excelência em português médico)
  if (device === 'webgpu') {
    return hasF16
      ? { encoder_model: 'q4f16', decoder_model_merged: 'q4f16' }
      : { encoder_model: 'q4', decoder_model_merged: 'q4' };
  }
  return { encoder_model: 'q4', decoder_model_merged: 'q4' };
}

function cleanWhisperPortugueseArtifacts(rawText) {
  let t = String(rawText || '').trim();
  if (!t) return '';

  // Remove alucinações clássicas de silêncio do Whisper em português
  const silenceArtifacts = [
    /(?:^|\s)(?:Legendas?\s+pela\s+comunidade\s+Amara\.org|Subt[íi]tulos\s+realizados\s+por\s+la\s+comunidad\s+de\s+Amara\.org|Amara\.org)\.?/gi,
    /(?:^|\s)(?:Obrigado\s+por\s+assistir(?:\s+ao\s+v[íi]deo)?|Obrigada\s+por\s+assistir|Inscreva-se\s+no\s+canal|Curta\s+e\s+compartilhe|Ative\s+o\s+sininho|Deixe\s+seu\s+like)\.?/gi,
    /(?:^|\s)(?:Traduzido\s+por|Legendado\s+por|Revisado\s+por)[^.\n]{0,40}\.?/gi
  ];
  for (const re of silenceArtifacts) {
    t = t.replace(re, ' ');
  }

  // Colapsa eventuais loops repetitivos idênticos (ex: frase repetida 3+ vezes seguidas em ruído)
  t = t.replace(/(\b[^.!?\n]{8,90}[.!?]?)(?:\s+\1){2,}/gi, '$1');
  t = t.replace(/(\b\w+(?:\s+\w+){0,4}\b)(?:,?\s+\1){3,}/gi, '$1');

  return t.replace(/\s{2,}/g, ' ').trim();
}

async function ensureWhisperPipeline(profileKey, requestId) {
  const safeKey = WHISPER_PROFILES[profileKey] ? profileKey : 'turbo';
  const profile = WHISPER_PROFILES[safeKey];

  if (activePipeline && activeProfileKey === safeKey) {
    return {
      pipe: activePipeline,
      device: activeDeviceUsed,
      modelId: activeModelIdUsed,
      label: profile.label
    };
  }

  // Se estava com outro perfil carregado, libera antes de carregar o novo
  if (activePipeline && typeof activePipeline.dispose === 'function') {
    try { await activePipeline.dispose(); } catch (_) {}
  }
  activePipeline = null;
  activeProfileKey = '';

  self.postMessage({
    type: 'status',
    requestId,
    stage: 'loading_lib',
    message: `Preparando motor ${profile.label}...`
  });

  const { pipeline } = await loadTransformersLibrary();
  const gpu = await detectWebGpuCapability();

  const fileProgressMap = new Map();
  const progressCallback = (ev) => {
    if (!ev) return;
    if (ev.status === 'progress' && ev.file) {
      fileProgressMap.set(ev.file, {
        loaded: Number(ev.loaded || 0),
        total: Number(ev.total || 0),
        progress: Number(ev.progress || 0)
      });
      let totalLoaded = 0;
      let totalBytes = 0;
      for (const info of fileProgressMap.values()) {
        totalLoaded += info.loaded;
        totalBytes += info.total;
      }
      const overallPct = totalBytes > 0
        ? Math.min(99, Math.round((totalLoaded / totalBytes) * 100))
        : Math.min(99, Math.round(ev.progress || 0));
      self.postMessage({
        type: 'download_progress',
        requestId,
        file: ev.file,
        percent: overallPct,
        loadedMB: Math.round(totalLoaded / 1048576),
        totalMB: totalBytes > 0 ? Math.round(totalBytes / 1048576) : 0
      });
    } else if (ev.status === 'ready') {
      self.postMessage({
        type: 'status',
        requestId,
        stage: 'ready',
        message: `${profile.label} carregado na memória!`
      });
    }
  };

  // Tenta WebGPU primeiro (se disponível) e cai automaticamente para WASM (CPU) em caso de falha
  const attempts = [];
  if (gpu.hasWebGpu) {
    attempts.push({ device: 'webgpu', dtype: getDtypeForProfile(safeKey, 'webgpu', gpu.hasF16) });
    if (gpu.hasF16 && safeKey === 'turbo') {
      attempts.push({ device: 'webgpu', dtype: { encoder_model: 'q4', decoder_model_merged: 'q4' } });
    }
  }
  attempts.push({ device: 'wasm', dtype: getDtypeForProfile(safeKey, 'wasm', false) });
  if (safeKey === 'turbo') {
    attempts.push({ device: 'wasm', dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' } });
  }

  let lastErr = null;
  for (const attempt of attempts) {
    try {
      self.postMessage({
        type: 'status',
        requestId,
        stage: 'loading_model',
        message: `Carregando ${profile.label} (${attempt.device === 'webgpu' ? 'WebGPU • Acelerado' : 'CPU / WASM'})...`
      });
      const pipe = await pipeline('automatic-speech-recognition', profile.modelId, {
        device: attempt.device,
        dtype: attempt.dtype,
        progress_callback: progressCallback
      });
      activePipeline = pipe;
      activeProfileKey = safeKey;
      activeDeviceUsed = attempt.device;
      activeModelIdUsed = profile.modelId;
      return {
        pipe,
        device: attempt.device,
        modelId: profile.modelId,
        label: profile.label
      };
    } catch (err) {
      lastErr = err;
      fileProgressMap.clear();
    }
  }

  throw new Error(`Falha ao iniciar ${profile.label}: ${lastErr?.message || 'erro desconhecido'}`);
}

self.addEventListener('message', async (event) => {
  const msg = event.data || {};
  const { type, requestId } = msg;

  try {
    if (type === 'check_capabilities') {
      const gpu = await detectWebGpuCapability();
      self.postMessage({
        type: 'capabilities_result',
        requestId,
        hasWebGpu: gpu.hasWebGpu,
        hasF16: gpu.hasF16,
        loadedProfile: activeProfileKey || '',
        loadedDevice: activeDeviceUsed || ''
      });
      return;
    }

    if (type === 'preload') {
      const info = await ensureWhisperPipeline(msg.profile || 'turbo', requestId);
      self.postMessage({
        type: 'preload_done',
        requestId,
        profile: activeProfileKey,
        device: info.device,
        modelId: info.modelId,
        label: info.label
      });
      return;
    }

    if (type === 'transcribe_segment') {
      const info = await ensureWhisperPipeline(msg.profile || 'turbo', requestId);
      const audioData = msg.audio instanceof Float32Array ? msg.audio : new Float32Array(msg.audio);

      let out;
      try {
        out = await info.pipe(audioData, {
          language: 'portuguese',
          task: 'transcribe',
          chunk_length_s: 28,
          stride_length_s: 5,
          return_timestamps: false,
          no_repeat_ngram_size: 4,
          repetition_penalty: 1.1
        });
      } catch (optErr) {
        // Fallback seguro com opções essenciais caso alguma versão do ORT rejeite kwargs extras
        out = await info.pipe(audioData, {
          language: 'portuguese',
          task: 'transcribe',
          chunk_length_s: 28,
          stride_length_s: 5
        });
      }

      const rawText = (out && typeof out.text === 'string') ? out.text : '';
      const cleaned = cleanWhisperPortugueseArtifacts(rawText);

      self.postMessage({
        type: 'segment_done',
        requestId,
        segmentIndex: msg.segmentIndex,
        text: cleaned,
        device: info.device,
        label: info.label
      });
      return;
    }

    if (type === 'unload') {
      if (activePipeline && typeof activePipeline.dispose === 'function') {
        try { await activePipeline.dispose(); } catch (_) {}
      }
      activePipeline = null;
      activeProfileKey = '';
      activeDeviceUsed = '';
      activeModelIdUsed = '';
      self.postMessage({ type: 'unloaded', requestId });
      return;
    }
  } catch (err) {
    self.postMessage({
      type: 'error',
      requestId,
      message: err?.message || String(err)
    });
  }
});
