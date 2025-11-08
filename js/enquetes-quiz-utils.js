// =====================================================
// CNV 2025 - MÓDULO DE ENQUETES E QUIZ - COMPLETO
// =====================================================

// =====================================================
// ENQUETES
// =====================================================

// Criar enquete simples
async function criarEnqueteSimples(palestraId, titulo, opcoes) {
  const { data, error } = await window.supabase
    .from('cnv25_enquetes')
    .insert([{
      palestra_id: palestraId,
      titulo: titulo,
      tipo: 'multipla_escolha',
      modo: 'enquete',
      opcoes: { opcoes: opcoes }, // ["Opção 1", "Opção 2", ...]
      ativa: true
    }])
    .select()
    .single();
  
  if (error) {
    console.error('Erro ao criar enquete:', error);
    return null;
  }
  
  return data;
}

// Votar em enquete
async function votarEnquete(enqueteId, deviceIdHash, opcaoIndex) {
  const { data, error} = await window.supabase
    .from('cnv25_enquete_respostas')
    .insert([{
      enquete_id: enqueteId,
      device_id_hash: deviceIdHash,
      resposta: { valor: opcaoIndex }
    }])
    .select()
    .single();
  
  if (error) {
    if (error.code === '23505') {
      return { error: 'Você já votou nesta enquete' };
    }
    console.error('Erro ao votar:', error);
    return { error: 'Erro ao registrar voto' };
  }
  
  return { success: true, data };
}

// Obter resultados da enquete em tempo real
async function obterResultadosEnquete(enqueteId) {
  const { data, error } = await window.supabase
    .from('cnv25_enquete_respostas')
    .select('resposta')
    .eq('enquete_id', enqueteId);
  
  if (error) {
    console.error('Erro ao buscar resultados:', error);
    return null;
  }
  
  // Contar votos por opção
  const contagem = {};
  data.forEach(r => {
    const valor = r.resposta.valor;
    contagem[valor] = (contagem[valor] || 0) + 1;
  });
  
  return {
    total: data.length,
    distribuicao: contagem
  };
}

// Obter enquete ativa da palestra
async function obterEnqueteAtiva(palestraId) {
  const { data, error } = await window.supabase
    .from('cnv25_enquetes')
    .select('*')
    .eq('palestra_id', palestraId)
    .eq('ativa', true)
    .eq('modo', 'enquete')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Erro ao buscar enquete:', error);
    return null;
  }
  
  return data || null;
}

// Ativar enquete (atualizar controle da palestra)
async function ativarEnquete(palestraId, enqueteId) {
  const { data, error } = await window.supabase
    .from('cnv25_palestra_controle')
    .update({ enquete_ativa: enqueteId })
    .eq('palestra_id', palestraId)
    .select()
    .single();
  
  if (error) {
    console.error('Erro ao ativar enquete:', error);
    return null;
  }
  
  return data;
}

// Desativar enquete
async function desativarEnquete(palestraId) {
  const { data, error } = await window.supabase
    .from('cnv25_palestra_controle')
    .update({ enquete_ativa: null })
    .eq('palestra_id', palestraId)
    .select()
    .single();
  
  if (error) {
    console.error('Erro ao desativar enquete:', error);
    return null;
  }
  
  return data;
}

// Encerrar enquete
async function encerrarEnquete(enqueteId) {
  const { data, error } = await window.supabase
    .from('cnv25_enquetes')
    .update({
      ativa: false,
      encerrada_em: new Date().toISOString()
    })
    .eq('id', enqueteId)
    .select()
    .single();
  
  if (error) {
    console.error('Erro ao encerrar enquete:', error);
    return null;
  }
  
  return data;
}

// Listar enquetes da palestra
async function listarEnquetesPalestra(palestraId) {
  const { data, error } = await window.supabase
    .from('cnv25_enquetes')
    .select('*')
    .eq('palestra_id', palestraId)
    .eq('modo', 'enquete')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Erro ao listar enquetes:', error);
    return [];
  }
  
  return data || [];
}

// =====================================================
// QUIZ
// =====================================================

// Criar novo quiz
async function criarQuiz(palestraId, titulo, descricao) {
  const { data, error } = await window.supabase
    .from('cnv25_quiz')
    .insert([{
      palestra_id: palestraId,
      titulo: titulo,
      descricao: descricao,
      status: 'preparando'
    }])
    .select()
    .single();
  
  if (error) {
    console.error('Erro ao criar quiz:', error);
    return null;
  }
  
  return data;
}

// Adicionar pergunta ao quiz
async function adicionarPerguntaQuiz(quizId, ordem, pergunta, opcoes, respostaCorreta) {
  const { data, error } = await window.supabase
    .from('cnv25_quiz_perguntas')
    .insert([{
      quiz_id: quizId,
      ordem: ordem,
      pergunta: pergunta,
      opcoes: opcoes, // ["Opção A", "Opção B", "Opção C", "Opção D"]
      resposta_correta: respostaCorreta // 0, 1, 2 ou 3
    }])
    .select()
    .single();
  
  if (error) {
    console.error('Erro ao adicionar pergunta:', error);
    return null;
  }
  
  // Atualizar total de perguntas no quiz
  await window.supabase
    .from('cnv25_quiz')
    .update({ total_perguntas: ordem })
    .eq('id', quizId);
  
  return data;
}

// Iniciar quiz
async function iniciarQuiz(quizId) {
  const { data, error } = await window.supabase
    .from('cnv25_quiz')
    .update({
      status: 'iniciado',
      iniciado_em: new Date().toISOString(),
      pergunta_atual: 1
    })
    .eq('id', quizId)
    .select()
    .single();
  
  if (error) {
    console.error('Erro ao iniciar quiz:', error);
    return null;
  }
  
  return data;
}

// Avançar para próxima pergunta
async function avancarPerguntaQuiz(quizId, proximaPergunta) {
  const { data, error } = await window.supabase
    .from('cnv25_quiz')
    .update({
      status: 'em_andamento',
      pergunta_atual: proximaPergunta
    })
    .eq('id', quizId)
    .select()
    .single();
  
  if (error) {
    console.error('Erro ao avançar pergunta:', error);
    return null;
  }
  
  return data;
}

// Revelar resposta correta
async function revelarRespostaQuiz(perguntaId) {
  const { data, error } = await window.supabase
    .from('cnv25_quiz_perguntas')
    .update({ revelada: true })
    .eq('id', perguntaId)
    .select()
    .single();
  
  if (error) {
    console.error('Erro ao revelar resposta:', error);
    return null;
  }
  
  return data;
}

// Participante responder pergunta do quiz
// Pontuação: 1000 pontos base - tempo_resposta (quanto mais rápido, mais pontos)
// Mínimo de 100 pontos por resposta correta
async function responderPerguntaQuiz(perguntaId, deviceIdHash, respostaEscolhida, tempoResposta) {
  // Buscar pergunta para verificar se está correta
  const { data: pergunta } = await window.supabase
    .from('cnv25_quiz_perguntas')
    .select('resposta_correta')
    .eq('id', perguntaId)
    .single();
  
  if (!pergunta) {
    return { error: 'Pergunta não encontrada' };
  }
  
  const correta = (respostaEscolhida === pergunta.resposta_correta);
  
  const { data, error } = await window.supabase
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
    console.error('Erro ao responder:', error);
    return { error: 'Erro ao registrar resposta' };
  }
  
  // Calcular pontos apenas se acertou
  let pontos = 0;
  if (correta) {
    pontos = Math.max(1000 - (tempoResposta || 0), 100);
  }
  
  return { success: true, data, correta, pontos };
}

// Obter estatísticas da pergunta do quiz
async function obterStatsQuizPergunta(perguntaId) {
  // Buscar stats gerais da view
  const { data: stats, error: errorStats } = await window.supabase
    .from('cnv25_quiz_stats')
    .select('*')
    .eq('pergunta_id', perguntaId)
    .single();
  
  if (errorStats) {
    console.error('Erro ao buscar stats:', errorStats);
    return null;
  }
  
  // Buscar distribuição de respostas usando a função RPC
  const { data: distribuicao, error: errorDist } = await window.supabase
    .rpc('cnv25_quiz_distribuicao', { pergunta_uuid: perguntaId });
  
  if (errorDist) {
    console.error('Erro ao buscar distribuição:', errorDist);
  }
  
  return {
    ...stats,
    distribuicao_respostas: distribuicao || []
  };
}

// Obter quiz ativo
// ✅ Versão robusta: sem ORDER para evitar 400/42703
async function obterQuizAtivo(palestraId) {
  if (!palestraId) return null;

  const { data, error } = await supabase
    .from('cnv25_quiz')
    .select('*')
    .eq('palestra_id', palestraId)
    .in('status', ['iniciado', 'em_andamento'])
    .limit(1)
    .maybeSingle(); // não gera 406 quando não há linhas

  if (error) {
    console.warn('obterQuizAtivo (tratado como sem quiz ativo):', error);
    return null;
  }
  return data || null;
}


// Obter pergunta atual do quiz
async function obterPerguntaAtualQuiz(quizId, numeroPergunta) {
  const { data, error } = await window.supabase
    .from('cnv25_quiz_perguntas')
    .select('*')
    .eq('quiz_id', quizId)
    .eq('ordem', numeroPergunta)
    .single();
  
  if (error) {
    console.error('Erro ao buscar pergunta:', error);
    return null;
  }
  
  return data;
}

// Finalizar quiz
async function finalizarQuiz(quizId) {
  const { data, error } = await window.supabase
    .from('cnv25_quiz')
    .update({
      status: 'finalizado',
      finalizado_em: new Date().toISOString()
    })
    .eq('id', quizId)
    .select()
    .single();
  
  if (error) {
    console.error('Erro ao finalizar quiz:', error);
    return null;
  }
  
  return data;
}

// Obter ranking do quiz usando a função RPC
async function obterRankingQuiz(quizId) {
  const { data, error } = await window.supabase
    .rpc('cnv25_quiz_ranking', { quiz_uuid: quizId });
  
  if (error) {
    console.error('Erro ao buscar ranking:', error);
    return [];
  }
  
  return data || [];
}

// Obter todas as perguntas de um quiz
async function obterPerguntasQuiz(quizId) {
  const { data, error } = await window.supabase
    .from('cnv25_quiz_perguntas')
    .select('*')
    .eq('quiz_id', quizId)
    .order('ordem', { ascending: true });
  
  if (error) {
    console.error('Erro ao buscar perguntas:', error);
    return [];
  }
  
  return data || [];
}

// Listar quizzes da palestra
async function listarQuizzesPalestra(palestraId) {
  const { data, error } = await window.supabase
    .from('cnv25_quiz')
    .select('*')
    .eq('palestra_id', palestraId)
    .order('criado_em', { ascending: false });
  
  if (error) {
    console.error('Erro ao listar quizzes:', error);
    return [];
  }
  
  return data || [];
}

// =====================================================
// VERIFICAÇÕES
// =====================================================

// Verificar se já votou na enquete
async function verificouVotouEnquete(enqueteId, deviceIdHash) {
  const { count } = await window.supabase
    .from('cnv25_enquete_respostas')
    .select('*', { count: 'exact', head: true })
    .eq('enquete_id', enqueteId)
    .eq('device_id_hash', deviceIdHash);
  
  return count > 0;
}

// Verificar se já respondeu pergunta do quiz
async function verificouRespondeuQuiz(perguntaId, deviceIdHash) {
  const { count } = await window.supabase
    .from('cnv25_quiz_respostas')
    .select('*', { count: 'exact', head: true })
    .eq('quiz_pergunta_id', perguntaId)
    .eq('device_id_hash', deviceIdHash);
  
  return count > 0;
}

// =====================================================
// EXPORTAR CSV - ENQUETES
// =====================================================
async function exportarEnqueteCSV(enqueteId) {
  const { data: enquete } = await window.supabase
    .from('cnv25_enquetes')
    .select('titulo')
    .eq('id', enqueteId)
    .single();
  
  const { data: respostas } = await window.supabase
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
      r.resposta.valor,
      r.device_id_hash.substring(0, 8)
    ].map(c => `"${c}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `enquete_${enquete?.titulo || 'export'}_${Date.now()}.csv`;
  link.click();
  
  return true;
}

// =====================================================
// EXPORTAR CSV - QUIZ
// =====================================================
async function exportarQuizCSV(quizId) {
  const { data: quiz } = await window.supabase
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
      r.device_id_hash.substring(0, 8),
      r.total_acertos,
      r.pontos_totais,
      r.tempo_medio_resposta
    ].map(c => `"${c}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `quiz_${quiz?.titulo || 'export'}_${Date.now()}.csv`;
  link.click();
  
  return true;
}

console.log('✅ Módulo de Enquetes e Quiz carregado');
