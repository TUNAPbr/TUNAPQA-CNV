// =====================================================
// MODERADOR - MÓDULO DE PERGUNTAS
// =====================================================

const ModuloPerguntas = (() => {
  // Estado local
  let perguntas = {
    pendentes: [],
    aprovadas: [],
    exibida: null,
    respondidas: []
  };
  
  let canalPerguntas = null;
  
  // =====================================================
  // INICIALIZAÇÃO
  // =====================================================
  
  async function inicializar() {
    console.log('📝 Módulo Perguntas inicializando...');
    
    await carregarPerguntas();
    conectarRealtime();
    configurarEventos();
    
    console.log('✅ Módulo Perguntas pronto');
  }
  
  // =====================================================
  // CARREGAR PERGUNTAS
  // =====================================================
  
  async function carregarPerguntas() {
    const palestraId = window.ModeradorCore.state.palestraId;
    if (!palestraId) return;
    
    try {
      const { data, error } = await supabase
        .from('cnv25_perguntas')
        .select('*')
        .eq('palestra_id', palestraId)
        .order('created_at');
      
      if (error) throw error;
      
      perguntas.pendentes = data.filter(p => p.status === 'pendente');
      perguntas.aprovadas = data.filter(p => p.status === 'aprovada');
      perguntas.exibida = data.find(p => p.status === 'exibida') || null;
      perguntas.respondidas = data.filter(p => p.status === 'respondida');
      
      renderizar();
      
    } catch (error) {
      console.error('Erro ao carregar perguntas:', error);
    }
  }
  
  // =====================================================
  // REALTIME
  // =====================================================
  
  function conectarRealtime() {
    const palestraId = window.ModeradorCore.state.palestraId;
    if (!palestraId) return;
    
    desconectar();
    
    canalPerguntas = supabase
      .channel(`mod_perguntas:${palestraId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'cnv25_perguntas',
        filter: `palestra_id=eq.${palestraId}`
      }, (payload) => {
        perguntas.pendentes.push(payload.new);
        renderizar();
        
        // Notificação sonora/visual opcional
        window.ModeradorCore.mostrarNotificacao('Nova pergunta recebida!', 'info');
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'cnv25_perguntas',
        filter: `palestra_id=eq.${palestraId}`
      }, (payload) => {
        atualizarPergunta(payload.new);
      })
      .subscribe();
  }
  
  function desconectar() {
    if (canalPerguntas) {
      window.supabase.removeChannel(canalPerguntas);
      canalPerguntas = null;
    }
  }
  
  // =====================================================
  // ATUALIZAR PERGUNTA
  // =====================================================
  
  function atualizarPergunta(pergunta) {
    // Remover de todas as listas
    perguntas.pendentes = perguntas.pendentes.filter(p => p.id !== pergunta.id);
    perguntas.aprovadas = perguntas.aprovadas.filter(p => p.id !== pergunta.id);
    perguntas.respondidas = perguntas.respondidas.filter(p => p.id !== pergunta.id);
    
    // Adicionar na lista correta
    if (pergunta.status === 'pendente') {
      perguntas.pendentes.push(pergunta);
    } else if (pergunta.status === 'aprovada') {
      perguntas.aprovadas.push(pergunta);
    } else if (pergunta.status === 'exibida') {
      perguntas.exibida = pergunta;
    } else if (pergunta.status === 'respondida') {
      perguntas.respondidas.push(pergunta);
      if (perguntas.exibida?.id === pergunta.id) {
        perguntas.exibida = null;
      }
    } else if (pergunta.status === 'recusada') {
      // Não exibir recusadas
    }
    
    renderizar();
  }
  
  // =====================================================
  // RENDERIZAÇÃO
  // =====================================================
  
  function renderizar() {
    renderizarPendentes();
    renderizarAprovadas();
    renderizarExibida();
    renderizarRespondidas();
    atualizarContadores();
  }
  
  function renderizarPendentes() {
    const container = document.getElementById('listaPendentes');
    
    if (!perguntas.pendentes.length) {
      container.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhuma pendente</p>';
      return;
    }
    
    container.innerHTML = perguntas.pendentes.map(p => `
      <div class="border rounded-lg p-3 bg-white hover:shadow-md transition">
        <p class="text-sm mb-2">${window.ModeradorCore.esc(p.texto)}</p>
        <div class="text-xs text-gray-500 mb-2">
          ${p.anonimo ? '👤 Anônimo' : '👤 ' + window.ModeradorCore.esc(p.nome_opt || 'Sem nome')}
          ${p.email_opt ? ' • 📧 ' + window.ModeradorCore.esc(p.email_opt) : ''}
        </div>
        <div class="text-xs text-gray-400 mb-3">
          🕐 ${formatarData(p.created_at)}
        </div>
        <div class="flex gap-2">
          <button 
            onclick="window.ModuloPerguntas.aprovar('${p.id}')" 
            class="flex-1 bg-cnv-success text-white text-xs px-3 py-2 rounded hover:opacity-90 transition"
            title="Aprovar"
          >
            ✓ Aprovar
          </button>
          <button 
            onclick="window.ModuloPerguntas.recusar('${p.id}')" 
            class="flex-1 bg-cnv-error text-white text-xs px-3 py-2 rounded hover:opacity-90 transition"
            title="Recusar"
          >
            ✗ Recusar
          </button>
        </div>
      </div>
    `).join('');
  }
  
  function renderizarAprovadas() {
    const container = document.getElementById('listaAprovadas');
    
    if (!perguntas.aprovadas.length) {
      container.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Nenhuma aprovada</p>';
      return;
    }
    
    container.innerHTML = perguntas.aprovadas.map(p => `
      <div class="border border-green-200 bg-green-50 rounded p-3 hover:shadow-md transition">
        <p class="text-sm mb-2">${window.ModeradorCore.esc(p.texto)}</p>
        <div class="text-xs text-gray-600 mb-2">
          ${p.anonimo ? '👤 Anônimo' : '👤 ' + window.ModeradorCore.esc(p.nome_opt || 'Sem nome')}
        </div>
        <button 
          onclick="window.ModuloPerguntas.exibir('${p.id}')" 
          class="w-full bg-cnv-success text-white text-xs px-3 py-2 rounded hover:opacity-90 transition"
        >
          📺 Exibir no Telão
        </button>
      </div>
    `).join('');
  }
  
  function renderizarExibida() {
    const container = document.getElementById('cardExibida');
    
    if (!perguntas.exibida) {
      container.innerHTML = `
        <p class="text-sm text-gray-600 mb-2">📺 No telão:</p>
        <p class="text-gray-500 text-center text-sm">Nenhuma pergunta exibida</p>
      `;
      return;
    }
    
    const p = perguntas.exibida;
    container.innerHTML = `
      <p class="text-sm text-gray-600 mb-2">📺 No telão agora:</p>
      <div class="bg-white rounded-lg p-3 border-2 border-green-500 mb-3">
        <p class="font-medium mb-2 text-sm">${window.ModeradorCore.esc(p.texto)}</p>
        <div class="text-xs text-gray-600">
          ${p.anonimo ? '👤 Anônimo' : '👤 ' + window.ModeradorCore.esc(p.nome_opt || 'Sem nome')}
        </div>
      </div>
      <button 
        onclick="window.ModuloPerguntas.marcarRespondida('${p.id}')" 
        class="w-full bg-cnv-primary text-white text-sm px-3 py-2 rounded hover:opacity-90 transition"
      >
        ✓ Marcar como Respondida
      </button>
    `;
  }
  
  function renderizarRespondidas() {
    const container = document.getElementById('listaRespondidas');
    
    if (!perguntas.respondidas.length) {
      container.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhuma respondida ainda</p>';
      return;
    }
    
    // Mostrar as mais recentes primeiro
    const respondidas = [...perguntas.respondidas].reverse();
    
    container.innerHTML = respondidas.map(p => `
      <div class="border rounded-lg p-3 bg-gray-50">
        <p class="text-sm mb-1">${window.ModeradorCore.esc(p.texto)}</p>
        <div class="text-xs text-gray-500">
          ${p.anonimo ? '👤 Anônimo' : '👤 ' + window.ModeradorCore.esc(p.nome_opt || 'Sem nome')}
          • ✓ ${formatarData(p.respondida_em)}
        </div>
      </div>
    `).join('');
  }
  
  function atualizarContadores() {
    document.getElementById('contPend').textContent = perguntas.pendentes.length;
    document.getElementById('contAprov').textContent = perguntas.aprovadas.length;
    document.getElementById('contResp').textContent = perguntas.respondidas.length;
  }
  
  // =====================================================
  // AÇÕES
  // =====================================================
  
  async function aprovar(id) {
    try {
      const { error } = await supabase
        .from('cnv25_perguntas')
        .update({ status: 'aprovada' })
        .eq('id', id);
      
      if (error) throw error;
      
      window.ModeradorCore.mostrarNotificacao('Pergunta aprovada!', 'success');
      
    } catch (error) {
      console.error('Erro ao aprovar:', error);
      alert('Erro ao aprovar pergunta');
    }
  }
  
  async function recusar(id) {
    const motivo = prompt('Motivo da recusa (opcional):');
    
    try {
      const { error } = await supabase
        .from('cnv25_perguntas')
        .update({ 
          status: 'recusada',
          motivo_recusa: motivo || null
        })
        .eq('id', id);
      
      if (error) throw error;
      
      window.ModeradorCore.mostrarNotificacao('Pergunta recusada', 'warning');
      
    } catch (error) {
      console.error('Erro ao recusar:', error);
      alert('Erro ao recusar pergunta');
    }
  }
  
  async function exibir(id) {
    // Se já tem uma exibida, perguntar se quer substituir
    if (perguntas.exibida) {
      if (!confirm('Há uma pergunta no telão. Substituir?')) {
        return;
      }
      
      // Marcar a atual como respondida
      await supabase
        .from('cnv25_perguntas')
        .update({ 
          status: 'respondida',
          respondida_em: new Date().toISOString()
        })
        .eq('id', perguntas.exibida.id);
    }
    
    try {
      const { error } = await supabase
        .from('cnv25_perguntas')
        .update({ 
          status: 'exibida',
          exibida_em: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
      
      window.ModeradorCore.mostrarNotificacao('Pergunta exibida no telão!', 'success');
      
    } catch (error) {
      console.error('Erro ao exibir:', error);
      alert('Erro ao exibir pergunta');
    }
  }
  
  async function marcarRespondida(id) {
    try {
      const { error } = await supabase
        .from('cnv25_perguntas')
        .update({ 
          status: 'respondida',
          respondida_em: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
      
      window.ModeradorCore.mostrarNotificacao('Pergunta marcada como respondida!', 'success');
      
    } catch (error) {
      console.error('Erro ao marcar como respondida:', error);
      alert('Erro ao processar ação');
    }
  }
  
  // =====================================================
  // EXPORTAR CSV
  // =====================================================
  
  async function exportarCSV() {
    const palestraId = window.ModeradorCore.state.palestraId;
    if (!palestraId) return;
    
    try {
      const { data } = await supabase
        .from('cnv25_perguntas')
        .select('*')
        .eq('palestra_id', palestraId)
        .order('created_at');
      
      if (!data || data.length === 0) {
        alert('Nenhuma pergunta para exportar');
        return;
      }
      
      const csv = [
        ['Data/Hora', 'Pergunta', 'Nome', 'Email', 'Status', 'Anônimo'].join(','),
        ...data.map(p => [
          formatarData(p.created_at),
          `"${p.texto.replace(/"/g, '""')}"`,
          p.anonimo ? 'Anônimo' : `"${(p.nome_opt || '').replace(/"/g, '""')}"`,
          `"${(p.email_opt || '').replace(/"/g, '""')}"`,
          p.status,
          p.anonimo ? 'Sim' : 'Não'
        ].join(','))
      ].join('\n');
      
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `perguntas_${window.ModeradorCore.state.palestra.titulo}_${Date.now()}.csv`;
      link.click();
      
      window.ModeradorCore.mostrarNotificacao('CSV exportado!', 'success');
      
    } catch (error) {
      console.error('Erro ao exportar:', error);
      alert('Erro ao exportar CSV');
    }
  }
  
  // =====================================================
  // EVENTOS
  // =====================================================
  
  function configurarEventos() {
    document.getElementById('btnExportarPerguntas').onclick = exportarCSV;
  }
  
  // =====================================================
  // UTILIDADES
  // =====================================================
  
  function formatarData(timestamp) {
    const data = new Date(timestamp);
    return data.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  // =====================================================
  // API PÚBLICA
  // =====================================================
  
  return {
    inicializar,
    desconectar,
    aprovar,
    recusar,
    exibir,
    marcarRespondida,
    exportarCSV
  };
})();

// Expor globalmente
window.ModuloPerguntas = ModuloPerguntas;

console.log('✅ Módulo Perguntas carregado');
