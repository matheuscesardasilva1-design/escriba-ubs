// ============================================================================
// MODELOS DE EVOLUÇÃO UBS & PROMPTS CLÍNICOS (SEMIOLOGIA + RESGUARDO JURÍDICO)
// ============================================================================

window.DEFAULT_TEMPLATES = {
  geral: {
    id: 'geral',
    name: 'Consulta Geral (SOAP)',
    badge: 'Clínica / APS',
    icon: '🩺',
    description: 'Demanda espontânea, agendada, Hiperdia, Saúde Mental e intercorrências agudas.',
    templateText: `#
# MUC:
# Tabagista:
# Alergias:

SUBJETIVO
Paciente vem em consulta em decorrência de 

OBJETIVO
BEG, LOC, MUC

AVALIAÇÃO
-

CONDUTA
- 
- Oriento sinais de alarme e na presença emergência. Ciente. 
- Orientações gerais
- Ciente, concordante e sem dúvidas`
  },

  prenatal: {
    id: 'prenatal',
    name: 'Consulta de Pré-Natal',
    badge: 'Obstetrícia APS',
    icon: '🤰',
    description: 'Acompanhamento de Pré-Natal de Risco Habitual ou Alto Risco na UBS.',
    templateText: `## CONSULTA DE PRÉ-NATAL ##

# G P V PC A
# IG POR ECO COM  SEM EM 
# TS: 
# TOXO: 
# SOROLOGIAS:
# VACINAS: 
# CONSULTA ODONTOLOGIA: 
# MUC: 
# Alergias: 

SUBJETIVO
Paciente vem em consulta de pré-natal. Paciente refere estar bem, sem queixas. Nega sangramento vaginal. Nega perda de líquido. Nega febre. Nega cefaleia e escotomas. Nega disúria, polaciúria e incontinência urinária. Fazendo uso corretamente de sulfato ferroso. Sem demais queixas

OBJETIVO
BEG, LOC, MUC
AU: CM
BCF: BPM
MF:
Edema em membros inferiores: 
Peso:
PA:  mmHg

AVALIAÇÃO
1. Gestação de risco habitual em curso ou alto risco

CONDUTA
- Parabenizo paciente sobre acompanhamento no PN
- Oriento sobre pródromos de TP
- Oriento sinais de alarme e, na presença, procurar atendimento médico imediatamente
- Orientações gerais
- Retorno em X dias com enfermagem ou médico
- Ciente, concordante e sem dúvidas`
  },

  puericultura: {
    id: 'puericultura',
    name: 'Puericultura (c/ Z-Score)',
    badge: 'Pediatria APS',
    icon: '👶',
    description: 'Acompanhamento infantil com histórico perinatal, aleitamento/fórmula, DNPM, triagem neonatal e Z-Scores OMS.',
    templateText: `## CONSULTA DE PUERICULTURA - X MESES ##

# 
# Aleitamento / Alimentação: 
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
Paciente vem acompanhado da mãe. Familiar relata que paciente está bem. Alimentação/Aleitamento: [descrever se SME, complementado, misto ou fórmula infantil — se fórmula, especificar qual marca/tipo, volume em ml, diluição/medidas e intervalo/frequência]. Em uso corretamente de sulfato ferroso e vitamina AD. Paciente dorme em. Paciente reside com. Nega queda da própria altura. Paciente com exposição à tela de. Paciente frequentando creche. Nega intercorrências ou necessidade de consultas médicas entre as consultas de puericultura. Familiar sem demais queixas

OBJETIVO
BEG, MUC, ativo, eupneico em ar ambiente, anictérico e acianótico
Peso:  (Z-Score Peso/Idade: )
Altura:  (Z-Score Estatura/Idade: )
PC:  (Z-Score PC/Idade: )
IMC:  (Z-Score IMC/Idade: )
Marcos do desenvolvimento: 

AVALIAÇÃO
1. Criança em desenvolvimento

CONDUTA
- Parabenizo familiar sobre cuidados de saúde com paciente
- Oriento sobre alimentação/aleitamento, prevenção de quedas, cuidados com paciente, prevenção de IVAS
- Orientações gerais
- Oriento retorno em X meses com enfermagem ou antes via acolhimento para demandas agudas
- Familiar ciente, concordante e sem dúvidas`
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
Visita domiciliar realizada acompanhada do(a) Enfermeiro(a) [nome] e ACS [nome], sendo a equipe recebida pelo(a) familiar/cuidador(a) [nome].
Paciente 

OBJETIVO
BEG, LOC, MUC

AVALIAÇÃO
-

CONDUTA
- 
- Orientações gerais e sinais de alarme repassados ao paciente e ao familiar/cuidador(a) presente
- Ciente, concordante e sem dúvidas

>> PENDÊNCIAS PARA REALIZAR NO POSTO (UBS) PÓS-VISITA:
- Receitas / Troca ou ajuste de medicação: 
- Solicitação de exames: 
- Encaminhamento (Regulação Estadual): 
- Outras pendências da equipe: `
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
- 

CONDUTA
- 
- Caso discutido e conduta alinhada com equipe de Enfermagem
- Oriento sinais de alarme e, na presença destes, procurar atendimento médico / emergência imediatamente
- Orientações gerais
- Ciente, concordante e sem dúvidas`
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
9. AVALIAÇÃO E CRITÉRIOS (CID-10 F64.0 / CID-11 HA60-HA61)
Hipótese Diagnóstica: ( ) Incongruência de Gênero (HA60/HA61) | ( ) Transexualismo (F64.0)
Critérios Clínicos Observados:
( ) Incongruência acentuada e persistente entre o gênero experienciado e o sexo atribuído.
( ) Desejo de viver e ser aceito como uma pessoa do gênero experienciado.
( ) Desejo de se livrar de características sexuais primárias/secundárias.
( ) Desejo de adquirir características sexuais primárias/secundárias do gênero experienciado.
( ) Duração dos sintomas superior a 6 meses e sofrimento clinicamente significativo.
10. CONDUTA
- 
- Oriento sobre efeitos esperados, tempo de início das transformações e potenciais riscos/efeitos adversos da THAG
- Oriento sinais de alarme (eventos tromboembólicos, alterações visuais, dor torácica, dispneia, cefaleia intensa) e na presença procurar emergência imediatamente. Ciente.
- Orientações gerais e acolhimento
- Ciente, concordante e sem dúvidas`
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
9. AVALIAÇÃO E CRITÉRIOS (CID-10 F64.0 / CID-11 HA60-HA61)
Hipótese Diagnóstica: ( ) Incongruência de Gênero (HA60/HA61) | ( ) Transexualismo (F64.0)
Critérios Clínicos Observados:
( ) Incongruência acentuada e persistente entre o gênero experienciado e o sexo atribuído.
( ) Desejo de viver e ser aceito como uma pessoa do gênero experienciado.
( ) Desejo de se livrar de características sexuais primárias/secundárias.
( ) Desejo de adquirir características sexuais primárias/secundárias do gênero experienciado.
( ) Duração dos sintomas superior a 6 meses e sofrimento clinicamente significativo.
10. CONDUTA
- 
- Oriento sobre manutenção/ajustes de THAG, adesão e monitoramento laboratorial
- Oriento sinais de alarme (eventos tromboembólicos, alterações visuais, dor torácica, dispneia, cefaleia intensa) e na presença procurar emergência imediatamente. Ciente.
- Orientações gerais e acolhimento
- Ciente, concordante e sem dúvidas`
  }
};

// ============================================================================
// GERADOR DE PROMPT CLÍNICO PARA EVOLUÇÃO SOAP + PDF DE EXAMES COMPLEMENTARES
// ============================================================================
window.buildMedicalEvolutionPrompt = function(templateObj, quickNotes, zScoreSummary, hasExamFiles) {
  const todayStr = new Date().toLocaleDateString('pt-BR');
  return `Você é um Médico de Família e Comunidade experiente na Atenção Primária à Saúde (UBS / SUS).
Sua tarefa tem DUAS ETAPAS OBRIGATÓRIAS:
ETAPA 1: Ouvir o áudio anexado do início ao fim com atenção absoluta e transcrever fielmente TUDO o que foi dito pelo médico e pelo paciente no campo "transcricao_literal_do_audio" do JSON. Não pule nenhuma palavra, sintoma, exame físico ou nome de remédio/posologia!
ETAPA 2: Com base na sua transcrição completa do áudio + PDFs de exames anexados (se houver) + anotações rápidas, preencher o modelo de evolução selecionado abaixo com rigor semiológico, coerência clínica e resguardo jurídico.

Data de referência de hoje: ${todayStr}.

=== REGRAS CRÍTICAS E OBRIGATÓRIAS (SIGA RIGOROSAMENTE) ===

1. EXTRAÇÃO COMPLETA DO ÁUDIO PARA O CABEÇALHO E SUBJETIVO:
   - Puxe do áudio TODAS as informações básicas faladas: comorbidades (#), medicações em uso contínuo (# MUC: com nome e dose se ditos), tabagismo, alergias, queixa principal, história da doença atual (HDA) completa, tempo de evolução, tratamentos já feitos e negativas pertinentes.
   - Converta os sintomas relatados para terminologia médica semiológica formal (ex.: "dor de cabeça" -> "cefaleia"; "dor na barriga/estômago" -> "epigastralgia / dor abdominal"; "falta de ar" -> "dispneia"; "ardência para urinar" -> "disúria"; "tosse com catarro" -> "tosse produtiva").
   - PROIBIDO CONTRADIÇÃO: Se nos modelos de Pré-Natal ou Puericultura houver queixa no áudio, REMOVA as frases padrão "sem queixas" ou as negativas daquele sintoma.

2. REGRA ESTRITA DO EXAME FÍSICO (OBJETIVO) — NÃO INVENTE SISTEMAS NÃO AVALIADOS:
   - NUNCA cole exame físico padrão de aparelhos que o médico NÃO examinou ou NÃO citou!
   - Mantenha apenas "BEG, LOC, MUC" (se compatível) e inclua SOMENTE os sinais vitais e os aparelhos/sistemas que foram EFETIVAMENTE citados no áudio ou nas notas rápidas!
   - Converta os achados do exame físico que o médico falou para linguagem semiológica técnica:
     * Se o médico falou que auscultou pulmão normal -> adicione "AP: MVUD, SRA" (ou descreva a alteração técnica se houver ruídos adventícios).
     * Se o médico falou que auscultou coração normal -> adicione "AC: BNF, 2T, RR, SS" (ou descreva a alteração).
     * Se o médico falou que examinou abdome -> adicione "ABD: ..." com a descrição técnica do que ele falou.
     * Se o médico falou de otoscopia, oroscopia, extremidades, pele, neurológico, osteomuscular -> descreva tecnicamente apenas o que foi examinado!
     * Se o médico NÃO falou nada sobre aparelho respiratório, cardiovascular ou abdome, NÃO coloque AP, AC ou ABD no Objetivo!

3. REGRA ESTRITA DE EXAMES COMPLEMENTARES — SÓ INCLUA SE HOUVER EXAMES:
   - ${hasExamFiles ? 'Há PDFs/imagens de exames anexados! Crie o bloco "EXAMES COMPLEMENTARES" logo após o OBJETIVO e antes da AVALIAÇÃO e transcreva todos os exames.' : 'Se NÃO houver PDF de exame anexado E o médico NÃO tiver falado nenhum resultado de exame complementar no áudio/notas, NÃO CRIE e NÃO ESCREVA o título "EXAMES COMPLEMENTARES" na evolução!'}
   - Quando houver exames complementares (por PDF anexado ou ditados no áudio/notas), coloque o bloco "EXAMES COMPLEMENTARES" entre OBJETIVO e AVALIAÇÃO seguindo este padrão exato:
     * LABORATORIAIS (em linha única separada por " | "):
       - LABS DD/MM/AAAA: Hb ... | Ht ... | Leuco ... | Plaq ... | GJ ... | HbA1c ... | Creat ... | Ureia ... | Sódio ... | K ... | CT ... | HDL ... | LDL ... | TAG ... | TSH ... | T4L ... | EQU: ...
     * EXAMES DE IMAGEM (em texto corrido conciso):
       - NOME DO EXAME DD/MM/AAAA: Descrição em texto corrido dos achados e conclusão.

4. REGRA ESTRITA DA CONDUTA — DETALHE CADA MEDICAÇÃO (PROIBIDO FRASE GENÉRICA!):
   - É TERMINANTEMENTE PROIBIDO escrever frases genéricas como "Prescrição medicamentosa conforme avaliação médica" ou "Ajuste terapêutico".
   - Você DEVE escrever explicitamente o nome de cada medicação, concentração, dose/posologia e ação tomada que o médico falou no áudio:
     * Se prescreveu medicação nova: "- Prescrevo [Nome do remédio + mg + posologia + dias, conforme falado]"
     * Se alterou ou ajustou dose: "- Altero / Ajusto dose de [Nome do remédio] de [...] para [...]"
     * Se suspendeu medicação: "- Suspendo o uso de [Nome do remédio] devido a [...]"
     * Se renovou/manteve receita: "- Renovo / Mantenho prescrição de [Nome dos remédios]"
     * Se solicitou exames ou encaminhou: liste exatamente quais exames foram solicitados e para qual especialidade encaminhou.
     * Se mencionou plano para a próxima consulta: "- Plano para próxima consulta: [...]"
   - Ao final da CONDUTA, mantenha sempre as frases de orientação de sinais de alarme e concordância do modelo.

5. REGRAS ESPECÍFICAS DE PUERICULTURA, PRÉ-NATAL E VISITA DOMICILIAR (EXTRAÇÃO AUTOMÁTICA DO ÁUDIO!):
   - ATENÇÃO MÁXIMA: O médico pode optar por NÃO digitar nada nos campos da tela e apenas FALAR os dados no áudio! Portanto, se os campos da tela estiverem vazios, você DEVE extrair diretamente da fala do médico no áudio:
     * Na PUERICULTURA: extraia do áudio a idade da criança, Peso, Altura/Comprimento, Perímetro Cefálico (PC), calcule o IMC e estime/classifique os Z-Scores (OMS: Peso/Idade, Estatura/Idade, PC/Idade e IMC/Idade) preenchendo as linhas do OBJETIVO! Extraia também do áudio os Marcos do Desenvolvimento, Ortolani, Barlow, Otoscopia/Oroscopia (se falados) e todos os detalhes do Aleitamento/Alimentação (se SME, complementado, misto ou fórmula infantil — especificando qual fórmula, quantidade em ml, medidas e horários).
     * No PRÉ-NATAL: extraia diretamente do áudio todos os dados do cabeçalho (# G P V PC A, # IG, # TS, # TOXO, # SOROLOGIAS, # VACINAS) e todos os dados do OBJETIVO falados pelo médico (AU em cm, BCF em bpm, MF presentes/ausentes, Edema em MMII, Peso em kg e PA em mmHg), além de qualquer exame físico adicional falado!
     * Na VISITA DOMICILIAR: preencha a data no título, nomes da equipe (Enfermeiro/a e ACS), nome do familiar presente e o checklist final ">> PENDÊNCIAS PARA REALIZAR NO POSTO (UBS) PÓS-VISITA:".

=== DADOS EXTRAS / NOTAS RÁPIDAS DO MÉDICO ===
${quickNotes ? quickNotes : 'Nenhuma nota rápida digitada.'}
${zScoreSummary ? '\n=== DADOS OBJETIVOS / ANTROPOMETRIA / Z-SCORE ===\n' + zScoreSummary : ''}

=== MODELO DE REFERÊNCIA A SER SEGUIDO ===
${templateObj.templateText}

=== FORMATO DE RESPOSTA (JSON OBRIGATÓRIO) ===
Responda em JSON válido contendo exatamente estas chaves (preencha "transcricao_literal_do_audio" PRIMEIRO!):
{
  "transcricao_literal_do_audio": "Transcrição completa e fiel de tudo o que foi falado no áudio (para garantir que nenhuma informação, queixa, exame físico ou medicação seja perdida)",
  "evolucao_completa": "Texto completo da evolução seguindo fielmente o modelo acima com quebras de linha \\n",
  "resumo_subjetivo": "Apenas o bloco SUBJETIVO extraído",
  "resumo_objetivo": "Apenas o bloco OBJETIVO extraído",
  "resumo_exames": "Apenas o bloco EXAMES COMPLEMENTARES (ou string vazia se não houver exames)",
  "resumo_avaliacao": "Apenas o bloco AVALIAÇÃO extraído (com sugestões CID-10 / CIAP-2)",
  "resumo_conduta": "Apenas o bloco CONDUTA detalhado extraído",
  "especialidade_sugerida_encaminhamento": "Se durante a consulta foi citado encaminhamento, informe a especialidade, caso contrário deixe string vazia",
  "alertas_auditoria": ["Lista curta apenas se faltou algum dado crítico obrigatório"]
}`;
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
Sua missão é redigir um DOCUMENTO DE ENCAMINHAMENTO MÉDICO (Referência para Atenção Secundária/Terciária) altamente técnico, completo, persuasivo e À PROVA DE DEVOLUÇÃO pela regulação estadual, com base na evolução da consulta/visita domiciliar e nos exames complementares abaixo.

=== CONTEXTO DO ATENDIMENTO ===
- Tipo de Atendimento na UBS: ${templateName} (${templateId})
- Especialidade / Serviço de Destino Solicitado: ${especialidade || 'A definir conforme quadro clínico'}
- Classificação de Prioridade Sugerida: ${prioridade || 'Avaliar conforme critérios clínicos'}
- Exames Prévios / Tratamentos Já Tentados / Dados Extras colados do PEC: ${dadosExtrasRegulacao || 'Vide evolução clínica'}
- Notas Rápidas da Consulta: ${quickNotes || 'Vide evolução clínica'}

=== EVOLUÇÃO CLÍNICA E EXAMES DA CONSULTA ===
${evolucaoTexto}

=== ESTRUTURA OBRIGATÓRIA DO ENCAMINHAMENTO (TEXTO PRONTO PARA COPIAR E COLAR NO SISTEMA DO ESTADO) ===
Gere um texto estruturado, limpo e direto seguindo exatamente estas seções:

ENCAMINHAMENTO MÉDICO - REGULAÇÃO ESTADUAL (APS / SUS)
ESPECIALIDADE SOLICITADA: [Nome da Especialidade]
PRIORIDADE SUGERIDA: [Normal / Prioritário / Urgência Eletiva - Código Vermelho/Amarelo/Azul]
HIPÓTESE DIAGNÓSTICA PRINCIPAL E CID-10 / CIAP-2: [Diagnóstico + Código CID-10]

1. QUADRO CLÍNICO E HISTÓRIA DA DOENÇA ATUAL (COM TEMPO DE EVOLUÇÃO):
[Resumo técnico, cronológico e rico em semiologia do quadro que motiva o encaminhamento, sintomas associados e impacto funcional]

2. ANTECEDENTES, COMORBIDADES E CONDIÇÕES ESPECÍFICAS:
[Comorbidades, antecedentes pessoais/obstétricos/perinatais/identidade de gênero/condição de acamado conforme o modelo da consulta]

3. EXAME FÍSICO DIRECIONADO E SINAIS VITAIS / ANTROPOMETRIA:
[Sinais vitais, antropometria/Z-score se pediatria, dados obstétricos se gestante, e exame físico técnico focado na especialidade]

4. EXAMES COMPLEMENTARES JÁ REALIZADOS (COM DATAS E RESULTADOS):
[Inclua todos os exames laboratoriais e de imagem presentes na evolução (com datas e valores) ou colados pelo médico. Se algum exame obrigatório de protocolo não tiver data/valor informado, deixar "[Inserir data/resultado: ...]" bem visível]

5. MANEJO E TRATAMENTOS JÁ REALIZADOS NA ATENÇÃO PRIMÁRIA (APS) E MUC:
[Medicações em uso contínuo com doses, medidas farmacológicas e não-farmacológicas já instituídas na UBS e resposta clínica]

6. JUSTIFICATIVA CLÍNICA PARA ATENÇÃO ESPECIALIZADA E SINAIS DE ALERTA:
[Argumentação técnica clara demonstrando por que o caso esgotou os recursos da APS ou preenche critérios de protocolo de encaminhamento estadual, indicando presença ou ausência de sinais de gravidade]

Responda APENAS com o texto pronto do encaminhamento, sem comentários extras antes ou depois.`;
};
