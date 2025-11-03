// =====================================================
// PARTICIPANTE - LÓGICA DE ENVIO DE PERGUNTAS
// =====================================================

let palestraId = null;
let palestra = null;
let deviceId = null;
let deviceIdHash = null;
let canalRealtime = null;

// Obter ID da palestra da URL
function obterPalestraIdDaUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('palestra');
}

// Inicializar página
async function inicializar() {
  palestraId = obterPalestraIdDaUrl();
  
  if (!palestraId) {
    mostrarErro('Nenhuma palestra selecionada. Redirecionando...');
    setTimeout(() => window.location.href = 'index.html', 2000);
    return;
  }
  
  // Obter device ID
  deviceId = getDeviceId();
  deviceIdHash = await hashDeviceId(deviceId);
  
  // Carregar dados da palestra
  await carregarPalestra();
  
  // Atualizar contador de perguntas enviadas
  await atualizarContadorEnviadas();
  
  // Conectar ao Realtime
  conectarRealtime();
  
  // Configurar listeners
  configurarListeners();
}

// Carregar dados da palestra
async function carregarPalestra() {
  try {
    palestra = await obterPalestra(palestraId);
    
    if (!palestra) {
      mostrarErro('Palestra não encontrada');
      return;
    }
    
    // Atualizar UI
    document.getElementById('palestraTitulo').textContent = palestra.titulo;
    atualizarStatusBanner();
    
  } catch (error) {
    console.error('Erro ao carregar palestra:', error);
    mostrarErro('Erro ao carregar informações da palestra');
  }
}

// Atualizar banner de status
function atualizarStatusBanner() {
  const banner = document.getElementById('statusBanner');
  const btnEnviar = document.getElementById('btnEnviar');
  
  if (palestra.status === 'aberta') {
    banner.className = 'mb-6 p-4 rounded-lg text-center font-semibold text-lg bg-green-100 text-green-800';
    banner.textContent = '✅ Perguntas ABERTAS';
    btnEnviar.disabled = false;
  } else {
    banner.className = 'mb-6 p-4 rounded-lg text-center font-semibold text-lg bg-red-100 text-red-800';
    banner.textContent = '❌ Perguntas FECHADAS';
    btnEnviar.disabled = true;
  }
}

// Conectar ao Realtime para receber atualizações
function conectarRealtime() {
  canalRealtime = supabase
    .channel(`palestra:${palestraId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'cnv25_palestras',
        filter: `id=eq.${palestraId}`
      },
      (payload) => {
        console.log('Palestra atualizada:', payload);
        palestra = payload.new;
        atualizarStatusBanner();
      }
    )
    .subscribe();
}

// Configurar event listeners
function configurarListeners() {
  const textarea = document.getElementById('textoPergunta');
  const contador = document.getElementById('contador');
  const avisoLimite = document.getElementById('avisoLimite');
  const form = document.getElementById('formPergunta');
  
  // Contador de caracteres
  textarea.addEventListener('input', function() {
    const length = this.value.length;
    contador.textContent = `${length} / 140`;
    
    if (length >= 140) {
      contador.classList.add('text-red-500', 'font-bold');
      avisoLimite.classList.remove('hidden');
    } else {
      contador.classList.remove('text-red-500', 'font-bold');
      avisoLimite.classList.add('hidden');
    }
  });
  
  // Envio do formulário
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await enviarPergunta();
  });
}

// Enviar pergunta
async function enviarPergunta() {
  const btnEnviar = document.getElementById('btnEnviar');
  const texto = document.getElementById('textoPergunta').value.trim();
  const nome = document.getElementById('nomeParticipante').value.trim();
  
  // Desabilitar botão
  btnEnviar.disabled = true;
  btnEnviar.textContent = 'Enviando...';
  
  try {
    // Validações locais
    const erros = validarPergunta(texto);
    if (erros.length > 0) {
      mostrarErro(erros.join('. '));
      return;
    }
    
    // Verificar status da palestra
    if (palestra.status !== 'aberta') {
      mostrarErro('As perguntas estão fechadas no momento');
      return;
    }
    
    // Verificar rate limit
    const rateLimit = verificarRateLimit();
    if (!rateLimit.permitido) {
      mostrarErro(`Aguarde ${rateLimit.segundosRestantes} segundos para enviar outra pergunta`);
      return;
    }
    
    // Verificar cota de perguntas
    const totalPerguntas = await contarPerguntasDevice(palestraId, deviceIdHash);
    if (totalPerguntas >= 3) {
      mostrarErro('Você já atingiu o limite de 3 perguntas nesta palestra');
      return;
    }
    
    // Verificar silêncio
    const silencioAtivo = await verificarSilencio(palestraId);
    if (silencioAtivo) {
      mostrarErro('O moderador ativou o modo silêncio. Tente novamente em alguns instantes');
      return;
    }
    
    // Preparar dados
    const nonce = crypto.randomUUID();
    const perguntaData = {
      palestra_id: palestraId,
      texto: texto,
      nome_opt: nome || null,
      anonimo: !nome,
      device_id_hash: deviceIdHash,
      nonce: nonce,
      status: 'pendente'
    };
    
    // Enviar para o banco
    const { data, error } = await supabase
      .from('cnv25_perguntas')
      .insert([perguntaData])
      .select()
      .single();
    
    if (error) {
      // Tratar erros específicos
      if (error.code === '23505') { // Duplicate nonce
        mostrarErro('Esta pergunta já foi enviada');
      } else {
        throw error;
      }
      return;
    }
    
    // Sucesso!
    registrarEnvio();
    mostrarSucesso('Pergunta enviada com sucesso! Aguarde a aprovação do moderador.');
    
    // Limpar formulário
    document.getElementById('textoPergunta').value = '';
    document.getElementById('nomeParticipante').value = '';
    document.getElementById('contador').textContent = '0 / 140';
    
    // Atualizar contador
    await atualizarContadorEnviadas();
    
  } catch (error) {
    console.error('Erro ao enviar pergunta:', error);
    mostrarErro('Erro ao enviar pergunta. Tente novamente.');
  } finally {
    btnEnviar.disabled = false;
    btnEnviar.textContent = 'Enviar Pergunta';
  }
}

// Atualizar contador de perguntas enviadas
async function atualizarContadorEnviadas() {
  try {
    const total = await contarPerguntasDevice(palestraId, deviceIdHash);
    document.getElementById('contadorEnviadas').textContent = total;
    
    // Se atingiu o limite, avisar
    if (total >= 3) {
      mostrarAviso('Você já enviou 3 perguntas. Limite atingido para esta palestra.');
      document.getElementById('btnEnviar').disabled = true;
    }
  } catch (error) {
    console.error('Erro ao contar perguntas:', error);
  }
}

// Mostrar mensagem de sucesso
function mostrarSucesso(mensagem) {
  const feedback = document.getElementById('feedback');
  feedback.className = 'mt-4 p-4 rounded-lg bg-green-100 border-l-4 border-green-500 text-green-800';
  feedback.innerHTML = `<strong>✓ Sucesso!</strong><br>${mensagem}`;
  feedback.classList.remove('hidden');
  
  setTimeout(() => {
    feedback.classList.add('hidden');
  }, 5000);
}

// Mostrar mensagem de erro
function mostrarErro(mensagem) {
  const feedback = document.getElementById('feedback');
  feedback.className = 'mt-4 p-4 rounded-lg bg-red-100 border-l-4 border-red-500 text-red-800';
  feedback.innerHTML = `<strong>✗ Erro!</strong><br>${mensagem}`;
  feedback.classList.remove('hidden');
  
  setTimeout(() => {
    feedback.classList.add('hidden');
  }, 5000);
}

// Mostrar aviso
function mostrarAviso(mensagem) {
  const feedback = document.getElementById('feedback');
  feedback.className = 'mt-4 p-4 rounded-lg bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800';
  feedback.innerHTML = `<strong>⚠ Atenção!</strong><br>${mensagem}`;
  feedback.classList.remove('hidden');
}

// Iniciar quando a página carregar
window.addEventListener('DOMContentLoaded', inicializar);

// Desconectar Realtime ao sair
window.addEventListener('beforeunload', () => {
  if (canalRealtime) {
    supabase.removeChannel(canalRealtime);
  }
});
