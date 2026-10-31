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
// GERADOR DE PROMPT CLÍNICO PARA EVOLUÇÃO SOAP + PDF DE EXAMES COMPLEMENTARES
// ============================================================================
window.buildMedicalEvolutionPrompt = function(templateObj, quickNotes, zScoreSummary, hasExamFiles, previousEvolutionContext, previousConsultationText, preTranscribedExamsText) {
  const todayStr = new Date().toLocaleDateString('pt-BR');
  return `Você é um Médico de Família e Comunidade experiente na Atenção Primária à Saúde (UBS / SUS).
Sua tarefa tem DUAS ETAPAS OBRIGATÓRIAS E SEQUENCIAIS:
ETAPA 1: Ouvir o áudio anexado e transcrever literalmente APENAS o que foi dito de verdade no campo "transcricao_literal_do_audio" do JSON (identificando "[MÉDICO]:" e "[PACIENTE]:").
ETAPA 2: Preencher "evolucao_completa" usando EXCLUSIVAMENTE os fatos reais presentes na sua "transcricao_literal_do_audio", nas notas rápidas e nos exames anexados.

Data de referência de hoje: ${todayStr}.

=== REGRA 0 (LEI SUPREMA ANTI-ALUCINAÇÃO — PROIBIÇÃO ABSOLUTA DE INVENTAR CONSULTA FALSA!) ===
- É TERMINANTEMENTE PROIBIDO inventar nomes de pacientes, nomes de enfermeiros/ACS, nomes de familiares, queixas, história clínica, medicações (MUC), doses, sinais vitais ou exames que NÃO tenham sido efetivamente falados no áudio ou escritos nas notas!
- JAMAIS copie palavras, nomes ou remédios citados nas regras deste prompt como se fossem do paciente!
- Se um campo do modelo (# MUC:, # Tabagista:, # Alergias:, Enfermeiro(a):, ACS:, Familiar:, etc.) NÃO foi falado no áudio, deixe-o VAZIO em branco (ex.: "# MUC: " sem escrever nada depois e sem escrever "Não informado").
- TRAVA OBRIGATÓRIA PARA ÁUDIO DE TESTE / NADA A VER / SILÊNCIO:
  Se o áudio anexado NÃO for uma consulta médica real (por exemplo: se a pessoa falou algo aleatório/nada a ver com consulta, fez apenas um teste rápido, ou se houver apenas ruído/silêncio) e não houver notas clínicas nem PDF de exame anexado:
  * NÃO GERE UMA CONSULTA FALSA!
  * Escreva no campo "evolucao_completa" EXATAMENTE:
    "⚠️ Áudio sem conteúdo de consulta médica identificado.\nTranscrição captada no microfone: \"[coloque aqui apenas o que foi falado literalmente no áudio]\""
  * E deixe "codigos_cid_ciap": [].

=== REGRAS CRÍTICAS E OBRIGATÓRIAS (QUANDO HOUVER CONSULTA REAL NO ÁUDIO) ===

1. RESPEITO ABSOLUTO À MÁSCARA / MODELO DE EVOLUÇÃO SELECIONADO, REGRA ESTRITA DO "# MUC:", ACOMPANHANTE E PROIBIÇÃO DE CONTRADIÇÕES:
   - Você DEVE manter a estrutura IDÊNTICA ao "MODELO DE REFERÊNCIA A SER SEGUIDO" abaixo! JAMAIS coloque a transcrição bruta do áudio dentro de "evolucao_completa" — o campo "evolucao_completa" DEVE SEMPRE conter o prontuário médico estruturado com # Cabeçalho, SUBJETIVO, OBJETIVO, AVALIAÇÃO e CONDUTA!
   - REGRA ESTRITA DA "# MUC:" (MEDICAÇÕES EM USO NO MOMENTO DA CONSULTA — PROIBIDO INCLUIR MEDICAÇÕES PRESCRITAS HOJE!):
     * O campo "# MUC:" (ou "Medicações em uso:") deve listar EXCLUSIVAMENTE as medicações que o paciente JÁ ESTAVA EM USO antes/no momento em que entrou na consulta médica de hoje (se faladas no áudio ou presentes na evolução prévia)! Se nenhuma MUC foi falada, deixe "# MUC:" em branco!
     * É TERMINANTEMENTE PROIBIDO colocar na "# MUC:" medicações que estão sendo prescritas ou iniciadas no atendimento de hoje! Toda medicação prescrita ou iniciada no dia de hoje deve entrar APENAS no bloco "CONDUTA" (nunca na "# MUC:" da consulta de hoje).
   - PUERICULTURA (ALIMENTAÇÃO APENAS NO SUBJETIVO):
     * Na Puericultura, NUNCA coloque "# Alimentação:" ou "# Aleitamento:" no cabeçalho "#" inicial! O tópico "Alimentação:" deve ficar exclusivamente dentro do bloco "SUBJETIVO".
   - REGISTRO DO FAMILIAR / ACOMPANHANTE E GRAU DE PARENTESCO NO SUBJETIVO:
     * SOMENTE SE um acompanhante/familiar for mencionado no áudio: inclua no início do SUBJETIVO o grau de parentesco e o nome real falado no áudio (ex.: "Paciente vem acompanhado da mãe [nome falado]"). Se ninguém foi citado como acompanhante no áudio, NÃO invente acompanhante!
   - PROIBIDO CONTRADIÇÃO NO PRÉ-NATAL, PUERICULTURA, VISITA DOMICILIAR E DEMAIS MODELOS:
     * Se a gestante (no Pré-Natal), a mãe/criança (na Puericultura) ou o paciente (na Visita Domiciliar / Consulta Geral) relatar QUALQUER queixa, dor, sintoma, intercorrência ou sinal de alarme no áudio, você DEVE REMOVER IMEDIATAMENTE as frases padrão "Paciente refere estar bem, sem queixas", "Familiar relata que paciente está bem", "Nega intercorrências" e "Sem demais queixas"!
     * Se a gestante/paciente referir algum sintoma que está listado como negativa padrão no modelo (ex.: se ela tiver cefaleia, escotomas, disúria, sangramento vaginal, perda de líquido ou febre), APAGUE a frase "Nega [aquele sintoma]" e descreva detalhadamente o sintoma que ela está sentindo! Mantenha como "Nega ..." apenas os sintomas que ela realmente negou ou não apresentou.
   - Mantenha no final da CONDUTA as frases finais padrão do modelo SEM traço no início (ex.: "Orientações gerais\nCiente, concordante e sem dúvidas"). Se o médico orientou sinais de alarme específicos no áudio, descreva esses sinais na linha "Oriento sinais de alarme (...) e na presença emergência. Ciente." e NÃO repita a frase genérica "Oriento sinais de alarme e na presença emergência. Ciente."!

2. CONTROLE DE HGT (GLICEMIA CAPILAR) E CONTROLE DE PA (AFERIÇÕES DE PRESSÃO ARTERIAL) + PARECER FINAL NO SUBJETIVO:
   - ATENÇÃO MÁXIMA: Sempre que durante a consulta forem falados ou lidos valores de aferições de Glicemia Capilar (HGT / Dextro) ou valores de Pressão Arterial (Controle de PA / MRPA / mapa de PA trazido pelo paciente) — MESMO QUE QUEM ESTEJA LENDO OS VALORES EM VOZ ALTA SEJA O MÉDICO — você DEVE OBRIGATORIAMENTE registrar esses valores dentro do bloco "SUBJETIVO" com linhas dedicadas:
     * "Controle de HGT: [listar TODOS os valores de glicemia falados e a qual período/horário se referem — ex.: em jejum, pós-café, pré-almoço, pós-almoço, à noite, madrugada — seguido do parecer final/conclusão verbalizado pelo médico sobre o controle glicêmico]."
     * "Controle de PA: [listar TODOS os valores de PA registrados/trazidos pelo paciente e horários/períodos se citados — seguido do parecer final/conclusão verbalizado pelo médico sobre o controle pressórico]."
   - Diferencie: a lista de controles trazidos pelo paciente entra no SUBJETIVO ("Controle de HGT:" e "Controle de PA:") com o parecer do médico, enquanto a PA/HGT aferida na hora do exame físico de hoje entra no OBJETIVO.

3. REGRA ESTRITA DO EXAME FÍSICO (OBJETIVO) — NÃO INVENTE DADOS NÃO FALADOS:
   - NUNCA invente sinais físicos que o médico não falou (ex.: se o médico só palpou e perguntou se doía, escreva apenas "Dor à palpação em panturrilha direita", NÃO invente "sinais flogísticos" se o médico não falou isso!).
   - Mantenha apenas "BEG, LOC, MUC" e inclua SOMENTE a PA/sinais vitais aferidos no momento do exame físico e os achados do exame físico que foram EFETIVAMENTE ditos no áudio ou nas notas rápidas!
   - Se o médico NÃO falou nada sobre aparelho respiratório, cardiovascular ou abdome, NÃO coloque AP, AC ou ABD no Objetivo!

4. REGRA ESTRITA DE EXAMES COMPLEMENTARES (ZERO OMISSÃO E PROIBIDO "N/R"):
   - ${hasExamFiles || preTranscribedExamsText ? 'Há exames complementares anexados/transcritos! Crie o bloco "EXAMES COMPLEMENTARES" logo após o OBJETIVO e antes da AVALIAÇÃO e inclua TODOS os exames.' : 'Se NÃO houver PDF de exame anexado E o médico NÃO tiver falado nenhum resultado de exame complementar laboratorial/imagem no áudio/notas, NÃO CRIE e NÃO ESCREVA o título "EXAMES COMPLEMENTARES" na evolução!'}
   - Quando houver exames complementares (por PDF anexado ou ditados no áudio/notas), siga RIGOROSAMENTE estas 3 regras:
     a) TRANSCREVA 100% DE TODOS OS EXAMES REALIZADOS PRESENTES NO LAUDO/PDF: Varra todas as páginas do documento e inclua TODOS os exames que tiverem resultado (hemograma completo, bioquímica, função renal, eletrólitos, hepatograma/enzimas hepáticas, perfil lipídico, tireoide, hormônios, vitaminas, cinética de ferro, marcadores inflamatórios, sorologias, urina/EQU, urocultura, parasitológico, fezes, etc.). NUNCA omita exames extras que foram realizados no laudo!
     b) PROIBIDO ESCREVER "N/R", "Não realizado" OU EXAMES QUE NÃO CONSTAM NO LAUDO: Se um exame (por exemplo, T4L, Ferritina, etc.) NÃO estiver presente no PDF, NÃO escreva "T4L N/R" — simplesmente NÃO inclua esse exame na linha! Só escreva exames que efetivamente possuem resultado no documento.
     c) FORMATO EXATO:
        * LABORATORIAIS (todos os exames da mesma data na mesma linha, separados por " | ", usando abreviações médicas limpas + valor):
          Exemplo: - LABS 17/08/2026: Hb 15,3 | Ht 43,7 | Leuco 6.990 | Plaq 303.000 | GJ 90,9 | HbA1c 4,4% | Creat 0,97 | Ureia 22,2 | Sódio 140 | K 4,6 | Ác. Úrico 5,4 | TGO 18 | TGP 18 | GGT 35,1 | FA 68 | BT 0,7 | CT 195,1 | HDL 33,8 | LDL 143,6 | TAG 74 | TSH 0,81 | Vit B12 390 | Vit D 31,2 | Testo Total 842 | Testo Livre 23,07 | EQU: pH 6,0, Densidade 1.020, Leucócitos 25/uL, Flora Bacteriana Moderada
        * EXAMES DE IMAGEM E MÉTODOS GRÁFICOS (em texto corrido conciso, sem tópicos soltos):
          Exemplo: - ECOCARDIO TT 20/11/2025: FE 52,2%. Ventrículo esquerdo com hipertrofia excêntrica, disfunção sistólica global leve por hipocinesia difusa e disfunção diastólica padrão déficit de relaxamento.

5. REGRA ESTRITA DA AVALIAÇÃO (SEM TRAÇOS "-" E SEM CID-10/CIAP-2 NO TEXTO!):
   - Na seção AVALIAÇÃO da "evolucao_completa", escreva APENAS o nome clínico das hipóteses diagnósticas / condições avaliadas, uma por linha, SEM traço ("- ") no início da linha! (Exemplo: escreva "Erisipela" e na linha de baixo "Cefaleia", sem "- ").
   - É TERMINANTEMENTE PROIBIDO colocar códigos CID-10 ou CIAP-2 dentro do texto da evolução!
   - Os códigos CID-10 e CIAP-2 correspondentes devem ser informados SEPARADAMENTE apenas no campo JSON "codigos_cid_ciap" (ex.: ["CIAP-2: K86 | CID-10: I10 — Hipertensão essencial"]).

6. REGRA ESTRITA DA CONDUTA E ORTOGRAFIA FARMACOLÓGICA OFICIAL DO BRASIL (DCB / ANVISA / RENAME):
   - NÃO coloque traços ("- ") no início das linhas da CONDUTA! Escreva cada item diretamente em uma linha limpa.
   - ORTOGRAFIA FARMACOLÓGICA OFICIAL (DCB / ANVISA — PROIBIDO GRAFIA EM INGLÊS!):
     * Escreva SEMPRE os nomes dos medicamentos com a grafia oficial brasileira (DCB/RENAME):
       - Escreva "Sinvastatina" (COM "N", JAMAIS escreva "Simvastatina" com M!)
       - Escreva "Anlodipino" (COM "N", JAMAIS escreva "Amlodipino")
       - Escreva "Hidroclorotiazida" (COM "I", JAMAIS escreva "Hydroclorotiazida")
       - Escreva "Levotiroxina" (JAMAIS "Levothyroxina"), "Amoxicilina" (JAMAIS "Amoxycilina"), "Omeprazol", "Losartana", "Enalapril", "Metformina", "Gliclazida", "Glibenclamida", "Dapagliflozina", "Rosuvastatina", "Atorvastatina", "Espironolactona", "Furosemida", "Ácido Acetilsalicílico", "Clopidogrel", "Sertralina", "Fluoxetina", "Escitalopram", "Amitriptilina", "Nortriptilina", "Venlafaxina", "Duloxetina", "Pregabalina", "Gabapentina", "Clonazepam", "Cefalexina", "Azitromicina", "Ciprofloxacino", "Ibuprofeno", "Dipirona", "Paracetamol".
   - TRANSCRIÇÃO INTEGRAL DO USO DOS REMÉDIOS E ORIENTAÇÕES: Você DEVE transcrever absolutamente TUDO o que o médico falou e orientou sobre cada medicação e sobre o tratamento:
     * Nome de cada medicamento prescrito, concentração (mg, mcg, ml, UI, %), forma farmacêutica (comprimido, cápsula, gotas, xarope, pomada, creme, spray nasal, injetável), via de administração (VO, IM, IV, tópico, inalatório), dose exata, intervalo/frequência (ex.: de 8/8h, de 12/12h, 1x ao dia, em jejum, após o almoço, à noite) e duração do tratamento (por X dias ou uso contínuo).
     * Se o médico orientou COMO tomar ou usar o remédio (ex.: "tomar só se tiver dor ou febre", "tomar com bastante água", "aplicar uma camada fina 2x ao dia após o banho", "fazer lavagem nasal com soro fisiológico antes", "tomar 30 minutos antes do café"), INCLUA TODAS ESSAS ORIENTAÇÕES DE USO detalhadamente na linha da medicação!
     * AUTOCORREÇÃO DO MÉDICO NA FALA: Se o médico falar uma posologia/dose e em seguida corrigir na mesma fala (ex.: "de 8 em 8 horas... de 12 em 12"), registre a ÚLTIMA posologia definida pelo médico!
     * Se alterou ou ajustou dose: "Altero / Ajusto dose de [Nome do remédio] de [...] para [...] + orientações de uso"
     * Se suspendeu medicação: "Suspendo o uso de [Nome do remédio] devido a [...]"
     * Se renovou/manteve receita: "Renovo / Mantenho prescrição de [Nome dos remédios e doses]"
     * Inclua também todas as medidas não-farmacológicas orientadas pelo médico (repouso, elevação de membro, compressas, hidratação, alimentação, cuidados locais, prazo de retorno) e todos os exames solicitados ou encaminhamentos feitos.
   - SINAIS DE ALARME (PROIBIDO DUPLICAR!):
     * Se o médico orientou sinais de alarme no áudio (ou se houver sinais de alarme específicos citados), descreva-os na própria linha de sinais de alarme (ex.: "Oriento sinais de alarme ([descrever os sinais orientados]) e na presença procurar emergência. Ciente.") e REMOVA a frase genérica "Oriento sinais de alarme e na presença emergência. Ciente." para não ficar repetido!
     * Se o médico não especificou quais sinais de alarme, mantenha apenas a frase padrão "Oriento sinais de alarme e na presença emergência. Ciente.".

7. REGRAS ESPECÍFICAS DE PUERICULTURA (PROIBIÇÃO ABSOLUTA DE INVENTAR Z-SCORE!), PRÉ-NATAL E VISITA DOMICILIAR:
   - PROIBIÇÃO ABSOLUTA DE CALCULAR OU INVENTAR Z-SCORE NA PUERICULTURA (SEGURANÇA DO PACIENTE / PREMATURIDADE):
     * É TERMINANTEMENTE PROIBIDO que você (IA) calcule, estime ou invente valores numéricos ou classificações de Z-Score por conta própria! A criança pode ser prematura (exigindo idade corrigida / curva Intergrowth-21st) e cálculos estimados por IA geram erros graves (como classificar baixo peso como aumentado).
     * Nas linhas "Peso:", "Altura:", "PC:" e "IMC:" do OBJETIVO da Puericultura, registre APENAS as medidas antropométricas exatas faladas ou digitadas (ex.: "Peso: 7.400 g", "Altura: 66 cm", "PC: 43 cm").
     * SOMENTE escreva Z-Score ou classificação da curva se:
       1) O próprio [MÉDICO] verbalizou explicitamente no áudio qual foi o Z-Score ou a posição na curva (neste caso, transcreva fielmente a classificação dita pelo médico!), OU
       2) O valor já vier calculado abaixo na seção "=== DADOS OBJETIVOS / ANTROPOMETRIA / Z-SCORE ===" (e mesmo assim, se no áudio ou no "# Histórico do parto" constar prematuridade / Capurro < 37 semanas sem idade corrigida, NÃO aplique Z-Score de termo!).
     * Extraia também do áudio da Puericultura os Marcos do Desenvolvimento, Ortolani, Barlow, Otoscopia/Oroscopia (se falados) e todos os detalhes da "Alimentação:" dentro do bloco SUBJETIVO (se SME, complementado, misto ou fórmula infantil — especificando qual fórmula, quantidade em ml, medidas e horários).
   - No PRÉ-NATAL: extraia diretamente do áudio e da seção "=== DADOS OBJETIVOS / ANTROPOMETRIA / Z-SCORE ===" todos os dados do cabeçalho (# G P V PC A, # DUM / # IG POR DUM / # IG POR ECO COM X SEM EM DD/MM/AAAA / # DPP conforme o cálculo obstétrico oficial FEBRASGO/MS, # TS, # TOXO, # SOROLOGIAS, # VACINAS) e todos os dados do OBJETIVO falados pelo médico ou digitados (AU em cm, BCF em bpm, MF presentes/ausentes, Edema em MMII, Peso em kg e PA em mmHg), além de qualquer exame físico adicional falado!
   - Na VISITA DOMICILIAR: preencha a data no título, nomes da equipe (Enfermeiro/a e ACS), nome do familiar presente e o checklist final ">> PENDÊNCIAS PARA REALIZAR NO POSTO (UBS) PÓS-VISITA:".

8. BLINDAGEM ABSOLUTA CONTRA INTERRUPÇÕES DE ENFERMAGEM / DISCUSSÃO DE OUTRO PACIENTE NO MEIO DA CONSULTA:
   - ${templateObj.id === 'interconsulta' ? 'Este atendimento é uma Interconsulta com a Enfermagem.' : 'ESTE ATENDIMENTO NÃO É UMA INTERCONSULTA DE TERCEIROS! Portanto, você DEVE identificar quem é o PACIENTE PRINCIPAL que está sendo atendido na consulta e FILTRAR/DESCARTAR COMPLETAMENTE qualquer conversa paralela ou interrupção em que a enfermagem/equipe entre na sala para falar de outro paciente (ex.: mudanças bruscas para falar de "um paciente lá no acolhimento", "dona fulana", "licença doutor, só tirar uma dúvida de um caso", ou queixas/receitas de terceira pessoa sem relação com o paciente em consulta).'}
   - JAMAIS misture sintomas, pressão arterial, exames, diagnósticos ou medicações de um caso discutido com a enfermagem durante uma interrupção dentro do prontuário ("evolucao_completa") do paciente que está sendo atendido!
   - Se você detectar que houve uma interrupção externa discutindo outro paciente no meio do áudio, exclua esses dados da "evolucao_completa" e apenas avise em "alertas_auditoria": "Interrupção externa/interconsulta de terceiro detectada no áudio e isolada automaticamente para não contaminar este prontuário."

9. DIFERENCIAÇÃO ESTRITA ENTRE A VOZ DO MÉDICO E A VOZ DO PACIENTE:
   - No SUBJETIVO: registre as queixas, sintomas, história da doença atual e respostas fornecidas pelo PACIENTE (ou acompanhante), além dos controles trazidos pelo paciente ("Controle de HGT:" e "Controle de PA:" com o parecer do médico).
   - PROIBIDO NO SUBJETIVO: Quando o [MÉDICO] estiver explicando alterações de exames laboratoriais/imagem para o paciente (ex.: médico dizendo "olha, seu exame mostrou colesterol alto / infecção de urina / gordura no fígado"), JAMAIS escreva no SUBJETIVO que "Paciente refere alteração em exame / refere colesterol alto"!
${previousConsultationText ? `
10. COMPARAÇÃO EVOLUTIVA COM A ÚLTIMA CONSULTA / EVOLUÇÃO PRÉVIA (VALE PARA TODOS OS 7 MODELOS!):
   - O médico colou abaixo a ÚLTIMA EVOLUÇÃO (evolução prévia) deste paciente. Você DEVE cruzar a evolução prévia com o áudio/dados da consulta de hoje seguindo RIGOROSAMENTE estas 4 regras:
   a) ATUALIZAR AS "#" (COMORBIDADES / PROBLEMAS ATIVOS NO CABEÇALHO):
      * Mantenha nas linhas "#" do topo todas as comorbidades/condições crônicas que já estavam nas "#" da última evolução, E PUXE DA "AVALIAÇÃO" DA ÚLTIMA CONSULTA (e da consulta de hoje) os diagnósticos novos/crônicos firmados para que passem a constar nas "#" do cabeçalho atual!
   b) ATUALIZAR A "# MUC:" (MEDICAÇÕES EM USO NO MOMENTO DA CONSULTA ATUAL):
      * Atualize a linha "# MUC:" (ou "Medicações em uso:") refletindo o que o paciente estava em uso ao chegar na consulta de hoje:
      * Se uma medicação foi SUSPENSA na última consulta e o paciente parou de tomar -> EXCLUA essa medicação da "# MUC:"!
      * Se uma medicação de uso contínuo já havia sido iniciada ou ajustada na ÚLTIMA consulta e o paciente está em uso -> inclua/atualize na "# MUC:".
      * ATENÇÃO: NÃO coloque na "# MUC:" medicações que estão sendo prescritas pela primeira vez na consulta de HOJE! Medicações prescritas hoje ficam apenas na CONDUTA de hoje.
   c) CHECAGEM DE ADESÃO E MEDICAÇÃO SUSPENSA NO "SUBJETIVO":
      * Verifique se na CONDUTA da última evolução alguma medicação havia sido suspensa, trocada ou ajustada.
      * Se no áudio de hoje o paciente relatar que CONTINUA TOMANDO uma medicação que já havia sido suspensa/retirada na consulta anterior (ou se tomou na dose errada / não iniciou o que foi prescrito), você DEVE REGISTRAR ISSO EXPLICITAMENTE NO SUBJETIVO (ex.: "Paciente refere manter o uso de [Nome da medicação], apesar da suspensão orientada na última consulta" ou "Paciente refere não ter ajustado/iniciado [Nome da medicação] conforme conduta prévia").
   d) DADOS PERMANENTES DO CABEÇALHO:
      * Aproveite da evolução prévia os dados permanentes já preenchidos (# Tabagista, # Alergias, # G P V PC A / TS / Sorologias no Pré-Natal, # Histórico do parto / Triagem neonatal na Puericultura, ou Identificação/Documentação no modelo LGBT), atualizando tudo o que mudou na consulta de hoje!

=== ÚLTIMA EVOLUÇÃO / CONSULTA ANTERIOR DO PACIENTE (PARA COMPARAÇÃO E ATUALIZAÇÃO) ===
${previousConsultationText}
` : ''}${previousEvolutionContext ? `\n11. COMPLEMENTAÇÃO DE ATENDIMENTO DO MESMO PACIENTE (CONTINUAÇÃO DE GRAVAÇÃO):\n   - O médico já havia gravado e transcrito a primeira parte desta consulta e agora gravou uma continuação para o MESMO paciente.\n   - Integre perfeitamente as novas informações faladas neste áudio (novas queixas, exame físico, exames ou condutas/prescrições finais) com a evolução já iniciada abaixo, mantendo uma única evolução completa, coesa e atualizada:\n=== EVOLUÇÃO DA 1ª PARTE DESTE MESMO PACIENTE ===\n${previousEvolutionContext}\n` : ''}${preTranscribedExamsText ? `\n=== EXAMES COMPLEMENTARES JÁ TRANSCRITOS NESTA CONSULTA (INCLUA NO BLOCO EXAMES COMPLEMENTARES) ===\n${preTranscribedExamsText}\n` : ''}
=== DADOS EXTRAS / NOTAS RÁPIDAS DO MÉDICO ===
${quickNotes ? quickNotes : 'Nenhuma nota rápida digitada.'}
${zScoreSummary ? '\n=== DADOS OBJETIVOS / ANTROPOMETRIA / Z-SCORE ===\n' + zScoreSummary : ''}

=== MODELO DE REFERÊNCIA A SER SEGUIDO ===
${templateObj.templateText}

=== FORMATO DE RESPOSTA (JSON OBRIGATÓRIO) ===
Responda em JSON válido contendo exatamente estas chaves (preencha "transcricao_literal_do_audio" PRIMEIRO para ancorar 100% no áudio real, e em seguida preencha "evolucao_completa" sem inventar nada que não esteja na transcrição!):
{
  "transcricao_literal_do_audio": "Transcrição fiel APENAS do que foi efetivamente falado no áudio separando [MÉDICO]: e [PACIENTE]: (se o áudio estiver em silêncio ou tiver apenas uma frase avulsa, escreva exatamente o que ouviu, sem inventar diálogo!)",
  "evolucao_completa": "Texto completo da evolução estruturada seguindo fielmente o MODELO DE REFERÊNCIA acima com quebras de linha \\n baseado EXCLUSIVAMENTE no que foi falado (ou aviso '⚠️ Áudio sem conteúdo de consulta médica identificado' se o áudio não for uma consulta real!)",
  "codigos_cid_ciap": ["Lista com os códigos CIAP-2 e CID-10 sugeridos para digitar fora da evolução no PEC (ou [] se não houver diagnóstico)"],
  "especialidade_sugerida_encaminhamento": "Se durante a consulta foi citado encaminhamento, informe a especialidade, caso contrário deixe string vazia",
  "alertas_auditoria": ["Lista curta apenas se faltou algum dado crítico obrigatório"]
}`;
};

// ============================================================================
// GERADOR DE PROMPT PARA TRANSCRIÇÃO INSTANTÂNEA DE EXAMES (DURANTE A GRAVAÇÃO)
// ============================================================================
window.buildInstantExamTranscriptionPrompt = function() {
  return `Você é um Médico de Família e Comunidade na APS/UBS.
Analise TODOS os arquivos de exames complementares (PDFs / imagens de laudos laboratoriais ou de imagem) anexados e transcreva 100% dos resultados no formato padrão de prontuário abaixo.

REGRAS OBRIGATÓRIAS:
1. TRANSCREVA 100% DE TODOS OS EXAMES REALIZADOS PRESENTES NO LAUDO/PDF: Varra todas as páginas do documento e inclua TODOS os exames que tiverem resultado (hemograma completo, bioquímica, função renal, eletrólitos, hepatograma, perfil lipídico, tireoide, hormônios, vitaminas, ferro/ferritina, sorologias, urina/EQU, urocultura, parasitológico, imagem, etc.).
2. PROIBIDO ESCREVER "N/R" OU "Não realizado": Só inclua exames que efetivamente possuem resultado no documento.
3. FORMATO EXATO:
   - LABORATORIAIS (todos os exames da mesma data na mesma linha, separados por " | ", usando abreviações médicas limpas + valor):
     Exemplo: - LABS 17/08/2026: Hb 15,3 | Ht 43,7 | Leuco 6.990 | Plaq 303.000 | GJ 90,9 | HbA1c 4,4% | Creat 0,97 | Ureia 22,2 | Sódio 140 | K 4,6 | TGO 18 | TGP 18 | CT 195,1 | HDL 33,8 | LDL 143,6 | TAG 74 | TSH 0,81 | EQU: pH 6,0, Leucócitos 25/uL
   - EXAMES DE IMAGEM / MÉTODOS GRÁFICOS (em texto corrido conciso por data):
     Exemplo: - USG ABDOME TOTAL 12/09/2026: Fígado com dimensões normais e aumento difuso da ecogenicidade compatível com esteatose hepática leve. Demais estruturas sem alterações.

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
