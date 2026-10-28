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
AP: MVUD, SRA
AC: BNF, 2T, RR, SS
Extremidades aquecidas e bem perfundidas. TEC < 2 seg
ABD: Globoso, indolor a palpação superficial e profunda

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
ABD: Globoso, indolor a palpação superficial e profunda
AP: MVUD, SRA
AC: BNF, 2T, RR, SS

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
    description: 'Acompanhamento infantil com histórico perinatal, DNPM, triagem neonatal e Z-Scores OMS.',
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
Paciente vem acompanhado da mãe. Familiar relata que paciente está bem. Em uso corretamente de sulfato ferroso e vitamina AD. Paciente dorme em. Paciente reside com. Nega queda da própria altura. Paciente com exposição à tela de. Paciente frequentando creche. Nega intercorrências ou necessidade de consultas médicas entre as consultas de puericultura. Familiar sem demais queixas

OBJETIVO
BEG, MUC, ativo, eupneico em ar ambiente, anictérico e acianótico
Peso:  (Z-Score Peso/Idade: )
Altura:  (Z-Score Estatura/Idade: )
PC:  (Z-Score PC/Idade: )
IMC:  (Z-Score IMC/Idade: )
Marcos do desenvolvimento: 
AP: MVUD, SRA. Sem esforço ventilatório
AC: BNF, 2T, RR, SS
ABD: Globoso, sem fáscies de dor a palpação superficial e profunda. Não palpo visceromegalias
Extremidades aquecidas e bem perfundidas. TEC < 2 seg
Sem sinais de desidratação
Fontanelas normotensas
Ortolani:
Barlow:
Oroscopia: sp
Otoscopia: MTD e MTE translúcidas e sem abaulamentos. Não visualizo secreção em canal auditivo
Não realizado teste do olho vermelho por falta de oftalmoscópio na UBS

AVALIAÇÃO
1. Criança em desenvolvimento

CONDUTA
- Parabenizo familiar sobre cuidados de saúde com paciente
- Oriento sobre prevenção de quedas, cuidados com paciente, prevenção de IVAS
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
AP: MVUD, SRA
AC: BNF, 2T, RR, SS
Extremidades aquecidas e bem perfundidas. TEC < 2 seg
ABD: Globoso, indolor a palpação superficial e profunda

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
    description: 'Ditado rápido do caso clínico discutido com a Enfermagem, exame físico direcionado e conduta.',
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
Aparelho Cardiovascular: Bulhas normofonéticas, em 2 tempos, ritmo regular, sem sopros.
Aparelho Respiratório: Murmúrio vesicular universalmente audível, sem ruídos adventícios.
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
Aparelho Cardiovascular: Bulhas normofonéticas, em 2 tempos, ritmo regular, sem sopros.
Aparelho Respiratório: Murmúrio vesicular universalmente audível, sem ruídos adventícios.
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
// GERADOR DE PROMPT CLÍNICO PARA EVOLUÇÃO SOAP / MODELOS UBS
// ============================================================================
window.buildMedicalEvolutionPrompt = function(templateObj, quickNotes, zScoreSummary) {
  const todayStr = new Date().toLocaleDateString('pt-BR');
  return `Você é um Médico de Família e Comunidade experiente e Perito em Auditoria/Documentação Médica na Atenção Primária à Saúde (UBS / SUS).
Sua tarefa é ouvir atentamente o áudio da consulta médica, visita domiciliar ou ditado clínico (que pode ter sido gravado durante o atendimento ou ditado posteriormente pelo médico no WhatsApp/celular) e as anotações rápidas fornecidas, e preencher EXATAMENTE o modelo de evolução selecionado pelo médico, com rigor semiológico, coerência clínica absoluta e resguardo jurídico.

Data de referência de hoje (se não for citada outra data no áudio): ${todayStr}.

=== REGRAS DE OURO (OBRIGATÓRIAS) ===

1. FIDELIDADE ESTRITA AO MODELO:
   - Mantenha EXATAMENTE a estrutura, cabeçalhos (#), seções e frases de fechamento de segurança jurídica do modelo abaixo.
   - Nos modelos que possuem parênteses de seleção como "( ) Opção", marque com "(X)" as opções confirmadas na consulta e deixe "( )" nas demais.
   - Na VISITA DOMICILIAR (VD):
     * Substitua "DD/MM/AAAA" no título pela data falada no áudio ou pela data de hoje (${todayStr}).
     * Preencha o nome do(a) Enfermeiro(a), do(a) ACS (Agente Comunitário de Saúde) e o nome + vínculo do Familiar/Cuidador(a) que estava na casa recebendo a equipe (se não tiver sido falado, deixe "[preencher nome]" visível).
     * Preencha com muita atenção o bloco final ">> PENDÊNCIAS PARA REALIZAR NO POSTO (UBS) PÓS-VISITA:", destacando receitas a fazer/renovar, trocas de medicação, exames a solicitar no sistema, encaminhamentos estaduais e demandas para a equipe.

2. SUBJETIVO COM SEMIOLOGIA TÉCNICA, COERÊNCIA E RESGUARDO JURÍDICO:
   - Converta TODA a linguagem leiga do paciente/familiar para terminologia médica semiológica formal (ex.: "dor na boca do estômago" -> "epigastralgia"; "ardência para urinar" -> "disúria"; "urinar toda hora pouquinho" -> "polaciúria"; "falta de ar deitado" -> "ortopneia"; "dor de garganta ao engolir" -> "odinofagia"; "tontura que gira" -> "vertigem"; "mancha escura na vista" -> "escotomas"; "ferida nas costas/quadril por ficar deitado" -> "lesão por pressão em região sacral/trocantérica").
   - PACIENTE POLIQUEIXOSO: Se o paciente relatar múltiplos problemas fora de ordem, reorganize de forma lógica, cronológica e coesa (Queixa Principal e HDA detalhada primeiro, seguida das demandas associadas organizadas com clareza, início, duração, intensidade, fatores de melhora/piora e tratamentos já tentados).
   - RESGUARDO JURÍDICO E NEGATIVAS PERTINENTES: Documente explicitamente todos os sinais de alarme (red flags) perguntados ou negados na consulta.
   - PROIBIDO CONTRADIÇÃO INTERNA: Nos modelos de Pré-Natal e Puericultura que trazem frases padrão como "Paciente refere estar bem, sem queixas. Nega disúria...", SE o paciente relatou alguma queixa (ex: teve disúria ou cefaleia), você DEVE REMOVER a negativa correspondente da frase padrão e descrever a queixa tecnicamente, mantendo apenas as negativas que realmente foram negadas ou permanecem normais. Jamais deixe escrito "sem queixas" junto com uma queixa!

3. OBJETIVO COM TRADUÇÃO TÉCNICA E PRESERVAÇÃO DA MÁSCARA:
   - Tudo o que o médico falar sobre o exame físico ou exames complementares deve ser redigido em linguagem semiológica técnica formal (ex.: se o médico falar "garganta vermelha com placas de pus", escreva "Oroscopia: hiperemia de orofaringe e tonsilas palatinas hipertrofiadas com presença de exsudato purulento bilateral"; se falar "barriga dolorida na fossa direita com Blumberg", escreva "ABD: doloroso à palpação superficial e profunda em fossa ilíaca direita, sinal de Blumberg positivo").
   - Se um aparelho do exame físico (AP, AC, ABD, Extremidades, Otoscopia, etc.) NÃO teve alteração citada no áudio nem nas notas, MANTENHA o texto normal padrão da máscara (ex: "AP: MVUD, SRA", "AC: BNF, 2T, RR, SS"). Exceto na "Interconsulta com a Enfermagem": na Interconsulta, descreva no Objetivo apenas os sinais vitais, exames complementares ou sistemas efetivamente examinados/relatados pelo médico.
   - Se houver exames laboratoriais ou de imagem ditados no áudio ou colados nas notas rápidas, inclua-os de forma organizada no OBJETIVO (ou nos campos próprios do modelo).

4. ZERO ALUCINAÇÃO (NUNCA INVENTE DADOS NUMÉRICOS):
   - Se dados específicos do cabeçalho ou exame físico (como PA, Peso, AU, BCF, IG, Tipo Sanguíneo, APGAR, Capurro, Sorologias) NÃO forem falados no áudio nem informados nas notas rápidas, deixe o campo em branco após os dois pontos (ex: "PA:  mmHg", "# TS: ") para o médico preencher manualmente. NUNCA invente valores de PA, BCF, peso ou resultados de exames!

5. AVALIAÇÃO E CONDUTA / PLANO FUTURO:
   - Em AVALIAÇÃO: Liste as hipóteses diagnósticas ou condições avaliadas em linguagem técnica, sugerindo entre parênteses o código CID-10 e CIAP-2 correspondente quando aplicável (ex: "1. Hipertensão Arterial Sistêmica essencial (CID-10: I10 / CIAP-2: K86)").
   - Em CONDUTA: Liste claramente:
     a) Prescrições médicas realizadas/renovadas (com fármaco, concentração, posologia e duração se ditados);
     b) Exames complementares solicitados;
     c) Encaminhamentos realizados;
     d) PLANO PARA A PRÓXIMA CONSULTA / SEGUIMENTO (se o médico mencionar algo a ser feito/cobrado no próximo atendimento, destaque um tópico "- Plano para próxima consulta: ...");
     e) Mantenha SEMPRE no final da CONDUTA as frases padrão de orientações de sinais de alarme e concordância do modelo original para resguardo médico-legal.

6. ATENDIMENTO LGBTQIAP+ / POPULAÇÃO TRANS:
   - Se o modelo for LGBTQIAP+, respeite rigorosamente o Nome Social e os Pronomes da pessoa atendida em toda a concordância nominal e verbal do texto.

=== DADOS EXTRAS / NOTAS RÁPIDAS DO MÉDICO ===
${quickNotes ? quickNotes : 'Nenhuma nota rápida digitada.'}
${zScoreSummary ? '\n=== CÁLCULO ANTROPOMÉTRICO / Z-SCORE (OMS) ===\n' + zScoreSummary : ''}

=== MODELO EXATO A SER PREENCHIDO ===
${templateObj.templateText}

=== FORMATO DE RESPOSTA ===
Responda em JSON válido contendo exatamente estas chaves:
{
  "evolucao_completa": "Texto completo da evolução seguindo fielmente o modelo acima com quebras de linha \\n",
  "resumo_subjetivo": "Apenas o bloco SUBJETIVO extraído",
  "resumo_objetivo": "Apenas o bloco OBJETIVO extraído",
  "resumo_avaliacao": "Apenas o bloco AVALIAÇÃO extraído (com sugestões CID-10 / CIAP-2)",
  "resumo_conduta": "Apenas o bloco CONDUTA (e Pendências/Plano futuro) extraído",
  "especialidade_sugerida_encaminhamento": "Se durante a consulta/VD foi citado encaminhamento, informe a especialidade (ex: Cardiologia, PNAR, Neuropediatria, Ambulatório Trans, Fisioterapia Domiciliar, etc.), caso contrário deixe string vazia",
  "alertas_auditoria": ["Lista curta de campos importantes do modelo que não foram falados no áudio para o médico conferir antes de salvar no PEC, ex: 'PA não informada no áudio', 'Nome da ACS não mencionado'"]
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
Sua missão é redigir um DOCUMENTO DE ENCAMINHAMENTO MÉDICO (Referência para Atenção Secundária/Terciária) altamente técnico, completo, persuasivo e À PROVA DE DEVOLUÇÃO pela regulação estadual, com base na evolução da consulta/visita domiciliar abaixo.

=== CONTEXTO DO ATENDIMENTO ===
- Tipo de Atendimento na UBS: ${templateName} (${templateId})
- Especialidade / Serviço de Destino Solicitado: ${especialidade || 'A definir conforme quadro clínico'}
- Classificação de Prioridade Sugerida: ${prioridade || 'Avaliar conforme critérios clínicos'}
- Exames Prévios / Tratamentos Já Tentados / Dados Extras colados do PEC: ${dadosExtrasRegulacao || 'Vide evolução clínica'}
- Notas Rápidas da Consulta: ${quickNotes || 'Vide evolução clínica'}

=== EVOLUÇÃO CLÍNICA DA CONSULTA / VISITA DOMICILIAR ===
${evolucaoTexto}

=== DIRETRIZES ESPECÍFICAS POR PERFIL DE PACIENTE ===
- Se for CONSULTA GERAL / VISITA DOMICILIAR / INTERCONSULTA: Destaque idade (se conhecida), grau de funcionalidade/mobilidade (especialmente se acamado/restrito ao domicílio em Visita Domiciliar), comorbidades (#), Medicações em Uso Contínuo (MUC) com doses, história clínica detalhada com tempo de evolução, exame físico direcionado, exames laboratoriais/imagem prévios com datas e tratamentos já realizados na APS (incluindo falha terapêutica ou refratariedade).
- Se for PRÉ-NATAL (ex: encaminhamento ao Pré-Natal de Alto Risco - PNAR, Obstetrícia, Endocrinologia): Destaque obrigatoriamente Paridade (G/P/C/A), Idade Gestacional (IG por DUM/ECO), Tipo Sanguíneo, Sorologias, PA, Altura Uterina (AU), BCF, medicações em uso na gestação e o critério formal de Alto Risco que justifica o encaminhamento.
- Se for PUERICULTURA / PEDIATRIA: Destaque idade da criança, antecedentes perinatais (IG ao nascer/Capurro, Peso ao nascer, APGAR, intercorrências neonatais), Triagem Neonatal (orelhinha, olhinho, coraçãozinho, pezinho), antropometria atual com Z-Scores (OMS), marcos do Desenvolvimento Neuropsicomotor (DNPM) e achados do exame físico pediátrico.
- Se for ATENDIMENTO LGBTQIAP+ / POPULAÇÃO TRANS: Respeite Nome Social e Pronomes, destaque Identidade de Gênero, tempo de identificação, status e tempo de Terapia Hormonal de Afirmação de Gênero (THAG - fármaco, dose, via), critérios diagnósticos preenchidos (CID-10 F64.0 / CID-11 HA60/HA61), assinatura do TCLE, rastreamentos/sorologias e finalidade específica do encaminhamento (ex: Ambulatório Trans Estadual, Cirurgia de Afirmação de Gênero, Mastectomia masculinizadora, Endocrinologia, Ginecologia, Fonoaudiologia, etc.).

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
[Listar exames informados. Se algum exame obrigatório de protocolo não tiver data/valor informado, deixar "[Inserir data/resultado: ...]" bem visível para o médico preencher antes de enviar]

5. MANEJO E TRATAMENTOS JÁ REALIZADOS NA ATENÇÃO PRIMÁRIA (APS) E MUC:
[Medicações em uso contínuo com doses, medidas farmacológicas e não-farmacológicas já instituídas na UBS e resposta clínica]

6. JUSTIFICATIVA CLÍNICA PARA ATENÇÃO ESPECIALIZADA E SINAIS DE ALERTA:
[Argumentação técnica clara demonstrando por que o caso esgotou os recursos da APS ou preenche critérios de protocolo de encaminhamento estadual, indicando presença ou ausência de sinais de gravidade]

Responda APENAS com o texto pronto do encaminhamento, sem comentários extras antes ou depois.`;
};
