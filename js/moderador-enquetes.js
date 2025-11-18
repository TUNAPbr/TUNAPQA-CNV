// =====================================================
// MODERADOR - MÓDULO DE ENQUETES (independente de palestra)
// =====================================================

const ModuloEnquetes = (() => {
  // Estado local
  let _enquetes = [];
  let _enqueteAtivaId = null;
  let _canalEnquetes = null;

  // Estado do CRUD
  let _editEnqueteId = null;

  // =====================================================
  // INICIALIZAÇÃO
  // =====================================================

  async function inicializar() {
    console.log('📊 Módulo Enquetes inicializando...');

    await carregarEnquetes();
    conectarRealtime();
    configurarEventos();

    console.log('✅ Módulo Enquetes pronto');
  }

  function desconectar() {
    if (_canalEnquetes) {
      window.supabase.removeChannel(_canalEnquetes);
      _canalEnquetes = null;
    }
  }

  // =====================================================
  // CARREGAR ENQUETES
  // =====================================================

  async function carregarEnquetes() {
    try {
      const { data, error } = await supabase
        .from('cnv25_enquetes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      _enquetes = data || [];
      // tentar descobrir qual é "ativa" pelo broadcast, se já estiver setado
      // (o ModeradorCore chama onEnqueteAtivaMudou quando o broadcast muda)
      renderizarLista();
    } catch (err) {
      console.error('Erro ao carregar enquetes:', err);
    }
  }

  // =====================================================
  // REALTIME
  // =====================================================

  function conectarRealtime() {
    desconectar();

    _canalEnquetes = supabase
      .channel('mod_enquetes_global')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cnv25_enquetes'
      }, (payload) => {
        const nova = payload.new;
        if (!nova) return;

        // Atualiza/insere na lista local
        const idx = _enquetes.findIndex(e => e.id === nova.id);
        if (idx >= 0) {
          _enquetes[idx] = nova;
        } else {
          _enquetes.unshift(nova);
        }

        renderizarLista();
      })
      .subscribe();
  }

  // =====================================================
  // RENDERIZAÇÃO DA LISTA
  // =====================================================

  function renderizarLista() {
    const container = document.getElementById('listaEnquetes');
    if (!container) {
      console.warn('⚠️ listaEnquetes não encontrada no HTML');
      return;
    }

    if (!_enquetes.length) {
      container.innerHTML = `
        <p class="text-gray-500 text-center py-6">
          Nenhuma enquete cadastrada ainda.
        </p>
      `;
      return;
    }

    container.innerHTML = _enquetes.map(enq => {
      const ativa = enq.id === _enqueteAtivaId;
      const encerrada = !!enq.encerrada_em;
      const tipoLabel = traduzTipo(enq.tipo);
      const modoLabel = traduzModo(enq.modo); // enq.modo agora vem undefined, cai no default "Enquete"
      const created = formatarData(enq.created_at);

      return `
        <div class="border rounded-lg p-3 mb-2 bg-white hover:shadow-sm transition">
          <div class="flex items-center justify-between gap-2 mb-1">
            <div>
              <p class="font-medium text-sm">${esc(enq.titulo)}</p>
              <div class="text-xs text-gray-500">
                ${modoLabel} • ${tipoLabel} • Criada em ${created}
              </div>
            </div>
            <div class="flex flex-col items-end gap-1 text-xs">
              ${ativa ? `
                <span class="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 font-semibold">
                  🔴 ATIVA
                </span>
              ` : ''}
              ${encerrada ? `
                <span class="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                  Encerrada
                </span>
              ` : ''}
            </div>
          </div>

          <div class="mt-2 flex flex-wrap gap-2">
            <button 
              class="px-3 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600 transition"
              onclick="window.ModuloEnquetes.abrirModalEditar('${enq.id}')"
            >
              ✎ Editar
            </button>

            ${!ativa ? `
              <button 
                class="px-3 py-1 text-xs rounded bg-green-500 text-white hover:bg-green-600 transition"
                onclick="window.ModuloEnquetes.ativar('${enq.id}')"
              >
                ▶️ Ativar
              </button>
            ` : `
              <button 
                class="px-3 py-1 text-xs rounded bg-gray-500 text-white hover:bg-gray-600 transition"
                onclick="window.ModuloEnquetes.desativar()"
              >
                ⏹ Desativar
              </button>
              <button 
                class="px-3 py-1 text-xs rounded bg-amber-500 text-white hover:bg-amber-600 transition"
                onclick="window.ModuloEnquetes.encerrar('${enq.id}')"
              >
                📊 Encerrar / Mostrar resultado
              </button>
            `}

            <button 
              class="px-3 py-1 text-xs rounded bg-indigo-500 text-white hover:bg-indigo-600 transition"
              onclick="window.ModuloEnquetes.abrirResultados('${enq.id}')"
            >
              📈 Ver resultados
            </button>

            <button 
              class="px-3 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600 transition"
              onclick="window.ModuloEnquetes.deletar('${enq.id}')"
            >
              🗑 Excluir
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // =====================================================
  // CRUD - MODAL
  // =====================================================

  function abrirModalNova() {
    _editEnqueteId = null;
    const modal = document.getElementById('modalEnqueteCRUD');
    if (!modal) return;

    const titulo = document.getElementById('inputTituloEnqueteCRUD');
    const opcoes = document.getElementById('inputOpcoesEnqueteCRUD');
    const tipo   = document.getElementById('selectTipoEnqueteCRUD');
    const modo   = document.getElementById('selectModoEnqueteCRUD'); // mantido só pra não quebrar HTML
    const hiddenId = document.getElementById('enqueteIdEdit');

    if (titulo) titulo.value = '';
    if (opcoes) opcoes.value = '';
    if (tipo)   tipo.value   = 'multipla_escolha';
    if (modo)   modo.value   = 'enquete';
    if (hiddenId) hiddenId.value = '';

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function abrirModalEditar(id) {
    _editEnqueteId = id;
    const modal = document.getElementById('modalEnqueteCRUD');
    if (!modal) return;

    const enq = _enquetes.find(e => e.id === id);
    if (!enq) {
      console.warn('Enquete não encontrada para edição:', id);
      return;
    }

    const titulo = document.getElementById('inputTituloEnqueteCRUD');
    const opcoes = document.getElementById('inputOpcoesEnqueteCRUD');
    const tipo   = document.getElementById('selectTipoEnqueteCRUD');
    const modo   = document.getElementById('selectModoEnqueteCRUD');
    const hiddenId = document.getElementById('enqueteIdEdit');

    if (titulo) titulo.value = enq.titulo || '';
    if (opcoes) {
      // opcoes é jsonb no banco, guardamos como array de strings
      if (Array.isArray(enq.opcoes)) {
        opcoes.value = enq.opcoes.join('\n');
      } else if (enq.opcoes && Array.isArray(enq.opcoes.opcoes)) {
        // caso venha no formato {opcoes:[...]}
        opcoes.value = enq.opcoes.opcoes.join('\n');
      } else {
        opcoes.value = '';
      }
    }
    if (tipo && enq.tipo) tipo.value = enq.tipo;
    // enq.modo não existe mais na tabela; mantemos select no HTML apenas visual
    if (modo) modo.value = 'enquete';
    if (hiddenId) hiddenId.value = enq.id;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function fecharModalCRUD() {
    const modal = document.getElementById('modalEnqueteCRUD');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    _editEnqueteId = null;
  }

  async function salvarEnqueteCRUD(event) {
    if (event) event.preventDefault();

    const titulo = document.getElementById('inputTituloEnqueteCRUD')?.value.trim();
    const opcoesStr = document.getElementById('inputOpcoesEnqueteCRUD')?.value || '';
    const tipo   = document.getElementById('selectTipoEnqueteCRUD')?.value || 'multipla_escolha';
    // const modo   = document.getElementById('selectModoEnqueteCRUD')?.value || 'enquete'; // não usamos mais no banco
    const hiddenId = document.getElementById('enqueteIdEdit');

    if (!titulo) {
      alert('Informe um título para a enquete.');
      return;
    }

    const rawOpcoes = opcoesStr.split('\n')
      .map(o => o.trim())
      .filter(o => o.length > 0);

    if (!rawOpcoes.length) {
      alert('Informe pelo menos uma opção.');
      return;
    }

    const payload = {
      titulo,
      tipo,
      opcoes: rawOpcoes,
      ativa: false
    };

    const btn = document.getElementById('btnSalvarEnqueteCRUD');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Salvando...';
    }

    try {
      if (hiddenId && hiddenId.value) {
        // UPDATE
        const { error } = await supabase
          .from('cnv25_enquetes')
          .update(payload)
          .eq('id', hiddenId.value);

        if (error) throw error;
      } else {
        // INSERT
        const { error } = await supabase
          .from('cnv25_enquetes')
          .insert([payload]);

        if (error) throw error;
      }

      await carregarEnquetes();
      fecharModalCRUD();
      window.ModeradorCore?.mostrarNotificacao?.('Enquete salva com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao salvar enquete:', err);
      window.ModeradorCore?.mostrarNotificacao?.('Erro ao salvar enquete.', 'error') || alert('Erro ao salvar enquete');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Salvar';
      }
    }
  }

  // =====================================================
  // AÇÕES: ATIVAR / DESATIVAR / ENCERRAR / DELETAR
  // =====================================================

  async function ativar(enqueteId) {
    try {
      // 1) Atualiza coluna "ativa" no banco (apenas esta como true)
      const { error: eReset } = await supabase
        .from('cnv25_enquetes')
        .update({ ativa: false })
        .eq('ativa', true);
      if (eReset) throw eReset;

      const { error: eSet } = await supabase
        .from('cnv25_enquetes')
        .update({ ativa: true, encerrada_em: null })
        .eq('id', enqueteId);
      if (eSet) throw eSet;

      // 2) Liga semáforo global em modo ENQUETE
      await window.ModeradorCore.setModoGlobal('enquete', {
        enquete_ativa: enqueteId,
        mostrar_resultado_enquete: false,
        pergunta_exibida: null,
        quiz_ativo: null
      });

      _enqueteAtivaId = enqueteId;
      renderizarLista();
      window.ModeradorCore?.mostrarNotificacao?.('Enquete ativada!', 'success');
    } catch (err) {
      console.error('Erro ao ativar enquete:', err);
      window.ModeradorCore?.mostrarNotificacao?.('Erro ao ativar enquete.', 'error') || alert('Erro ao ativar enquete');
    }
  }

  async function desativar() {
    if (!_enqueteAtivaId) return;

    try {
      const { error } = await supabase
        .from('cnv25_enquetes')
        .update({ ativa: false })
        .eq('id', _enqueteAtivaId);
      if (error) throw error;

      // Desliga modo global (volta pra "aguardando conteúdo")
      await window.ModeradorCore.setModoGlobal(null, {
        enquete_ativa: null,
        mostrar_resultado_enquete: false,
        pergunta_exibida: null,
        quiz_ativo: null
      });

      _enqueteAtivaId = null;
      renderizarLista();
      window.ModeradorCore?.mostrarNotificacao?.('Enquete desativada.', 'info');
    } catch (err) {
      console.error('Erro ao desativar enquete:', err);
      window.ModeradorCore?.mostrarNotificacao?.('Erro ao desativar enquete.', 'error') || alert('Erro ao desativar enquete');
    }
  }

  async function encerrar(enqueteId) {
    try {
      const agora = new Date().toISOString();
      const { error } = await supabase
        .from('cnv25_enquetes')
        .update({
          ativa: false,
          encerrada_em: agora
        })
        .eq('id', enqueteId);
      if (error) throw error;

      // Exibe o resultado dessa enquete no telão/participante
      await window.ModeradorCore.setModoGlobal('enquete', {
        enquete_ativa: enqueteId,
        mostrar_resultado_enquete: true,
        pergunta_exibida: null,
        quiz_ativo: null
      });

      _enqueteAtivaId = enqueteId;
      renderizarLista();
      window.ModeradorCore?.mostrarNotificacao?.('Enquete encerrada. Resultado no telão.', 'success');
    } catch (err) {
      console.error('Erro ao encerrar enquete:', err);
      window.ModeradorCore?.mostrarNotificacao?.('Erro ao encerrar enquete.', 'error') || alert('Erro ao encerrar enquete');
    }
  }

  async function deletar(enqueteId) {
    const alvo = _enquetes.find(e => e.id === enqueteId);
    const titulo = alvo ? alvo.titulo : 'esta enquete';

    if (!confirm(`Tem certeza que deseja excluir "${titulo}"?`)) return;

    try {
      // Se ela for a ativa, desliga o semáforo
      if (_enqueteAtivaId === enqueteId) {
        await window.ModeradorCore.setModoGlobal(null, {
          enquete_ativa: null,
          mostrar_resultado_enquete: false,
          pergunta_exibida: null,
          quiz_ativo: null
        });
        _enqueteAtivaId = null;
      }

      const { error } = await supabase
        .from('cnv25_enquetes')
        .delete()
        .eq('id', enqueteId);
      if (error) throw error;

      _enquetes = _enquetes.filter(e => e.id !== enqueteId);
      renderizarLista();
      window.ModeradorCore?.mostrarNotificacao?.('Enquete excluída.', 'success');
    } catch (err) {
      console.error('Erro ao excluir enquete:', err);
      window.ModeradorCore?.mostrarNotificacao?.('Erro ao excluir enquete.', 'error') || alert('Erro ao excluir enquete');
    }
  }

  async function abrirResultados(enqueteId) {
    try {
      await window.ModeradorCore.setModoGlobal('enquete', {
        enquete_ativa: enqueteId,
        mostrar_resultado_enquete: true,
        pergunta_exibida: null,
        quiz_ativo: null
      });

      _enqueteAtivaId = enqueteId;
      renderizarLista();
      window.ModeradorCore?.mostrarNotificacao?.('Resultado da enquete no telão.', 'info');
    } catch (err) {
      console.error('Erro ao abrir resultados:', err);
      window.ModeradorCore?.mostrarNotificacao?.('Erro ao abrir resultados.', 'error');
    }
  }

  // =====================================================
  // EXPORTAR CSV
  // =====================================================

  async function exportarCSV() {
    if (!_enquetes.length) {
      alert('Não há enquetes para exportar.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('cnv25_enquete_respostas')
        .select('*')
        .in('enquete_id', _enquetes.map(e => e.id));

      if (error) throw error;

      const respostas = data || [];

      const header = [
        'Enquete',
        'Enquete_ID',
        'Device_ID',
        'Resposta',
        'Data/Hora'
      ];

      const linhas = [header.join(',')];

      for (const enq of _enquetes) {
        const respEnq = respostas.filter(r => r.enquete_id === enq.id);
        for (const r of respEnq) {
          const respStr = JSON.stringify(r.resposta).replace(/"/g, '""');
          linhas.push([
            `"${enq.titulo.replace(/"/g, '""')}"`,
            enq.id,
            `"${(r.device_id_hash || '').replace(/"/g, '""')}"`,
            `"${respStr}"`,
            formatarData(r.created_at)
          ].join(','));
        }
      }

      const csv = linhas.join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `enquetes_${Date.now()}.csv`;
      link.click();

      window.ModeradorCore?.mostrarNotificacao?.('CSV de enquetes exportado!', 'success');
    } catch (err) {
      console.error('Erro ao exportar CSV de enquetes:', err);
      window.ModeradorCore?.mostrarNotificacao?.('Erro ao exportar CSV.', 'error');
    }
  }

  // =====================================================
  // EVENTOS (BOTÕES / FORM)
  // =====================================================

  function configurarEventos() {
    const btnNova = document.getElementById('btnNovaEnquete');
    const btnExportar = document.getElementById('btnExportarEnquetes');
    const formCRUD = document.getElementById('formEnqueteCRUD');

    if (btnNova) {
      btnNova.onclick = () => abrirModalNova();
    } else {
      console.warn('⚠️ btnNovaEnquete não encontrado');
    }

    if (btnExportar) {
      btnExportar.onclick = () => exportarCSV();
    }

    if (formCRUD) {
      formCRUD.onsubmit = salvarEnqueteCRUD;
    } else {
      console.warn('⚠️ formEnqueteCRUD não encontrado');
    }
  }

  // =====================================================
  // INTERAÇÃO COM BROADCAST (CHAMADO PELO CORE)
  // =====================================================

  function onEnqueteAtivaMudou(novaId) {
    _enqueteAtivaId = novaId || null;
    renderizarLista();
  }

  // =====================================================
  // UTILIDADES
  // =====================================================

  function formatarData(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function traduzTipo(tipo) {
    switch (tipo) {
      case 'sim_nao': return 'Sim / Não';
      case 'estrelas': return 'Estrelas';
      case 'multipla_escolha':
      default: return 'Múltipla escolha';
    }
  }

  function traduzModo(modo) {
    switch (modo) {
      case 'quiz': return 'Quiz';
      case 'enquete':
      default: return 'Enquete';
    }
  }

  function esc(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
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
    deletar,
    abrirResultados,
    exportarCSV,
    // CRUD
    abrirModalNova,
    abrirModalEditar,
    fecharModalCRUD,
    salvarEnqueteCRUD,
    // integração broadcast
    onEnqueteAtivaMudou
  };
})();

// Expor global
window.ModuloEnquetes = ModuloEnquetes;

console.log('✅ Módulo Enquetes carregado (independente de palestra)');
