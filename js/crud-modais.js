// =====================================================
// CRUD MODAIS - ENQUETES E QUIZ
// Adicionar após os outros scripts no moderador.html
// =====================================================

// Estado para quiz em criação
let quizEmCriacao = {
  id: null,
  titulo: '',
  descricao: '',
  totalPerguntas: 0,
  perguntaAtual: 0,
  perguntas: []
};

// =====================================================
// ENQUETE - CRUD (AGORA SÓ CHAMA O MÓDULO ENQUETES)
// =====================================================

function abrirModalEnqueteNova() {
  if (window.ModuloEnquetes?.abrirModalNova) {
    window.ModuloEnquetes.abrirModalNova();
  } else {
    // fallback: abre modal bruto
    const modal = document.getElementById('modalEnqueteCRUD');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }
}

function abrirModalEnqueteEditar(enqueteId) {
  if (window.ModuloEnquetes?.abrirModalEditar) {
    window.ModuloEnquetes.abrirModalEditar(enqueteId);
  } else {
    console.warn('ModuloEnquetes.abrirModalEditar não encontrado');
  }
}

function fecharModalEnqueteCRUD() {
  if (window.ModuloEnquetes?.fecharModalCRUD) {
    window.ModuloEnquetes.fecharModalCRUD();
  } else {
    const modal = document.getElementById('modalEnqueteCRUD');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }
}

// Não colocamos listener de submit aqui para evitar duplicidade.
// O próprio ModuloEnquetes configura formEnqueteCRUD.onsubmit internamente.

async function excluirEnquete(enqueteId) {
  if (window.ModuloEnquetes?.deletar) {
    await window.ModuloEnquetes.deletar(enqueteId);
  } else {
    console.warn('ModuloEnquetes.deletar não encontrado');
  }
}


// =====================================================
// QUIZ - CRUD
// =====================================================

function abrirModalQuizNovo() {
  quizEmCriacao = {
    id: null,
    titulo: '',
    descricao: '',
    totalPerguntas: 5,
    perguntaAtual: 0,
    perguntas: []
  };
  
  document.getElementById('modalQuizCRUD').classList.remove('hidden');
  document.getElementById('modalQuizCRUD').classList.add('flex');
  document.getElementById('tituloModalQuiz').textContent = 'Criar Quiz';
  document.getElementById('quizIdEdit').value = '';
  document.getElementById('inputTituloQuiz').value = '';
  document.getElementById('inputDescricaoQuiz').value = '';
  document.getElementById('inputNumPerguntas').value = '5';
  
  document.getElementById('etapa1Quiz').classList.remove('hidden');
  document.getElementById('etapa2Quiz').classList.add('hidden');
}

function fecharModalQuizCRUD() {
  document.getElementById('modalQuizCRUD').classList.add('hidden');
  document.getElementById('modalQuizCRUD').classList.remove('flex');
  quizEmCriacao = {
    id: null,
    titulo: '',
    descricao: '',
    totalPerguntas: 0,
    perguntaAtual: 0,
    perguntas: []
  };
}

function voltarEtapa1Quiz() {
  document.getElementById('etapa2Quiz').classList.add('hidden');
  document.getElementById('etapa1Quiz').classList.remove('hidden');
}

// Submeter info do quiz (etapa 1)
document.getElementById('formQuizInfo')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const titulo = document.getElementById('inputTituloQuiz').value.trim();
  const descricao = document.getElementById('inputDescricaoQuiz').value.trim();
  const numPerguntas = parseInt(document.getElementById('inputNumPerguntas').value);
  
  if (!titulo) {
    alert('Informe o título do quiz');
    return;
  }
  
  if (numPerguntas < 1 || numPerguntas > 20) {
    alert('Número de perguntas deve ser entre 1 e 20');
    return;
  }
  
  try {
    // Criar quiz no banco
    const { data, error } = await supabase
      .from('cnv25_quiz')
      .insert([{
        // palestra_id foi removido do schema; quiz agora é global
        titulo: titulo,
        descricao: descricao,
        total_perguntas: numPerguntas,
        status: 'preparando'
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    quizEmCriacao.id = data.id;
    quizEmCriacao.titulo = titulo;
    quizEmCriacao.descricao = descricao;
    quizEmCriacao.totalPerguntas = numPerguntas;
    quizEmCriacao.perguntaAtual = 1;
    quizEmCriacao.perguntas = [];
    
    // Ir para etapa 2
    document.getElementById('etapa1Quiz').classList.add('hidden');
    document.getElementById('etapa2Quiz').classList.remove('hidden');
    
    document.getElementById('infoTituloQuiz').textContent = titulo;
    document.getElementById('infoPerguntaAtual').textContent = '1';
    document.getElementById('infoTotalPerguntas').textContent = numPerguntas;
    
    limparFormPergunta();
    
  } catch (error) {
    console.error('Erro ao criar quiz:', error);
    alert('Erro ao criar quiz');
  }
});

// Submeter pergunta do quiz (etapa 2)
document.getElementById('formPerguntaQuiz')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const pergunta = document.getElementById('inputPerguntaQuiz').value.trim();
  const opcaoA = document.getElementById('inputOpcaoA').value.trim();
  const opcaoB = document.getElementById('inputOpcaoB').value.trim();
  const opcaoC = document.getElementById('inputOpcaoC').value.trim();
  const opcaoD = document.getElementById('inputOpcaoD').value.trim();
  const respostaCorreta = parseInt(document.getElementById('inputRespostaCorreta').value);
  const tempoLimite = parseInt(document.getElementById('inputTempoLimite').value);
  
  if (!pergunta || !opcaoA || !opcaoB || !opcaoC || !opcaoD) {
    alert('Preencha todos os campos');
    return;
  }
  
  if (isNaN(respostaCorreta) || respostaCorreta < 0 || respostaCorreta > 3) {
    alert('Selecione a resposta correta');
    return;
  }
  
  try {
    const { error } = await supabase
      .from('cnv25_quiz_perguntas')
      .insert([{
        quiz_id: quizEmCriacao.id,
        ordem: quizEmCriacao.perguntaAtual,
        pergunta: pergunta,
        opcoes: [opcaoA, opcaoB, opcaoC, opcaoD],
        resposta_correta: respostaCorreta,
        tempo_limite: tempoLimite
      }]);
    
    if (error) throw error;
    
    quizEmCriacao.perguntas.push({
      ordem: quizEmCriacao.perguntaAtual,
      pergunta: pergunta
    });
    
    // Verificar se terminou
    if (quizEmCriacao.perguntaAtual >= quizEmCriacao.totalPerguntas) {
      // Finalizar
      window.ModeradorCore.mostrarNotificacao(
        `Quiz "${quizEmCriacao.titulo}" criado com ${quizEmCriacao.totalPerguntas} perguntas!`, 
        'success'
      );
      
      fecharModalQuizCRUD();
      
      if (window.ModuloQuiz) {
        await window.ModuloQuiz.inicializar();
      }
    } else {
      // Próxima pergunta
      quizEmCriacao.perguntaAtual++;
      document.getElementById('infoPerguntaAtual').textContent = quizEmCriacao.perguntaAtual;
      
      limparFormPergunta();
      
      if (quizEmCriacao.perguntaAtual === quizEmCriacao.totalPerguntas) {
        document.getElementById('btnTextPergunta').textContent = 'Finalizar Quiz';
      }
    }
    
  } catch (error) {
    console.error('Erro ao adicionar pergunta:', error);
    alert('Erro ao adicionar pergunta');
  }
});

function limparFormPergunta() {
  document.getElementById('inputPerguntaQuiz').value = '';
  document.getElementById('inputOpcaoA').value = '';
  document.getElementById('inputOpcaoB').value = '';
  document.getElementById('inputOpcaoC').value = '';
  document.getElementById('inputOpcaoD').value = '';
  document.getElementById('inputRespostaCorreta').value = '';
  document.getElementById('inputTempoLimite').value = '30';
}

async function excluirQuiz(quizId) {
  abrirModalConfirmarExclusao(
    'Tem certeza que deseja excluir este quiz e todas suas perguntas? Esta ação não pode ser desfeita.',
    async () => {
      try {
        // Deletar perguntas primeiro
        await supabase
          .from('cnv25_quiz_perguntas')
          .delete()
          .eq('quiz_id', quizId);
        
        // Deletar quiz
        const { error } = await supabase
          .from('cnv25_quiz')
          .delete()
          .eq('id', quizId);
        
        if (error) throw error;
        
        window.ModeradorCore.mostrarNotificacao('Quiz excluído!', 'success');
        
        if (window.ModuloQuiz) {
          await window.ModuloQuiz.inicializar();
        }
        
      } catch (error) {
        console.error('Erro ao excluir:', error);
        alert('Erro ao excluir quiz');
      }
    }
  );
}

// =====================================================
// MODAL DE CONFIRMAÇÃO
// =====================================================

let callbackConfirmacao = null;

function abrirModalConfirmarExclusao(mensagem, callback) {
  document.getElementById('mensagemExclusao').textContent = mensagem;
  document.getElementById('modalConfirmarExclusao').classList.remove('hidden');
  document.getElementById('modalConfirmarExclusao').classList.add('flex');
  callbackConfirmacao = callback;
}

function fecharModalConfirmarExclusao() {
  document.getElementById('modalConfirmarExclusao').classList.add('hidden');
  document.getElementById('modalConfirmarExclusao').classList.remove('flex');
  callbackConfirmacao = null;
}

document.getElementById('btnConfirmarExclusao')?.addEventListener('click', async () => {
  if (callbackConfirmacao) {
    await callbackConfirmacao();
  }
  fecharModalConfirmarExclusao();
});

console.log('✅ CRUD Modais carregado');
