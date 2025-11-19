// ============================================================
// TELÃO — Enquetes & Perguntas via BROADCAST GLOBAL (desacoplado)
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

  // placeholders de quiz (mantidos p/ compatibilidade futura)
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
  modo_global: null, // 'enquete' | 'perguntas' | 'quiz' | null
  pergunta_exibida: null,
  quiz_ativo: null
};
let canalBroadcast = null;

// (opcional) se futuramente voltarmos a usar palestra ativa
let canalPalestraAtiva = null;

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

  // 🔧 altura mínima dos cards de opção (em pixels)
  const OPTION_CARD_MIN_HEIGHT = 100; // mude aqui: 100, 140, 160...

  const labels = 'ABCDEFGHIJ'.split('');
  const opcoesRaw = Array.isArray(poll?.opcoes)
    ? poll.opcoes
    : (poll?.opcoes?.opcoes || []);
  const opcoes = opcoesRaw.slice(0, 10);
  const rows = resultado?.rows || [];
  const total = rows.reduce((acc, r) => acc + (r.votos || 0), 0);

  // Título no telão: somente o título da enquete
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
  if (el.voteHint) el.voteHint.classList.add('hidden'); // não mostra "vote" em pergunta

  // tira o "Pergunta em destaque"
  if (el.pollTitle) {
    el.pollTitle.textContent = '';            // sem texto
    el.pollTitle.classList.add('hidden');     // esconde o <h2>
  }

  if (el.pollBody) {
    const autor = pergunta.anonimo ? 'Anônimo' : (pergunta.nome_opt || 'Participante');
    // Card com altura padrão para acomodar ~140 caracteres e manter estética fixa
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
  // 1) tenta view agregada
  let viaView = true;
  const resView = await supabase
    .from('cnv25_enquete_resultado_v')
    .select('*')
    .eq('enquete_id', enqueteId);
  if (resView.error) viaView = false;

  if (viaView) {
    return { rows: resView.data || [] };
  }

  // 2) fallback: agrega no cliente
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

// ====== BROADCAST (CARREGAR / REALTIME) ======
async function carregarBroadcast() {
  try {
    const { data, error } = await supabase
      .from('cnv25_broadcast_controle')
      .select('enquete_ativa, mostrar_resultado_enquete, modo_global, pergunta_exibida')
      .eq('id', 1)
      .single();
    if (error) throw error;

    broadcast.pergunta_exibida = data?.pergunta_exibida || null;
    broadcast.enquete_ativa = data?.enquete_ativa || null;
    broadcast.mostrar_resultado_enquete = !!data?.mostrar_resultado_enquete;
    broadcast.modo_global = data?.modo_global || null;
    broadcast.quiz_ativo = payload.new.quiz_ativo ?? broadcast.quiz_ativo;

    decidirOQueExibir();
  } catch (e) {
    console.error('carregarBroadcast:', e);
    broadcast = {
      enquete_ativa: null,
      mostrar_resultado_enquete: false,
      modo_global: null,
      pergunta_exibida: null
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
      broadcast.quiz_ativo = payload.new.quiz_ativo ?? broadcast.quiz_ativo;
      decidirOQueExibir();
    })
    .subscribe();
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
    // EXIBIR PERGUNTA EM DESTAQUE
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

  if (broadcast.modo_global === 'quiz') {
    // placeholder — implementação de quiz no telão pode vir depois
    displayEmptyMode();
    return;
  }

  displayEmptyMode();
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
    // visual inicial
    displayEmptyMode();

    // carrega broadcast + liga realtime
    await carregarBroadcast();
    conectarRealtimeBroadcast();

    console.log('✅ Telão ouvindo cnv25_broadcast_controle (broadcast global)');
  } catch (e) {
    console.error('Erro ao iniciar Telão:', e);
    displayEmptyMode();
  }
});

// ====== CLEANUP ======
window.addEventListener('beforeunload', () => {
  try {
    if (canalBroadcast) supabase.removeChannel(canalBroadcast);
    if (canalPalestraAtiva) supabase.removeChannel(canalPalestraAtiva);
  } catch (_) {}
});
