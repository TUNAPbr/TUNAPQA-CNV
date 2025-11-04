// =====================================================
// MODERADOR V2 - 3 ABAS (PERGUNTAS | ENQUETES | QUIZ)
// =====================================================

let palestraId = null;
let palestra = null;
let controle = null;

// Perguntas
let perguntas = { pendentes: [], aprovadas: [], exibida: null, respondidas: [] };

// Enquetes
let enquetes = [];
let enqueteAtiva = null;
let chartEnquete = null;

// Quiz
let quizzes = [];
let quizAtual = null;
let perguntaAtualQuiz = null;
let chartQuiz = null;

// Canais Realtime
let canalPalestra = null;
let canalControle = null;
let canalPerguntas = null;
let canalEnquete = null;
let canalQuiz = null;

// =====================================================
// INICIALIZAÇÃO
// =====================================================

async function inicializar() {
  console.log('🎛️ Moderador v2 inicializando...');
  await carregarListaPalestras();
  configurarEventos();
}

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
  }
}

async function selecionarPalestra(id) {
  palestraId = id;
  
  try {
    // Ativar palestra
    await supabase
      .from('cnv25_palestra_ativa')
      .update({ palestra_id: id })
      .eq('id', 1);
    
    // Carregar dados
    await carregarPalestra();
    await carregarControle();
    await carregarPerguntas();
    await carregarEnquetes();
    await carregarQuizzes();
    
    conectarRealtime();
    
    document.getElementById('headerConteudo').classList.remove('hidden');
    document.getElementById('mainConteudo').classList.remove('hidden');
    
    atualizarUI();
    
  } catch (error) {
    console.error('Erro:', error);
    alert('Erro ao selecionar palestra');
  }
}

async function carregarPalestra() {
  const { data } = await supabase
    .from('cnv25_palestras')
    .select('*')
    .eq('id', palestraId)
    .single();
  
  palestra = data;
  
  document.getElementById('palestraTitulo').textContent = palestra.titulo;
  document.getElementById('palestrante').textContent = palestra.palestrante || 'A definir';
}

async function carregarControle() {
  let { data, error } = await supabase
    .from('cnv25_palestra_controle')
    .select('*')
    .eq('palestra_id', palestraId)
    .single();
  
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

// =====================================================
// REALTIME
// =====================================================

function conectarRealtime() {
  desconectarCanais();
  
  canalPalestra = supabase
    .channel(`mod_palestra:${palestraId}`)
    .on('postgres_changes', { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'cnv25_palestras', 
      filter: `id=eq.${palestraId}` 
    }, (p) => { 
      palestra = p.new; 
      atualizarUI(); 
    })
    .subscribe();
  
  canalControle = supabase
    .channel(`mod_controle:${palestraId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'cnv25_palestra_controle',
      filter: `palestra_id=eq.${palestraId}`
    }, (p) => {
      controle = p.new;
      atualizarStatusBadges();
    })
    .subscribe();
  
  canalPerguntas = supabase
    .channel(`mod_perguntas:${palestraId}`)
    .on('postgres_changes', { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'cnv25_perguntas', 
      filter: `palestra_id=eq.${palestraId}` 
    }, (p) => { 
      perguntas.pendentes.push(p.new); 
      renderizarPerguntas(); 
    })
    .on('postgres_changes', { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'cnv25_perguntas', 
      filter: `palestra_id=eq.${palestraId}` 
    }, (p) => { 
      atualizarPergunta(p.new); 
    })
    .subscribe();
}

function desconectarCanais() {
  if (canalPalestra) window.supabase.removeChannel(canalPalestra);
  if (canalControle) window.supabase.removeChannel(canalControle);
  if (canalPerguntas) window.supabase.removeChannel(canalPerguntas);
  if (canalEnquete) window.supabase.removeChannel(canalEnquete);
  if (canalQuiz) window.supabase.removeChannel(canalQuiz);
}

// =====================================================
// TAB: PERGUNTAS
// =====================================================

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
  
  renderizarPerguntas();
}

function renderizarPerguntas() {
  renderizarPendentes();
  renderizarAprovadas();
  renderizarExibida();
  renderizarRespondidas();
  
  document.getElementById('contPend').textContent = perguntas.pendentes.length;
  document.getElementById('contAprov').textContent = perguntas.aprovadas.length;
  document.getElementById('contResp').textContent = perguntas.respondidas.length;
}

function renderizarPendentes() {
  const c = document.getElementById('listaPendentes');
  if (!perguntas.pendentes.length) {
    c.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhuma pendente</p>';
    return;
  }
  c.innerHTML = perguntas.pendentes.map(p => `
    <div class="border rounded-lg p-3 bg-white">
      <p class="text-sm mb-2">${esc(p.texto)}</p>
      <div class="text-xs text-gray-500 mb-2">
        ${p.anonimo ? '👤 Anônimo' : '👤 ' + esc(p.nome_opt)}
      </div>
      <div class="flex gap-2">
        <button onclick="aprovarPergunta('${p.id}')" class="flex-1 bg-green-500 text-white text-xs px-2 py-1 rounded hover:bg-green-600">✓</button>
        <button onclick="recusarPergunta('${p.id}')" class="flex-1 bg-red-500 text-white text-xs px-2 py-1 rounded hover:bg-red-600">✗</button>
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
      <button onclick="exibirPergunta('${p.id}')" class="w-full bg-green-500 text-white text-xs px-2 py-1 rounded hover:bg-green-600">📺 Exibir</button>
    </div>
  `).join('');
}

function renderizarExibida() {
  const c = document.getElementById('cardExibida');
  
  if (!perguntas.exibida) {
    c.innerHTML = '<p class="text-sm text-gray-600 mb-2">No telão:</p><p class="text-gray-500 text-center">Nenhuma</p>';
    return;
  }
  
  c.innerHTML = `
    <p class="text-sm text-gray-600 mb-2">No telão:</p>
    <p class="font-medium mb-2">${esc(perguntas.exibida.texto)}</p>
    <button onclick="responderPergunta('${perguntas.exibida.id}')" class="w-full bg-blue-500 text-white text-sm px-3 py-2 rounded hover:bg-blue-600">✓ Respondida</button>
  `;
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
      </div>
    </div>
  `).join('');
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
  
  renderizarPerguntas();
}

async function aprovarPergunta(id) {
  await supabase.from('cnv25_perguntas').update({status:'aprovada'}).eq('id',id);
}

async function recusarPergunta(id) {
  await supabase.from('cnv25_perguntas').update({status:'recusada'}).eq('id',id);
}

async function exibirPergunta(id) {
  if (perguntas.exibida && !confirm('Substituir pergunta atual no telão?')) return;
  if (perguntas.exibida) {
    await supabase.from('cnv25_perguntas')
      .update({status:'respondida',respondida_em:new Date().toISOString()})
      .eq('id',perguntas.exibida.id);
  }
  await supabase.from('cnv25_perguntas')
    .update({status:'exibida',exibida_em:new Date().toISOString()})
    .eq('id',id);
}

async function responderPergunta(id) {
  await supabase.from('cnv25_perguntas')
    .update({status:'respondida',respondida_em:new Date().toISOString()})
    .eq('id',id);
}

// =====================================================
// TAB: ENQUETES
// =====================================================

async function carregarEnquetes() {
  enquetes = await listarEnquetesPalestra(palestraId);
  renderizarEnquetes();
  
  if (controle?.enquete_ativa) {
    enqueteAtiva = enquetes.find(e => e.id === controle.enquete_ativa);
    await carregarResultadosEnquete();
  }
}

function renderizarEnquetes() {
  const c = document.getElementById('listaEnquetes');
  if (!enquetes.length) {
    c.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhuma enquete</p>';
    return;
  }
  
  c.innerHTML = enquetes.map(e => {
    const isAtiva = e.id === controle?.enquete_ativa;
    return `
      <div class="border rounded-lg p-3 ${isAtiva ? 'bg-green-50 border-green-500' : 'bg-white'}">
        <div class="flex items-center justify-between mb-2">
          <h4 class="font-semibold text-sm">${esc(e.titulo)}</h4>
          ${isAtiva ? '<span class="text-xs bg-green-500 text-white px-2 py-1 rounded">ATIVA</span>' : ''}
        </div>
        <p class="text-xs text-gray-600 mb-2">${e.opcoes.opcoes.length} opções</p>
        <div class="flex gap-2">
          ${!isAtiva ? `<button onclick="ativarEnqueteLocal('${e.id}')" class="flex-1 bg-green-500 text-white text-xs px-2 py-1 rounded hover:bg-green-600">Ativar</button>` : ''}
          ${isAtiva ? `<button onclick="desativarEnqueteLocal()" class="flex-1 bg-red-500 text-white text-xs px-2 py-1 rounded hover:bg-red-600">Desativar</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function ativarEnqueteLocal(enqueteId) {
  // Chama a função global do enquetes-quiz-utils.js
  const resultado = await window.ativarEnquete(palestraId, enqueteId);
  
  if (resultado) {
    await carregarControle();
    await carregarEnquetes();
  }
}

async function desativarEnqueteLocal() {
  // Chama a função global do enquetes-quiz-utils.js
  const resultado = await window.desativarEnquete(palestraId);
  
  if (resultado) {
    enqueteAtiva = null;
    await carregarControle();
    await carregarEnquetes();
    document.getElementById('resultadosEnquete').innerHTML = '<p class="text-gray-500 text-center py-8">Nenhuma enquete ativa</p>';
  }
}

async function carregarResultadosEnquete() {
  if (!enqueteAtiva) return;
  
  const resultados = await obterResultadosEnquete(enqueteAtiva.id);
  renderizarResultadosEnquete(resultados);
}

function renderizarResultadosEnquete(resultados) {
  const c = document.getElementById('resultadosEnquete');
  
  if (!resultados || resultados.total === 0) {
    c.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhum voto ainda</p>';
    return;
  }
  
  const opcoes = enqueteAtiva.opcoes.opcoes;
  const distribuicao = resultados.distribuicao;
  
  const labels = opcoes;
  const data = opcoes.map((_, idx) => distribuicao[idx] || 0);
  
  c.innerHTML = `
    <div class="mb-4">
      <p class="text-sm text-gray-600">Total de votos: <strong>${resultados.total}</strong></p>
    </div>
    <canvas id="chartEnqueteCanvas"></canvas>
  `;
  
  setTimeout(() => {
    const ctx = document.getElementById('chartEnqueteCanvas');
    if (chartEnquete) chartEnquete.destroy();
    
    chartEnquete = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Votos',
          data: data,
          backgroundColor: '#27ae52',
          borderColor: '#1f8e42',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false }
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

// =====================================================
// TAB: QUIZ
// =====================================================

async function carregarQuizzes() {
  quizzes = await listarQuizzesPalestra(palestraId);
  
  const select = document.getElementById('quizSelect');
  select.innerHTML = '<option value="">Selecione um quiz...</option>';
  
  quizzes.forEach(q => {
    const option = document.createElement('option');
    option.value = q.id;
    option.textContent = `${q.titulo} (${q.total_perguntas} perguntas) - ${q.status}`;
    select.appendChild(option);
  });
}

async function selecionarQuiz(quizId) {
  quizAtual = quizzes.find(q => q.id === quizId);
  
  if (!quizAtual) return;
  
  await atualizarQuizUI();
  conectarRealtimeQuiz();
}

async function atualizarQuizUI() {
  if (!quizAtual) return;
  
  if (quizAtual.pergunta_atual > 0) {
    perguntaAtualQuiz = await obterPerguntaAtualQuiz(quizAtual.id, quizAtual.pergunta_atual);
    await renderizarPerguntaQuiz();
    await carregarStatsQuiz();
  } else {
    document.getElementById('quizPerguntaAtual').innerHTML = `
      <div class="text-center py-8">
        <p class="text-gray-600 mb-4">Quiz: ${esc(quizAtual.titulo)}</p>
        <p class="text-sm text-gray-500">Status: ${quizAtual.status}</p>
      </div>
    `;
  }
  
  if (quizAtual.status === 'finalizado') {
    await renderizarRanking();
  }
}

function renderizarPerguntaQuiz() {
  const c = document.getElementById('quizPerguntaAtual');
  
  c.innerHTML = `
    <div class="bg-blue-50 p-4 rounded-lg mb-4">
      <p class="text-sm text-gray-600 mb-2">Pergunta ${quizAtual.pergunta_atual}/${quizAtual.total_perguntas}</p>
      <p class="font-semibold">${esc(perguntaAtualQuiz.pergunta)}</p>
    </div>
    <div class="space-y-2">
      ${perguntaAtualQuiz.opcoes.map((op, idx) => `
        <div class="p-2 bg-gray-100 rounded ${perguntaAtualQuiz.revelada && idx === perguntaAtualQuiz.resposta_correta ? 'bg-green-200 font-bold' : ''}">
          <strong>${['A','B','C','D'][idx]}.</strong> ${esc(op)}
          ${perguntaAtualQuiz.revelada && idx === perguntaAtualQuiz.resposta_correta ? ' ✓' : ''}
        </div>
      `).join('')}
    </div>
  `;
}

async function carregarStatsQuiz() {
  const stats = await obterStatsQuizPergunta(perguntaAtualQuiz.id);
  
  if (!stats) return;
  
  document.getElementById('quizStats').classList.remove('hidden');
  document.getElementById('totalRespostas').textContent = stats.total_respostas || 0;
  document.getElementById('percAcerto').textContent = (stats.percentual_acerto || 0) + '%';
  
  const labels = ['A', 'B', 'C', 'D'];
  const data = [0, 0, 0, 0];
  
  if (stats.distribuicao_respostas) {
    stats.distribuicao_respostas.forEach(d => {
      data[d.opcao] = d.total_votos;
    });
  }
  
  const ctx = document.getElementById('chartQuiz');
  if (chartQuiz) chartQuiz.destroy();
  
  chartQuiz = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Respostas',
        data: data,
        backgroundColor: '#2797ff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });
}

async function renderizarRanking() {
  const ranking = await obterRankingQuiz(quizAtual.id);
  
  const c = document.getElementById('quizRanking');
  
  if (!ranking.length) {
    c.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhum participante</p>';
    return;
  }
  
  c.innerHTML = `
    <div class="space-y-2">
      ${ranking.slice(0, 10).map(r => `
        <div class="flex items-center justify-between p-3 bg-white rounded-lg border">
          <div class="flex items-center gap-3">
            <span class="text-2xl font-bold text-gray-400">${r.ranking}º</span>
            <div>
              <p class="text-xs text-gray-600">Device: ${r.device_id_hash.substring(0, 8)}</p>
              <p class="text-sm"><strong>${r.total_acertos}</strong> acertos</p>
            </div>
          </div>
          <div class="text-right">
            <p class="text-2xl font-bold text-blue-600">${r.pontos_totais}</p>
            <p class="text-xs text-gray-500">pts</p>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function conectarRealtimeQuiz() {
  if (!quizAtual) return;
  if (canalQuiz) window.supabase.removeChannel(canalQuiz);
  
  canalQuiz = supabase
    .channel(`mod_quiz:${quizAtual.id}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'cnv25_quiz',
      filter: `id=eq.${quizAtual.id}`
    }, async (payload) => {
      quizAtual = payload.new;
      await atualizarQuizUI();
    })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'cnv25_quiz_respostas'
    }, async () => {
      if (perguntaAtualQuiz) {
        await carregarStatsQuiz();
      }
    })
    .subscribe();
}

// =====================================================
// CONTROLES
// =====================================================

function configurarEventos() {
  document.getElementById('palestraSelect').addEventListener('change', function() {
    if (this.value) selecionarPalestra(this.value);
  });
  
  // Perguntas
  document.getElementById('btnTogglePerguntas').onclick = async () => {
    const novoStatus = !controle.perguntas_abertas;
    await atualizarControlePalestra(palestraId, { perguntas_abertas: novoStatus });
  };
  
  document.getElementById('btnToggleSilencio').onclick = async () => {
    const novoStatus = !controle.silencio_ativo;
    await atualizarControlePalestra(palestraId, { silencio_ativo: novoStatus });
  };
  
  document.getElementById('btnExportarPerguntas').onclick = async () => {
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
  };
  
  // Enquetes
  document.getElementById('btnCriarEnquete').onclick = () => {
    document.getElementById('modalEnquete').classList.remove('hidden');
    document.getElementById('modalEnquete').classList.add('flex');
  };
  
  document.getElementById('btnCancelarEnquete').onclick = () => {
    document.getElementById('modalEnquete').classList.add('hidden');
    document.getElementById('modalEnquete').classList.remove('flex');
  };
  
  document.getElementById('btnSalvarEnquete').onclick = async () => {
    const titulo = document.getElementById('inputTituloEnquete').value.trim();
    const opcoesTexto = document.getElementById('inputOpcoesEnquete').value.trim();
    
    if (!titulo || !opcoesTexto) {
      alert('Preencha todos os campos');
      return;
    }
    
    const opcoes = opcoesTexto.split('\n').filter(o => o.trim()).map(o => o.trim());
    
    if (opcoes.length < 2) {
      alert('Mínimo 2 opções');
      return;
    }
    
    const enquete = await criarEnqueteSimples(palestraId, titulo, opcoes);
    
    if (enquete) {
      await ativarEnquete(enquete.id);
      document.getElementById('modalEnquete').classList.add('hidden');
      document.getElementById('modalEnquete').classList.remove('flex');
      document.getElementById('inputTituloEnquete').value = '';
      document.getElementById('inputOpcoesEnquete').value = '';
    }
  };
  
  document.getElementById('btnExportarEnquete').onclick = async () => {
    if (!enqueteAtiva) {
      alert('Nenhuma enquete ativa');
      return;
    }
    await exportarEnqueteCSV(enqueteAtiva.id);
  };
  
  // Quiz
  document.getElementById('quizSelect').addEventListener('change', function() {
    if (this.value) selecionarQuiz(this.value);
  });
  
  document.getElementById('btnIniciarQuiz').onclick = async () => {
    if (!quizAtual) {
      alert('Selecione um quiz');
      return;
    }
    await iniciarQuiz(quizAtual.id);
  };
  
  document.getElementById('btnAvancarQuiz').onclick = async () => {
    if (!quizAtual) return;
    const proxima = quizAtual.pergunta_atual + 1;
    if (proxima > quizAtual.total_perguntas) {
      alert('Última pergunta! Clique em Finalizar.');
      return;
    }
    await avancarPerguntaQuiz(quizAtual.id, proxima);
  };
  
  document.getElementById('btnRevelarQuiz').onclick = async () => {
    if (!perguntaAtualQuiz) return;
    await revelarRespostaQuiz(perguntaAtualQuiz.id);
  };
  
  document.getElementById('btnFinalizarQuiz').onclick = async () => {
    if (!quizAtual) return;
    if (!confirm('Finalizar quiz?')) return;
    await finalizarQuiz(quizAtual.id);
  };
  
  document.getElementById('btnExportarQuiz').onclick = async () => {
    if (!quizAtual) {
      alert('Nenhum quiz selecionado');
      return;
    }
    await exportarQuizCSV(quizAtual.id);
  };
}

function atualizarStatusBadges() {
  const statusPerguntas = document.getElementById('statusPerguntas');
  const statusSilencio = document.getElementById('statusSilencio');
  const btnTogglePerguntas = document.getElementById('btnTogglePerguntas');
  const btnToggleSilencio = document.getElementById('btnToggleSilencio');
  
  if (!controle) return;
  
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
  
  if (controle.silencio_ativo) {
    statusSilencio.classList.remove('hidden');
    statusSilencio.textContent = '🔇 SILÊNCIO';
    btnToggleSilencio.textContent = '🔊 Desativar Silêncio';
    btnToggleSilencio.className = 'px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600';
  } else {
    statusSilencio.classList.add('hidden');
    btnToggleSilencio.textContent = '🔇 Ativar Silêncio';
    btnToggleSilencio.className = 'px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600';
  }
}

function atualizarUI() {
  atualizarStatusBadges();
  renderizarPerguntas();
  renderizarEnquetes();
  if (enqueteAtiva) carregarResultadosEnquete();
}

// =====================================================
// UTILS
// =====================================================

function esc(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// =====================================================
// TABS
// =====================================================

window.trocarAba = function(aba) {
  // Remover active de todos
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  // Adicionar active no selecionado
  const btnMap = {
    'perguntas': 0,
    'enquetes': 1,
    'quiz': 2
  };
  
  document.querySelectorAll('.tab-button')[btnMap[aba]].classList.add('active');
  document.getElementById(`tab${aba.charAt(0).toUpperCase() + aba.slice(1)}`).classList.add('active');
};

// =====================================================
// INICIAR
// =====================================================

window.addEventListener('DOMContentLoaded', inicializar);

window.addEventListener('beforeunload', desconectarCanais);

// Expor funções globais
window.aprovarPergunta = aprovarPergunta;
window.recusarPergunta = recusarPergunta;
window.exibirPergunta = exibirPergunta;
window.responderPergunta = responderPergunta;

console.log('✅ Moderador v2 carregado');
