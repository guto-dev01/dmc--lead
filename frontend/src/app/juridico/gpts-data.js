// Catálogo de Assistentes Jurídicos (GPTs) — 106 assistentes especializados
// em Direito Brasileiro. Itens com `url` abrem o GPT original no ChatGPT;
// itens com `nativo: true` rodam apenas no chat nativo do ImobPro.
export const GPTS = [
  // ── PODER JUDICIÁRIO ──
  { nome: "GPT Judiciário – Elaboração de Voto", categoria: "Poder Judiciário", descricao: "Auxilia juízes e desembargadores na elaboração de votos judiciais. Insira os autos ou documentos do caso e pressione ENTER.", url: "https://chatgpt.com/g/g-6755bdf3b6c48191ac19d7511e7a41d3-gpt-judiciario-elaboracao-de-voto" },
  { nome: "GPT Judiciário – Relatório Esquematizado do Voto", categoria: "Poder Judiciário", descricao: "Auxiliar de juízes e desembargadores para elaborar relatórios e resumos esquematizados de votos.", url: "https://chatgpt.com/g/g-6755c4f520a0819193e93e54187109a5-gpt-judiciario-relatorio-esquematizado-do-voto" },
  { nome: "GPT Judiciário – Criação de EMENTA Judicial", categoria: "Poder Judiciário", descricao: "Assistente para criação de EMENTA de decisão judicial, de acordo com o modelo padronizado pelo CNJ e o Manual de Padronização de Ementas.", url: "https://chatgpt.com/g/g-674f75ea0c188191bc31b2f30f89983b-gpt-judiciario-criacao-de-ementa-judicial" },
  { nome: "GPT Judiciário – Relatório Detalhado da Decisão", categoria: "Poder Judiciário", descricao: "Elabora um relatório analítico, avançado e minucioso sobre a decisão, com suporte estratégico para tomada de decisões judiciais.", url: "https://chatgpt.com/g/g-6756bfaac03c8191bac60184c9f28b0f-gpt-judiciario-relatorio-detalhado-da-decisao" },
  { nome: "GPT Judiciário – Decisão Embargo de Declaração", categoria: "Poder Judiciário", descricao: "Assistente especializado em criar uma minuta de Decisão sobre Embargos de Declaração.", url: "https://chatgpt.com/g/g-6756e50767408191b29277e4d00a8b19-gpt-judiciario-decisao-embargo-de-declaracao" },
  { nome: "GPT Judiciário – Revisor de Decisões Judiciais", categoria: "Poder Judiciário", descricao: "Identifica e propõe melhorias redacionais e técnicas em decisões judiciais, evitando omissões, contradições e obscuridades.", url: "https://chatgpt.com/g/g-6756eaa0f2f48191bc33eb42903bed96-gpt-judiciario-revisor-de-decisoes-judiciais" },
  { nome: "GPT Judiciário – Resumir Depoimentos de Audiências", categoria: "Poder Judiciário", descricao: "Analisa documentos de audiências judiciais e gera um resumo preciso e organizado.", url: "https://chatgpt.com/g/g-6756f25e5c108191accf8d3de17d8f7b-gpt-judiciario-resumir-depoimentos-de-audiencias" },
  { nome: "GPT Judiciário – Minuta de Habeas Corpus", categoria: "Poder Judiciário", descricao: "Assistente especializado na preparação de uma minuta de Habeas Corpus. Anexe todos os dados relacionados e pressione ENTER.", url: "https://chatgpt.com/g/g-6758441e9c588191a2f2279db229365f-gpt-judiciario-minuta-de-habeas-corpus" },
  { nome: "GPT Judiciário – Minutas de Decisão em APF", categoria: "Poder Judiciário", descricao: "Assistente especializado na criação de minutas de decisão em Autos de Prisão em Flagrante.", url: "https://chatgpt.com/g/g-67584b636f748191bccb61cb10a1785f-gpt-judiciario-minutas-de-decisao-em-apf" },
  { nome: "GPT Judiciário – Sentenças Penais", categoria: "Poder Judiciário", descricao: "Assistente especializado em redigir uma minuta de sentença penal detalhada e fundamentada.", url: "https://chatgpt.com/g/g-675855344a4c8191aad90d91150fe00f-gpt-judiciario-sentencas-penais" },

  // ── CRIAÇÃO DE PEÇAS JURÍDICAS ──
  { nome: "GPT – Minuta de uma Petição Inicial", categoria: "Criação de Peças Jurídicas", descricao: "Insira os dados necessários e o assistente irá propor uma minuta de petição inicial.", url: "https://chatgpt.com/g/g-a1hMvkU57-gpt-minuta-de-uma-peticao-inicial" },
  { nome: "GPTPet – Assistente de Peticionamento", categoria: "Criação de Peças Jurídicas", descricao: "Cole o texto com os fatos do caso e a tese de defesa propostos. Receba uma contestação sugerida pela IA.", url: "https://chatgpt.com/g/g-OMYhpZYPX-gptpet-assistente-de-peticionamento" },
  { nome: "GPT – Petição Inicial com Neurociência da Persuasão", categoria: "Criação de Peças Jurídicas", descricao: "Construa uma petição avançada com técnicas de neurociência da persuasão.", url: "https://chatgpt.com/g/g-Elvn9MtVN-peticao-inicial-com-neurociencia-da-persuasao" },
  { nome: "GPT – Apelação", categoria: "Criação de Peças Jurídicas", descricao: "Insira as informações relevantes e o assistente irá propor uma minuta de Apelação.", url: "https://chatgpt.com/g/g-oT9u9SJSg-gpt-apelacao" },
  { nome: "GPT – Contestação Persuasiva", categoria: "Criação de Peças Jurídicas", descricao: "Construa uma Contestação analítica, persuasiva e otimizada para assegurar a atenção de magistrados e assessores.", url: "https://chatgpt.com/g/g-yGujLLKX3-gpt-contestacao-persuasiva" },
  { nome: "GPT – Fundamentação Jurídica", categoria: "Criação de Peças Jurídicas", descricao: "Informe o tipo da petição, os detalhes do caso e o objetivo da ação. Receba a minuta da fundamentação jurídica completa.", url: "https://chatgpt.com/g/g-3mHYj9pOx-gpt-fundamentacao-juridica" },
  { nome: "GPT – Criação de um Recurso Jurídico", categoria: "Criação de Peças Jurídicas", descricao: "Insira os dados detalhados e o assistente irá criar a minuta de um recurso jurídico robusto.", url: "https://chatgpt.com/g/g-9YaTmwPgE-gpt-criacao-de-um-recurso-juridico" },
  { nome: "GPT – Recurso com Técnicas de Storytelling", categoria: "Criação de Peças Jurídicas", descricao: "Crie um recurso robusto utilizando argumentos sólidos e técnicas de storytelling, além da indicação de ferramentas visuais.", url: "https://chatgpt.com/g/g-6843114d25888191991d6ef153b4ceb4-gpt-recurso-com-tecnicas-de-storytelling" },
  { nome: "GPT – Réplica / Impugnação à Contestação", categoria: "Criação de Peças Jurídicas", descricao: "Insira os documentos ou descreva o resumo dos fatos e argumentos. Receba uma réplica robusta.", url: "https://chatgpt.com/g/g-tbbko1JdT-gpt-replica-impugnacao-a-contestacao" },
  { nome: "GPT – Elaborar Memoriais Finais (Autor)", categoria: "Criação de Peças Jurídicas", descricao: "Insira o documento do processo e o assistente irá criar uma minuta dos Memoriais Finais do caso.", url: "https://chatgpt.com/g/g-luEvadT1C-gpt-elaborar-memoriais-finais-autor" },
  { nome: "GPT – Alegações Finais / Memoriais Finais (Autor ou Réu)", categoria: "Criação de Peças Jurídicas", descricao: "O Assistente pergunta qual parte você representa e prepara uma minuta de Memoriais Finais.", url: "https://chatgpt.com/g/g-Rzdf3mV8u-gpt-alegacoes-finais-memoriais-finais" },
  { nome: "GPT – Memorial Final Persuasivo", categoria: "Criação de Peças Jurídicas", descricao: "Crie um Memorial Final robusto e persuasivo preparado especialmente para influenciar a decisão do juiz.", url: "https://chatgpt.com/g/g-hP8nV5xfo-gpt-memorial-final-persuasivo" },
  { nome: "GPT – Elaborar uma Notificação Extrajudicial", categoria: "Criação de Peças Jurídicas", descricao: "Escreva, cole ou anexe os detalhes dos fatos e pedidos. Receba uma notificação detalhada e organizada.", url: "https://chatgpt.com/g/g-KHlgBQh1w-gpt-elaborar-uma-notificacao-extrajudicial" },
  { nome: "GPT – Elaboração de Contranotificação", categoria: "Criação de Peças Jurídicas", descricao: "Anexe ou cole a notificação original e receba uma Contranotificação Extrajudicial robusta.", url: "https://chatgpt.com/g/g-Qd5jls8dR-gpt-elaboracao-de-contranotificacao" },

  // ── REVISÃO DE PEÇAS JURÍDICAS ──
  { nome: "GPT – Sugestão de Melhorias de Peças Processuais", categoria: "Revisão de Peças Jurídicas", descricao: "Insira a peça processual e receba sugestões de melhoria em aspectos formais, substanciais, estratégia jurídica e clareza argumentativa.", url: "https://chatgpt.com/g/g-rn1XEUwPU-gpt-sugestao-de-melhorias-de-pecas-processuais" },
  { nome: "GPT – Revisar e Sugerir Melhorias na Petição", categoria: "Revisão de Peças Jurídicas", descricao: "Insira a petição e receba sugestões ortográficas e jurídicas, identificando contradições, lacunas e erros gramaticais.", url: "https://chatgpt.com/g/g-C565tOOQd-gpt-revisar-e-sugerir-melhorias-na-peticao" },

  // ── EXTRAÇÃO DE DADOS ──
  { nome: "GPT – Extração de Dados e Resumo do Processo Jurídico", categoria: "Extração de Dados", descricao: "Anexe o documento do processo e receba um resumo com dados críticos: partes, pedidos, valores, decisões e penalidades.", url: "https://chatgpt.com/g/g-w25Ik3qpZ-gpt-extracao-de-dados-e-resumo-do-processo-juridic" },
  { nome: "GPT – Descobrir Emoções e Padrões Ocultos no Texto", categoria: "Extração de Dados", descricao: "Insira o texto e receba uma análise detalhada das emoções, preconceitos latentes e padrões ocultos do autor.", url: "https://chatgpt.com/g/g-Jxi1sPxYz-gpt-descobrir-emocoes-e-padroes-ocultos-no-texto" },

  // ── REVISÃO E MELHORIA DE TEXTOS ──
  { nome: "GPT – Legal Design", categoria: "Revisão e Melhoria de Textos", descricao: "Escreva ou anexe um texto e receba uma minuta reestruturada aplicando os princípios de Legal Design e Visual Law.", url: "https://chatgpt.com/g/g-qTAyMcz4n-gpt-legal-design" },
  { nome: "GPT Revisor – Assistente de Escrita Jurídica", categoria: "Revisão e Melhoria de Textos", descricao: "Revisão e melhoria da escrita jurídica com foco em pontuação, precisão semântica, coerência e fluência do texto.", url: "https://chatgpt.com/g/g-Br1iYVMO8-gpt-revisor-assistente-de-escrita-juridica" },
  { nome: "GPT – Aprimoramento Retórico do Texto", categoria: "Revisão e Melhoria de Textos", descricao: "Melhore o apelo persuasivo do seu texto, refinando sua retórica e argumentação legal.", url: "https://chatgpt.com/g/g-xR0TO37wC-gpt-aprimoramento-retorico-do-texto" },
  { nome: "GPT – Reescrever Cláusula Jurídica", categoria: "Revisão e Melhoria de Textos", descricao: "Insira a cláusula e o assistente irá reescrevê-la para torná-la mais robusta e clara juridicamente.", url: "https://chatgpt.com/g/g-5FIWCcoHj-gpt-reescrever-clausula-juridica" },
  { nome: "Simplifica.AI! – Simplificar o Juridiquês", categoria: "Revisão e Melhoria de Textos", descricao: "Escreva ou cole o texto com juridiquês e receba a tradução em linguagem simples para não advogados.", url: "https://chatgpt.com/g/g-djkbS3oja-simplifica-ai-simplificar-o-juridiques" },
  { nome: "GPT – Traduzir para Inglês Jurídico (Legalese)", categoria: "Revisão e Melhoria de Textos", descricao: "Insira o texto em português e receba a versão em inglês jurídico com indicação das principais palavras técnicas.", url: "https://chatgpt.com/g/g-keVKVIqcG-gpt-traduzir-para-ingles-juridico-legalese" },
  { nome: "GPT – Continuar Escrita do Texto", categoria: "Revisão e Melhoria de Textos", descricao: "Insira o texto e o assistente irá continuar a escrita do ponto onde parou, mantendo estilo e linha argumentativa.", url: "https://chatgpt.com/g/g-DnQbLialh-gpt-continuar-escrita-do-texto" },

  // ── ESTRATÉGIA DO CASO ──
  { nome: "GPT – Pesquisa de Doutrinas, Legislação e Códigos", categoria: "Estratégia do Caso", descricao: "Insira o tema ou fatos e receba sugestões de doutrinas, legislação, códigos jurídicos e jurisprudência relacionados.", url: "https://chatgpt.com/g/g-jawfE5I26-gpt-pesquisa-de-doutrinas-legislacao-codigos" },
  { nome: "GPT – Analisar Estratégia, Riscos e Resultados", categoria: "Estratégia do Caso", descricao: "O assistente analisa a estratégia proposta, as provas e narrativa dos fatos, identificando riscos e possíveis resultados.", url: "https://chatgpt.com/g/g-Dmt8xTZDR-gpt-analisar-estrategia-riscos-e-resultados" },
  { nome: "GPT Estratégia – Refutar ou Confirmar uma Tese", categoria: "Estratégia do Caso", descricao: "Insira o texto e receba insights para refutar ou confirmar a tese apresentada com base em estudo aprofundado.", url: "https://chatgpt.com/g/g-LZWagQjIy-gpt-estrategia-refutar-ou-confirmar-uma-tese" },
  { nome: "GPT – Parecer Jurídico", categoria: "Estratégia do Caso", descricao: "Insira os detalhes dos fatos e receba obrigações, direitos, legislação aplicável e sugestão de ações para as partes.", url: "https://chatgpt.com/g/g-CloGmBnMZ-gpt-parecer-juridico" },
  { nome: "GPT – Gerar 3 Estratégias para o Caso", categoria: "Estratégia do Caso", descricao: "Insira a narrativa dos fatos e as provas e receba 3 possíveis estratégias para o caso.", url: "https://chatgpt.com/g/g-HS1Te8Z1r-gpt-gerar-3-estrategias-para-o-caso" },
  { nome: "GPT – Identificar Subsídios e Outros Documentos", categoria: "Estratégia do Caso", descricao: "Informe os detalhes do caso e receba sugestão de subsídios, documentos e provas relevantes.", url: "https://chatgpt.com/g/g-y0FtH9zT1-gpt-identificar-subsidios-e-outros-documentos" },
  { nome: "GPT – Refutação Jurídica Especializada", categoria: "Estratégia do Caso", descricao: "Assistente especializado em rebater argumentos. Anexe ou escreva o texto a ser contra-argumentado.", url: "https://chatgpt.com/g/g-6734b8fcfcdc81908aa9ab911d5bba2d-gpt-refutacao-juridica-especializada" },

  // ── JURISPRUDÊNCIA ──
  { nome: "GPT Jurisprudência – Sua Fonte Confiável e Real!", categoria: "Jurisprudência", descricao: "Insira o tema da jurisprudência que busca e receba ementas e artigos dos principais tribunais e bases de jurisprudência.", url: "https://chatgpt.com/g/g-Jx0VILpcO-gpt-jurisprudencia-sua-fonte-confiavel-e-real" },

  // ── ATENDIMENTO AO CLIENTE ──
  { nome: "GPT – Crie Perguntas ao Cliente", categoria: "Atendimento ao Cliente", descricao: "Escreva ou anexe as informações detalhadas sobre o caso e receba perguntas estratégicas a serem feitas ao cliente.", url: "https://chatgpt.com/g/g-8s4WCJcvY-gpt-perguntas-crie-perguntas-ao-cliente" },
  { nome: "GPT – Elaborar um Roteiro para a Consulta", categoria: "Atendimento ao Cliente", descricao: "Insira os detalhes disponíveis e receba um roteiro contextual para uma consulta inicial com o cliente.", url: "https://chatgpt.com/g/g-64DAzH6Sy-gpt-elaborar-um-roteiro-para-a-consulta" },

  // ── AUDIÊNCIA E JULGAMENTO ──
  { nome: "GPT – Elaboração de Quesitos para Perícia Judicial", categoria: "Audiência e Julgamento", descricao: "Insira o contexto do caso e receba lista de quesitos, pontos a esclarecer, tipo de perito indicado e objetivos da perícia.", url: "https://chatgpt.com/g/g-7c9wBDUBM-gpt-elaboracao-de-quesitos-para-pericia-judicial" },
  { nome: "GPT – Elaboração de Roteiro para Sustentação Oral", categoria: "Audiência e Julgamento", descricao: "Insira fatos, evidências, leis e precedentes. Receba um roteiro estruturado com perguntas prováveis e respostas sugeridas.", url: "https://chatgpt.com/g/g-7uFCRc0DW-gpt-elaboracao-de-roteiro-para-sustentacao-oral" },
  { nome: "GPT – Criador de Perguntas para Audiência", categoria: "Audiência e Julgamento", descricao: "Insira o contexto do caso e receba perguntas estratégicas para a audiência, tanto para parte autora quanto ré.", url: "https://chatgpt.com/g/g-MXaPaxUDI-gpt-criador-de-perguntas-para-audiencia" },
  { nome: "GPT – Roteiro e Estratégia para Audiência", categoria: "Audiência e Julgamento", descricao: "Insira o ramo do direito, tipo de audiência e detalhes do caso. Receba estratégia e roteiro detalhados.", url: "https://chatgpt.com/g/g-ZPRHAfeQE-gpt-roteiro-e-estrategia-para-audiencia" },
  { nome: "GPT – Analisador de Contradições em Depoimentos", categoria: "Audiência e Julgamento", descricao: "Anexe ou cole todos os depoimentos das testemunhas e receba análise profunda das contradições.", url: "https://chatgpt.com/g/g-6734b23733fc81909955dbe2f293f2ac-gpt-analisador-de-contradicoes-em-depoimentos" },

  // ── MARKETING JURÍDICO ──
  { nome: "GPT – Criador de Imagens Jurídico Ágil", categoria: "Marketing Jurídico", descricao: "Cria imagens realistas e detalhadas para redes sociais, com opções de edição em um único comando.", url: "https://chatgpt.com/g/g-678e6421de54819190e19a2e0a6e1198-gpt-criador-de-imagens-juridico-agil" },
  { nome: "GPT – Calendário de Conteúdo Marketing Jurídico", categoria: "Marketing Jurídico", descricao: "Escreva o tema e rede social e receba um calendário de conteúdo de 7 dias personalizado.", url: "https://chatgpt.com/g/g-hZVT0Q9sb-gpt-calendario-de-conteudo-marketing-juridico" },
  { nome: "GPT – Criador de Texto para Redes Sociais", categoria: "Marketing Jurídico", descricao: "Escreva o tema e tipo de texto desejado (blog, Instagram, LinkedIn) e receba conteúdo personalizado com técnicas de marketing jurídico.", url: "https://chatgpt.com/g/g-UVBoL98MP-gpt-criador-de-texto-para-redes-sociais" },
  { nome: "GPT Orador – Criador de Discurso ou Palestra", categoria: "Marketing Jurídico", descricao: "Escreva a pauta e público-alvo e receba o texto de um discurso ou palestra com as melhores práticas de oratória.", url: "https://chatgpt.com/g/g-3Ijjw07v9-gpt-orador-criador-de-discurso-ou-palestra" },
  { nome: "GPT – Proposta Comercial Serviços Jurídicos", categoria: "Marketing Jurídico", descricao: "O assistente cria uma proposta comercial com copywriting persuasivo, elegante, quebrando objeções do cliente.", url: "https://chatgpt.com/g/g-xKeYVetEu-gpt-proposta-comercial-servicos-juridicos" },

  // ── CONTRATOS ──
  { nome: "GPT Contrato – Avaliação de Riscos e Cláusulas", categoria: "Contratos", descricao: "Anexe ou cole o texto do contrato e receba sumário, avaliação de riscos e análise das cláusulas.", url: "https://chatgpt.com/g/g-b4GBGXAkE-gpt-contrato-avaliacao-de-riscos-e-clausulas" },
  { nome: "GPT – Criação de Minuta de Contrato", categoria: "Contratos", descricao: "Insira as informações mínimas: partes, objeto, termos e condições. Receba uma minuta completa do contrato.", url: "https://chatgpt.com/g/g-s3Y4I9YXz-gpt-criacao-de-minuta-de-contrato" },
  { nome: "GPT – Elaboração de Manual do Contrato", categoria: "Contratos", descricao: "Insira o contrato e receba um manual explicativo das cláusulas em linguagem de fácil entendimento.", url: "https://chatgpt.com/g/g-9KecZtRJH-gpt-elaboracao-de-manual-do-contrato" },
  { nome: "GPT Contratos – Análise Contratual com Parecer", categoria: "Contratos", descricao: "Identifica cláusulas controversas e arriscadas do ponto de vista da parte indicada e cria relatório detalhado.", url: "https://chatgpt.com/g/g-zSaKD0ogU-gpt-contratos-analise-contratual-com-parecer" },

  // ── NEGOCIAÇÃO E CONFLITOS ──
  { nome: "GPT – Gerador de 3 Estratégias de Negociação", categoria: "Negociação e Conflitos", descricao: "Insira os detalhes do caso e receba 3 estratégias de negociação com análise de risco e justificativa.", url: "https://chatgpt.com/g/g-UChedzSE1-gpt-gerador-de-3-estrategias-de-negociacao" },
  { nome: "GPT – Insights para Resolução de Conflitos", categoria: "Negociação e Conflitos", descricao: "Insira o contexto e receba visão do autor, visão do réu, pontos em comum e 3 possíveis soluções de meio-termo.", url: "https://chatgpt.com/g/g-e2LfBavIw-gpt-insights-para-resolucao-de-conflitos" },
  { nome: "GPT – Avaliador de Negociação", categoria: "Negociação e Conflitos", descricao: "Insira os detalhes do caso e receba um parecer sobre a negociação em curso, com riscos e estratégias sugeridas.", url: "https://chatgpt.com/g/g-MlvF5qdHL-gpt-avaliador-de-negociacao" },
  { nome: "GPT – Listar os Prós e Contras de um Tema", categoria: "Negociação e Conflitos", descricao: "Insira o texto jurídico e receba ponderação dos prós e contras de argumentos jurídicos, decisões e políticas.", url: "https://chatgpt.com/g/g-UVaxrGSHa-gpt-listar-os-pros-e-contras-de-um-tema" },

  // ── ÁREAS DO DIREITO ──
  { nome: "GPT – Direito do Trabalho: Médico do Trabalho", categoria: "Áreas do Direito", descricao: "Insira os dados do processo para construir uma defesa convincente que afaste a relação entre a doença e o trabalho.", url: "https://chatgpt.com/g/g-XCjRDaFZL-gpt-direito-do-trabalho-medico-do-trabalho" },
  { nome: "GPT – Consulta de Direito Empresarial", categoria: "Áreas do Direito", descricao: "Insira os detalhes da consulta e receba estratégias, doutrinas, jurisprudência, legislação e próximos passos.", url: "https://chatgpt.com/g/g-YqGF2p7pg-gpt-consulta-de-direito-empresarial" },
  { nome: "GPT Direito Digital – Matriz de Risco de Privacidade e Proteção de Dados", categoria: "Áreas do Direito", descricao: "Analisa o material de auditoria e cria a matriz de risco identificando probabilidade e impacto.", url: "https://chatgpt.com/g/g-9xc0UPlXC-direito-digital-matriz-risco-priv-e-prot-dados" },
  { nome: "GPT Direito Digital – Criação da Política de Privacidade de Dados", categoria: "Áreas do Direito", descricao: "Insira os detalhes e receba uma política de privacidade completa e alinhada com a LGPD.", url: "https://chatgpt.com/g/g-kSnmIFOYb-gpt-criacao-da-politica-de-privacidade-de-dados" },
  { nome: "GPT Direito Digital – Criação do Termo de Confidencialidade", categoria: "Áreas do Direito", descricao: "Insira o contexto e receba um Termo de confidencialidade amparado na LGPD, Código Civil e CPC.", url: "https://chatgpt.com/g/g-KwvC0x9LC-gpt-criacao-do-termo-de-confidencialidade" },
  { nome: "GPT Compliance – Elaboração do Código de Conduta", categoria: "Áreas do Direito", descricao: "Insira o contexto da empresa e receba uma minuta de Código de Conduta robusto e de linguagem consultiva.", url: "https://chatgpt.com/g/g-qyGnhtFFj-gpt-compliance-elaboracao-do-codigo-de-conduta" },
  { nome: "GPT Compliance – Respostas sobre a Política", categoria: "Áreas do Direito", descricao: "Escreva sua dúvida sobre a política de compliance e receba resposta com indicação da seção específica relevante.", url: "https://chatgpt.com/g/g-fhVfnUgy9-gpt-compliance-respostas-sobre-a-politica" },
  { nome: "GPT – Quais Normas de Compliance são Aplicáveis?", categoria: "Áreas do Direito", descricao: "Escreva ou cole o texto da consulta e receba as normas brasileiras e internacionais de compliance aplicáveis.", url: "https://chatgpt.com/g/g-GYfi8o88F-gpt-quais-normas-de-compliance-sao-aplicaveis" },
  { nome: "GPT – Especialista em Direito Militar", categoria: "Áreas do Direito", descricao: "Insira o tema ou fatos e receba doutrinas, legislação, códigos jurídicos e jurisprudência de Direito Militar.", url: "https://chatgpt.com/g/g-n8OnKL8b2-gpt-especialista-em-direito-militar" },
  { nome: "Recomendações OAB para Uso de IA na Advocacia", categoria: "Áreas do Direito", descricao: "Auxilia no entendimento das Recomendações da OAB Federal para uso de IA e criação de uma política para escritórios.", url: "https://chatgpt.com/g/g-6733967010c08190a489f94248f4837f-recomendacoes-oab-para-uso-de-ia-na-advocacia" },

  // ── SEGURANÇA PÚBLICA ──
  { nome: "GPT – Relatórios Policiais", categoria: "Segurança Pública", descricao: "Assistente para criação de Relatórios Finais e Parciais, apoiando Investigadores, Escrivães, Peritos e Delegados.", url: "https://chatgpt.com/g/g-frdnG7xDE-gpt-relatorios-policiais" },
  { nome: "GPT – Oitivas e Interrogatórios Policiais", categoria: "Segurança Pública", descricao: "Cria a minuta de um Termo de Declaração, Depoimento ou Interrogatório para profissionais da área policial.", url: "https://chatgpt.com/g/g-5Mr9PT9Cl-gpt-oitivas-e-interrogatorios-policiais" },
  { nome: "GPT – Análise de Ocorrências Policiais", categoria: "Segurança Pública", descricao: "Assistente para análises avançadas de ocorrências policiais, sugestão de linhas de investigação e diligências.", url: "https://chatgpt.com/g/g-lo0go4fSS-gpt-analise-de-ocorrencias-policiais" },

  // ── OTIMIZAÇÃO PARA IA DO JUDICIÁRIO ──
  { nome: "João – Simulador da MARIA (IA do STF)", categoria: "Otimização para IA do Judiciário", descricao: "Simula a análise feita pela MARIA (IA do STF) em petições. Extrai informações principais, gera relatório e propõe melhorias.", url: "https://chatgpt.com/g/g-6761a0c4f7e08191bc40b4b663ff5fe7-joao-namorado-da-maria-do-stf" },

  // ── TRANSCRIÇÃO DE ÁUDIO ──
  { nome: "Transcreve-AI – Transcrição de Áudios e Vídeos", categoria: "Transcrição de Áudio", descricao: "Transcrição/degravação de áudios e vídeos diretamente no WhatsApp, com identificação de participantes em audiências.", url: "https://transcreve-ai.com/" },

  // ── CRIAÇÃO DE PROMPTS (nativos) ──
  { nome: "GPT – Criador de Prompts Jurídicos (Engenharia de Contexto)", categoria: "Criação de Prompts", nativo: true, descricao: "Cria prompts jurídicos avançados com engenharia de contexto: papel, objetivo, restrições, formato de saída e exemplos. Diga a tarefa desejada." },
  { nome: "GPT – Gerador e Aprimorador de Prompts Jurídicos", categoria: "Criação de Prompts", nativo: true, descricao: "Revisa e aprimora um prompt jurídico existente, corrigindo ambiguidades e reforçando restrições e formato. Cole o prompt atual." },
  { nome: "Imersão – Criador de Prompts Jurídicos Avançados", categoria: "Criação de Prompts", nativo: true, descricao: "Conduz uma imersão guiada por perguntas até produzir um prompt jurídico sob medida, refinado iterativamente. Responda às perguntas." },

  // ── DIREITO CIVIL (nativos) ──
  { nome: "Oráculo Jurídico – Direito Civil", categoria: "Direito Civil", nativo: true, descricao: "Consultor de Direito Civil: obrigações, contratos, responsabilidade civil, reais, família e sucessões, com base no Código Civil. Descreva o caso." },

  // ── DIREITO PENAL (nativos) ──
  { nome: "GPT Penal – Dosimetria da Pena", categoria: "Direito Penal", nativo: true, descricao: "Calcula a dosimetria trifásica da pena (art. 68 CP): pena-base, agravantes/atenuantes e causas de aumento/diminuição. Informe o tipo penal e as circunstâncias." },

  // ── DIREITO TRIBUTÁRIO (nativos) ──
  { nome: "GPT Tributário – Análise de Execução Fiscal", categoria: "Direito Tributário", nativo: true, descricao: "Analisa a CDA e a execução fiscal: requisitos, prescrição, exceção de pré-executoricidade e embargos. Anexe a CDA e a petição inicial." },
  { nome: "GPT Tributário – Despacho de Resposta à Auditoria Tributária", categoria: "Direito Tributário", nativo: true, descricao: "Elabora impugnação/defesa a auto de infração ou intimação fiscal, fundamentada no CTN e na legislação tributária. Anexe o auto de infração." },
  { nome: "GPT Tributário – Parecer em Execução Fiscal", categoria: "Direito Tributário", nativo: true, descricao: "Parecer sobre a viabilidade da defesa em execução fiscal, com análise de riscos e recomendação estratégica. Anexe os autos." },

  // ── DIREITO DO TRABALHO (nativos) ──
  { nome: "GPT Trabalhista – Manifestação em Execução Trabalhista", categoria: "Direito do Trabalho", nativo: true, descricao: "Redige manifestação/impugnação na execução trabalhista: cálculos de liquidação, penhora e embargos à execução. Anexe a conta de liquidação." },
  { nome: "GPT Trabalhista – Parecer em Direito do Trabalho", categoria: "Direito do Trabalho", nativo: true, descricao: "Parecer sobre vínculo, verbas rescisórias, jornada, terceirização e riscos de passivo trabalhista. Descreva a situação." },

  // ── CRIAÇÃO DE PEÇAS JURÍDICAS (nativos) ──
  { nome: "GPT – Petição Inicial de Mandado de Segurança", categoria: "Criação de Peças Jurídicas", nativo: true, descricao: "Redige inicial de Mandado de Segurança individual: autoridade coatora, direito líquido e certo, liminar e pedidos. Informe o ato coator." },
  { nome: "GPT – Mandado de Segurança no Juizado Especial", categoria: "Criação de Peças Jurídicas", nativo: true, descricao: "Inicial de MS no âmbito dos Juizados Especiais, adaptada ao rito e à competência. Informe o ato e o juizado." },
  { nome: "GPT – Petição Inicial de Ação de Busca e Apreensão", categoria: "Criação de Peças Jurídicas", nativo: true, descricao: "Inicial de busca e apreensão em alienação fiduciária (DL 911/69): mora, liminar e consolidação da propriedade. Informe o contrato e a mora." },
  { nome: "GPT – Petição de Prorrogação de Prazo Processual", categoria: "Criação de Peças Jurídicas", nativo: true, descricao: "Requerimento fundamentado de prorrogação/devolução de prazo, com base legal e justificativa. Informe o prazo e o motivo." },
  { nome: "GPT – Petição Inicial de Justiça Gratuita (Pessoa Jurídica)", categoria: "Criação de Peças Jurídicas", nativo: true, descricao: "Pedido de gratuidade de justiça para pessoa jurídica, com a prova de insuficiência exigida pelo STJ. Informe a situação financeira." },
  { nome: "GPT – Petição de Destacamento de Honorários Contratuais", categoria: "Criação de Peças Jurídicas", nativo: true, descricao: "Petição de destaque/reserva de honorários advocatícios contratuais sobre o crédito (art. 22, §4º, EAOAB). Anexe o contrato de honorários." },
  { nome: "GPT – Petição de Habeas Corpus (Advocacia)", categoria: "Criação de Peças Jurídicas", nativo: true, descricao: "Impetração de Habeas Corpus pela defesa: constrangimento ilegal, liminar e ordem. Descreva a coação e o paciente." },
  { nome: "GPT – Procuração Pública ou Particular", categoria: "Criação de Peças Jurídicas", nativo: true, descricao: "Gera procuração ad judicia e/ou ad negotia, com poderes gerais e especiais conforme a finalidade. Informe outorgante, outorgado e finalidade." },
  { nome: "GPT – Contrarrazões ao Recurso de Apelação", categoria: "Criação de Peças Jurídicas", nativo: true, descricao: "Redige contrarrazões à apelação da parte contrária, refutando cada fundamento e pedindo a manutenção da sentença. Anexe a apelação e a sentença." },

  // ── EXTRAÇÃO DE DADOS (nativos) ──
  { nome: "GPT – Resumo do Processo (Metodologia FIRAC)", categoria: "Extração de Dados", nativo: true, descricao: "Resume o processo pela metodologia FIRAC: Fatos, Issue (questão), Regra, Análise e Conclusão. Anexe os autos." },
  { nome: "GPT – Checklist de Conferência de Parecer Jurídico", categoria: "Extração de Dados", nativo: true, descricao: "Confere um parecer jurídico por checklist: completude, fundamentação, riscos, conclusão e revisão formal. Anexe o parecer." },

  // ── ESTRATÉGIA DO CASO (nativo) ──
  { nome: "GPT – Definição das Teses Jurídicas Estratégicas", categoria: "Estratégia do Caso", nativo: true, descricao: "Define e prioriza as teses jurídicas mais fortes para o caso, com fundamento e ordem de alegação. Descreva os fatos e o objetivo." },

  // ── MARKETING JURÍDICO (nativos) ──
  { nome: "GPT – Especialista em Prospecção Jurídica", categoria: "Marketing Jurídico", nativo: true, descricao: "Cria estratégias de prospecção de clientes para advogados, respeitando o Provimento 205/2021 da OAB. Informe a área e o público." },
  { nome: "GPT – Contrato de Serviços Advocatícios", categoria: "Marketing Jurídico", nativo: true, descricao: "Gera contrato de prestação de serviços advocatícios e honorários, conforme o EAOAB. Informe as partes, o objeto e os honorários." },

  // ── NEGOCIAÇÃO E CONFLITOS (nativos) ──
  { nome: "GPT – Negociador Jurídico Avançado", categoria: "Negociação e Conflitos", nativo: true, descricao: "Conduz estratégias de negociação e acordos com técnicas avançadas (BATNA, ancoragem, interesses). Descreva o conflito e o objetivo." },
  { nome: "GPT – Rebater Argumentos com Precisão", categoria: "Negociação e Conflitos", nativo: true, descricao: "Refuta argumentos da parte contrária ponto a ponto, com lógica e fundamento jurídico. Cole o argumento a rebater." },

  // ── ATENDIMENTO AO CLIENTE (nativo) ──
  { nome: "GPT – Traduzir Documentos Jurídicos para Clientes", categoria: "Atendimento ao Cliente", nativo: true, descricao: "Reescreve peças e decisões em linguagem clara para o cliente leigo, sem perder a precisão. Anexe o documento jurídico." },

  // ── REVISÃO E MELHORIA DE TEXTOS (nativo) ──
  { nome: "GPT – Otimizador Retórico Avançado", categoria: "Revisão e Melhoria de Textos", nativo: true, descricao: "Eleva a força persuasiva do texto jurídico com técnicas retóricas (ethos, pathos, logos) sem comprometer a técnica. Cole o texto." },
];

export const CATEGORIAS = [
  "Todas",
  "Poder Judiciário",
  "Criação de Peças Jurídicas",
  "Revisão de Peças Jurídicas",
  "Extração de Dados",
  "Revisão e Melhoria de Textos",
  "Estratégia do Caso",
  "Jurisprudência",
  "Atendimento ao Cliente",
  "Audiência e Julgamento",
  "Marketing Jurídico",
  "Contratos",
  "Negociação e Conflitos",
  "Criação de Prompts",
  "Direito Civil",
  "Direito Penal",
  "Direito Tributário",
  "Direito do Trabalho",
  "Áreas do Direito",
  "Segurança Pública",
  "Otimização para IA do Judiciário",
  "Transcrição de Áudio",
];

// Cor de accent por categoria (dentro da paleta do ImobPro: ciano/verde/âmbar + tons)
export const CAT_COR = {
  "Poder Judiciário": "#12e7ff",
  "Criação de Peças Jurídicas": "#00ff6a",
  "Revisão de Peças Jurídicas": "#f59e0b",
  "Extração de Dados": "#7dd3fc",
  "Revisão e Melhoria de Textos": "#34d399",
  "Estratégia do Caso": "#12e7ff",
  "Jurisprudência": "#00ff6a",
  "Atendimento ao Cliente": "#f59e0b",
  "Audiência e Julgamento": "#7dd3fc",
  "Marketing Jurídico": "#34d399",
  "Contratos": "#12e7ff",
  "Negociação e Conflitos": "#00ff6a",
  "Criação de Prompts": "#00ff6a",
  "Direito Civil": "#7dd3fc",
  "Direito Penal": "#34d399",
  "Direito Tributário": "#f59e0b",
  "Direito do Trabalho": "#12e7ff",
  "Áreas do Direito": "#f59e0b",
  "Segurança Pública": "#7dd3fc",
  "Otimização para IA do Judiciário": "#34d399",
  "Transcrição de Áudio": "#12e7ff",
};
