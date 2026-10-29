// ============================================================================
// CAMADA DE PERSISTÊNCIA NO DISCO (IndexedDB + Streaming Chunks + PDFs de Exames)
// Zero acúmulo de RAM na aba do Chrome: áudio e PDFs ficam seguros no HD/SSD
// ============================================================================

window.ScribeDB = (function() {
  const DB_NAME = 'UBSMedicalScribeDB';
  const DB_VERSION = 2;
  let dbInstance = null;
  let diskFolderHandle = null;

  function openDB() {
    if (dbInstance) return Promise.resolve(dbInstance);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('consultations')) {
          const store = db.createObjectStore('consultations', { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains('audio_chunks')) {
          const chunkStore = db.createObjectStore('audio_chunks', { keyPath: ['consultationId', 'chunkIndex'] });
          chunkStore.createIndex('consultationId', 'consultationId', { unique: false });
        }
        if (!db.objectStoreNames.contains('exam_files')) {
          const examStore = db.createObjectStore('exam_files', { keyPath: 'fileId' });
          examStore.createIndex('consultationId', 'consultationId', { unique: false });
        }
      };
      req.onsuccess = (e) => {
        dbInstance = e.target.result;
        resolve(dbInstance);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function saveConsultation(consultation) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('consultations', 'readwrite');
      tx.objectStore('consultations').put(consultation);
      tx.oncomplete = () => resolve(consultation);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async function getConsultation(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('consultations', 'readonly');
      const req = tx.objectStore('consultations').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function getAllConsultations() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('consultations', 'readonly');
      const req = tx.objectStore('consultations').getAll();
      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => b.createdAt - a.createdAt);
        resolve(list);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // Salva um pedacinho de 3s direto no disco (HD/SSD) e libera a memória RAM
  async function saveAudioChunk(consultationId, chunkIndex, blob, mimeType) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['audio_chunks', 'consultations'], 'readwrite');
      tx.objectStore('audio_chunks').put({
        consultationId,
        chunkIndex,
        blob,
        size: blob.size,
        mimeType: mimeType || blob.type || 'audio/webm',
        savedAt: Date.now()
      });

      const consultStore = tx.objectStore('consultations');
      const getReq = consultStore.get(consultationId);
      getReq.onsuccess = () => {
        const c = getReq.result;
        if (c) {
          c.chunkCount = (c.chunkCount || 0) + 1;
          c.audioBytes = (c.audioBytes || 0) + blob.size;
          c.mimeType = mimeType || c.mimeType || 'audio/webm';
          c.updatedAt = Date.now();
          consultStore.put(c);
        }
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  // Salva PDF ou imagem de exame complementar vinculado à consulta
  async function saveExamFile(consultationId, fileObj) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('exam_files', 'readwrite');
      const record = {
        fileId: 'exam_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        consultationId,
        name: fileObj.name || 'Laudo_Exame.pdf',
        mimeType: fileObj.mimeType || fileObj.type || 'application/pdf',
        size: fileObj.blob ? fileObj.blob.size : (fileObj.size || 0),
        blob: fileObj.blob || fileObj,
        createdAt: Date.now()
      };
      tx.objectStore('exam_files').put(record);
      tx.oncomplete = () => resolve(record);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  // Busca todos os PDFs/imagens de exames vinculados a uma consulta
  async function getExamFilesForConsultation(consultationId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('exam_files', 'readonly');
      const index = tx.objectStore('exam_files').index('consultationId');
      const req = index.getAll(IDBKeyRange.only(consultationId));
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // Reconstrói o arquivo de áudio completo a partir dos pedaços salvos no disco
  async function assembleAudioBlob(consultationId, fallbackMimeType = 'audio/webm') {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audio_chunks', 'readonly');
      const index = tx.objectStore('audio_chunks').index('consultationId');
      const req = index.getAll(IDBKeyRange.only(consultationId));
      req.onsuccess = () => {
        const records = req.result || [];
        if (records.length === 0) {
          resolve(null);
          return;
        }
        records.sort((a, b) => a.chunkIndex - b.chunkIndex);
        const mime = records[0].mimeType || fallbackMimeType;
        const blobs = records.map(r => r.blob);
        resolve(new Blob(blobs, { type: mime }));
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // Exclui apenas os chunks de áudio e PDFs para liberar espaço no HD (mantendo o texto do prontuário)
  async function deleteAudioChunksOnly(consultationId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['audio_chunks', 'exam_files', 'consultations'], 'readwrite');
      const chunkStore = tx.objectStore('audio_chunks');
      const idx = chunkStore.index('consultationId');
      const req = idx.openKeyCursor(IDBKeyRange.only(consultationId));
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          chunkStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      const examStore = tx.objectStore('exam_files');
      const examIdx = examStore.index('consultationId');
      const examReq = examIdx.openKeyCursor(IDBKeyRange.only(consultationId));
      examReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          examStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      const consultStore = tx.objectStore('consultations');
      const getReq = consultStore.get(consultationId);
      getReq.onsuccess = () => {
        const c = getReq.result;
        if (c) {
          c.audioDeleted = true;
          c.audioBytes = 0;
          consultStore.put(c);
        }
      };
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  // Exclui consulta inteira (texto + áudio + PDFs)
  async function deleteConsultation(consultationId) {
    await deleteAudioChunksOnly(consultationId);
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('consultations', 'readwrite');
      tx.objectStore('consultations').delete(consultationId);
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  // Retenção de 30 dias:
  // 1) Exclui automaticamente consultas com mais de 30 dias (maxAgeDays = 30)
  // 2) Para consultas já concluídas com mais de 7 dias, remove apenas os blocos brutos de áudio/PDF para economizar espaço no HD, mas MANTÉM TODAS AS TRANSCRIÇÕES/EVOLUÇÕES E ENCAMINHAMENTOS SALVOS PELOS 30 DIAS!
  async function autoCleanupOldAudio(maxAgeDays = 30) {
    const all = await getAllConsultations();
    const now = Date.now();
    const cutoff30Days = now - maxAgeDays * 24 * 3600 * 1000;
    const cutoff7DaysAudio = now - 7 * 24 * 3600 * 1000;
    let deletedConsultations = 0;

    for (const c of all) {
      if (c.createdAt < cutoff30Days) {
        // Passou de 30 dias -> exclui tudo automaticamente
        await deleteConsultation(c.id);
        deletedConsultations++;
      } else if (c.status === 'done' && !c.audioDeleted && c.createdAt < cutoff7DaysAudio) {
        // Entre 7 e 30 dias -> mantém o texto da evolução e encaminhamento intactos, libera só o áudio pesado
        await deleteAudioChunksOnly(c.id);
      }
    }
    return deletedConsultations;
  }

  async function clearAllData() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['consultations', 'audio_chunks', 'exam_files'], 'readwrite');
      tx.objectStore('consultations').clear();
      tx.objectStore('audio_chunks').clear();
      tx.objectStore('exam_files').clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async function getStorageStats() {
    const all = await getAllConsultations();
    let totalAudioBytes = 0;
    for (const c of all) {
      totalAudioBytes += (c.audioBytes || 0);
    }
    let quota = null;
    if (navigator.storage && navigator.storage.estimate) {
      try {
        quota = await navigator.storage.estimate();
      } catch (_) {}
    }
    return {
      consultationCount: all.length,
      totalAudioBytes,
      totalAudioMB: (totalAudioBytes / (1024 * 1024)).toFixed(1),
      quota
    };
  }

  async function selectPhysicalFolder() {
    if (!window.showDirectoryPicker) {
      throw new Error('Seu navegador não suporta seleção direta de pasta. O salvamento automático no disco interno (IndexedDB) já está ativo!');
    }
    diskFolderHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    return diskFolderHandle.name;
  }

  async function saveBackupToPhysicalFolder(consultation, blob) {
    if (!diskFolderHandle || !blob) return false;
    try {
      const safeName = (consultation.patientLabel || 'Paciente')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 30);
      const dateStr = new Date(consultation.createdAt).toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const ext = (blob.type && blob.type.includes('mp4')) ? 'm4a' : 'webm';
      const fileName = `${dateStr}_${safeName}_${consultation.templateId}.${ext}`;
      const fileHandle = await diskFolderHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return fileName;
    } catch (err) {
      console.warn('Não foi possível salvar cópia extra na pasta física:', err);
      return false;
    }
  }

  return {
    openDB,
    saveConsultation,
    getConsultation,
    getAllConsultations,
    saveAudioChunk,
    saveExamFile,
    getExamFilesForConsultation,
    assembleAudioBlob,
    deleteAudioChunksOnly,
    deleteConsultation,
    autoCleanupOldAudio,
    clearAllData,
    getStorageStats,
    selectPhysicalFolder,
    saveBackupToPhysicalFolder,
    hasPhysicalFolder: () => !!diskFolderHandle
  };
})();
