// =====================================================
// PARTICIPANTE v2 — Enquete via BROADCAST global
// Perguntas/Quiz continuam por palestra
// =====================================================

// -------------------------
//  UTILIDADES DE DOM
// -------------------------
function validarElemento(id) {
  const el = document.getElementById(id);
  if (!el) console.warn(`⚠️ Elemento não encontrado: ${id}`);
  return el;
}

function validarElementosHTML() {
  const ids = [
    'loading','semPalestra','conteudo',
    // cabeçalho do card
    'cardHeader','cardHeadTitle','cardHeadSubtitle',
    // perguntas
    'secaoPerguntas','statusPerguntas','btnEnviar','textoPergunta',
    'nomeParticipante','emailParticipante','contador','contadorEnviadas','limiteDinamico','feedbackPergunta',
    // enquete
    'secaoEnquete','tituloEnquete','opcoesEnquete','feedbackEnquete',
    // quiz
    'secaoQuiz','progressoQuiz','quizAguardando','quizPergunta','quizFinalizado',
    'numPergunta','textoPerguntaQuiz','opcoesQuiz','feedbackQuiz','pontuacaoFinal','acertosFinal'
  ];
  const faltando = ids.filter(id => !document.getElementById(id));
  if (faltando.length) {
    console.error('❌ Elementos HTML faltando:', faltando);
    alert('Erro na página: elementos HTML faltando. Verifique o console.');
    return false;
  }
  return true;
}

// -------------------------
//  ESTADO GLOBAL
// -------------------------
let modoAtual = 'aguardando';

// Palestra (Perguntas/Quiz)
let palestraId = null;
let palestra = null;
let controle = null;

// Device
let deviceId = null;
let deviceIdHash = null;

// Enquete (via BROADCAST)
let broadcast = { 
  enquete_ativa: null, 
  mostrar_resultado_enquete: false, 
  modo_global: null,
  quiz_ativo: null
};
let canalBroadcast = null;
let enqueteAtiva = null;   // objeto da enquete ativa (se houver)
let jaVotou = false;

// Quiz por palestra
let quizAtivo = null;
let perguntaAtual = null;
let tempoInicio = null;
let pontuacaoTotal = 0;
let acertosTotal = 0;

// Realtime por palestra
let canalPalestraAtiva = null;
let canalPalestra = null;
let canalControle = null;
let canalEnquete = null; // para ouvir UPDATE da enquete específica
let canalQuiz = null;

// Countdown (fallback seguro)
if (!('CountdownTimer' in window)) {
  class SimpleCountdownTimer {
    constructor({ duration, onTick, onComplete }) {
      this.duration = duration || 30;
      this.left = this.duration;
      this.onTick = onTick;
      this.onComplete = onComplete;
      this.t = null;
    }
    start() {
      this.stop();
      if (this.onTick) this.onTick(this.left);
      this.t = setInterval(() => {
        this.left--;
        if (this.onTick) this.onTick(this.left);
        if (this.left <= 0) {
          this.stop();
          if (this.onComplete) this.onComplete();
        }
      }, 1000);
    }
    stop() { if (this.t) { clearInterval(this.t); this.t = null; } }
  }
  window.CountdownTimer = SimpleCountdownTimer;
}

// -------------------------
//  UI BÁSICA
// -------------------------
function mostrarLoading() {
  const loading = validarElemento('loading');
  const semPalestra = validarElemento('semPalestra');
  const conteudo = validarElemento('conteudo');
  loading?.classList.remove('hidden');
  semPalestra?.classList.add('hidden');
  conteudo?.classList.add('hidden');
}

function mostrarSemPalestra() {
  const loading = validarElemento('loading');
  const semPalestra = validarElemento('semPalestra');
  const conteudo = validarElemento('conteudo');
  loading?.classList.add('hidden');
  semPalestra?.classList.remove('hidden');
  conteudo?.classList.add('hidden');
}

function mostrarConteudo() {
  const loading = validarElemento('loading');
  const semPalestra = validarElemento('semPalestra');
  const conteudo = validarElemento('conteudo');
  loading?.classList.add('hidden');
  semPalestra?.classList.add('hidden');
  conteudo?.classList.remove('hidden');
}

function mostrarFeedback(elementId, tipo, mensagem) {
  const _tipo = (tipo === 'warning') ? 'info' : tipo;
  const feedback = document.getElementById(elementId);
  if (!feedback) return;
  const classes = {
    sucesso: 'bg-green-100 border-l-4 border-green-500 text-green-800',
    erro:    'bg-red-100 border-l-4 border-red-500 text-red-800',
    info:    'bg-blue-100 border-l-4 border-blue-500 text-blue-800'
  };
  feedback.className = `mt-4 p-4 rounded-lg ${classes[_tipo] || classes.info}`;
  feedback.innerHTML = `<strong>${_tipo === 'sucesso' ? '✓' : _tipo === 'erro' ? '✗' : 'ℹ'}</strong> ${mensagem}`;
  feedback.classList.remove('hidden');
  if (_tipo === 'sucesso' || _tipo === 'info') {
    setTimeout(() => feedback.classList.add('hidden'), 5000);
  }
}

function esc(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

// -------------------------
//  DERIVAÇÃO DE MODO (UMA COISA POR VEZ)
// -------------------------
function derivarModo() {
  // O semáforo global manda no universo
  if (broadcast?.modo_global === 'enquete' && enqueteAtiva) return 'enquete';
  if (broadcast?.modo_global === 'quiz' && quizAtivo) return 'quiz';
  if (broadcast?.modo_global === 'perguntas' && (controle?.perguntas_abertas && !controle?.silencio_ativo)) return 'perguntas';
  return 'aguardando';
}

function aplicarModo(novoModo) {
  if (novoModo === modoAtual) return;

  // Se estava em quiz e vamos sair, para o countdown
  if (modoAtual === 'quiz' && typeof _countdownInstance !== 'undefined' && _countdownInstance) {
    try { _countdownInstance.stop(); } catch {}
  }

  modoAtual = novoModo;

  const cardAguardando = document.getElementById('cardAguardando');
  const sPerg = document.getElementById('secaoPerguntas');
  const sEnq  = document.getElementById('secaoEnquete');
  const sQuiz = document.getElementById('secaoQuiz');

  cardAguardando?.classList.add('hidden');
  sPerg?.classList.add('hidden');
  sEnq?.classList.add('hidden');
  sQuiz?.classList.add('hidden');

  if (novoModo === 'aguardando') cardAguardando?.classList.remove('hidden');
  if (novoModo === 'perguntas')  sPerg?.classList.remove('hidden');
  if (novoModo === 'enquete')    sEnq?.classList.remove('hidden');
  if (novoModo === 'quiz')       sQuiz?.classList.remove('hidden');

  renderCardHeader();
}

function renderCardHeader() {
  const header = document.getElementById('cardHeader');
  const t = document.getElementById('cardHeadTitle');
  const s = document.getElementById('cardHeadSubtitle');
  if (!header || !t || !s) return;

  if (modoAtual === 'aguardando') { header.classList.add('hidden'); return; }
  header.classList.remove('hidden');

  if (modoAtual === 'enquete') {
    t.textContent = 'Enquete';
    s.textContent = enqueteAtiva?.titulo || '—';
    return;
  }
  if (modoAtual === 'perguntas') {
    t.textContent = 'Perguntas';
    const tema = palestra?.titulo || '—';
    const palestr = palestra?.palestrante || '—';
    s.textContent = `${tema} — ${palestr}`;
    return;
  }
  if (modoAtual === 'quiz') {
    t.textContent = 'Quiz';
    const atual = quizAtivo?.pergunta_atual || 0;
    const total = quizAtivo?.total_perguntas || 0;
    s.textContent = total ? `Pergunta ${atual}/${total}` : '—';
  }
}

// -------------------------
//  INICIALIZAÇÃO
// -------------------------
async function inicializar() {
  console.log('👤 Participante v2 inicializando...');
  if (!validarElementosHTML()) return;

  deviceId = getDeviceId();
  deviceIdHash = await hashDeviceId(deviceId);

  // RT: palestra ativa (perguntas/quiz)
  conectarRealtimePalestraAtiva();
  // RT: broadcast global (enquete)
  conectarRealtimeBroadcast();

  // Carga inicial
  await Promise.all([
    carregarPalestraAtiva(),
    carregarBroadcast()
  ]);

  configurarListeners();
}

// -------------------------
//  BROADCAST (ENQUETE GLOBAL)
// -------------------------
async function carregarBroadcast() {
  try {
    const { data } = await window.supabase
      .from('cnv25_broadcast_controle')
      .select('enquete_ativa, mostrar_resultado_enquete, modo_global, quiz_ativo')
      .eq('id', 1)
      .single();

    broadcast.enquete_ativa = data?.enquete_ativa || null;
    broadcast.mostrar_resultado_enquete = !!data?.mostrar_resultado_enquete;
    broadcast.modo_global = data?.modo_global || null;
    broadcast.quiz_ativo = data?.quiz_ativo || null;

    await carregarEnqueteViaBroadcast();
  } catch (e) {
    console.error('Erro ao carregar broadcast:', e);
    broadcast = { enquete_ativa: null, mostrar_resultado_enquete: false, modo_global: null };
    enqueteAtiva = null;
    jaVotou = false;
    atualizarSecaoEnquete();
    aplicarModo(derivarModo());
  }
}

function conectarRealtimeBroadcast() {
  if (canalBroadcast) return;
  canalBroadcast = window.supabase
    .channel('participante_broadcast')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'cnv25_broadcast_controle',
      filter: 'id=eq.1'
    }, async (payload) => {
      broadcast.enquete_ativa = payload?.new?.enquete_ativa || null;
      broadcast.mostrar_resultado_enquete = !!payload?.new?.mostrar_resultado_enquete;
      broadcast.modo_global = payload?.new?.modo_global || null;
      await carregarEnqueteViaBroadcast();
      await carregarQuizViaBroadcast();
    })
    .subscribe();
}

async function carregarEnqueteViaBroadcast() {
  if (!broadcast.enquete_ativa) {
    enqueteAtiva = null;
    jaVotou = false;
    if (canalEnquete) { window.supabase.removeChannel(canalEnquete); canalEnquete = null; }
    atualizarSecaoEnquete();
    aplicarModo(derivarModo());
    return;
  }

  try {
    const { data, error } = await window.supabase
      .from('cnv25_enquetes')
      .select('*')
      .eq('id', broadcast.enquete_ativa)
      .single();
    if (error) throw error;

    enqueteAtiva = data || null;
    jaVotou = enqueteAtiva ? await verificouVotouEnquete(enqueteAtiva.id, deviceIdHash) : false;

    conectarRealtimeEnquete();
    atualizarSecaoEnquete();
    aplicarModo(derivarModo());
  } catch (e) {
    console.error('Erro ao carregar enquete ativa via broadcast:', e);
    enqueteAtiva = null;
    jaVotou = false;
    atualizarSecaoEnquete();
    aplicarModo(derivarModo());
  }
}

async function carregarQuizViaBroadcast() {
  if (!broadcast.quiz_ativo || broadcast.modo_global !== 'quiz') {
    quizAtivo = null;
    perguntaAtual = null;
    atualizarSecaoQuiz();
    return;
  }

  // Buscar quiz por ID, sem palestra
  try {
    const { data: quiz, error } = await window.supabase
      .from('cnv25_quiz')
      .select('*')
      .eq('id', broadcast.quiz_ativo)
      .single();

    if (error) throw error;

    quizAtivo = quiz || null;

    if (quizAtivo) {
      await carregarPerguntaAtualQuiz();
      conectarRealtimeQuiz();
    } else {
      perguntaAtual = null;
    }

    atualizarSecaoQuiz();
  } catch (e) {
    console.error('Erro em carregarQuizViaBroadcast:', e);
    quizAtivo = null;
    perguntaAtual = null;
    atualizarSecaoQuiz();
  }
}

function conectarRealtimeEnquete() {
  if (!enqueteAtiva) {
    if (canalEnquete) { window.supabase.removeChannel(canalEnquete); canalEnquete = null; }
    return;
  }
  if (canalEnquete) window.supabase.removeChannel(canalEnquete);

  canalEnquete = window.supabase
    .channel(`enquete:${enqueteAtiva.id}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'cnv25_enquetes',
      filter: `id=eq.${enqueteAtiva.id}`
    }, (payload) => {
      enqueteAtiva = payload.new;
      atualizarSecaoEnquete();
      aplicarModo(derivarModo());
    })
    .subscribe();
}

// -------------------------
//  PALESTRA ATIVA (PERGUNTAS/QUIZ)
// -------------------------
function conectarRealtimePalestraAtiva() {
  if (canalPalestraAtiva) return;

  canalPalestraAtiva = window.supabase
    .channel('palestra_ativa_part_v2')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'cnv25_palestra_ativa',
      filter: 'id=eq.1'
    }, async (payload) => {
      const novoId = payload?.new?.palestra_id || null;
      if (novoId !== palestraId) {
        await carregarPalestraAtiva();
      }
    })
    .subscribe();
}

async function carregarPalestraAtiva() {
  try {
    mostrarLoading();

    const { data: pa } = await window.supabase
      .from('cnv25_palestra_ativa')
      .select('palestra_id')
      .eq('id', 1)
      .single();

    const novaPalestraId = pa?.palestra_id || null;

    if (!novaPalestraId) {
      desconectarCanaisPalestra();
      palestraId = null;
      palestra = null;
      controle = null;
      quizAtivo = null;

      // Conteúdo pode ter ENQUETE via broadcast, então não mostramos "sem palestra"
      mostrarConteudo();
      atualizarUI();
      aplicarModo(derivarModo());
      return;
    }

    if (palestraId && palestraId !== novaPalestraId) {
      desconectarCanaisPalestra();
    }

    palestraId = novaPalestraId;

    await carregarPalestra();
    await carregarControle();

    conectarRealtimePalestra();

    mostrarConteudo();
    atualizarUI();
    await atualizarContadorEnviadas();
    aplicarModo(derivarModo());

  } catch (err) {
    console.error('Erro em carregarPalestraAtiva:', err);
    mostrarConteudo();
    atualizarUI();
    aplicarModo(derivarModo());
  }
}

async function carregarPalestra() {
  palestra = await obterPalestra(palestraId);
  if (!palestra) throw new Error('Palestra não encontrada');
}

async function carregarControle() {
  const { data, error } = await window.supabase
    .from('cnv25_palestra_controle')
    .select('*')
    .eq('palestra_id', palestraId)
    .single();

  if (error) {
    console.warn('Sem controle específico para a palestra, usando defaults.');
    controle = { perguntas_abertas: false, silencio_ativo: false };
  } else {
    controle = data;
  }
}

function conectarRealtimePalestra() {
  if (!canalPalestra) {
    canalPalestra = window.supabase
      .channel(`palestra:${palestraId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'cnv25_palestras',
        filter: `id=eq.${palestraId}`
      }, (payload) => {
        palestra = payload.new;
        atualizarUI();
      })
      .subscribe();
  }

  if (!canalControle) {
    canalControle = window.supabase
      .channel(`controle:${palestraId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cnv25_palestra_controle',
        filter: `palestra_id=eq.${palestraId}`
      }, async (payload) => {
        controle = payload.new || controle;
        atualizarUI();
        aplicarModo(derivarModo());
      })
      .subscribe();
  }
}

function desconectarCanaisPalestra() {
  try {
    if (canalPalestra) window.supabase.removeChannel(canalPalestra);
    if (canalControle) window.supabase.removeChannel(canalControle);
    if (canalQuiz) window.supabase.removeChannel(canalQuiz);
  } catch (e) {
    console.warn('Erro ao remover canais de palestra (ignorado):', e);
  } finally {
    canalPalestra = canalControle = canalQuiz = null;
  }
}

// -------------------------
//  UI — ATUALIZAÇÃO GERAL
// -------------------------
function atualizarUI() {
  atualizarSecaoPerguntas();
  atualizarSecaoEnquete();
  atualizarSecaoQuiz();
  // cabeçalho do card é atualizado dentro de aplicarModo()
}

// -------------------------
//  SEÇÃO: PERGUNTAS
// -------------------------
function atualizarSecaoPerguntas() {
  const secao = validarElemento('secaoPerguntas');
  if (!secao) return;

  const statusEl = validarElemento('statusPerguntas');
  const btnEnviar = validarElemento('btnEnviar');

  const aberta = !!(controle?.perguntas_abertas && !controle?.silencio_ativo);

  if (aberta) {
    secao.classList.remove('inactive');
    if (btnEnviar) btnEnviar.disabled = false;
  } else {
    secao.classList.add('inactive');
    if (btnEnviar) btnEnviar.disabled = true;
  }

  // Não exibir mais o chip de status ("ABERTAS", "FECHADAS", etc.)
  if (statusEl) {
    statusEl.textContent = '';
    statusEl.className = 'hidden';
  }

  const limiteDinamico = validarElemento('limiteDinamico');
  if (limiteDinamico && palestra) {
    limiteDinamico.textContent = palestra.max_perguntas || 3;
  }
}


function configurarListeners() {
  const textarea = document.getElementById('textoPergunta');
  const contador = document.getElementById('contador');
  if (textarea && contador) {
    textarea.addEventListener('input', function () {
      const length = this.value.length;
      contador.textContent = `${length} / 140`;
    });
  }

  const form = document.getElementById('formPergunta');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await enviarPergunta();
    });
  }
}

async function enviarPergunta() {
  if (!palestraId) return;

  const btnEnviar = document.getElementById('btnEnviar');
  const texto = (document.getElementById('textoPergunta')?.value || '').trim();
  const nome = (document.getElementById('nomeParticipante')?.value || '').trim();
  const email = (document.getElementById('emailParticipante')?.value || '').trim();

  if (btnEnviar) { btnEnviar.disabled = true; btnEnviar.textContent = 'Enviando...'; }

  try {
    const erros = validarPergunta(texto);
    if (erros.length > 0) {
      mostrarFeedback('feedbackPergunta', 'erro', erros.join('. '));
      return;
    }

    if (email && !validarEmail(email)) {
      mostrarFeedback('feedbackPergunta', 'erro', 'Email inválido');
      return;
    }

    const aberta = await verificarPerguntasAbertas(palestraId);
    if (!aberta) {
      mostrarFeedback('feedbackPergunta', 'erro', 'Perguntas fechadas');
      return;
    }

    const intervalo = palestra?.intervalo_perguntas || 60;
    const rate = verificarRateLimitDinamico(intervalo);
    if (!rate.permitido) {
      mostrarFeedback('feedbackPergunta', 'erro', `Aguarde ${rate.segundosRestantes}s`);
      return;
    }

    const total = await contarPerguntasDevice(palestraId, deviceIdHash);
    const maxPerguntas = palestra?.max_perguntas || 3;
    if (total >= maxPerguntas) {
      mostrarFeedback('feedbackPergunta', 'erro', `Limite de ${maxPerguntas} perguntas atingido`);
      return;
    }

    const nonce = crypto.randomUUID();
    const perguntaData = {
      palestra_id: palestraId,
      texto,
      nome_opt: nome || null,
      email_opt: email || null,
      anonimo: !nome,
      device_id_hash: deviceIdHash,
      nonce,
      status: 'pendente'
    };

    const { error } = await window.supabase
      .from('cnv25_perguntas')
      .insert([perguntaData])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        mostrarFeedback('feedbackPergunta', 'erro', 'Pergunta já enviada');
      } else {
        throw error;
      }
      return;
    }

    registrarEnvio();
    mostrarFeedback('feedbackPergunta', 'sucesso', 'Pergunta enviada! Aguarde aprovação.');

    // Reset campos
    const tp = document.getElementById('textoPergunta');
    const np = document.getElementById('nomeParticipante');
    const ep = document.getElementById('emailParticipante');
    const cont = document.getElementById('contador');
    if (tp) tp.value = '';
    if (np) np.value = '';
    if (ep) ep.value = '';
    if (cont) cont.textContent = '0 / 140';

    await atualizarContadorEnviadas();

  } catch (error) {
    console.error('Erro ao enviar pergunta:', error);
    mostrarFeedback('feedbackPergunta', 'erro', 'Erro ao enviar');
  } finally {
    if (btnEnviar) { btnEnviar.disabled = false; btnEnviar.textContent = 'Enviar Pergunta'; }
  }
}

async function atualizarContadorEnviadas() {
  if (!palestraId) return;
  try {
    const total = await contarPerguntasDevice(palestraId, deviceIdHash);
    const el = document.getElementById('contadorEnviadas');
    if (el) el.textContent = total;

    const maxPerguntas = palestra?.max_perguntas || 3;
    const btn = document.getElementById('btnEnviar');
    if (btn && total >= maxPerguntas) btn.disabled = true;
  } catch (e) {
    console.error('Erro ao contar enviadas:', e);
  }
}

// -------------------------
//  SEÇÃO: ENQUETE (via BROADCAST)
// -------------------------
function labelsAte10(){ return 'ABCDEFGHIJ'.split(''); }

async function fetchResultadoEnquete(enqueteId){
  // tenta view agregada; fallback
  let viaView = true;
  const r1 = await window.supabase
    .from('cnv25_enquete_resultado_v')
    .select('*')
    .eq('enquete_id', enqueteId);
  if (r1.error) viaView = false;

  if (viaView) {
    return { rows: r1.data || [] };
  } else {
    const { data: rs, error } = await window.supabase
      .from('cnv25_enquete_respostas')
      .select('resposta')
      .eq('enquete_id', enqueteId);
    if (error) { console.error(error); return { rows: [] }; }
    const cont = {};
    (rs||[]).forEach(r=>{
      const idx = parseInt(r.resposta?.opcaoIndex ?? r.resposta?.opcao_index ?? 0, 10) || 0;
      cont[idx] = (cont[idx]||0) + 1;
    });
    const rows = Object.entries(cont).map(([k,v])=>({ opcao_index: parseInt(k,10), votos: v }));
    return { rows };
  }
}

function atualizarSecaoEnquete() {
  const secao = validarElemento('secaoEnquete');
  if (!secao) return;

  const titulo = validarElemento('tituloEnquete');
  const opcoesEl = validarElemento('opcoesEnquete');
  const feedback = validarElemento('feedbackEnquete');

  // Não queremos mais exibir um título logo abaixo do rótulo "Enquete",
  // então mantemos o elemento, mas sem texto.
  if (titulo) {
    titulo.textContent = '';
  }

  if (!enqueteAtiva) {
    if (opcoesEl) {
      opcoesEl.innerHTML = '<p class="text-sm text-gray-600">Nenhuma enquete ativa.</p>';
    }
    feedback?.classList.add('hidden');
    return;
  }

  const labels = labelsAte10();
  const opcoesRaw = Array.isArray(enqueteAtiva.opcoes)
    ? enqueteAtiva.opcoes
    : (enqueteAtiva.opcoes?.opcoes || []);
  const total = Math.min(opcoesRaw.length, 10);
  const opcoes = opcoesRaw.slice(0, total);

  if (!opcoes.length) {
    if (opcoesEl) {
      opcoesEl.innerHTML = '<p class="text-sm text-gray-600">Esta enquete não possui opções cadastradas.</p>';
    }
    return;
  }

  // Se já votou e estamos mostrando resultado no telão, mantém mensagem neutra
  if (feedback) {
    feedback.classList.add('hidden');
  }

  if (opcoesEl) {
    if (jaVotou) {
      opcoesEl.innerHTML = '<p class="text-sm text-gray-600">Você já votou. Aguardando resultados…</p>';
    } else {
      opcoesEl.innerHTML = opcoes.map((opcao, idx) => `
        <button
          class="w-full px-4 py-3 bg-gray-200 hover:bg-cnv-warning hover:text-white rounded-lg text-left transition font-medium"
          onclick="votarEnqueteParticipante(${idx})"
        >
          <strong>${labels[idx]}.</strong> ${esc(opcao)}
        </button>
      `).join('');
    }
  }
}


async function votarEnqueteParticipante(opcaoIndex) {
  if (!enqueteAtiva || jaVotou) return;
  try {
    const res = await votarEnquete(enqueteAtiva.id, deviceIdHash, opcaoIndex);
    if (res?.error) {
      mostrarFeedback('feedbackEnquete', 'erro', res.error);
      return;
    }
    jaVotou = true;
    mostrarFeedback('feedbackEnquete', 'sucesso', 'Voto registrado!');
    atualizarSecaoEnquete();
  } catch (e) {
    console.error('Erro ao votar:', e);
    mostrarFeedback('feedbackEnquete', 'erro', 'Erro ao votar');
  }
}

// -------------------------
//  SEÇÃO: QUIZ  (por palestra)
// -------------------------
async function carregarQuizAtivo() {
  quizAtivo = await obterQuizAtivo(palestraId);
  if (quizAtivo) {
    await carregarPerguntaAtualQuiz();
    conectarRealtimeQuiz();
  } else {
    perguntaAtual = null;
  }
  atualizarSecaoQuiz();
  aplicarModo(derivarModo());
}

async function carregarPerguntaAtualQuiz() {
  if (!quizAtivo || !quizAtivo.pergunta_atual || quizAtivo.pergunta_atual === 0) {
    perguntaAtual = null;
    return;
  }
  perguntaAtual = await obterPerguntaAtualQuiz(quizAtivo.id, quizAtivo.pergunta_atual);
  if (perguntaAtual) {
    const responded = await verificouRespondeuQuiz(perguntaAtual.id, deviceIdHash);
    if (responded) {
      perguntaAtual.jaRespondeu = true;
    } else {
      tempoInicio = Date.now();
      perguntaAtual.jaRespondeu = false;
    }
  }
}

function conectarRealtimeQuiz() {
  if (!quizAtivo) {
    if (canalQuiz) { window.supabase.removeChannel(canalQuiz); canalQuiz = null; }
    return;
  }
  if (canalQuiz) window.supabase.removeChannel(canalQuiz);

  canalQuiz = window.supabase
    .channel(`quiz:${quizAtivo.id}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'cnv25_quiz',
      filter: `id=eq.${quizAtivo.id}`
    }, async (payload) => {
      quizAtivo = payload.new;
      if (quizAtivo.status === 'finalizado') {
        await exibirResultadoFinal();
      } else {
        await aplicarModo(derivarModo());
      }
      atualizarSecaoQuiz();
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'cnv25_quiz_perguntas'
    }, (payload) => {
      if (perguntaAtual && payload.new.id === perguntaAtual.id && payload.new.revelada) {
        perguntaAtual = payload.new;
        exibirFeedbackResposta();
      }
    })
    .subscribe();
}

function atualizarSecaoQuiz() {
  const secao = validarElemento('secaoQuiz');
  if (!secao) return;

  if (!quizAtivo) {
    secao.classList.add('hidden');
    return;
  }
  secao.classList.remove('hidden');

  const progressoEl = validarElemento('progressoQuiz');
  if (progressoEl) {
    progressoEl.textContent = `${quizAtivo.pergunta_atual || 0}/${quizAtivo.total_perguntas || 0}`;
  }

  const aguardando = validarElemento('quizAguardando');
  const perguntaDiv = validarElemento('quizPergunta');
  const finalizado = validarElemento('quizFinalizado');

  if (!aguardando || !perguntaDiv || !finalizado) return;

  if (quizAtivo.status === 'finalizado') {
    aguardando.classList.add('hidden');
    perguntaDiv.classList.add('hidden');
    finalizado.classList.remove('hidden');
  } else if (!perguntaAtual || perguntaAtual.jaRespondeu) {
    aguardando.classList.remove('hidden');
    perguntaDiv.classList.add('hidden');
    finalizado.classList.add('hidden');
  } else {
    aguardando.classList.add('hidden');
    perguntaDiv.classList.remove('hidden');
    finalizado.classList.add('hidden');
    renderizarPerguntaQuiz();
  }
}

// Countdown integrado
let _countdownInstance = null;

function renderizarPerguntaQuiz() {
  const num = validarElemento('numPergunta');
  const txt = validarElemento('textoPerguntaQuiz');
  const opcoesContainer = validarElemento('opcoesQuiz');

  if (!perguntaAtual || !opcoesContainer) return;

  if (num && quizAtivo) num.textContent = `${quizAtivo.pergunta_atual}/${quizAtivo.total_perguntas}`;
  if (txt) txt.textContent = perguntaAtual.pergunta || '—';

  const labels = ['A','B','C','D'];
  const opcoes = (perguntaAtual.opcoes || []).slice(0, 4);

  const tempoLimite = perguntaAtual.tempo_limite || 30;
  const countdownHTML = `
    <div class="mb-4 text-center">
      <div class="inline-flex items-center gap-2 bg-cnv-warning bg-opacity-20 px-4 py-2 rounded-lg">
        <span class="text-2xl">⏱️</span>
        <span id="countdownDisplay" class="text-2xl font-bold text-cnv-warning">${tempoLimite}</span>
        <span class="text-sm text-gray-600">segundos</span>
      </div>
      <div class="mt-2 w-full bg-gray-200 rounded-full h-2">
        <div id="countdownBar" class="bg-cnv-warning h-2 rounded-full transition-all" style="width:100%"></div>
      </div>
    </div>
  `;

  opcoesContainer.innerHTML = countdownHTML + opcoes.map((opcao, idx) => `
    <button
      id="opcaoQuiz${idx}"
      onclick="responderQuizParticipante(${idx})"
      class="w-full px-4 py-3 bg-cnv-alternate hover:bg-cnv-warning hover:text-white rounded-lg text-left transition font-medium"
    >
      <strong>${labels[idx]}.</strong> ${esc(opcao)}
    </button>
  `).join('');

  if (_countdownInstance) _countdownInstance.stop();
  _countdownInstance = new CountdownTimer({
    duration: tempoLimite,
    onTick: (left) => {
      const display = document.getElementById('countdownDisplay');
      const bar = document.getElementById('countdownBar');
      if (display) {
        display.textContent = left;
        if (left <= 5) display.classList.add('text-red-600');
      }
      if (bar) {
        bar.style.width = (left / tempoLimite * 100) + '%';
        if (left <= 10) { bar.classList.remove('bg-cnv-warning'); bar.classList.add('bg-red-500'); }
      }
    },
    onComplete: () => {
      document.querySelectorAll('[id^="opcaoQuiz"]').forEach(btn => {
        btn.disabled = true; btn.classList.add('opacity-50','cursor-not-allowed');
      });
      mostrarFeedback('feedbackQuiz', 'info', '⏰ Tempo esgotado! Aguarde a revelação da resposta.');
      if (perguntaAtual) perguntaAtual.jaRespondeu = true;
      atualizarSecaoQuiz();
    }
  });
  _countdownInstance.start();
}

async function responderQuizParticipante(opcaoIndex) {
  if (!perguntaAtual || perguntaAtual.jaRespondeu) return;

  if (_countdownInstance) _countdownInstance.stop();

  const tempoResposta = Math.floor((Date.now() - (tempoInicio || Date.now())) / 1000);

  try {
    const resultado = await responderPerguntaQuiz(
      perguntaAtual.id,
      deviceIdHash,
      opcaoIndex,
      tempoResposta
    );

    if (resultado?.error) {
      mostrarFeedback('feedbackQuiz', 'erro', resultado.error);
      return;
    }

    perguntaAtual.jaRespondeu = true;
    perguntaAtual.minhaResposta = opcaoIndex;
    perguntaAtual.acertei = !!resultado.correta;
    perguntaAtual.pontos = resultado.pontos || 0;

    if (resultado.correta) {
      acertosTotal++;
      pontuacaoTotal += (resultado.pontos || 0);
    }

    mostrarFeedback('feedbackQuiz', 'info', '✓ Resposta registrada! Aguarde a revelação...');
    atualizarSecaoQuiz();

  } catch (e) {
    console.error('Erro ao responder quiz:', e);
    mostrarFeedback('feedbackQuiz', 'erro', 'Erro ao enviar resposta');
  }
}

function exibirFeedbackResposta() {
  if (!perguntaAtual) return;
  const labels = ['A', 'B', 'C', 'D'];
  const corretaLabel = labels[perguntaAtual.resposta_correta];

  if (perguntaAtual.acertei) {
    mostrarFeedback('feedbackQuiz', 'sucesso', `✓ Você acertou! Resposta: ${corretaLabel} | +${perguntaAtual.pontos} pontos`);
  } else {
    mostrarFeedback('feedbackQuiz', 'erro', `✗ Você errou. Resposta correta: ${corretaLabel}`);
  }
}

async function exibirResultadoFinal() {
  const p = validarElemento('pontuacaoFinal');
  const a = validarElemento('acertosFinal');
  if (p) p.textContent = pontuacaoTotal;
  if (a) a.textContent = acertosTotal;
}

// -------------------------
//  BOOT
// -------------------------
window.addEventListener('DOMContentLoaded', inicializar);

window.addEventListener('beforeunload', () => {
  try {
    if (canalPalestraAtiva) window.supabase.removeChannel(canalPalestraAtiva);
    if (canalBroadcast) window.supabase.removeChannel(canalBroadcast);
    if (canalEnquete) window.supabase.removeChannel(canalEnquete);
    desconectarCanaisPalestra();
  } catch (e) {}
});

console.log('✅ Participante v2 (broadcast enquetes + semáforo global) carregado');
