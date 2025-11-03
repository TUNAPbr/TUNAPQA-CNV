// =====================================================
// TELÃO - EXIBIÇÃO PÚBLICA DE PERGUNTAS
// =====================================================

let palestraId = null;
let palestra = null;
let perguntaAtual = null;
let proximaPergunta = null;
let canalRealtime = null;

// Obter ID da palestra da URL
function obterPalestraIdDaUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('palestra');
}

// Inicializar telão
async function inicializar() {
  palestraId = obterPalestraIdDaUrl();
  
  if (!palestraId) {
    alert('Nenhuma palestra selecionada');
    window.location.href = 'index.html';
    return;
  }
  
  // Carregar palestra
  await carregarPalestra();
  
  // Carregar pergunta atual
  await carregarPerguntaAtual();
  
  // Conectar Realtime
  conectarRealtime();
  
  console.log('✅ Telão carregado');
}

// Carregar dados da palestra
async function carregarPalestra() {
  try {
    palestra = await obterPalestra(palestraId);
    
    if (!palestra) {
      alert('Palestra não encontrada');
      window.location.href = 'index.html';
      return;
    }
    
    // Atualizar header
    document.getElementById('palestraTitulo').textContent = palestra.titulo;
    document.getElementById('palestraSala').textContent = `Sala ${palestra.sala}`;
    
  } catch (error) {
    console.error('Erro ao carregar palestra:', error);
  }
}

// Carregar pergunta atual
async function carregarPerguntaAtual() {
  try {
    // Buscar pergunta com status 'exibida'
    const { data: exibida, error: errorExibida } = await supabase
      .from('cnv25_perguntas')
      .select('*')
      .eq('palestra_id', palestraId)
      .eq('status', 'exibida')
      .single();
    
    if (errorExibida && errorExibida.code !== 'PGRST116') { // PGRST116 = não encontrado
      throw errorExibida;
    }
    
    perguntaAtual = exibida || null;
    
    // Buscar próxima (primeira aprovada)
    const { data: aprovadas, error: errorAprovadas } = await supabase
      .from('cnv25_perguntas')
      .select('*')
      .eq('palestra_id', palestraId)
      .eq('status', 'aprovada')
      .order('created_at', { ascending: true })
      .limit(1);
    
    if (errorAprovadas) throw errorAprovadas;
    
    proximaPergunta = (aprovadas && aprovadas.length > 0) ? aprovadas[0] : null;
    
    // Renderizar
    renderizarPergunta();
    
  } catch (error) {
    console.error('Erro ao carregar pergunta:', error);
  }
}

// Conectar ao Realtime
function conectarRealtime() {
  canalRealtime = supabase
    .channel(`telao:${palestraId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'cnv25_perguntas',
        filter: `palestra_id=eq.${palestraId}`
      },
      async (payload) => {
        console.log('Pergunta atualizada:', payload);
        
        const pergunta = payload.new;
        
        // Se mudou para 'exibida', é a nova pergunta atual
        if (pergunta.status === 'exibida') {
          perguntaAtual = pergunta;
          await atualizarProxima();
          renderizarPergunta();
        }
        
        // Se a atual foi respondida, limpar
        if (perguntaAtual && pergunta.id === perguntaAtual.id && pergunta.status === 'respondida') {
          perguntaAtual = null;
          await atualizarProxima();
          renderizarPergunta();
        }
        
        // Se uma aprovada foi adicionada, atualizar próxima
        if (pergunta.status === 'aprovada') {
          await atualizarProxima();
          renderizarPergunta();
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'cnv25_perguntas',
        filter: `palestra_id=eq.${palestraId}`
      },
      async (payload) => {
        console.log('Nova pergunta:', payload);
        
        // Se foi inserida como aprovada, pode ser a próxima
        if (payload.new.status === 'aprovada' && !proximaPergunta) {
          await atualizarProxima();
          renderizarPergunta();
        }
      }
    )
    .subscribe();
}

// Atualizar próxima pergunta
async function atualizarProxima() {
  try {
    const { data, error } = await supabase
      .from('cnv25_perguntas')
      .select('*')
      .eq('palestra_id', palestraId)
      .eq('status', 'aprovada')
      .order('created_at', { ascending: true })
      .limit(1);
    
    if (error) throw error;
    
    proximaPergunta = (data && data.length > 0) ? data[0] : null;
    
  } catch (error) {
    console.error('Erro ao buscar próxima:', error);
  }
}

// Renderizar pergunta na tela
function renderizarPergunta() {
  const semPergunta = document.getElementById('semPergunta');
  const comPergunta = document.getElementById('comPergunta');
  const textoPergunta = document.getElementById('textoPergunta');
  const nomePergunta = document.getElementById('nomePergunta');

  
  // Se não tem pergunta atual
  if (!perguntaAtual) {
    semPergunta.classList.remove('hidden');
    comPergunta.classList.add('hidden');
    return;
  }
  
  // Exibir pergunta atual
  semPergunta.classList.add('hidden');
  comPergunta.classList.remove('hidden');
  comPergunta.classList.add('fade-in');
  
  textoPergunta.textContent = perguntaAtual.texto;
  
  if (perguntaAtual.anonimo) {
    nomePergunta.innerHTML = '👤 <em>Anônimo</em>';
  } else {
    nomePergunta.innerHTML = `👤 ${escapeHtml(perguntaAtual.nome_opt)}`;
  }
  
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Iniciar quando carregar
window.addEventListener('DOMContentLoaded', inicializar);

// Desconectar ao sair
window.addEventListener('beforeunload', () => {
  if (canalRealtime) {
    supabase.removeChannel(canalRealtime);
  }
});

console.log('✅ Telão inicializado');
