// =====================================================
// MODERADOR - ENQUETES (DESACOPLADO DE PALESTRA)
// =====================================================

(() => {
  // Estado local
  let _enquetes = [];
  let _enqueteAtivaId = null;         // do broadcast
  let _mostrarResultado = false;      // do broadcast

  // Canais realtime
  let _canalEnquetes = null;
  let _canalBroadcast = null;

  // =====================================================
  // Utils DOM
  // =====================================================
  const $ = (sel) => document.querySelector(sel);
  const esc = (t) => {
    const d = document.createElement('div'); d.textContent = t; return d.innerHTML;
  };
  const toast = (msg, tipo='info') => window.ModeradorCore?.mostrarNotificacao?.(msg, tipo);

  // Render “ATIVA” no card
  function marcarEnqueteAtivaUI(enqueteId) {
    _enqueteAtivaId = enqueteId || null;
    document.querySelectorAll('[data-enquete-id]').forEach(row => {
      const isAtiva = row.getAttribute('data-enquete-id') === _enqueteAtivaId;
      row.classList.toggle('ring-2', isAtiva);
      row.classList.toggle('ring-green-500', isAtiva);

      const badge = row.querySelector('[data-badge-ativa]');
      if (badge) badge.classList.toggle('hidden', !isAtiva);
    });

    const toggle = $('#toggleResultadoTelao');
    if (toggle) toggle.checked = !!_mostrarResultado;
  }

  // =====================================================
  // BROADCAST (controle global do telão)
  // =====================================================
  async function carregarBroadcast() {
    const { data, error } = await supabase
      .from('cnv25_broadcast_controle')
      .select('enquete_ativa, mostrar_resultado_enquete')
      .eq('id', 1)
      .single();
    if (error) { console.error(error); return; }

    _enqueteAtivaId = data?.enquete_ativa || null;
    _mostrarResultado = !!data?.mostrar_resultado_enquete;
    marcarEnqueteAtivaUI(_enqueteAtivaId);
  }

  async function setBroadcast(patch) {
    const { error } = await supabase
      .from('cnv25_broadcast_controle')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) { console.error(error); toast('Falha ao atualizar telão.', 'error'); return false; }
    return true;
  }

  function conectarRealtimeBroadcast() {
    if (_canalBroadcast) return;
    _canalBroadcast = supabase
      .channel('mod_broadcast_enquetes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cnv25_broadcast_controle',
        filter: 'id=eq.1'
      }, (payload) => {
        const b = payload.new;
        _enqueteAtivaId = b?.enquete_ativa || null;
        _mostrarResultado = !!b?.mostrar_resultado_enquete;
        marcarEnqueteAtivaUI(_enqueteAtivaId);
      })
      .subscribe();
  }

  // =====================================================
  // LISTA DE ENQUETES
  // =====================================================
  async function carregarEnquetes() {
    const { data, error } = await supabase
      .from('cnv25_enquetes')
      .select('id, titulo, opcoes, ativa, created_at, encerrada_em')
      .eq('modo','enquete')
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return; }

    _enquetes = data || [];
    renderizarLista();
  }

  function conectarRealtimeEnquetes() {
    if (_canalEnquetes) return;
    _canalEnquetes = supabase
      .channel('mod_enquetes_lista_global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cnv25_enquetes' }, async () => {
        await carregarEnquetes();
      })
      .subscribe();
  }

  function renderizarLista() {
    const wrap = document.getElementById('listaEnquetes');
    if (!wrap) return;

    if (!_enquetes.length) {
      wrap.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhuma enquete</p>';
      return;
    }

    wrap.innerHTML = _enquetes.map(e => {
      const isAtiva = e.id === _enqueteAtivaId;
      const ops = (e.opcoes?.opcoes || []).map((t,i)=>`${String.fromCharCode(65+i)}. ${esc(t)}`).join(' • ');
      const encerrada = !!e.encerrada_em;

      return `
        <div class="border rounded-lg p-3 mb-2 bg-white hover:bg-gray-50 transition"
             data-enquete-id="${e.id}">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="font-semibold truncate">${esc(e.titulo)}</div>
              <div class="text-xs text-gray-500 truncate">${ops}</div>
              ${encerrada ? '<div class="text-[11px] text-red-600 mt-1">🏁 Encerrada</div>' : ''}
            </div>
            <div class="flex items-center gap-2">
              <span data-badge-ativa class="text-xs px-2 py-1 rounded bg-green-600 text-white ${isAtiva?'':'hidden'}">ATIVA</span>
              ${!encerrada ? `
                <button class="px-3 py-1 text-xs rounded bg-blue-600 text-white"
                        onclick="window.ModuloEnquetes.ativar('${e.id}')">Ativar</button>
              ` : ''}
              <button class="px-3 py-1 text-xs rounded bg-gray-200"
                      onclick="window.ModuloEnquetes.abrirResultados('${e.id}')">Resultados</button>
              ${!isAtiva ? `
                <button class="px-3 py-1 text-xs rounded bg-red-600 text-white"
                        onclick="window.ModuloEnquetes.deletar('${e.id}')">Deletar</button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    marcarEnqueteAtivaUI(_enqueteAtivaId);
  }

  // =====================================================
  // RESULTADOS (Drawer)
  // =====================================================
  async function abrirResultados(enqueteId) {
    const e = _enquetes.find(x => x.id === enqueteId);
    if (!e) return;

    const backdrop = document.getElementById('drawerBackdrop');
    const drawer   = document.getElementById('drawerResultados');
    const body     = document.getElementById('drawerBody');
    const title    = document.getElementById('drawerTitulo');
    if (!drawer || !body || !title) return;

    title.textContent = `Resultados — ${e.titulo}`;
    body.innerHTML = '<div class="text-sm text-gray-600">Carregando…</div>';
    drawer.classList.remove('translate-x-full');
    if (backdrop) backdrop.classList.remove('hidden');

    // Tenta view agregada; fallback para contagem no front
    let votos = [];
    let total = 0;
    let viaView = true;

    const r1 = await supabase
      .from('cnv25_enquete_resultado_v') // se não existir, cai no fallback
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
            <div class="font-medium"><strong>${labels[idx]}.</strong> ${esc(txt)}</div>
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

  // =====================================================
  // AÇÕES
  // =====================================================
  async function ativar(enqueteId) {
    // UI otimista
    marcarEnqueteAtivaUI(enqueteId);

    const ok = await setBroadcast({ enquete_ativa: enqueteId, mostrar_resultado_enquete: false });
    if (!ok) marcarEnqueteAtivaUI(_enqueteAtivaId); // rollback
    else toast('Enquete ativada!', 'success');
  }

  async function desativar() {
    const ok = await setBroadcast({ enquete_ativa: null, mostrar_resultado_enquete: false });
    if (!ok) return;
    marcarEnqueteAtivaUI(null);
    toast('Enquete desativada', 'info');
  }

  async function onToggleResultadoTelao(checked) {
    const ok = await setBroadcast({ mostrar_resultado_enquete: !!checked });
    if (!ok) return;
    _mostrarResultado = !!checked;
    toast(checked ? 'Resultado habilitado no telão' : 'Resultado oculto no telão', checked ? 'success' : 'info');
  }

  async function deletar(enqueteId) {
    // bloqueia se for a ativa global
    if (_enqueteAtivaId === enqueteId) {
      alert('Desative esta enquete antes de deletar.');
      return;
    }
    if (!confirm('Excluir esta enquete?')) return;

    const { error } = await supabase.from('cnv25_enquetes').delete().eq('id', enqueteId);
    if (error) { console.error(error); toast('Erro ao excluir', 'error'); return; }

    await carregarEnquetes();
    toast('Enquete excluída.', 'success');
  }

  // =====================================================
  // MODAL – Criar/Editar Enquete (usando IDs do HTML atual)
  // =====================================================
  function abrirModalEnqueteNova() {
    const modal = document.getElementById('modalEnqueteCRUD');
    if (!modal) return;
    document.getElementById('tituloModalEnquete').textContent = 'Criar Enquete';
    document.getElementById('btnTextEnquete').textContent = 'Criar Enquete';
    document.getElementById('enqueteIdEdit').value = '';
    document.getElementById('inputTituloEnqueteCRUD').value = '';
    document.getElementById('inputOpcoesEnqueteCRUD').value = '';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function fecharModalEnqueteCRUD() {
    const modal = document.getElementById('modalEnqueteCRUD');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
  }

  async function salvarEnqueteCRUD(ev) {
    ev?.preventDefault?.();
    const titulo = document.getElementById('inputTituloEnqueteCRUD').value.trim();
    const linhas = document.getElementById('inputOpcoesEnqueteCRUD').value.trim().split('\n')
      .map(s=>s.trim()).filter(Boolean);

    if (!titulo || linhas.length < 2) {
      alert('Informe título e pelo menos 2 opções.');
      return;
    }
    if (linhas.length > 10) {
      alert('Máximo de 10 opções.');
      return;
    }

    const payload = {
      palestra_id: null,
      titulo,
      tipo: 'multipla_escolha',
      modo: 'enquete',
      opcoes: { opcoes: linhas },
      ativa: true
    };

    const { error } = await supabase.from('cnv25_enquetes').insert([payload]);
    if (error) { console.error(error); alert('Erro ao criar enquete'); return; }

    fecharModalEnqueteCRUD();
    await carregarEnquetes();

    // Pergunta se ativa agora
    const nova = _enquetes.find(e => e.titulo === titulo && (e.opcoes?.opcoes||[]).join('|') === linhas.join('|'));
    if (nova && confirm('Ativar esta enquete agora?')) {
      await ativar(nova.id);
    }
  }

  // =====================================================
  // Eventos
  // =====================================================
  function configurarEventos() {
    // Botões de modal
    window.abrirModalEnqueteNova = abrirModalEnqueteNova;   // para o HTML
    window.fecharModalEnqueteCRUD = fecharModalEnqueteCRUD; // para o HTML

    const formCRUD = document.getElementById('formEnqueteCRUD');
    if (formCRUD) formCRUD.addEventListener('submit', salvarEnqueteCRUD);

    // Drawer fechar (já expõe global)
    window.fecharResultados = fecharResultados;

    // Toggle “mostrar resultado”
    window.onToggleResultadoTelao = onToggleResultadoTelao;

    // Exportar CSV da enquete ATIVA (se quiser manter esse botão)
    const btnExport = document.getElementById('btnExportarEnquete');
    if (btnExport) {
      btnExport.onclick = async () => {
        if (!_enqueteAtivaId) return alert('Nenhuma enquete ativa.');
        try {
          const ativa = _enquetes.find(x => x.id === _enqueteAtivaId);
          const { data: respostas } = await supabase
            .from('cnv25_enquete_respostas')
            .select('*')
            .eq('enquete_id', _enqueteAtivaId)
            .order('created_at');

          if (!respostas || respostas.length === 0) {
            alert('Nenhuma resposta para exportar');
            return;
          }

          const csv = [
            ['Data/Hora','Opção','Device (hash 8)'].join(','),
            ...respostas.map(r => [
              new Date(r.created_at).toLocaleString('pt-BR'),
              (ativa?.opcoes?.opcoes || [])[ (r.resposta?.opcaoIndex ?? r.resposta?.opcao_index ?? 0) ] || 'N/A',
              (r.device_id_hash||'').slice(0,8)
            ].map(c => `"${String(c).replace(/"/g,'""')}"`).join(','))
          ].join('\n');

          const blob = new Blob(['\ufeff'+csv], { type:'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `enquete_${(ativa?.titulo||'ativa').replace(/[^a-z0-9]/gi,'_')}_${Date.now()}.csv`;
          link.click();
          toast('CSV exportado!', 'success');
        } catch (e) {
          console.error(e);
          alert('Erro ao exportar CSV');
        }
      };
    }
  }

  // =====================================================
  // API Pública (global)
  // =====================================================
  async function inicializar() {
    await carregarEnquetes();
    await carregarBroadcast();
    conectarRealtimeEnquetes();
    conectarRealtimeBroadcast();
    configurarEventos();
    console.log('✅ Módulo Enquetes (global) pronto');
  }

  function desconectar() {
    if (_canalEnquetes) { window.supabase.removeChannel(_canalEnquetes); _canalEnquetes = null; }
    if (_canalBroadcast) { window.supabase.removeChannel(_canalBroadcast); _canalBroadcast = null; }
  }

  window.ModuloEnquetes = {
    inicializar,
    desconectar,
    ativar,
    desativar,
    abrirResultados,
    deletar
  };
})();
