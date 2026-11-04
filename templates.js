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
# G01PV0PC0A0
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

  // Identifica diagnósticos da Avaliação anterior para puxar para as "#" do cabeçalho atual (nos 7 modelos)
  const diagnosesToPromote = [];
  const hasNumberedAvaliacao = avaliacaoLines.some(l => /^\d+[\.\)]/.test(l));
  for (let i = 0; i < avaliacaoLines.length; i++) {
    const rawAv = avaliacaoLines[i];
    // Se começa com ">" (ou se começa com "-" dentro de uma Avaliação numerada), é sub-linha explicativa do diagnóstico acima
    if (rawAv.startsWith('>') || (rawAv.startsWith('-') && hasNumberedAvaliacao)) {
      if (diagnosesToPromote.length > 0) {
        const cleanSub = rawAv.startsWith('>>') ? rawAv : `- ${rawAv.replace(/^[>-]+\s*/, '')}`;
        diagnosesToPromote[diagnosesToPromote.length - 1].subLines.push(cleanSub);
      }
      continue;
    }
    const cleanDiag = rawAv.replace(/^(?:\d+[\.\)]|-)\s*/, '').trim();
    if (!cleanDiag) continue;
    // Ignora frases genéricas de rotina ou checklists estruturais do modelo LGBTQIAP+
    if (/^(?:Gesta[çc][ãa]o\s+de\s+risco\s+habitual|Crian[çc]a\s+em\s+desenvolvimento|Vacinas\s+desatualizadas|Rotina\b|Puericultura\b|Hip[óo]tese\s+Diagn[óo]stica|Crit[ée]rios\s+Cl[íi]nicos|\(\s*[xX ]?\s*\))/i.test(cleanDiag)) {
      continue;
    }
    diagnosesToPromote.push({ hashLine: `# ${cleanDiag}`, subLines: [] });
  }

  const updatedIgGroup = headerGroups.find(g => /^#\s*IG\b/i.test(g.hashLine));
  const promotedFlatLines = [];
  for (const d of diagnosesToPromote) {
    promotedFlatLines.push(d.hashLine);
    for (const s of d.subLines) promotedFlatLines.push(s);
  }

  return {
    headerText: headerLines.join('\n'),
    headerLines,
    headerGroups,
    updatedIgLine: updatedIgGroup ? updatedIgGroup.hashLine : '',
    diagnosesToPromote,
    promotedFromAvaliacao: promotedFlatLines,
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
// GERADOR DE PROMPT CLÍNICO PARA EVOLUÇÃO SOAP + PDF DE EXAMES COMPLEMENTARES
// ============================================================================
window.buildMedicalEvolutionPrompt = function(templateObj, quickNotes, zScoreSummary, hasExamFiles, previousEvolutionContext, previousConsultationText, preTranscribedExamsText, soapSubtypeHeader) {
  const todayStr = new Date().toLocaleDateString('pt-BR');
  const notesExamDetection = window.detectExamsInText(quickNotes);
  const parsedPrev = window.parsePreviousConsultationData(previousConsultationText);
  const hasAnyExamsToFormat = Boolean(
    hasExamFiles ||
    preTranscribedExamsText ||
    notesExamDetection.hasAny ||
    (parsedPrev && parsedPrev.hasPreviousExams)
  );

  // Ajusta o título do modelo SOAP Geral conforme a modalidade selecionada (Demanda Espontânea, Consulta Agendada - 0800 ou Retorno Médico)
  let effectiveTemplateText = templateObj.templateText;
  if (templateObj.id === 'geral' && soapSubtypeHeader) {
    effectiveTemplateText = effectiveTemplateText.replace(/^##.*##\s*\n+/m, '');
    effectiveTemplateText = `${soapSubtypeHeader}\n\n${effectiveTemplateText.trim()}`;
  }

  return `Você é um Médico de Família e Comunidade experiente na Atenção Primária à Saúde (UBS / SUS).
Sua tarefa tem DUAS ETAPAS OBRIGATÓRIAS E SEQUENCIAIS:
ETAPA 1 (TRANSCRIÇÃO INTEGRAL DE 100% DO ÁUDIO): Ouvir o áudio anexado do primeiro ao último segundo (00:00 até o fim) e transcrever literalmente TUDO o que foi dito na chave "transcricao_literal_do_audio" do JSON (identificando "[MÉDICO]:" e "[PACIENTE]:"). É TERMINANTEMENTE PROIBIDO pular, resumir ou ignorar falas da paciente (especialmente relatos de ida à emergência/hospital e todas as queixas relatadas!).
ETAPA 2 (EVOLUÇÃO CLÍNICA ESTRUTURADA): Preencher "evolucao_completa" usando 100% dos fatos reais presentes na sua "transcricao_literal_do_audio", nas notas rápidas, nos exames anexados e nos dados permanentes da evolução anterior.

Data de referência de hoje: ${todayStr}.

=== REGRA 0 (LEI SUPREMA ANTI-ALUCINAÇÃO E DE CAPTAÇÃO INTEGRAL DO ÁUDIO!) ===
- É TERMINANTEMENTE PROIBIDO inventar nomes de pacientes, nomes de enfermeiros/ACS, nomes de familiares, queixas, história clínica, medicações (MUC), doses, sinais vitais ou exames que NÃO tenham sido efetivamente falados no áudio ou escritos nas notas/evolução prévia!
- PROIBIÇÃO ABSOLUTA DE OMITIR QUEIXAS OU FALAS DA PACIENTE: Tudo o que a paciente relatar no áudio DEVE entrar na "transcricao_literal_do_audio" e ser descrito detalhadamente no "SUBJETIVO" da evolução de hoje!
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
   - PRESERVAÇÃO ABSOLUTA DE TODAS AS "#" E SUB-ITENS COM TRAÇO ("- " ou "> ") ENTRE AS HASHTAGS (EM TODOS OS MODELOS):
     * Se houver evolução prévia (ou informações ditadas), você DEVE MANTER 100% DE TODAS AS LINHAS "#" (ex.: "# ovolactovegetariana", "# Histórico de bulimia na infância", "# Apendicectomia em 2017 ou 2018", comorbidades, cirurgias prévias) E TODAS AS INFORMAÇÕES COMPLEMENTARES COM TRAÇO ("- ...") ABAIXO DAS "#" (ex.: "- Gestação atual não planejada" abaixo de "# G01PV0PC0A0", ou "- Fatores de risco..." abaixo de "# Risco aumentado para pré-eclâmpsia"). JAMAIS apague linhas "#" extras ou sub-linhas com "-"!
   - PADRÃO OBRIGATÓRIO DO HISTÓRICO OBSTÉTRICO (PARIDADE) NO PRÉ-NATAL:
     * Escreva SEMPRE no formato compacto sem espaços com 2 dígitos após o G: exemplo "# G01PV0PC0A0" (ou "# G02PV1PC0A0"), mantendo na linha de baixo qualquer observação com traço "- " que já existia (ex.: "- Gestação atual não planejada").
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

2. CONTROLE DE HGT (GLICEMIA CAPILAR) E CONTROLE DE PA (AFERIÇÕES DE PRESSÃO ARTERIAL) + PARECER FINAL NO SUBJETIVO:
   - Sempre que forem falados ou lidos valores de Glicemia Capilar (HGT) ou de Pressão Arterial (Controle de PA residencial) — mesmo que lidos pelo médico — registre no bloco "SUBJETIVO":
     * "Controle de HGT: [todos os valores e horários/períodos + parecer final do médico]."
     * "Controle de PA: [todos os valores e horários/períodos + parecer final do médico]."

3. REGRA ESTRITA DO EXAME FÍSICO (OBJETIVO) — NÃO INVENTE DADOS NÃO FALADOS:
   - NUNCA invente sinais físicos que o médico não falou e NUNCA copie o exame físico (PA, Peso, AU, BCF) da consulta antiga como se fosse o de hoje!
   - No OBJETIVO de hoje, inclua apenas os achados e medidas efetivamente realizados/falados na consulta de HOJE!

4. REGRA ESTRITA DE EXAMES COMPLEMENTARES E ULTRASSONOGRAFIA (MANTER EXAMES ANTERIORES + INCLUIR NOVOS + SEPARAR LABS DE ULTRASSONOGRAFIA):
   - ${hasAnyExamsToFormat ? 'Há exames complementares (atuais e/ou da evolução anterior)! Inclua-os logo após o OBJETIVO e antes da AVALIAÇÃO.' : 'Se NÃO houver exames atuais nem exames na evolução anterior, não crie o bloco EXAMES COMPLEMENTARES.'}
   - MANUTENÇÃO OBRIGATÓRIA DOS EXAMES DA EVOLUÇÃO ANTIGA + ADIÇÃO DOS NOVOS:
     * Quando houver evolução prévia com exames registrados, você DEVE MANTER TODOS OS EXAMES ANTERIORES ("- LABS [data antiga]: ..." e "- US ... [data antiga]: ...") E INCLUIR OS EXAMES NOVOS LOGO ABAIXO DELES em ordem cronológica! JAMAIS apague os exames anteriores!
   - SEPARAÇÃO ESTRITA ENTRE EXAMES LABORATORIAIS E ULTRASSONOGRAFIA / IMAGEM:
     * NUNCA misture exames laboratoriais com laudos de ultrassonografia no mesmo bloco!
     * Coloque todos os exames laboratoriais (sangue, urina/EQU, urocultura, sorologias, bioquímica, hormônios) sob o título:
       EXAMES COMPLEMENTARES
       - LABS [DD/MM/AAAA]: [todos os exames daquela data na mesma linha separados por " | "]
       (Se o exame foi feito em pronto-socorro/hospital, escreva: "- LABS [DD/MM/AAAA] (REALIZADO NA EMERGÊNCIA / HOSPITAL): ...")
     * Coloque todas as ultrassonografias / ecografias (e exames de imagem) sob o título separado logo abaixo:
       ULTRASSONOGRAFIA
       - US OBSTÉTRICA [DD/MM/AAAA]: [descrição completa do laudo e conclusão com biometria/IG estimada]
       - US MORFOLÓGICA [DD/MM/AAAA]: [descrição completa do laudo e conclusão]
   - PROIBIDO ESCREVER "N/R" OU "Não realizado" para exames que não constam no laudo.

5. REGRA ESTRITA DA AVALIAÇÃO (SEM TRAÇOS "-" E SEM CID-10/CIAP-2 NO TEXTO!):
   - Na seção AVALIAÇÃO da "evolucao_completa", escreva as hipóteses diagnósticas / problemas avaliados na consulta de hoje, sem códigos CID-10/CIAP-2 no texto (os códigos vão apenas no array JSON "codigos_cid_ciap").

6. REGRA ESTRITA DA CONDUTA E ORTOGRAFIA FARMACOLÓGICA OFICIAL DO BRASIL (DCB / ANVISA / RENAME):
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
9. IMPORTAÇÃO OBRIGATÓRIA DOS DADOS DA EVOLUÇÃO ANTERIOR (VALE PARA PRÉ-NATAL E TODOS OS 7 MODELOS):
   - Abaixo estão extraídos da evolução anterior do paciente: (A) o Cabeçalho "#" anterior completo, (B) os Diagnósticos da Avaliação anterior que devem entrar nas "#", (C) os Exames Laboratoriais e Ultrassonografias anteriores, e (D) a Avaliação e Conduta da última consulta.
   - ATENÇÃO: O SUBJETIVO e o OBJETIVO antigos foram removidos propositalmente para que você construa o SUBJETIVO e o OBJETIVO de hoje 100% a partir do ÁUDIO DE HOJE!
   - Siga obrigatoriamente:
     1) Copie TODAS as linhas "#" e TODAS as sub-linhas com "-" do "CABEÇALHO # DA EVOLUÇÃO ANTERIOR" abaixo (mantendo "# G01PV0PC0A0", "- Gestação atual não planejada", "# IG ... POR ECO COM ... EM ...", "# ovolactovegetariana", "# Histórico de...", "# Apendicectomia...", "# TS:", "# TOXO:", "# SOROLOGIAS:" por data, "# VACINAS:" uma por linha com "-", "# Consulta odontologia:", "# Tabagista:", "# Alergias:"), acrescentando também nas "#" os diagnósticos listados em "DIAGNÓSTICOS DA AVALIAÇÃO ANTERIOR PARA INCLUIR NAS #"!
     2) Atualize a linha "# MUC:" com as medicações de uso contínuo que estavam em uso + as medicações contínuas prescritas na "CONDUTA DA ÚLTIMA CONSULTA" (separando cada medicamento claramente com sua própria dose e posologia, sem misturar doses!), excluindo medicações suspensas. Se a paciente não tomou ou manteve medicação suspensa, relate no SUBJETIVO.
     3) Mantenha TODOS os "EXAMES LABORATORIAIS ANTERIORES" em EXAMES COMPLEMENTARES e TODAS as "ULTRASSONOGRAFIAS ANTERIORES" em ULTRASSONOGRAFIA, adicionando os exames novos de hoje logo abaixo deles!

=== (A) CABEÇALHO "#" DA EVOLUÇÃO ANTERIOR (MANTER TODAS AS LINHAS "#" E SUB-LINHAS "-"!) ===
${parsedPrev.headerText || 'Nenhum cabeçalho anterior.'}

=== (B) DIAGNÓSTICOS DA AVALIAÇÃO ANTERIOR PARA INCLUIR NAS "#" DO CABEÇALHO ===
${parsedPrev.diagnosesToPromote.length > 0 ? parsedPrev.diagnosesToPromote.map(d => [d.hashLine, ...d.subLines].join('\n')).join('\n') : 'Nenhum diagnóstico crônico novo a promover.'}

=== (C) EXAMES ANTERIORES DA EVOLUÇÃO ANTIGA (MANTER TODOS E ADICIONAR OS NOVOS ABAIXO!) ===
${parsedPrev.labExamLines.length > 0 ? 'EXAMES COMPLEMENTARES ANTERIORES:\n' + parsedPrev.labExamLines.join('\n') : 'Sem labs anteriores.'}
${parsedPrev.usgExamLines.length > 0 ? '\nULTRASSONOGRAFIAS / IMAGEM ANTERIORES:\n' + parsedPrev.usgExamLines.join('\n\n') : ''}

=== (D) AVALIAÇÃO E CONDUTA DA ÚLTIMA CONSULTA (PARA ATUALIZAR # MUC E CHECAR ADESÃO) ===
AVALIAÇÃO ANTERIOR:
${parsedPrev.avaliacaoText || 'Não informada.'}
CONDUTA ANTERIOR:
${parsedPrev.condutaText || 'Não informada.'}
` : ''}${previousEvolutionContext ? `\n10. COMPLEMENTAÇÃO DE ATENDIMENTO DO MESMO PACIENTE (CONTINUAÇÃO DE GRAVAÇÃO):\n   - Integre as novas informações faladas neste áudio com a 1ª parte já transcrita deste mesmo paciente:\n=== EVOLUÇÃO DA 1ª PARTE DESTE MESMO PACIENTE ===\n${previousEvolutionContext}\n` : ''}${preTranscribedExamsText ? `\n=== EXAMES COMPLEMENTARES NOVOS JÁ TRANSCRITOS HOJE (INCLUA ABAIXO DOS ANTERIORES SEPARANDO LABS E ULTRASSONOGRAFIA) ===\n${preTranscribedExamsText}\n` : ''}
=== DADOS EXTRAS / NOTAS RÁPIDAS DO MÉDICO HOJE ${notesExamDetection.hasAny ? `(ATENÇÃO: FORAM DETECTADOS EXAMES ${notesExamDetection.hasLab && notesExamDetection.hasImaging ? 'LABORATORIAIS E DE IMAGEM' : (notesExamDetection.hasLab ? 'LABORATORIAIS' : 'DE IMAGEM')} ABAIXO -> FORMATE-OS OBRIGATORIAMENTE EM "EXAMES COMPLEMENTARES" PARA LABS E "ULTRASSONOGRAFIA" PARA ECO/IMAGEM)` : ''} ===
${quickNotes ? quickNotes : 'Nenhuma nota rápida digitada.'}
${zScoreSummary ? '\n=== DADOS OBJETIVOS / ANTROPOMETRIA / CÁLCULO OBSTÉTRICO DE HOJE ===\n' + zScoreSummary : ''}

=== MODELO DE REFERÊNCIA A SER SEGUIDO ===
${effectiveTemplateText}

=== FORMATO DE RESPOSTA (JSON OBRIGATÓRIO) ===
Responda em JSON válido contendo exatamente estas chaves (preencha "transcricao_literal_do_audio" PRIMEIRO transcrevendo 100% do áudio do início ao fim sem omitir nenhuma queixa da paciente, e em seguida preencha "evolucao_completa"):
{
  "transcricao_literal_do_audio": "Transcrição fiel e INTEGRAL de 100% do que foi falado no áudio do início ao fim separando [MÉDICO]: e [PACIENTE]: (incluindo todas as queixas, relatos de emergência e explicações!)",
  "evolucao_completa": "Texto completo da evolução estruturada seguindo fielmente o MODELO DE REFERÊNCIA e mantendo todas as #, sub-linhas '-' e exames anteriores com quebras de linha \\n",
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
