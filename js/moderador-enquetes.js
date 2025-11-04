// =====================================================
// MODERADOR - MÓDULO DE ENQUETES
// =====================================================

const ModuloEnquetes = (() => {
  // Estado local
  let enquetes = [];
  let enqueteAtiva = null;
  let chartEnquete = null;
  
  let canalEnquete = null;
  let intervalResultados = null;
  
  // =====================================================
  // INICIALIZAÇÃO
  // =====================================================
  
  async function inicializar() {
    console.log('📊 Módulo Enquetes inicializando...');
    
    await carregarEnquetes();
    await verificarEnqueteAtiva();
    configurarEventos();
    
    console.log('✅ Módulo Enquetes pronto');
  }
  
  // =====================================================
  // CARREGAR ENQUETES
  // =====================================================
  
  async function carregarEnquetes() {
    try {
      // Buscar TODAS as enquetes (não filtrar por palestra)
      const { data, error } = await supabase
        .from('cnv25_enquetes')
        .select('*')
        .eq('modo', 'enquete')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      enquetes = data || [];
      renderizarLista();
      
    } catch (error) {
      console.error('Erro ao carregar enquetes:', error);
    }
  }
  
  async function verificarEnqueteAtiva() {
    const controle = window.ModeradorCore.state.controle;
    
    if (controle?.enquete_ativa) {
      const enquete = enquetes.find(e => e.id === controle.enquete_ativa);
      
      if (enquete) {
        enqueteAtiva = enquete;
        await carregarResultados();
        iniciarAtualizacaoResultados();
      }
    } else {
      enqueteAtiva = null;
      limparResultados();
    }
  }
  
  // =====================================================
  // RENDERIZAÇÃO
  // =====================================================
  
  function renderizarLista() {
    const container = document.getElementById('listaEnquetes');
    const controle = window.ModeradorCore.state.controle;
    
    if (!enquetes.length) {
      container.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhuma enquete criada</p>';
      return;
    }
    
    container.innerHTML = enquetes.map(e => {
      const isAtiva = e.id === controle?.enquete_ativa;
      const encerrada = e.encerrada_em !== null;
      
      return `
        <div class="border rounded-lg p-4 ${isAtiva ? 'bg-green-50 border-green-500 border-2' : 'bg-white'} hover:shadow-md transition">
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1">
              <h4 class="font-semibold text-sm mb-1">${window.ModeradorCore.esc(e.titulo)}</h4>
              <p class="text-xs text-gray-600">
                ${e.opcoes.opcoes.length} opções • 
                Criada em ${formatarData(e.created_at)}
                ${encerrada ? ' • <span class="text-red-600">Encerrada</span>' : ''}
              </p>
            </div>
            ${isAtiva ? '<span class="ml-2 text-xs bg-green-500 text-white px-3 py-1 rounded-full font-bold">ATIVA</span>' : ''}
          </div>
          
          <div class="flex gap-2">
            ${!isAtiva && !encerrada ? `
              <button 
                onclick="window.ModuloEnquetes.ativar('${e.id}')" 
                class="flex-1 bg-cnv-success text-white text-xs px-3 py-2 rounded hover:opacity-90 transition"
              >
                ▶️ Ativar
              </button>
            ` : ''}
            
            ${isAtiva ? `
              <button 
                onclick="window.ModuloEnquetes.desativar()" 
                class="flex-1 bg-cnv-error text-white text-xs px-3 py-2 rounded hover:opacity-90 transition"
              >
                ⏸️ Desativar
              </button>
              <button 
                onclick="window.ModuloEnquetes.encerrar('${e.id}')" 
                class="flex-1 bg-gray-600 text-white text-xs px-3 py-2 rounded hover:opacity-90 transition"
              >
                🏁 Encerrar
              </button>
            ` : ''}
            
            <button 
              onclick="window.ModuloEnquetes.verDetalhes('${e.id}')" 
              class="bg-cnv-primary text-white text-xs px-3 py-2 rounded hover:opacity-90 transition"
              title="Ver detalhes"
            >
              👁️
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
  
  async function carregarResultados() {
    if (!enqueteAtiva) {
      limparResultados();
      return;
    }
    
    try {
      const resultados = await obterResultadosEnquete(enqueteAtiva.id);
      renderizarResultados(resultados);
      
    } catch (error) {
      console.error('Erro ao carregar resultados:', error);
    }
  }
  
  function renderizarResultados(resultados) {
    const container = document.getElementById('resultadosEnquete');
    
    if (!resultados || resultados.total === 0) {
      container.innerHTML = `
        <div class="text-center py-8">
          <p class="text-gray-500">Aguardando votos...</p>
          <p class="text-sm text-gray-400 mt-2">Total de votos: <strong>0</strong></p>
        </div>
      `;
      return;
    }
    
    const opcoes = enqueteAtiva.opcoes.opcoes;
    const distribuicao = resultados.distribuicao;
    
    // Preparar dados para o gráfico
    const labels = opcoes;
    const data = opcoes.map((_, idx) => distribuicao[idx] || 0);
    const percentuais = data.map(v => ((v / resultados.total) * 100).toFixed(1));
    
    container.innerHTML = `
      <div class="mb-4 p-4 bg-cnv-primary bg-opacity-10 rounded-lg">
        <p class="text-lg font-bold text-cnv-primary">Total de votos: ${resultados.total}</p>
      </div>
      
      <div class="mb-4">
        <canvas id="chartEnqueteCanvas"></canvas>
      </div>
      
      <div class="space-y-2">
        ${opcoes.map((opcao, idx) => `
          <div class="bg-white p-3 rounded-lg border">
            <div class="flex items-center justify-between mb-1">
              <span class="font-medium text-sm">${window.ModeradorCore.esc(opcao)}</span>
              <span class="text-cnv-primary font-bold">${percentuais[idx]}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div class="bg-cnv-primary h-2 rounded-full transition-all duration-500" style="width: ${percentuais[idx]}%"></div>
            </div>
            <p class="text-xs text-gray-500 mt-1">${data[idx]} voto${data[idx] !== 1 ? 's' : ''}</p>
          </div>
        `).join('')}
      </div>
    `;
    
    // Criar gráfico
    setTimeout(() => {
      const ctx = document.getElementById('chartEnqueteCanvas');
      if (!ctx) return;
      
      if (chartEnquete) {
        chartEnquete.destroy();
      }
      
      chartEnquete = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Votos',
            data: data,
            backgroundColor: '#27ae52',
            borderColor: '#1f8e42',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const votos = context.parsed.y;
                  const perc = percentuais[context.dataIndex];
                  return `${votos} voto${votos !== 1 ? 's' : ''} (${perc}%)`;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1 }
            }
          }
        }
      });
    }, 100);
  }
  
  function limparResultados() {
    const container = document.getElementById('resultadosEnquete');
    container.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhuma enquete ativa</p>';
    
    if (chartEnquete) {
      chartEnquete.destroy();
      chartEnquete = null;
    }
  }
  
  // =====================================================
  // AÇÕES
  // =====================================================
  
  async function ativar(enqueteId) {
    const palestraId = window.ModeradorCore.state.palestraId;
    if (!palestraId) {
      alert('Selecione uma palestra primeiro');
      return;
    }
    
    try {
      // Atualizar controle
      const resultado = await atualizarControlePalestra(palestraId, {
        enquete_ativa: enqueteId
      });
      
      if (resultado) {
        window.ModeradorCore.mostrarNotificacao('Enquete ativada!', 'success');
      }
      
    } catch (error) {
      console.error('Erro ao ativar enquete:', error);
      alert('Erro ao ativar enquete');
    }
  }
  
  async function desativar() {
    const palestraId = window.ModeradorCore.state.palestraId;
    if (!palestraId) return;
    
    try {
      const resultado = await atualizarControlePalestra(palestraId, {
        enquete_ativa: null
      });
      
      if (resultado) {
        window.ModeradorCore.mostrarNotificacao('Enquete desativada', 'info');
      }
      
    } catch (error) {
      console.error('Erro ao desativar enquete:', error);
      alert('Erro ao desativar enquete');
    }
  }
  
  async function encerrar(enqueteId) {
    if (!confirm('Encerrar esta enquete? Esta ação não pode ser desfeita.')) {
      return;
    }
    
    try {
      // Desativar primeiro
      await desativar();
      
      // Encerrar a enquete
      const { error } = await supabase
        .from('cnv25_enquetes')
        .update({
          ativa: false,
          encerrada_em: new Date().toISOString()
        })
        .eq('id', enqueteId);
      
      if (error) throw error;
      
      await carregarEnquetes();
      window.ModeradorCore.mostrarNotificacao('Enquete encerrada', 'success');
      
    } catch (error) {
      console.error('Erro ao encerrar enquete:', error);
      alert('Erro ao encerrar enquete');
    }
  }
  
  function verDetalhes(enqueteId) {
    const enquete = enquetes.find(e => e.id === enqueteId);
    if (!enquete) return;
    
    const opcoes = enquete.opcoes.opcoes.map((op, idx) => `${idx + 1}. ${op}`).join('\n');
    
    alert(`📊 ${enquete.titulo}\n\nOpções:\n${opcoes}\n\nCriada: ${formatarData(enquete.created_at)}${enquete.encerrada_em ? '\nEncerrada: ' + formatarData(enquete.encerrada_em) : ''}`);
  }
  
  // =====================================================
  // MODAL CRIAR ENQUETE
  // =====================================================
  
  function abrirModal() {
    document.getElementById('modalEnquete').classList.remove('hidden');
    document.getElementById('modalEnquete').classList.add('flex');
    document.getElementById('inputTituloEnquete').focus();
  }
  
  function fecharModal() {
    document.getElementById('modalEnquete').classList.add('hidden');
    document.getElementById('modalEnquete').classList.remove('flex');
    document.getElementById('inputTituloEnquete').value = '';
    document.getElementById('inputOpcoesEnquete').value = '';
  }
  
  async function salvarEnquete() {
    const titulo = document.getElementById('inputTituloEnquete').value.trim();
    const opcoesTexto = document.getElementById('inputOpcoesEnquete').value.trim();
    
    if (!titulo || !opcoesTexto) {
      alert('Preencha todos os campos');
      return;
    }
    
    const opcoes = opcoesTexto
      .split('\n')
      .map(o => o.trim())
      .filter(o => o.length > 0);
    
    if (opcoes.length < 2) {
      alert('Adicione pelo menos 2 opções');
      return;
    }
    
    try {
      // Criar enquete SEM palestra_id (deixar NULL)
      const { data, error } = await supabase
        .from('cnv25_enquetes')
        .insert([{
          palestra_id: null, // Enquetes são globais agora
          titulo: titulo,
          tipo: 'multipla_escolha',
          modo: 'enquete',
          opcoes: { opcoes: opcoes },
          ativa: true
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      await carregarEnquetes();
      fecharModal();
      
      window.ModeradorCore.mostrarNotificacao('Enquete criada!', 'success');
      
      // Perguntar se quer ativar agora
      if (confirm('Ativar esta enquete agora?')) {
        await ativar(data.id);
      }
      
    } catch (error) {
      console.error('Erro ao criar enquete:', error);
      alert('Erro ao criar enquete');
    }
  }
  
  // =====================================================
  // EXPORTAR CSV
  // =====================================================
  
  async function exportarCSV() {
    if (!enqueteAtiva) {
      alert('Nenhuma enquete ativa');
      return;
    }
    
    try {
      const { data: respostas } = await supabase
        .from('cnv25_enquete_respostas')
        .select('*')
        .eq('enquete_id', enqueteAtiva.id)
        .order('created_at');
      
      if (!respostas || respostas.length === 0) {
        alert('Nenhuma resposta para exportar');
        return;
      }
      
      const csv = [
        ['Data/Hora', 'Opção Escolhida', 'Device Hash (8 primeiros)'].join(','),
        ...respostas.map(r => [
          formatarData(r.created_at),
          enqueteAtiva.opcoes.opcoes[r.resposta.valor] || 'N/A',
          r.device_id_hash.substring(0, 8)
        ].map(c => `"${c}"`).join(','))
      ].join('\n');
      
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `enquete_${enqueteAtiva.titulo.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.csv`;
      link.click();
      
      window.ModeradorCore.mostrarNotificacao('CSV exportado!', 'success');
      
    } catch (error) {
      console.error('Erro ao exportar:', error);
      alert('Erro ao exportar CSV');
    }
  }
  
  // =====================================================
  // ATUALIZAÇÃO AUTOMÁTICA
  // =====================================================
  
  function iniciarAtualizacaoResultados() {
    pararAtualizacaoResultados();
    
    if (enqueteAtiva) {
      intervalResultados = setInterval(() => {
        carregarResultados();
      }, 3000); // Atualizar a cada 3 segundos
    }
  }
  
  function pararAtualizacaoResultados() {
    if (intervalResultados) {
      clearInterval(intervalResultados);
      intervalResultados = null;
    }
  }
  
  // =====================================================
  // CALLBACK DO CORE
  // =====================================================
  
  async function onEnqueteAtivaMudou(enqueteId) {
    if (enqueteId) {
      enqueteAtiva = enquetes.find(e => e.id === enqueteId);
      await carregarResultados();
      iniciarAtualizacaoResultados();
    } else {
      enqueteAtiva = null;
      limparResultados();
      pararAtualizacaoResultados();
    }
    
    renderizarLista();
  }
  
  // =====================================================
  // EVENTOS
  // =====================================================
  
  function configurarEventos() {
    document.getElementById('btnCriarEnquete').onclick = abrirModal;
    document.getElementById('btnCancelarEnquete').onclick = fecharModal;
    document.getElementById('btnSalvarEnquete').onclick = salvarEnquete;
    document.getElementById('btnExportarEnquete').onclick = exportarCSV;
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
  
  function desconectar() {
    pararAtualizacaoResultados();
    if (canalEnquete) {
      window.supabase.removeChannel(canalEnquete);
      canalEnquete = null;
    }
  }
  
  // =====================================================
  // API PÚBLICA
  // =====================================================
  
  return {
    inicializar,
    desconectar,
    ativar,
    desativar,
    encerrar,
    verDetalhes,
    exportarCSV,
    onEnqueteAtivaMudou
  };
})();

// Expor globalmente
window.ModuloEnquetes = ModuloEnquetes;

console.log('✅ Módulo Enquetes carregado');
