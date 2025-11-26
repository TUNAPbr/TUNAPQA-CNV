// ============================================================
// TELÃO — Enquetes, Perguntas & Quiz via BROADCAST GLOBAL
// ============================================================

// ====== ELEMENTOS DE UI ======
const el = {
  loading: document.getElementById('loading'),
  main: document.getElementById('mainContent'),

  // modos
  emptyMode: document.getElementById('emptyMode'),
  pollMode: document.getElementById('pollMode'),
  pollTitle: document.getElementById('pollTitle'),
  pollBody: document.getElementById('pollBody'),

  // quiz
  quizQuestionMode: document.getElementById('quizQuestionMode'),
  quizResultMode: document.getElementById('quizResultMode'),
  quizProgress: document.getElementById('quizProgress'),
  quizQuestionText: document.getElementById('quizQuestionText'),
  quizCountdownContainer: document.getElementById('quizCountdownContainer'),
  correctAnswer: document.getElementById('correctAnswer'),
  accuracyPercentage: document.getElementById('accuracyPercentage'),
  chartQuizDisplay: document.getElementById('chartQuizDisplay'),
  modeBadgeText: document.getElementById('modeBadgeText'),
  voteHint: document.getElementById('voteHint'),
};

// ====== ESTADO ======
let currentMode = 'loading';

// broadcast global
let broadcast = {
  enquete_ativa: null,
  mostrar_resultado_enquete: false,
  modo_global: null,
  pergunta_exibida: null,
  quiz_ativo: null,
  quiz_countdown_state: null // 🔥 NOVO
};
let canalBroadcast = null;

// Quiz
let quizAtual = null;
let perguntaAtual = null;
let countdownInicialTimer = null;
let countdownPerguntaTimer = null;

// ====== HELPERS VISUAIS ======
function showContent() {
  el.loading?.classList.add('hidden');
  el.main?.classList.remove('hidden');
}

function hideAllModes() {
  el.emptyMode?.classList.add('hidden');
  el.pollMode?.classList.add('hidden');
  el.quizQuestionMode?.classList.add('hidden');
  el.quizResultMode?.classList.add('hidden');
}

function showMode(id) {
  hideAllModes();
  el[id]?.classList.remove('hidden');
  showContent();
  currentMode = id;
}

function displayEmptyMode() {
  showMode('emptyMode');
}

// ====== RENDER: ENQUETE ======
function displayPoll(poll) {
  if (el.modeBadgeText) el.modeBadgeText.textContent = 'ENQUETE ATIVA';
  if (el.voteHint) {
    el.voteHint.textContent = '📱 Vote pelo seu dispositivo!';
    el.voteHint.classList.remove('hidden');
  }
  if (el.pollTitle) el.pollTitle.textContent = poll?.titulo || 'Enquete';
  if (el.pollBody) {
    el.pollBody.innerHTML = `
      <p class="sub-text text-3xl md:text-4xl">
        Há uma enquete disponível. Participe votando pelo seu dispositivo.
      </p>
    `;
  }
  showMode('pollMode');
}

function displayPollResult(poll, resultado) {
  if (el.pollTitle) el.pollTitle.classList.remove('hidden');
  if (el.modeBadgeText) el.modeBadgeText.textContent = 'RESULTADOS';
  if (el.voteHint) el.voteHint.classList.add('hidden');

  const OPTION_CARD_MIN_HEIGHT = 100;

  const labels = 'ABCDEFGHIJ'.split('');
  const opcoesRaw = Array.isArray(poll?.opcoes)
    ? poll.opcoes
    : (poll?.opcoes?.opcoes || []);
  const opcoes = opcoesRaw.slice(0, 10);
  const rows = resultado?.rows || [];
  const total = rows.reduce((acc, r) => acc + (r.votos || 0), 0);

  if (el.pollTitle) el.pollTitle.textContent = poll?.titulo || 'Enquete';

  if (el.pollBody) {
    el.pollBody.innerHTML = `
      <div class="w-full flex items-center justify-center">
        <div class="w-full max-w-5xl">
          <div class="grid grid-cols-2 xl:grid-cols-3 gap-4">
            ${
              opcoes.map((txt, idx) => {
                const row = rows.find(r => (r.opcao_index === idx || r.opcaoIndex === idx));
                const v = row?.votos || 0;
                const pct = total ? Math.round((v / total) * 100) : 0;

                return `
                  <div class="border rounded-lg p-4 flex flex-col justify-between"
                       style="min-height:${OPTION_CARD_MIN_HEIGHT}px">
                    <div class="flex items-start justify-between mb-2">
                      <div class="font-semibold text-xl">
                        <span class="inline-block mr-2 text-gray-500">${labels[idx]}.</span>
                        <span>${escapeHtml(txt)}</span>
                      </div>
                      <div class="text-sm text-gray-600 text-right">
                        ${v} voto(s)<br>${pct}%
                      </div>
                    </div>
                    <div class="mt-2 w-full bg-gray-200 rounded-full h-2">
                      <div class="h-2 rounded-full" style="width:${pct}%; background:#3b82f6"></div>
                    </div>
                  </div>
                `;
              }).join('')
            }
          </div>
        </div>
      </div>
    `;
  }

  showMode('pollMode');
}

// ====== RENDER: PERGUNTA (destaque) ======
async function fetchPergunta(perguntaId) {
  const { data, error } = await supabase
    .from('cnv25_perguntas')
    .select('texto, nome_opt, anonimo')
    .eq('id', perguntaId)
    .single();
  if (error) {
    console.error('fetchPergunta:', error);
    return null;
  }
  return data;
}

function displayPergunta(pergunta) {
  if (el.pollTitle) el.pollTitle.classList.remove('hidden');
  if (el.modeBadgeText) el.modeBadgeText.textContent = 'PERGUNTA';
  if (el.voteHint) el.voteHint.classList.add('hidden');

  if (el.pollTitle) {
    el.pollTitle.textContent = '';
    el.pollTitle.classList.add('hidden');
  }

  if (el.pollBody) {
    const autor = pergunta.anonimo ? 'Anônimo' : (pergunta.nome_opt || 'Participante');
    el.pollBody.innerHTML = `
      <div class="w-full flex items-center justify-center">
        <div class="w-full max-w-5xl min-h-[260px] flex flex-col justify-center space-y-3">
          <p style="font-size:56px; line-height:1.2; font-weight:700; letter-spacing:-0.02em;">
            ${escapeHtml(pergunta.texto)}
          </p>
          <p class="text-lg" style="opacity:.6;">por ${escapeHtml(autor)}</p>
        </div>
      </div>
    `;
  }

  showMode('pollMode');
}

// ====== DATA FETCH (ENQUETE / RESULTADO) ======
async function fetchEnquete(enqueteId) {
  const { data, error } = await supabase
    .from('cnv25_enquetes')
    .select('*')
    .eq('id', enqueteId)
    .single();
  if (error) {
    console.error('fetchEnquete:', error);
    return null;
  }
  return data;
}

async function fetchResultadoEnquete(enqueteId) {
  let viaView = true;
  const resView = await supabase
    .from('cnv25_enquete_resultado_v')
    .select('*')
    .eq('enquete_id', enqueteId);
  if (resView.error) viaView = false;

  if (viaView) {
    return { rows: resView.data || [] };
  }

  const { data: rs, error } = await supabase
    .from('cnv25_enquete_respostas')
    .select('resposta')
    .eq('enquete_id', enqueteId);
  if (error) {
    console.error('fetchResultadoEnquete:', error);
    return { rows: [] };
  }

  const cont = {};
  (rs || []).forEach(r => {
    const idx = parseInt(r.resposta?.opcaoIndex ?? r.resposta?.opcao_index ?? 0, 10) || 0;
    cont[idx] = (cont[idx] || 0) + 1;
  });
  const rows = Object.entries(cont).map(([k, v]) => ({
    opcao_index: parseInt(k, 10),
    votos: v
  }));
  return { rows };
}

// ====== QUIZ: FETCH ======
async function fetchQuiz(quizId) {
  const { data, error } = await supabase
    .from('cnv25_quiz')
    .select('*')
    .eq('id', quizId)
    .single();
  if (error) {
    console.error('fetchQuiz:', error);
    return null;
  }
  return data;
}

async function fetchPerguntaQuiz(quizId, ordem) {
  const { data, error } = await supabase
    .from('cnv25_quiz_perguntas')
    .select('*')
    .eq('quiz_id', quizId)
    .eq('ordem', ordem)
    .single();
  if (error) {
    console.error('fetchPerguntaQuiz:', error);
    return null;
  }
  return data;
}

// ====== RENDER: QUIZ - COUNTDOWN INICIAL (3s) ======
function displayQuizCountdownInicial() {
  hideAllModes();
  el.quizQuestionMode?.classList.remove('hidden');
  showContent();

  if (el.quizProgress && quizAtual) {
    el.quizProgress.textContent = `Pergunta ${quizAtual.pergunta_atual}/${quizAtual.total_perguntas}`;
  }

  if (el.quizQuestionText) {
    el.quizQuestionText.textContent = 'Prepare-se!';
  }

  if (el.quizCountdownContainer) {
    el.quizCountdownContainer.innerHTML = `
      <div class="flex justify-center items-center w-full h-screen">
        <div class="countdown-display countdown-urgent">
          <div style="display: flex; justify-content: center; align-items: center; width: 100%;">
          <span id="countdownNumero" class="countdown-number">3</span>
          <span class="countdown-label">segundos</span>
        </div>  
      </div>
    `;
  }

  if (countdownInicialTimer) clearInterval(countdownInicialTimer);

  let count = 3;
  const display = document.getElementById('countdownNumero');

  countdownInicialTimer = setInterval(() => {
    count--;
    if (display) display.textContent = count;
    
    if (count <= 0) {
      clearInterval(countdownInicialTimer);
      countdownInicialTimer = null;
    }
  }, 1000);
}

// ====== RENDER: QUIZ - PERGUNTA ATIVA ======
function displayQuizPergunta() {
  hideAllModes();
  el.quizQuestionMode?.classList.remove('hidden');
  showContent();

  if (!perguntaAtual) return;

  if (el.quizProgress && quizAtual) {
    el.quizProgress.textContent = `Pergunta ${quizAtual.pergunta_atual}/${quizAtual.total_perguntas}`;
  }

  if (el.quizQuestionText) {
    el.quizQuestionText.textContent = perguntaAtual.pergunta || '';
  }

  // Countdown da pergunta
  const tempoLimite = perguntaAtual.tempo_limite || 30;

  if (el.quizCountdownContainer) {
    el.quizCountdownContainer.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; width: 100%;">
        <div class="countdown-display">
          <span id="countdownPerguntaNumero" class="countdown-number">${tempoLimite}</span>
          <span class="countdown-label">segundos</span>
        </div>
      </div>
    `;
  }

  if (countdownPerguntaTimer) clearInterval(countdownPerguntaTimer);

  let timeLeft = tempoLimite;
  const display = document.getElementById('countdownPerguntaNumero');
  const countdownDiv = document.querySelector('.countdown-display');

  countdownPerguntaTimer = setInterval(() => {
    timeLeft--;
    if (display) display.textContent = timeLeft;
    
    // Urgente nos últimos 5s
    if (timeLeft <= 5 && countdownDiv) {
      countdownDiv.classList.add('countdown-urgent');
    }
    
    if (timeLeft <= 0) {
      clearInterval(countdownPerguntaTimer);
      countdownPerguntaTimer = null;
    }
  }, 1000);
}

// ====== RENDER: QUIZ - AGUARDANDO ======
function displayQuizAguardando() {
  displayEmptyMode();
  
  // Pode customizar se quiser mensagem específica
  const emptyDiv = document.querySelector('#emptyMode p');
  if (emptyDiv) {
    emptyDiv.textContent = 'Aguardando próxima pergunta...';
  }
}

// ====== BROADCAST (CARREGAR / REALTIME) ======
async function carregarBroadcast() {
  try {
    const { data, error } = await supabase
      .from('cnv25_broadcast_controle')
      .select('enquete_ativa, mostrar_resultado_enquete, modo_global, pergunta_exibida, quiz_ativo, quiz_countdown_state')
      .eq('id', 1)
      .single();
    if (error) throw error;

    broadcast.pergunta_exibida = data?.pergunta_exibida || null;
    broadcast.enquete_ativa = data?.enquete_ativa || null;
    broadcast.mostrar_resultado_enquete = !!data?.mostrar_resultado_enquete;
    broadcast.modo_global = data?.modo_global || null;
    broadcast.quiz_ativo = data?.quiz_ativo || null;
    broadcast.quiz_countdown_state = data?.quiz_countdown_state || null; // 🔥 NOVO

    decidirOQueExibir();
  } catch (e) {
    console.error('carregarBroadcast:', e);
    broadcast = {
      enquete_ativa: null,
      mostrar_resultado_enquete: false,
      modo_global: null,
      pergunta_exibida: null,
      quiz_ativo: null,
      quiz_countdown_state: null
    };
    displayEmptyMode();
  }
}

function conectarRealtimeBroadcast() {
  if (canalBroadcast) return;

  canalBroadcast = supabase
    .channel('telao_broadcast')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'cnv25_broadcast_controle',
      filter: 'id=eq.1'
    }, async (payload) => {
      broadcast.pergunta_exibida = payload.new?.pergunta_exibida || null;
      broadcast.enquete_ativa = payload.new?.enquete_ativa || null;
      broadcast.mostrar_resultado_enquete = !!payload.new?.mostrar_resultado_enquete;
      broadcast.modo_global = payload.new?.modo_global || null;
      broadcast.quiz_ativo = payload.new?.quiz_ativo || null;
      broadcast.quiz_countdown_state = payload.new?.quiz_countdown_state || null; // 🔥 NOVO
      decidirOQueExibir();
    })
    // Escutar revelação de pergunta
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'cnv25_quiz_perguntas'
    }, async (payload) => {
      if (payload.new.revelada && perguntaAtual && payload.new.id === perguntaAtual.id) {
        perguntaAtual = payload.new;
        // Mostra resultado quando revelar
        await exibirResultadoQuiz();
      }
    })
    .subscribe();
}

async function exibirRankingQuiz() {
  if (!quizAtivo?.id) return;
  
  try {
    const { data: ranking, error } = await supabase
      .rpc('cnv25_quiz_ranking', { quiz_uuid: quizAtivo.id });
    
    if (error) throw error;
    
    const top10 = (ranking || []).slice(0, 10);
    
    let html = `
      <div class="p-8">
        <h1 class="text-6xl font-bold text-center mb-8">🏆 RANKING</h1>
        <div class="space-y-4">
    `;
    
    top10.forEach((item, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}º`;
      html += `
        <div class="bg-white rounded-lg p-6 shadow-lg flex items-center justify-between">
          <div class="flex items-center gap-4">
            <span class="text-4xl font-bold">${medal}</span>
            <span class="text-2xl">Participante ${item.device_id_hash.substring(0, 8)}</span>
          </div>
          <div class="text-right">
            <div class="text-3xl font-bold text-green-600">${item.pontos_totais} pts</div>
            <div class="text-lg text-gray-600">${item.total_acertos} acertos</div>
          </div>
        </div>
      `;
    });
    
    html += `</div></div>`;
    
    if (el.quizQuestionContainer) {
      el.quizQuestionContainer.innerHTML = html;
    }
    
  } catch (err) {
    console.error('Erro ao exibir ranking:', err);
  }
}

// ====== DECISOR (UMA COISA POR VEZ) ======
async function decidirOQueExibir() {
  // "Semáforo" global
  if (broadcast.modo_global === 'enquete') {
    if (!broadcast.enquete_ativa) {
      displayEmptyMode();
      return;
    }

    const enquete = await fetchEnquete(broadcast.enquete_ativa);
    if (!enquete) {
      displayEmptyMode();
      return;
    }

    if (broadcast.mostrar_resultado_enquete) {
      const resultado = await fetchResultadoEnquete(enquete.id);
      displayPollResult(enquete, resultado);
    } else {
      displayPoll(enquete);
    }
    return;
  }

  if (broadcast.modo_global === 'perguntas') {
    if (!broadcast.pergunta_exibida) {
      displayEmptyMode();
      return;
    }
    const pergunta = await fetchPergunta(broadcast.pergunta_exibida);
    if (!pergunta) {
      displayEmptyMode();
      return;
    }
    displayPergunta(pergunta);
    return;
  }

  // 🔥 QUIZ COM ESTADOS
  if (broadcast.modo_global === 'quiz') {

    if (broadcast.mostrar_ranking_quiz) {
      await exibirRankingQuiz();
      return;
    }
    
    if (!broadcast.quiz_ativo) {
      displayEmptyMode();
      return;
    }

    quizAtual = await fetchQuiz(broadcast.quiz_ativo);
    if (!quizAtual || !quizAtual.pergunta_atual) {
      displayEmptyMode();
      return;
    }

    perguntaAtual = await fetchPerguntaQuiz(quizAtual.id, quizAtual.pergunta_atual);
    if (!perguntaAtual) {
      displayEmptyMode();
      return;
    }

    const state = broadcast.quiz_countdown_state;

    // 🔥 COUNTDOWN INICIAL (3s)
    if (state === 'countdown_inicial') {
      displayQuizCountdownInicial();
      return;
    }

    // 🔥 PERGUNTA ATIVA (com countdown)
    if (state === 'pergunta_ativa') {
      displayQuizPergunta();
      return;
    }

    // 🔥 AGUARDANDO PRÓXIMA
    if (state === 'aguardando_proxima') {
      displayQuizAguardando();
      return;
    }

    // Default: aguardando
    displayQuizAguardando();
    return;
  }

  displayEmptyMode();
}

// ====== RENDER: QUIZ - RESULTADO (APÓS REVELAR) ======
async function exibirResultadoQuiz() {
  if (!perguntaAtual) return;

  hideAllModes();
  el.pollMode?.classList.remove('hidden');
  showContent();

  const labels = ['A', 'B', 'C', 'D'];
  const corretaIdx = perguntaAtual.resposta_correta;
  const corretaLabel = labels[corretaIdx];
  const corretaTexto = perguntaAtual.opcoes[corretaIdx];

  // Buscar estatísticas
  const { data: stats } = await supabase
    .from('cnv25_quiz_respostas')
    .select('resposta_escolhida, correta')
    .eq('quiz_pergunta_id', perguntaAtual.id);

  const distribuicao = [0, 0, 0, 0];
  let totalRespostas = 0;
  let totalAcertos = 0;

  (stats || []).forEach(r => {
    distribuicao[r.resposta_escolhida] = (distribuicao[r.resposta_escolhida] || 0) + 1;
    totalRespostas++;
    if (r.correta) totalAcertos++;
  });

  const percentualAcerto = totalRespostas > 0 ? Math.round((totalAcertos / totalRespostas) * 100) : 0;

  if (el.modeBadgeText) el.modeBadgeText.textContent = 'RESPOSTA CORRETA';
  if (el.voteHint) el.voteHint.classList.add('hidden');
  if (el.pollTitle) {
    el.pollTitle.textContent = `Resposta: ${corretaLabel}`;
    el.pollTitle.classList.remove('hidden');
  }

  if (el.pollBody) {
    el.pollBody.innerHTML = `
      <div class="w-full flex items-center justify-center">
        <div class="w-full max-w-5xl space-y-6">
          <!-- Resposta Correta Destaque -->
          <div class="bg-green-100 border-4 border-green-500 rounded-xl p-6 text-center">
            <p class="text-2xl font-bold text-green-800 mb-2">✓ RESPOSTA CORRETA</p>
            <p class="text-4xl font-bold">${corretaLabel}. ${escapeHtml(corretaTexto)}</p>
          </div>

          <!-- Estatísticas -->
          <div class="bg-blue-50 rounded-xl p-6 text-center">
            <p class="text-6xl font-bold text-blue-600">${percentualAcerto}%</p>
            <p class="text-lg text-gray-700">acertaram esta pergunta</p>
            <p class="text-sm text-gray-500 mt-2">${totalAcertos} de ${totalRespostas} participantes</p>
          </div>

          <!-- Distribuição de Respostas -->
          <div class="grid grid-cols-2 gap-4">
            ${perguntaAtual.opcoes.map((op, idx) => {
              const votos = distribuicao[idx] || 0;
              const pct = totalRespostas > 0 ? Math.round((votos / totalResposas) * 100) : 0;
              const isCorreta = idx === corretaIdx;
              const borderClass = isCorreta ? 'border-green-500 bg-green-50' : 'border-gray-300';
              const barColor = isCorreta ? 'bg-green-500' : 'bg-blue-500';

              return `
                <div class="border-2 ${borderClass} rounded-lg p-4">
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-bold text-lg">${labels[idx]}. ${escapeHtml(op)}</span>
                    ${isCorreta ? '<span class="text-green-600 text-2xl">✓</span>' : ''}
                  </div>
                  <div class="text-right text-sm text-gray-600 mb-2">${votos} votos (${pct}%)</div>
                  <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="h-2 rounded-full ${barColor}" style="width:${pct}%"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }
}

// ====== UTILS ======
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

// ====== BOOT ======
window.addEventListener('DOMContentLoaded', async () => {
  try {
    displayEmptyMode();
    await carregarBroadcast();
    conectarRealtimeBroadcast();
    console.log('✅ Telão ouvindo cnv25_broadcast_controle (broadcast global + quiz)');
  } catch (e) {
    console.error('Erro ao iniciar Telão:', e);
    displayEmptyMode();
  }
});

// ====== CLEANUP ======
window.addEventListener('beforeunload', () => {
  try {
    if (canalBroadcast) supabase.removeChannel(canalBroadcast);
    if (countdownInicialTimer) clearInterval(countdownInicialTimer);
    if (countdownPerguntaTimer) clearInterval(countdownPerguntaTimer);
  } catch (_) {}
});
