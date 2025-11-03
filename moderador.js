// =====================================================
// MODERADOR - PAINEL DE CONTROLE
// =====================================================

let palestraId = null;
let palestra = null;
let perguntas = {
  pendentes: [],
  aprovadas: [],
  exibida: null,
  respondidas: []
};
let canalRealtime = null;

// Obter ID da palestra da URL
function obterPalestraIdDaUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('palestra');
}

// Inicializar painel
async function inicializar() {
  palestraId = obterPalestraIdDaUrl();
  
  if (!palestraId) {
    alert('Nenhuma palestra selecionada');
    window.location.href = 'index.html';
    return;
  }
  
  // Carregar palestra
  await carregarPalestra();
  
  // Carregar perguntas
  await carregarPerguntas();
  
  // Conectar Realtime
  conectarRealtime();
  
  // Configurar botões
  configurarBotoes();
  
  // Adicionar log inicial
  adicionarLog('Painel carregado');
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
    
    // Atualizar UI
    document.getElementById('palestraTitulo').textContent = palestra.titulo;
    document.getElementById('palestraInfo').textContent = `Sala ${palestra.sala} • ${formatarDataHora(palestra.inicio)}`;
    atualizarStatusPalestra();
    
  } catch (error) {
    console.error('Erro ao carregar palestra:', error);
    alert('Erro ao carregar palestra');
  }
}

// Atualizar status da palestra no header
function atualizarStatusPalestra() {
  const statusEl = document.getElementById('statusPalestra');
  
  const statusMap = {
    'planejada': { text: 'Planejada', class: 'bg-gray-200 text-gray-700' },
    'aberta': { text: 'ABERTA', class: 'bg-green-500 text-white' },
    'fechada': { text: 'FECHADA', class: 'bg-red-500 text-white' },
    'encerrada': { text: 'ENCERRADA', class: 'bg-gray-700 text-white' }
  };
  
  const status = statusMap[palestra.status] || statusMap['planejada'];
  statusEl.textContent = status.text;
  statusEl.className = `px-4 py-2 rounded-full text-sm font-semibold ${status.class}`;
}

// Carregar todas as perguntas
async function carregarPerguntas() {
  try {
    const { data, error } = await supabase
      .from('cnv25_perguntas')
      .select('*')
      .eq('palestra_id', palestraId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    // Organizar por status
    perguntas.pendentes = data.filter(p => p.status === 'pendente');
    perguntas.aprovadas = data.filter(p => p.status === 'aprovada');
    perguntas.exibida = data.find(p => p.status === 'exibida') || null;
    perguntas.respondidas = data.filter(p => p.status === 'respondida');
    
    // Renderizar todas as listas
    renderizarFilaPendentes();
    renderizarListaAprovadas();
    renderizarPerguntaAtual();
    renderizarListaRespondidas();
    atualizarContadores();
    
  } catch (error) {
    console.error('Erro ao carregar perguntas:', error);
  }
}

// Conectar ao Realtime
function conectarRealtime() {
  canalRealtime = supabase
    .channel(`moderador:${palestraId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'cnv25_perguntas',
        filter: `palestra_id=eq.${palestraId}`
      },
      (payload) => {
        console.log('Nova pergunta:', payload);
        perguntas.pendentes.push(payload.new);
        renderizarFilaPendentes();
        atualizarContadores();
        adicionarLog(`Nova pergunta recebida`);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'cnv25_perguntas',
        filter: `palestra_id=eq.${palestraId}`
      },
      (payload) => {
        console.log('Pergunta atualizada:', payload);
        atualizarPerguntaNaLista(payload.new);
      }
    )
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
        atualizarStatusPalestra();
      }
    )
    .subscribe();
}

// Atualizar pergunta nas listas após UPDATE
function atualizarPerguntaNaLista(perguntaAtualizada) {
  // Remover de todas as listas
  perguntas.pendentes = perguntas.pendentes.filter(p => p.id !== perguntaAtualizada.id);
  perguntas.aprovadas = perguntas.aprovadas.filter(p => p.id !== perguntaAtualizada.id);
  perguntas.respondidas = perguntas.respondidas.filter(p => p.id !== perguntaAtualizada.id);
  
  // Adicionar na lista correta
  if (perguntaAtualizada.status === 'pendente') {
    perguntas.pendentes.push(perguntaAtualizada);
  } else if (perguntaAtualizada.status === 'aprovada') {
    perguntas.aprovadas.push(perguntaAtualizada);
  } else if (perguntaAtualizada.status === 'exibida') {
    perguntas.exibida = perguntaAtualizada;
  } else if (perguntaAtualizada.status === 'respondida') {
    perguntas.respondidas.push(perguntaAtualizada);
    if (perguntas.exibida && perguntas.exibida.id === perguntaAtualizada.id) {
      perguntas.exibida = null;
    }
  }
  
  // Renderizar todas as listas
  renderizarFilaPendentes();
  renderizarListaAprovadas();
  renderizarPerguntaAtual();
  renderizarListaRespondidas();
  atualizarContadores();
}

// Renderizar fila de pendentes
function renderizarFilaPendentes() {
  const container = document.getElementById('filaPendentes');
  
  if (perguntas.pendentes.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhuma pergunta pendente</p>';
    return;
  }
  
  container.innerHTML = perguntas.pendentes.map(p => `
    <div class="border border-gray-200 rounded-lg p-3 hover:shadow-md transition">
      <p class="text-sm text-gray-800 mb-2">${escapeHtml(p.texto)}</p>
      <div class="flex items-center justify-between text-xs text-gray-500 mb-2">
        <span>${p.anonimo ? '👤 Anônimo' : '👤 ' + escapeHtml(p.nome_opt)}</span>
        <span>${formatarDataHora(p.created_at)}</span>
      </div>
      <div class="flex gap-2">
        <button onclick="aprovarPergunta('${p.id}')" class="flex-1 bg-green-500 text-white text-xs px-3 py-1 rounded hover:bg-green-600">
          ✓ Aprovar
        </button>
        <button onclick="recusarPergunta('${p.id}')" class="flex-1 bg-red-500 text-white text-xs px-3 py-1 rounded hover:bg-red-600">
          ✗ Recusar
        </button>
      </div>
    </div>
  `).join('');
}

// Renderizar lista de aprovadas
function renderizarListaAprovadas() {
  const container = document.getElementById('listaAprovadas');
  
  if (perguntas.aprovadas.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Nenhuma pergunta aprovada</p>';
    return;
  }
  
  container.innerHTML = perguntas.aprovadas.map(p => `
    <div class="border border-green-200 bg-green-50 rounded p-2">
      <p class="text-xs text-gray-800 mb-1">${escapeHtml(p.texto)}</p>
      <button onclick="exibirNoTelao('${p.id}')" class="w-full bg-green-500 text-white text-xs px-2 py-1 rounded hover:bg-green-600">
        📺 Exibir no Telão
      </button>
    </div>
  `).join('');
}

// Renderizar pergunta atual no telão
function renderizarPerguntaAtual() {
  const atualCard = document.getElementById('atualCard');
  
  if (!perguntas.exibida) {
    atualCard.className = 'p-4 bg-green-50 rounded-lg text-center text-gray-500';
    atualCard.innerHTML = 'Nenhuma pergunta exibida';
    
    // Atualizar próxima (primeira aprovada)
    const proximaCard = document.getElementById('proximaCard');
    if (perguntas.aprovadas.length > 0) {
      proximaCard.className = 'p-3 bg-gray-100 rounded-lg text-sm';
      proximaCard.innerHTML = `<p class="text-gray-700">${escapeHtml(perguntas.aprovadas[0].texto)}</p>`;
    } else {
      proximaCard.className = 'p-3 bg-gray-50 rounded-lg text-center text-gray-400 text-sm';
      proximaCard.innerHTML = '—';
    }
    
    return;
  }
  
  atualCard.className = 'p-4 bg-green-100 border-2 border-green-500 rounded-lg';
  atualCard.innerHTML = `
    <p class="text-gray-800 font-medium mb-2">${escapeHtml(perguntas.exibida.texto)}</p>
    <div class="text-xs text-gray-600 mb-3">
      ${perguntas.exibida.anonimo ? '👤 Anônimo' : '👤 ' + escapeHtml(perguntas.exibida.nome_opt)}
    </div>
    <button onclick="marcarRespondida('${perguntas.exibida.id}')" class="w-full bg-blue-500 text-white text-sm px-3 py-2 rounded hover:bg-blue-600">
      ✓ Marcar como Respondida
    </button>
  `;
  
  // Atualizar próxima
  const proximaCard = document.getElementById('proximaCard');
  if (perguntas.aprovadas.length > 0) {
    proximaCard.className = 'p-3 bg-gray-100 rounded-lg text-sm';
    proximaCard.innerHTML = `<p class="text-gray-700">${escapeHtml(perguntas.aprovadas[0].texto)}</p>`;
  } else {
    proximaCard.className = 'p-3 bg-gray-50 rounded-lg text-center text-gray-400 text-sm';
    proximaCard.innerHTML = '—';
  }
}

// Renderizar lista de respondidas
function renderizarListaRespondidas() {
  const container = document.getElementById('listaRespondidas');
  
  if (perguntas.respondidas.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhuma pergunta respondida</p>';
    return;
  }
  
  container.innerHTML = perguntas.respondidas.slice().reverse().map(p => `
    <div class="border border-gray-200 rounded-lg p-3 bg-gray-50">
      <p class="text-sm text-gray-700 mb-2">${escapeHtml(p.texto)}</p>
      <div class="text-xs text-gray-500">
        ${p.anonimo ? '👤 Anônimo' : '👤 ' + escapeHtml(p.nome_opt)} • 
        Respondida às ${formatarDataHora(p.respondida_em)}
      </div>
    </div>
  `).join('');
}

// Atualizar contadores
function atualizarContadores() {
  document.getElementById('contadorPendentes').textContent = perguntas.pendentes.length;
  document.getElementById('contadorExibida').textContent = perguntas.exibida ? '1' : '0';
  document.getElementById('contadorRespondidas').textContent = perguntas.respondidas.length;
}

// =====================================================
// AÇÕES DO MODERADOR
// =====================================================

// Aprovar pergunta
async function aprovarPergunta(perguntaId) {
  try {
    const { error } = await supabase
      .from('cnv25_perguntas')
      .update({ status: 'aprovada' })
      .eq('id', perguntaId);
    
    if (error) throw error;
    
    adicionarLog('Pergunta aprovada');
    
  } catch (error) {
    console.error('Erro ao aprovar:', error);
    alert('Erro ao aprovar pergunta');
  }
}

// Recusar pergunta
async function recusarPergunta(perguntaId) {
  const motivo = prompt('Motivo da recusa (opcional):');
  
  try {
    const { error } = await supabase
      .from('cnv25_perguntas')
      .update({ 
        status: 'recusada',
        motivo_recusa: motivo || 'Sem motivo especificado'
      })
      .eq('id', perguntaId);
    
    if (error) throw error;
    
    adicionarLog('Pergunta recusada');
    
  } catch (error) {
    console.error('Erro ao recusar:', error);
    alert('Erro ao recusar pergunta');
  }
}

// Exibir no telão
async function exibirNoTelao(perguntaId) {
  try {
    // Se já tem uma exibida, não permitir
    if (perguntas.exibida) {
      if (!confirm('Já existe uma pergunta no telão. Deseja substituí-la?')) {
        return;
      }
      
      // Marcar a atual como respondida antes
      await supabase
        .from('cnv25_perguntas')
        .update({ 
          status: 'respondida',
          respondida_em: new Date().toISOString()
        })
        .eq('id', perguntas.exibida.id);
    }
    
    // Exibir a nova
    const { error } = await supabase
      .from('cnv25_perguntas')
      .update({ 
        status: 'exibida',
        exibida_em: new Date().toISOString()
      })
      .eq('id', perguntaId);
    
    if (error) throw error;
    
    adicionarLog('Pergunta exibida no telão');
    
  } catch (error) {
    console.error('Erro ao exibir:', error);
    alert('Erro ao exibir pergunta');
  }
}

// Marcar como respondida
async function marcarRespondida(perguntaId) {
  try {
    const { error } = await supabase
      .from('cnv25_perguntas')
      .update({ 
        status: 'respondida',
        respondida_em: new Date().toISOString()
      })
      .eq('id', perguntaId);
    
    if (error) throw error;
    
    adicionarLog('Pergunta marcada como respondida');
    
  } catch (error) {
    console.error('Erro ao marcar como respondida:', error);
    alert('Erro ao marcar pergunta como respondida');
  }
}

// =====================================================
// CONTROLES DA PALESTRA
// =====================================================

// Configurar botões do header
function configurarBotoes() {
  document.getElementById('btnAbrir').addEventListener('click', abrirPerguntas);
  document.getElementById('btnFechar').addEventListener('click', fecharPerguntas);
  document.getElementById('btnSilencio').addEventListener('click', ativarSilencio);
  document.getElementById('btnExportar').addEventListener('click', exportarCSV);
  document.getElementById('btnEncerrar').addEventListener('click', encerrarPalestra);
}

// Abrir perguntas
async function abrirPerguntas() {
  if (palestra.status === 'encerrada') {
    alert('Palestra já foi encerrada');
    return;
  }
  
  try {
    const { error } = await supabase
      .from('cnv25_palestras')
      .update({ status: 'aberta' })
      .eq('id', palestraId);
    
    if (error) throw error;
    
    // Limpar silêncio se houver
    await supabase
      .from('cnv25_palestras_flags')
      .upsert({ 
        palestra_id: palestraId,
        silencio_ate: null,
        updated_at: new Date().toISOString()
      });
    
    adicionarLog('✅ Perguntas ABERTAS');
    
  } catch (error) {
    console.error('Erro ao abrir:', error);
    alert('Erro ao abrir perguntas');
  }
}

// Fechar perguntas
async function fecharPerguntas() {
  if (!confirm('Deseja fechar o envio de perguntas?')) return;
  
  try {
    const { error } = await supabase
      .from('cnv25_palestras')
      .update({ status: 'fechada' })
      .eq('id', palestraId);
    
    if (error) throw error;
    
    adicionarLog('❌ Perguntas FECHADAS');
    
  } catch (error) {
    console.error('Erro ao fechar:', error);
    alert('Erro ao fechar perguntas');
  }
}

// Ativar silêncio por 60 segundos
async function ativarSilencio() {
  const segundos = prompt('Quantos segundos de silêncio?', '60');
  if (!segundos) return;
  
  const seg = parseInt(segundos);
  if (isNaN(seg) || seg <= 0) {
    alert('Valor inválido');
    return;
  }
  
  try {
    const silencioAte = new Date(Date.now() + (seg * 1000)).toISOString();
    
    await supabase
      .from('cnv25_palestras_flags')
      .upsert({ 
        palestra_id: palestraId,
        silencio_ate: silencioAte,
        updated_at: new Date().toISOString()
      });
    
    adicionarLog(`🔇 Silêncio ativado por ${seg}s`);
    alert(`Silêncio ativado por ${seg} segundos`);
    
  } catch (error) {
    console.error('Erro ao ativar silêncio:', error);
    alert('Erro ao ativar silêncio');
  }
}

// Encerrar palestra
async function encerrarPalestra() {
  if (!confirm('Deseja ENCERRAR a palestra? Esta ação não pode ser desfeita!')) return;
  
  try {
    const { error } = await supabase
      .from('cnv25_palestras')
      .update({ status: 'encerrada' })
      .eq('id', palestraId);
    
    if (error) throw error;
    
    adicionarLog('⏹ Palestra ENCERRADA');
    alert('Palestra encerrada com sucesso!');
    
  } catch (error) {
    console.error('Erro ao encerrar:', error);
    alert('Erro ao encerrar palestra');
  }
}

// Exportar CSV
async function exportarCSV() {
  try {
    const { data, error } = await supabase
      .from('cnv25_perguntas')
      .select('*')
      .eq('palestra_id', palestraId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      alert('Nenhuma pergunta para exportar');
      return;
    }
    
    // Criar CSV
    const headers = ['Data/Hora', 'Pergunta', 'Nome', 'Status', 'Exibida em', 'Respondida em'];
    const rows = data.map(p => [
      formatarDataHora(p.created_at),
      p.texto,
      p.anonimo ? 'Anônimo' : p.nome_opt,
      p.status,
      p.exibida_em ? formatarDataHora(p.exibida_em) : '-',
      p.respondida_em ? formatarDataHora(p.respondida_em) : '-'
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `perguntas_${palestra.titulo.replace(/\s+/g, '_')}_${Date.now()}.csv`;
    link.click();
    
    adicionarLog('📥 CSV exportado');
    
  } catch (error) {
    console.error('Erro ao exportar:', error);
    alert('Erro ao exportar CSV');
  }
}

// =====================================================
// LOGS
// =====================================================

const logs = [];

function adicionarLog(mensagem) {
  const timestamp = new Date().toLocaleTimeString('pt-BR');
  logs.unshift(`[${timestamp}] ${mensagem}`);
  
  // Manter apenas últimos 20 logs
  if (logs.length > 20) logs.pop();
  
  renderizarLogs();
}

function renderizarLogs() {
  const container = document.getElementById('listaLogs');
  
  if (logs.length === 0) {
    container.innerHTML = '<p class="text-gray-400">Aguardando ações...</p>';
    return;
  }
  
  container.innerHTML = logs.map(log => 
    `<div class="text-xs text-gray-600">${escapeHtml(log)}</div>`
  ).join('');
}

// =====================================================
// UTILITÁRIOS
// =====================================================

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

console.log('✅ Painel do moderador carregado');
