// =====================================================
// MODERADOR - MÓDULO DE QUIZ
// =====================================================

const ModuloQuiz = (() => {
  // Estado local
  let quizzes = [];
  let quizAtual = null;
  let perguntaAtual = null;
  let chartQuiz = null;
  
  let canalQuiz = null;
  let canalQuizPerguntas = null;
  let canalQuizRespostas = null;
  let intervalStats = null;
  
  // =====================================================
  // INICIALIZAÇÃO
  // =====================================================
  
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
      limparQuiz();
      return;
    }
    
    quizAtual = quizzes.find(q => q.id === quizId);
    
    if (!quizAtual) return;
    
    await carregarPerguntaAtual();
    conectarRealtimeQuiz();
    renderizarQuiz();
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
      
      document.getElementById('quizStats').classList.add('hidden');
      document.getElementById('quizRanking').innerHTML = '<p class="text-gray-500 text-center py-8">Aguardando início</p>';
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
      
      document.getElementById('quizStats').classList.add('hidden');
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
              Pergunta <strong>${quizAtual.pergunta_atual}</strong> de <strong>${quizAtual.total_perguntas}</strong>
            </p>
            ${perguntaAtual.tempo_limite > 0 ? `<span class="text-xs bg-cnv-warning text-white px-2 py-1 rounded">⏱️ ${perguntaAtual.tempo_limite}s</span>` : ''}
          </div>
          <p class="font-semibold text-gray-800">${window.ModeradorCore.esc(perguntaAtual.pergunta)}</p>
        </div>
        
        <div class="space-y-2 mb-4">
          ${perguntaAtual.opcoes.map((op, idx) => {
            const isCorreta = idx === perguntaAtual.resposta_correta;
            const revelada = perguntaAtual.revelada;
            
            return `
              <div class="p-3 rounded-lg ${revelada && isCorreta ? 'bg-green-100 border-2 border-green-500' : 'bg-gray-100'}">
                <strong>${labels[idx]}.</strong> ${window.ModeradorCore.esc(op)}
                ${revelada && isCorreta ? ' <span class="text-green-600 font-bold">✓ CORRETA</span>' : ''}
              </div>
            `;
          }).join('')}
        </div>
        
        ${perguntaAtual.revelada ? `
          <div class="bg-green-50 border-l-4 border-green-500 p-4 rounded">
            <p class="text-sm text-green-800"><strong>✓ Resposta revelada!</strong> Clique em "Avançar" para próxima pergunta.</p>
          </div>
        ` : `
          <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <p class="text-sm text-blue-800">Aguardando respostas dos participantes...</p>
          </div>
        `}
      `;
      
      carregarStats();
      
    } else {
      container.innerHTML = `
        <div class="text-center py-8">
          <p class="text-gray-600">Quiz em andamento...</p>
          <p class="text-sm text-gray-500 mt-2">Aguardando primeira pergunta</p>
        </div>
      `;
      document.getElementById('quizStats').classList.add('hidden');
    }
  }
  
  async function carregarStats() {
    if (!perguntaAtual) {
      document.getElementById('quizStats').classList.add('hidden');
      return;
    }
    
    try {
      const stats = await obterStatsQuizPergunta(perguntaAtual.id);
      
      if (!stats) {
        document.getElementById('quizStats').classList.add('hidden');
        return;
      }
      
      document.getElementById('quizStats').classList.remove('hidden');
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
    
    document.getElementById('quizStats').classList.add('hidden');
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
    const quizSelect = document.getElementById('quizSelect');
    const btnIniciar = document.getElementById('btnIniciarQuiz');
    const btnAvancar = document.getElementById('btnAvancarQuiz');
    const btnRevelar = document.getElementById('btnRevelarQuiz');
    const btnFinalizar = document.getElementById('btnFinalizarQuiz');
    const btnExportar = document.getElementById('btnExportarQuiz');
    
    if (quizSelect) {
      quizSelect.addEventListener('change', function() {
        selecionarQuiz(this.value);
      });
    }
    
    if (btnIniciar) btnIniciar.onclick = iniciar;
    if (btnAvancar) btnAvancar.onclick = avancar;
    if (btnRevelar) btnRevelar.onclick = revelar;
    if (btnFinalizar) btnFinalizar.onclick = finalizar;
    if (btnExportar) btnExportar.onclick = exportarCSV;
    
    if (!quizSelect || !btnIniciar) {
      console.warn('⚠️ Alguns elementos do quiz não foram encontrados');
    }
  }
  
  // =====================================================
  // API PÚBLICA
  // =====================================================
  
  return {
    inicializar,
    desconectar,
    iniciar,
    avancar,
    revelar,
    finalizar,
    exportarCSV,
    recarregarQuizzes
  };

})();

// Expor globalmente
window.ModuloQuiz = ModuloQuiz;

console.log('✅ Módulo Quiz carregado');
