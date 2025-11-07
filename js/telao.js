// =====================================================
// TELÃO V2 - EXIBIÇÃO DINÂMICA
// =====================================================

let palestraId = null;
let palestra = null;
let controle = null;

// Conteúdo
let perguntaExibida = null;
let enqueteAtiva = null;
let quizAtivo = null;
let perguntaQuizAtual = null;

// Charts
let chartQuiz = null;

// Canais Realtime
let canalPalestraAtiva = null;
let canalPalestra = null;
let canalControle = null;
let canalPerguntas = null;
let canalEnquete = null;
let canalQuiz = null;
let canalQuizPerguntas = null;

// =====================================================
// INICIALIZAÇÃO
// =====================================================

async function inicializar() {
  console.log('🖥️ Telão v2 inicializando...');
  await conectarRealtimePalestraAtiva();
  await carregarPalestraAtiva();
}

// =====================================================
// PALESTRA ATIVA
// =====================================================

function conectarRealtimePalestraAtiva() {
  canalPalestraAtiva = supabase
    .channel('palestra_ativa_telao_v2')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'cnv25_palestra_ativa',
      filter: 'id=eq.1'
    }, async (payload) => {
      console.log('🔄 Palestra mudou:', payload);
      if (payload.new.palestra_id !== palestraId) {
        await carregarPalestraAtiva();
      }
    })
    .subscribe();
}

async function carregarPalestraAtiva() {
  try {
    const { data: palestraAtiva } = await supabase
      .from('cnv25_palestra_ativa')
      .select('palestra_id')
      .eq('id', 1)
      .single();
    
    const novaPalestraId = palestraAtiva?.palestra_id;
    
    if (!novaPalestraId) {
      mostrarLoading();
      return;
    }
    
    // Desconectar canais anteriores
    if (palestraId && palestraId !== novaPalestraId) {
      desconectarCanais();
    }
    
    palestraId = novaPalestraId;
    
    // Carregar dados
    await carregarPalestra();
    await carregarControle();
    await carregarConteudo();
    
    conectarRealtimePalestra();
    
    mostrarConteudo();
    decidirOQueExibir();
    
  } catch (error) {
    console.error('Erro:', error);
    mostrarLoading();
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
  document.getElementById('palestrante').textContent = palestra.palestrante || 'Palestrante não definido';
}

async function carregarControle() {
  const { data } = await supabase
    .from('cnv25_palestra_controle')
    .select('*')
    .eq('palestra_id', palestraId)
    .single();
  
  controle = data || {};
  decidirOQueExibir();
}

async function carregarConteudo() {
  // Pergunta exibida
  const { data: pergunta } = await supabase
    .from('cnv25_perguntas')
    .select('*')
    .eq('palestra_id', palestraId)
    .eq('status', 'exibida')
    .single();
  
  perguntaExibida = pergunta || null;
  
  // Enquete ativa
  if (controle?.enquete_ativa) {
    const { data: enquete } = await supabase
      .from('cnv25_enquetes')
      .select('*')
      .eq('id', controle.enquete_ativa)
      .single();
    
    enqueteAtiva = enquete;
  } else {
    enqueteAtiva = null;
  }
  
  // Quiz ativo
  quizAtivo = await obterQuizAtivo(palestraId);
  
  if (quizAtivo && quizAtivo.pergunta_atual > 0) {
    perguntaQuizAtual = await obterPerguntaAtualQuiz(quizAtivo.id, quizAtivo.pergunta_atual);
  } else {
    perguntaQuizAtual = null;
  }
}

// =====================================================
// REALTIME - PALESTRA
// =====================================================

function conectarRealtimePalestra() {
  desconectarCanais();
  
  canalPalestra = supabase
    .channel(`telao_palestra:${palestraId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'cnv25_palestras',
      filter: `id=eq.${palestraId}`
    }, (payload) => {
      palestra = payload.new;
      atualizarHeader();
    })
    .subscribe();
  
  canalControle = supabase
    .channel(`telao_controle:${palestraId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'cnv25_palestra_controle',
      filter: `palestra_id=eq.${palestraId}`
    }, async (payload) => {
      controle = payload.new;
      
      // Verificar mudança em enquete_ativa
      if (payload.new.enquete_ativa !== enqueteAtiva?.id) {
        await carregarConteudo();
        decidirOQueExibir();
      }
    })
    .subscribe();
  
  canalPerguntas = supabase
    .channel(`telao_perguntas:${palestraId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'cnv25_perguntas',
      filter: `palestra_id=eq.${palestraId}`
    }, async (payload) => {
      const p = payload.new;
      
      if (p.status === 'exibida') {
        perguntaExibida = p;
        decidirOQueExibir();
      } else if (perguntaExibida && p.id === perguntaExibida.id && p.status === 'respondida') {
        perguntaExibida = null;
        decidirOQueExibir();
      }
    })
    .subscribe();
  
  // Quiz Realtime
  if (quizAtivo) {
    canalQuiz = supabase
      .channel(`telao_quiz:${quizAtivo.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'cnv25_quiz',
        filter: `id=eq.${quizAtivo.id}`
      }, async (payload) => {
        quizAtivo = payload.new;
        
        if (quizAtivo.pergunta_atual > 0) {
          perguntaQuizAtual = await obterPerguntaAtualQuiz(quizAtivo.id, quizAtivo.pergunta_atual);
        } else {
          perguntaQuizAtual = null;
        }
        
        decidirOQueExibir();
      })
      .subscribe();
    
    canalQuizPerguntas = supabase
      .channel(`telao_quiz_perguntas:${quizAtivo.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'cnv25_quiz_perguntas'
      }, async (payload) => {
        if (perguntaQuizAtual && payload.new.id === perguntaQuizAtual.id && payload.new.revelada) {
          perguntaQuizAtual = payload.new;
          await exibirResultadoQuiz();
        }
      })
      .subscribe();
  }
}

function desconectarCanais() {
  if (canalPalestra) window.supabase.removeChannel(canalPalestra);
  if (canalControle) window.supabase.removeChannel(canalControle);
  if (canalPerguntas) window.supabase.removeChannel(canalPerguntas);
  if (canalEnquete) window.supabase.removeChannel(canalEnquete);
  if (canalQuiz) window.supabase.removeChannel(canalQuiz);
  if (canalQuizPerguntas) window.supabase.removeChannel(canalQuizPerguntas);
}

// =====================================================
// DECIDIR O QUE EXIBIR
// =====================================================

function decidirOQueExibir() {
  esconderTudo();

  if (quizAtivo && perguntaQuizAtual) {
    exibirQuiz();
  } else if (enqueteAtiva) {
    if (controle?.mostrar_resultado_enquete) {
      exibirResultadoEnquete();
    } else {
      exibirEnquete();
    }
  } else if (perguntaExibida) {
    exibirPergunta();
  } else {
    exibirVazio();
  }
}

async function exibirResultadoEnquete() {
  document.getElementById('modoEnquete').classList.remove('hidden');
  document.getElementById('tituloEnquete').textContent = `${enqueteAtiva.titulo} — Resultados`;

  // Limpa corpo e exibe loading
  const corpo = document.getElementById('opcoesEnquete');
  corpo.innerHTML = '<div class="text-gray-500 text-sm mt-3">Carregando resultados...</div>';

  try {
    const { data: respostas } = await supabase
      .from('cnv25_enquete_respostas')
      .select('resposta')
      .eq('enquete_id', enqueteAtiva.id);

    const opcoes = enqueteAtiva.opcoes?.opcoes || [];
    const contagem = Array(opcoes.length).fill(0);

    respostas.forEach(r => {
      const idx = parseInt(r.resposta?.opcaoIndex ?? r.resposta?.opcao_index ?? 0);
      if (!isNaN(idx) && idx < contagem.length) contagem[idx]++;
    });

    const total = contagem.reduce((a,b) => a+b, 0) || 1;

    corpo.innerHTML = opcoes.map((txt, i) => {
      const votos = contagem[i];
      const pct = Math.round((votos / total) * 100);
      return `
        <div class="mt-2 border rounded-lg p-3 bg-white/10 backdrop-blur">
          <div class="flex justify-between text-sm">
            <span>${String.fromCharCode(65+i)}. ${txt}</span>
            <span>${votos} voto(s) • ${pct}%</span>
          </div>
          <div class="w-full bg-gray-700 h-2 rounded mt-1">
            <div class="h-2 bg-green-500 rounded" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Erro ao carregar resultados:', err);
    corpo.innerHTML = '<div class="text-red-500 text-sm mt-3">Erro ao carregar resultados</div>';
  }
}


function esconderTudo() {
  document.getElementById('modoVazio').classList.add('hidden');
  document.getElementById('modoPergunta').classList.add('hidden');
  document.getElementById('modoEnquete').classList.add('hidden');
  document.getElementById('modoQuiz').classList.add('hidden');
}

// =====================================================
// EXIBIR: VAZIO
// =====================================================

function exibirVazio() {
  document.getElementById('modoVazio').classList.remove('hidden');
}

// =====================================================
// EXIBIR: PERGUNTA
// =====================================================

function exibirPergunta() {
  document.getElementById('modoPergunta').classList.remove('hidden');
  
  document.getElementById('textoPergunta').textContent = perguntaExibida.texto;
  
  const nomeEl = document.getElementById('nomePergunta');
  if (perguntaExibida.anonimo) {
    nomeEl.innerHTML = '👤 <em>Anônimo</em>';
  } else {
    nomeEl.innerHTML = `👤 ${esc(perguntaExibida.nome_opt)}`;
  }
}

// =====================================================
// EXIBIR: ENQUETE
// =====================================================

function exibirEnquete() {
  document.getElementById('modoEnquete').classList.remove('hidden');
  document.getElementById('tituloEnquete').textContent = enqueteAtiva.titulo;
}

// =====================================================
// EXIBIR: QUIZ
// =====================================================

function exibirQuiz() {
  document.getElementById('modoQuiz').classList.remove('hidden');
  document.getElementById('progressoQuiz').textContent = 
    `🎮 QUIZ - Pergunta ${quizAtivo.pergunta_atual}/${quizAtivo.total_perguntas}`;
  
  if (perguntaQuizAtual.revelada) {
    // Mostrar resultado
    document.getElementById('quizPergunta').classList.add('hidden');
    document.getElementById('quizResultado').classList.remove('hidden');
  } else {
    // Mostrar pergunta
    document.getElementById('quizPergunta').classList.remove('hidden');
    document.getElementById('quizResultado').classList.add('hidden');
    document.getElementById('textoQuizPergunta').textContent = perguntaQuizAtual.pergunta;
  }
}

async function exibirResultadoQuiz() {
  document.getElementById('quizPergunta').classList.add('hidden');
  document.getElementById('quizResultado').classList.remove('hidden');
  
  const labels = ['A', 'B', 'C', 'D'];
  const respostaCorreta = labels[perguntaQuizAtual.resposta_correta];
  
  document.getElementById('respostaCorreta').textContent = respostaCorreta;
  
  // Buscar stats
  const stats = await obterStatsQuizPergunta(perguntaQuizAtual.id);
  
  if (stats) {
    document.getElementById('percentualAcerto').textContent = 
      `${Math.round(stats.percentual_acerto || 0)}% acertaram!`;
    
    // Gráfico
    const data = [0, 0, 0, 0];
    
    if (stats.distribuicao_respostas) {
      stats.distribuicao_respostas.forEach(d => {
        data[d.opcao] = d.total_votos;
      });
    }
    
    const ctx = document.getElementById('chartQuizTelao');
    if (chartQuiz) chartQuiz.destroy();
    
    const backgroundColors = labels.map((_, idx) => 
      idx === perguntaQuizAtual.resposta_correta ? '#27ae52' : '#94a3b8'
    );
    
    chartQuiz = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Respostas',
          data: data,
          backgroundColor: backgroundColors,
          borderColor: '#1e293b',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { 
              stepSize: 1,
              font: { size: 16 }
            }
          },
          x: {
            ticks: {
              font: { size: 20, weight: 'bold' }
            }
          }
        }
      }
    });
  }
}

// =====================================================
// UI - TELAS
// =====================================================

function mostrarLoading() {
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('mainContent').classList.add('hidden');
  document.getElementById('palestraTitulo').textContent = 'Aguardando palestra ativa...';
  document.getElementById('palestrante').textContent = '';
}

function mostrarConteudo() {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('mainContent').classList.remove('hidden');
}

function atualizarHeader() {
  document.getElementById('palestraTitulo').textContent = palestra.titulo;
  document.getElementById('palestrante').textContent = palestra.palestrante || 'Palestrante não definido';
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
// INICIAR
// =====================================================

window.addEventListener('DOMContentLoaded', inicializar);

window.addEventListener('beforeunload', () => {
  if (canalPalestraAtiva) window.supabase.removeChannel(canalPalestraAtiva);
  desconectarCanais();
});

console.log('✅ Telão v2 carregado');
