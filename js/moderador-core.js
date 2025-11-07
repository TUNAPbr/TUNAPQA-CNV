// =====================================================
// HELPERS DE CONTROLE (usado por Enquetes/Quiz/Perguntas)
// =====================================================
async function atualizarControlePalestra(palestraId, patch) {
  if (!palestraId) return false;
  try {
    const { data, error } = await supabase
      .from('cnv25_palestra_controle')
      .update({ 
        ...patch, 
        updated_at: new Date().toISOString() 
      })
      .eq('palestra_id', palestraId)
      .select()
      .single();

    if (error) throw error;
    // Atualiza estado local imediatamente
    ModeradorState.controle = data;
    atualizarBadgesStatus();
    return true;
  } catch (e) {
    console.error('❌ atualizarControlePalestra:', e);
    return false;
  }
}

// =====================================================
// MODERADOR CORE - LÓGICA COMUM V2
// =====================================================

// Estados Globais
const ModeradorState = {
  palestraId: null,
  palestra: null,
  controle: null,
  
  // Canais Realtime
  canais: {
    palestraAtiva: null,
    palestra: null,
    controle: null
  }
};

// =====================================================
// INICIALIZAÇÃO
// =====================================================

async function inicializarModerador() {
  console.log('🎛️ Moderador Core v2 inicializando...');
  
  await carregarListaPalestras();
  configurarEventosCore();
  
  // Mostrar interface sem exigir palestra
  document.getElementById('headerConteudo').classList.remove('hidden');
  document.getElementById('mainConteudo').classList.remove('hidden');
  
  // Inicializar módulos sem palestra (modo livre)
  if (window.ModuloEnquetes) await window.ModuloEnquetes.inicializar();
  if (window.ModuloQuiz) await window.ModuloQuiz.inicializar();
  
  console.log('✅ Moderador Core pronto');
  console.log('💡 Dica: Selecione uma palestra para usar Perguntas');
}

// =====================================================
// PALESTRAS
// =====================================================

async function carregarListaPalestras() {
  const select = document.getElementById('palestraSelect');
  
  try {
    const { data, error } = await supabase
      .from('cnv25_palestras')
      .select('*')
      .order('inicio', { ascending: true });
    
    if (error) throw error;
    
    select.innerHTML = '<option value="">📌 Selecione para usar Perguntas...</option>';
    
    if (data && data.length > 0) {
      data.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        
        const inicio = new Date(p.inicio).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        option.textContent = `${p.titulo} - ${p.palestrante || 'TBD'} (${inicio})`;
        select.appendChild(option);
      });
    }
    
    // NÃO selecionar automaticamente - deixar usuário escolher
    
  } catch (error) {
    console.error('❌ Erro ao carregar palestras:', error);
    mostrarErro('Erro ao carregar palestras');
  }
}

async function selecionarPalestra(id) {
  if (!id) {
    console.log('ℹ️ Nenhuma palestra selecionada - modo livre');
    return;
  }
  
  try {
    mostrarLoading(true);
    
    ModeradorState.palestraId = id;
    
    // Ativar palestra globalmente
    await supabase
      .from('cnv25_palestra_ativa')
      .update({ palestra_id: id })
      .eq('id', 1);
    
    // Carregar dados
    await carregarPalestra();
    await carregarControle();
    
    // Conectar realtime
    conectarRealtimeCore();
    
    // Notificar módulos
    if (window.ModuloPerguntas) await window.ModuloPerguntas.inicializar();
    if (window.ModuloEnquetes) await window.ModuloEnquetes.inicializar();
    if (window.ModuloQuiz) await window.ModuloQuiz.inicializar();
    
    // Mostrar interface
    document.getElementById('headerConteudo').classList.remove('hidden');
    document.getElementById('mainConteudo').classList.remove('hidden');
    
    atualizarUICore();
    
    mostrarLoading(false);
    
    window.ModeradorCore.mostrarNotificacao('Palestra selecionada!', 'success');
    
  } catch (error) {
    console.error('Erro ao selecionar palestra:', error);
    mostrarErro('Erro ao selecionar palestra');
    mostrarLoading(false);
  }
}

async function carregarPalestra() {
  const { data } = await supabase
    .from('cnv25_palestras')
    .select('*')
    .eq('id', ModeradorState.palestraId)
    .single();
  
  ModeradorState.palestra = data;
  
  document.getElementById('palestraTitulo').textContent = data.titulo;
  document.getElementById('palestrante').textContent = data.palestrante || 'A definir';
}

async function carregarControle() {
  let { data, error } = await supabase
    .from('cnv25_palestra_controle')
    .select('*')
    .eq('palestra_id', ModeradorState.palestraId)
    .single();
  
  if (error && error.code === 'PGRST116') {
    // Criar controle se não existir
    const { data: novoControle } = await supabase
      .from('cnv25_palestra_controle')
      .insert([{
        palestra_id: ModeradorState.palestraId,
        perguntas_abertas: false,
        silencio_ativo: false,
        enquete_ativa: null,
        quiz_ativo: null
      }])
      .select()
      .single();
    
    data = novoControle;
  }
  
  ModeradorState.controle = data;
  atualizarBadgesStatus();
}

// =====================================================
// REALTIME
// =====================================================

function conectarRealtimeCore() {
  desconectarCanaisCore();
  
  const palestraId = ModeradorState.palestraId;
  
  // Canal da palestra
  ModeradorState.canais.palestra = supabase
    .channel(`mod_palestra:${palestraId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'cnv25_palestras',
      filter: `id=eq.${palestraId}`
    }, (payload) => {
      ModeradorState.palestra = payload.new;
      atualizarUICore();
    })
    .subscribe();
  
  // Canal de controle
  ModeradorState.canais.controle = supabase
    .channel(`mod_controle:${palestraId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'cnv25_palestra_controle',
      filter: `palestra_id=eq.${palestraId}`
    }, (payload) => {
      ModeradorState.controle = payload.new;
      atualizarBadgesStatus();
      
      // Notificar módulos sobre mudanças
      if (window.ModuloEnquetes && payload.new.enquete_ativa !== ModeradorState.controle?.enquete_ativa) {
        window.ModuloEnquetes.onEnqueteAtivaMudou(payload.new.enquete_ativa);
      }
      
      if (window.ModuloQuiz && payload.new.quiz_ativo !== ModeradorState.controle?.quiz_ativo) {
        window.ModuloQuiz.onQuizAtivoMudou(payload.new.quiz_ativo);
      }
    })
    .subscribe();
}

function desconectarCanaisCore() {
  Object.values(ModeradorState.canais).forEach(canal => {
    if (canal) window.supabase.removeChannel(canal);
  });
  
  ModeradorState.canais = {
    palestraAtiva: null,
    palestra: null,
    controle: null
  };
}

// =====================================================
// UI - BADGES E STATUS
// =====================================================

function atualizarBadgesStatus() {
  const statusPerguntas = document.getElementById('statusPerguntas');
  const statusSilencio = document.getElementById('statusSilencio');
  const btnTogglePerguntas = document.getElementById('btnTogglePerguntas');
  const btnToggleSilencio = document.getElementById('btnToggleSilencio');
  
  if (!ModeradorState.controle) return;
  
  // Status Perguntas
  if (ModeradorState.controle.perguntas_abertas) {
    statusPerguntas.textContent = '✅ ABERTAS';
    statusPerguntas.className = 'px-4 py-2 rounded-full text-sm font-semibold bg-cnv-success text-white';
    btnTogglePerguntas.textContent = '❌ Fechar Perguntas';
    btnTogglePerguntas.className = 'px-4 py-2 bg-cnv-error text-white rounded-lg hover:opacity-90';
  } else {
    statusPerguntas.textContent = '❌ FECHADAS';
    statusPerguntas.className = 'px-4 py-2 rounded-full text-sm font-semibold bg-gray-400 text-white';
    btnTogglePerguntas.textContent = '✓ Abrir Perguntas';
    btnTogglePerguntas.className = 'px-4 py-2 bg-cnv-success text-white rounded-lg hover:opacity-90';
  }
  
  // Status Silêncio
  if (ModeradorState.controle.silencio_ativo) {
    statusSilencio.classList.remove('hidden');
    statusSilencio.textContent = '🔇 SILÊNCIO';
    btnToggleSilencio.textContent = '🔊 Desativar Silêncio';
    btnToggleSilencio.className = 'px-4 py-2 bg-cnv-warning text-white rounded-lg hover:opacity-90';
  } else {
    statusSilencio.classList.add('hidden');
    btnToggleSilencio.textContent = '🔇 Ativar Silêncio';
    btnToggleSilencio.className = 'px-4 py-2 bg-gray-400 text-white rounded-lg hover:opacity-90';
  }
}

function atualizarUICore() {
  atualizarBadgesStatus();
  
  document.getElementById('palestraTitulo').textContent = ModeradorState.palestra?.titulo || '-';
  document.getElementById('palestrante').textContent = ModeradorState.palestra?.palestrante || 'A definir';
}

// =====================================================
// CONTROLES GLOBAIS
// =====================================================

async function togglePerguntas() {
  if (!ModeradorState.palestraId) return;
  
  const novoStatus = !ModeradorState.controle.perguntas_abertas;
  
  await atualizarControlePalestra(ModeradorState.palestraId, {
    perguntas_abertas: novoStatus
  });
  
  mostrarNotificacao(
    novoStatus ? 'Perguntas abertas!' : 'Perguntas fechadas!',
    novoStatus ? 'success' : 'info'
  );
}

async function toggleSilencio() {
  if (!ModeradorState.palestraId) return;
  
  const novoStatus = !ModeradorState.controle.silencio_ativo;
  
  await atualizarControlePalestra(ModeradorState.palestraId, {
    silencio_ativo: novoStatus
  });
  
  mostrarNotificacao(
    novoStatus ? 'Modo silêncio ativado!' : 'Modo silêncio desativado!',
    novoStatus ? 'warning' : 'info'
  );
}

// =====================================================
// TABS
// =====================================================

function trocarAba(aba) {
  // Remover active de todos
  document.querySelectorAll('.tab-button').forEach(btn => 
    btn.classList.remove('active')
  );
  document.querySelectorAll('.tab-content').forEach(content => 
    content.classList.remove('active')
  );
  
  // Adicionar active no selecionado
  const btnIndex = { 'perguntas': 0, 'enquetes': 1, 'quiz': 2 };
  document.querySelectorAll('.tab-button')[btnIndex[aba]].classList.add('active');
  
  const tabId = `tab${aba.charAt(0).toUpperCase() + aba.slice(1)}`;
  document.getElementById(tabId).classList.add('active');
  
  console.log(`📑 Aba trocada: ${aba}`);
}

// =====================================================
// EVENTOS
// =====================================================

function configurarEventosCore() {
  // Seleção de palestra
  document.getElementById('palestraSelect').addEventListener('change', function() {
    if (this.value) selecionarPalestra(this.value);
  });
  
  // Controles globais
  document.getElementById('btnTogglePerguntas').onclick = togglePerguntas;
  document.getElementById('btnToggleSilencio').onclick = toggleSilencio;
}

// =====================================================
// UTILIDADES
// =====================================================

function mostrarLoading(show) {
  const loader = document.getElementById('loadingOverlay');
  if (loader) {
    loader.style.display = show ? 'flex' : 'none';
  }
}

function mostrarErro(mensagem) {
  alert('❌ ' + mensagem);
}

function mostrarNotificacao(mensagem, tipo = 'info') {
  // TODO: Implementar sistema de notificações toast
  console.log(`[${tipo.toUpperCase()}] ${mensagem}`);
}

function esc(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// =====================================================
// CLEANUP
// =====================================================

window.addEventListener('beforeunload', () => {
  desconectarCanaisCore();
  if (window.ModuloPerguntas) window.ModuloPerguntas.desconectar();
  if (window.ModuloEnquetes) window.ModuloEnquetes.desconectar();
  if (window.ModuloQuiz) window.ModuloQuiz.desconectar();
});

// =====================================================
// EXPORTAR
// =====================================================

window.ModeradorCore = {
  state: ModeradorState,
  inicializar: inicializarModerador,
  trocarAba: trocarAba,
  esc: esc,
  mostrarNotificacao: mostrarNotificacao,
  atualizarControlePalestra // <--- novo
};

console.log('✅ Moderador Core carregado');
