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
Paciente vem acompanhado(a) da mãe [inserir grau de parentesco e nome do familiar se falado no áudio, ex.: da mãe Silvia]. Familiar relata que paciente está bem. Alimentação/Aleitamento: [descrever se SME, complementado, misto ou fórmula infantil — se fórmula, especificar qual marca/tipo, volume em ml, diluição/medidas e intervalo/frequência]. Em uso corretamente de sulfato ferroso e vitamina AD. Paciente dorme em. Paciente reside com. Nega queda da própria altura. Paciente com exposição à tela de. Paciente frequentando creche. Nega intercorrências ou necessidade de consultas médicas entre as consultas de puericultura. Familiar sem demais queixas

OBJETIVO
BEG, MUC, ativo, eupneico em ar ambiente, anictérico e acianótico
Peso:  (Z-Score Peso/Idade: )
Altura:  (Z-Score Estatura/Idade: )
PC:  (Z-Score PC/Idade: )
IMC:  (Z-Score IMC/Idade: )
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
Visita domiciliar realizada acompanhada do(a) Enfermeiro(a) [nome] e ACS [nome], sendo a equipe recebida pelo(a) familiar/cuidador(a) [nome].
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
window.buildMedicalEvolutionPrompt = function(templateObj, quickNotes, zScoreSummary, hasExamFiles, previousEvolutionContext) {
  const todayStr = new Date().toLocaleDateString('pt-BR');
  return `Você é um Médico de Família e Comunidade experiente na Atenção Primária à Saúde (UBS / SUS).
Sua tarefa tem DUAS ETAPAS OBRIGATÓRIAS:
ETAPA 1: Ouvir o áudio anexado do início ao fim com atenção absoluta e transcrever fielmente TUDO o que foi dito no campo "transcricao_literal_do_audio" do JSON, IDENTIFICANDO QUEM ESTÁ FALANDO com as etiquetas "[MÉDICO]:" e "[PACIENTE]:" (ou "[ENFERMAGEM/TERCEIRO]:" se houver interrupção externa). Não pule nenhuma palavra, sintoma, exame físico ou nome de remédio/posologia!
ETAPA 2: Com base na sua transcrição completa com separação entre [MÉDICO] e [PACIENTE] + PDFs de exames anexados (se houver) + anotações rápidas, preencher o modelo de evolução selecionado abaixo com rigor semiológico, coerência clínica e resguardo jurídico.

Data de referência de hoje: ${todayStr}.

=== REGRAS CRÍTICAS E OBRIGATÓRIAS (SIGA RIGOROSAMENTE) ===

1. RESPEITO ABSOLUTO À MÁSCARA / MODELO DE EVOLUÇÃO SELECIONADO, ACOMPANHANTE E PROIBIÇÃO DE CONTRADIÇÕES:
   - Você DEVE manter a estrutura IDÊNTICA ao "MODELO DE REFERÊNCIA A SER SEGUIDO" abaixo!
   - Mantenha o cabeçalho (#, # MUC:, # Tabagista:, # Alergias: — preenchendo se foi falado ou deixando em branco se não falado).
   - REGISTRO DO FAMILIAR / ACOMPANHANTE E GRAU DE PARENTESCO NO SUBJETIVO:
     * Na PUERICULTURA: escreva sempre no início do SUBJETIVO o grau de parentesco e o nome do familiar que acompanha a criança conforme falado no áudio ou notas (exemplo: "Paciente vem acompanhado da mãe Silvia." ou "Paciente vem acompanhado do pai João."). Se apenas o parentesco foi citado sem o nome, escreva o parentesco (ex.: "Paciente vem acompanhado da mãe.").
     * Na CONSULTA GERAL (SOAP) e demais modelos: sempre que o paciente estiver acompanhado por um familiar/acompanhante citado no áudio, inclua o grau de parentesco e o nome logo na abertura do SUBJETIVO (exemplo: "Paciente vem em consulta, acompanhado da mãe Silvia, em decorrência de ..." ou "Paciente vem em consulta, acompanhado da esposa Maria, em decorrência de ..."). Caso esteja desacompanhado, mantenha "Paciente vem em consulta em decorrência de ...".
   - PROIBIDO CONTRADIÇÃO NO PRÉ-NATAL, PUERICULTURA, VISITA DOMICILIAR E DEMAIS MODELOS:
     * Se a gestante (no Pré-Natal), a mãe/criança (na Puericultura) ou o paciente (na Visita Domiciliar / Consulta Geral) relatar QUALQUER queixa, dor, sintoma, intercorrência ou sinal de alarme no áudio, você DEVE REMOVER IMEDIATAMENTE as frases padrão "Paciente refere estar bem, sem queixas", "Familiar relata que paciente está bem", "Nega intercorrências" e "Sem demais queixas"!
     * Se a gestante/paciente referir algum sintoma que está listado como negativa padrão no modelo (ex.: se ela tiver cefaleia, escotomas, disúria, sangramento vaginal, perda de líquido ou febre), APAGUE a frase "Nega [aquele sintoma]" e descreva detalhadamente o sintoma que ela está sentindo! Mantenha como "Nega ..." apenas os sintomas que ela realmente negou ou não apresentou.
   - Mantenha no final da CONDUTA as frases finais padrão do modelo SEM traço no início (ex.: "Orientações gerais\nCiente, concordante e sem dúvidas"). Se o médico orientou sinais de alarme específicos no áudio, descreva esses sinais na linha "Oriento sinais de alarme (...) e na presença emergência. Ciente." e NÃO repita a frase genérica "Oriento sinais de alarme e na presença emergência. Ciente."!

2. REGRA ESTRITA DO EXAME FÍSICO (OBJETIVO) — NÃO INVENTE DADOS NÃO FALADOS:
   - NUNCA invente sinais físicos que o médico não falou (ex.: se o médico só palpou e perguntou se doía, escreva apenas "Dor à palpação em panturrilha direita", NÃO invente "sinais flogísticos" se o médico não falou isso!).
   - Mantenha apenas "BEG, LOC, MUC" e inclua SOMENTE a PA/sinais vitais e os achados do exame físico que foram EFETIVAMENTE ditos no áudio ou nas notas rápidas!
   - Se o médico NÃO falou nada sobre aparelho respiratório, cardiovascular ou abdome, NÃO coloque AP, AC ou ABD no Objetivo!

3. REGRA ESTRITA DE EXAMES COMPLEMENTARES (ZERO OMISSÃO E PROIBIDO "N/R"):
   - ${hasExamFiles ? 'Há PDFs/imagens de exames anexados! Crie o bloco "EXAMES COMPLEMENTARES" logo após o OBJETIVO e antes da AVALIAÇÃO e transcreva TODOS os exames presentes nos arquivos.' : 'Se NÃO houver PDF de exame anexado E o médico NÃO tiver falado nenhum resultado de exame complementar no áudio/notas, NÃO CRIE e NÃO ESCREVA o título "EXAMES COMPLEMENTARES" na evolução!'}
   - Quando houver exames complementares (por PDF anexado ou ditados no áudio/notas), siga RIGOROSAMENTE estas 3 regras:
     a) TRANSCREVA 100% DE TODOS OS EXAMES REALIZADOS PRESENTES NO LAUDO/PDF: Varra todas as páginas do documento e inclua TODOS os exames que tiverem resultado (hemograma completo, bioquímica, função renal, eletrólitos, hepatograma/enzimas hepáticas, perfil lipídico, tireoide, hormônios, vitaminas, cinética de ferro, marcadores inflamatórios, sorologias, urina/EQU, urocultura, parasitológico, fezes, etc.). NUNCA omita exames extras que foram realizados no laudo!
     b) PROIBIDO ESCREVER "N/R", "Não realizado" OU EXAMES QUE NÃO CONSTAM NO LAUDO: Se um exame (por exemplo, T4L, Ferritina, etc.) NÃO estiver presente no PDF, NÃO escreva "T4L N/R" — simplesmente NÃO inclua esse exame na linha! Só escreva exames que efetivamente possuem resultado no documento.
     c) FORMATO EXATO:
        * LABORATORIAIS (todos os exames da mesma data na mesma linha, separados por " | ", usando abreviações médicas limpas + valor):
          Exemplo: - LABS 17/08/2026: Hb 15,3 | Ht 43,7 | Leuco 6.990 | Plaq 303.000 | GJ 90,9 | HbA1c 4,4% | Creat 0,97 | Ureia 22,2 | Sódio 140 | K 4,6 | Ác. Úrico 5,4 | TGO 18 | TGP 18 | GGT 35,1 | FA 68 | BT 0,7 | CT 195,1 | HDL 33,8 | LDL 143,6 | TAG 74 | TSH 0,81 | Vit B12 390 | Vit D 31,2 | Testo Total 842 | Testo Livre 23,07 | EQU: pH 6,0, Densidade 1.020, Leucócitos 25/uL, Flora Bacteriana Moderada
        * EXAMES DE IMAGEM E MÉTODOS GRÁFICOS (em texto corrido conciso, sem tópicos soltos):
          Exemplo: - ECOCARDIO TT 20/11/2025: FE 52,2%. Ventrículo esquerdo com hipertrofia excêntrica, disfunção sistólica global leve por hipocinesia difusa e disfunção diastólica padrão déficit de relaxamento.

4. REGRA ESTRITA DA AVALIAÇÃO (SEM TRAÇOS "-" E SEM CID-10/CIAP-2 NO TEXTO!):
   - Na seção AVALIAÇÃO da "evolucao_completa", escreva APENAS o nome clínico das hipóteses diagnósticas / condições avaliadas, uma por linha, SEM traço ("- ") no início da linha! (Exemplo: escreva "Erisipela" e na linha de baixo "Cefaleia", sem "- ").
   - É TERMINANTEMENTE PROIBIDO colocar códigos CID-10 ou CIAP-2 dentro do texto da evolução!
   - Os códigos CID-10 e CIAP-2 correspondentes devem ser informados SEPARADAMENTE apenas no campo JSON "codigos_cid_ciap" (ex.: ["CIAP-2: K86 | CID-10: I10 — Hipertensão essencial"]).

5. REGRA ESTRITA DA CONDUTA — TRANSCREVA 100% DAS MEDICAÇÕES E TODAS AS ORIENTAÇÕES DE USO (SEM TRAÇOS "-" NO INÍCIO DAS LINHAS!):
   - NÃO coloque traços ("- ") no início das linhas da CONDUTA! Escreva cada item diretamente em uma linha limpa.
   - É TERMINANTEMENTE PROIBIDO escrever frases genéricas como "Prescrição medicamentosa conforme avaliação médica" ou "Ajuste terapêutico".
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

6. REGRAS ESPECÍFICAS DE PUERICULTURA, PRÉ-NATAL E VISITA DOMICILIAR (EXTRAÇÃO AUTOMÁTICA DO ÁUDIO!):
   - ATENÇÃO MÁXIMA: O médico pode optar por NÃO digitar nada nos campos da tela e apenas FALAR os dados no áudio! Portanto, se os campos da tela estiverem vazios, você DEVE extrair diretamente da fala do médico no áudio:
     * Na PUERICULTURA: extraia do áudio a idade da criança, Peso, Altura/Comprimento, Perímetro Cefálico (PC), calcule o IMC e estime/classifique os Z-Scores (OMS: Peso/Idade, Estatura/Idade, PC/Idade e IMC/Idade) preenchendo as linhas do OBJETIVO! Extraia também do áudio os Marcos do Desenvolvimento, Ortolani, Barlow, Otoscopia/Oroscopia (se falados) e todos os detalhes do Aleitamento/Alimentação (se SME, complementado, misto ou fórmula infantil — especificando qual fórmula, quantidade em ml, medidas e horários).
     * No PRÉ-NATAL: extraia diretamente do áudio todos os dados do cabeçalho (# G P V PC A, # IG, # TS, # TOXO, # SOROLOGIAS, # VACINAS) e todos os dados do OBJETIVO falados pelo médico (AU em cm, BCF em bpm, MF presentes/ausentes, Edema em MMII, Peso em kg e PA em mmHg), além de qualquer exame físico adicional falado!
     * Na VISITA DOMICILIAR: preencha a data no título, nomes da equipe (Enfermeiro/a e ACS), nome do familiar presente e o checklist final ">> PENDÊNCIAS PARA REALIZAR NO POSTO (UBS) PÓS-VISITA:".

7. BLINDAGEM ABSOLUTA CONTRA INTERRUPÇÕES DE ENFERMAGEM / DISCUSSÃO DE OUTRO PACIENTE NO MEIO DA CONSULTA:
   - Na rotina da UBS, é muito comum que durante o atendimento de um paciente outra profissional (Enfermeira, Técnica de Enfermagem, ACS, Recepção ou colega) bata na porta e entre na sala para discutir o caso de OUTRO paciente (uma interconsulta rápida de porta, renovação de receita de terceiro, dúvida sobre curativo/vacina/acolhimento de outra pessoa) e o médico esqueça de pausar a gravação.
   - ${templateObj.id === 'interconsulta' ? 'Este atendimento é uma Interconsulta com a Enfermagem.' : 'ESTE ATENDIMENTO NÃO É UMA INTERCONSULTA DE TERCEIROS! Portanto, você DEVE identificar quem é o PACIENTE PRINCIPAL que está sendo atendido na consulta e FILTRAR/DESCARTAR COMPLETAMENTE qualquer conversa paralela ou interrupção em que a enfermagem/equipe entre na sala para falar de outro paciente (ex.: mudanças bruscas para falar de "um paciente lá no acolhimento", "dona fulana", "licença doutor, só tirar uma dúvida de um caso", ou queixas/receitas de terceira pessoa sem relação com o paciente em consulta).'}
   - JAMAIS misture sintomas, pressão arterial, exames, diagnósticos ou medicações de um caso discutido com a enfermagem durante uma interrupção dentro do prontuário ("evolucao_completa") do paciente que está sendo atendido!
   - Se você detectar que houve uma interrupção externa discutindo outro paciente no meio do áudio, exclua esses dados da "evolucao_completa" e apenas avise em "alertas_auditoria": "Interrupção externa/interconsulta de terceiro detectada no áudio e isolada automaticamente para não contaminar este prontuário."

8. DIFERENCIAÇÃO ESTRITA ENTRE A VOZ DO MÉDICO E A VOZ DO PACIENTE (PROIBIDO ATRIBUIR EXPLICAÇÕES DO MÉDICO AO PACIENTE!):
   - Diferencie com precisão absoluta o que foi dito pelo [PACIENTE] do que foi dito pelo [MÉDICO]:
   - No SUBJETIVO: registre APENAS as queixas, sintomas, história da doença atual e respostas fornecidas pelo PACIENTE (ou seu acompanhante).
   - PROIBIDO NO SUBJETIVO: Quando o [MÉDICO] estiver explicando alterações de exames complementares ou achados clínicos para o paciente (ex.: médico dizendo "olha, seu exame mostrou colesterol alto / glicose alterada / infecção de urina / gordura no fígado"), JAMAIS escreva no SUBJETIVO que "Paciente refere alteração em exame / refere colesterol alto"! Quem falou isso foi o médico explicando o resultado!
   - Tudo o que o [MÉDICO] ler ou explicar sobre resultados de exames deve ir para "EXAMES COMPLEMENTARES" e "AVALIAÇÃO", e as explicações/condutas do médico devem ir para "CONDUTA".
${previousEvolutionContext ? `\n9. COMPLEMENTAÇÃO DE ATENDIMENTO DO MESMO PACIENTE (CONTINUAÇÃO DE GRAVAÇÃO):\n   - O médico já havia gravado e transcrito a primeira parte desta consulta e agora gravou uma continuação para o MESMO paciente.\n   - Integre perfeitamente as novas informações faladas neste áudio (novas queixas, exame físico, exames ou condutas/prescrições finais) com a evolução já iniciada abaixo, mantendo uma única evolução completa, coesa e atualizada:\n=== EVOLUÇÃO DA 1ª PARTE DESTE MESMO PACIENTE ===\n${previousEvolutionContext}\n` : ''}
=== DADOS EXTRAS / NOTAS RÁPIDAS DO MÉDICO ===
${quickNotes ? quickNotes : 'Nenhuma nota rápida digitada.'}
${zScoreSummary ? '\n=== DADOS OBJETIVOS / ANTROPOMETRIA / Z-SCORE ===\n' + zScoreSummary : ''}

=== MODELO DE REFERÊNCIA A SER SEGUIDO ===
${templateObj.templateText}

=== FORMATO DE RESPOSTA (JSON OBRIGATÓRIO) ===
Responda em JSON válido contendo exatamente estas chaves (preencha "transcricao_literal_do_audio" PRIMEIRO!):
{
  "transcricao_literal_do_audio": "Transcrição completa e fiel de tudo o que foi falado no áudio (para garantir que nenhuma informação, queixa, exame físico ou medicação seja perdida)",
  "evolucao_completa": "Texto completo da evolução seguindo fielmente o modelo acima com quebras de linha \\n (SEM códigos CID-10 ou CIAP-2 dentro do texto!)",
  "codigos_cid_ciap": ["Lista com os códigos CIAP-2 e CID-10 sugeridos para digitar fora da evolução no PEC, ex: 'CIAP-2: K86 | CID-10: I10 — Hipertensão arterial'"],
  "resumo_subjetivo": "Apenas o bloco SUBJETIVO extraído",
  "resumo_objetivo": "Apenas o bloco OBJETIVO extraído",
  "resumo_exames": "Apenas o bloco EXAMES COMPLEMENTARES (ou string vazia se não houver exames)",
  "resumo_avaliacao": "Apenas o bloco AVALIAÇÃO extraído (sem códigos CID/CIAP)",
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
