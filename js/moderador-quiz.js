// =====================================================
// MODERADOR - MÓDULO DE QUIZ
// =====================================================

const ModuloQuiz = (() => {
  // Estado local
  let quizzes = [];
  let quizAtual = null;
  let perguntaAtual = null;
  let chartQuiz = null;
  let perguntasQuiz = [];
  
  let canalQuiz = null;
  let canalQuizPerguntas = null;
  let canalQuizRespostas = null;
  let intervalStats = null;
  
  // =====================================================
  // INICIALIZAÇÃO
  // =====================================================
  
  function getStatusLabel(status) {
    switch (status) {
      case 'preparando':
      case 'nao_iniciado':
      case null:
      case undefined:
        return 'Não iniciado';
      case 'iniciado':
      case 'em_andamento':
        return 'Iniciado';
      case 'finalizado':
        return 'Finalizado';
      default:
        return status;
    }
  }
  
  async function inicializar() {
    console.log('🎮 Módulo Quiz inicializando...');
  
    await carregarQuizzes();
    configurarEventos();
  
    console.log('✅ Módulo Quiz pronto');
  }

  
  // =====================================================
  // CARREGAR QUIZZES
  // =====================================================
  
  async function carregarQuizzes() {
    try {
      // Buscar TODOS os quizzes (não filtrar por palestra)
      const { data, error } = await supabase
        .from('cnv25_quiz')
        .select('*')
        .order('criado_em', { ascending: false });
      
      if (error) throw error;
      
      quizzes = data || [];
      renderizarSelect();
      
    } catch (error) {
      console.error('Erro ao carregar quizzes:', error);
    }
  }

  async function recarregarQuizzes() {
    await carregarQuizzes();
    renderizarQuiz();
  }

  function previewPergunta(ordem) {
    if (!perguntasQuiz || perguntasQuiz.length === 0) return;
    const p = perguntasQuiz.find(q => q.ordem === ordem);
    if (!p) return;
  
    // Atualiza apenas o estado local do moderador
    perguntaAtual = p;
  
    // NÃO mexe em quizAtual.pergunta_atual
    // NÃO faz update no banco
    // NÃO chama broadcast
  
    renderizarQuiz();
  }

  
  function renderizarSelect() {
    const select = document.getElementById('quizSelect');
    
    select.innerHTML = '<option value="">Selecione um quiz...</option>';
    
    quizzes.forEach(q => {
      const option = document.createElement('option');
      option.value = q.id;
      option.textContent = `${q.titulo} (${q.total_perguntas} perguntas) - ${q.status}`;
      select.appendChild(option);
    });
  }
  
  // =====================================================
  // SELECIONAR QUIZ
  // =====================================================
  
  async function selecionarQuiz(quizId) {
    if (!quizId) {
      quizAtual = null;
      perguntaAtual = null;
      perguntasQuiz = [];
      limparQuiz();
      renderizarListaPerguntas();
      return;
    }
    
    quizAtual = quizzes.find(q => q.id === quizId);
    
    if (!quizAtual) return;
    
    await carregarPerguntaAtual();
    await carregarListaPerguntas();
    conectarRealtimeQuiz();
    renderizarQuiz();
  }

  async function verificarQuizAtivo() {
    const controle = window.ModeradorCore.state.controle;
    
    if (controle?.quiz_ativo) {
      const quiz = quizzes.find(q => q.id === controle.quiz_ativo);
      
      if (quiz) {
        quizAtual = quiz;
        document.getElementById('quizSelect').value = quiz.id;
        await carregarPerguntaAtual();
        await carregarListaPerguntas();
        conectarRealtimeQuiz();
        renderizarQuiz();
      }
    } else {
      quizAtual = null;
      perguntaAtual = null;
      perguntasQuiz = [];
      limparQuiz();
      renderizarListaPerguntas();
    }
  }
  
  async function carregarPerguntaAtual() {
    if (!quizAtual || quizAtual.pergunta_atual === 0) {
      perguntaAtual = null;
      return;
    }
    
    const { data } = await supabase
      .from('cnv25_quiz_perguntas')
      .select('*')
      .eq('quiz_id', quizAtual.id)
      .eq('ordem', quizAtual.pergunta_atual)
      .single();
    
    perguntaAtual = data;
  }
  async function carregarListaPerguntas() {
  if (!quizAtual) {
    perguntasQuiz = [];
    renderizarListaPerguntas();
    return;
  }
  
  try {
    const { data, error } = await supabase
      .from('cnv25_quiz_perguntas')
      .select('*')
      .eq('quiz_id', quizAtual.id)
      .order('ordem', { ascending: true });
    
    if (error) {
      console.error('Erro ao carregar lista de perguntas do quiz:', error);
      perguntasQuiz = [];
    } else {
      perguntasQuiz = data || [];
    }
    
    renderizarListaPerguntas();
  } catch (e) {
    console.error('Erro inesperado ao carregar lista de perguntas:', e);
    perguntasQuiz = [];
    renderizarListaPerguntas();
  }
}

function renderizarListaPerguntas() {
  const container = document.getElementById('quizListaPerguntas');
  if (!container) return;
  
  if (!quizAtual) {
    container.innerHTML = '<p class="text-gray-500 text-center py-8">Selecione um quiz acima.</p>';
    return;
  }
  
  if (!perguntasQuiz || perguntasQuiz.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhuma pergunta cadastrada para este quiz.</p>';
    return;
  }
  
  container.innerHTML = perguntasQuiz
    .map((p) => {
      const isAtual = quizAtual.pergunta_atual === p.ordem;
      const revelada = p.revelada;
      
      let statusClasses = 'bg-gray-100 border border-gray-200';
      let statusLabel = 'Não jogada';
      
      if (revelada) {
        statusClasses = 'bg-blue-50 border border-blue-400';
        statusLabel = 'Revelada';
      }
      if (isAtual) {
        statusClasses = revelada
          ? 'bg-green-50 border border-green-500'
          : 'bg-green-50 border border-green-400';
        statusLabel = revelada ? 'Atual (revelada)' : 'Atual';
      }
      
      return `
        <div 
          class="p-3 rounded-lg flex items-center justify-between gap-3 ${statusClasses}"
          onclick="window.ModuloQuiz.previewPergunta(${p.ordem})"
          style="cursor: pointer;"
        >
          <div class="flex-1 min-w-0">
            <p class="text-xs text-gray-500 mb-1">Pergunta ${p.ordem}</p>
            <p class="text-sm font-medium text-gray-800 truncate">
              ${window.ModeradorCore.esc(p.pergunta)}
            </p>
            <p class="text-xs text-gray-500 mt-1">${statusLabel}</p>
          </div>
          <div class="flex flex-col gap-1">
            <button
              type="button"
              class="px-3 py-1 text-xs rounded bg-cnv-primary text-white hover:bg-blue-700"
              onclick="event.stopPropagation(); window.ModuloQuiz.irParaPergunta(${p.ordem})"
            >
              ▶️ Play
            </button>
            <button
              type="button"
              class="px-3 py-1 text-xs rounded bg-cnv-warning text-white hover:bg-yellow-600"
              onclick="event.stopPropagation(); window.ModuloQuiz.revelarDaLista(${p.ordem})"
            >
              👁️ Revelar
            </button>
          </div>
        </div>
      `;
    })
    .join('');
}


async function irParaPergunta(ordem) {
  if (!quizAtual) return;
  if (!ordem || ordem < 1 || ordem > quizAtual.total_perguntas) return;
  
  try {
    const { error } = await supabase
      .from('cnv25_quiz')
      .update({
        status: 'em_andamento',
        pergunta_atual: ordem
      })
      .eq('id', quizAtual.id);
    
    if (error) throw error;
    
    window.ModeradorCore.mostrarNotificacao(
      `Pergunta ${ordem} enviada para o telão e participantes.`,
      'info'
    );

    // Atualiza local após mandar pro banco
    await carregarPerguntaAtual();
    await carregarListaPerguntas();
    renderizarQuiz();
  } catch (e) {
    console.error('Erro ao ir para pergunta:', e);
    alert('Erro ao exibir a pergunta selecionada.');
  }
}


async function revelarDaLista(ordem) {
  if (!quizAtual) return;
  if (!ordem || ordem < 1 || ordem > quizAtual.total_perguntas) return;
  
  try {
    // Se não for a pergunta atual, muda pra ela
    if (quizAtual.pergunta_atual !== ordem) {
      await irParaPergunta(ordem);
      await carregarPerguntaAtual();
    }
    
    await revelar();
    await carregarListaPerguntas();
  } catch (e) {
    console.error('Erro ao revelar pergunta da lista:', e);
    alert('Erro ao revelar essa pergunta.');
  }
}
  
  // =====================================================
  // REALTIME
  // =====================================================
  
  function conectarRealtimeQuiz() {
    desconectar();
    
    if (!quizAtual) return;
    
    // Canal do quiz
    canalQuiz = supabase
      .channel(`mod_quiz:${quizAtual.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'cnv25_quiz',
        filter: `id=eq.${quizAtual.id}`
      }, async (payload) => {
        quizAtual = payload.new;
        await carregarPerguntaAtual();
        await carregarListaPerguntas();
        renderizarQuiz();
      })
      .subscribe();
    
    // Canal de respostas (para atualizar stats em tempo real)
    canalQuizRespostas = supabase
      .channel(`mod_quiz_respostas:${quizAtual.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'cnv25_quiz_respostas'
      }, () => {
        if (perguntaAtual) {
          carregarStats();
        }
      })
      .subscribe();
    
    // Iniciar atualização automática de stats
    iniciarAtualizacaoStats();
  }
  
  function desconectar() {
    if (canalQuiz) window.supabase.removeChannel(canalQuiz);
    if (canalQuizPerguntas) window.supabase.removeChannel(canalQuizPerguntas);
    if (canalQuizRespostas) window.supabase.removeChannel(canalQuizRespostas);
    
    canalQuiz = null;
    canalQuizPerguntas = null;
    canalQuizRespostas = null;
    
    pararAtualizacaoStats();
  }
  
  // =====================================================
  // RENDERIZAÇÃO
  // =====================================================
  
  function renderizarQuiz() {
    if (!quizAtual) {
      limparQuiz();
      return;
    }
    
    const container = document.getElementById('quizPerguntaAtual');
    
    // Quiz não iniciado
    if (quizAtual.status === 'preparando') {
      container.innerHTML = `
        <div class="text-center py-8">
          <h3 class="text-lg font-semibold text-gray-800 mb-2">${window.ModeradorCore.esc(quizAtual.titulo)}</h3>
          <p class="text-sm text-gray-600 mb-4">${window.ModeradorCore.esc(quizAtual.descricao || '')}</p>
          <div class="inline-flex items-center gap-4 bg-gray-100 px-6 py-3 rounded-lg">
            <span class="text-2xl font-bold text-cnv-primary">${quizAtual.total_perguntas}</span>
            <span class="text-sm text-gray-600">perguntas</span>
          </div>
          <p class="text-sm text-gray-500 mt-4">Status: <strong>Preparando</strong></p>
        </div>
      `;
      
      document.getElementById('quizRanking').innerHTML = '<p class="text-gray-500 text-center py-8">Aguardando início</p>';
      return;
    }

    if (quizAtual && !perguntaAtual) {
      const statusLegivel = getStatusLabel(quizAtual.status);
      container.innerHTML = `
        <div class="text-center py-8">
          <p class="text-gray-600">Quiz selecionado: <strong>${window.ModeradorCore.esc(quizAtual.titulo)}</strong></p>
          <p class="text-sm text-gray-500 mt-2">Status: <strong>${statusLegivel}</strong></p>
          <p class="text-xs text-gray-400 mt-1">Clique em uma pergunta na lista para pré-visualizar ou em ▶️ Play para enviar ao telão.</p>
        </div>
      `;
      atualizarBotaoIniciar();
      return;
    }
    
    // Quiz finalizado
    if (quizAtual.status === 'finalizado') {
      container.innerHTML = `
        <div class="text-center py-8">
          <h3 class="text-2xl font-bold text-gray-800 mb-4">🏁 Quiz Finalizado!</h3>
          <p class="text-gray-600">${window.ModeradorCore.esc(quizAtual.titulo)}</p>
        </div>
      `;
      
      renderizarRanking();
      return;
    }
    
    // Quiz em andamento
    if (perguntaAtual) {
      const labels = ['A', 'B', 'C', 'D'];
      
      container.innerHTML = `
        <div class="bg-cnv-primary bg-opacity-10 p-4 rounded-lg mb-4">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm text-gray-600">
              Status: <strong>${statusLegivel}</strong><br>
              Pergunta <strong>${quizAtual.pergunta_atual}</strong> de <strong>${quizAtual.total_perguntas}</strong>
            </p>
            ${perguntaAtual.tempo_limite > 0 ? `<span class="text-xs bg-white px-3 py-1 rounded shadow-sm">⏱️ ${perguntaAtual.tempo_limite}s</span>` : ''}
          </div>
          <p class="font-semibold text-gray-800">${window.ModeradorCore.esc(perguntaAtual.pergunta)}</p>
        </div>
        
        <div class="space-y-2 mb-4">
          ${perguntaAtual.opcoes.map((op, idx) => {
            const isCorreta = idx === perguntaAtual.resposta_correta;
            const revelada = perguntaAtual.revelada;
            
            return `
              <div class="p-3 rounded-lg ${
                revelada && isCorreta
                  ? 'bg-green-100 border-2 border-green-500'
                  : 'bg-gray-100'
              }">
                <strong>${labels[idx]}.</strong> ${window.ModeradorCore.esc(op)}
                ${
                  revelada && isCorreta
                    ? ' <span class="text-green-600 font-bold">✓ CORRETA</span>'
                    : ''
                }
              </div>
            `;
          }).join('')}
        </div>
        
        ${
          perguntaAtual.revelada
            ? `
          <div class="bg-green-50 border-l-4 border-green-500 p-4 rounded">
            <p class="text-sm text-green-800"><strong>✓ Resposta revelada!</strong> Clique em "Avançar" para próxima pergunta.</p>
          </div>
        `
            : `
          <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <p class="text-sm text-blue-800">Aguardando respostas dos participantes...</p>
          </div>
        `
        }
        
        <div id="quizResumoStats" class="mt-4 text-sm text-gray-700 hidden"></div>
      `;
      
      carregarStats();
      
    } else {
      container.innerHTML = `
        <div class="text-center py-8">
          <p class="text-gray-600">Quiz em andamento...</p>
          <p class="text-sm text-gray-500 mt-2">Aguardando primeira pergunta</p>
        </div>
      `;
    }
    atualizarBotaoIniciar();
  }
  
  async function carregarStats() {
    if (!perguntaAtual) {
      return;
    }
    
    try {
      const stats = await obterStatsQuizPergunta(perguntaAtual.id);
      
      if (!stats) {
        return;
      }
      
      document.getElementById('totalRespostas').textContent = stats.total_respostas || 0;
      document.getElementById('percAcerto').textContent = Math.round(stats.percentual_acerto || 0) + '%';
      
      // Gráfico
      const labels = ['A', 'B', 'C', 'D'];
      const data = [0, 0, 0, 0];
      
      if (stats.distribuicao_respostas) {
        stats.distribuicao_respostas.forEach(d => {
          data[d.opcao] = d.total_votos;
        });
      }
      
      const ctx = document.getElementById('chartQuiz');
      if (chartQuiz) {
        chartQuiz.destroy();
      }
      
      const backgroundColors = labels.map((_, idx) => 
        perguntaAtual.revelada && idx === perguntaAtual.resposta_correta ? '#27ae52' : '#2797ff'
      );
      
      chartQuiz = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Respostas',
            data: data,
            backgroundColor: backgroundColors,
            borderColor: '#1e293b',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1 }
            }
          }
        }
      });
      
    } catch (error) {
      console.error('Erro ao carregar stats:', error);
    }
  }
  
  async function renderizarRanking() {
    if (!quizAtual) return;
    
    try {
      const ranking = await obterRankingQuiz(quizAtual.id);
      
      const container = document.getElementById('quizRanking');
      
      if (!ranking || ranking.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhum participante</p>';
        return;
      }
      
      container.innerHTML = `
        <div class="space-y-2">
          ${ranking.slice(0, 15).map(r => {
            const medalha = r.ranking === 1 ? '🥇' : r.ranking === 2 ? '🥈' : r.ranking === 3 ? '🥉' : `${r.ranking}º`;
            
            return `
              <div class="flex items-center justify-between p-3 bg-white rounded-lg border hover:shadow-md transition">
                <div class="flex items-center gap-3">
                  <span class="text-2xl font-bold ${r.ranking <= 3 ? 'text-yellow-500' : 'text-gray-400'}">${medalha}</span>
                  <div>
                    <p class="text-xs text-gray-600">Device: ${r.device_id_hash.substring(0, 10)}...</p>
                    <p class="text-sm"><strong>${r.total_acertos}</strong>/${quizAtual.total_perguntas} acertos</p>
                  </div>
                </div>
                <div class="text-right">
                  <p class="text-xl font-bold text-cnv-primary">${r.pontos_totais}</p>
                  <p class="text-xs text-gray-500">pts</p>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
      
    } catch (error) {
      console.error('Erro ao carregar ranking:', error);
    }
  }
  
  function limparQuiz() {
    document.getElementById('quizPerguntaAtual').innerHTML = `
      <p class="text-gray-500 text-center py-8">Selecione um quiz acima</p>
    `;
    
    document.getElementById('quizRanking').innerHTML = '';
    
    if (chartQuiz) {
      chartQuiz.destroy();
      chartQuiz = null;
    }
  }
  
  // =====================================================
  // AÇÕES
  // =====================================================
  
  async function iniciar() {
    if (!quizAtual) {
      alert('Selecione um quiz primeiro');
      return;
    }
  
    if (quizAtual.status !== 'preparando') {
      alert('Esse quiz já foi iniciado ou finalizado.');
      return;
    }
  
    if (!confirm(`Iniciar o quiz "${quizAtual.titulo}"?`)) {
      return;
    }
  
    try {
      // 1) Liga o semáforo global em modo QUIZ
      const ok = await window.ModeradorCore.setModoGlobal('quiz', {
        enquete_ativa: null,
        mostrar_resultado_enquete: false,
        quiz_ativo: quizAtual.id,
        pergunta_exibida: null
      });
  
      if (!ok) {
        alert('Falha ao atualizar o modo global.');
        return;
      }
  
      // 2) Atualiza o status do quiz
      const { error } = await supabase
        .from('cnv25_quiz')
        .update({
          status: 'iniciado',
          iniciado_em: new Date().toISOString(),
          pergunta_atual: 0 // primeira pergunta vem com "Avançar"
        })
        .eq('id', quizAtual.id);
  
      if (error) throw error;
  
      window.ModeradorCore.mostrarNotificacao(
        'Quiz iniciado! Clique em "Avançar" para ir à primeira pergunta.',
        'success'
      );
    } catch (error) {
      console.error('Erro ao iniciar quiz:', error);
      alert('Erro ao iniciar quiz');
    }
    atualizarBotaoIniciar();
  }
  
  async function avancar() {
    if (!quizAtual) return;
    
    const proximaPergunta = quizAtual.pergunta_atual + 1;
    
    if (proximaPergunta > quizAtual.total_perguntas) {
      alert('Última pergunta! Clique em "Finalizar" para encerrar o quiz.');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('cnv25_quiz')
        .update({
          status: 'em_andamento',
          pergunta_atual: proximaPergunta
        })
        .eq('id', quizAtual.id);
      
      if (error) throw error;
      
      window.ModeradorCore.mostrarNotificacao(`Pergunta ${proximaPergunta} exibida!`, 'info');
      
      // Atualiza ranking e lista de perguntas após avançar
      await renderizarRanking();
      await carregarListaPerguntas();
      
    } catch (error) {
      console.error('Erro ao avançar:', error);
      alert('Erro ao avançar para próxima pergunta');
    }
  }
  
  async function revelar() {
    if (!perguntaAtual) return;
    
    if (perguntaAtual.revelada) {
      alert('Resposta já foi revelada');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('cnv25_quiz_perguntas')
        .update({ revelada: true })
        .eq('id', perguntaAtual.id);
      
      if (error) throw error;
      
      perguntaAtual.revelada = true;
      renderizarQuiz();
      await carregarStats();
      await carregarListaPerguntas();
      
      window.ModeradorCore.mostrarNotificacao('Resposta revelada!', 'success');
      
    } catch (error) {
      console.error('Erro ao revelar:', error);
      alert('Erro ao revelar resposta');
    }
  }
  
  async function finalizar() {
    if (!quizAtual) return;
  
    if (!confirm('Finalizar este quiz? Os participantes verão o ranking final.')) {
      return;
    }
  
    try {
      const { error } = await supabase
        .from('cnv25_quiz')
        .update({
          status: 'finalizado',
          finalizado_em: new Date().toISOString()
        })
        .eq('id', quizAtual.id);

      // Atualiza estado local
      quizAtual.status = 'finalizado';
      
      // Recarrega pergunta e lista para refletir o estado final
      await carregarPerguntaAtual();
      await carregarListaPerguntas();
      
      // Recalcula ranking visual
      if (typeof renderizarRanking === 'function') {
        await renderizarRanking();
      }
      
      // Atualiza botão Iniciar/Reiniciar
      atualizarBotaoIniciar();
      
      // Re-renderiza o card
      renderizarQuiz();

      if (error) throw error;
  
      // Desliga modo QUIZ no broadcast
      await window.ModeradorCore.setModoGlobal(null, {
        enquete_ativa: null,
        mostrar_resultado_enquete: false,
        quiz_ativo: null,
        pergunta_exibida: null
      });
  
      window.ModeradorCore.mostrarNotificacao('Quiz finalizado!', 'success');
    } catch (error) {
      console.error('Erro ao finalizar quiz:', error);
      alert('Erro ao finalizar quiz');
    }
    
    await renderizarRanking();
    atualizarBotaoIniciar();

  }

  async function reiniciarQuiz() {
    if (!quizAtual) {
      alert('Selecione um quiz primeiro');
      return;
    }
  
    if (!confirm(`Reiniciar o quiz "${quizAtual.titulo}"? Isso vai zerar respostas e estatísticas.`)) {
      return;
    }
  
    try {
      // 1) Apaga respostas
      await supabase
        .from('cnv25_quiz_respostas')
        .delete()
        .eq('quiz_id', quizAtual.id);
  
      // 2) Reseta perguntas (revelada = false)
      await supabase
        .from('cnv25_quiz_perguntas')
        .update({ revelada: false })
        .eq('quiz_id', quizAtual.id);
  
      // 3) Reseta quiz
      const { error } = await supabase
        .from('cnv25_quiz')
        .update({
          status: 'preparando',
          pergunta_atual: 0,
          iniciado_em: null,
          finalizado_em: null
        })
        .eq('id', quizAtual.id);
  
      if (error) throw error;
  
      // 4) Limpa ranking visual
      if (typeof renderizarRanking === 'function') {
        await renderizarRanking();
      }
  
      // 5) Atualiza estado local
      await selecionarQuiz(quizAtual.id);
      atualizarBotaoIniciar();
  
      window.ModeradorCore.mostrarNotificacao('Quiz reiniciado com sucesso!', 'success');
    } catch (e) {
      console.error('Erro ao reiniciar quiz:', e);
      alert('Erro ao reiniciar quiz.');
    }
  }
  
  function atualizarBotaoIniciar() {
    const btnIniciar = document.getElementById('btnIniciarQuiz');
    if (!btnIniciar) return;
  
    const status = quizAtual?.status || 'preparando';
  
    if (status === 'preparando' || status === 'nao_iniciado') {
      // Não iniciado
      btnIniciar.textContent = '▶️ Iniciar Quiz';
      btnIniciar.classList.remove('bg-gray-500', 'hover:bg-gray-600');
      btnIniciar.classList.add('bg-cnv-success', 'hover:bg-green-600');
    } else {
      // Já foi iniciado ou finalizado => permite reiniciar
      btnIniciar.textContent = '🔄 Reiniciar Quiz';
      btnIniciar.classList.remove('bg-cnv-success', 'hover:bg-green-600');
      btnIniciar.classList.add('bg-gray-500', 'hover:bg-gray-600');
    }
  }

  
  async function handleBotaoIniciar() {
    if (!quizAtual || !quizAtual.status || quizAtual.status === 'preparando') {
      // fluxo normal de iniciar
      await iniciar();
    } else {
      // fluxo de reiniciar
      await reiniciarQuiz();
    }
  }

  // =====================================================
  // EXPORTAR CSV
  // =====================================================
  
  async function exportarCSV() {
    if (!quizAtual) {
      alert('Nenhum quiz selecionado');
      return;
    }
    
    try {
      const ranking = await obterRankingQuiz(quizAtual.id);
      
      if (!ranking || ranking.length === 0) {
        alert('Nenhum participante para exportar');
        return;
      }
      
      const csv = [
        ['Posição', 'Device Hash', 'Acertos', 'Total Perguntas', '% Acerto', 'Pontos', 'Tempo Médio (s)'].join(','),
        ...ranking.map(r => [
          r.ranking,
          r.device_id_hash.substring(0, 12),
          r.total_acertos,
          quizAtual.total_perguntas,
          ((r.total_acertos / quizAtual.total_perguntas) * 100).toFixed(1) + '%',
          r.pontos_totais,
          r.tempo_medio_resposta || 0
        ].map(c => `"${c}"`).join(','))
      ].join('\n');
      
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `quiz_${quizAtual.titulo.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.csv`;
      link.click();
      
      window.ModeradorCore.mostrarNotificacao('CSV exportado!', 'success');
      
    } catch (error) {
      console.error('Erro ao exportar:', error);
      alert('Erro ao exportar CSV');
    }
  }
  
  // =====================================================
  // ATUALIZAÇÃO AUTOMÁTICA
  // =====================================================
  
  function iniciarAtualizacaoStats() {
    pararAtualizacaoStats();
    
    if (quizAtual && perguntaAtual) {
      intervalStats = setInterval(() => {
        carregarStats();
      }, 2000); // Atualizar a cada 2 segundos
    }
  }
  
  function pararAtualizacaoStats() {
    if (intervalStats) {
      clearInterval(intervalStats);
      intervalStats = null;
    }
  }
  
  // =====================================================
  // CALLBACK DO CORE
  // =====================================================
  
  async function onQuizAtivoMudou(quizId) {
    if (quizId) {
      quizAtual = quizzes.find(q => q.id === quizId);
      if (quizAtual) {
        document.getElementById('quizSelect').value = quizId;
        await carregarPerguntaAtual();
        conectarRealtimeQuiz();
        renderizarQuiz();
      }
    } else {
      quizAtual = null;
      perguntaAtual = null;
      desconectar();
      limparQuiz();
    }
  }
  
  // =====================================================
  // EVENTOS
  // =====================================================
  
  function configurarEventos() {
    const quizSelect   = document.getElementById('quizSelect');
    const btnIniciar   = document.getElementById('btnIniciarQuiz');
    const btnFinalizar = document.getElementById('btnFinalizarQuiz');
    const btnExportar  = document.getElementById('btnExportarQuiz');
    
    if (quizSelect) {
      quizSelect.addEventListener('change', function () {
        selecionarQuiz(this.value);
      });
    }
    
    if (btnIniciar)   btnIniciar.onclick   = handleBotaoIniciar;
    if (btnFinalizar) btnFinalizar.onclick = finalizar;
    if (btnExportar)  btnExportar.onclick  = exportarCSV;
    
    if (!quizSelect || !btnIniciar) {
      console.warn('⚠️ Alguns elementos do quiz não foram encontrados');
    }
  }
  
  // =====================================================
  // API PÚBLICA
  // =====================================================
  return {
    inicializar,
    selecionarQuiz,
    desconectar,
    iniciar,
    finalizar,
    exportarCSV,
    // controle por pergunta
    irParaPergunta,
    revelarDaLista,
    previewPergunta,
    carregarListaPerguntas,
    renderizarListaPerguntas
  };


})();

// Expor globalmente
window.ModuloQuiz = ModuloQuiz;

console.log('✅ Módulo Quiz carregado');
