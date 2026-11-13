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
Marcos do desenvolvimento: 
AP: MVUD, SRA. Sem esforço ventilatório
AC: BNF, 2T, RR, SS
ABD: Globoso, sem fáscies de dor a palpação superficial e profunda. Não palpo visceromegalias
Extremidades aquecidas e bem perfundidas. TEC < 2 seg
Sem sinais de desidratação
Fontanelas normotensas
Ortolani: 
Barlow: 
Oroscopia: 
Otoscopia: MTD e MTE translúcidas e sem abaulamentos. Não visualizo secreção em canal auditivo
Não realizado teste do olho vermelho por falta de oftalmoscopio na UBS
Não realizado teste do coraçãozinho por falta de oximetro pediátrico na UBS

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
    templateText: `## VISITA DOMICILIAR - REGISTRO POSTERIOR ##

#
# MUC:
# Tabagista:
# Alergias:
# Equipe presente na VD: Enfermeiro(a):  | ACS: 
# Familiar / Cuidador(a) presente na visita: 

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

  telessaude: {
    id: 'telessaude',
    name: 'Discussão Telessaúde',
    badge: 'Teleconsultoria',
    icon: '📞',
    description: 'Gravação e discussão de caso clínico com o Telessaúde. Gera exclusivamente a parte da CONDUTA em texto corrido detalhado, sem cabeçalho nem outros blocos.',
    templateText: `## DISCUSSÃO COM TELESSAÚDE (TELECONSULTORIA) ##

CONDUTA
Discuto caso clínico com o serviço de Teleconsultoria / Telessaúde e alinho o plano diagnóstico-terapêutico.
Oriento condutas não farmacológicas e medidas de suporte:
Prescrevo medicações alinhadas:
Encaminho conforme pactuação com a teleconsultoria:
Oriento sinais de alarme e retorno precoce se intercorrências.
Paciente e familiar cientes, concordantes e sem dúvidas ao final do atendimento.`
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
  const unstructuredHeaderLines = [];
  const extractedMucFromDashLines = [];
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

  // Detecta se uma sub-linha "- ..." no cabeçalho antigo na verdade é uma medicação solta (ex.: "- Omeprazol 20mg (1-0-0)", "- NPH (12-0-8)")
  const isDashMedicationLine = (str) => {
    const clean = String(str || '').replace(/^[-*•>]+\s*/, '').trim();
    if (!clean) return false;
    // Não confundir vacinas ou sorologias com medicações
    if (/^(?:DT|DTPA|VSR|VVSR|COVID|INFLUENZA|HEPATITE|ANTITET[ÂA]NICA|TR\s+HIV|\d{2}\/\d{2}\/\d{2,4})/i.test(clean)) return false;
    return /\b(?:\d+\s*(?:mg|mcg|g|ui|ml|cp|comp|c[áa]ps|gt|gotas|jatos)\b|\(\s*\d+\s*-\s*\d+\s*-\s*\d+\s*\)|\b(?:nph|regular|glargina|detemir|degludeca|losartana|enalapril|captopril|ramipril|anlodipino|nifedipino|hidroclorotiazida|hctz|furosemida|espironolactona|indapamida|atenolol|metoprolol|propranolol|carvedilol|sinvastatina|atorvastatina|rosuvastatina|ciprofibrato|metformina|gliclazida|glibenclamida|dapagliflozina|empagliflozina|omeprazol|pantoprazol|esomeprazol|aas|clopidogrel|varfarina|rivaroxabana|apixabana|levotiroxina|puran|sertralina|fluoxetina|escitalopram|citalopram|paroxetina|venlafaxina|duloxetina|amitriptilina|nortriptilina|bupropiona|trazodona|mirtazapina|clonazepam|diazepam|alprazolam|zolpidem|quetiapina|risperidona|haloperidol|olanzapina|carbonato\s+de\s+l[íi]tio|[áa]cido\s+valproico|valproato|carbamazepina|lamotrigina|topiramato|fenito[íi]na|fenobarbital|gabapentina|pregabalina|levodopa|pramipexol|donepezila|memantina|[áa]cido\s+f[óo]lico|sulfato\s+ferroso|carbonato\s+de\s+c[áa]lcio|colecalciferol|vitamina\s+d|alendronato|salbutamol|beclometasona|budesonida|formoterol|tiotr[óo]pio|prednisona|tansulosina|doxazosina|finasterida|dutasterida)\b)/i.test(clean);
  };

  // Detecta subtítulos vazios / espúrios dentro da área de exames para nunca replicá-los
  const isSpuriousExamSubheader = (str) => {
    const clean = String(str || '').replace(/^[-*#•>\s]+/, '').replace(/[:\s]+$/, '').trim();
    return /^(?:ULTRASSONOGRAFIAS?\s*(?:\/\s*IMAGEM)?|EXAMES?\s+DE\s+IMAGEM|IMAGEM|LABORATORIAIS|EXAMES?\s+LABORATORIAIS|EXAMES?\s+COMPLEMENTARES|LABS|LABORAT[ÓO]RIO|ECOGRAFIAS?|ULTRASSOM|USG)$/i.test(clean);
  };

  const now = new Date();
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^##.*##$/.test(trimmed)) continue;

    // Reconhece cabeçalhos padrão e variações de evolução antiga/externa
    if (/^(?:\d+[\.\-\)]\s*)?(?:SUBJETIVO|ANAMNESE|HIST[ÓO]RIA(?:\s+CL[ÍI]NICA)?|HDA|QUEIXA\s+PRINCIPAL|QP|S\s*[:\-])\b/i.test(trimmed)) {
      flushUsgEntry();
      currentSection = 'subjetivo';
      continue;
    }
    if (/^(?:\d+[\.\-\)]\s*)?(?:OBJETIVO|EXAME\s+F[ÍI]SICO|EXAME\s+CL[ÍI]NICO|EF|O\s*[:\-])\b/i.test(trimmed)) {
      flushUsgEntry();
      currentSection = 'objetivo';
      continue;
    }
    if (/^(?:#\s*|\d+[\.\-\)]\s*)?(?:EXAMES\s+COMPLEMENTARES|EXAMES\s+LABORATORIAIS|EXAMES|LABS|LABORAT[ÓO]RIO)\s*:?\s*$/i.test(trimmed)) {
      flushUsgEntry();
      currentSection = 'exames_labs';
      continue;
    }
    if (/^(?:#\s*|\d+[\.\-\)]\s*)?(?:ULTRASSONOGRAFIAS?(?:\s*\/\s*IMAGEM)?|ECOGRAFIAS?|EXAMES\s+DE\s+IMAGEM|IMAGEM|USG|US|RAIO-X|TC|RM)\s*:?\s*$/i.test(trimmed)) {
      flushUsgEntry();
      currentSection = 'exames_usg';
      continue;
    }
    if (/^(?:\d+[\.\-\)]\s*)?(?:RASTREAMENTOS|SOROLOGIAS\s+E\s+INFECTOLOGIA|TERAPIA\s+HORMONAL)\b/i.test(trimmed)) {
      flushUsgEntry();
      currentSection = 'other_structured';
      continue;
    }
    if (/^(?:\d+[\.\-\)]\s*)?(?:AVALIA[ÇC][ÃA]O|HIP[ÓO]TESE(?:S)?(?:\s+DIAGN[ÓO]STICA[S]?)?|DIAGN[ÓO]STICO(?:S)?|IMPRESS[ÃA]O(?:\s+DIAGN[ÓO]STICA)?|A\s*[:\-])\b/i.test(trimmed)) {
      flushUsgEntry();
      currentSection = 'avaliacao';
      continue;
    }
    if (/^(?:\d+[\.\-\)]\s*)?(?:CONDUTA|PLANO(?:\s+TERAP[ÊE]UTICO)?|TRATAMENTO|PRESCRI[ÇC][ÃA]O|ORIENTA[ÇC][ÕO]ES|CD|P\s*[:\-])\b/i.test(trimmed)) {
      flushUsgEntry();
      currentSection = 'conduta';
      continue;
    }

    // Se dentro do OBJETIVO ou HEADER aparecer uma linha explícita "- LABS DD/MM/AAAA:" ou "- US / - USG / - ECO", captura automaticamente como exame!
    const isExplicitLabLineAnywhere = /^(?:-\s*)?LABS\b(?:\s+\d{2}\/\d{2}\/\d{2,4})?\s*:/i.test(trimmed);
    const isExplicitUsgLineAnywhere = /^(?:-\s*)?(?:US\s+(?:OBST[ÉE]TRIC|MORFOL[ÓO]GIC|TRANSVAGINAL|TV|ABD|MAM[ÁA]RI|TIREOIDE|PELVIC|P[ÉE]LVIC|VAGINAL)|USG\b|ECOGRAFIA\b|ULTRASSONOGRAFIA\s+(?:OBST[ÉE]TRIC|MORFOL[ÓO]GIC|TRANSVAGINAL))/i.test(trimmed);
    if ((currentSection === 'objetivo' || currentSection === 'header') && (isExplicitLabLineAnywhere || isExplicitUsgLineAnywhere)) {
      flushUsgEntry();
      currentSection = isExplicitUsgLineAnywhere ? 'exames_usg' : 'exames_labs';
    }

    if (currentSection === 'header') {
      if (!trimmed) continue;
      let processedLine = trimmed;

      // Se a linha NÃO começa com '#' e NÃO é sub-linha vinculada a um grupo '#', não pertence ao cabeçalho '#'
      if (!processedLine.startsWith('#') && !processedLine.startsWith('-') && !processedLine.startsWith('>') && !processedLine.startsWith('>>')) {
        unstructuredHeaderLines.push(processedLine);
        continue;
      }
      if ((processedLine.startsWith('-') || processedLine.startsWith('>') || processedLine.startsWith('>>')) && !currentGroup) {
        if (isDashMedicationLine(processedLine)) {
          extractedMucFromDashLines.push(processedLine.replace(/^[-*•>]+\s*/, '').trim());
        } else {
          unstructuredHeaderLines.push(processedLine);
        }
        continue;
      }

      // Se for uma linha com traço "- Medicamento 20mg (1-0-0)" solta abaixo de uma condição "#" (como no Exemplo 6),
      // NÃO anexa como sub-linha da condição "#" — guarda para a # MUC!
      if ((processedLine.startsWith('-') || processedLine.startsWith('>')) && !processedLine.startsWith('>>')) {
        const parentHash = currentGroup ? currentGroup.hashLine.toUpperCase() : '';
        const isUnderVaccinesOrSorologias = /^#\s*(?:VACINAS|SOROLOGIAS)\b/i.test(parentHash);
        if (!isUnderVaccinesOrSorologias && isDashMedicationLine(processedLine)) {
          extractedMucFromDashLines.push(processedLine.replace(/^[-*•>]+\s*/, '').trim());
          continue;
        }
      }

      // Normaliza linhas antigas de tabagismo e alergias para os campos padrão "# Tabagista:" e "# Alergias:"
      if (/^#\s*Nega\s+tabagismo\s*\/\s*etilismo\b/i.test(processedLine)) {
        headerLines.push('# Nega etilismo');
        headerGroups.push({ hashLine: '# Nega etilismo', subLines: [] });
        processedLine = '# Tabagista: Nega';
      } else if (/^#\s*(?:Nega\s+tabagismo|N[ãa]o\s+tabagista|Sem\s+tabagismo)\s*$/i.test(processedLine)) {
        processedLine = '# Tabagista: Nega';
      } else if (/^#\s*Ex-?tabagista\b(.*)$/i.test(processedLine)) {
        const restEx = processedLine.replace(/^#\s*Ex-?tabagista\s*:?\s*/i, '').trim();
        processedLine = restEx ? `# Tabagista: Ex-tabagista (${restEx.replace(/^\(|\)$/g, '')})` : '# Tabagista: Ex-tabagista';
      } else if (/^#\s*Tabagista\s+passiv([oa])\b(.*)$/i.test(processedLine)) {
        const mPass = processedLine.match(/^#\s*Tabagista\s+passiv([oa])\s*:?\s*(.*)$/i);
        const genderChar = mPass ? mPass[1].toLowerCase() : 'o';
        const extraPass = mPass && mPass[2] ? mPass[2].trim() : '';
        processedLine = extraPass ? `# Tabagista: Tabagista passiv${genderChar} (${extraPass})` : `# Tabagista: Tabagista passiv${genderChar}`;
      } else if (/^#\s*(?:Nega\s+alergias?(?:\s+medicamentosas?)?|Sem\s+alergias?)\s*$/i.test(processedLine)) {
        processedLine = '# Alergias: Nega';
      }

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
    } else if (currentSection === 'exames_labs' || currentSection === 'exames_usg') {
      if (!trimmed || trimmed === '-' || isSpuriousExamSubheader(trimmed)) continue;
      const isImagingLine = /^(?:-\s*)?(?:US\b|USG\b|ECO\b|ECOGRAFIA|ULTRASSOM|ULTRASSONOGRAFIA|ECOCARDIO|RX\b|RAIO|TC\b|TOMOGRAFIA|RM\b|RESSON|MAMOGRAFIA)/i.test(trimmed)
        || /\b(?:feto\s+[úu]nico|placenta|l[íi]quido\s+amni[óo]tico|biometria\s+fetal|saco\s+gestacional|morfologia\s+fetal)\b/i.test(trimmed);
      const isLabStartLine = /^(?:-\s*)?(?:LABS\b|LABORAT[ÓO]RIO|\d{2}\/\d{2}\/\d{2,4}\s*:)/i.test(trimmed);

      if (isImagingLine) {
        flushUsgEntry();
        currentSection = 'exames_usg';
        currentUsgEntry.push(trimmed.startsWith('-') ? trimmed : `- ${trimmed}`);
      } else if (isLabStartLine) {
        flushUsgEntry();
        currentSection = 'exames_labs';
        const formattedLab = trimmed.startsWith('-') ? trimmed : `- ${trimmed}`;
        labExamLines.push(formattedLab.replace(/^-\s*(?=\d{2}\/\d{2}\/\d{2,4}\s*:)/, '- LABS '));
      } else if (currentSection === 'exames_usg') {
        if (trimmed.startsWith('-')) {
          flushUsgEntry();
          currentUsgEntry.push(trimmed);
        } else if (currentUsgEntry.length > 0) {
          currentUsgEntry.push(trimmed);
        } else {
          currentUsgEntry.push(`- ${trimmed}`);
        }
      } else {
        if (trimmed.startsWith('-')) {
          labExamLines.push(trimmed);
        } else if (labExamLines.length > 0) {
          labExamLines[labExamLines.length - 1] += ' ' + trimmed;
        } else {
          labExamLines.push(`- ${trimmed}`);
        }
      }
    } else if (currentSection === 'avaliacao') {
      if (trimmed) avaliacaoLines.push(trimmed);
    } else if (currentSection === 'conduta') {
      if (trimmed) condutaLines.push(trimmed);
    }
  }
  flushUsgEntry();

  // Se havia medicações com traço "- Omeprazol..." no cabeçalho antigo e não havia "# MUC:" preenchida, monta "# MUC:" automaticamente
  if (extractedMucFromDashLines.length > 0) {
    const existingMucIdx = headerLines.findIndex(l => /^#\s*MUC\s*:/i.test(l));
    if (existingMucIdx >= 0) {
      const currentMucVal = headerLines[existingMucIdx].replace(/^#\s*MUC\s*:\s*/i, '').trim();
      if (!currentMucVal) {
        headerLines[existingMucIdx] = `# MUC: ${extractedMucFromDashLines.join(', ')}`;
      }
    } else {
      headerLines.push(`# MUC: ${extractedMucFromDashLines.join(', ')}`);
    }
  }

  const updatedIgGroup = headerGroups.find(g => /^#\s*IG\b/i.test(g.hashLine));

  // Promove patologias CRÔNICAS ou IMPORTANTES da AVALIAÇÃO anterior para o cabeçalho "#",
  // bloqueando estritamente queixas agudas, infecções transitórias e itens administrativos/rotina.
  const acuteOrRoutineRegex = /\b(?:agud[oa]s?|ivas\b|resfriado|gripe|influenza|covid|sars-cov|dengue|zika|chikungunya|amigdalite|faringite|faringoamigdalite|sinusite|rinossinusite|otite|labirintite|traqueobronquite|bronquite\s+aguda|pneumonia|gastroenterite|geca\b|diarreia\s+aguda|virose|cistite|infec[çc][ãa]o\s+urin[áa]ria|infec[çc][ãa]o\s+do\s+trato\s+urin[áa]rio|itu\b|pielonefrite|uretrite|vaginose|candid[íi]ase|tricomon[íi]ase|conjuntivite|hord[ée]olo|ter[çc]ol|celulite|erisipela|impetigo|fur[úu]nculo|abscesso|escabiose|pediculose|herpes\s+zoster|tinea|micose\s+superficial|entorse|contus[ãa]o|distens[ãa]o|estiramento|contratura|trauma\b|ferimento|escoria[çc][ãa]o|queimadura|picada|mordedura|lombalgia\s+aguda|cervicalgia\s+aguda|dorsalgia\s+aguda|ciatalgia\s+aguda|cefaleia\s+aguda|dispepsia\s+aguda|epigastralgia\s+aguda|c[óo]lica\s+nefr[ée]tica|c[óo]lica\s+biliar|constipa[çc][ãa]o\s+aguda|disquesia|c[óo]lica\s+do\s+lactente|icter[íi]cia\s+neonatal|anemia\s+fisiol[óo]gica|estrabismo\s+fisiol[óo]gico|h[ée]rnia\s+umbilical\s+fisiol[óo]gica|rea[çc][ãa]o\s+vacinal|febre\s+sem\s+sinais|estado\s+gripal|tosse\s+aguda|odinofagia|dis[úu]ria|n[áa]useas|v[ôo]mitos|vertigem\s+aguda|puericultura|crescimento\s+e\s+desenvolvimento|eutrofia|pr[ée]-natal\s+de\s+(?:risco\s+habitual|baixo\s+risco)|gesta[çc][ãa]o\s+t[óo]pica|consulta\s+de\s+rotina|rotina|check-?up|exames\s+de\s+rotina|avalia[çc][ãa]o\s+de\s+exames|solicita[çc][ãa]o\s+de\s+exames|renova[çc][ãa]o\s+de\s+receita|emiss[ãa]o\s+de\s+laudo|atestado|orienta[çc][õo]es|sem\s+queixas|h[íi]gido|saud[áa]vel|pendente\s+realiza[çc][ãa]o|teste\s+do\s+olhinho|teste\s+do\s+pezinho|teste\s+da\s+orelhinha|teste\s+da\s+linguinha)/i;

  const chronicOrImportantRegex = /\b(?:hipertens[ãa]o|has\b|diabet|dm\b|dm1\b|dm2\b|dmg\b|pr[ée]-diabet|resist[êe]ncia\s+insul[íi]nica|dislipidemia|dlp\b|hipercolesterolemia|hipertrigliceridemia|hipotireoidismo|hipertireoidismo|tireoidite|hashimoto|graves|b[óo]cio|n[óo]dulo\s+tireoid|obesidade|sobrepeso|s[íi]ndrome\s+metab[óo]lica|asma\b|dpoc\b|doen[çc]a\s+pulmonar\s+obstrutiva|bronquiectasia|fibrose\s+pulmonar|rinite\s+al[ée]rgica|apneia\s+do\s+sono|saos\b|insufici[êe]ncia\s+card[íi]aca|ic\b|icc\b|icfer\b|icfep\b|cardiopatia|coronariopatia|doen[çc]a\s+arterial\s+coronariana|dac\b|angina|infarto\s+pr[ée]vio|iam\b|fibrila[çc][ãa]o\s+atrial|flutter|arritmia|valvopatia|estenose\s+a[óo]rtica|insufici[êe]ncia\s+mitral|marca-?passo|avc\b|ave\b|ait\b|acidente\s+vascular|doen[çc]a\s+arterial\s+perif[ée]rica|daop\b|insufici[êe]ncia\s+venosa|varizes|trombose\s+venosa|tvp\b|tep\b|embolia\s+pulmonar|trombofilia|doen[çc]a\s+renal\s+cr[ôo]nica|drc\b|insufici[êe]ncia\s+renal\s+cr[ôo]nica|irc\b|nefropatia|nefrolit[íi]ase|lit[íi]ase\s+renal|c[áa]lculo\s+renal|rins?\s+polic[íi]sticos?|colelit[íi]ase|calculose\s+biliar|esteatose\s+hep[áa]tica|dheg\b|mash\b|nash\b|cirrose|hepatopatia|hepatite\s+[bc]\b|hepatite\s+cr[ôo]nica|hiv\b|aids\b|drge\b|doen[çc]a\s+do\s+refluxo|gastrite\s+cr[ôo]nica|[úu]lcera\s+p[ée]ptica|doen[çc]a\s+cel[íi]aca|doen[çc]a\s+de\s+crohn|retocolite\s+ulcerativa|doen[çc]a\s+inflamat[óo]ria\s+intestinal|s[íi]ndrome\s+do\s+intestino\s+irrit[áa]vel|diverticulose|doen[çc]a\s+diverticular|constipa[çc][ãa]o\s+cr[ôo]nica|hemorroid|depress[ãa]o|transtorno\s+depressivo|ansiedade|tag\b|transtorno\s+(?:de\s+ansiedade|do\s+p[âa]nico|obsessivo|afetivo\s+bipolar|bipolar|psic[óo]tico|de\s+personalidade|alimentar|do\s+espectro\s+autista)|tab\b|toc\b|tea\b|autismo|tdah\b|esquizofrenia|ins[ôo]nia\s+cr[ôo]nica|depend[êe]ncia\s+qu[íi]mica|etilismo|alcoolismo|dem[êe]ncia|alzheimer|parkinson|epilepsia|enxaqueca|migr[âa]nea|cefaleia\s+cr[ôo]nica|neuropatia|neuralgia|esclerose\s+m[úu]ltipla|sequela|fibromialgia|osteoartrose|osteoartrite|artrose|gonartrose|coxartrose|espondiloartrose|h[ée]rnia\s+de\s+disco|lombalgia\s+cr[ôo]nica|osteoporose|osteopenia|gota\b|hiperuricemia|artrite\s+reumatoide|l[úu]pus|les\b|espondilite|psor[íi]ase|dermatite\s+at[óo]pica|vitiligo|ros[áa]cea|hidradenite|anemia\s+(?:ferropriva|cr[ôo]nica|megalobl[áa]stica|falciforme)|talassemia|defici[êe]ncia\s+de\s+vitamina\s+(?:b12|d)|hiperplasia\s+prost[áa]tica|hpb\b|incontin[êe]ncia\s+urin[áa]ria|bexiga\s+hiperativa|s[íi]ndrome\s+dos\s+ov[áa]rios\s+polic[íi]sticos|sop\b|endometriose|adenomiose|miomatose|leiomioma|climat[ée]rio|menopausa|infertilidade|neoplasia|c[âa]ncer|carcinoma|linfoma|leucemia|melanoma|tumor|glaucoma|catarata|retinopatia|surdez|hipoacusia|cirurgia\s+bari[áa]trica|p[óo]s-?bari[áa]trica|colecistectomia|histerectomia|mastectomia|tireoidectomia|revasculariza[çc][ãa]o|angioplastia|stent\b|pr[ée]-?ecl[âa]mpsia|ecl[âa]mpsia|diabetes\s+gestacional|placenta\s+pr[ée]via|aloimuniza[çc][ãa]o|incompet[êe]ncia\s+istmocervical|gesta[çc][ãa]o\s+gemelar|gesta[çc][ãa]o\s+de\s+alto\s+risco|risco\s+(?:aumentado|elevado)\s+para\s+pr[ée]-?ecl[âa]mpsia|tuberculose|hansen[íi]ase|s[íi]filis|chagas|cr[ôo]nic[oa])/i;

  const normCond = (s) => String(s || '')
    .replace(/^#\s*/, '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

  const synonymGroups = [
    ['has', 'hipertensao', 'hipertensaoarterial', 'hipertensaoarterialsistemica'],
    ['dm', 'dm2', 'diabetes', 'diabetesmellitus', 'diabetesmellitustipo2', 'diabetestipo2'],
    ['dm1', 'diabetesmellitustipo1', 'diabetestipo1'],
    ['dmg', 'diabetesgestacional', 'diabetesmellitusgestacional'],
    ['dlp', 'dislipidemia', 'hipercolesterolemia', 'hipertrigliceridemia', 'dislipidemiamista'],
    ['tag', 'transtornodeansiedadegeneralizada', 'ansiedade', 'transtornodeansiedade'],
    ['tdm', 'depressao', 'transtornodepressivo', 'transtornodepressivomaior', 'episodiodepressivo'],
    ['drc', 'doencarenalcronica', 'insuficienciarenalcronica', 'irc'],
    ['dpoc', 'doencapulmonarobstrutivacronica', 'enfisemapulmonar'],
    ['drge', 'doencadorefluxogastroesofagico', 'refluxogastroesofagico'],
    ['hpb', 'hiperplasiaprostaticabenigna', 'hiperplasiaprostatica'],
    ['sop', 'sindromedosovariospolicisticos', 'ovariospolicisticos'],
    ['ic', 'icc', 'insuficienciacardiaca', 'insuficienciacardiacacongestiva'],
    ['fa', 'fibrilacaoatrial'],
    ['tab', 'transtornoafetivobipolar', 'transtornobipolar']
  ];

  const areSameCondition = (a, b) => {
    const na = normCond(a);
    const nb = normCond(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    if (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) return true;
    for (const grp of synonymGroups) {
      const aIn = grp.some(k => na === k || (k.length >= 5 && na.includes(k)));
      const bIn = grp.some(k => nb === k || (k.length >= 5 && nb.includes(k)));
      if (aIn && bIn) return true;
    }
    return false;
  };
  window.areMedicalConditionsEquivalent = areSameCondition;

  const promotedFromAvaliacao = [];
  for (const rawEvalLine of avaliacaoLines) {
    // Divide apenas se houver separação explícita por " / " entre patologias distintas
    const parts = rawEvalLine.split(/\s+\/\s+/);
    for (const part of parts) {
      let cleaned = part
        .replace(/^[\s\-\*#•\d\.\)]+/, '')
        .replace(/^(?:Hip[óo]tese(?:s)?(?:\s+diagn[óo]stica[s]?)?|Diagn[óo]stico(?:s)?)\s*:\s*/i, '')
        .replace(/\s*\((?:CID(?:-1[01])?|CIAP(?:-2)?)[^)]*\)/gi, '')
        .replace(/\s*(?:,|—|-|\()\s*(?:compensad[oa]s?|descompensad[oa]s?|controlad[oa]s?|n[ãa]o\s+controlad[oa]s?|controle\s+[^\n,)]+|em\s+(?:tratamento|acompanhamento|investiga[çc][ãa]o|remiss[ãa]o|uso\s+de)[^\n,)]*|est[áa]vel|inst[áa]vel|em\s+melhora|resolvida)\)?\s*$/i, '')
        .trim();

      if (!cleaned || cleaned.length < 3 || cleaned.length > 95) continue;
      if (acuteOrRoutineRegex.test(cleaned) && !/\bcr[ôo]nic[oa]\b/i.test(cleaned)) continue;
      if (!chronicOrImportantRegex.test(cleaned)) continue;

      const candidateHash = `# ${cleaned.replace(/^#\s*/, '')}`;
      const alreadyInHeader = headerLines.some(hl => hl.startsWith('#') && areSameCondition(hl, candidateHash));
      const alreadyPromoted = promotedFromAvaliacao.some(pl => areSameCondition(pl, candidateHash));

      if (!alreadyInHeader && !alreadyPromoted) {
        promotedFromAvaliacao.push(candidateHash);
      }
    }
  }

  return {
    headerText: headerLines.join('\n'),
    headerLines,
    headerGroups,
    unstructuredText: unstructuredHeaderLines.join('\n'),
    isUnstructured: headerLines.length === 0,
    rawText: raw,
    updatedIgLine: updatedIgGroup ? updatedIgGroup.hashLine : '',
    diagnosesToPromote: promotedFromAvaliacao,
    promotedFromAvaliacao,
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

LEI SUPREMA: PROIBIÇÃO ABSOLUTA DE ABREVIAR, RESUMIR, INVENTAR NOMES OU CORTAR TRECHOS (TRANSCRIÇÃO 100% INTEGRAL):
1. PROIBIÇÃO TOTAL DE ABREVIAR OU SINTETIZAR:
   - O médico precisa desta transcrição completa para compor o prontuário legal do paciente.
   - É TERMINANTEMENTE PROIBIDO resumir falas, omitir perguntas ou respostas, abreviar frases, pular assuntos ou parar a transcrição antes do último segundo da gravação!
   - Transcreva CADA PALAVRA dita pelo médico, paciente e acompanhante, do primeiro segundo até o encerramento do áudio.
2. IDENTIFICAÇÃO DOS INTERLOCUTORES (PROIBIDO INVENTAR NOMES PRÓPRIOS OU GRAU DE PARENTESCO!):
   - Inicie cada mudança de fala APENAS com "[MÉDICO]: ", "[PACIENTE]: " ou "[ACOMPANHANTE]: " (uma fala por linha).
   - É TERMINANTEMENTE PROIBIDO adivinhar, deduzir ou inventar nomes próprios de pessoas (como "Joel", "Maria", nome de enfermeira ou ACS), grau de parentesco ("filho", "filha", "esposo") ou nomes de unidades de saúde / bairros / cidades (UBS, ESF, UPA, hospital) se não tiverem sido pronunciados com 100% de nitidez!
3. CAPTAÇÃO TOTAL DE DETALHES CLÍNICOS, TABAGISMO E ALERGIAS (NÃO DEIXE ESCAPAR NADA!):
   - Transcreva todas as queixas, dores, sintomas, história da doença atual e tempo de evolução relatados pelo(a) paciente (mesmo que a voz do paciente esteja mais baixa ou distante do microfone!).
   - Transcreva obrigatoriamente todas as perguntas e respostas sobre TABAGISMO (se fuma, se é ex-tabagista / já fumou e parou, ou se é tabagista passivo / alguém fuma em casa) e ALERGIAS medicamentosas ou alimentares!
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
window.buildMedicalEvolutionPrompt = function(templateObj, quickNotes, zScoreSummary, hasExamFiles, previousEvolutionContext, previousConsultationText, preTranscribedExamsText, soapSubtypeHeader, hasPreTranscribedAudio = false, patientAge = '', patientSex = '', vdVisitDate = '') {
  const todayStr = new Date().toLocaleDateString('pt-BR');
  const notesExamDetection = window.detectExamsInText(quickNotes);
  const parsedPrev = window.parsePreviousConsultationData(previousConsultationText);
  const isPrenatalTemplate = templateObj.id === 'prenatal';
  const effectivePatientSex = isPrenatalTemplate ? 'F' : (patientSex || '');
  const isTelessaudeTemplate = templateObj.id === 'telessaude';
  const isVdTemplate = templateObj.id === 'visita_domiciliar';
  const hasAnyExamsToFormat = Boolean(
    hasExamFiles ||
    preTranscribedExamsText ||
    notesExamDetection.hasAny ||
    (isPrenatalTemplate && parsedPrev && parsedPrev.hasPreviousExams)
  );

  // Ajusta o título do modelo SOAP Geral conforme a modalidade selecionada (Demanda Espontânea, Consulta Agendada - 0800, Retorno Médico ou Sem Título ##)
  let effectiveTemplateText = templateObj.templateText;
  if (templateObj.id === 'geral') {
    if (soapSubtypeHeader) {
      effectiveTemplateText = effectiveTemplateText.replace(/^##.*##\s*\n+/m, '');
      effectiveTemplateText = `${soapSubtypeHeader}\n\n${effectiveTemplateText.trim()}`;
    } else if (soapSubtypeHeader === '') {
      // Opção para não ter nenhum cabeçalho ## no topo
      effectiveTemplateText = effectiveTemplateText.replace(/^##.*##\s*\n+/m, '').trim();
    }
  } else if (isVdTemplate) {
    if (vdVisitDate) {
      effectiveTemplateText = effectiveTemplateText.replace(/^##\s*VISITA DOMICILIAR[^\n#]*##/im, `## VISITA DOMICILIAR EM ${vdVisitDate} - REGISTRO POSTERIOR ##`);
    } else {
      effectiveTemplateText = effectiveTemplateText.replace(/^##\s*VISITA DOMICILIAR[^\n#]*##/im, `## VISITA DOMICILIAR - REGISTRO POSTERIOR ##`);
    }
  } else if (templateObj.id === 'interconsulta' && soapSubtypeHeader && /resumid/i.test(soapSubtypeHeader)) {
    effectiveTemplateText = `## INTERCONSULTA COM A ENFERMAGEM ##\n\n[Texto corrido direto e objetivo relatando a interconsulta com a enfermagem, quadro clínico, exame direcionado se houver, avaliação e condutas pactuadas, sem cabeçalho #, sem MUC, sem Alergias e sem subdivisões SUBJETIVO, OBJETIVO, AVALIAÇÃO ou CONDUTA.]`;
  }

  return `Você é um Médico de Família e Comunidade experiente na Atenção Primária à Saúde (UBS / SUS).
Sua missão é produzir uma evolução médica COMPLETA, DETALHADA e IMPECÁVEL, pronta para inserção direta no Prontuário Eletrônico do Cidadão (PEC e-SUS / APS).
${hasPreTranscribedAudio
  ? `Sua tarefa agora é ler minuciosamente CADA LINHA da "TRANSCRIÇÃO LITERAL COMPLETA DO ÁUDIO DA CONSULTA DE HOJE" fornecida abaixo (do início ao fim, sem ignorar nenhuma fala!) e construir uma "evolucao_completa" médica extremamente completa, fiel e detalhada, integrando 100% do que foi conversado na consulta com as notas rápidas, os exames anexados e os dados permanentes da evolução anterior.`
  : `Sua tarefa tem DUAS ETAPAS OBRIGATÓRIAS E SEQUENCIAIS:
ETAPA 1 (TRANSCRIÇÃO INTEGRAL DE 100% DO ÁUDIO): Ouvir o áudio anexado do primeiro ao último segundo (00:00 até o fim) e transcrever literalmente TUDO o que foi dito na chave "transcricao_literal_do_audio" do JSON (identificando "[MÉDICO]:" e "[PACIENTE]:"). É TERMINANTEMENTE PROIBIDO pular, resumir ou ignorar falas da paciente (especialmente relatos de ida à emergência/hospital e todas as queixas relatadas!).
ETAPA 2 (EVOLUÇÃO CLÍNICA ESTRUTURADA): Preencher "evolucao_completa" usando 100% dos fatos reais presentes na sua "transcricao_literal_do_audio", nas notas rápidas, nos exames anexados e nos dados permanentes da evolução anterior.`}

${isVdTemplate
  ? (vdVisitDate
      ? `Data informada em que ocorreu a Visita Domiciliar: ${vdVisitDate} (Data da transcrição hoje: ${todayStr}).`
      : `ATENÇÃO VISITA DOMICILIAR (REGISTRO POSTERIOR): A transcrição está sendo gerada em ${todayStr}, porém a Visita Domiciliar pode ter ocorrido em outro dia! NUNCA coloque a data de hoje (${todayStr}) no título "## VISITA DOMICILIAR ... ##" a menos que o médico tenha dito explicitamente que a visita ocorreu em ${todayStr}. Se a data da visita não foi falada, mantenha o título como "## VISITA DOMICILIAR - REGISTRO POSTERIOR ##".`)
  : `Data de referência de hoje: ${todayStr}.`}

=== LEI SUPREMA: PROIBIÇÃO TOTAL E ABSOLUTA DE ABREVIAR, RESUMIR, INVENTAR NOMES/PARENTESCOS OU OMITIR INFORMAÇÕES! ===
O médico depende desta evolução para o registro clínico e resguardo ético-jurídico no prontuário.
- É TERMINANTEMENTE PROIBIDO abreviar histórias, sintetizar em poucas linhas, omitir queixas secundárias, usar reticências "..." ou generalizar com termos vagos como "sintomas habituais", "orientadas medidas", "conforme rotina" ou "prescritos sintomáticos"!
- Você DEVE ouvir e integrar 100% da consulta gravada, das anotações rápidas e dos exames anexados.
- Cada queixa do paciente, cada resposta ao interrogatório sintomatológico, cada achado de exame físico, cada valor de sinal vital, cada diagnóstico avaliado e CADA medicamento prescrito (com nome completo oficial, miligramas, posologia completa e duração) DEVE estar minuciosamente registrado e organizado nas seções corretas do prontuário (SOAP)!
- PROIBIÇÃO ABSOLUTA DE INVENTAR NOMES DE PESSOAS, UNIDADES DE SAÚDE OU ESTABELECER GRAU DE PARENTESCO NÃO INFORMADO:
  * É TERMINANTEMENTE PROIBIDO criar, deduzir ou adivinhar nomes de acompanhantes, familiares, cuidadores (ex.: NUNCA invente "Joel", "Maria", etc.), nomes de enfermeiros(as), ACS ou nomes de unidades de saúde / UBS / ESF / UPA / hospitais / bairros que NÃO foram ditos literalmente na consulta ou nas notas!
  * É TERMINANTEMENTE PROIBIDO estabelecer grau de parentesco ("filho", "filha", "esposo", "esposa", "nora", "irmã") se esse parentesco NÃO tiver sido declarado de forma 100% inequívoca e literal na consulta ou nas Anotações Rápidas!
  * Se houver outra voz ou acompanhante na consulta/visita domiciliar mas o nome ou grau de parentesco não tiver sido explicitamente informado, escreva apenas "acompanhante" ou "familiar" (sem nome próprio e sem inventar parentesco) e deixe os campos "# Equipe presente na VD:" e "# Familiar / Cuidador(a) presente na visita:" em branco!
- ATENÇÃO MÁXIMA A ATENDIMENTO EM EMERGÊNCIA / PRONTO ATENDIMENTO / HOSPITAL:
  * Se a paciente relatar no áudio (ou nas notas) que esteve na Emergência / Pronto Atendimento / Maternidade / Hospital entre as consultas, você DEVE relatar detalhadamente no SUBJETIVO: motivo/queixas que a levaram à emergência, data/local se citados, avaliação realizada, medicações administradas e exames feitos na urgência!
  * E se ela realizou exames laboratoriais ou de imagem na Emergência/Urgência, ao colocá-los em EXAMES COMPLEMENTARES / ULTRASSONOGRAFIA, identifique explicitamente "(REALIZADO NA EMERGÊNCIA / URGÊNCIA)" ao lado da data do exame — JAMAIS jogue exames ou avaliações feitas na emergência como se tivessem sido realizados de forma eletiva na UBS!
- Se um campo do modelo (# Tabagista:, # Alergias:, Enfermeiro(a):, ACS:, Familiar:, etc.) NÃO foi falado no áudio nem consta na evolução prévia, deixe-o VAZIO em branco (sem escrever "Não informado").

=== LEI SUPREMA 2: IDENTIDADE DO MÉDICO & PROIBIÇÃO ABSOLUTA DE CONDUTAS OU LINGUAGEM DE IA NO SUBJETIVO ===
Você está redigindo o prontuário como o PRÓPRIO MÉDICO ASSISTENTE. O prontuário DEVE soar 100% como se tivesse sido escrito por um médico humano de verdade no PEC / e-SUS, NUNCA por uma IA ou observador externo de terceira pessoa narrando uma conversa!
- É TERMINANTEMENTE PROIBIDO usar linguagem meta-narrativa ou em 3ª pessoa sobre o médico:
  ❌ NUNCA escreva frases como:
  * "Médico orientou..."
  * "Médico reforçou..."
  * "Médico explicou..."
  * "Médico prescreveu..."
  * "Médico solicitou..."
  * "Após esclarecimento médico..."
  * "Conforme discutido com o médico..."
  * "Contradizendo relato anterior..."
  * "O médico conversou com o paciente..."
- O "SUBJETIVO" CONTÉM EXCLUSIVAMENTE A VOZ E A ANAMNESE DO PACIENTE:
  * No SUBJETIVO, coloque SOMENTE as queixas, sintomas, história da doença atual, tolerabilidade a remédios, hábitos de vida referidos (álcool, tabaco, sono, substâncias), sintomas que o paciente nega ("Nega febre...", "Nega sintomas de anemia...") e demandas ou dúvidas trazidas pelo paciente (ex.: "Demonstra interesse em iniciar terapia hormonal e questiona sobre critérios para mastectomia", "Manifesta desejo de ser doador de órgãos").
- É ERRO MÉDICO GRAVÍSSIMO COLOCAR ORIENTAÇÕES, CONDUTAS OU ENCAMINHAMENTOS DENTRO DO SUBJETIVO:
  * NENHUMA orientação médica pode ficar no SUBJETIVO!
  * Se o médico explicou que precisa compensar a anemia antes de iniciar testosterona -> ISSO É CONDUTA! NUNCA COLOQUE NO SUBJETIVO!
  * Se o médico orientou cessar cigarro ou maconha pelo risco de trombose/eritrocitose -> ISSO É CONDUTA! NUNCA COLOQUE NO SUBJETIVO!
  * Se o médico encaminhou para mastectomia via GERCON e orientou acompanhar a fila -> ISSO É CONDUTA! NUNCA COLOQUE NO SUBJETIVO!
  * Se o médico orientou musculação/atividade física ou orientações dietéticas -> ISSO É CONDUTA! NUNCA COLOQUE NO SUBJETIVO!
  * Se o médico orientou sobre doação de órgãos -> ISSO É CONDUTA! NUNCA COLOQUE NO SUBJETIVO!
  * Se o médico prescreveu Ferripolimaltose ou qualquer medicação -> ISSO É CONDUTA! NUNCA COLOQUE NO SUBJETIVO!
  * REGRA DE OURO: Se é plano, conselho, orientação ao paciente, pedido de exame, encaminhamento ou receita, VAI PARA A CONDUTA! O SUBJETIVO é estritamente a fala, queixa e relato do paciente.
- TRAVA OBRIGATÓRIA PARA ÁUDIO DE TESTE / NADA A VER / SILÊNCIO:
  Se o áudio anexado NÃO for uma consulta médica real (por exemplo: teste rápido ou ruído/silêncio) e não houver notas clínicas, evolução prévia nem PDF de exame anexado:
  * Escreva no campo "evolucao_completa" EXATAMENTE:
    "⚠️ Áudio sem conteúdo de consulta médica identificado.\nTranscrição captada no microfone: \"[coloque aqui apenas o que foi falado literalmente no áudio]\""
  * E deixe "codigos_cid_ciap": [].

=== LEI SUPREMA 3: OBRIGATORIEDADE DO FORMATO PADRÃO DO MODELO SELECIONADO (INDEPENDENTE DO MODELO DE IA ATIVO) ===
- Qualquer que seja o modelo de IA em execução, é PROIBIDO inventar novos títulos de seção, alterar a ordem dos blocos ou copiar o layout de evoluções antigas!
- Se a evolução anterior fornecida estiver em qualquer outro formato (texto corrido narrativo, evolução hospitalar, resumo de alta, tópicos não-SOAP, letras S/O/A/P, prontuário antigo ou com medicações soltas em linhas "- Omeprazol..."):
  * É TERMINANTEMENTE PROIBIDO copiar, imitar ou adotar a estrutura ou layout da evolução antiga!
  * É TERMINANTEMENTE PROIBIDO copiar lista de medicações soltas com traço ("- Omeprazol 20mg...", "- Sinvastatina...") para cima da linha "# MUC:"! Todas as medicações em uso contínuo devem ficar UNIFICADAS exclusivamente dentro da linha "# MUC: ...".
  * A evolução de HOJE DEVE SER GERADA RIGOROSAMENTE NO MODELO DE REFERÊNCIA SELECIONADO (${templateObj.name}), contendo todas as seções obrigatórias:
    1) Cabeçalho "#" com comorbidades (# Comorbidade), # MUC:, # Tabagista:, # Alergias:
    2) SUBJETIVO (Anamnese completa e queixas em linguagem médica formal)
    3) OBJETIVO (Ectoscopia base, sinais vitais e exame físico estruturado)
    4) EXAMES COMPLEMENTARES (e ULTRASSONOGRAFIA apenas no Pré-Natal)
    5) AVALIAÇÃO (Hipóteses diagnósticas sem traços e sem códigos CID-10 no texto)
    6) CONDUTA (Em 1ª pessoa verbal do médico: Prescrevo, Oriento, Explico, Renovo medicações de uso contínuo, sem tópicos)

=== REGRAS CRÍTICAS E OBRIGATÓRIAS (VALEM PARA O PRÉ-NATAL E TODOS OS 8 MODELOS!) ===

1. PADRÃO ESTRITO DO CABEÇALHO "#" (CONDIÇÕES DE SAÚDE, TABAGISMO/EX-TABAGISTA/PASSIVO, ALERGIAS, GPVPCA, IG POR ECO, VACINAS, SOROLOGIAS, TOXO E MUC):
   - CAPTAÇÃO OBRIGATÓRIA DE TABAGISMO (ATIVO, EX-TABAGISTA, TABAGISTA PASSIVO OU NEGA) E ALERGIAS A PARTIR DA TRANSCRIÇÃO E DA EVOLUÇÃO ANTERIOR:
     * Verifique atentamente tanto a evolução anterior quanto a transcrição da consulta de hoje para preencher "# Tabagista:" e "# Alergias:".
     * Se o paciente negar tabagismo na consulta ou na evolução anterior (ex.: "# Nega tabagismo"), preencha: "# Tabagista: Nega" (e NUNCA deixe "# Nega tabagismo" duplicado com "# Tabagista:" em branco!).
     * Se o paciente for EX-TABAGISTA (relatar que já fumou e parou), NUNCA o classifique como tabagista ativo! Preencha claramente: "# Tabagista: Ex-tabagista" (acrescentando há quanto tempo parou se informado, ex.: "# Tabagista: Ex-tabagista (cessou há 10 anos)").
     * Se o paciente for TABAGISTA PASSIVO (relatar que não fuma, mas esposo/familiar fuma em casa), preencha claramente: "# Tabagista: Tabagista passivo(a)" (ex.: "# Tabagista: Tabagista passiva (esposo tabagista)").
     * Se o paciente negar alergias na consulta ou na evolução anterior (ex.: "# Nega alergias"), preencha: "# Alergias: Nega" (e se tiver alergia, especifique qual medicação/substância: "# Alergias: Dipirona").
   - PRESERVAÇÃO FIEL DAS "#" ANTERIORES + PROMOÇÃO DE PATOLOGIAS CRÔNICAS/IMPORTANTES DA AVALIAÇÃO ANTERIOR (BLOQUEANDO QUEIXAS AGUDAS!):
     * Quando houver evolução prévia, você DEVE MANTER EXATAMENTE as linhas "#" de patologias crônicas (ex.: "# HAS", "# Dislipidemia", "# Colelitiase", "# TAG") E as sub-linhas clínicas com traço ("- ...") vinculadas a cada condição (ex.: "- Aguardando com CX geral via gercon", "- Gestação atual planejada", "- Acompanhamento com PNAR").
     * PROMOÇÃO OBRIGATÓRIA DE PATOLOGIAS CRÔNICAS DA AVALIAÇÃO ANTERIOR PARA AS "#": Se na seção "AVALIAÇÃO" da consulta anterior constar alguma PATOLOGIA CRÔNICA ou CONDIÇÃO CLÍNICA IMPORTANTE que ainda não estava listada nas "#" do topo (ex.: Hipertensão arterial, Diabetes Mellitus, Dislipidemia, Hipotireoidismo, Depressão, Ansiedade/TAG, Asma, DPOC, Doença renal crônica, Colelitíase, Esteatose hepática, Obesidade, Fibromialgia, Osteoporose, Cardiopatia, Miomatose uterina, etc.), você DEVE PUXÁ-LA para o cabeçalho "#" como uma nova linha limpa (ex.: "# Diabetes Mellitus tipo 2", "# Hipotireoidismo"), removendo adjetivos transitórios como "controle irregular" ou "em tratamento" e evitando duplicar caso já exista sinônimo nas "#" (ex.: não adicione "# Hipertensão" se já houver "# HAS").
     * PROIBIÇÃO ABSOLUTA DE PUXAR QUEIXAS AGUDAS PARA AS "#": JAMAIS puxe queixas agudas, infecções transitórias ou motivos pontuais da Avaliação anterior (como IVAS, resfriado, amigdalite, sinusite, gastroenterite/diarreia aguda, cistite/ITU, lombalgia aguda, dengue, puericultura/rotina) para dentro do cabeçalho "#"! As queixas agudas de hoje ficam exclusivamente na seção "AVALIAÇÃO" de hoje.
   - PADRÃO OBRIGATÓRIO DO HISTÓRICO OBSTÉTRICO (PARIDADE) NO PRÉ-NATAL:
     * NUNCA assuma "G01" como padrão se a paridade não foi informada!
     * Quando a paridade constar na evolução anterior, nas notas ou for falada no áudio, escreva SEMPRE no formato compacto sem espaços com 2 dígitos após o G: exemplo "# G01PV0PC0A0", "# G02PV1PC0A0", "# G03PV1PC1A0", mantendo na linha de baixo qualquer observação com traço "- " que já existia (ex.: "- Gestação atual planejada"). Se a paridade não foi informada em lugar nenhum, mantenha "# G PV PC A" em branco para o médico preencher.
   - PADRÃO OBRIGATÓRIO DA IDADE GESTACIONAL ("# IG") E PRESERVAÇÃO DOS DADOS DA ECOGRAFIA:
     * Escreva SEMPRE a IG atual logo após "# IG" no formato "[SEMANAS]+[DIAS]", mantendo obrigatoriamente a informação da ecografia (quantas semanas tinha na eco e a data em que foi realizada):
       Padrão exato: "# IG 25+0 POR ECO COM 09 SEM E 6 DIAS EM 27/07/2026" (ou "# IG 17+6 POR DUM EM DD/MM/AAAA").
     * É TERMINANTEMENTE PROIBIDO excluir a informação da ecografia anterior ("POR ECO COM X SEM EM DD/MM/AAAA")!
   - PADRÃO OBRIGATÓRIO DE "# SOROLOGIAS:" (DIVIDIDAS POR DATA COM "- DD/MM/AAAA:" EM ORDEM CRONOLÓGICA):
     * NUNCA junte datas diferentes de sorologias na mesma linha do título "# SOROLOGIAS:"!
     * O título "# SOROLOGIAS:" fica sozinho na linha, e abaixo dele coloque UMA LINHA POR DATA iniciando com "- DD/MM/AAAA: " em ordem cronológica (da mais antiga para a mais recente), mantendo as datas anteriores e adicionando as novas datas abaixo:
       Exemplo:
       # SOROLOGIAS:
       - 10/07/2026: TR HIV, Sífilis, Hepatite B, Hepatite C: NR
       - 05/10/2026: TR HIV, Sífilis, Hepatite B, Hepatite C: NR
   - PADRÃO OBRIGATÓRIO DE "# VACINAS:" NO PRÉ-NATAL (UMA VACINA POR LINHA COM "- " E PROIBIDO DEIXAR "PENDENTE" SE JÁ HOUVER DATA!):
     * Abaixo de "# VACINAS:", escreva OBRIGATORIAMENTE UMA VACINA POR LINHA iniciando com "- ":
       # VACINAS:
       - DT / Antitetânica: [datas ou Pendente]
       - DTPA: [data ou Pendente]
       - VSR: [data ou Pendente]
       - Hepatite B: [datas ou Pendente]
       - Influenza: [data ou Pendente]
       - COVID: [data ou Pendente]
     * REGRA CRÍTICA ANTI-DUPLICAÇÃO DE VACINAS: Se uma vacina (como DTPA, DT/Antitetânica, VSR/VVSR, COVID/COVID19, Influenza ou Hepatite B) JÁ POSSUI DATA DE APLICAÇÃO na evolução anterior ou na consulta atual (ex.: "- DTPA: 26/10/2026"), é TERMINANTEMENTE PROIBIDO escrever outra linha "- DTPA: Pendente"! Substitua "Pendente" pela data real aplicada e mantenha apenas UMA linha para cada vacina!
   - ATUALIZAÇÃO OBRIGATÓRIA DE "# TOXO:" NO CABEÇALHO:
     * Se houver exame de Toxoplasmose (IgM e IgG), atualize obrigatoriamente a linha "# TOXO:" no cabeçalho informando se é Suscetível (IgG NR e IgM NR) ou Imune (IgG R e IgM NR) com a respectiva data.
   - REGRA ESTRITA DA "# MUC:" (MEDICAÇÕES EM USO NO MOMENTO DA CONSULTA — SEM MISTURAR DOSES, SEM LINHAS SOLTAS "- MEDICAMENTO" E SEM INCLUIR PRESCRIÇÃO NOVA DE HOJE!):
     * Liste na "# MUC:" todas as medicações que o paciente já estava em uso ao chegar na consulta de hoje (incluindo medicações contínuas da última consulta, separadas por vírgula com nome + concentração + posologia exata de cada uma).
     * NÃO deixe linhas soltas com traço "- Omeprazol..." fora da "# MUC:", e NÃO coloque na "# MUC:" medicações prescritas pela primeira vez na consulta de HOJE!
   - PUERICULTURA (ALIMENTAÇÃO APENAS NO SUBJETIVO):
     * Na Puericultura, NUNCA coloque "# Alimentação:" no cabeçalho "#" inicial! O tópico "Alimentação:" fica dentro do "SUBJETIVO".
   - REGISTRO DO FAMILIAR / ACOMPANHANTE E PROIBIÇÃO DE CONTRADIÇÕES:
     * Se um acompanhante for citado no áudio DE HOJE com nome/parentesco explícitos, registre no início do SUBJETIVO. Se o nome ou parentesco não foi explicitamente falado, NUNCA invente nomes próprios (como "Joel") nem parentesco ("filho")!
     * Se a gestante/paciente relatar QUALQUER queixa, dor, sintoma, ida à emergência ou sinal de alarme no áudio, REMOVA IMEDIATAMENTE as frases padrão "Paciente refere estar bem, sem queixas", "Familiar relata que paciente está bem", "Nega intercorrências" e "Sem demais queixas", e apague "Nega [sintoma]" para qualquer sintoma que ela tenha apresentado!

2. REDAÇÃO MÉDICA FORMAL NO SUBJETIVO & PROIBIÇÃO ABSOLUTA DE CONDUTAS OU LINGUAGEM DE IA:
   - SEPARAÇÃO ESTRITA: O SUBJETIVO É EXCLUSIVAMENTE A VOZ E HISTÓRIA DO PACIENTE!
     * É TERMINANTEMENTE PROIBIDO colocar qualquer fala, conselho, orientação médica, encaminhamento ou prescrição do médico dentro do SUBJETIVO!
     * NUNCA escreva frases como "Médico orientou", "Médico reforçou", "Médico explicou", "Realizado encaminhamento" dentro do SUBJETIVO! Toda e qualquer orientação ou encaminhamento falado pelo médico durante a consulta pertence OBRIGATORIAMENTE à seção CONDUTA.
   - LINGUAGEM SEMIOLÓGICA TÉCNICA E ORGANIZAÇÃO EM PARÁGRAFOS CLÍNICOS (QUALIDADE DE MÉDICO DE FAMÍLIA SÊNIOR):
     * Escreva o "SUBJETIVO" SEMPRE em linguagem médica técnica, formal, clara e bem estruturada em parágrafos por tema clínico (1º Motivo da consulta e história da doença atual detalhada; 2º Saúde mental / comorbidades / revisão de sistemas; 3º Adesão e tolerabilidade medicamentosa; 4º Contexto familiar, regulatório ou trabalhista).
     * É TERMINANTEMENTE PROIBIDO escrever gírias, onomatopeias ou coloquialismos chulos no SUBJETIVO!
   - CONTROLE DE HGT E CONTROLE DE PA DOMICILIAR SEMPRE NO SUBJETIVO (NUNCA NO OBJETIVO!):
     * Sempre que forem relatados ou lidos valores de Glicemia Capilar (HGT) ou de Pressão Arterial aferidos em domicílio, registre dentro do "SUBJETIVO" ("Controle de HGT: ..." / "Controle de PA: ..."). NUNCA coloque médias domiciliares de PA dentro do "OBJETIVO"!

3. REGRA ESTRITA DO EXAME FÍSICO (OBJETIVO) — PADRÃO ÚNICO E IMUTÁVEL (PROIBIDO VARIAR OU ESCREVER POR EXTENSO):
   - É TERMINANTEMENTE PROIBIDO escrever frases metalinguísticas como "Exame físico não detalhado na transcrição", "além da avaliação dos exames laboratoriais", "Exame físico não realizado" ou "Não mencionado no áudio"!
   - PADRÃO FIXO OBRIGATÓRIO DO "OBJETIVO" EM TODOS OS ATENDIMENTOS (NUNCA MUDE ESTE FORMATO):
     * Linha 1 (Ectoscopia base): escreva SEMPRE exatamente "BEG, LOC, MUC" (exceto na Puericultura, que usa "BEG, MUC, ativo, eupneico em ar ambiente, anictérico e acianótico"). É PROIBIDO expandir "MUC" por extenso ("mucosas úmidas e coradas") ou substituir por "corado, hidratado, anictérico, acianótico"!
     * Linha 2 (Sinais vitais / antropometria aferidos hoje, se houver): use sempre siglas padrão separadas por " | " ou uma por linha (ex.: "PA: 120/80 mmHg | FC: 78 bpm | FR: 16 irpm | Tax: 36,5 °C | SpO2: 98% | Peso: 70 kg").
     * Linhas seguintes (Exame segmentar — SOMENTE os sistemas/achados falados pelo médico ou previstos no modelo): use SEMPRE as siglas padronizadas em linhas curtas e objetivas, NUNCA em parágrafo corrido por extenso:
       - AC: (ex.: AC: RCR em 2T, BNF, sem sopros)
       - AP: (ex.: AP: MV+ bilateralmente, sem RA)
       - ABD: (ex.: ABD: Plano, flácido, RHA+, indolor à palpação)
       - MMII: (ex.: MMII: Sem edema, panturrilhas livres)
       - Demais segmentos examinados (Oroscopia:, Otoscopia:, Pele:, SN:, Osteoarticular:, etc.) sempre no mesmo formato "Sigla/Segmento: achado objetivo".
   - No Pré-Natal, mantenha a linha "ABD: Globoso, indolor a palpação superficial e profunda" (ou atualize-a caso o médico descreva dor à palpação, contrações/dinâmica uterina, Giordano, etc.).
   - Em TODOS os modelos de consulta, sempre que o médico falar no áudio ou escrever nas anotações rápidas QUALQUER sinal vital ou achado de exame físico (PA aferida hoje, FC, Peso, AU, BCF, AP, AC, ABD, MMII, Pele/couro cabeludo, estado afetivo/psíquico observado em consultório, oroscopia, otoscopia, toque vaginal, especular, etc.), inclua-os no bloco "OBJETIVO" usando esse padrão fixo!
   - NUNCA copie o exame físico antigo (PA, Peso, AU, BCF da consulta passada) como se fosse o de hoje!

4. REGRA ESTRITA DE EXAMES COMPLEMENTARES (ORDEM CRONOLÓGICA ESTRITA, ZERO DUPLICAÇÃO E ZERO TÍTULOS REPLICADOS!):
   - ${hasAnyExamsToFormat ? 'Há exames complementares a registrar! Inclua-os logo após o OBJETIVO e antes da AVALIAÇÃO.' : 'Se NÃO houver exames trazidos/anexados/falados na consulta de HOJE, NÃO crie o bloco EXAMES COMPLEMENTARES e NÃO copie exames da evolução antiga.'}
   - ${isPrenatalTemplate
     ? 'NO PRÉ-NATAL (MANUTENÇÃO OBRIGATÓRIA DE 100% DOS EXAMES DA EVOLUÇÃO ANTIGA + ADIÇÃO DOS NOVOS EM ORDEM CRONOLÓGICA ESTRITA): Quando houver evolução prévia de Pré-Natal com exames registrados, mantenha TODOS os exames anteriores ("- LABS DD/MM/AAAA: ..." e "- US ... (DD/MM/AAAA): ...") e inclua os exames novos, ordenando SEMPRE da data mais antiga para a data mais recente (ordem cronológica crescente) e NUNCA duplicando a mesma data de exame!'
     : 'PROIBIÇÃO ABSOLUTA DE COPIAR EXAMES DA EVOLUÇÃO ANTIGA NO SOAP E DEMAIS CONSULTAS: Nesta modalidade de consulta, É TERMINANTEMENTE PROIBIDO copiar os exames ("- LABS ..." ou "- US ...") que estavam na evolução antiga! Registre em EXAMES COMPLEMENTARES SOMENTE os exames novos avaliados/trazidos na consulta de HOJE. Se não houver exames novos hoje, omita a seção EXAMES COMPLEMENTARES.'}
   - PROIBIÇÃO ABSOLUTA DE REPLICAR PALAVRAS COMO "ULTRASSONOGRAFIAS / IMAGEM", "EXAMES DE IMAGEM" OU "- LABORATORIAIS:":
     * No Pré-Natal, use EXCLUSIVAMENTE o título "EXAMES COMPLEMENTARES" (seguido diretamente pelas linhas "- LABS DD/MM/AAAA: ...") e o título "ULTRASSONOGRAFIA" (seguido diretamente pelas linhas "- US ... (DD/MM/AAAA): ...").
     * JAMAIS escreva subtítulos extras como "ULTRASSONOGRAFIAS / IMAGEM", "EXAMES DE IMAGEM", "- LABORATORIAIS:" ou "LABORATORIAIS:"!
   - FORMATO COMPACTO OBRIGATÓRIO PARA EXAMES LABORATORIAIS (PROIBIDO UNIDADES DE MEDIDA E PROIBIDO SUB-ÍNDICES REDUNDANTES!):
     * Escreva TODOS os exames laboratoriais da mesma data em UMA ÚNICA LINHA iniciando com "- LABS DD/MM/AAAA: " separados por " | ", usando APENAS SIGLAS MÉDICAS CURTAS + VALOR NUMÉRICO (SEM escrever dois-pontos ":" após cada sigla e SEM escrever unidades como mg/dL, g/dL, U/L, milh./mm³, fL, pg, mEq/L, ng/mL, µUI/mL!).
     * Se já existir uma linha "- LABS DD/MM/AAAA:" para aquela mesma data, unifique tudo em UMA ÚNICA linha para aquela data (JAMAIS repita duas linhas "- LABS 29/08/2026:" na mesma evolução!).
     * É TERMINANTEMENTE PROIBIDO escrever "Hemograma (Eritrócitos: ... | HCM: ... | CHCM: ... | RDW: ... | VPM: ...)", "Glicemia estimada média", "Colesterol Não-HDL" ou "Relação Colesterol Total/HDL"!
     * CÁLCULO AUTOMÁTICO DE TFG (CKD-EPI 2021) E CLASSIFICAÇÃO KDIGO (G1 A G5):
       - Dados de idade/sexo informados manualmente pelo médico: Idade = "${patientAge || 'não informada manualmente'}", Sexo = "${effectivePatientSex || 'não informado manualmente'}".
       - Sempre que houver Creatinina ("Creat"), verifique a idade (no campo manual acima ou impressa no cabeçalho do PDF/laudo) e o sexo (no campo manual acima ou impresso no PDF/laudo).
       - Se e SOMENTE SE você tiver CERTEZA ABSOLUTA tanto da idade (>= 18 anos) quanto do sexo (M ou F), calcule a TFG pela fórmula CKD-EPI 2021 e sua classificação (G1 >=90, G2 60-89, G3a 45-59, G3b 30-44, G4 15-29, G5 <15) e escreva logo após a Creatinina exatamente neste formato: "Creat X,XX | TFG XX (CKD-EPI GX, [idade]a, [M ou F])" (sem repetir "- tfg XX" depois!).
       - Se faltar idade ou sexo ou se não tiver certeza absoluta, NÃO CALCULE A TFG e NÃO INVENTE DADOS (escreva apenas "Creat X,XX")!
     * CÁLCULO AUTOMÁTICO DO ÍNDICE DE SATURAÇÃO DE TRANSFERRINA (IST %):
       - Sempre que houver perfil do ferro com Ferro sérico ("Ferro") e TIBC / CTLF / CLLF / Transferrina, calcule automaticamente o Índice de Saturação de Transferrina em % (IST = Ferro / TIBC * 100; ou se houver apenas Transferrina sem TIBC: TIBC = Transferrina * 1,25) e coloque ao lado a indicação "(calculado)": exemplo "Ferro 114 | Ferritina 267,6 | Transferrina 223,1 | TIBC 274 | IST 41,6% (calculado)".
     * SANGUE OCULTO NAS FEZES SEMPRE COM A SIGLA "SOF" NA MESMA LINHA DOS DEMAIS EXAMES:
       - Quando houver Pesquisa de Sangue Oculto nas Fezes, inclua OBRIGATORIAMENTE em conjunto com os demais exames na mesma linha "- LABS DD/MM/AAAA:" usando a sigla "SOF" ("SOF negativo" ou "SOF positivo"). NUNCA coloque em linha separada!
     * Use OBRIGATORIAMENTE este padrão limpo de siglas:
       - LABS DD/MM/AAAA: Hb 14,1 | Ht 41 | VCM 89,3 | Leuco 11.300 | Plaq 457.700 | RNI 1,02 | KPTT 35s | GJ 110 | HbA1c 5,8% | CT 154 | HDL 35,4 | LDL 90,8 | TAG 186 | Creat 0,91 | TFG 92 (CKD-EPI G1) | Ureia 19 | TGO 21 | TGP 34 | GGT 231 | BT 0,50 (BD 0,20 / BI 0,30) | FA 84 | PCR 5 | Ferro 114 | Ferritina 267,6 | Transferrina 223,1 | TIBC 274 | IST 41,6% (calculado) | TSH 1,40 | T4L 0,57 | B12 294 | Na 139 | K 4,43 | EQU sem alterações | EPF negativo | SOF negativo
   - TÍTULO CORRETO DA SEÇÃO DE EXAMES:
     * Na Consulta Geral (SOAP) e demais consultas fora do Pré-Natal, coloque tanto os exames laboratoriais ("- LABS ...") quanto os exames de imagem ("- TC ...", "- USG ...", "- RX ...", "- ECOCARDIO ...") dentro da seção "EXAMES COMPLEMENTARES" (NUNCA coloque uma Tomografia "- TC" debaixo do título "ULTRASSONOGRAFIA"!).
     * Apenas na Consulta de Pré-Natal separe em "EXAMES COMPLEMENTARES" (para "- LABS") e "ULTRASSONOGRAFIA" (para "- US OBSTÉTRICA / MORFOLÓGICA").
   - PROIBIDO ESCREVER "N/R" OU "Não realizado" para exames que não constam no laudo.

5. REGRA ESTRITA DA AVALIAÇÃO (SEM NUMERAÇÃO E CADA DIAGNÓSTICO EM SUA PRÓPRIA LINHA SEPARADA):
   - Na seção AVALIAÇÃO, liste cada hipótese diagnóstica / problema clínico avaliado em SUA PRÓPRIA LINHA SEPARADA (com quebra de linha \\n).
   - É TERMINANTEMENTE PROIBIDO juntar múltiplos diagnósticos em um parágrafo contínuo corrido!
   - NÃO use numeração ("1.", "2.") nem traços "-". Escreva cada diagnóstico em uma linha limpa.
   - Não coloque códigos CID-10/CIAP-2 dentro do texto (os códigos vão apenas no array JSON "codigos_cid_ciap").

6. REGRA ESTRITA DA CONDUTA MÉDICA (PRIMEIRA PESSOA DO MÉDICO + CADA CONDUTA EM SUA PRÓPRIA LINHA SEPARADA, SEM NUMERAÇÃO E NUNCA EM BLOCO CORRIDO):
   - A CONDUTA deve vir OBRIGATORIAMENTE em 1ª pessoa do singular do médico ("Prescrevo...", "Oriento...", "Solicito...", "Encaminho...", "Renovo...", "Agendo...").
   - CADA AÇÃO MÉDICA DEVE ESTAR EM SUA PRÓPRIA LINHA SEPARADA (com quebra de linha \\n entre cada ação):
     * Exemplo:
       Prescrevo Paracetamol 500mg: tomar 1 comprimido até de 6/6h se dor por 3 dias.
       Solicito RX de punho e mão direita.
       Encaminho para Ortopedia via regulação estadual.
       Oriento repouso relativo e evitar carregar peso.
       Oriento sinais de alarme e na presença procurar emergência imediatamente.
       Ciente, concordante e sem dúvidas.
   - É TERMINANTEMENTE PROIBIDO gerar condutas em bloco corrido contínuo (tudo na mesma linha ou sem quebras de linha)!
   - NÃO COLOQUE NUMERAÇÃO ("1.", "2.", "3."): escreva cada conduta em sua própria linha separada.
   - PRESCRIÇÕES MÉDICAS COMPLETAS:
     * Toda e qualquer medicação prescrita, ajustada ou renovada deve estar detalhada na CONDUTA com nome oficial brasileiro, dosagem, frequência, posologia e duração.
     * É ERRO MÉDICO GRAVÍSSIMO deixar o bloco CONDUTA vazio ou esquecer de registrar as medicações que o médico prescreveu no consultório!
   - Se o médico renovou receitas de uso contínuo, escreva na CONDUTA: "Renovo medicações de uso contínuo" (ou "Renovo receitas de medicações de uso contínuo"). É TERMINANTEMENTE PROIBIDO escrever "#MUC", "# MUC" ou "(conforme # MUC)" dentro da CONDUTA!
   - Use sempre a grafia oficial brasileira ("Sinvastatina" com N, "Anlodipino" com N, "Hidroclorotiazida" com I, "Levotiroxina", "Ácido Acetilsalicílico", etc.).

7. REGRA DA SEÇÃO PLANO (OPCIONAL — NEM TODO ATENDIMENTO TEM PLANO!):
   - A seção PLANO é OPCIONAL e só existe quando o médico DISSE, de forma explícita, ações/exames/encaminhamentos/metas para as PRÓXIMAS CONSULTAS (ex: "na próxima consulta a gente pede perfil lipídico", "se mantiver a queixa, encaminho para Oftalmologia no retorno").
   - Quando existir, ela vem logo após a CONDUTA, com cada item em sua própria linha, sem numeração.
   - Se o médico NÃO falou nada assim: NÃO escreva a palavra "PLANO", NÃO crie a seção e NÃO invente texto. O atendimento termina na CONDUTA.
   - É TERMINANTEMENTE PROIBIDO usar frases genéricas no PLANO (como "Seguimento ambulatorial na APS conforme necessidade clínica", "Sem pendências", "Acompanhamento ambulatorial").
   - Retorno/agendamento já combinado ("retorno em 30 dias") pertence à CONDUTA, não ao PLANO.

8. REGRAS ESPECÍFICAS DE TELESSAÚDE, INTERCONSULTA, PUERICULTURA, PRÉ-NATAL E VISITA DOMICILIAR:
   - No PRÉ-NATAL (OBSTETRÍCIA):
     * A paciente é SEMPRE do sexo Feminino (F).
   - Na INTERCONSULTA COM A ENFERMAGEM:
     * ${soapSubtypeHeader && /resumid/i.test(soapSubtypeHeader) ? `O médico selecionou a VERSÃO RESUMIDA:
       NÃO gere cabeçalho '#', NÃO inclua MUC nem patologias prévias, e NÃO divida em blocos de SUBJETIVO, OBJETIVO, AVALIAÇÃO e CONDUTA.
       Gere estritamente o título "## INTERCONSULTA COM A ENFERMAGEM ##" seguido de TEXTO CORRIDO DETALHADO E OBJETIVO para ditado rápido, relatando a interconsulta a pedido da enfermagem, dados clínicos, exame direcionado se houver, diagnóstico e as condutas pactuadas alinhadas com a equipe de enfermagem.` : `O médico selecionou a VERSÃO COMPLETA:
       Siga rigorosamente a estrutura padrão completa com cabeçalho "#", "# MUC:", "# Alergias:", SUBJETIVO, OBJETIVO, AVALIAÇÃO e CONDUTA (e PLANO apenas se o médico citou ações futuras).`}
   - Na DISCUSSÃO COM TELESSAÚDE (TELECONSULTORIA):
     * DEIXE EXCLUSIVAMENTE A PARTE DA CONDUTA! É TERMINANTEMENTE PROIBIDO gerar blocos de SUBJETIVO, OBJETIVO ou AVALIAÇÃO e PROIBIDO importar cabeçalho '#' com comorbidades anteriores!
     * A evolução do Telessaúde deve conter estritamente o título "## DISCUSSÃO COM TELESSAÚDE (TELECONSULTORIA) ##" e a seção "CONDUTA". NADA MAIS!
     * Na CONDUTA: transcreva e estruture toda a discussão da Teleconsultoria, contextualização do caso, considerações do teleconsultor, parecer especializado, orientações diagnósticas e plano terapêutico alinhado em TEXTO CORRIDO DETALHADO (em 1ª pessoa do médico: "Discuto caso com a teleconsultoria do Telessaúde...", "Alinho conduta...", "Oriento...", "Prescrevo..."), sem tópicos e sem listas numeradas, preservando todas as orientações especializadas, justificativas clínicas, doses e condutas pactuadas!
   - Na PUERICULTURA — ANTROPOMETRIA SEMPRE EM Z-SCORE (OMS), NUNCA EM PERCENTIL:
     * É TERMINANTEMENTE PROIBIDO escrever "percentil", "P3", "P15", "P50", "P85", "P97" ou qualquer classificação em percentil. O padrão deste serviço é EXCLUSIVAMENTE Z-score (desvios-padrão da OMS), ex.: "Peso/Idade: Z +0,4 | Comprimento/Idade: Z -1,2".
     * Use somente os Z-scores fornecidos em "=== DADOS OBJETIVOS / ANTROPOMETRIA / Z-SCORE ===" ou verbalizados pelo médico. Se não houver Z-score, escreva apenas as medidas (peso, altura, PC) SEM classificar em percentil e SEM inventar valores.
   - Na PUERICULTURA — VACINAS (REGRA CRÍTICA, ERRO GRAVE SE VIOLADA):
     * Em "# Vacinas:" escreva SOMENTE o que o médico disse. É TERMINANTEMENTE PROIBIDO escrever "atualizadas", "em dia" ou "calendário completo" a menos que o médico tenha afirmado isso claramente.
     * Se o médico disse que há vacinas pendentes/em atraso, registre assim: "- Em atraso: [quais vacinas/idades, se citadas]" e na CONDUTA registre o plano de atualização (ex.: "Posterg(o) aplicação ..." conforme dito).
     * Se o médico não falou nada sobre vacinas, deixe "# Vacinas:" SEM conteúdo (nunca preencha por conta própria, nunca escreva "Pendente" ou "Atualizadas" por suposição).
     * Jamais escreva linhas como "- atualizadas: Pendente".
   - Na PUERICULTURA: É TERMINANTEMENTE PROIBIDO calcular ou inventar Z-Score por conta própria! Só escreva Z-Score se o médico verbalizou no áudio ou se vier calculado em "=== DADOS OBJETIVOS / ANTROPOMETRIA / Z-SCORE ===".
   - Na PUERICULTURA — EXAME FÍSICO (OBJETIVO): Siga fielmente a estrutura pediátrica do modelo (BEG, MUC, ativo, eupneico em ar ambiente, anictérico e acianótico; Peso; Altura; PC; Marcos do desenvolvimento; AP; AC; ABD; Extremidades/TEC; Hidratação; Fontanelas; Ortolani; Barlow; Oroscopia; Otoscopia; e observações sobre teste do olho vermelho/coraçãozinho), atualizando qualquer item conforme o exame físico falado no áudio ou a faixa etária.
   - Na VISITA DOMICILIAR:
     * Só coloque data no título ("## VISITA DOMICILIAR EM DD/MM/AAAA - REGISTRO POSTERIOR ##") se a data da visita tiver sido informada explicitamente (${vdVisitDate ? `use ${vdVisitDate}` : 'caso contrário mantenha "## VISITA DOMICILIAR - REGISTRO POSTERIOR ##" sem assumir a data de hoje'}).
     * NUNCA invente nomes de Enfermeiro(a), ACS ou Familiar/Cuidador e NUNCA invente grau de parentesco! Só preencha se tiver sido dito de forma inequívoca.
     * Preencha ao final o checklist ">> PENDÊNCIAS PARA REALIZAR NO POSTO (UBS) PÓS-VISITA:".

9. BLINDAGEM CONTRA INTERRUPÇÕES DE ENFERMAGEM E DIFERENCIAÇÃO VOZ DO MÉDICO VS. PACIENTE:
   - ${templateObj.id === 'interconsulta' ? 'Este atendimento é uma Interconsulta com a Enfermagem.' : 'Filtre e descarte qualquer interrupção paralela de terceiros/enfermagem falando de outro paciente.'}
   - Quando o [MÉDICO] estiver explicando alterações de exames para o paciente, JAMAIS escreva no SUBJETIVO que "Paciente refere tal alteração".
${parsedPrev && !isTelessaudeTemplate ? `
9. IMPORTAÇÃO OBRIGATÓRIA DOS DADOS DA EVOLUÇÃO ANTERIOR (PROMOVENDO PATOLOGIAS CRÔNICAS E BLOQUEANDO QUEIXAS AGUDAS NAS "#"!):
   - Abaixo estão extraídos da evolução anterior do paciente: (A) o Cabeçalho "#" anterior completo + Patologias Crônicas da Avaliação anterior, ${isPrenatalTemplate ? '(B) os Exames Laboratoriais e Ultrassonografias anteriores do Pré-Natal, e (C)' : 'e (B)'} a Avaliação e Conduta da última consulta.
   - ATENÇÃO: O SUBJETIVO e o OBJETIVO antigos foram removidos propositalmente para que você construa o SUBJETIVO e o OBJETIVO de hoje 100% a partir da consulta de HOJE!
   - Siga obrigatoriamente:
     1) Copie FIELMENTE as linhas "#" e as sub-linhas clínicas com "-" do "CABEÇALHO # DA EVOLUÇÃO ANTERIOR" abaixo (sem copiar medicações soltas em linhas "-", pois medicações vão todas em "# MUC:"). Além disso, inclua no cabeçalho "#" as PATOLOGIAS CRÔNICAS ou CONDIÇÕES IMPORTANTES diagnosticadas na AVALIAÇÃO anterior (sem adjetivos de status como "controle irregular" e sem duplicar sinônimos). JAMAIS puxe queixas agudas (IVAS, amigdalite, gastroenterite, ITU, etc.) para as "#"!
     2) Atualize a linha "# MUC:" com as medicações de uso contínuo que estavam em uso + as medicações contínuas prescritas na "CONDUTA DA ÚLTIMA CONSULTA" (separando cada medicamento claramente com sua própria dose e posologia, sem misturar doses!), excluindo medicações suspensas.
     ${isPrenatalTemplate ? '3) No Pré-Natal, mantenha TODOS os "EXAMES LABORATORIAIS ANTERIORES" em EXAMES COMPLEMENTARES e TODAS as "ULTRASSONOGRAFIAS ANTERIORES" em ULTRASSONOGRAFIA, adicionando os exames novos de hoje e ordenando tudo em ordem cronológica (da data mais antiga para a mais recente), sem repetir títulos e sem duplicar a mesma data!' : '3) NÃO copie os exames da evolução anterior! Inclua em EXAMES COMPLEMENTARES apenas os exames novos avaliados hoje.'}

=== (A) CABEÇALHO "#" DA EVOLUÇÃO ANTERIOR ===
${parsedPrev.headerLines && parsedPrev.headerLines.length > 0 ? `(MANTER EXATAMENTE ESTAS LINHAS "#" E SUB-LINHAS "-"!):\n${parsedPrev.headerText}` : (previousConsultationText ? `(EVOLUÇÃO ANTERIOR EM OUTRO FORMATO — EXTRAIR COMORBIDADES CRÔNICAS PARA "#", "# MUC:", "# Tabagista:" E "# Alergias:", MAS GERAR ESTRITAMENTE NO MODELO PADRÃO!):\n${previousConsultationText}` : 'Nenhum cabeçalho anterior.')}${parsedPrev.promotedFromAvaliacao && parsedPrev.promotedFromAvaliacao.length > 0 ? `\n\nPATOLOGIAS CRÔNICAS/IMPORTANTES DA AVALIAÇÃO ANTERIOR A INCLUIR NO CABEÇALHO "#":\n${parsedPrev.promotedFromAvaliacao.join('\n')}` : ''}
${parsedPrev.unstructuredText ? `\nANOTAÇÕES DA EVOLUÇÃO ANTERIOR:\n${parsedPrev.unstructuredText}\n` : ''}
${isPrenatalTemplate ? `
=== (B) EXAMES ANTERIORES DO PRÉ-NATAL (MANTER TODOS EM ORDEM CRONOLÓGICA E ADICIONAR OS NOVOS!) ===
${parsedPrev.labExamLines.length > 0 ? 'EXAMES COMPLEMENTARES ANTERIORES (- LABS):\n' + parsedPrev.labExamLines.join('\n') : 'Sem labs anteriores.'}
${parsedPrev.usgExamLines.length > 0 ? '\nULTRASSONOGRAFIAS ANTERIORES (- US):\n' + parsedPrev.usgExamLines.join('\n\n') : ''}
` : ''}
=== (${isPrenatalTemplate ? 'C' : 'B'}) AVALIAÇÃO E CONDUTA DA ÚLTIMA CONSULTA (PARA ATUALIZAR # MUC, CHECAR ADESÃO E PROMOVER APENAS PATOLOGIAS CRÔNICAS PARA AS "#") ===
AVALIAÇÃO ANTERIOR:
${parsedPrev.avaliacaoText || 'Não informada.'}
CONDUTA ANTERIOR:
${parsedPrev.condutaText || 'Não informada.'}
` : ''}${previousEvolutionContext ? `
🚨 REGRA INVIOLÁVEL DE CONTINUAÇÃO DE ATENDIMENTO DO MESMO PACIENTE (PARTE 2 / RETOMADA):
O médico finalizou/pausou momentaneamente a consulta apenas para gerar um encaminhamento ou receituário e agora gravou a CONTINUAÇÃO deste mesmo atendimento.
A 1ª PARTE DA EVOLUÇÃO JÁ ESTÁ REVISADA E APROVADA PELO MÉDICO ABAIXO:
=== EVOLUÇÃO APROVADA DA 1ª PARTE (DEVE SER MANTIDA INTEGRALMENTE) ===
${previousEvolutionContext}
=== FIM DA 1ª PARTE ===

DIRETRIZES OBRIGATÓRIAS PARA A CONTINUAÇÃO:
1. NUNCA REESCREVA, NÃO APAGUE E NÃO RESUMA O QUE JÁ FOI DESCRITO NA 1ª PARTE!
2. NO SUBJETIVO: Mantenha 100% das frases e histórico da 1ª parte intactos. Se o paciente relatou novas queixas ou detalhes no áudio da continuação, adicione ao final do Subjetivo como um novo parágrafo. Se nada de novo foi relatado pelo paciente, mantenha o Subjetivo EXATAMENTE IGUAL ao da 1ª parte.
3. NO OBJETIVO: Mantenha o exame físico da 1ª parte 100% idêntico. Adicione apenas se algum novo exame físico foi citado no áudio da continuação.
4. NA CONDUTA (MÁXIMA PRIORIDADE): Todas as condutas, prescrições, receitas e encaminhamentos da 1ª parte DEVEM SER MANTIDOS na íntegra e na mesma numeração! Adicione as novas orientações, receitas ou recomendações decididas na continuação como NOVOS ITENS NUMERADOS subsequentes ao final da lista (ex: itens 4., 5., etc.). NUNCA substitua ou resuma a conduta da 1ª parte!
5. CABEÇALHO (# MUC, Alergias, etc.): Conserve exatamente os mesmos blocos já aprovados na 1ª parte.
` : ''}${preTranscribedExamsText ? `\n=== EXAMES COMPLEMENTARES NOVOS JÁ TRANSCRITOS HOJE (INCLUA EM ORDEM CRONOLÓGICA SEPARANDO LABS E ULTRASSONOGRAFIA) ===\n${preTranscribedExamsText}\n` : ''}
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
BEG, LOC, MUC
PA: 120/80 mmHg | FC: 74 bpm | Peso: 78 kg
ABD: Plano, flácido, doloroso à palpação superficial e profunda em epigástrio, sem massas ou visceromegalias, DB negativa, RHA+

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

PLANO
Na próxima consulta, solicitar perfil lipídico e glicemia de jejum.
Avaliar desmame do Omeprazol se remissão completa dos sintomas dispépticos.
(OBSERVAÇÃO: neste exemplo o médico DISSE essas ações futuras no áudio. Se no atendimento real ele NÃO disser nada sobre próximas consultas, OMITA completamente a palavra PLANO e termine na CONDUTA.)

=== MODELO DE REFERÊNCIA A SER SEGUIDO NESTA CONSULTA ===
${effectiveTemplateText}

=== FORMATO DE RESPOSTA (JSON OBRIGATÓRIO) ===
Responda em JSON válido contendo exatamente estas chaves:
{
  ${hasPreTranscribedAudio ? '' : '"transcricao_literal_do_audio": "Transcrição fiel e INTEGRAL de 100% do que foi falado no áudio do início ao fim separando [MÉDICO]: e [PACIENTE]: (incluindo todas as queixas, relatos de emergência e explicações!)",\n  '}"evolucao_completa": "Texto completo e detalhado da evolução estruturada seguindo fielmente o MODELO DE REFERÊNCIA, incluindo 100% de tudo o que foi dito na consulta e mantendo todas as #, sub-linhas '-' e regras de exames com quebras de linha \\n",
  "codigos_cid_ciap": ["Lista com os códigos CIAP-2 e CID-10 sugeridos para digitar fora da evolução no PEC (ou [] se não houver diagnóstico)"],
  "especialidade_sugerida_encaminhamento": "Se durante a consulta foi citado encaminhamento, informe a especialidade, caso contrário deixe string vazia",
  "alertas_auditoria": ["Lista curta apenas se houve interferência externa grave no áudio"]
}`;
};

// ============================================================================
// GERADOR DE PROMPT PARA TRANSCRIÇÃO INSTANTÂNEA DE EXAMES (ANEXOS OU NOTAS RÁPIDAS)
// ============================================================================
window.buildInstantExamTranscriptionPrompt = function(notesText, patientAge = '', patientSex = '') {
  return `Você é um Médico de Família e Comunidade na APS/UBS.
Analise TODOS os exames complementares fornecidos (sejam arquivos PDF/imagens anexados E/OU exames colados/escritos nas Anotações Rápidas abaixo) e converta 100% dos resultados de exames para o formato padrão de prontuário abaixo.
${notesText ? `\n=== TEXTO COLADO / ESCRITO NAS ANOTAÇÕES RÁPIDAS ===\n${notesText}\n` : ''}
${patientAge || patientSex ? `\n=== DADOS DO PACIENTE INFORMADOS PELO MÉDICO ===\nIdade: ${patientAge || 'verificar no PDF/laudo'} | Sexo: ${patientSex || 'verificar no PDF/laudo'}\n` : ''}
REGRAS OBRIGATÓRIAS:
1. TRANSCREVA 100% DE TODOS OS EXAMES REALIZADOS PRESENTES NO LAUDO/PDF OU NO TEXTO COLADO: Inclua TODOS os exames que tiverem resultado (hemograma completo, bioquímica, função renal, eletrólitos, hepatograma, perfil lipídico, tireoide, hormônios, vitaminas, ferro/ferritina/transferrina/TIBC, sorologias, urina/EQU, urocultura, parasitológico EPF, sangue oculto nas fezes SOF, exames de imagem, etc.). Ignore valores de referência do laboratório e cabeçalhos burocráticos.
2. PROIBIDO ESCREVER "N/R" OU "Não realizado": Só inclua exames que efetivamente possuem resultado informado.
3. FORMATO EXATO (DIFERENCIANDO EXAME LABORATORIAL DE EXAME DE IMAGEM):
   - SE FOR EXAME LABORATORIAL (todos os exames da mesma data em UMA ÚNICA LINHA, iniciando com "- LABS [DD/MM/AAAA]: " ou "- LABS: " se não houver data, separados por " | ", usando siglas médicas curtas + valor numérico, SEM unidades de medida como mg/dL, g/dL, U/L, fL, pg):
     * CÁLCULO AUTOMÁTICO DE TFG (CKD-EPI 2021) E CLASSIFICAÇÃO (G1 A G5):
       - Sempre que houver Creatinina ("Creat"), verifique a IDADE (informada pelo médico acima ou descrita no cabeçalho do PDF/laudo) e o SEXO (informado acima ou descrito no PDF/laudo).
       - Se e SOMENTE SE você tiver CERTEZA ABSOLUTA tanto da idade (>= 18 anos) quanto do sexo (M ou F) nos dados do exame/atendimento, calcule a TFG CKD-EPI 2021 e sua classificação (G1 >=90, G2 60-89, G3a 45-59, G3b 30-44, G4 15-29, G5 <15) e inclua logo após a Creatinina exatamente neste formato: "Creat X,XX | TFG XX (CKD-EPI GX, [idade]a, [M ou F])".
       - SE NÃO TIVER CERTEZA ABSOLUTA DA IDADE OU DO SEXO: NÃO CALCULE A TFG e NÃO MOSTRE DADO DUVIDOSO (escreva apenas "Creat X,XX")!
     * CÁLCULO AUTOMÁTICO DO ÍNDICE DE SATURAÇÃO DE TRANSFERRINA (IST %):
       - Ao ter o perfil do ferro com Ferro sérico ("Ferro") e TIBC / CTLF / CLLF / Transferrina, calcule automaticamente o Índice de Saturação de Transferrina em % (IST = Ferro / TIBC * 100; ou se houver apenas Transferrina: TIBC = Transferrina * 1,25) e coloque ao lado "(calculado)": exemplo "Ferro 114 | Ferritina 267,6 | Transferrina 223,1 | TIBC 274 | IST 41,6% (calculado)".
     * SANGUE OCULTO NAS FEZES COM A SIGLA "SOF":
       - Quando houver Sangue Oculto nas Fezes, coloque SEMPRE em conjunto com os demais exames na mesma linha "- LABS" usando a sigla "SOF" ("SOF negativo" ou "SOF positivo").
     Exemplo: - LABS 17/08/2026: Hb 15,3 | Ht 43,7 | VCM 89 | Leuco 6.990 | Plaq 303.000 | GJ 90,9 | HbA1c 4,4% | Creat 0,97 | TFG 92 (CKD-EPI G1, 48a, M) | Ureia 22,2 | Na 140 | K 4,6 | TGO 18 | TGP 18 | CT 195,1 | HDL 33,8 | LDL 143,6 | TAG 74 | Ferro 114 | Ferritina 267,6 | Transferrina 223,1 | TIBC 274 | IST 41,6% (calculado) | TSH 0,81 | EQU sem alterações | EPF negativo | SOF negativo
   - SE FOR EXAME DE IMAGEM / MÉTODOS GRÁFICOS (iniciando com "- [MODALIDADE E REGIÃO EM MAIÚSCULO] [DD/MM/AAAA se houver]: " em texto corrido conciso na mesma linha, sem tópicos soltos):
     Exemplo 1: - USG ABDOME TOTAL 12/09/2026: Fígado com dimensões normais e aumento difuso da ecogenicidade compatível com esteatose hepática leve. Demais estruturas sem alterações.
     Exemplo 2: - ECOCARDIO TT 20/11/2025: FE 52,2%. Ventrículo esquerdo com hipertrofia excêntrica, disfunção sistólica global leve por hipocinesia difusa e disfunção diastólica padrão déficit de relaxamento.

Responda APENAS com as linhas formatadas dos exames, prontas para copiar e colar no prontuário, sem títulos extras ou comentários.`;
};

// ============================================================================
// GERADOR DE PROMPT PARA ENCAMINHAMENTO (REGULAÇÃO ESTADUAL / TELESSAÚDERS / REGULASUS)
// ============================================================================
window.buildReferralPrompt = function({
  templateId,
  templateName,
  evolucaoTexto,
  rawTranscript,
  preTranscribedExamsText,
  especialidade,
  motivoEncaminhamento,
  dadosExtrasRegulacao,
  quickNotes,
  telessaudeProtocolText
}) {
  const hasProtocolText = Boolean(telessaudeProtocolText && telessaudeProtocolText.trim().length > 100);
  const protocolBlock = hasProtocolText
    ? `\n=== DIRETRIZES OFICIAIS DO PROTOCOLO TELESSAÚDERS (${especialidade.toUpperCase()}) ===\n${telessaudeProtocolText.slice(0, 50000)}\n=== FIM DO PROTOCOLO TELESSAÚDERS ===\n`
    : '';

  const motivoHeader = (motivoEncaminhamento && motivoEncaminhamento.trim())
    ? `\n- MOTIVO ESPECÍFICO / CONDIÇÃO INDICADA PELO MÉDICO: "${motivoEncaminhamento.trim()}" (BUSCA DIRETA NO PROTOCOLO)\n`
    : '';

  const transcriptBlock = (rawTranscript && rawTranscript.trim().length > 20)
    ? `\n=== TRANSCRIÇÃO LITERAL DA CONSULTA (USE PARA RESGATAR QUALQUER DETALHE CLÍNICO, TEMPO DE EVOLUÇÃO, TRATAMENTOS PRÉVIOS OU EXAMES CITADOS NO ÁUDIO) ===\n${rawTranscript.trim()}\n`
    : '';

  const examsBlock = (preTranscribedExamsText && preTranscribedExamsText.trim().length > 10)
    ? `\n=== EXAMES ANEXADOS / PRÉ-TRANSCRITOS ===\n${preTranscribedExamsText.trim()}\n`
    : '';

  return `Você é um Médico Regulador experiente e Médico de Família da APS especialista nos Protocolos de Regulação Ambulatorial do TelessaúdeRS / RegulaSUS (SES-RS / GERCON / SISREG).

Sua missão é gerar uma solicitação médica de encaminhamento COMPLETA, DETALHADA e PRONTA PARA REGULAÇÃO (GERCON/SISREG) com enquadramento oficial no protocolo do TelessaúdeRS para a especialidade solicitada: "${especialidade}".

=== CONTEXTO DA CONSULTA NA UBS ===
- Tipo de Atendimento: ${templateName || 'Consulta APS'} (${templateId || 'geral'})
- Especialidade Solicitada: ${especialidade}${motivoHeader}
- Tratamentos Prévios na APS / Dados Adicionais Informados: ${dadosExtrasRegulacao || 'Vide evolução clínica'}
- Notas Rápidas: ${quickNotes || 'Nenhuma'}
${protocolBlock}
=== EVOLUÇÃO CLÍNICA COMPLETA DO PACIENTE ===
${evolucaoTexto}
${transcriptBlock}${examsBlock}
=== REGRAS MANDATÓRIAS (SIGA COM MÁXIMA RIGIDEZ MÉDICA) ===

1. ENQUADRAMENTO CLÍNICO NO PROTOCOLO TELESSAÚDERS:
   - ${motivoEncaminhamento ? `O médico assistente indicou expressamente o motivo do encaminhamento: "${motivoEncaminhamento}". Busque e enquadre o caso DIRETAMENTE no capítulo/protocolo do TelessaúdeRS correspondente a "${motivoEncaminhamento}" (exemplo: Protocolo 2 – Insuficiência Cardíaca, Protocolo 5 – Patologias de mão e punho, etc.).` : `Identifique no protocolo do TelessaúdeRS para ${especialidade} (ou em seu conhecimento médico aprofundado dos protocolos RegulaSUS/TelessaúdeRS) qual é a patologia ou condição clínica específica do paciente.`}
   - Indique em 1 linha o critério clínico específico do protocolo no qual o paciente se enquadra.

2. FILTRO ESTRITO DE RELEVÂNCIA CLÍNICA COM PRESERVAÇÃO INTEGRAL DE DADOS FARMACOLÓGICOS E LABORATORIAIS:
   - A justificativa clínica deve conter os dados clínicos, queixas, exame físico, exames complementares e tratamentos diretamente pertinentes à especialidade "${especialidade}".
   - Não inclua queixas ou detalhes irrelevantes de outros aparelhos sem relação (ex.: em Ginecologia, não cite exame oftalmológico ou dor no ombro; em Ortopedia, não cite preventivo ginecológico).
   - CONTUDO, É ESTRITAMENTE OBRIGATÓRIO manter completas as seções de Condições de Saúde, Medicações em Uso Contínuo (MUC com doses e posologia na íntegra), Alergias, Tabagismo e Exames Complementares descritos, pois o médico regulador necessita dessas informações para a regulação do paciente!

3. PREENCHIMENTO COMPLETO E ESTRUTURADO — PROIBIDO RESUMIR, SUPRIMIR OU ESCREVER "NÃO INFORMADO" SE HOUVER DADOS:
   - Leia TODAS as fontes acima (Evolução Clínica, Transcrição Literal da Consulta, Notas Rápidas, Dados Adicionais e Exames Anexados) antes de redigir.
   - É TERMINANTEMENTE PROIBIDO escrever "Não informado", "Não descrito" ou deixar seções rasas/genéricas quando a informação estiver presente na evolução, na transcrição literal, nas notas ou nos exames!
   - Redija a JUSTIFICATIVA CLÍNICA PARA A REGULAÇÃO de forma técnica, completa e estruturada nos seguintes blocos obrigatórios:
     * MOTIVO DO ENCAMINHAMENTO E HISTÓRIA CLÍNICA: Tempo de evolução, queixa principal, sintomas, gravidade, impacto funcional e tratamentos já realizados na APS com doses, tempo de uso e resposta terapêutica.
     * EXAME FÍSICO DIRECIONADO: Sinais vitais pertinentes e achados semiológicos objetivos (manobras de Tinel/Phalen se punho/mão, amplitude articular, ectoscopia, etc.).
     * CONDIÇÕES DE SAÚDE / COMORBIDADES: Todas as patologias prévias do paciente (ex: HAS, DM, obesidade, asma, etc.).
     * MEDICAÇÕES EM USO CONTÍNUO (MUC): Descreva TODAS as medicações que o paciente usa, COM NOME COMPLETO, DOSES E POSOLOGIA/FORMA DE USO (ex.: "Losartana 50mg 1cp 12/12h; Anlodipino 5mg 1cp 1x/dia pela manhã; Metformina 850mg 1cp 2x/dia após refeições"). É TERMINANTEMENTE PROIBIDO suprimir medicamentos ou omitir dosagens e posologias! Se não houver, escreva: "Nega uso contínuo de medicamentos".
     * ALERGIAS E TABAGISMO: Declarar expressamente alergias conhecidas e status de tabagismo (ex.: "Alergias: Nega alergias conhecidas | Tabagismo: Não tabagista / Ex-tabagista há X anos / Tabagista passivo").
     * EXAMES COMPLEMENTARES: Transcrever os exames laboratoriais e de imagem COM RESPECTIVAS DATAS, VALORES NUMÉRICOS EXATOS E LAUDOS NA ÍNTEGRA. É TERMINANTEMENTE PROIBIDO resumir com frases genéricas como "exames laboratoriais normais"; cada exame realizado deve ser explicitamente descrito com seus valores e datas para avaliação do médico regulador!
     * HIPÓTESE DIAGNÓSTICA E SOLICITAÇÃO: Solicitação clara e justificada de avaliação e conduta na especialidade.

4. IDENTIFICAÇÃO DE INFORMAÇÕES E EXAMES PENDENTES SEGUNDO O TELESSAÚDERS:
   - Compare os dados presentes na evolução com o "Conteúdo descritivo mínimo que o encaminhamento deve ter" e os critérios de encaminhamento do protocolo do TelessaúdeRS para a condição identificada.
   - Se faltar algum exame complementar obrigatório (ex: eletroneuromiografia recente, radiografia da articulação com data, tempo mínimo de tratamento clínico na APS antes de referenciar como órtese por 3 meses, etc.), liste cada pendência em tópicos claros no bloco final de pendências.
   - Se todos os critérios e exames exigidos já constarem na consulta, escreva: "✅ Todos os critérios e exames exigidos pelo protocolo do TelessaúdeRS para esta condição estão preenchidos na justificativa."

5. PRIORIDADE:
   - A prioridade NÃO deve ser fixada pelo médico solicitante no texto, pois a classificação de risco compete exclusivamente à Regulação Estadual baseada na gravidade descrita.

=== ESTRUTURA EXATA DA RESPOSTA (UTILIZE EXATAMENTE ESTES 3 BLOCOS) ===

JUSTIFICATIVA CLÍNICA PARA A REGULAÇÃO:
MOTIVO DO ENCAMINHAMENTO E HISTÓRIA CLÍNICA:
[Descrição detalhada do quadro clínico, tempo de evolução, gravidade e tratamentos já realizados na APS com doses e tempo]

EXAME FÍSICO DIRECIONADO:
[Sinais vitais e achados semiológicos pertinentes à patologia]

CONDIÇÕES DE SAÚDE / COMORBIDADES:
[Patologias prévias do paciente]

MEDICAÇÕES EM USO CONTÍNUO (MUC):
[Relação completa de todos os medicamentos com doses e posologia na íntegra, sem omissões]

ALERGIAS E TABAGISMO:
[Status de alergias e histórico de tabagismo]

EXAMES COMPLEMENTARES:
[Exames com datas, valores numéricos e laudos completos na íntegra]

HIPÓTESE DIAGNÓSTICA E SOLICITAÇÃO:
[Hipótese diagnóstica principal e solicitação para a especialidade]

ENQUADRAMENTO NO PROTOCOLO TELESSAÚDERS:
• Condição Clínica: [Nome do protocolo e condição no TelessaúdeRS]
• Critério do Protocolo: [Critério de indicação atendido]

⚠️ PENDÊNCIAS SEGUNDO O PROTOCOLO TELESSAÚDERS:
[Lista em tópicos dos exames, tempos de tratamento ou dados de exame físico exigidos pelo protocolo do TelessaúdeRS para esta condição que NÃO constam na evolução atual, ou declare: "✅ Todos os critérios e exames exigidos pelo protocolo do TelessaúdeRS para esta condição estão preenchidos na justificativa."]`;
};

window.buildImproveReferralPrompt = function({
  currentReferralText,
  evolucaoTexto,
  rawTranscript,
  preTranscribedExamsText,
  quickNotes,
  dadosExtrasRegulacao,
  especialidade,
  improvementInstruction
}) {
  const instrBlock = (improvementInstruction && improvementInstruction.trim())
    ? `\n=== PEDIDO ESPECÍFICO DO MÉDICO PARA ESTA MELHORIA ===\n${improvementInstruction.trim()}\n`
    : '';
  const transcriptBlock = (rawTranscript && rawTranscript.trim().length > 20)
    ? `\n=== TRANSCRIÇÃO LITERAL DA CONSULTA ===\n${rawTranscript.trim()}\n`
    : '';
  const examsBlock = (preTranscribedExamsText && preTranscribedExamsText.trim().length > 10)
    ? `\n=== EXAMES ANEXADOS / PRÉ-TRANSCRITOS ===\n${preTranscribedExamsText.trim()}\n`
    : '';

  return `Você é um Médico Regulador experiente (TelessaúdeRS / RegulaSUS / GERCON / SISREG).
O médico assistente revisou o encaminhamento abaixo para "${especialidade || 'Especialidade Médica'}" e considerou que ele está fraco, resumido demais ou com falta de informações clínicas.

Sua missão é REESCREVER, ENRIQUECER E COMPLETAR o encaminhamento mantendo rigorosamente a mesma estrutura de 3 blocos (JUSTIFICATIVA CLÍNICA PARA A REGULAÇÃO, ENQUADRAMENTO NO PROTOCOLO TELESSAÚDERS e ⚠️ PENDÊNCIAS SEGUNDO O PROTOCOLO TELESSAÚDERS), resgatando 100% dos detalhes clínicos, tempo de evolução, impacto funcional, achados semiológicos, comorbidades, MUC completa com doses/posologias, alergias, tabagismo, tratamentos prévios na APS e TODOS os exames com datas e valores exatos presentes nos registros abaixo.
PROIBIDO inventar dados não presentes nos registros! Se algo realmente não constar em nenhuma fonte, mantenha a sinalização clara apenas em Pendências.
${instrBlock}
=== ENCAMINHAMENTO ATUAL (PARA MELHORAR E ENRIQUECER) ===
${currentReferralText}

=== EVOLUÇÃO CLÍNICA COMPLETA ===
${evolucaoTexto || ''}
${transcriptBlock}${examsBlock}
=== NOTAS RÁPIDAS / DADOS ADICIONAIS ===
${quickNotes || 'Nenhuma'}
${dadosExtrasRegulacao ? `\nDados adicionais informados: ${dadosExtrasRegulacao}` : ''}

Responda APENAS com o texto final melhorado do encaminhamento (sem markdown \`\`\`, sem comentários extras).`;
};
