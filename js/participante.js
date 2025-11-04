// =====================================================
// PARTICIPANTE V2 - INTERFACE UNIFICADA
// =====================================================

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
let respostasPendentes = [];
let tempoInicio = null;
let pontuacaoTotal = 0;
let acertosTotal = 0;

// Canais Realtime
let canalPalestraAtiva = null;
let canalPalestra = null;
let canalControle = null;
let canalEnquete = null;
let canalQuiz = null;

// =====================================================
// INICIALIZAÇÃO
// =====================================================

async function inicializar() {
  console.log('👤 Participante v2 inicializando...');
  
  deviceId = getDeviceId();
  deviceIdHash = await hashDeviceId(deviceId);
  
  await conectarRealtimePalestraAtiva();
  await carregarPalestraAtiva();
  configurarListeners();
}

// =====================================================
// PALESTRA ATIVA
// =====================================================

function conectarRealtimePalestraAtiva() {
  canalPalestraAtiva = supabase
    .channel('palestra_ativa_part_v2')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'cnv25_palestra_ativa',
      filter: 'id=eq.1'
    }, async (payload) => {
      console.log('🔄 Palestra mudou:', payload);
      if (payload.new.palestra_id !== palestraId) {
        await carregarPalestraAtiva();
      }
    })
    .subscribe();
}

async function carregarPalestraAtiva() {
  try {
    const { data: palestraAtiva } = await supabase
      .from('cnv25_palestra_ativa')
      .select('palestra_id')
      .eq('id', 1)
      .single();
    
    const novaPalestraId = palestraAtiva?.palestra_id;
    
    if (!novaPalestraId) {
      mostrarSemPalestra();
      return;
    }
    
    // Desconectar canais anteriores
    if (canalPalestra && palestraId !== novaPalestraId) {
      desconectarCanais();
    }
    
    palestraId = novaPalestraId;
    
    // Carregar dados
    await carregarPalestra();
    await carregarControle();
    await carregarEnqueteAtiva();
    await carregarQuizAtivo();
    
    conectarRealtimePalestra();
    
    mostrarConteudo();
    atualizarUI();
    await atualizarContadorEnviadas();
    
  } catch (error) {
    console.error('Erro:', error);
    mostrarSemPalestra();
  }
}

async function carregarPalestra() {
  palestra = await obterPalestra(palestraId);
  if (!palestra) {
    throw new Error('Palestra não encontrada');
  }
}

async function carregarControle() {
  const { data } = await supabase
    .from('cnv25_palestra_controle')
    .select('*')
    .eq('palestra_id', palestraId)
    .single();
  
  controle = data;
}

// =====================================================
// REALTIME - PALESTRA
// =====================================================

function conectarRealtimePalestra() {
  if (canalPalestra) return;
  
  canalPalestra = supabase
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
  
  canalControle = supabase
    .channel(`controle:${palestraId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'cnv25_palestra_controle',
      filter: `palestra_id=eq.${palestraId}`
    }, (payload) => {
      console.log('📡 Controle atualizado:', payload);
      controle = payload.new;
      atualizarUI();
      
      // Verificar mudanças em enquete_ativa
      if (payload.new.enquete_ativa !== enqueteAtiva?.id) {
        carregarEnqueteAtiva();
      }
    })
    .subscribe();
}

function desconectarCanais() {
  if (canalPalestra) window.supabase.removeChannel(canalPalestra);
  if (canalControle) window.supabase.removeChannel(canalControle);
  if (canalEnquete) window.supabase.removeChannel(canalEnquete);
  if (canalQuiz) window.supabase.removeChannel(canalQuiz);
  canalPalestra = canalControle = canalEnquete = canalQuiz = null;
}

// =====================================================
// UI - TELAS
// =====================================================

function mostrarLoading() {
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('semPalestra').classList.add('hidden');
  document.getElementById('conteudo').classList.add('hidden');
}

function mostrarSemPalestra() {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('semPalestra').classList.remove('hidden');
  document.getElementById('conteudo').classList.add('hidden');
}

function mostrarConteudo() {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('semPalestra').classList.add('hidden');
  document.getElementById('conteudo').classList.remove('hidden');
}

function atualizarUI() {
  if (!palestra || !controle) return;
  
  // Header
  document.getElementById('palestraTitulo').textContent = palestra.titulo;
  document.getElementById('palestrante').textContent = palestra.palestrante || 'A definir';
  
  // Status geral
  const statusEl = document.getElementById('statusGeral');
  if (controle.perguntas_abertas && !controle.silencio_ativo) {
    statusEl.textContent = '✅ Ativo';
    statusEl.className = 'px-4 py-2 rounded-full text-sm font-bold bg-green-500 text-white';
  } else {
    statusEl.textContent = '⏸️ Pausado';
    statusEl.className = 'px-4 py-2 rounded-full text-sm font-bold bg-gray-400 text-white';
  }
  
  // Seções
  atualizarSecaoPerguntas();
  atualizarSecaoEnquete();
  atualizarSecaoQuiz();
}

// =====================================================
// SEÇÃO 1: PERGUNTAS
// =====================================================

function atualizarSecaoPerguntas() {
  const secao = document.getElementById('secaoPerguntas');
  const statusEl = document.getElementById('statusPerguntas');
  const form = document.getElementById('formPerguntas');
  
  const aberta = controle.perguntas_abertas && !controle.silencio_ativo;
  
  if (aberta) {
    secao.classList.remove('inactive');
    statusEl.textContent = '✅ ABERTAS';
    statusEl.className = 'ml-auto px-3 py-1 rounded-full text-xs font-bold bg-green-500 text-white';
    document.getElementById('btnEnviar').disabled = false;
  } else {
    secao.classList.add('inactive');
    statusEl.textContent = controle.silencio_ativo ? '🔇 SILÊNCIO' : '❌ FECHADAS';
    statusEl.className = 'ml-auto px-3 py-1 rounded-full text-xs font-bold bg-red-500 text-white';
    document.getElementById('btnEnviar').disabled = true;
  }
  
  // Atualizar limites
  document.getElementById('limiteDinamico').textContent = palestra.max_perguntas || 3;
}

function configurarListeners() {
  // Contador de caracteres
  const textarea = document.getElementById('textoPergunta');
  textarea.addEventListener('input', function() {
    const length = this.value.length;
    document.getElementById('contador').textContent = `${length} / 140`;
  });
  
  // Form de pergunta
  document.getElementById('formPergunta').addEventListener('submit', async (e) => {
    e.preventDefault();
    await enviarPergunta();
  });
}

async function enviarPergunta() {
  if (!palestraId) return;
  
  const btnEnviar = document.getElementById('btnEnviar');
  const texto = document.getElementById('textoPergunta').value.trim();
  const nome = document.getElementById('nomeParticipante').value.trim();
  const email = document.getElementById('emailParticipante').value.trim();
  
  btnEnviar.disabled = true;
  btnEnviar.textContent = 'Enviando...';
  
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
    
    const rateLimit = verificarRateLimitDinamico(palestra.intervalo_perguntas || 60);
    if (!rateLimit.permitido) {
      mostrarFeedback('feedbackPergunta', 'erro', `Aguarde ${rateLimit.segundosRestantes}s`);
      return;
    }
    
    const totalPerguntas = await contarPerguntasDevice(palestraId, deviceIdHash);
    const maxPerguntas = palestra.max_perguntas || 3;
    if (totalPerguntas >= maxPerguntas) {
      mostrarFeedback('feedbackPergunta', 'erro', `Limite de ${maxPerguntas} perguntas atingido`);
      return;
    }
    
    const nonce = crypto.randomUUID();
    const perguntaData = {
      palestra_id: palestraId,
      texto: texto,
      nome_opt: nome || null,
      email_opt: email || null,
      anonimo: !nome,
      device_id_hash: deviceIdHash,
      nonce: nonce,
      status: 'pendente'
    };
    
    const { data, error } = await supabase
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
    
    document.getElementById('textoPergunta').value = '';
    document.getElementById('nomeParticipante').value = '';
    document.getElementById('emailParticipante').value = '';
    document.getElementById('contador').textContent = '0 / 140';
    
    await atualizarContadorEnviadas();
    
  } catch (error) {
    console.error('Erro:', error);
    mostrarFeedback('feedbackPergunta', 'erro', 'Erro ao enviar');
  } finally {
    btnEnviar.disabled = false;
    btnEnviar.textContent = 'Enviar Pergunta';
  }
}

async function atualizarContadorEnviadas() {
  if (!palestraId) return;
  
  try {
    const total = await contarPerguntasDevice(palestraId, deviceIdHash);
    document.getElementById('contadorEnviadas').textContent = total;
    
    const maxPerguntas = palestra.max_perguntas || 3;
    if (total >= maxPerguntas) {
      document.getElementById('btnEnviar').disabled = true;
    }
  } catch (error) {
    console.error('Erro ao contar:', error);
  }
}

// =====================================================
// SEÇÃO 2: ENQUETE
// =====================================================

async function carregarEnqueteAtiva() {
  if (!controle?.enquete_ativa) {
    enqueteAtiva = null;
    jaVotou = false;
    atualizarSecaoEnquete();
    return;
  }
  
  const { data } = await supabase
    .from('cnv25_enquetes')
    .select('*')
    .eq('id', controle.enquete_ativa)
    .single();
  
  enqueteAtiva = data;
  jaVotou = await verificouVotouEnquete(enqueteAtiva.id, deviceIdHash);
  
  atualizarSecaoEnquete();
  conectarRealtimeEnquete();
}

function conectarRealtimeEnquete() {
  if (!enqueteAtiva) return;
  if (canalEnquete) window.supabase.removeChannel(canalEnquete);
  
  canalEnquete = supabase
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
  const secao = document.getElementById('secaoEnquete');
  
  if (!enqueteAtiva) {
    secao.classList.add('hidden');
    return;
  }
  
  secao.classList.remove('hidden');
  
  document.getElementById('tituloEnquete').textContent = enqueteAtiva.titulo;
  
  const opcoesContainer = document.getElementById('opcoesEnquete');
  const opcoes = enqueteAtiva.opcoes.opcoes;
  
  if (jaVotou) {
    opcoesContainer.innerHTML = '<p class="text-center text-gray-600">✓ Você já votou nesta enquete</p>';
  } else {
    opcoesContainer.innerHTML = opcoes.map((opcao, idx) => `
      <button 
        onclick="votarEnqueteParticipante(${idx})"
        class="w-full px-4 py-3 bg-cnv-alternate hover:bg-cnv-primary hover:text-white rounded-lg text-left transition font-medium"
      >
        ${esc(opcao)}
      </button>
    `).join('');
  }
}

async function votarEnqueteParticipante(opcaoIndex) {
  if (jaVotou) return;
  
  try {
    const resultado = await votarEnquete(enqueteAtiva.id, deviceIdHash, opcaoIndex);
    
    if (resultado.error) {
      mostrarFeedback('feedbackEnquete', 'erro', resultado.error);
      return;
    }
    
    jaVotou = true;
    mostrarFeedback('feedbackEnquete', 'sucesso', 'Voto registrado!');
    atualizarSecaoEnquete();
    
  } catch (error) {
    console.error('Erro ao votar:', error);
    mostrarFeedback('feedbackEnquete', 'erro', 'Erro ao votar');
  }
}

// =====================================================
// SEÇÃO 3: QUIZ
// =====================================================

async function carregarQuizAtivo() {
  quizAtivo = await obterQuizAtivo(palestraId);
  
  if (quizAtivo) {
    await carregarPerguntaAtualQuiz();
    conectarRealtimeQuiz();
  }
  
  atualizarSecaoQuiz();
}

async function carregarPerguntaAtualQuiz() {
  if (!quizAtivo || quizAtivo.pergunta_atual === 0) {
    perguntaAtual = null;
    return;
  }
  
  perguntaAtual = await obterPerguntaAtualQuiz(quizAtivo.id, quizAtivo.pergunta_atual);
  
  // Verificar se já respondeu
  const jaRespondeu = await verificouRespondeuQuiz(perguntaAtual.id, deviceIdHash);
  if (jaRespondeu) {
    perguntaAtual.jaRespondeu = true;
  } else {
    tempoInicio = Date.now();
  }
}

function conectarRealtimeQuiz() {
  if (!quizAtivo) return;
  if (canalQuiz) window.supabase.removeChannel(canalQuiz);
  
  canalQuiz = supabase
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
  const secao = document.getElementById('secaoQuiz');
  
  if (!quizAtivo) {
    secao.classList.add('hidden');
    return;
  }
  
  secao.classList.remove('hidden');
  
  // Progresso
  document.getElementById('progressoQuiz').textContent = 
    `${quizAtivo.pergunta_atual || 0}/${quizAtivo.total_perguntas}`;
  
  // Estados
  const aguardando = document.getElementById('quizAguardando');
  const perguntaDiv = document.getElementById('quizPergunta');
  const finalizado = document.getElementById('quizFinalizado');
  
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

function renderizarPerguntaQuiz() {
  document.getElementById('numPergunta').textContent = `${quizAtivo.pergunta_atual}/${quizAtivo.total_perguntas}`;
  document.getElementById('textoPerguntaQuiz').textContent = perguntaAtual.pergunta;
  
  const opcoesContainer = document.getElementById('opcoesQuiz');
  const opcoes = perguntaAtual.opcoes;
  const labels = ['A', 'B', 'C', 'D'];
  
  opcoesContainer.innerHTML = opcoes.map((opcao, idx) => `
    <button 
      onclick="responderQuizParticipante(${idx})"
      class="w-full px-4 py-3 bg-cnv-alternate hover:bg-cnv-warning hover:text-white rounded-lg text-left transition font-medium"
    >
      <strong>${labels[idx]}.</strong> ${esc(opcao)}
    </button>
  `).join('');
}

async function responderQuizParticipante(opcaoIndex) {
  if (perguntaAtual.jaRespondeu) return;
  
  const tempoResposta = Math.floor((Date.now() - tempoInicio) / 1000);
  
  try {
    const resultado = await responderPerguntaQuiz(
      perguntaAtual.id,
      deviceIdHash,
      opcaoIndex,
      tempoResposta
    );
    
    if (resultado.error) {
      mostrarFeedback('feedbackQuiz', 'erro', resultado.error);
      return;
    }
    
    perguntaAtual.jaRespondeu = true;
    perguntaAtual.minhaResposta = opcaoIndex;
    perguntaAtual.acertei = resultado.correta;
    perguntaAtual.pontos = resultado.pontos;
    
    if (resultado.correta) {
      acertosTotal++;
      pontuacaoTotal += resultado.pontos;
    }
    
    mostrarFeedback('feedbackQuiz', 'info', '✓ Resposta registrada! Aguarde a revelação...');
    atualizarSecaoQuiz();
    
  } catch (error) {
    console.error('Erro ao responder:', error);
    mostrarFeedback('feedbackQuiz', 'erro', 'Erro ao enviar resposta');
  }
}

function exibirFeedbackResposta() {
  const labels = ['A', 'B', 'C', 'D'];
  const corretaLabel = labels[perguntaAtual.resposta_correta];
  
  if (perguntaAtual.acertei) {
    mostrarFeedback('feedbackQuiz', 'sucesso', 
      `✓ Você acertou! Resposta: ${corretaLabel} | +${perguntaAtual.pontos} pontos`);
  } else {
    mostrarFeedback('feedbackQuiz', 'erro', 
      `✗ Você errou. Resposta correta: ${corretaLabel}`);
  }
}

async function exibirResultadoFinal() {
  document.getElementById('pontuacaoFinal').textContent = pontuacaoTotal;
  document.getElementById('acertosFinal').textContent = acertosTotal;
}

// =====================================================
// UTILS
// =====================================================

function mostrarFeedback(elementId, tipo, mensagem) {
  const feedback = document.getElementById(elementId);
  
  const classes = {
    sucesso: 'bg-green-100 border-l-4 border-green-500 text-green-800',
    erro: 'bg-red-100 border-l-4 border-red-500 text-red-800',
    info: 'bg-blue-100 border-l-4 border-blue-500 text-blue-800'
  };
  
  feedback.className = `mt-4 p-4 rounded-lg ${classes[tipo]}`;
  feedback.innerHTML = `<strong>${tipo === 'sucesso' ? '✓' : tipo === 'erro' ? '✗' : 'ℹ'}</strong> ${mensagem}`;
  feedback.classList.remove('hidden');
  
  if (tipo === 'sucesso' || tipo === 'info') {
    setTimeout(() => feedback.classList.add('hidden'), 5000);
  }
}

function esc(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// =====================================================
// INICIAR
// =====================================================

window.addEventListener('DOMContentLoaded', inicializar);

window.addEventListener('beforeunload', () => {
  if (canalPalestraAtiva) window.supabase.removeChannel(canalPalestraAtiva);
  desconectarCanais();
});

console.log('✅ Participante v2 carregado');
