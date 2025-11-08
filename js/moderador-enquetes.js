let _enquetes = [];
let _enqueteAtivaId = null;

// pega a palestra ativa global (independe da aba Perguntas)
async function getPalestraAtivaGlobal() {
  const { data, error } = await supabase
    .from('cnv25_palestra_ativa')
    .select('palestra_id')
    .eq('id', 1)
    .single();
  if (error) { console.error(error); return null; }
  return data?.palestra_id || null;
}

function marcarEnqueteAtivaUI(enqueteId) {
  _enqueteAtivaId = enqueteId || null;
  document.querySelectorAll('[data-enquete-id]').forEach(row => {
    const isAtiva = row.getAttribute('data-enquete-id') === _enqueteAtivaId;
    row.classList.toggle('ring-2', isAtiva);
    row.classList.toggle('ring-green-500', isAtiva);
    const badge = row.querySelector('[data-badge-ativa]');
    if (badge) badge.classList.toggle('hidden', !isAtiva);
  });
}

function toast(msg, tipo='info') {
  window.ModeradorCore?.mostrarNotificacao?.(msg, tipo);
}


// =====================================================
// MODERADOR - MÓDULO DE ENQUETES
// =====================================================

const ModuloEnquetes = (() => {
  // Estado local
  let chartEnquete = null;
  
  let canalEnquete = null;
  let canalEnquetesLista = null;
  let intervalResultados = null;
  
  // =====================================================
  // INICIALIZAÇÃO
  // =====================================================
  
  async function inicializar() {
  await carregarEnquetes();
  // pintar status ativo com base no controle atual (se carregado)
  const ctrl = window.ModeradorCore?.state?.controle;
  if (ctrl?.enquete_ativa) marcarEnqueteAtivaUI(ctrl.enquete_ativa);
}

async function carregarEnquetes() {
  const { data, error } = await supabase
    .from('cnv25_enquetes')
    .select('id, titulo, opcoes, ativa, modo')
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return; }
  _enquetes = data || [];
  renderizarListaEnquetes();
}

async function abrirResultados(enqueteId) {
  const e = _enquetes.find(x => x.id === enqueteId);
  if (!e) return;

  // abre drawer e renderiza
  const backdrop = document.getElementById('drawerBackdrop');
  const drawer   = document.getElementById('drawerResultados');
  const body     = document.getElementById('drawerBody');
  const title    = document.getElementById('drawerTitulo');
  if (!drawer || !body || !title) return;

  title.textContent = `Resultados — ${e.titulo}`;
  body.innerHTML = '<div class="text-sm text-gray-600">Carregando…</div>';
  drawer.classList.remove('translate-x-full');
  if (backdrop) backdrop.classList.remove('hidden');

  // agrega votos (tenta view, senão faz no front)
  let votos = [];
  let total = 0;

  let viaView = true;
  const r1 = await supabase
    .from('cnv25_enquete_resultado_v') // se não existir, cai no catch
    .select('*')
    .eq('enquete_id', e.id);

  if (r1.error) viaView = false;

  if (viaView) {
    votos = r1.data || [];
    total = votos.reduce((acc,r)=>acc+(r.votos||0),0);
  } else {
    const { data: rs } = await supabase
      .from('cnv25_enquete_respostas')
      .select('resposta')
      .eq('enquete_id', e.id);
    const cont = {};
    (rs||[]).forEach(r=>{
      const idx = parseInt(r.resposta?.opcaoIndex ?? r.resposta?.opcao_index ?? 0, 10) || 0;
      cont[idx] = (cont[idx]||0)+1;
    });
    votos = Object.entries(cont).map(([k,v])=>({ opcao_index: parseInt(k,10), votos: v }));
    total = (rs||[]).length;
  }

  const labels = 'ABCDEFGHIJ'.split('');
  const opcoes = e.opcoes?.opcoes || [];
  body.innerHTML = opcoes.map((txt,idx)=>{
    const v = votos.find(x=>x.opcao_index === idx)?.votos || 0;
    const pct = total ? Math.round((v/total)*100) : 0;
    return `
      <div class="border rounded-lg p-3">
        <div class="flex items-center justify-between">
          <div class="font-medium"><strong>${labels[idx]}.</strong> ${txt}</div>
          <div class="text-sm text-gray-600">${v} voto(s) • ${pct}%</div>
        </div>
        <div class="mt-2 w-full bg-gray-200 rounded-full h-2">
          <div class="h-2 rounded-full" style="width:${pct}%; background:#3b82f6"></div>
        </div>
      </div>
    `;
  }).join('');
}

function fecharResultados() {
  const backdrop = document.getElementById('drawerBackdrop');
  const drawer   = document.getElementById('drawerResultados');
  if (drawer) drawer.classList.add('translate-x-full');
  if (backdrop) backdrop.classList.add('hidden');
}

async function deletar(enqueteId) {
  // bloqueia se for a ativa da palestra ativa global
  const palestraId = await getPalestraAtivaGlobal();
  const ctrl = window.ModeradorCore?.state?.controle;

  if (ctrl?.enquete_ativa === enqueteId && ctrl && palestraId === window.ModeradorCore.state.palestraId) {
    toast('Desative esta enquete antes de deletar.', 'warning');
    return;
  }

  if (!confirm('Excluir esta enquete?')) return;

  const { error } = await supabase.from('cnv25_enquetes').delete().eq('id', enqueteId);
  if (error) { console.error(error); toast('Erro ao excluir', 'error'); return; }

  // recarrega lista
  await carregarEnquetes();
  toast('Enquete excluída.', 'success');
}


function renderizarListaEnquetes() {
  const wrap = document.getElementById('listaEnquetes');
  if (!wrap) return;

  wrap.innerHTML = (_enquetes || []).map(e => {
    const isAtiva = e.id === _enqueteAtivaId;
    const ops = (e.opcoes?.opcoes || []).map((t,i)=>`${String.fromCharCode(65+i)}. ${t}`).join(' • ');
    return `
      <div class="border rounded-lg p-3 mb-2 hover:bg-gray-50 transition"
           data-enquete-id="${e.id}">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="font-semibold truncate">${e.titulo}</div>
            <div class="text-xs text-gray-500 truncate">${ops}</div>
          </div>
          <div class="flex items-center gap-2">
            <span data-badge-ativa class="text-xs px-2 py-1 rounded bg-green-600 text-white ${isAtiva?'':'hidden'}">ATIVA</span>
            <button class="px-3 py-1 text-xs rounded bg-blue-600 text-white"
                    onclick="window.ModuloEnquetes.ativar('${e.id}')">Ativar</button>
            <button class="px-3 py-1 text-xs rounded bg-gray-200"
                    onclick="window.ModuloEnquetes.abrirResultados('${e.id}')">Resultados</button>
            <button class="px-3 py-1 text-xs rounded bg-red-600 text-white"
                    onclick="window.ModuloEnquetes.deletar('${e.id}')">Deletar</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // repinta com o id atual
  marcarEnqueteAtivaUI(_enqueteAtivaId);
}
  
  // =====================================================
  // REALTIME PARA LISTA DE ENQUETES
  // =====================================================
  
  function conectarRealtimeListaEnquetes() {
    if (canalEnquetesLista) return;
    
    canalEnquetesLista = supabase
      .channel('mod_enquetes_lista')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cnv25_enquetes'
      }, async (payload) => {
        console.log('📡 Enquetes atualizadas:', payload);
        await carregarEnquetes();
      })
      .subscribe();
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
            
            <button class="bg-gray-200 text-xs px-3 py-2 rounded"
                    onclick="window.ModuloEnquetes.abrirResultados(${JSON.stringify({id:e.id, titulo:e.titulo, opcoes:e.opcoes}).replace(/"/g,'&quot;')})">
              📊 Resultados
            </button>
            ${!isAtiva ? `
            <button class="bg-red-600 text-white text-xs px-3 py-2 rounded"
                    onclick="window.ModuloEnquetes.deletar('${e.id}')">
              🗑️ Deletar
            </button>` : ''}

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
  // pega a palestra ativa global
  const palestraId = await getPalestraAtivaGlobal();

  if (!palestraId) {
    toast('Defina uma palestra ativa (aba Perguntas) para direcionar o telão.', 'warning');
    return;
  }

  // UI otimista
  marcarEnqueteAtivaUI(enqueteId);

  // grava no controle DA PALESTRA ATIVA
  const ok = await window.ModeradorCore.atualizarControlePalestra(palestraId, {
    enquete_ativa: enqueteId,
    mostrar_resultado_enquete: false
  });

  if (!ok) {
    toast('Falha ao ativar enquete.', 'error');
    // rollback (tira o highlight)
    marcarEnqueteAtivaUI(null);
    return;
  }
  toast('Enquete ativada!', 'success');
}

  
  async function deletar(enqueteId) {
    if (window.ModeradorCore.state.controle?.enquete_ativa === enqueteId) {
      alert('Desative esta enquete antes de deletar.');
      return;
    }
    if (!confirm('Excluir esta enquete?')) return;
  
    const { error } = await supabase.from('cnv25_enquetes').delete().eq('id', enqueteId);
    if (error) { alert('Erro ao excluir'); console.error(error); return; }
    await carregarEnquetes();
  }

  async function onToggleResultadoTelao(checked) {
    const palestraId = window.ModeradorCore.state.palestraId;
    if (!palestraId) return;
    const ok = await window.ModeradorCore.atualizarControlePalestra(palestraId, {
      mostrar_resultado_enquete: !!checked
    });
    if (!ok) alert('Falha ao atualizar telão.');
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
    const btnCriar = document.getElementById('btnCriarEnquete');
    const btnCancelar = document.getElementById('btnCancelarEnquete');
    const btnSalvar = document.getElementById('btnSalvarEnquete');
    const btnExportar = document.getElementById('btnExportarEnquete');
    
    if (btnCriar) btnCriar.onclick = abrirModal;
    if (btnCancelar) btnCancelar.onclick = fecharModal;
    if (btnSalvar) btnSalvar.onclick = salvarEnquete;
    if (btnExportar) btnExportar.onclick = exportarCSV;
    
    if (!btnCriar || !btnCancelar || !btnSalvar || !btnExportar) {
      console.warn('⚠️ Alguns botões de enquete não foram encontrados no HTML');
    }
  }
  
  // =====================================================
  // UTILIDADES
  // =====================================================
  function onEnqueteAtivaMudou(novaId) {
    marcarEnqueteAtivaUI(novaId);
  }
  
  window.ModuloEnquetes = {
    inicializar,
    carregarEnquetes,
    ativar,
    abrirResultados,
    deletar,
    onEnqueteAtivaMudou
  };

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
    if (canalEnquetesLista) {
      window.supabase.removeChannel(canalEnquetesLista);
      canalEnquetesLista = null;
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
