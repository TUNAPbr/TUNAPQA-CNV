// ============================================================
// TELÃO — Enquetes via BROADCAST GLOBAL (desacoplado de palestra)
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

  // placeholders para quiz futuro (mantidos para compatibilidade)
  quizQuestionMode: document.getElementById('quizQuestionMode'),
  quizResultMode: document.getElementById('quizResultMode'),
  quizProgress: document.getElementById('quizProgress'),
  quizQuestionText: document.getElementById('quizQuestionText'),
  quizCountdownContainer: document.getElementById('quizCountdownContainer'),
  correctAnswer: document.getElementById('correctAnswer'),
  accuracyPercentage: document.getElementById('accuracyPercentage'),
  chartQuizDisplay: document.getElementById('chartQuizDisplay'),
};

// ====== ESTADO ======
let currentMode = 'loading';

// broadcast global (enquetes/quiz sem vínculo com palestra)
let broadcast = {
  enquete_ativa: null,
  mostrar_resultado_enquete: false,
  modo_global: null, // 'enquete' | 'perguntas' | 'quiz' | null
};
let canalBroadcast = null;

// (opcional) se futuramente o telão voltar a exibir perguntas/quiz por palestra
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
  el.pollTitle.textContent = poll?.titulo || 'Enquete';
  el.pollBody.innerHTML = ''; // minimalista no telão (mantém seu visual clean)
  showMode('pollMode');
}

function displayPollResult(poll, resultado) {
  const labels = 'ABCDEFGHIJ'.split('');
  const opcoes = poll?.opcoes?.opcoes || [];
  const rows = resultado?.rows || [];
  const total = rows.reduce((acc, r) => acc + (r.votos || 0), 0);

  el.pollTitle.textContent = `Resultados — ${poll?.titulo || 'Enquete'}`;
  el.pollBody.innerHTML = opcoes.slice(0, 10).map((txt, idx) => {
    const v = rows.find(r => (r.opcao_index === idx || r.opcaoIndex === idx))?.votos || 0;
    const pct = total ? Math.round((v / total) * 100) : 0;
    return `
      <div class="border rounded-lg p-3">
        <div class="flex items-center justify-between">
          <div class="font-medium"><strong>${labels[idx]}.</strong> ${escapeHtml(txt)}</div>
          <div class="text-sm text-gray-600">${v} voto(s) • ${pct}%</div>
        </div>
        <div class="mt-2 w-full bg-gray-200 rounded-full h-2">
          <div class="h-2 rounded-full" style="width:${pct}%; background:#3b82f6"></div>
        </div>
      </div>
    `;
  }).join('');
  showMode('pollMode');
}

// ====== DATA FETCH (ENQUETE / RESULTADO) ======
async function fetchEnquete(enqueteId) {
  const { data, error } = await supabase
    .from('cnv25_enquetes')
    .select('*')
    .eq('id', enqueteId)
    .single();
  if (error) { console.error('fetchEnquete:', error); return null; }
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
  if (error) { console.error('fetchResultadoEnquete:', error); return { rows: [] }; }

  const cont = {};
  (rs || []).forEach(r => {
    const idx = parseInt(r.resposta?.opcaoIndex ?? r.resposta?.opcao_index ?? 0, 10) || 0;
    cont[idx] = (cont[idx] || 0) + 1;
  });
  const rows = Object.entries(cont).map(([k, v]) => ({ opcao_index: parseInt(k, 10), votos: v }));
  return { rows };
}

// ====== BROADCAST (CARREGAR / REALTIME) ======
async function carregarBroadcast() {
  try {
    const { data, error } = await supabase
      .from('cnv25_broadcast_controle')
      .select('enquete_ativa, mostrar_resultado_enquete, modo_global')
      .eq('id', 1)
      .single();
    if (error) throw error;

    broadcast.enquete_ativa = data?.enquete_ativa || null;
    broadcast.mostrar_resultado_enquete = !!data?.mostrar_resultado_enquete;
    broadcast.modo_global = data?.modo_global || null;

    decidirOQueExibir();
  } catch (e) {
    console.error('carregarBroadcast:', e);
    broadcast = { enquete_ativa: null, mostrar_resultado_enquete: false, modo_global: null };
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
      broadcast.enquete_ativa = payload.new?.enquete_ativa || null;
      broadcast.mostrar_resultado_enquete = !!payload.new?.mostrar_resultado_enquete;
      broadcast.modo_global = payload.new?.modo_global || null;
      decidirOQueExibir();
    })
    .subscribe();
}

// ====== DECISOR (UMA COISA POR VEZ) ======
async function decidirOQueExibir() {
  // O "semáforo" global manda no universo
  if (broadcast.modo_global === 'enquete') {
    if (!broadcast.enquete_ativa) { displayEmptyMode(); return; }

    const enquete = await fetchEnquete(broadcast.enquete_ativa);
    if (!enquete) { displayEmptyMode(); return; }

    if (broadcast.mostrar_resultado_enquete) {
      const resultado = await fetchResultadoEnquete(enquete.id);
      displayPollResult(enquete, resultado);
    } else {
      displayPoll(enquete);
    }
    return;
  }

  if (broadcast.modo_global === 'perguntas') {
    // hoje o telão não exibe formulário; fica aguardando conteúdo
    displayEmptyMode();
    return;
  }

  if (broadcast.modo_global === 'quiz') {
    // quando migrarmos quiz p/ broadcast, pluga aqui as telas de quiz
    displayEmptyMode();
    return;
  }

  // sem modo definido
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

    // carrega broadcast (enquete global) + liga realtime
    await carregarBroadcast();
    conectarRealtimeBroadcast();

    console.log('✅ Telão ouvindo cnv25_broadcast_controle (enquetes)');
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
