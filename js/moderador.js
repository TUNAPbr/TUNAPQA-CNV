// =====================================================
// MODERADOR V2 - COM MELHORIAS
// =====================================================

let palestraId = null;
let palestra = null;
let controle = null;
let perguntas = { pendentes: [], aprovadas: [], exibida: null, respondidas: [] };
let canalRealtime = null;
let canalControle = null;
const logs = [];

// =====================================================
// INICIALIZAÇÃO
// =====================================================

async function inicializar() {
  console.log('🎛️ Moderador v2 inicializando...');
  await carregarListaPalestras();
  document.getElementById('palestraSelect').addEventListener('change', async function() {
    if (this.value) await selecionarPalestra(this.value);
  });
  
  configurarBotoes();
}

// =====================================================
// CARREGAR PALESTRAS
// =====================================================

async function carregarListaPalestras() {
  const select = document.getElementById('palestraSelect');
  
  try {
    const { data, error } = await supabase
      .from('cnv25_palestras')
      .select('*')
      .order('inicio', { ascending: true });
    
    if (error) throw error;
    
    select.innerHTML = '<option value="">Selecione uma palestra...</option>';
    
    if (data && data.length > 0) {
      data.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = `${p.titulo} - ${p.palestrante || 'Palestrante não definido'}`;
        select.appendChild(option);
      });
    }
    
    // Verificar palestra ativa
    const { data: ativaData } = await supabase
      .from('cnv25_palestra_ativa')
      .select('palestra_id')
      .eq('id', 1)
      .single();
    
    if (ativaData?.palestra_id) {
      select.value = ativaData.palestra_id;
      await selecionarPalestra(ativaData.palestra_id);
    }
    
  } catch (error) {
    console.error('❌ Erro ao carregar palestras:', error);
    select.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

// =====================================================
// SELECIONAR PALESTRA
// =====================================================

async function selecionarPalestra(id) {
  palestraId = id;
  
  try {
    // Ativar palestra
    await supabase
      .from('cnv25_palestra_ativa')
      .update({ palestra_id: id })
      .eq('id', 1);
    
    adicionarLog('🎯 Palestra ativada');
    
    // Carregar dados
    await carregarPalestra();
    await carregarControle();
    await carregarPerguntas();
    conectarRealtime();
    
    document.getElementById('headerConteudo').classList.remove('hidden');
    document.getElementById('mainConteudo').classList.remove('hidden');
    
  } catch (error) {
    console.error('Erro:', error);
    alert('Erro ao selecionar palestra');
  }
}

// =====================================================
// CARREGAR DADOS
// =====================================================

async function carregarPalestra() {
  const { data } = await supabase
    .from('cnv25_palestras')
    .select('*')
    .eq('id', palestraId)
    .single();
  
  palestra = data;
  
  document.getElementById('palestraTitulo').textContent = palestra.titulo;
  document.getElementById('palestrante').textContent = palestra.palestrante || 'A definir';
  
  // Atualizar info de limites
  document.getElementById('infoMaxPerguntas').textContent = palestra.max_perguntas || 3;
  document.getElementById('infoIntervalo').textContent = palestra.intervalo_perguntas || 60;
}

async function carregarControle() {
  let { data, error } = await supabase
    .from('cnv25_palestra_controle')
    .select('*')
    .eq('palestra_id', palestraId)
    .single();
  
  // Se não existe, criar
  if (error && error.code === 'PGRST116') {
    const { data: novoControle } = await supabase
      .from('cnv25_palestra_controle')
      .insert([{
        palestra_id: palestraId,
        perguntas_abertas: false,
        silencio_ativo: false
      }])
      .select()
      .single();
    
    data = novoControle;
  }
  
  controle = data;
  atualizarStatusBadges();
}

async function carregarPerguntas() {
  const { data } = await supabase
    .from('cnv25_perguntas')
    .select('*')
    .eq('palestra_id', palestraId)
    .order('created_at');
  
  perguntas.pendentes = data.filter(p => p.status === 'pendente');
  perguntas.aprovadas = data.filter(p => p.status === 'aprovada');
  perguntas.exibida = data.find(p => p.status === 'exibida') || null;
  perguntas.respondidas = data.filter(p => p.status === 'respondida');
  
  renderizarTudo();
}

// =====================================================
// REALTIME
// =====================================================

function conectarRealtime() {
  if (canalRealtime) window.supabase.removeChannel(canalRealtime);
  if (canalControle) window.supabase.removeChannel(canalControle);
  
  canalRealtime = supabase.channel(`mod:${palestraId}`)
    .on('postgres_changes', { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'cnv25_perguntas', 
      filter: `palestra_id=eq.${palestraId}` 
    }, p => { 
      perguntas.pendentes.push(p.new); 
      renderizarTudo(); 
      adicionarLog('Nova pergunta'); 
    })
    .on('postgres_changes', { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'cnv25_perguntas', 
      filter: `palestra_id=eq.${palestraId}` 
    }, p => { 
      atualizarPergunta(p.new); 
    })
    .subscribe();
  
  canalControle = supabase.channel(`controle:${palestraId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'cnv25_palestra_controle',
      filter: `palestra_id=eq.${palestraId}`
    }, p => {
      controle = p.new;
      atualizarStatusBadges();
    })
    .subscribe();
}

function atualizarPergunta(p) {
  perguntas.pendentes = perguntas.pendentes.filter(x => x.id !== p.id);
  perguntas.aprovadas = perguntas.aprovadas.filter(x => x.id !== p.id);
  perguntas.respondidas = perguntas.respondidas.filter(x => x.id !== p.id);
  
  if (p.status === 'pendente') perguntas.pendentes.push(p);
  else if (p.status === 'aprovada') perguntas.aprovadas.push(p);
  else if (p.status === 'exibida') perguntas.exibida = p;
  else if (p.status === 'respondida') {
    perguntas.respondidas.push(p);
    if (perguntas.exibida?.id === p.id) perguntas.exibida = null;
  }
  
  renderizarTudo();
}

// =====================================================
// RENDERIZAÇÃO
// =====================================================

function renderizarTudo() {
  renderizarPendentes();
  renderizarAprovadas();
  renderizarAtual();
  renderizarRespondidas();
  atualizarContadores();
}

function renderizarPendentes() {
  const c = document.getElementById('filaPendentes');
  if (!perguntas.pendentes.length) {
    c.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhuma pendente</p>';
    return;
  }
  c.innerHTML = perguntas.pendentes.map(p => `
    <div class="border rounded-lg p-3">
      <p class="text-sm mb-2">${esc(p.texto)}</p>
      <div class="text-xs text-gray-500 mb-2">
        ${p.anonimo ? '👤 Anônimo' : '👤 ' + esc(p.nome_opt)}
        ${p.email_opt ? ' • 📧 ' + esc(p.email_opt) : ''}
      </div>
      <div class="flex gap-2">
        <button onclick="aprovar('${p.id}')" class="flex-1 bg-green-500 text-white text-xs px-2 py-1 rounded hover:bg-green-600">✓</button>
        <button onclick="recusar('${p.id}')" class="flex-1 bg-red-500 text-white text-xs px-2 py-1 rounded hover:bg-red-600">✗</button>
      </div>
    </div>
  `).join('');
}

function renderizarAprovadas() {
  const c = document.getElementById('listaAprovadas');
  if (!perguntas.aprovadas.length) {
    c.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Nenhuma</p>';
    return;
  }
  c.innerHTML = perguntas.aprovadas.map(p => `
    <div class="border border-green-200 bg-green-50 rounded p-2">
      <p class="text-xs mb-1">${esc(p.texto)}</p>
      <button onclick="exibir('${p.id}')" class="w-full bg-green-500 text-white text-xs px-2 py-1 rounded hover:bg-green-600">📺 Exibir</button>
    </div>
  `).join('');
}

function renderizarAtual() {
  const c = document.getElementById('atualCard');
  const prox = document.getElementById('proximaCard');
  
  if (!perguntas.exibida) {
    c.className = 'p-4 bg-green-50 rounded-lg text-center text-gray-500';
    c.innerHTML = 'Nenhuma exibida';
    prox.innerHTML = perguntas.aprovadas[0] ? esc(perguntas.aprovadas[0].texto) : '—';
    return;
  }
  
  c.className = 'p-4 bg-green-100 border-2 border-green-500 rounded-lg';
  c.innerHTML = `
    <p class="font-medium mb-2">${esc(perguntas.exibida.texto)}</p>
    <button onclick="responder('${perguntas.exibida.id}')" class="w-full bg-blue-500 text-white text-sm px-3 py-2 rounded hover:bg-blue-600">✓ Respondida</button>
  `;
  prox.innerHTML = perguntas.aprovadas[0] ? esc(perguntas.aprovadas[0].texto) : '—';
}

function renderizarRespondidas() {
  const c = document.getElementById('listaRespondidas');
  if (!perguntas.respondidas.length) {
    c.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhuma</p>';
    return;
  }
  c.innerHTML = perguntas.respondidas.slice().reverse().map(p => `
    <div class="border rounded-lg p-3 bg-gray-50">
      <p class="text-sm mb-1">${esc(p.texto)}</p>
      <div class="text-xs text-gray-500">
        ${p.anonimo ? '👤 Anônimo' : '👤 ' + esc(p.nome_opt)}
        ${p.email_opt ? ' • 📧 ' + esc(p.email_opt) : ''}
      </div>
    </div>
  `).join('');
}

function atualizarContadores() {
  document.getElementById('contadorPendentes').textContent = perguntas.pendentes.length;
  document.getElementById('contadorExibida').textContent = perguntas.exibida ? '1' : '0';
  document.getElementById('contadorRespondidas').textContent = perguntas.respondidas.length;
}

// =====================================================
// STATUS BADGES
// =====================================================

function atualizarStatusBadges() {
  const statusPerguntas = document.getElementById('statusPerguntas');
  const statusSilencio = document.getElementById('statusSilencio');
  const btnTogglePerguntas = document.getElementById('btnTogglePerguntas');
  const btnToggleSilencio = document.getElementById('btnToggleSilencio');
  
  if (!controle) return;
  
  // Status de perguntas
  if (controle.perguntas_abertas) {
    statusPerguntas.textContent = '✅ ABERTAS';
    statusPerguntas.className = 'px-4 py-2 rounded-full text-sm font-semibold bg-green-500 text-white';
    btnTogglePerguntas.textContent = '❌ Fechar Perguntas';
    btnTogglePerguntas.className = 'px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600';
  } else {
    statusPerguntas.textContent = '❌ FECHADAS';
    statusPerguntas.className = 'px-4 py-2 rounded-full text-sm font-semibold bg-red-500 text-white';
    btnTogglePerguntas.textContent = '✓ Abrir Perguntas';
    btnTogglePerguntas.className = 'px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600';
  }
  
  // Status de silêncio
  if (controle.silencio_ativo) {
    statusSilencio.classList.remove('hidden');
    statusSilencio.textContent = '🔇 SILÊNCIO';
    statusSilencio.className = 'px-4 py-2 rounded-full text-sm font-semibold bg-yellow-500 text-white';
    btnToggleSilencio.textContent = '🔊 Desativar Silêncio';
    btnToggleSilencio.className = 'px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600';
  } else {
    statusSilencio.classList.add('hidden');
    btnToggleSilencio.textContent = '🔇 Ativar Silêncio';
    btnToggleSilencio.className = 'px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600';
  }
}

// =====================================================
// AÇÕES
// =====================================================

async function aprovar(id) {
  await supabase.from('cnv25_perguntas').update({status:'aprovada'}).eq('id',id);
  adicionarLog('Aprovada');
}

async function recusar(id) {
  await supabase.from('cnv25_perguntas').update({status:'recusada'}).eq('id',id);
  adicionarLog('Recusada');
}

async function exibir(id) {
  if (perguntas.exibida && !confirm('Substituir atual?')) return;
  if (perguntas.exibida) {
    await supabase.from('cnv25_perguntas')
      .update({status:'respondida',respondida_em:new Date().toISOString()})
      .eq('id',perguntas.exibida.id);
  }
  await supabase.from('cnv25_perguntas')
    .update({status:'exibida',exibida_em:new Date().toISOString()})
    .eq('id',id);
  adicionarLog('Exibida');
}

async function responder(id) {
  await supabase.from('cnv25_perguntas')
    .update({status:'respondida',respondida_em:new Date().toISOString()})
    .eq('id',id);
  adicionarLog('Respondida');
}

// =====================================================
// CONTROLES
// =====================================================

function configurarBotoes() {
  // Toggle Perguntas
  document.getElementById('btnTogglePerguntas').onclick = async () => {
    const novoStatus = !controle.perguntas_abertas;
    await atualizarControlePalestra(palestraId, { perguntas_abertas: novoStatus });
    adicionarLog(novoStatus ? '✅ ABERTAS' : '❌ FECHADAS');
  };
  
  // Toggle Silêncio
  document.getElementById('btnToggleSilencio').onclick = async () => {
    const novoStatus = !controle.silencio_ativo;
    await atualizarControlePalestra(palestraId, { silencio_ativo: novoStatus });
    adicionarLog(novoStatus ? '🔇 Silêncio ON' : '🔊 Silêncio OFF');
  };
  
  // Config Limites
  document.getElementById('btnConfigLimites').onclick = () => {
    document.getElementById('inputMaxPerguntas').value = palestra.max_perguntas || 3;
    document.getElementById('inputIntervalo').value = palestra.intervalo_perguntas || 60;
    document.getElementById('modalConfig').classList.remove('hidden');
    document.getElementById('modalConfig').classList.add('flex');
  };
  
  document.getElementById('btnCancelarConfig').onclick = () => {
    document.getElementById('modalConfig').classList.add('hidden');
    document.getElementById('modalConfig').classList.remove('flex');
  };
  
  document.getElementById('btnSalvarConfig').onclick = async () => {
    const maxPerguntas = parseInt(document.getElementById('inputMaxPerguntas').value);
    const intervalo = parseInt(document.getElementById('inputIntervalo').value);
    
    await supabase
      .from('cnv25_palestras')
      .update({
        max_perguntas: maxPerguntas,
        intervalo_perguntas: intervalo
      })
      .eq('id', palestraId);
    
    palestra.max_perguntas = maxPerguntas;
    palestra.intervalo_perguntas = intervalo;
    
    document.getElementById('infoMaxPerguntas').textContent = maxPerguntas;
    document.getElementById('infoIntervalo').textContent = intervalo;
    
    document.getElementById('modalConfig').classList.add('hidden');
    document.getElementById('modalConfig').classList.remove('flex');
    
    adicionarLog(`⚙️ Limites: ${maxPerguntas} perguntas, ${intervalo}s`);
  };
  
  // Exportar CSV
  document.getElementById('btnExportar').onclick = async () => {
    const {data} = await supabase.from('cnv25_perguntas')
      .select('*').eq('palestra_id',palestraId).order('created_at');
    
    if (!data?.length) {
      alert('Nenhuma pergunta');
      return;
    }
    
    const csv = [
      ['Data','Pergunta','Nome','Email','Status'].join(','),
      ...data.map(p => [
        p.created_at,
        p.texto,
        p.anonimo ? 'Anônimo' : p.nome_opt,
        p.email_opt || '-',
        p.status
      ].map(c => `"${c}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csv],{type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `perguntas_${Date.now()}.csv`;
    a.click();
    
    adicionarLog('📥 CSV exportado');
  };
  
  // Encerrar
  document.getElementById('btnEncerrar').onclick = async () => {
    if (!confirm('ENCERRAR palestra? Não será possível reabrir!')) return;
    
    await supabase.from('cnv25_palestras')
      .update({status:'encerrada'})
      .eq('id',palestraId);
    
    await atualizarControlePalestra(palestraId, {
      perguntas_abertas: false,
      silencio_ativo: false
    });
    
    adicionarLog('⏹ ENCERRADA');
    alert('Palestra encerrada!');
  };
}

// =====================================================
// LOGS
// =====================================================

function adicionarLog(msg) {
  const t = new Date().toLocaleTimeString('pt-BR');
  logs.unshift(`[${t}] ${msg}`);
  if (logs.length > 20) logs.pop();
  document.getElementById('listaLogs').innerHTML = logs.map(l => 
    `<div class="text-xs">${esc(l)}</div>`
  ).join('');
}

function esc(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

// =====================================================
// INICIAR
// =====================================================

window.addEventListener('DOMContentLoaded', inicializar);

window.addEventListener('beforeunload', () => {
  if (canalRealtime) window.supabase.removeChannel(canalRealtime);
  if (canalControle) window.supabase.removeChannel(canalControle);
});

console.log('✅ Moderador v2 carregado');
