// =====================================================
// CNV 2025 - MÓDULO DE ENQUETES E QUIZ - UTILITÁRIOS
// =====================================================

// Sempre usar window.supabase explicitamente
const sb = window.supabase;

// =====================================================
// ENQUETES
// =====================================================

// Criar enquete simples (param palestraId mantido só p/ compatibilidade, mas ignorado)
async function criarEnqueteSimples(palestraId, titulo, opcoes) {
  try {
    const payload = {
      titulo: titulo,
      tipo: 'multipla_escolha',
      opcoes: { opcoes: opcoes }, // ["Opção 1", "Opção 2", ...]
      ativa: true
    };

    const { data, error } = await sb
      .from('cnv25_enquetes')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao criar enquete:', error);
    return null;
  }
}

// Votar em enquete (usado pelo participante)
async function votarEnquete(enqueteId, deviceIdHash, opcaoIndex) {
  try {
    const payload = {
      enquete_id: enqueteId,
      device_id_hash: deviceIdHash,
      resposta: {
        valor: opcaoIndex,      // compatível com lógica antiga / views
        opcaoIndex: opcaoIndex  // compatível com código novo
      }
    };

    const { data, error } = await sb
      .from('cnv25_enquete_respostas')
      .insert([payload])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { error: 'Você já votou nesta enquete' };
      }
      console.error('Erro ao votar na enquete:', error);
      return { error: 'Erro ao registrar voto' };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Erro ao votar na enquete:', error);
    return { error: 'Erro ao registrar voto' };
  }
}

// Obter resultados da enquete (agregado)
async function obterResultadosEnquete(enqueteId) {
  try {
    const { data, error } = await sb
      .from('cnv25_enquete_respostas')
      .select('resposta')
      .eq('enquete_id', enqueteId);

    if (error) throw error;

    const contagem = {};
    (data || []).forEach(r => {
      const valor = r.resposta?.valor ?? 0;
      contagem[valor] = (contagem[valor] || 0) + 1;
    });

    return {
      total: (data || []).length,
      distribuicao: contagem
    };
  } catch (error) {
    console.error('Erro ao buscar resultados da enquete:', error);
    return null;
  }
}

// Obter enquete ativa (global, não mais por palestra)
async function obterEnqueteAtiva() {
  try {
    const { data, error } = await sb
      .from('cnv25_enquetes')
      .select('*')
      .eq('ativa', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      // quando não há linhas, maybeSingle pode vir com error "PGRST116"
      console.warn('obterEnqueteAtiva:', error);
      return null;
    }
    return data || null;
  } catch (error) {
    console.error('Erro em obterEnqueteAtiva:', error);
    return null;
  }
}

// Mantidos por compatibilidade: agora só ligam/desligam flag no controle global
async function ativarEnquete(palestraId, enqueteId) {
  try {
    const { error } = await sb
      .from('cnv25_broadcast_controle')
      .update({
        modo_global: 'enquete',
        enquete_ativa: enqueteId,
        mostrar_resultado_enquete: false,
        pergunta_exibida: null,
        quiz_ativo: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Erro ao ativar enquete (broadcast):', error);
    return false;
  }
}

async function desativarEnquete(palestraId) {
  try {
    const { error } = await sb
      .from('cnv25_broadcast_controle')
      .update({
        modo_global: null,
        enquete_ativa: null,
        mostrar_resultado_enquete: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Erro ao desativar enquete (broadcast):', error);
    return false;
  }
}

// Encerrar enquete (marca no banco; broadcast é controlado em outro lugar)
async function encerrarEnquete(enqueteId) {
  try {
    const { data, error } = await sb
      .from('cnv25_enquetes')
      .update({
        ativa: false,
        encerrada_em: new Date().toISOString()
      })
      .eq('id', enqueteId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao encerrar enquete:', error);
    return null;
  }
}

// Listar enquetes (param palestraId mantido só pra não quebrar chamadas antigas)
async function listarEnquetesPalestra(palestraId) {
  try {
    const { data, error } = await sb
      .from('cnv25_enquetes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erro ao listar enquetes:', error);
    return [];
  }
}

// =====================================================
// QUIZ
// =====================================================

// Criar novo quiz (palestraId ignorado — quiz agora é global)
async function criarQuiz(palestraId, titulo, descricao) {
  try {
    const payload = {
      titulo,
      descricao,
      status: 'preparando',
      total_perguntas: 0
    };

    const { data, error } = await sb
      .from('cnv25_quiz')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao criar quiz:', error);
    return null;
  }
}

// Adicionar pergunta ao quiz
async function adicionarPerguntaQuiz(quizId, ordem, pergunta, opcoes, respostaCorreta) {
  try {
    const { data, error } = await sb
      .from('cnv25_quiz_perguntas')
      .insert([{
        quiz_id: quizId,
        ordem: ordem,
        pergunta: pergunta,
        opcoes: opcoes,          // ["A", "B", "C", "D"]
        resposta_correta: respostaCorreta
      }])
      .select()
      .single();

    if (error) throw error;

    // Atualiza total_perguntas
    await sb
      .from('cnv25_quiz')
      .update({ total_perguntas: ordem })
      .eq('id', quizId);

    return data;
  } catch (error) {
    console.error('Erro ao adicionar pergunta ao quiz:', error);
    return null;
  }
}

// Iniciar quiz
async function iniciarQuiz(quizId) {
  try {
    const { data, error } = await sb
      .from('cnv25_quiz')
      .update({
        status: 'iniciado',
        iniciado_em: new Date().toISOString(),
        pergunta_atual: 1
      })
      .eq('id', quizId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao iniciar quiz:', error);
    return null;
  }
}

// Avançar para próxima pergunta
async function avancarPerguntaQuiz(quizId, proximaPergunta) {
  try {
    const { data, error } = await sb
      .from('cnv25_quiz')
      .update({
        status: 'em_andamento',
        pergunta_atual: proximaPergunta
      })
      .eq('id', quizId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao avançar pergunta:', error);
    return null;
  }
}

// Revelar resposta correta (marca campo revelada=true)
async function revelarRespostaQuiz(perguntaId) {
  try {
    const { data, error } = await sb
      .from('cnv25_quiz_perguntas')
      .update({ revelada: true })
      .eq('id', perguntaId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao revelar resposta:', error);
    return null;
  }
}

// Participante responde pergunta do quiz
// Pontos: 1000 - tempoResposta (mínimo 100) se acertou
async function responderPerguntaQuiz(perguntaId, deviceIdHash, respostaEscolhida, tempoResposta) {
  // Busca pergunta pra saber qual é a correta
  const { data: pergunta, error: errorPerg } = await sb
    .from('cnv25_quiz_perguntas')
    .select('resposta_correta')
    .eq('id', perguntaId)
    .single();

  if (errorPerg || !pergunta) {
    console.error('Pergunta não encontrada para responderQuiz:', errorPerg);
    return { error: 'Pergunta não encontrada' };
  }

  const correta = (respostaEscolhida === pergunta.resposta_correta);

  const { data, error } = await sb
    .from('cnv25_quiz_respostas')
    .insert([{
      quiz_pergunta_id: perguntaId,
      device_id_hash: deviceIdHash,
      resposta_escolhida: respostaEscolhida,
      tempo_resposta: tempoResposta,
      correta: correta
    }])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return { error: 'Você já respondeu esta pergunta' };
    }
    console.error('Erro ao registrar resposta do quiz:', error);
    return { error: 'Erro ao registrar resposta' };
  }

  let pontos = 0;
  if (correta) {
    pontos = Math.max(1000 - (tempoResposta || 0), 100);
  }

  return { success: true, data, correta, pontos };
}

// Estatísticas da pergunta do quiz
async function obterStatsQuizPergunta(perguntaId) {
  try {
    const { data: stats, error: errorStats } = await sb
      .from('cnv25_quiz_stats')
      .select('*')
      .eq('pergunta_id', perguntaId)
      .single();

    if (errorStats) throw errorStats;

    const { data: distribuicao, error: errorDist } = await sb
      .rpc('cnv25_quiz_distribuicao', { pergunta_uuid: perguntaId });

    if (errorDist) {
      console.error('Erro ao buscar distribuição de respostas:', errorDist);
    }

    return {
      ...stats,
      distribuicao_respostas: distribuicao || []
    };
  } catch (error) {
    console.error('Erro ao buscar stats da pergunta do quiz:', error);
    return null;
  }
}

// Obter quiz ativo (global, não mais por palestra)
async function obterQuizAtivo(palestraId) {
  try {
    const { data, error } = await sb
      .from('cnv25_quiz')
      .select('*')
      .in('status', ['iniciado', 'em_andamento'])
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('obterQuizAtivo:', error);
      return null;
    }
    return data || null;
  } catch (error) {
    console.error('Erro em obterQuizAtivo:', error);
    return null;
  }
}

// Obter pergunta atual do quiz
async function obterPerguntaAtualQuiz(quizId, numeroPergunta) {
  try {
    const { data, error } = await sb
      .from('cnv25_quiz_perguntas')
      .select('*')
      .eq('quiz_id', quizId)
      .eq('ordem', numeroPergunta)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao buscar pergunta atual do quiz:', error);
    return null;
  }
}

// Finalizar quiz
async function finalizarQuiz(quizId) {
  try {
    const { data, error } = await sb
      .from('cnv25_quiz')
      .update({
        status: 'finalizado',
        finalizado_em: new Date().toISOString()
      })
      .eq('id', quizId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao finalizar quiz:', error);
    return null;
  }
}

// Ranking via função RPC
async function obterRankingQuiz(quizId) {
  try {
    const { data, error } = await sb
      .rpc('cnv25_quiz_ranking', { quiz_uuid: quizId });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erro ao buscar ranking do quiz:', error);
    return [];
  }
}

// Todas as perguntas de um quiz
async function obterPerguntasQuiz(quizId) {
  try {
    const { data, error } = await sb
      .from('cnv25_quiz_perguntas')
      .select('*')
      .eq('quiz_id', quizId)
      .order('ordem', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erro ao buscar perguntas do quiz:', error);
    return [];
  }
}

// Listar quizzes (param palestraId mantido só p/ compatibilidade, mas ignorado)
async function listarQuizzesPalestra(palestraId) {
  try {
    const { data, error } = await sb
      .from('cnv25_quiz')
      .select('*')
      .order('criado_em', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erro ao listar quizzes:', error);
    return [];
  }
}

// =====================================================
// VERIFICAÇÕES
// =====================================================

// Verificar se já votou na enquete
async function verificouVotouEnquete(enqueteId, deviceIdHash) {
  const { count, error } = await sb
    .from('cnv25_enquete_respostas')
    .select('*', { count: 'exact', head: true })
    .eq('enquete_id', enqueteId)
    .eq('device_id_hash', deviceIdHash);

  if (error) {
    console.error('Erro em verificouVotouEnquete:', error);
    return false;
  }
  return (count || 0) > 0;
}

// Verificar se já respondeu pergunta do quiz
async function verificouRespondeuQuiz(perguntaId, deviceIdHash) {
  const { count, error } = await sb
    .from('cnv25_quiz_respostas')
    .select('*', { count: 'exact', head: true })
    .eq('quiz_pergunta_id', perguntaId)
    .eq('device_id_hash', deviceIdHash);

  if (error) {
    console.error('Erro em verificouRespondeuQuiz:', error);
    return false;
  }
  return (count || 0) > 0;
}

// =====================================================
// EXPORTAR CSV - ENQUETES
// =====================================================
async function exportarEnqueteCSV(enqueteId) {
  const { data: enquete } = await sb
    .from('cnv25_enquetes')
    .select('titulo')
    .eq('id', enqueteId)
    .single();

  const { data: respostas } = await sb
    .from('cnv25_enquete_respostas')
    .select('*')
    .eq('enquete_id', enqueteId)
    .order('created_at');

  if (!respostas || respostas.length === 0) {
    return null;
  }

  const csv = [
    ['Data/Hora', 'Resposta', 'Device Hash'].join(','),
    ...respostas.map(r => [
      new Date(r.created_at).toLocaleString('pt-BR'),
      r.resposta?.valor,
      (r.device_id_hash || '').substring(0, 8)
    ].map(c => `"${c}"`).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `enquete_${(enquete?.titulo || 'export').replace(/"/g, '')}_${Date.now()}.csv`;
  link.click();

  return true;
}

// =====================================================
// EXPORTAR CSV - QUIZ
// =====================================================
async function exportarQuizCSV(quizId) {
  const { data: quiz } = await sb
    .from('cnv25_quiz')
    .select('titulo')
    .eq('id', quizId)
    .single();

  const ranking = await obterRankingQuiz(quizId);

  if (!ranking || ranking.length === 0) {
    return null;
  }

  const csv = [
    ['Posição', 'Device Hash', 'Acertos', 'Pontos', 'Tempo Médio (s)'].join(','),
    ...ranking.map(r => [
      r.ranking,
      (r.device_id_hash || '').substring(0, 8),
      r.total_acertos,
      r.pontos_totais,
      r.tempo_medio_resposta
    ].map(c => `"${c}"`).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `quiz_${(quiz?.titulo || 'export').replace(/"/g, '')}_${Date.now()}.csv`;
  link.click();

  return true;
}

console.log('✅ Módulo de Enquetes e Quiz (utils) carregado');
