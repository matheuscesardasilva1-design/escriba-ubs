// ============================================================================
// MODELOS DE EVOLUÇÃO UBS & PROMPTS CLÍNICOS (SEMIOLOGIA + RESGUARDO JURÍDICO)
// ============================================================================

window.DEFAULT_TEMPLATES = {
  geral: {
    id: 'geral',
    name: 'Consulta Geral (SOAP)',
    badge: 'Clínica / APS',
    icon: '🩺',
    description: 'Demanda espontânea, agendada, retorno médico, Hiperdia, Saúde Mental e intercorrências agudas.',
    templateText: `## DEMANDA ESPONTÂNEA ##

#
# MUC:
# Tabagista:
# Alergias:

SUBJETIVO
Paciente vem em consulta em decorrência de 

OBJETIVO
BEG, LOC, MUC

AVALIAÇÃO


CONDUTA
Oriento sinais de alarme e na presença emergência. Ciente. 
Orientações gerais
Ciente, concordante e sem dúvidas`
  },

  prenatal: {
    id: 'prenatal',
    name: 'Consulta de Pré-Natal',
    badge: 'Obstetrícia APS',
    icon: '🤰',
    description: 'Acompanhamento de Pré-Natal de Risco Habitual ou Alto Risco na UBS.',
    templateText: `## CONSULTA DE PRÉ-NATAL ##
# G PV PC A
# IG  POR ECO COM  SEM EM 
# TS: 
# TOXO: 
# SOROLOGIAS:
- 
# VACINAS:
- DT: 
- DTPA: 
- VSR: 
- Hepatite B: 
- Influenza: 
- COVID: 
# Consulta odontologia: 
# MUC: 
# Tabagista: 
# Alergias: 

SUBJETIVO
Paciente vem em consulta de pré-natal. Paciente refere estar bem, sem queixas. Nega sangramento vaginal. Nega perda de líquido. Nega febre. Nega cefaleia e escotomas. Nega disúria, polaciúria e incontinência urinária. Fazendo uso corretamente de sulfato ferroso. Sem demais queixas

OBJETIVO
BEG, LOC, MUC
AU:  CM
BCF:  BPM
MF: 
Edema em membros inferiores: 
Peso: 
PA:  mmHg
ABD: Globoso, indolor a palpação superficial e profunda

AVALIAÇÃO
Gestação de risco habitual em curso ou alto risco

CONDUTA
Parabenizo paciente sobre acompanhamento no PN
Oriento sobre pródromos de TP
Oriento sinais de alarme e, na presença, procurar atendimento médico imediatamente
Orientações gerais
Retorno em X dias com enfermagem ou médico
Ciente, concordante e sem dúvidas`
  },

  puericultura: {
    id: 'puericultura',
    name: 'Puericultura (c/ Z-Score)',
    badge: 'Pediatria APS',
    icon: '👶',
    description: 'Acompanhamento infantil com histórico perinatal, aleitamento/fórmula, DNPM, triagem neonatal e Z-Scores OMS.',
    templateText: `## CONSULTA DE PUERICULTURA - X MESES ##

# 
# MUC:
# Alergias: 
# Histórico do parto
- Idade por capurro: 
- Comprimento: cm | PC:  | PN: g | TS:  | CD: 
- APGAR: 
- Intercorrências: Nenhuma
# Triagem neonatal:
>> Orelhinha: normal
>> olhinho: normal bilateral
>> coraçãozinho: normal (MSD % / MIE: %)
>> Pezinho: normal
# Vacinas:

SUBJETIVO
Paciente vem acompanhado(a) da mãe [inserir grau de parentesco e nome do familiar se falado no áudio, ex.: da mãe Silvia]. Familiar relata que paciente está bem.
Alimentação: [descrever se SME, complementado, misto ou fórmula infantil — se fórmula, especificar qual marca/tipo, volume em ml, diluição/medidas e intervalo/frequência].
Em uso corretamente de sulfato ferroso e vitamina AD. Paciente dorme em. Paciente reside com. Nega queda da própria altura. Paciente com exposição à tela de. Paciente frequentando creche. Nega intercorrências ou necessidade de consultas médicas entre as consultas de puericultura. Familiar sem demais queixas

OBJETIVO
BEG, MUC, ativo, eupneico em ar ambiente, anictérico e acianótico
Peso: 
Altura: 
PC: 
IMC: 
Marcos do desenvolvimento: 

AVALIAÇÃO
Criança em desenvolvimento

CONDUTA
Parabenizo familiar sobre cuidados de saúde com paciente
Oriento sobre alimentação/aleitamento, prevenção de quedas, cuidados com paciente, prevenção de IVAS
Orientações gerais
Oriento retorno em X meses com enfermagem ou antes via acolhimento para demandas agudas
Familiar ciente, concordante e sem dúvidas`
  },

  visita_domiciliar: {
    id: 'visita_domiciliar',
    name: 'Visita Domiciliar (VD)',
    badge: 'VD / Acamados',
    icon: '🏠',
    description: 'Visita domiciliar com equipe (Enfermagem/ACS), familiar presente e checklist de pendências para fazer no posto.',
    templateText: `## VISITA DOMICILIAR EM DD/MM/AAAA - REGISTRO POSTERIOR ##

#
# MUC:
# Tabagista:
# Alergias:
# Equipe presente na VD: Enfermeiro(a):  | ACS: 
# Familiar / Cuidador(a) presente na visita:  (Vínculo: )

SUBJETIVO
Visita domiciliar realizada
Paciente 

OBJETIVO
BEG, LOC, MUC

AVALIAÇÃO


CONDUTA
Orientações gerais e sinais de alarme repassados ao paciente e ao familiar/cuidador(a) presente
Ciente, concordante e sem dúvidas

>> PENDÊNCIAS PARA REALIZAR NO POSTO (UBS) PÓS-VISITA:
Receitas / Troca ou ajuste de medicação: 
Solicitação de exames: 
Encaminhamento (Regulação Estadual): 
Outras pendências da equipe: `
  },

  interconsulta: {
    id: 'interconsulta',
    name: 'Interconsulta Enfermagem',
    badge: 'Interconsulta',
    icon: '🤝',
    description: 'Ditado rápido do caso clínico discutido com a Enfermagem, exame físico direcionado, exames e conduta.',
    templateText: `## INTERCONSULTA COM A ENFERMAGEM ##

#
# MUC:
# Alergias:

SUBJETIVO
Realizo interconsulta médica a pedido da equipe de Enfermagem.
Paciente avaliado(a) em decorrência de 

OBJETIVO
BEG, LOC, MUC

AVALIAÇÃO


CONDUTA
Caso discutido e conduta alinhada com equipe de Enfermagem
Oriento sinais de alarme e, na presença destes, procurar atendimento médico / emergência imediatamente
Orientações gerais
Ciente, concordante e sem dúvidas`
  },

  lgbt_primeira: {
    id: 'lgbt_primeira',
    name: 'LGBTQIAP+ (1ª Consulta)',
    badge: 'População Trans / THAG',
    icon: '🏳️‍⚧️',
    description: 'Primeira consulta médica de acolhimento, avaliação clínica e Terapia Hormonal (THAG).',
    templateText: `## ATENDIMENTO DA PESSOA LGBTQIAP+ (CONSULTA MÉDICA - PRIMEIRA CONSULTA) ##
1. IDENTIFICAÇÃO E ORIGEM
Nome Social: 
Nome de Registro: 
UBS de Origem: 
Profissão: 
Pronomes: ( ) Ela/Dela  ( ) Ele/Dele  ( ) Neutros ( ) Outros: 
Identidade de Gênero: ( ) Mulher trans ( ) Homem trans ( ) Travesti ( ) Pessoa não binária
Tempo de identificação com o gênero: 
Orientação sexual: ( ) Heterossexual ( ) Homossexual ( ) Bissexual ( ) Pansexual ( ) Assexual
2. DOCUMENTAÇÃO E CONSENTIMENTO (DADOS PERMANENTES)
Termo de Consentimento Livre e Esclarecido (TCLE):
( ) Assinado em: 
( ) Ainda não assinado / Pendente de assinatura
Retificação de Documentos (Nome/Gênero): ( ) Concluída ( ) Em andamento ( ) Não iniciada
3. HISTÓRICO CLÍNICO E COMORBIDADES
Comorbidades:
# 
# 
Medicações em uso:
Tabagismo: 
Etilismo: 
Alergias: 
4. SUBJETIVO
Paciente vem em consulta para 

Expectativas e Transformações Corporais Desejadas:
( ) Redistribuição de gordura ( ) Mudança vocal ( ) Pelos/Barba ( ) Desenvolvimento mamário ( ) Amenorreia
5. TERAPIA HORMONAL DE AFIRMAÇÃO DE GÊNERO (THAG)
Status de Uso: ( ) Virgem de tratamento ( ) Uso atual ( ) Uso prévio interrompido
Hormônio / Dose / Via: 
Tempo total de uso: 
Origem do uso: ( ) Prescrição médica ( ) Autogestão (conta própria/internet)

6. OBJETIVO (EXAME FÍSICO)
Peso:  kg 
Altura:  m 
IMC: 
PA:  mmHg
Circunferência Abdominal:  cm

7. RASTREAMENTOS (BASEADO EM ÓRGÃOS PRESENTES)
Citopatológico (Colo Uterino): 
Indicação: Homens trans/NB com colo presente; bienal após 25 anos ou conforme início da vida sexual
( ) Realizado em:  
( ) Pendente

Mamografia / USG Mamas: 
Indicação: Mulheres trans após 5-10 anos de THAG e idade >50; Homens trans se houver tecido mamário residual
( ) Realizado em: 
( ) Pendente:

Avaliação de Próstata: 
Indicação: Mulheres trans/NB com próstata presente; seguir critérios de rastreio por idade ou risco familiar
( ) PSA: 
( ) Toque retal (se indicado)
( ) Pendente

Desejo Reprodutivo / Gestação: ( ) Sim ( ) Não
Indicação: Possibilidade biológica de gestação em Homens Trans, Pessoas Não Binárias e Intersexo com útero e ovários preservados
Contracepção atual: 

8. SOROLOGIAS E INFECTOLOGIA
( ) Exames ainda não realizados / Aguardando coleta
Data da última coleta: 
Sífilis: 
HIV: 
Hepatite B: 
Hepatite C: 
9. AVALIAÇÃO E CRITÉRIOS
Hipótese Diagnóstica: ( ) Incongruência de Gênero | ( ) Transexualismo
Critérios Clínicos Observados:
( ) Incongruência acentuada e persistente entre o gênero experienciado e o sexo atribuído.
( ) Desejo de viver e ser aceito como uma pessoa do gênero experienciado.
( ) Desejo de se livrar de características sexuais primárias/secundárias.
( ) Desejo de adquirir características sexuais primárias/secundárias do gênero experienciado.
( ) Duração dos sintomas superior a 6 meses e sofrimento clinicamente significativo.
10. CONDUTA
Oriento sobre efeitos esperados, tempo de início das transformações e potenciais riscos/efeitos adversos da THAG
Oriento sinais de alarme (eventos tromboembólicos, alterações visuais, dor torácica, dispneia, cefaleia intensa) e na presença procurar emergência imediatamente. Ciente.
Orientações gerais e acolhimento
Ciente, concordante e sem dúvidas`
  },

  lgbt_seguimento: {
    id: 'lgbt_seguimento',
    name: 'LGBTQIAP+ (Seguimento)',
    badge: 'Seguimento THAG',
    icon: '🏳️‍🌈',
    description: 'Consulta médica de retorno/seguimento da população LGBTQIAP+ e ajuste/monitoramento de THAG.',
    templateText: `## ATENDIMENTO DA PESSOA LGBTQIAP+ (CONSULTA MÉDICA - SEGUIMENTO) ##
1. IDENTIFICAÇÃO E ORIGEM
Nome Social: 
Nome de Registro: 
UBS de Origem: 
Profissão: 
Pronomes: ( ) Ela/Dela  ( ) Ele/Dele  ( ) Neutros ( ) Outros: 
Identidade de Gênero: ( ) Mulher trans ( ) Homem trans ( ) Travesti ( ) Pessoa não binária
Tempo de identificação com o gênero: 
Orientação sexual: ( ) Heterossexual ( ) Homossexual ( ) Bissexual ( ) Pansexual ( ) Assexual
2. DOCUMENTAÇÃO E CONSENTIMENTO (DADOS PERMANENTES)
Termo de Consentimento Livre e Esclarecido (TCLE):
( ) Assinado em: 
( ) Ainda não assinado / Pendente de assinatura
Retificação de Documentos (Nome/Gênero): ( ) Concluída ( ) Em andamento ( ) Não iniciada
3. HISTÓRICO CLÍNICO E COMORBIDADES
Comorbidades:
# 
# 
Medicações em uso:
Tabagismo: 
Etilismo: 
Alergias: 
4. SUBJETIVO
Paciente vem em consulta para 

Expectativas e Transformações Corporais Desejadas:
( ) Redistribuição de gordura ( ) Mudança vocal ( ) Pelos/Barba ( ) Desenvolvimento mamário ( ) Amenorreia
5. TERAPIA HORMONAL DE AFIRMAÇÃO DE GÊNERO (THAG)
Status de Uso: ( ) Virgem de tratamento ( ) Uso atual ( ) Uso prévio interrompido
Hormônio / Dose / Via: 
Tempo total de uso: 
Origem do uso: ( ) Prescrição médica ( ) Autogestão (conta própria/internet)

6. OBJETIVO (EXAME FÍSICO)
Peso:  kg 
Altura:  m 
IMC: 
PA:  mmHg
Circunferência Abdominal:  cm

7. RASTREAMENTOS (BASEADO EM ÓRGÃOS PRESENTES)
Citopatológico (Colo Uterino): 
Indicação: Homens trans/NB com colo presente; bienal após 25 anos ou conforme início da vida sexual
( ) Realizado em:  
( ) Pendente

Mamografia / USG Mamas: 
Indicação: Mulheres trans após 5-10 anos de THAG e idade >50; Homens trans se houver tecido mamário residual
( ) Realizado em: 
( ) Pendente:

Avaliação de Próstata: 
Indicação: Mulheres trans/NB com próstata presente; seguir critérios de rastreio por idade ou risco familiar
( ) PSA: 
( ) Toque retal (se indicado)
( ) Pendente

Desejo Reprodutivo / Gestação: ( ) Sim ( ) Não
Indicação: Possibilidade biológica de gestação em Homens Trans, Pessoas Não Binárias e Intersexo com útero e ovários preservados
Contracepção atual: 

8. SOROLOGIAS E INFECTOLOGIA
( ) Exames ainda não realizados / Aguardando coleta
Data da última coleta: 
Sífilis: 
HIV: 
Hepatite B: 
Hepatite C: 
9. AVALIAÇÃO E CRITÉRIOS
Hipótese Diagnóstica: ( ) Incongruência de Gênero | ( ) Transexualismo
Critérios Clínicos Observados:
( ) Incongruência acentuada e persistente entre o gênero experienciado e o sexo atribuído.
( ) Desejo de viver e ser aceito como uma pessoa do gênero experienciado.
( ) Desejo de se livrar de características sexuais primárias/secundárias.
( ) Desejo de adquirir características sexuais primárias/secundárias do gênero experienciado.
( ) Duração dos sintomas superior a 6 meses e sofrimento clinicamente significativo.
10. CONDUTA
Oriento sobre manutenção/ajustes de THAG, adesão e monitoramento laboratorial
Oriento sinais de alarme (eventos tromboembólicos, alterações visuais, dor torácica, dispneia, cefaleia intensa) e na presença procurar emergência imediatamente. Ciente.
Orientações gerais e acolhimento
Ciente, concordante e sem dúvidas`
  }
};

// ============================================================================
// DETECTOR INTELIGENTE DE EXAMES LABORATORIAIS E DE IMAGEM NAS ANOTAÇÕES RÁPIDAS
// ============================================================================
window.detectExamsInText = function(rawText) {
  const txt = String(rawText || '').trim();
  if (!txt) {
    return { hasLab: false, hasImaging: false, hasAny: false };
  }

  const labRegex = /\b(?:hb|ht|hemoglobina|hemat[oó]crito|hemacias|hem[aá]cias|eritr[oó]citos|vcm|hcm|rdw|leuc[oó]citos|leuco|plaquetas|plaq|glicose|glicemia\s+de\s+jejum|gj|hba1c|hemoglobina\s+glicada|glicada|creatinina|creat|ureia|tfg|ckd-epi|s[oó]dio|pot[aá]ssio|c[aá]lcio|magn[eé]sio|f[oó]sforo|[aá]cido\s+[uú]rico|tgo|tgp|ast|alt|ggt|gama\s*gt|fosfatase\s+alcalina|bilirrubina|colesterol|ct\s+\d|hdl|ldl|vldl|triglicer[ií]deos|triglic[eé]rides|tag\s+\d|tsh|t4\s*l|t4\s+livre|t3|vitamina\s+[bd]|vit\.?\s*b12|vit\.?\s*d|ferritina|ferro\s+s[eé]rico|transferrina|psa|pcr|vhs|equ|eas|urina\s+tipo|urocultura|parasitol[oó]gico|epf|sangue\s+oculto|vdrl|fta-abs|hiv|hbsag|anti-hbs|anti-hcv|toxoplasmose|rub[eé]ola|cmv|beta-hcg|hemograma|lipidograma|coagulograma|tap|inr|ttpa|labs)\b|(?:mg\/dl|g\/dl|meq\/l|uui\/ml|mui\/ml|ng\/ml|pg\/ml|\/mm3|\/ul)/i;

  const imagingRegex = /\b(?:usg|ultrassom|ultrassonografia|ecografia|eco\s+(?:abdominal|abdome|obst[eé]trica|mam[aá]ria|tireoide|pelvica|p[eé]lvica|transvaginal|pr[oó]stata|vias\s+urin[aá]rias|rins|partes\s+moles|ombro|joelho|punho|cotovelo|tornozelo|cervical)|ecocardio|ecocardiograma|raio-x|raio\s+x|rx\s+(?:de\s+)?(?:t[oó]rax|coluna|seios|abdome|joelho|ombro|bacia|m[aã]o|punho|p[eé])|radiografia|tomografia|tc\s+(?:de\s+)?(?:cr[aâ]nio|t[oó]rax|abdome|coluna|seios)|angiotc|resson[aâ]ncia|rm\s+(?:de\s+)?(?:cr[aâ]nio|coluna|joelho|ombro|pelve|abdome)|rmn|mamografia|mmg|bi-?rads|ti-?rads|densitometria|dmo|endoscopia|eda|colonoscopia|retossigmoidoscopia|doppler|duplex|ecg|eletrocardiograma|holter|teste\s+ergom[eé]trico|ergometria|espirometria|eletroneuromiografia|enmg|eletroencefalograma|eeg|cintilografia|pet-ct|colposcopia|citopatol[oó]gico|papanicolau|anatomopatol[oó]gico|bi[oó]psia)\b/i;

  const hasLab = labRegex.test(txt);
  const hasImaging = imagingRegex.test(txt);
  return {
    hasLab,
    hasImaging,
    hasAny: hasLab || hasImaging
  };
};

// ============================================================================
// EXTRATOR E ESTRUTURADOR DETERMINÍSTICO DA EVOLUÇÃO ANTERIOR (BLINDAGEM DE #,
// SUB-ITENS "-", IG POR ECO, VACINAS, SOROLOGIAS E HISTÓRICO DE EXAMES)
// ============================================================================
window.parsePreviousConsultationData = function(prevRawText) {
  const raw = String(prevRawText || '').trim();
  if (!raw) return null;

  const lines = raw.split(/\r?\n/);
  const headerLines = [];
  const headerGroups = []; // Cada grupo: { hashLine: '# ...', subLines: ['- ...', '> ...'] }
  const labExamLines = [];
  const usgExamLines = [];
  const avaliacaoLines = [];
  const condutaLines = [];

  let currentSection = 'header';
  let currentGroup = null;
  let currentUsgEntry = [];

  const flushUsgEntry = () => {
    if (currentUsgEntry.length > 0) {
      usgExamLines.push(currentUsgEntry.join('\n').trim());
      currentUsgEntry = [];
    }
  };

  const now = new Date();
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^##.*##$/.test(trimmed)) continue;

    if (/^(?:\d+\.\s*)?SUBJETIVO\b/i.test(trimmed)) {
      currentSection = 'subjetivo';
      continue;
    }
    if (/^(?:\d+\.\s*)?OBJETIVO\b/i.test(trimmed)) {
      currentSection = 'objetivo';
      continue;
    }
    if (/^(?:\d+\.\s*)?EXAMES\s+COMPLEMENTARES\b/i.test(trimmed)) {
      flushUsgEntry();
      currentSection = 'exames_labs';
      continue;
    }
    if (/^(?:\d+\.\s*)?(?:ULTRASSONOGRAFIA|ECOGRAFIA|EXAMES\s+DE\s+IMAGEM)\b/i.test(trimmed)) {
      flushUsgEntry();
      currentSection = 'exames_usg';
      continue;
    }
    if (/^(?:\d+\.\s*)?(?:RASTREAMENTOS|SOROLOGIAS\s+E\s+INFECTOLOGIA|TERAPIA\s+HORMONAL)\b/i.test(trimmed)) {
      flushUsgEntry();
      currentSection = 'other_structured';
      continue;
    }
    if (/^(?:\d+\.\s*)?AVALIA[ÇC][ÃA]O\b/i.test(trimmed)) {
      flushUsgEntry();
      currentSection = 'avaliacao';
      continue;
    }
    if (/^(?:\d+\.\s*)?CONDUTA\b/i.test(trimmed)) {
      flushUsgEntry();
      currentSection = 'conduta';
      continue;
    }

    if (currentSection === 'header') {
      if (!trimmed) continue;
      let processedLine = trimmed;

      // Atualiza automaticamente a IG se houver linha "# IG ... POR ECO COM X SEM EM DD/MM/AAAA" mantendo os dados da Eco intactos!
      const igEcoMatch = processedLine.match(/^#\s*IG\s*(?:(\d+)\s*(?:\+|sem\w*|s)\s*(\d+)?)?\s*POR\s+ECO\s+COM\s+(\d+)\s*SEM[A-Z]*(?:\s*E\s*(\d+)\s*DIAS?)?\s+EM\s+(\d{2})\/(\d{2})\/(\d{4})(.*)$/i);
      if (igEcoMatch) {
        const ecoW = parseInt(igEcoMatch[3], 10);
        const ecoD = parseInt(igEcoMatch[4] || '0', 10);
        const dd = parseInt(igEcoMatch[5], 10);
        const mm = parseInt(igEcoMatch[6], 10);
        const yyyy = parseInt(igEcoMatch[7], 10);
        const tail = igEcoMatch[8] || '';
        const ecoDate = new Date(yyyy, mm - 1, dd, 12, 0, 0);
        if (!isNaN(ecoDate.getTime()) && ecoDate <= todayNoon) {
          const daysElapsed = Math.round((todayNoon - ecoDate) / 86400000);
          const totalDays = (ecoW * 7 + ecoD) + daysElapsed;
          const curW = Math.floor(totalDays / 7);
          const curD = totalDays % 7;
          const ecoWStr = igEcoMatch[3];
          const ecoDStr = igEcoMatch[4] ? ` E ${igEcoMatch[4]} DIAS` : '';
          processedLine = `# IG ${curW}+${curD} POR ECO COM ${ecoWStr} SEM${ecoDStr} EM ${igEcoMatch[5]}/${igEcoMatch[6]}/${igEcoMatch[7]}${tail}`;
        }
      }

      headerLines.push(processedLine);
      if (processedLine.startsWith('#')) {
        currentGroup = { hashLine: processedLine, subLines: [] };
        headerGroups.push(currentGroup);
      } else if ((processedLine.startsWith('-') || processedLine.startsWith('>')) && currentGroup) {
        currentGroup.subLines.push(processedLine);
      }
    } else if (currentSection === 'exames_labs') {
      if (!trimmed) continue;
      if (/^-\s*(?:US|USG|ECO|ECOCARDIO|RX|RAIO|TC|TOMOGRAFIA|RM|RESSON|MAMOGRAFIA)/i.test(trimmed)) {
        flushUsgEntry();
        currentSection = 'exames_usg';
        currentUsgEntry.push(trimmed);
      } else if (trimmed.startsWith('-')) {
        labExamLines.push(trimmed);
      } else if (labExamLines.length > 0) {
        labExamLines[labExamLines.length - 1] += ' ' + trimmed;
      }
    } else if (currentSection === 'exames_usg') {
      if (!trimmed) continue;
      if (trimmed.startsWith('-')) {
        flushUsgEntry();
        currentUsgEntry.push(trimmed);
      } else if (currentUsgEntry.length > 0) {
        currentUsgEntry.push(trimmed);
      }
    } else if (currentSection === 'avaliacao') {
      if (trimmed) avaliacaoLines.push(trimmed);
    } else if (currentSection === 'conduta') {
      if (trimmed) condutaLines.push(trimmed);
    }
  }
  flushUsgEntry();

  const updatedIgGroup = headerGroups.find(g => /^#\s*IG\b/i.test(g.hashLine));

  return {
    headerText: headerLines.join('\n'),
    headerLines,
    headerGroups,
    updatedIgLine: updatedIgGroup ? updatedIgGroup.hashLine : '',
    diagnosesToPromote: [],
    promotedFromAvaliacao: [],
    labExamLines,
    labLines: labExamLines,
    usgExamLines,
    usgLines: usgExamLines,
    avaliacaoText: avaliacaoLines.join('\n'),
    condutaText: condutaLines.join('\n'),
    hasPreviousExams: labExamLines.length > 0 || usgExamLines.length > 0
  };
};

// ============================================================================
// ETAPA 1 DEDICADA: TRANSCRIÇÃO LITERAL PALAVRA POR PALAVRA DE 100% DO ÁUDIO
// ============================================================================
window.buildVerbatimAudioTranscriptionPrompt = function(durationSeconds) {
  const approxMin = durationSeconds ? Math.max(1, Math.round(durationSeconds / 60)) : null;
  return `Você é um transcritor médico forense especialista em consultas da Atenção Primária à Saúde (UBS / SUS).
Sua ÚNICA tarefa nesta etapa é ouvir o áudio anexado do segundo 00:00 até o último segundo${approxMin ? ` (duração aproximada: ${approxMin} min)` : ''} e transcrever LITERALMENTE, PALAVRA POR PALAVRA, 100% de tudo o que foi dito na consulta.

LEI SUPREMA: PROIBIÇÃO ABSOLUTA DE ABREVIAR, RESUMIR OU CORTAR TRECHOS (TRANSCRIÇÃO 100% INTEGRAL):
1. PROIBIÇÃO TOTAL DE ABREVIAR OU SINTETIZAR:
   - O médico precisa desta transcrição completa para compor o prontuário legal do paciente.
   - É TERMINANTEMENTE PROIBIDO resumir falas, omitir perguntas ou respostas, abreviar frases, pular assuntos ou parar a transcrição antes do último segundo da gravação!
   - Transcreva CADA PALAVRA dita pelo médico, paciente e acompanhante, do primeiro segundo até o encerramento do áudio.
2. IDENTIFICAÇÃO DOS INTERLOCUTORES:
   - Inicie cada mudança de fala com "[MÉDICO]: ", "[PACIENTE]: " ou "[ACOMPANHANTE]: " (uma fala por linha para facilitar a leitura completa).
3. CAPTAÇÃO TOTAL DE DETALHES CLÍNICOS (NÃO DEIXE ESCAPAR NADA!):
   - Transcreva todas as queixas, dores, sintomas, história da doença atual e tempo de evolução relatados pelo(a) paciente (mesmo que a voz do paciente esteja mais baixa ou distante do microfone!).
   - Transcreva todas as perguntas feitas pelo médico e todas as confirmações ou negativas do paciente (ex.: se o médico perguntar sobre febre, sangramento, perda de líquido, disúria, cefaleia, escotomas, movimentos fetais, etc., transcreva a pergunta e a resposta!).
   - Transcreva integralmente qualquer relato de passagem por Emergência / Pronto Atendimento / Hospital / Maternidade / UPA, incluindo o que sentiu, quando foi, quais exames ou medicações fez lá.
   - Transcreva todos os nomes de medicamentos citados, dosagens (mg, mcg, UI, gotas), posologias, adesão ou efeitos colaterais.
   - Transcreva todos os valores ditados de pressão arterial (PA), glicemia capilar (HGT), peso, estatura, altura uterina (AU), batimentos cardiofetais (BCF), perímetro cefálico e qualquer achado de exame físico falado pelo médico.
   - Transcreva todos os resultados de exames laboratoriais ou ultrassonografias lidos em voz alta durante a consulta.
   - Transcreva todas as orientações finais, receitas/prescrições, exames solicitados, encaminhamentos, atestados, sinais de alarme e prazo de retorno falados pelo médico até o último segundo do áudio.
4. CAPTAÇÃO OBRIGATÓRIA E INFALÍVEL DO FINAL DA GRAVAÇÃO (RECEITAS, PRESCRIÇÕES E CONDUTAS):
   - O final da gravação médica (últimos minutos) é o momento crítico em que o médico realiza a PRESCRIÇÃO DE MEDICAMENTOS, dita as receitas, explica posologias, doses, quantidades e solicita exames!
   - É TERMINANTEMENTE PROIBIDO cortar ou parar a transcrição antes do último segundo da gravação!
   - Transcreva CADA medicamento prescrito, dosagem exata (mg, mcg, UI, ml, gotas), quantidade de comprimidos/frascos, frequência (de 8/8h, 1x ao dia pela manhã, à noite) e orientações ditadas pelo médico!
   - Se qualquer medicamento prescrito for omitido, a transcrição será considerada INCOMPLETA E NULA!

Responda APENAS com a transcrição literal completa, linha por linha, do início ao fim do áudio (sem blocos markdown e sem comentários extras).`;
};

// ============================================================================
// GERADOR DE PROMPT CLÍNICO PARA EVOLUÇÃO SOAP + PDF DE EXAMES COMPLEMENTARES
// ============================================================================
window.buildMedicalEvolutionPrompt = function(templateObj, quickNotes, zScoreSummary, hasExamFiles, previousEvolutionContext, previousConsultationText, preTranscribedExamsText, soapSubtypeHeader, hasPreTranscribedAudio = false) {
  const todayStr = new Date().toLocaleDateString('pt-BR');
  const notesExamDetection = window.detectExamsInText(quickNotes);
  const parsedPrev = window.parsePreviousConsultationData(previousConsultationText);
  const isPrenatalTemplate = templateObj.id === 'prenatal';
  const hasAnyExamsToFormat = Boolean(
    hasExamFiles ||
    preTranscribedExamsText ||
    notesExamDetection.hasAny ||
    (isPrenatalTemplate && parsedPrev && parsedPrev.hasPreviousExams)
  );

  // Ajusta o título do modelo SOAP Geral conforme a modalidade selecionada (Demanda Espontânea, Consulta Agendada - 0800 ou Retorno Médico)
  let effectiveTemplateText = templateObj.templateText;
  if (templateObj.id === 'geral' && soapSubtypeHeader) {
    effectiveTemplateText = effectiveTemplateText.replace(/^##.*##\s*\n+/m, '');
    effectiveTemplateText = `${soapSubtypeHeader}\n\n${effectiveTemplateText.trim()}`;
  }

  return `Você é um Médico de Família e Comunidade experiente na Atenção Primária à Saúde (UBS / SUS).
Sua missão é produzir uma evolução médica COMPLETA, DETALHADA e IMPECÁVEL, pronta para inserção direta no Prontuário Eletrônico do Cidadão (PEC e-SUS / APS).
${hasPreTranscribedAudio
  ? `Sua tarefa agora é ler minuciosamente CADA LINHA da "TRANSCRIÇÃO LITERAL COMPLETA DO ÁUDIO DA CONSULTA DE HOJE" fornecida abaixo (do início ao fim, sem ignorar nenhuma fala!) e construir uma "evolucao_completa" médica extremamente completa, fiel e detalhada, integrando 100% do que foi conversado na consulta com as notas rápidas, os exames anexados e os dados permanentes da evolução anterior.`
  : `Sua tarefa tem DUAS ETAPAS OBRIGATÓRIAS E SEQUENCIAIS:
ETAPA 1 (TRANSCRIÇÃO INTEGRAL DE 100% DO ÁUDIO): Ouvir o áudio anexado do primeiro ao último segundo (00:00 até o fim) e transcrever literalmente TUDO o que foi dito na chave "transcricao_literal_do_audio" do JSON (identificando "[MÉDICO]:" e "[PACIENTE]:"). É TERMINANTEMENTE PROIBIDO pular, resumir ou ignorar falas da paciente (especialmente relatos de ida à emergência/hospital e todas as queixas relatadas!).
ETAPA 2 (EVOLUÇÃO CLÍNICA ESTRUTURADA): Preencher "evolucao_completa" usando 100% dos fatos reais presentes na sua "transcricao_literal_do_audio", nas notas rápidas, nos exames anexados e nos dados permanentes da evolução anterior.`}

Data de referência de hoje: ${todayStr}.

=== LEI SUPREMA: PROIBIÇÃO TOTAL E ABSOLUTA DE ABREVIAR, RESUMIR OU OMITIR QUALQUER INFORMAÇÃO! ===
O médico depende desta evolução para o registro clínico e resguardo ético-jurídico no prontuário.
- É TERMINANTEMENTE PROIBIDO abreviar histórias, sintetizar em poucas linhas, omitir queixas secundárias, usar reticências "..." ou generalizar com termos vagos como "sintomas habituais", "orientadas medidas", "conforme rotina" ou "prescritos sintomáticos"!
- Você DEVE ouvir e integrar 100% da consulta gravada, das anotações rápidas e dos exames anexados.
- Cada queixa do paciente, cada resposta ao interrogatório sintomatológico, cada achado de exame físico, cada valor de sinal vital, cada diagnóstico avaliado e CADA medicamento prescrito (com nome completo oficial, miligramas, posologia completa e duração) DEVE estar minuciosamente registrado e organizado nas seções corretas do prontuário (SOAP)!
- É TERMINANTEMENTE PROIBIDO inventar nomes de pacientes, nomes de enfermeiros/ACS, nomes de familiares, queixas, história clínica, medicações (MUC), doses, sinais vitais ou exames que NÃO tenham sido efetivamente falados na consulta ou escritos nas notas/evolução prévia!
- ATENÇÃO MÁXIMA A ATENDIMENTO EM EMERGÊNCIA / PRONTO ATENDIMENTO / HOSPITAL:
  * Se a paciente relatar no áudio (ou nas notas) que esteve na Emergência / Pronto Atendimento / Maternidade / Hospital entre as consultas, você DEVE relatar detalhadamente no SUBJETIVO: motivo/queixas que a levaram à emergência, data/local se citados, avaliação realizada, medicações administradas e exames feitos na urgência!
  * E se ela realizou exames laboratoriais ou de imagem na Emergência/Urgência, ao colocá-los em EXAMES COMPLEMENTARES / ULTRASSONOGRAFIA, identifique explicitamente "(REALIZADO NA EMERGÊNCIA / URGÊNCIA)" ao lado da data do exame — JAMAIS jogue exames ou avaliações feitas na emergência como se tivessem sido realizados de forma eletiva na UBS!
- Se um campo do modelo (# Tabagista:, # Alergias:, Enfermeiro(a):, ACS:, Familiar:, etc.) NÃO foi falado no áudio nem consta na evolução prévia, deixe-o VAZIO em branco (sem escrever "Não informado").
- TRAVA OBRIGATÓRIA PARA ÁUDIO DE TESTE / NADA A VER / SILÊNCIO:
  Se o áudio anexado NÃO for uma consulta médica real (por exemplo: teste rápido ou ruído/silêncio) e não houver notas clínicas, evolução prévia nem PDF de exame anexado:
  * Escreva no campo "evolucao_completa" EXATAMENTE:
    "⚠️ Áudio sem conteúdo de consulta médica identificado.\nTranscrição captada no microfone: \"[coloque aqui apenas o que foi falado literalmente no áudio]\""
  * E deixe "codigos_cid_ciap": [].

=== REGRAS CRÍTICAS E OBRIGATÓRIAS (VALEM PARA O PRÉ-NATAL E TODOS OS 7 MODELOS!) ===

1. PADRÃO ESTRITO DO CABEÇALHO "#" (CONDIÇÕES DE SAÚDE, SUB-LINHAS COM TRAÇO "-", GPVPCA, IG POR ECO, VACINAS, SOROLOGIAS, TOXO E MUC):
   - PRESERVAÇÃO FIEL DAS "#" ANTERIORES E PROIBIÇÃO ABSOLUTA DE POLUIR O CABEÇALHO "#" COM FRASES DA AVALIAÇÃO:
     * Quando houver evolução prévia, você DEVE MANTER EXATAMENTE as linhas "#" (ex.: "# HAS", "# Dislipidemia", "# Colelitiase", "# TAG", "# ovolactovegetariana") E TODAS AS SUB-LINHAS COM TRAÇO ("- ...") que já estavam no cabeçalho "#" da evolução anterior (ex.: "- Aguardando com CX geral via gercon", "- Gestação atual não planejada", "- Encaminhada para pneumologia via gercon").
     * É TERMINANTEMENTE PROIBIDO copiar frases descritivas da seção AVALIAÇÃO (antiga ou de hoje) para dentro do cabeçalho "#" do topo! NUNCA escreva no cabeçalho "#" linhas duplicadas ou longas como "# Hipótese: ...", "# Hipertensão arterial sistêmica, controle irregular", "# Dislipidemia, controle insatisfatório", "# Transtorno depressivo maior (em tratamento)", "# Síndrome desabsortiva secundária à colelitíase" ou "# Cistos hepáticos a esclarecer (achado em TC)". As hipóteses e problemas avaliados hoje ficam na seção "AVALIAÇÃO", e NÃO no cabeçalho "#" do topo!
   - PADRÃO OBRIGATÓRIO DO HISTÓRICO OBSTÉTRICO (PARIDADE) NO PRÉ-NATAL:
     * NUNCA assuma "G01" como padrão se a paridade não foi informada!
     * Quando a paridade constar na evolução anterior, nas notas ou for falada no áudio, escreva SEMPRE no formato compacto sem espaços com 2 dígitos após o G: exemplo "# G01PV0PC0A0", "# G02PV1PC0A0", "# G03PV1PC1A0", mantendo na linha de baixo qualquer observação com traço "- " que já existia (ex.: "- Gestação atual não planejada"). Se a paridade não foi informada em lugar nenhum, mantenha "# G PV PC A" em branco para o médico preencher.
   - PADRÃO OBRIGATÓRIO DA IDADE GESTACIONAL ("# IG") E PRESERVAÇÃO DOS DADOS DA ECOGRAFIA:
     * Escreva SEMPRE a IG atual logo após "# IG" no formato "[SEMANAS]+[DIAS]", mantendo obrigatoriamente a informação da ecografia (quantas semanas tinha na eco e a data em que foi realizada):
       Padrão exato: "# IG 16+2 POR ECO COM 08 SEM EM 26/08/2026" (ou "# IG 17+6 POR DUM EM DD/MM/AAAA").
     * É TERMINANTEMENTE PROIBIDO excluir a informação da ecografia anterior ("POR ECO COM X SEM EM DD/MM/AAAA")!
   - PADRÃO OBRIGATÓRIO DE "# SOROLOGIAS:" (DIVIDIDAS POR DATA COM "- DD/MM/AAAA:" E SEPARANDO REAGENTE / NÃO REAGENTE):
     * NUNCA junte datas diferentes de sorologias na mesma linha do título "# SOROLOGIAS:"!
     * O título "# SOROLOGIAS:" fica sozinho na linha, e abaixo dele coloque UMA LINHA POR DATA iniciando com "- DD/MM/AAAA: ", mantendo as datas anteriores e adicionando as novas datas abaixo, indicando claramente cada exame como "NR" (Não reagente) ou "R" / "Reagente":
       Exemplo:
       # SOROLOGIAS:
       - 29/08/2026: TR HIV NR | Hepatite C: NR | Hepatite B: NR | Sífilis: NR
       - 27/10/2026: HTLV I/II Não reagente | Toxo IgG NR IgM NR
   - PADRÃO OBRIGATÓRIO DE "# VACINAS:" NO PRÉ-NATAL (UMA VACINA POR LINHA COM "- "):
     * É TERMINANTEMENTE PROIBIDO agrupar todas as vacinas na mesma linha separadas por "|" !
     * Abaixo de "# VACINAS:", escreva OBRIGATORIAMENTE UMA VACINA POR LINHA iniciando com "- ":
       # VACINAS:
       - DT: [data ou Pendente]
       - DTPA: [data ou Pendente]
       - VSR: [data ou Pendente]
       - Hepatite B: [data ou Pendente]
       - Influenza: [data ou Pendente]
       - COVID: [data ou Pendente]
   - ATUALIZAÇÃO OBRIGATÓRIA DE "# TOXO:" NO CABEÇALHO:
     * Se houver exame de Toxoplasmose (IgM e IgG), atualize obrigatoriamente a linha "# TOXO:" no cabeçalho informando se é Suscetível (IgG NR e IgM NR) ou Imune (IgG R e IgM NR) e registrando explicitamente que o IgM e o IgG foram Não Reagentes (NR) com a respectiva data (mantendo a data anterior e acrescentando a nova data, ex.: "# TOXO: Suscetível em labs 29/08/2026 (IgM NR e IgG NR em 27/10/2026)").
   - REGRA ESTRITA DA "# MUC:" (MEDICAÇÕES EM USO NO MOMENTO DA CONSULTA — SEM MISTURAR DOSES E SEM INCLUIR PRESCRIÇÃO NOVA DE HOJE!):
     * Liste na "# MUC:" as medicações que o paciente já estava em uso ao chegar na consulta de hoje (incluindo as medicações contínuas prescritas na CONDUTA da última consulta, separadas claramente por vírgula com nome + concentração + posologia exata de cada uma, JAMAIS misturando doses de remédios diferentes!).
     * NÃO coloque na "# MUC:" medicações que estão sendo prescritas pela primeira vez na consulta de HOJE!
   - PUERICULTURA (ALIMENTAÇÃO APENAS NO SUBJETIVO):
     * Na Puericultura, NUNCA coloque "# Alimentação:" no cabeçalho "#" inicial! O tópico "Alimentação:" fica dentro do "SUBJETIVO".
   - REGISTRO DO FAMILIAR / ACOMPANHANTE E PROIBIÇÃO DE CONTRADIÇÕES:
     * Se um acompanhante for citado no áudio DE HOJE, registre no início do SUBJETIVO (ex.: "Paciente vem acompanhada do esposo [nome]"). Se não foi citado hoje, não copie acompanhante de consulta antiga!
     * Se a gestante/paciente relatar QUALQUER queixa, dor, sintoma, ida à emergência ou sinal de alarme no áudio, REMOVA IMEDIATAMENTE as frases padrão "Paciente refere estar bem, sem queixas", "Familiar relata que paciente está bem", "Nega intercorrências" e "Sem demais queixas", e apague "Nega [sintoma]" para qualquer sintoma que ela tenha apresentado!

2. REDAÇÃO MÉDICA FORMAL NO SUBJETIVO (PROIBIDO GÍRIAS/ONOMATOPEIAS) + CONTROLE DE HGT E PA DOMICILIAR:
   - LINGUAGEM SEMIOLÓGICA TÉCNICA E ORGANIZAÇÃO EM PARÁGRAFOS CLÍNICOS (QUALIDADE DE MÉDICO DE FAMÍLIA SÊNIOR):
     * Escreva o "SUBJETIVO" SEMPRE em linguagem médica técnica, formal, clara e bem estruturada em parágrafos por tema clínico (1º Motivo da consulta e história da doença atual detalhada; 2º Saúde mental / comorbidades / revisão de sistemas; 3º Adesão e tolerabilidade medicamentosa; 4º Contexto familiar, regulatório ou trabalhista).
     * É TERMINANTEMENTE PROIBIDO escrever gírias, onomatopeias ou coloquialismos chulos no SUBJETIVO (como "desandou", "tipo pruft", "dor de barriga", "fedorenta", "foi na quinta, na sexta, no sábado")! Converta SEMPRE para semiologia médica formal: "dor de barriga" -> "dor abdominal"; "ardor no meio do estômago" -> "epigastralgia e pirose"; "desandou / diarreia tipo pruft fedorenta" -> "diarreia pós-prandial explosiva, de consistência pastosa/líquida e odor fétido"; "fezes brancas" -> "episódio prévio de acolia/hipocolia fecal".
   - CONTROLE DE HGT E CONTROLE DE PA DOMICILIAR SEMPRE NO SUBJETIVO (NUNCA NO OBJETIVO!):
     * Sempre que forem relatados ou lidos valores de Glicemia Capilar (HGT) ou de Pressão Arterial aferidos em domicílio, registre dentro do "SUBJETIVO" ("Controle de HGT: ..." / "Controle de PA: ..."). NUNCA coloque médias domiciliares de PA dentro do "OBJETIVO"!

3. REGRA ESTRITA DO EXAME FÍSICO (OBJETIVO) — PROIBIDO ESCREVER "EXAME FÍSICO NÃO DETALHADO NA TRANSCRIÇÃO":
   - É TERMINANTEMENTE PROIBIDO escrever frases metalinguísticas como "Exame físico não detalhado na transcrição", "além da avaliação dos exames laboratoriais", "Exame físico não realizado" ou "Não mencionado no áudio"!
   - Mantenha SEMPRE a ectoscopia base do modelo ("BEG, LOC, MUC") no "OBJETIVO"!
   - No Pré-Natal, mantenha a linha "ABD: Globoso, indolor a palpação superficial e profunda" (ou atualize-a caso o médico descreva dor à palpação, contrações/dinâmica uterina, Giordano, etc.).
   - Em TODOS os 7 modelos de consulta, sempre que o médico falar no áudio ou escrever nas anotações rápidas QUALQUER sinal vital ou achado de exame físico (PA aferida hoje, FC, Peso, AU, BCF, AP, AC, ABD, MMII, Pele/couro cabeludo, estado afetivo/psíquico observado em consultório, oroscopia, otoscopia, toque vaginal, especular, etc.), inclua-os no bloco "OBJETIVO"!
   - NUNCA copie o exame físico antigo (PA, Peso, AU, BCF da consulta passada) como se fosse o de hoje!

4. REGRA ESTRITA DE EXAMES COMPLEMENTARES (ORGANIZAÇÃO LIMPA E COMPLETA PADRÃO PRONTUÁRIO UBS):
   - ${hasAnyExamsToFormat ? 'Há exames complementares a registrar! Inclua-os logo após o OBJETIVO e antes da AVALIAÇÃO.' : 'Se NÃO houver exames trazidos/anexados/falados na consulta de HOJE, NÃO crie o bloco EXAMES COMPLEMENTARES e NÃO copie exames da evolução antiga.'}
   - ${isPrenatalTemplate
     ? 'NO PRÉ-NATAL (MANUTENÇÃO OBRIGATÓRIA DOS EXAMES DA EVOLUÇÃO ANTIGA + ADIÇÃO DOS NOVOS): Quando houver evolução prévia de Pré-Natal com exames registrados, mantenha todos os exames anteriores ("- LABS [data antiga]: ..." e "- US ... [data antiga]: ...") e inclua os exames novos logo abaixo deles em ordem cronológica.'
     : 'PROIBIÇÃO ABSOLUTA DE COPIAR EXAMES DA EVOLUÇÃO ANTIGA NO SOAP E DEMAIS CONSULTAS: Nesta modalidade de consulta, É TERMINANTEMENTE PROIBIDO copiar os exames ("- LABS ..." ou "- US ...") que estavam na evolução antiga! Registre em EXAMES COMPLEMENTARES SOMENTE os exames novos avaliados/trazidos na consulta de HOJE. Se não houver exames novos hoje, omita a seção EXAMES COMPLEMENTARES.'}
   - FORMATO COMPACTO OBRIGATÓRIO PARA EXAMES LABORATORIAIS (PROIBIDO UNIDADES DE MEDIDA E PROIBIDO SUB-ÍNDICES REDUNDANTES!):
     * Escreva TODOS os exames laboratoriais da mesma data em UMA ÚNICA LINHA iniciando com "- LABS DD/MM/AAAA: " separados por " | ", usando APENAS SIGLAS MÉDICAS CURTAS + VALOR NUMÉRICO (SEM escrever dois-pontos ":" após cada sigla e SEM escrever unidades como mg/dL, g/dL, U/L, milh./mm³, fL, pg, mEq/L, ng/mL, µUI/mL!).
     * É TERMINANTEMENTE PROIBIDO escrever "Hemograma (Eritrócitos: ... | HCM: ... | CHCM: ... | RDW: ... | VPM: ...)", "Glicemia estimada média", "Colesterol Não-HDL" ou "Relação Colesterol Total/HDL"!
     * Use OBRIGATORIAMENTE este padrão limpo de siglas:
       - LABS DD/MM/AAAA: Hb 14,1 | Ht 41 | VCM 89,3 | Leuco 11.300 | Plaq 457.700 | RNI 1,02 | KPTT 35s | GJ 110 | HbA1c 5,8% | CT 154 | HDL 35,4 | LDL 90,8 | TAG 186 | Creat 0,91 | Ureia 19 | TGO 21 | TGP 34 | GGT 231 | BT 0,50 (BD 0,20 / BI 0,30) | FA 84 | PCR 5 | Ferro 114 | Ferritina 267,6 | Transferrina 223,1 | TIBC 274 | TSH 1,40 | T4L 0,57 | B12 294 | Na 139 | K 4,43 | EQU sem alterações | EPF negativo | SOF negativo
   - TÍTULO CORRETO DA SEÇÃO DE EXAMES:
     * Na Consulta Geral (SOAP) e demais consultas fora do Pré-Natal, coloque tanos os exames laboratoriais ("- LABS ...") quanto os exames de imagem ("- TC ...", "- USG ...", "- RX ...", "- ECOCARDIO ...") dentro da seção "EXAMES COMPLEMENTARES" (NUNCA coloque uma Tomografia "- TC" debaixo do título "ULTRASSONOGRAFIA"!).
     * Apenas na Consulta de Pré-Natal separe em "EXAMES COMPLEMENTARES" (para "- LABS") e "ULTRASSONOGRAFIA" (para "- US OBSTÉTRICA / MORFOLÓGICA").
   - PROIBIDO ESCREVER "N/R" OU "Não realizado" para exames que não constam no laudo.

5. REGRA ESTRITA DA AVALIAÇÃO (SEM TRAÇOS "-" E SEM CID-10/CIAP-2 NO TEXTO!):
   - Na seção AVALIAÇÃO da "evolucao_completa", escreva as hipóteses diagnósticas / problemas avaliados na consulta de hoje, sem códigos CID-10/CIAP-2 no texto (os códigos vão apenas no array JSON "codigos_cid_ciap").

6. REGRA ESTRITA DA CONDUTA E PRESCRIÇÕES MÉDICAS (PROIBIÇÃO ABSOLUTA DE OMITIR RECEITAS / PRESCRIÇÕES!):
   - SE O MÉDICO PRESCREVEU QUALQUER MEDICAMENTO NO ÁUDIO, DISSE QUE IA RECEITAR/ORIENTAR OU AJUSTOU UMA MEDICAÇÃO:
     * Você DEVE OBRIGATORIAMENTE listar cada um dos medicamentos prescritos no bloco CONDUTA!
     * Escreva em linhas separadas (sem traço "-"), com nome oficial brasileiro (DCB / ANVISA / RENAME), dosagem exata e posologia clara:
       Exemplos:
       Fluoxetina 20mg: 2 comprimidos pela manhã (uso contínuo)
       Clonazepam 2,5mg/ml: 2 gotas 1x ao dia à noite
       Mirtazapina 15mg: 1/2 comprimido à noite
       Dipirona 500mg: 1 comprimido até de 6/6h se dor ou febre
       Amoxicilina 500mg: 1 cápsula de 8/8h por 7 dias
     * É ERRO MÉDICO GRAVÍSSIMO deixar o bloco CONDUTA vazio ou esquecer de registrar as medicações que o médico prescreveu no consultório!
   - Se o médico renovou receitas de uso contínuo, escreva na CONDUTA: "Renovação de receitas de uso contínuo (conforme # MUC)".
   - NÃO coloque traços ("- ") no início das linhas da CONDUTA.
   - Use sempre a grafia oficial brasileira ("Sinvastatina" com N, "Anlodipino" com N, "Hidroclorotiazida" com I, "Levotiroxina", "Ácido Acetilsalicílico", etc.).
   - Transcreva integralmente todas as medicações prescritas/ajustadas/suspensas hoje, doses, posologias, orientações de uso, exames solicitados, encaminhamentos e sinais de alarme orientados.

7. REGRAS ESPECÍFICAS DE PUERICULTURA (PROIBIÇÃO ABSOLUTA DE INVENTAR Z-SCORE!), PRÉ-NATAL E VISITA DOMICILIAR:
   - Na PUERICULTURA: É TERMINANTEMENTE PROIBIDO calcular ou inventar Z-Score por conta própria! Só escreva Z-Score se o médico verbalizou no áudio ou se vier calculado em "=== DADOS OBJETIVOS / ANTROPOMETRIA / Z-SCORE ===".
   - Na VISITA DOMICILIAR: preencha a data no título, nomes da equipe (Enfermeiro/a e ACS), nome do familiar presente e o checklist final ">> PENDÊNCIAS PARA REALIZAR NO POSTO (UBS) PÓS-VISITA:".

8. BLINDAGEM CONTRA INTERRUPÇÕES DE ENFERMAGEM E DIFERENCIAÇÃO VOZ DO MÉDICO VS. PACIENTE:
   - ${templateObj.id === 'interconsulta' ? 'Este atendimento é uma Interconsulta com a Enfermagem.' : 'Filtre e descarte qualquer interrupção paralela de terceiros/enfermagem falando de outro paciente.'}
   - Quando o [MÉDICO] estiver explicando alterações de exames para o paciente, JAMAIS escreva no SUBJETIVO que "Paciente refere tal alteração".
${parsedPrev ? `
9. IMPORTAÇÃO OBRIGATÓRIA DOS DADOS DA EVOLUÇÃO ANTERIOR (SEM POLUIR AS "#" COM FRASES DA AVALIAÇÃO!):
   - Abaixo estão extraídos da evolução anterior do paciente: (A) o Cabeçalho "#" anterior completo, ${isPrenatalTemplate ? '(B) os Exames Laboratoriais e Ultrassonografias anteriores do Pré-Natal, e (C)' : 'e (B)'} a Avaliação e Conduta da última consulta.
   - ATENÇÃO: O SUBJETIVO e o OBJETIVO antigos foram removidos propositalmente para que você construa o SUBJETIVO e o OBJETIVO de hoje 100% a partir da consulta de HOJE!
   - Siga obrigatoriamente:
     1) Copie FIELMENTE as linhas "#" e as sub-linhas com "-" do "CABEÇALHO # DA EVOLUÇÃO ANTERIOR" abaixo. NUNCA copie frases da AVALIAÇÃO anterior nem da AVALIAÇÃO de hoje para dentro do cabeçalho "#" do topo!
     2) Atualize a linha "# MUC:" com as medicações de uso contínuo que estavam em uso + as medicações contínuas prescritas na "CONDUTA DA ÚLTIMA CONSULTA" (separando cada medicamento claramente com sua própria dose e posologia, sem misturar doses!), excluindo medicações suspensas. Se o paciente não tomou ou suspendeu medicação por conta própria, relate no SUBJETIVO e ajuste a # MUC conforme a conduta atual.
     ${isPrenatalTemplate ? '3) No Pré-Natal, mantenha TODOS os "EXAMES LABORATORIAIS ANTERIORES" em EXAMES COMPLEMENTARES e TODAS as "ULTRASSONOGRAFIAS ANTERIORES" em ULTRASSONOGRAFIA, adicionando os exames novos de hoje logo abaixo deles!' : '3) NÃO copie os exames da evolução anterior! Inclua em EXAMES COMPLEMENTARES apenas os exames novos avaliados hoje.'}

=== (A) CABEÇALHO "#" DA EVOLUÇÃO ANTERIOR (MANTER EXATAMENTE ESTAS LINHAS "#" E SUB-LINHAS "-"!) ===
${parsedPrev.headerText || 'Nenhum cabeçalho anterior.'}
${isPrenatalTemplate ? `
=== (B) EXAMES ANTERIORES DO PRÉ-NATAL (MANTER TODOS E ADICIONAR OS NOVOS ABAIXO!) ===
${parsedPrev.labExamLines.length > 0 ? 'EXAMES COMPLEMENTARES ANTERIORES:\n' + parsedPrev.labExamLines.join('\n') : 'Sem labs anteriores.'}
${parsedPrev.usgExamLines.length > 0 ? '\nULTRASSONOGRAFIAS / IMAGEM ANTERIORES:\n' + parsedPrev.usgExamLines.join('\n\n') : ''}
` : ''}
=== (${isPrenatalTemplate ? 'C' : 'B'}) AVALIAÇÃO E CONDUTA DA ÚLTIMA CONSULTA (APENAS PARA ATUALIZAR # MUC E CHECAR ADESÃO — NÃO COPIAR FRASES DA AVALIAÇÃO PARA AS "#"!) ===
AVALIAÇÃO ANTERIOR:
${parsedPrev.avaliacaoText || 'Não informada.'}
CONDUTA ANTERIOR:
${parsedPrev.condutaText || 'Não informada.'}
` : ''}${previousEvolutionContext ? `\n10. COMPLEMENTAÇÃO DE ATENDIMENTO DO MESMO PACIENTE (CONTINUAÇÃO DE GRAVAÇÃO):\n   - Integre as novas informações faladas neste áudio com a 1ª parte já transcrita deste mesmo paciente:\n=== EVOLUÇÃO DA 1ª PARTE DESTE MESMO PACIENTE ===\n${previousEvolutionContext}\n` : ''}${preTranscribedExamsText ? `\n=== EXAMES COMPLEMENTARES NOVOS JÁ TRANSCRITOS HOJE (INCLUA ABAIXO DOS ANTERIORES SEPARANDO LABS E ULTRASSONOGRAFIA) ===\n${preTranscribedExamsText}\n` : ''}
=== DADOS EXTRAS / NOTAS RÁPIDAS DO MÉDICO HOJE ${notesExamDetection.hasAny ? `(ATENÇÃO: FORAM DETECTADOS EXAMES ${notesExamDetection.hasLab && notesExamDetection.hasImaging ? 'LABORATORIAIS E DE IMAGEM' : (notesExamDetection.hasLab ? 'LABORATORIAIS' : 'DE IMAGEM')} ABAIXO -> FORMATE-OS OBRIGATORIAMENTE EM "EXAMES COMPLEMENTARES" PARA LABS E "ULTRASSONOGRAFIA" PARA ECO/IMAGEM)` : ''} ===
${quickNotes ? quickNotes : 'Nenhuma nota rápida digitada.'}
${zScoreSummary ? '\n=== DADOS OBJETIVOS / ANTROPOMETRIA / CÁLCULO OBSTÉTRICO DE HOJE ===\n' + zScoreSummary : ''}

=== EXEMPLO DE PADRÃO OURO DE QUALIDADE MÉDICA (SIGA ESTE ESTILO LIMPO E FORMAL EM TODOS OS ATENDIMENTOS) ===
## DEMANDA ESPONTÂNEA ##

# HAS
# Diabetes Mellitus tipo 2
# MUC: Losartana 50mg 1cp 12/12h, Metformina 850mg 1cp 2x ao dia
# Tabagista: nega
# Alergias: nega

SUBJETIVO
Paciente comparece por demanda espontânea referindo dor abdominal epigástrica em queimação há 3 dias, associada a pirose e náuseas pós-prandiais. Relata piora dos sintomas após ingestão de café e alimentos gordurosos. Nega vômitos, febre ou alteração do hábito intestinal. Nega perda ponderal.
Refere boa adesão às medicações contínuas habituais para HAS e DM. Nega queixas cardiovasculares ou respiratórias.
Controle de PA: Refere médias domiciliares de 125/80 mmHg.

OBJETIVO
BEG, LOC, corado, hidratado, anictérico, acianótico.
PA: 120/80 mmHg
FC: 74 bpm
Peso: 78 kg
ABD: Plano, flácido, doloroso à palpação superficial e profunda em epigástrio, sem massas ou visceromegalias, descompressão brusca negativa (RHA presentes e normais).

EXAMES COMPLEMENTARES
- LABS 15/09/2026: Hb 14,2 | Ht 42 | Leuco 6.800 | Plaq 240.000 | GJ 108 | HbA1c 6,2% | Creat 0,90 | TGO 22 | TGP 25 | EQU sem alterações

AVALIAÇÃO
Dispepsia funcional / Doença do refluxo gastroesofágico (DRGE)
Hipertensão arterial sistêmica, compensada
Diabetes Mellitus tipo 2, controle glicêmico adequado

CONDUTA
Prescrevo Omeprazol 20 mg: tomar 1 cápsula em jejum pela manhã, 30 minutos antes do café, por 30 dias.
Prescrevo Hidróxido de Alumínio: 1 colher de sopa após as refeições se sintomas refratários.
Mantenho medicações contínuas de uso habitual (Losartana e Metformina).
Oriento medidas dietéticas e comportamentais anti-refluxo (fracionar refeições, evitar deitar logo após comer, cessar café/frituras/refrigerantes).
Oriento sinais de alarme e na presença procurar atendimento médico imediato.
Retorno em 30 dias para reavaliação clínica com enfermagem ou médico.
Ciente, concordante e sem dúvidas.

=== MODELO DE REFERÊNCIA A SER SEGUIDO NESTA CONSULTA ===
${effectiveTemplateText}

=== FORMATO DE RESPOSTA (JSON OBRIGATÓRIO) ===
Responda em JSON válido contendo exatamente estas chaves:
{
  ${hasPreTranscribedAudio ? '' : '"transcricao_literal_do_audio": "Transcrição fiel e INTEGRAL de 100% do que foi falado no áudio do início ao fim separando [MÉDICO]: e [PACIENTE]: (incluindo todas as queixas, relatos de emergência e explicações!)",\n  '}"evolucao_completa": "Texto completo e detalhado da evolução estruturada seguindo fielmente o MODELO DE REFERÊNCIA, incluindo 100% de tudo o que foi dito na consulta e mantendo todas as #, sub-linhas '-' e regras de exames com quebras de linha \\n",
  "codigos_cid_ciap": ["Lista com os códigos CIAP-2 e CID-10 sugeridos para digitar fora da evolução no PEC (ou [] se não houver diagnóstico)"],
  "especialidade_sugerida_encaminhamento": "Se durante a consulta foi citado encaminhamento, informe a especialidade, caso contrário deixe string vazia",
  "alertas_auditoria": ["Lista curta apenas se faltou algum dado crítico obrigatório"]
}`;
};

// ============================================================================
// GERADOR DE PROMPT PARA TRANSCRIÇÃO INSTANTÂNEA DE EXAMES (ANEXOS OU NOTAS RÁPIDAS)
// ============================================================================
window.buildInstantExamTranscriptionPrompt = function(notesText) {
  return `Você é um Médico de Família e Comunidade na APS/UBS.
Analise TODOS os exames complementares fornecidos (sejam arquivos PDF/imagens anexados E/OU exames colados/escritos nas Anotações Rápidas abaixo) e converta 100% dos resultados de exames para o formato padrão de prontuário abaixo.
${notesText ? `\n=== TEXTO COLADO / ESCRITO NAS ANOTAÇÕES RÁPIDAS ===\n${notesText}\n` : ''}
REGRAS OBRIGATÓRIAS:
1. TRANSCREVA 100% DE TODOS OS EXAMES REALIZADOS PRESENTES NO LAUDO/PDF OU NO TEXTO COLADO: Inclua TODOS os exames que tiverem resultado (hemograma completo, bioquímica, função renal, eletrólitos, hepatograma, perfil lipídico, tireoide, hormônios, vitaminas, ferro/ferritina, sorologias, urina/EQU, urocultura, parasitológico, exames de imagem, etc.). Ignore valores de referência do laboratório e cabeçalhos burocráticos.
2. PROIBIDO ESCREVER "N/R" OU "Não realizado": Só inclua exames que efetivamente possuem resultado informado.
3. FORMATO EXATO (DIFERENCIANDO EXAME LABORATORIAL DE EXAME DE IMAGEM):
   - SE FOR EXAME LABORATORIAL (todos os exames da mesma data na mesma linha, iniciando com "- LABS [DD/MM/AAAA]: " ou "- LABS: " se não houver data, separados por " | ", usando abreviações médicas limpas + valor):
     Exemplo: - LABS 17/08/2026: Hb 15,3 | Ht 43,7 | Leuco 6.990 | Plaq 303.000 | GJ 90,9 | HbA1c 4,4% | Creat 0,97 | Ureia 22,2 | Sódio 140 | K 4,6 | TGO 18 | TGP 18 | CT 195,1 | HDL 33,8 | LDL 143,6 | TAG 74 | TSH 0,81 | EQU: pH 6,0, Leucócitos 25/uL
   - SE FOR EXAME DE IMAGEM / MÉTODOS GRÁFICOS (iniciando com "- [MODALIDADE E REGIÃO EM MAIÚSCULO] [DD/MM/AAAA se houver]: " em texto corrido conciso na mesma linha, sem tópicos soltos):
     Exemplo 1: - USG ABDOME TOTAL 12/09/2026: Fígado com dimensões normais e aumento difuso da ecogenicidade compatível com esteatose hepática leve. Demais estruturas sem alterações.
     Exemplo 2: - ECOCARDIO TT 20/11/2025: FE 52,2%. Ventrículo esquerdo com hipertrofia excêntrica, disfunção sistólica global leve por hipocinesia difusa e disfunção diastólica padrão déficit de relaxamento.

Responda APENAS com as linhas formatadas dos exames, prontas para copiar e colar no prontuário, sem títulos extras ou comentários.`;
};

// ============================================================================
// GERADOR DE PROMPT PARA ENCAMINHAMENTO (REGULAÇÃO ESTADUAL / TELESSAÚDE)
// ============================================================================
window.buildReferralPrompt = function({
  templateId,
  templateName,
  evolucaoTexto,
  especialidade,
  prioridade,
  dadosExtrasRegulacao,
  quickNotes
}) {
  return `Você é um Médico Regulador e Médico de Família especialista em protocolos de Regulação Estadual do SUS (SISREG / CROSS / GERCON / Telessaúde).
Sua missão é redigir o TEXTO CLÍNICO DE ENCAMINHAMENTO MÉDICO direto, técnico, fluido e pronto para copiar e colar na caixa de justificativa clínica da Regulação Estadual.

=== CONTEXTO DO ATENDIMENTO ===
- Tipo de Atendimento na UBS: ${templateName} (${templateId})
- Especialidade / Serviço de Destino Solicitado: ${especialidade || 'A definir conforme quadro clínico'}
- Classificação de Prioridade Sugerida: ${prioridade || 'Avaliar conforme critérios clínicos'}
- Exames Prévios / Tratamentos Já Tentados / Dados Extras colados do PEC: ${dadosExtrasRegulacao || 'Vide evolução clínica'}
- Notas Rápidas da Consulta: ${quickNotes || 'Vide evolução clínica'}

=== EVOLUÇÃO CLÍNICA E EXAMES DA CONSULTA ===
${evolucaoTexto}

=== REGRAS DE FORMATAÇÃO DO ENCAMINHAMENTO (SIGA RIGOROSAMENTE) ===
1. PROIBIDO USAR TÍTULOS NUMERADOS BUROCRÁTICOS:
   - NÃO escreva títulos como "1. QUADRO CLÍNICO E HISTÓRIA DA DOENÇA ATUAL (COM TEMPO DE EVOLUÇÃO):", "2. ANTECEDENTES...", "3. EXAME FÍSICO...", nem cabeçalhos longos!
2. FORMATO DE TEXTO CLÍNICO DIRETO E FLUIDO (EM PARÁGRAFOS CURTOS E OBJETIVOS):
   - Escreva diretamente o texto médico de encaminhamento pronto para colar no sistema de regulação:
     * 1º Parágrafo (Quadro Clínico, Antecedentes e MUC): Apresente o paciente, comorbidades prévias, medicações em uso contínuo (com doses) e a história clínica detalhada do problema que motiva o encaminhamento para ${especialidade || 'a especialidade'} (com tempo de evolução, sintomas associados, impacto funcional e tratamentos já tentados na APS).
     * 2º Parágrafo (Exame Físico e Sinais Vitais): Descreva de forma direta os achados relevantes do exame físico, sinais vitais/antropometria (sem inventar dados não examinados).
     * 3º Parágrafo (Exames Complementares Realizados): Cite os resultados dos exames laboratoriais e/ou de imagem já realizados com suas respectivas datas. Se algum exame essencial para a regulação não constar nos dados, deixe indicado de forma limpa "[Inserir data/resultado de ... se disponível]".
     * 4º Parágrafo (Hipótese e Justificativa para Regulação): Encerre com a hipótese diagnóstica e a justificativa objetiva solicitando avaliação/seguimento em ${especialidade || 'atenção especializada'}.

Responda APENAS com o texto clínico limpo do encaminhamento, sem títulos numerados e sem comentários extras antes ou depois.`;
};
