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
// UTILS DOM
// =====================================================
function getEl(id) {
  return document.getElementById(id);
}
function setTextIfExists(id, text) {
  const el = getEl(id);
  if (el) el.textContent = text;
}

// =====================================================
// INICIALIZAÇÃO
// =====================================================

async function inicializarModerador() {
  console.log('🎛️ Moderador Core v2 inicializando...');

  await carregarListaPalestras();
  configurarEventosCore();

  // Mostrar interface sem exigir palestra
  const hdr = getEl('headerConteudo');
  const main = getEl('mainConteudo');
  if (hdr) hdr.classList.remove('hidden');
  if (main) main.classList.remove('hidden');

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
  const select = getEl('selectPalestra');
  if (!select) {
    console.warn('⚠️ selectPalestra não encontrado no DOM.');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('cnv25_palestras')
      .select('*')
      .order('inicio', { ascending: true });

    if (error) throw error;

    select.innerHTML = '<option value="">📌 Selecione para usar Perguntas...</option>';

    if (data && data.length > 0) {
      data.forEach((p) => {
        const option = document.createElement('option');
        option.value = p.id;

        const inicio = p.inicio
          ? new Date(p.inicio).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })
          : null;

        option.textContent = `${p.titulo} - ${p.palestrante || 'TBD'}${inicio ? ` (${inicio})` : ''}`;
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

    // 1) fechar perguntas da palestra atualmente ativa (se houver)
    try {
      const { data: pa } = await supabase
        .from('cnv25_palestra_ativa')
        .select('palestra_id')
        .eq('id', 1)
        .single();

      const antigaId = pa?.palestra_id || null;
      if (antigaId && antigaId !== id) {
        await supabase
          .from('cnv25_palestra_controle')
          .update({ perguntas_abertas: false, updated_at: new Date().toISOString() })
          .eq('palestra_id', antigaId);
      }
    } catch (e) {
      console.warn('⚠️ Não foi possível fechar perguntas da palestra anterior:', e?.message || e);
    }

    // 2) definir nova ativa
    ModeradorState.palestraId = id;
    await supabase.from('cnv25_palestra_ativa').update({ palestra_id: id }).eq('id', 1);

    // 3) carregar dados e realtime como já fazia
    await carregarPalestra();
    await carregarControle();
    conectarRealtimeCore();

    if (window.ModuloPerguntas) await window.ModuloPerguntas.inicializar();
    if (window.ModuloEnquetes) await window.ModuloEnquetes.inicializar();
    if (window.ModuloQuiz) await window.ModuloQuiz.inicializar();

    const hdr = getEl('headerConteudo');
    const main = getEl('mainConteudo');
    if (hdr) hdr.classList.remove('hidden');
    if (main) main.classList.remove('hidden');

    atualizarUICore();
    mostrarLoading(false);
    mostrarNotificacao('Palestra selecionada!', 'success');

  } catch (error) {
    console.error('Erro ao selecionar palestra:', error);
    mostrarErro('Erro ao selecionar palestra');
    mostrarLoading(false);
  }
}

async function carregarPalestra() {
  const { data, error } = await supabase
    .from('cnv25_palestras')
    .select('*')
    .eq('id', ModeradorState.palestraId)
    .single();

  if (error) {
    console.error('❌ carregarPalestra:', error);
    return;
  }

  ModeradorState.palestra = data;

  // Esses IDs podem não existir no layout atual — proteger SEMPRE
  setTextIfExists('palestraTitulo', data.titulo);
  setTextIfExists('palestrante', data.palestrante || 'A definir');

  // Sincroniza select (id novo: selectPalestra)
  const sel = getEl('selectPalestra');
  if (sel) sel.value = data.id;
}

async function carregarControle() {
  let { data, error } = await supabase
    .from('cnv25_palestra_controle')
    .select('*')
    .eq('palestra_id', ModeradorState.palestraId)
    .single();

  if (error && error.code === 'PGRST116') {
    // Criar controle se não existir
    const { data: novoControle, error: err2 } = await supabase
      .from('cnv25_palestra_controle')
      .insert([
        {
          palestra_id: ModeradorState.palestraId,
          perguntas_abertas: false,
          silencio_ativo: false,
          enquete_ativa: null,
          quiz_ativo: null
        }
      ])
      .select()
      .single();

    if (!err2) data = novoControle;
  }

  ModeradorState.controle = data || null;
  atualizarBadgesStatus();
}

// =====================================================
// REALTIME
// =====================================================

function conectarRealtimeCore() {
  desconectarCanaisCore();

  const palestraId = ModeradorState.palestraId;
  if (!palestraId) return;

  // Canal da palestra
  ModeradorState.canais.palestra = supabase
    .channel(`mod_palestra:${palestraId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'cnv25_palestras',
        filter: `id=eq.${palestraId}`
      },
      (payload) => {
        ModeradorState.palestra = payload.new;
        atualizarUICore();
      }
    )
    .subscribe();

  // Canal de controle
  ModeradorState.canais.controle = supabase
    .channel(`mod_controle:${palestraId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'cnv25_palestra_controle',
        filter: `palestra_id=eq.${palestraId}`
      },
      (payload) => {
        const prev = ModeradorState.controle;
        ModeradorState.controle = payload.new;
        atualizarBadgesStatus();

        // Notificar módulos sobre mudanças relevantes
        if (window.ModuloEnquetes && prev?.enquete_ativa !== payload.new.enquete_ativa) {
          window.ModuloEnquetes.onEnqueteAtivaMudou?.(payload.new.enquete_ativa);
        }

        if (window.ModuloQuiz && prev?.quiz_ativo !== payload.new.quiz_ativo) {
          window.ModuloQuiz.onQuizAtivoMudou?.(payload.new.quiz_ativo);
        }
      }
    )
    .subscribe();
}

function desconectarCanaisCore() {
  Object.values(ModeradorState.canais).forEach((canal) => {
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
  const statusPerguntas = getEl('statusPerguntas');
  const statusSilencio = getEl('statusSilencio');
  const btnTogglePerguntas = getEl('btnTogglePerguntas');
  const btnToggleSilencio = getEl('btnToggleSilencio');

  if (!ModeradorState.controle) return;

  // Status Perguntas
  if (statusPerguntas) {
    if (ModeradorState.controle.perguntas_abertas) {
      statusPerguntas.textContent = '✅ ABERTAS';
      statusPerguntas.className =
        'px-4 py-2 rounded-full text-sm font-semibold bg-cnv-success text-white';
      if (btnTogglePerguntas) {
        btnTogglePerguntas.textContent = '❌ Fechar Perguntas';
        btnTogglePerguntas.className =
          'px-4 py-2 bg-cnv-error text-white rounded-lg hover:opacity-90';
      }
    } else {
      statusPerguntas.textContent = '❌ FECHADAS';
      statusPerguntas.className =
        'px-4 py-2 rounded-full text-sm font-semibold bg-gray-400 text-white';
      if (btnTogglePerguntas) {
        btnTogglePerguntas.textContent = '✓ Abrir Perguntas';
        btnTogglePerguntas.className =
          'px-4 py-2 bg-cnv-success text-white rounded-lg hover:opacity-90';
      }
    }
  }

  // Status Silêncio
  if (statusSilencio) {
    if (ModeradorState.controle.silencio_ativo) {
      statusSilencio.classList.remove('hidden');
      statusSilencio.textContent = '🔇 SILÊNCIO';
      if (btnToggleSilencio) {
        btnToggleSilencio.textContent = '🔊 Desativar Silêncio';
        btnToggleSilencio.className =
          'px-4 py-2 bg-cnv-warning text-white rounded-lg hover:opacity-90';
      }
    } else {
      statusSilencio.classList.add('hidden');
      if (btnToggleSilencio) {
        btnToggleSilencio.textContent = '🔇 Ativar Silêncio';
        btnToggleSilencio.className =
          'px-4 py-2 bg-gray-400 text-white rounded-lg hover:opacity-90';
      }
    }
  }
}

function atualizarUICore() {
  atualizarBadgesStatus();

  // Estes elementos são opcionais no layout atual
  setTextIfExists('palestraTitulo', ModeradorState.palestra?.titulo || '-');
  setTextIfExists('palestrante', ModeradorState.palestra?.palestrante || 'A definir');
}

// =====================================================
// CONTROLES GLOBAIS
// =====================================================

async function togglePerguntas() {
  if (!ModeradorState.palestraId || !ModeradorState.controle) return;

  const novoStatus = !ModeradorState.controle.perguntas_abertas;

  // UI otimista
  ModeradorState.controle.perguntas_abertas = novoStatus;
  atualizarBadgesStatus();

  const ok = await atualizarControlePalestra(ModeradorState.palestraId, {
    perguntas_abertas: novoStatus
  });

  if (!ok) {
    // rollback se falhar
    ModeradorState.controle.perguntas_abertas = !novoStatus;
    atualizarBadgesStatus();
    mostrarNotificacao('Falha ao alternar perguntas.', 'error');
    return;
  }

  mostrarNotificacao(
    novoStatus ? 'Perguntas abertas!' : 'Perguntas fechadas!',
    novoStatus ? 'success' : 'info'
  );
}

async function toggleSilencio() {
  if (!ModeradorState.palestraId || !ModeradorState.controle) return;

  const novoStatus = !ModeradorState.controle.silencio_ativo;

  // UI otimista
  ModeradorState.controle.silencio_ativo = novoStatus;
  atualizarBadgesStatus();

  const ok = await atualizarControlePalestra(ModeradorState.palestraId, {
    silencio_ativo: novoStatus
  });

  if (!ok) {
    // rollback se falhar
    ModeradorState.controle.silencio_ativo = !novoStatus;
    atualizarBadgesStatus();
    mostrarNotificacao('Falha ao alternar silêncio.', 'error');
    return;
  }

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
  document.querySelectorAll('.tab-button').forEach((btn) => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach((content) =>
    content.classList.remove('active')
  );

  // Adicionar active no selecionado
  const btnIndex = { perguntas: 0, enquetes: 1, quiz: 2 };
  const allButtons = document.querySelectorAll('.tab-button');
  if (allButtons[btnIndex[aba]]) allButtons[btnIndex[aba]].classList.add('active');

  const tabId = `tab${aba.charAt(0).toUpperCase() + aba.slice(1)}`;
  const tab = getEl(tabId);
  if (tab) tab.classList.add('active');

  console.log(`📑 Aba trocada: ${aba}`);
}

// =====================================================
// EVENTOS
// =====================================================

function configurarEventosCore() {
  // Seleção de palestra (novo id)
  const select = getEl('selectPalestra');
  if (select) {
    select.addEventListener('change', function () {
      if (this.value) selecionarPalestra(this.value);
    });
  } else {
    console.warn('⚠️ selectPalestra não encontrado para bind de eventos.');
  }

  // Controles globais
  const btnPerg = getEl('btnTogglePerguntas');
  if (btnPerg) btnPerg.onclick = togglePerguntas;

  const btnSil = getEl('btnToggleSilencio');
  if (btnSil) btnSil.onclick = toggleSilencio;
}

// =====================================================
// UTILIDADES
// =====================================================

function mostrarLoading(show) {
  const loader = getEl('loadingOverlay');
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
  if (window.ModuloPerguntas) window.ModuloPerguntas.desconectar?.();
  if (window.ModuloEnquetes) window.ModuloEnquetes.desconectar?.();
  if (window.ModuloQuiz) window.ModuloQuiz.desconectar?.();
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
  atualizarControlePalestra // <--- exposto
};

console.log('✅ Moderador Core carregado');
