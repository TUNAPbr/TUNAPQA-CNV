// =====================================================
// MODERADOR - MÓDULO DE QUIZ V2 (COM COUNTDOWN)
// =====================================================

const ModuloQuiz = (() => {
  // Estado local
  let quizzes = [];
  let quizAtual = null;
  let perguntaAtual = null;
  let chartQuiz = null;
  let perguntasQuiz = [];
  let rankingTelaoAtivo = false;
  let perguntasJaJogadas = new Set();

  let canalQuiz = null;
  let canalQuizRespostas = null;
  let intervalStats = null;

  // =====================================================
  // INICIALIZAÇÃO
  // =====================================================

  function syncQuizNaLista() {
    if (!quizAtual) return;

    quizzes = quizzes.map((q) =>
      q.id === quizAtual.id ? { ...q, status: quizAtual.status } : q
    );

    renderizarSelect();

    const select = document.getElementById('quizSelect');
    if (select) select.value = quizAtual.id;
  }

  function atualizarBotaoRankingTelao() {
    const btn = document.getElementById('btnToggleRankingTelao');
    if (!btn) return;

    if (rankingTelaoAtivo) {
      btn.textContent = '📺 Ocultar ranking no telão';
    } else {
      btn.textContent = '📺 Mostrar ranking no telão';
    }
  }

  async function toggleRankingTelao() {
    if (!quizAtual) {
      alert('Selecione um quiz para mostrar o ranking.');
      return;
    }

    const novoAtivo = !rankingTelaoAtivo;

    try {
      if (novoAtivo) {
        // Liga modo "ranking do quiz" no broadcast
        await window.ModeradorCore.setModoGlobal('quiz_ranking', {
          quiz_ativo: quizAtual.id,
          enquete_ativa: null,
          mostrar_resultado_enquete: false
        });
      } else {
        // Volta para modo normal de quiz
        await window.ModeradorCore.setModoGlobal('quiz', {
          quiz_ativo: quizAtual.id,
          enquete_ativa: null,
          mostrar_resultado_enquete: false
        });
      }

      rankingTelaoAtivo = novoAtivo;
      atualizarBotaoRankingTelao();
    } catch (e) {
      console.error('Erro ao alternar ranking no telão:', e);
      alert('Erro ao alternar exibição do ranking no telão.');
    }
  }

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
    await verificarQuizAtivo();

    atualizarBotaoIniciar();
    atualizarBotaoRankingTelao();

    console.log('✅ Módulo Quiz pronto');
  }

  // =====================================================
  // CARREGAR QUIZZES
  // =====================================================

  async function carregarQuizzes() {
    try {
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
    const p = perguntasQuiz.find((q) => q.ordem === ordem);
    if (!p) return;

    // Atualiza apenas o estado local do moderador
    perguntaAtual = p;

    renderizarQuiz();
  }

  function renderizarSelect() {
    const select = document.getElementById('quizSelect');
    if (!select) return;

    select.innerHTML = '<option value="">Selecione um quiz...</option>';

    quizzes.forEach((q) => {
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

    quizAtual = quizzes.find((q) => q.id === quizId);

    if (!quizAtual) return;

    await carregarPerguntaAtual();
    await carregarListaPerguntas();
    conectarRealtimeQuiz();
    renderizarQuiz();
  }

  async function verificarQuizAtivo() {
    const controle = window.ModeradorCore?.state?.controle;

    if (controle?.quiz_ativo) {
      const quiz = quizzes.find((q) => q.id === controle.quiz_ativo);

      if (quiz) {
        quizAtual = quiz;
        const select = document.getElementById('quizSelect');
        if (select) select.value = quiz.id;

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

    perguntaAtual = data || null;
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
      container.innerHTML =
        '<p class="text-gray-500 text-center py-8">Selecione um quiz acima.</p>';
      return;
    }

    if (!perguntasQuiz || perguntasQuiz.length === 0) {
      container.innerHTML =
        '<p class="text-gray-500 text-center py-8">Nenhuma pergunta cadastrada para este quiz.</p>';
      return;
    }

    container.innerHTML = perguntasQuiz
      .map((p) => {
        const isAtual = quizAtual.pergunta_atual === p.ordem;
        const revelada = p.revelada;
        const jaJogada = perguntasJaJogadas.has(p.ordem);

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
              ${
                !jaJogada
                  ? `
                <button
                  type="button"
                  class="px-3 py-1 text-xs rounded bg-cnv-primary text-white hover:bg-blue-700"
                  onclick="event.stopPropagation(); window.ModuloQuiz.irParaPergunta(${p.ordem})"
                >
                  ▶️ Play
                </button>
              `
                  : ''
              }

              ${
                revelada
                  ? `
                <button
                  type="button"
                  class="px-3 py-1 text-xs rounded ${
                    revelada
                      ? 'bg-gray-500 hover:bg-gray-600'
                      : 'bg-cnv-warning hover:bg-yellow-600'
                  } text-white"
                  onclick="event.stopPropagation(); window.ModuloQuiz.revelarDaLista(${p.ordem})"
                >
                  ${revelada ? '👁️ Ocultar' : '👁️ Revelar'}
                </button>
              `
                  : ''
              }
            </div>
          </div>
        `;
      })
      .join('');
  }

  // =====================================================
  // 🔥 FUNÇÃO PRINCIPAL: IR PARA PERGUNTA (PLAY)
  // =====================================================

  async function irParaPergunta(ordem) {
    if (!quizAtual) return;
    if (!ordem || ordem < 1 || ordem > quizAtual.total_perguntas) return;

    try {
      // 1️⃣ Atualizar quiz no banco
      const { error: quizError } = await supabase
        .from('cnv25_quiz')
        .update({
          status: 'em_andamento',
          pergunta_atual: ordem
        })
        .eq('id', quizAtual.id);

      if (quizError) throw quizError;

      // 2️⃣ Atualizar broadcast - COUNTDOWN INICIAL
      const { error: broadcastError } = await supabase
        .from('cnv25_broadcast_controle')
        .update({
          modo_global: 'quiz',
          quiz_ativo: quizAtual.id,
          quiz_countdown_state: 'countdown_inicial',
          enquete_ativa: null,
          mostrar_resultado_enquete: false,
          pergunta_exibida: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (broadcastError) throw broadcastError;

      // 3️⃣ Após 3 segundos, mudar para "pergunta_ativa"
      setTimeout(async () => {
        const { error } = await supabase
          .from('cnv25_broadcast_controle')
          .update({
            quiz_countdown_state: 'pergunta_ativa',
            updated_at: new Date().toISOString()
          })
          .eq('id', 1);

        if (error) console.error('Erro ao atualizar countdown state:', error);
      }, 3000);

      // 4️⃣ Marcar como já jogada
      perguntasJaJogadas.add(ordem);

      // 5️⃣ Atualizar UI local
      await carregarPerguntaAtual();
      await carregarListaPerguntas();
      renderizarQuiz();

      window.ModeradorCore.mostrarNotificacao(
        `Pergunta ${ordem} enviada para o telão! Countdown de 3s iniciado.`,
        'success'
      );
    } catch (e) {
      console.error('Erro ao ir para pergunta:', e);
      alert('Erro ao exibir a pergunta selecionada.');
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
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cnv25_quiz',
          filter: `id=eq.${quizAtual.id}`
        },
        async (payload) => {
          quizAtual = payload.new;
          await carregarPerguntaAtual();
          syncQuizNaLista();
          await carregarListaPerguntas();
          renderizarQuiz();
        }
      )
      .subscribe();

    // Canal de respostas (para atualizar stats em tempo real)
    canalQuizRespostas = supabase
      .channel(`mod_quiz_respostas:${quizAtual.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'cnv25_quiz_respostas'
        },
        () => {
          if (perguntaAtual) {
            // aqui você pode chamar algo para recalcular stats se quiser
          }
        }
      )
      .subscribe();

    // Iniciar atualização automática de stats (stub)
    iniciarAtualizacaoStats();
  }

  function desconectar() {
    if (canalQuiz) supabase.removeChannel(canalQuiz);
    if (canalQuizRespostas) supabase.removeChannel(canalQuizRespostas);

    canalQuiz = null;
    canalQuizRespostas = null;

    pararAtualizacaoStats();
  }

  // =====================================================
  // RENDERIZAÇÃO
  // =====================================================

  function renderizarQuiz() {
    const container = document.getElementById('quizPerguntaAtual');
    if (!container) return;

    if (!quizAtual) {
      limparQuiz();
      return;
    }

    const statusLegivel = getStatusLabel(quizAtual.status);

    // Quiz não iniciado / preparando
    if (quizAtual.status === 'preparando') {
      container.innerHTML = `
        <div class="text-center py-8">
          <h3 class="text-lg font-semibold text-gray-800 mb-2">${window.ModeradorCore.esc(
            quizAtual.titulo
          )}</h3>
          <p class="text-sm text-gray-600 mb-4">${window.ModeradorCore.esc(
            quizAtual.descricao || ''
          )}</p>
          <div class="inline-flex items-center gap-4 bg-gray-100 px-6 py-3 rounded-lg">
            <span class="text-2xl font-bold text-cnv-primary">${
              quizAtual.total_perguntas
            }</span>
            <span class="text-sm text-gray-600">perguntas</span>
          </div>
          <p class="text-sm text-gray-500 mt-4">Status: <strong>Preparando</strong></p>
        </div>
      `;

      const rankingEl = document.getElementById('quizRanking');
      if (rankingEl) {
        rankingEl.innerHTML =
          '<p class="text-gray-500 text-center py-8">Aguardando início</p>';
      }

      atualizarBotaoIniciar();
      atualizarBotaoRankingTelao();
      return;
    }

    // Quiz selecionado, mas sem pergunta atual
    if (quizAtual && !perguntaAtual) {
      container.innerHTML = `
        <div class="text-center py-8">
          <p class="text-gray-600">Quiz selecionado: <strong>${window.ModeradorCore.esc(
            quizAtual.titulo
          )}</strong></p>
          <p class="text-sm text-gray-500 mt-2">Status: <strong>${statusLegivel}</strong></p>
          <p class="text-xs text-gray-400 mt-1">
            Clique em uma pergunta na lista para pré-visualizar ou em ▶️ Play para enviar ao telão.
          </p>
        </div>
      `;
      atualizarBotaoIniciar();
      atualizarBotaoRankingTelao();
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
      atualizarBotaoIniciar();
      atualizarBotaoRankingTelao();
      return;
    }

    // Quiz em andamento com pergunta atual
    if (perguntaAtual) {
      const labels = ['A', 'B', 'C', 'D'];

      container.innerHTML = `
        <div class="bg-cnv-primary bg-opacity-10 p-4 rounded-lg mb-4">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm text-gray-600">
              Status: <strong>${statusLegivel}</strong><br>
              Pergunta <strong>${quizAtual.pergunta_atual}</strong> de <strong>${
        quizAtual.total_perguntas
      }</strong>
            </p>
            ${
              perguntaAtual.tempo_limite > 0
                ? `<span class="text-xs bg-white px-3 py-1 rounded shadow-sm">⏱️ ${perguntaAtual.tempo_limite}s</span>`
                : ''
            }
          </div>
          <p class="font-semibold text-gray-800">${window.ModeradorCore.esc(
            perguntaAtual.pergunta
          )}</p>
        </div>
        
        <div class="space-y-2 mb-4">
          ${perguntaAtual.opcoes
            .map((op, idx) => {
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
            })
            .join('')}
        </div>
        <div class="${
          perguntaAtual.revelada
            ? 'bg-green-50 border-green-500'
            : 'bg-blue-50 border-blue-500'
        } border-l-4 p-4 rounded flex items-center justify-between">
          <p class="text-sm ${
            perguntaAtual.revelada ? 'text-green-800' : 'text-blue-800'
          }">
            ${
              perguntaAtual.revelada
                ? '<strong>✓ Resposta revelada no telão!</strong>'
                : 'Aguardando respostas dos participantes...'
            }
          </p>
          <button
            type="button"
            class="px-4 py-2 rounded ${
              perguntaAtual.revelada
                ? 'bg-gray-500 hover:bg-gray-600'
                : 'bg-purple-600 hover:bg-purple-700'
            } text-white transition"
            onclick="window.ModuloQuiz.revelar()"
          >
            ${perguntaAtual.revelada ? '👁️ Ocultar Resposta' : '✅ Revelar Resposta'}
          </button>
        </div>
        
        <div id="quizResumoStats" class="mt-4 text-sm text-gray-700 hidden"></div>
      `;
    } else {
      container.innerHTML = `
        <div class="text-center py-8">
          <p class="text-gray-600">Quiz em andamento...</p>
          <p class="text-sm text-gray-500 mt-2">Aguardando primeira pergunta</p>
        </div>
      `;
    }

    atualizarBotaoIniciar();
    atualizarBotaoRankingTelao();
  }

  async function obterRankingQuiz(quizId) {
    try {
      const { data, error } = await supabase.rpc('cnv25_quiz_ranking', {
        quiz_uuid: quizId
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar ranking do quiz:', error);
      return [];
    }
  }

  async function revelarDaLista(ordem) {
  if (!quizAtual) return;

  // Buscar a pergunta
  const pergunta = perguntasQuiz.find((p) => p.ordem === ordem);
    if (!pergunta) return;
  
    try {
      // Alternar estado revelado
      const novoEstado = !pergunta.revelada;
  
      // Atualizar no banco
      const { error: perguntaError } = await supabase
        .from('cnv25_quiz_perguntas')
        .update({ revelada: novoEstado })
        .eq('id', pergunta.id);
  
      if (perguntaError) throw perguntaError;
  
      // Se está revelando E é a pergunta atual, atualizar broadcast para "resultado_revelado"
      if (novoEstado && quizAtual.pergunta_atual === ordem) {
        const { error: broadcastError } = await supabase
          .from('cnv25_broadcast_controle')
          .update({
            quiz_countdown_state: 'resultado_revelado',
            updated_at: new Date().toISOString()
          })
          .eq('id', 1);
  
        if (broadcastError) throw broadcastError;
      }
  
      // Se está ocultando E é a pergunta atual, voltar para "pergunta_ativa"
      if (!novoEstado && quizAtual.pergunta_atual === ordem) {
        const { error: broadcastError } = await supabase
          .from('cnv25_broadcast_controle')
          .update({
            quiz_countdown_state: 'pergunta_ativa',
            updated_at: new Date().toISOString()
          })
          .eq('id', 1);
  
        if (broadcastError) throw broadcastError;
      }
  
      // Atualizar estado local
      pergunta.revelada = novoEstado;
      if (perguntaAtual?.ordem === ordem) {
        perguntaAtual.revelada = novoEstado;
      }
  
      // Re-renderizar
      renderizarListaPerguntas();
      renderizarQuiz();
  
      // Atualizar ranking se revelou
      if (novoEstado) {
        setTimeout(async () => {
          await renderizarRanking();
        }, 1000);
      }
  
      const msg = novoEstado ? 'Resposta revelada!' : 'Resposta ocultada!';
      window.ModeradorCore.mostrarNotificacao(msg, 'success');
    } catch (error) {
      console.error('Erro ao revelar:', error);
      alert('Erro ao revelar resposta');
    }
  }

  async function renderizarRanking() {
    if (!quizAtual) return;

    try {
      const ranking = await obterRankingQuiz(quizAtual.id);

      const container = document.getElementById('quizRanking');
      if (!container) return;

      if (!ranking || ranking.length === 0) {
        container.innerHTML =
          '<p class="text-gray-500 text-center py-8">Nenhum participante</p>';
        return;
      }

      container.innerHTML = `
        <div class="space-y-2">
          ${ranking
            .slice(0, 15)
            .map((r) => {
              const medalha =
                r.ranking === 1
                  ? '🥇'
                  : r.ranking === 2
                  ? '🥈'
                  : r.ranking === 3
                  ? '🥉'
                  : `${r.ranking}º`;

              return `
              <div class="flex items-center justify-between p-3 bg-white rounded-lg border hover:shadow-md transition">
                <div class="flex items-center gap-3">
                  <span class="text-2xl font-bold ${
                    r.ranking <= 3 ? 'text-yellow-500' : 'text-gray-400'
                  }">${medalha}</span>
                  <div>
                    <p class="text-xs text-gray-600">Device: ${r.device_id_hash.substring(
                      0,
                      10
                    )}...</p>
                    <p class="text-sm"><strong>${
                      r.total_acertos
                    }</strong>/${quizAtual.total_perguntas} acertos</p>
                  </div>
                </div>
                <div class="text-right">
                  <p class="text-xl font-bold text-cnv-primary">${r.pontos_totais}</p>
                  <p class="text-xs text-gray-500">pts</p>
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      `;
    } catch (error) {
      console.error('Erro ao carregar ranking:', error);
    }
  }

  function limparQuiz() {
    const perguntaEl = document.getElementById('quizPerguntaAtual');
    const rankingEl = document.getElementById('quizRanking');

    if (perguntaEl) {
      perguntaEl.innerHTML =
        '<p class="text-gray-500 text-center py-8">Selecione um quiz acima</p>';
    }

    if (rankingEl) {
      rankingEl.innerHTML = '';
    }

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

    if (quizAtual.status !== 'preparando' && quizAtual.status !== 'nao_iniciado') {
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
        pergunta_exibida: null,
        quiz_countdown_state: null
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
          pergunta_atual: 0
        })
        .eq('id', quizAtual.id);

      if (error) throw error;

      quizAtual.status = 'iniciado';
      quizAtual.pergunta_atual = 0;

      window.ModeradorCore.mostrarNotificacao(
        'Quiz iniciado! Clique em "▶️ Play" em uma pergunta para começar.',
        'success'
      );
    } catch (error) {
      console.error('Erro ao iniciar quiz:', error);
      alert('Erro ao iniciar quiz');
    }

    atualizarBotaoIniciar();
    syncQuizNaLista();
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

      quizAtual.status = 'em_andamento';
      quizAtual.pergunta_atual = proximaPergunta;

      window.ModeradorCore.mostrarNotificacao(
        `Pergunta ${proximaPergunta} exibida!`,
        'info'
      );

      await renderizarRanking();
      await carregarListaPerguntas();
      await carregarPerguntaAtual();
      renderizarQuiz();
    } catch (error) {
      console.error('Erro ao avançar:', error);
      alert('Erro ao avançar para próxima pergunta');
    }
  }

  async function revelar() {
    if (!perguntaAtual) return;

    try {
      const novoEstado = !perguntaAtual.revelada;

      // Atualizar no banco
      const { error: perguntaError } = await supabase
        .from('cnv25_quiz_perguntas')
        .update({ revelada: novoEstado })
        .eq('id', perguntaAtual.id);

      if (perguntaError) throw perguntaError;

      // Atualizar broadcast
      const { error: broadcastError } = await supabase
        .from('cnv25_broadcast_controle')
        .update({
          quiz_countdown_state: novoEstado ? 'resultado_revelado' : 'pergunta_ativa',
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (broadcastError) throw broadcastError;

      perguntaAtual.revelada = novoEstado;
      renderizarQuiz();
      await carregarListaPerguntas();

      const msg = novoEstado ? 'Resposta revelada!' : 'Resposta ocultada!';
      window.ModeradorCore.mostrarNotificacao(msg, 'success');

      if (novoEstado) {
        setTimeout(async () => {
          await renderizarRanking();
        }, 1500);
      }
    } catch (error) {
      console.error('Erro ao revelar:', error);
      alert('Erro ao revelar resposta');
    }
  }

  async function finalizar() {
    if (!quizAtual) return;

    if (
      !confirm(
        'Finalizar este quiz? Os participantes verão o ranking final.'
      )
    ) {
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

      quizAtual.status = 'finalizado';

      await carregarPerguntaAtual();
      await carregarListaPerguntas();
      await renderizarRanking();
      atualizarBotaoIniciar();
      renderizarQuiz();

      await window.ModeradorCore.setModoGlobal(null, {
        enquete_ativa: null,
        mostrar_resultado_enquete: false,
        quiz_ativo: null,
        pergunta_exibida: null,
        quiz_countdown_state: null
      });

      window.ModeradorCore.mostrarNotificacao('Quiz finalizado!', 'success');
    } catch (error) {
      console.error('Erro ao finalizar quiz:', error);
      alert('Erro ao finalizar quiz');
    }

    await renderizarRanking();
    atualizarBotaoIniciar();
    syncQuizNaLista();
  }

  async function reiniciarQuiz() {
    if (!quizAtual) {
      alert('Selecione um quiz primeiro');
      return;
    }

    if (
      !confirm(
        `Reiniciar o quiz "${quizAtual.titulo}"? Isso vai zerar respostas e estatísticas.`
      )
    ) {
      return;
    }

    try {
      // Buscar IDs das perguntas
      const { data: perguntas, error: errP } = await supabase
        .from('cnv25_quiz_perguntas')
        .select('id')
        .eq('quiz_id', quizAtual.id);

      if (errP) throw errP;

      const pergIds = (perguntas || []).map((p) => p.id);

      // 1) Apaga respostas usando os IDs das perguntas
      if (pergIds.length > 0) {
        const { error: errDelResp } = await supabase
          .from('cnv25_quiz_respostas')
          .delete()
          .in('quiz_pergunta_id', pergIds);

        if (errDelResp) throw errDelResp;
      }

      // 2) Reseta perguntas (revelada = false)
      const { error: errUpPerg } = await supabase
        .from('cnv25_quiz_perguntas')
        .update({ revelada: false })
        .eq('quiz_id', quizAtual.id);

      if (errUpPerg) throw errUpPerg;

      // 3) Reseta quiz
      const { error: errUpQuiz } = await supabase
        .from('cnv25_quiz')
        .update({
          status: 'preparando',
          pergunta_atual: 0,
          iniciado_em: null,
          finalizado_em: null
        })
        .eq('id', quizAtual.id);

      if (errUpQuiz) throw errUpQuiz;

      quizAtual.status = 'preparando';
      quizAtual.pergunta_atual = 0;

      // 4) Limpa broadcast
      const { error: errBc } = await supabase
        .from('cnv25_broadcast_controle')
        .update({
          quiz_ativo: null,
          modo_global: null,
          quiz_countdown_state: null,
        })
        .eq('id', 1);

      if (errBc) throw errBc;

      // 5) Limpa estado local
      perguntasJaJogadas = new Set();
      perguntaAtual = null;

      // 6) Atualiza UI
      await carregarListaPerguntas();
      renderizarListaPerguntas();
      renderizarQuiz();
      syncQuizNaLista();
      atualizarBotaoIniciar();
      atualizarBotaoRankingTelao();

      window.ModeradorCore.mostrarNotificacao(
        'Quiz reiniciado com sucesso!',
        'success'
      );
    } catch (e) {
      console.error('Erro ao reiniciar quiz:', e);
      alert('Erro ao reiniciar quiz: ' + e.message);
    }
  }

  function atualizarBotaoIniciar() {
    const btnIniciar = document.getElementById('btnIniciarQuiz');
    if (!btnIniciar) return;

    const status = quizAtual?.status || 'preparando';

    if (status === 'preparando' || status === 'nao_iniciado' || !status) {
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
      await iniciar();
    } else {
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
        [
          'Posição',
          'Device Hash',
          'Acertos',
          'Total Perguntas',
          '% Acerto',
          'Pontos',
          'Tempo Médio (s)'
        ].join(','),
        ...ranking.map((r) =>
          [
            r.ranking,
            r.device_id_hash.substring(0, 12),
            r.total_acertos,
            quizAtual.total_perguntas,
            ((r.total_acertos / quizAtual.total_perguntas) * 100).toFixed(1) + '%',
            r.pontos_totais,
            r.tempo_medio_resposta || 0
          ]
            .map((c) => `"${c}"`)
            .join(',')
        )
      ].join('\n');

      const blob = new Blob(['\ufeff' + csv], {
        type: 'text/csv;charset=utf-8;'
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `quiz_${quizAtual.titulo.replace(
        /[^a-z0-9]/gi,
        '_'
      )}_${Date.now()}.csv`;
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
        // espaço para lógica futura de atualização de stats em tempo real
      }, 2000);
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
      quizAtual = quizzes.find((q) => q.id === quizId);
      if (quizAtual) {
        const select = document.getElementById('quizSelect');
        if (select) select.value = quizId;

        await carregarPerguntaAtual();
        conectarRealtimeQuiz();
        renderizarQuiz();
      }
    } else {
      quizAtual = null;
      perguntaAtual = null;
      desconectar();
      limparQuiz();
      renderizarListaPerguntas();
      atualizarBotaoIniciar();
      atualizarBotaoRankingTelao();
    }
  }

  // =====================================================
  // EVENTOS
  // =====================================================

  function configurarEventos() {
    const quizSelect = document.getElementById('quizSelect');
    const btnIniciar = document.getElementById('btnIniciarQuiz');
    const btnFinalizar = document.getElementById('btnFinalizarQuiz');
    const btnExportar = document.getElementById('btnExportarQuiz');
    const btnToggleRankingTelao =
      document.getElementById('btnToggleRankingTelao');

    if (btnToggleRankingTelao)
      btnToggleRankingTelao.onclick = toggleRankingTelao;

    if (quizSelect) {
      quizSelect.addEventListener('change', function () {
        selecionarQuiz(this.value);
      });
    }

    if (btnIniciar) btnIniciar.onclick = handleBotaoIniciar;
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
    selecionarQuiz,
    desconectar,
    iniciar,
    finalizar,
    exportarCSV,
    recarregarQuizzes,
    irParaPergunta,
    revelarDaLista,
    previewPergunta,
    carregarListaPerguntas,
    renderizarListaPerguntas,
    avancar,
    revelar,
    reiniciarQuiz,
    onQuizAtivoMudou,
    verificarQuizAtivo
  };
})();

// Expor globalmente
window.ModuloQuiz = ModuloQuiz;

console.log('✅ Módulo Quiz V2 (com countdown) carregado');
