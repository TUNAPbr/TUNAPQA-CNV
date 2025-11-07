// =====================================================
// PARTICIPANTE v2 — SCRIPT CONSOLIDADO E CORRIGIDO
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
    'palestraTitulo','palestrante','statusGeral',
    'secaoPerguntas','statusPerguntas','btnEnviar','textoPergunta','nomeParticipante','emailParticipante','contador','contadorEnviadas','limiteDinamico','feedbackPergunta',
    'secaoEnquete','tituloEnquete','opcoesEnquete','feedbackEnquete',
    'secaoQuiz','progressoQuiz','quizAguardando','quizPergunta','quizFinalizado','numPergunta','textoPerguntaQuiz','opcoesQuiz','feedbackQuiz','pontuacaoFinal','acertosFinal'
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
let palestraId = null;
let palestra = null;
let controle = null;
let deviceId = null;
let deviceIdHash = null;

// Enquete
let enqueteAtiva = null;
let jaVotou = false;

// Quiz
let quizAtivo = null;
let perguntaAtual = null;
let tempoInicio = null;
let pontuacaoTotal = 0;
let acertosTotal = 0;

// Realtime
let canalPalestraAtiva = null;
let canalPalestra = null;
let canalControle = null;
let canalEnquete = null;
let canalQuiz = null;

// Countdown (fallback seguro): só registra se NÃO existir no global
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
    stop() {
      if (this.t) { clearInterval(this.t); this.t = null; }
    }
  }
  window.CountdownTimer = SimpleCountdownTimer;
}

// -------------------------
//  UI GENÉRICA
// -------------------------
function mostrarLoading() {
  const loading = validarElemento('loading');
  const semPalestra = validarElemento('semPalestra');
  const conteudo = validarElemento('conteudo');
  if (loading) loading.classList.remove('hidden');
  if (semPalestra) semPalestra.classList.add('hidden');
  if (conteudo) conteudo.classList.add('hidden');
}

function mostrarSemPalestra() {
  const loading = validarElemento('loading');
  const semPalestra = validarElemento('semPalestra');
  const conteudo = validarElemento('conteudo');
  if (loading) loading.classList.add('hidden');
  if (semPalestra) semPalestra.classList.remove('hidden');
  if (conteudo) conteudo.classList.add('hidden');
}

function mostrarConteudo() {
  const loading = validarElemento('loading');
  const semPalestra = validarElemento('semPalestra');
  const conteudo = validarElemento('conteudo');
  if (loading) loading.classList.add('hidden');
  if (semPalestra) semPalestra.classList.add('hidden');
  if (conteudo) conteudo.classList.remove('hidden');
}

function mostrarFeedback(elementId, tipo, mensagem) {
  // Mapeia 'warning' para 'info' para manter sua paleta/estilo
  const _tipo = (tipo === 'warning') ? 'info' : tipo;
  const feedback = document.getElementById(elementId);
  if (!feedback) return;

  const classes = {
    sucesso: 'bg-green-100 border-l-4 border-green-500 text-green-800',
    erro: 'bg-red-100 border-l-4 border-red-500 text-red-800',
    info: 'bg-blue-100 border-l-4 border-blue-500 text-blue-800'
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
//  INICIALIZAÇÃO
// -------------------------
async function inicializar() {
  console.log('👤 Participante v2 inicializando...');
  if (!validarElementosHTML()) return;

  // Identificador do dispositivo
  deviceId = getDeviceId();
  deviceIdHash = await hashDeviceId(deviceId);

  // Realtime: ouvir troca de palestra ativa
  conectarRealtimePalestraAtiva();

  // Carregar primeira vez
  await carregarPalestraAtiva();

  // Listeners de UI
  configurarListeners();
}

// -------------------------
//  PALESTRA ATIVA
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
      // se mudou o id, recarrega tudo
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
      // nenhuma palestra ativa
      desconectarCanais();
      palestraId = null;
      palestra = null;
      controle = null;
      enqueteAtiva = null;
      quizAtivo = null;
      mostrarSemPalestra();
      return;
    }

    // Se trocou de palestra, desconecta canais antigos antes de seguir
    if (palestraId && palestraId !== novaPalestraId) {
      desconectarCanais();
    }

    palestraId = novaPalestraId;

    // Carregar dados
    await carregarPalestra();
    await carregarControle();
    await carregarEnqueteAtiva(); // cuida de realtime da enquete
    await carregarQuizAtivo();    // cuida de realtime do quiz

    // Conectar realtime da palestra/controle
    conectarRealtimePalestra();

    // Atualiza UI inicial
    mostrarConteudo();
    atualizarUI();
    await atualizarContadorEnviadas();

  } catch (err) {
    console.error('Erro em carregarPalestraAtiva:', err);
    mostrarSemPalestra();
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
    controle = { perguntas_abertas: false, silencio_ativo: false, enquete_ativa: null };
  } else {
    controle = data;
  }
}

// -------------------------
//  REALTIME — PALESTRA E CONTROLE
// -------------------------
function conectarRealtimePalestra() {
  // Palestra
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

  // Controle
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

        // Mudança de enquete ativa pelo controle
        const novoId = payload?.new?.enquete_ativa || null;
        if ((enqueteAtiva?.id || null) !== (novoId || null)) {
          await carregarEnqueteAtiva();
        }
      })
      .subscribe();
  }
}

function desconectarCanais() {
  try {
    if (canalPalestra) window.supabase.removeChannel(canalPalestra);
    if (canalControle) window.supabase.removeChannel(canalControle);
    if (canalEnquete) window.supabase.removeChannel(canalEnquete);
    if (canalQuiz) window.supabase.removeChannel(canalQuiz);
  } catch (e) {
    console.warn('Erro ao remover canais (ignorado):', e);
  } finally {
    canalPalestra = canalControle = canalEnquete = canalQuiz = null;
  }
}

// -------------------------
//  UI — ATUALIZAÇÃO GERAL
// -------------------------
function atualizarUI() {
  if (!palestra || !controle) return;

  // Header
  const titulo = validarElemento('palestraTitulo');
  const palestrante = validarElemento('palestrante');
  const statusGeral = validarElemento('statusGeral');

  if (titulo) titulo.textContent = palestra.titulo || '—';
  if (palestrante) palestrante.textContent = palestra.palestrante || 'A definir';

  if (statusGeral) {
    if (controle.perguntas_abertas && !controle.silencio_ativo) {
      statusGeral.textContent = '✅ Ativo';
      statusGeral.className = 'px-4 py-2 rounded-full text-sm font-bold bg-green-500 text-white';
    } else {
      statusGeral.textContent = '⏸️ Pausado';
      statusGeral.className = 'px-4 py-2 rounded-full text-sm font-bold bg-gray-400 text-white';
    }
  }

  // Seções
  atualizarSecaoPerguntas();
  atualizarSecaoEnquete();
  atualizarSecaoQuiz();
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
    if (statusEl) {
      statusEl.textContent = '✅ ABERTAS';
      statusEl.className = 'ml-auto px-3 py-1 rounded-full text-xs font-bold bg-green-500 text-white';
    }
    if (btnEnviar) btnEnviar.disabled = false;
  } else {
    secao.classList.add('inactive');
    if (statusEl) {
      statusEl.textContent = controle?.silencio_ativo ? '🔇 SILÊNCIO' : '❌ FECHADAS';
      statusEl.className = 'ml-auto px-3 py-1 rounded-full text-xs font-bold bg-red-500 text-white';
    }
    if (btnEnviar) btnEnviar.disabled = true;
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
//  SEÇÃO: ENQUETE
// -------------------------
async function carregarEnqueteAtiva() {
  // Estratégia: 1) se controle define enquete_ativa, usa esse ID
  //             2) senão, busca com obterEnqueteAtiva(palestraId)
  try {
    let enquete = null;

    const idControle = controle?.enquete_ativa || null;
    if (idControle) {
      const { data } = await window.supabase
        .from('cnv25_enquetes')
        .select('*')
        .eq('id', idControle)
        .single();
      enquete = data || null;
    } else {
      enquete = await obterEnqueteAtiva(palestraId); // dos seus utils
    }

    enqueteAtiva = enquete;
    jaVotou = enqueteAtiva ? await verificouVotouEnquete(enqueteAtiva.id, deviceIdHash) : false;

    atualizarSecaoEnquete();
    conectarRealtimeEnquete();
  } catch (e) {
    console.error('Erro ao carregar enquete ativa:', e);
    enqueteAtiva = null;
    jaVotou = false;
    atualizarSecaoEnquete();
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
    })
    .subscribe();
}

function atualizarSecaoEnquete() {
  const secao = validarElemento('secaoEnquete');
  if (!secao) return;

  const titulo = validarElemento('tituloEnquete');
  const opcoesEl = validarElemento('opcoesEnquete');
  const feedback = validarElemento('feedbackEnquete');

  if (!enqueteAtiva) {
    // Sem enquete
    if (titulo) titulo.textContent = 'Enquete';
    if (opcoesEl) opcoesEl.innerHTML = '<p class="text-sm text-gray-600">Nenhuma enquete ativa.</p>';
    if (feedback) feedback.classList.add('hidden');
    return;
  }

  if (titulo) titulo.textContent = enqueteAtiva.titulo || 'Enquete';

  const opcoes = (enqueteAtiva.opcoes?.opcoes || []).slice(0, 4); // máximo 4 botões
  const labels = ['A', 'B', 'C', 'D'];

  if (opcoesEl) {
    if (jaVotou) {
      opcoesEl.innerHTML = '<p class="text-sm text-gray-600">Você já votou. Aguardando resultados...</p>';
    } else {
      opcoesEl.innerHTML = opcoes.map((opcao, idx) => `
        <button
          class="w-full px-4 py-3 bg-cnv-alternate hover:bg-cnv-warning hover:text-white rounded-lg text-left transition font-medium"
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
//  SEÇÃO: QUIZ
// -------------------------
async function carregarQuizAtivo() {
  quizAtivo = await obterQuizAtivo(palestraId); // dos seus utils
  if (quizAtivo) {
    await carregarPerguntaAtualQuiz();
    conectarRealtimeQuiz();
  } else {
    // sem quiz
    perguntaAtual = null;
  }
  atualizarSecaoQuiz();
}

async function carregarPerguntaAtualQuiz() {
  if (!quizAtivo || !quizAtivo.pergunta_atual || quizAtivo.pergunta_atual === 0) {
    perguntaAtual = null;
    return;
  }
  perguntaAtual = await obterPerguntaAtualQuiz(quizAtivo.id, quizAtivo.pergunta_atual); // dos seus utils

  // Já respondeu?
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
        await carregarPerguntaAtualQuiz();
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
    renderizarPerguntaQuiz(); // monta UI + countdown
  }
}

// Countdown integrado à renderização
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

  // UI do countdown
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

  // Inicia countdown
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
      // desabilita botões
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

  // Para o timer se estiver rodando
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
    mostrarFeedback(
      'feedbackQuiz',
      'sucesso',
      `✓ Você acertou! Resposta: ${corretaLabel} | +${perguntaAtual.pontos} pontos`
    );
  } else {
    mostrarFeedback(
      'feedbackQuiz',
      'erro',
      `✗ Você errou. Resposta correta: ${corretaLabel}`
    );
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
    desconectarCanais();
  } catch (e) {
    // ignora
  }
});

console.log('✅ Participante v2 carregado');
