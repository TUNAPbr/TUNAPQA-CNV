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
// ENQUETE - CRUD
// =====================================================

function abrirModalEnqueteNova() {
  // 🔥 FIX: Trocar para aba de enquetes ANTES de abrir modal
  if (window.ModeradorCore?.trocarAba) {
    window.ModeradorCore.trocarAba('enquetes');
  }
  
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
  // 🔥 FIX: Trocar para aba de enquetes ANTES de abrir modal
  if (window.ModeradorCore?.trocarAba) {
    window.ModeradorCore.trocarAba('enquetes');
  }
  
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

// Estado do wizard de Quiz
const QuizWizardState = {
  modo: 'novo',           // 'novo' | 'editar'
  quizId: null,
  totalPerguntas: 5,
  perguntaAtualIndex: 1,
  perguntasCache: {}      // ordem -> pergunta
};

// ---------- Helpers internos ----------

function resetQuizWizard() {
  QuizWizardState.modo = 'novo';
  QuizWizardState.quizId = null;
  QuizWizardState.totalPerguntas = 5;
  QuizWizardState.perguntaAtualIndex = 1;
  QuizWizardState.perguntasCache = {};
}

// Preenche campos da etapa 1
function preencherEtapa1Quiz(quiz) {
  const tituloEl = document.getElementById('inputTituloQuiz');
  const descEl = document.getElementById('inputDescricaoQuiz');
  const numPergEl = document.getElementById('inputNumPerguntas');

  if (!tituloEl || !descEl || !numPergEl) return;

  if (quiz) {
    tituloEl.value = quiz.titulo || '';
    descEl.value = quiz.descricao || '';
    numPergEl.value = quiz.total_perguntas || 1;
    numPergEl.disabled = false; // se quiser travar edição do total, pode pôr true aqui
  } else {
    tituloEl.value = '';
    descEl.value = '';
    numPergEl.value = 5;
    numPergEl.disabled = false;
  }
}

// Preenche campos da etapa 2 com base na pergunta (se existir)
function preencherFormularioPergunta(ordem) {
  const infoPerguntaAtual = document.getElementById('infoPerguntaAtual');
  const infoTotalPerguntas = document.getElementById('infoTotalPerguntas');
  const tituloQuizInfo = document.getElementById('infoTituloQuiz');

  const inputPergunta = document.getElementById('inputPerguntaQuiz');
  const inputA = document.getElementById('inputOpcaoA');
  const inputB = document.getElementById('inputOpcaoB');
  const inputC = document.getElementById('inputOpcaoC');
  const inputD = document.getElementById('inputOpcaoD');
  const selectCorreta = document.getElementById('inputRespostaCorreta');
  const inputTempo = document.getElementById('inputTempoLimite');
  const btnTextPergunta = document.getElementById('btnTextPergunta');

  if (!inputPergunta || !inputA || !inputB || !inputC || !inputD || !selectCorreta || !inputTempo) return;

  infoPerguntaAtual.textContent = ordem;
  infoTotalPerguntas.textContent = QuizWizardState.totalPerguntas;
  tituloQuizInfo.textContent = document.getElementById('inputTituloQuiz').value || '';

  const existente = QuizWizardState.perguntasCache[ordem];

  if (existente) {
    inputPergunta.value = existente.pergunta || '';
    const opcoes = existente.opcoes || [];
    inputA.value = opcoes[0] || '';
    inputB.value = opcoes[1] || '';
    inputC.value = opcoes[2] || '';
    inputD.value = opcoes[3] || '';
    selectCorreta.value = String(existente.resposta_correta ?? '');
    inputTempo.value = existente.tempo_limite || 30;
  } else {
    inputPergunta.value = '';
    inputA.value = '';
    inputB.value = '';
    inputC.value = '';
    inputD.value = '';
    selectCorreta.value = '';
    inputTempo.value = 30;
  }

  if (btnTextPergunta) {
    btnTextPergunta.textContent =
      ordem >= QuizWizardState.totalPerguntas
        ? 'Salvar e Concluir Quiz'
        : 'Próxima Pergunta';
  }
}

// Carrega todas as perguntas do quiz em edição
async function carregarPerguntasQuiz(quizId) {
  try {
    const { data, error } = await supabase
      .from('cnv25_quiz_perguntas')
      .select('*')
      .eq('quiz_id', quizId)
      .order('ordem', { ascending: true });

    if (error) throw error;

    QuizWizardState.perguntasCache = {};
    (data || []).forEach(p => {
      QuizWizardState.perguntasCache[p.ordem] = p;
    });
  } catch (e) {
    console.error('Erro ao carregar perguntas do quiz:', e);
    QuizWizardState.perguntasCache = {};
  }
}

// ---------- Abertura / fechamento de modal ----------

function abrirModalQuizNovo() {
  resetQuizWizard();
  QuizWizardState.modo = 'novo';

  const modal = document.getElementById('modalQuizCRUD');
  const etapa1 = document.getElementById('etapa1Quiz');
  const etapa2 = document.getElementById('etapa2Quiz');
  const tituloModal = document.getElementById('tituloModalQuiz');
  const quizIdEdit = document.getElementById('quizIdEdit');

  if (tituloModal) tituloModal.textContent = 'Criar Quiz';
  if (quizIdEdit) quizIdEdit.value = '';

  preencherEtapa1Quiz(null);

  if (etapa1) etapa1.classList.remove('hidden');
  if (etapa2) etapa2.classList.add('hidden');

  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

async function abrirModalQuizEditar() {
  const select = document.getElementById('quizSelect');
  if (!select || !select.value) {
    alert('Selecione um quiz para editar.');
    return;
  }

  const quizId = select.value;

  try {
    const { data: quiz, error } = await supabase
      .from('cnv25_quiz')
      .select('*')
      .eq('id', quizId)
      .single();

    if (error || !quiz) {
      console.error('Erro ao carregar quiz para edição:', error);
      alert('Não foi possível carregar o quiz selecionado.');
      return;
    }

    resetQuizWizard();
    QuizWizardState.modo = 'editar';
    QuizWizardState.quizId = quiz.id;
    QuizWizardState.totalPerguntas = quiz.total_perguntas || 1;
    QuizWizardState.perguntaAtualIndex = 1;

    await carregarPerguntasQuiz(quiz.id);

    const modal = document.getElementById('modalQuizCRUD');
    const etapa1 = document.getElementById('etapa1Quiz');
    const etapa2 = document.getElementById('etapa2Quiz');
    const tituloModal = document.getElementById('tituloModalQuiz');
    const quizIdEdit = document.getElementById('quizIdEdit');

    if (tituloModal) tituloModal.textContent = 'Editar Quiz';
    if (quizIdEdit) quizIdEdit.value = quiz.id;

    preencherEtapa1Quiz(quiz);

    if (etapa1) etapa1.classList.remove('hidden');
    if (etapa2) etapa2.classList.add('hidden');

    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  } catch (e) {
    console.error('Erro ao abrir modal de edição de quiz:', e);
    alert('Erro ao abrir edição de quiz.');
  }
}

function fecharModalQuizCRUD() {
  const modal = document.getElementById('modalQuizCRUD');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  resetQuizWizard();
}

// Voltar da etapa 2 para etapa 1
function voltarEtapa1Quiz() {
  const etapa1 = document.getElementById('etapa1Quiz');
  const etapa2 = document.getElementById('etapa2Quiz');
  if (etapa1) etapa1.classList.remove('hidden');
  if (etapa2) etapa2.classList.add('hidden');
}

// ---------- SUBMIT ETAPA 1 (info do quiz) ----------

async function handleSubmitQuizInfo(event) {
  event.preventDefault();

  const titulo = document.getElementById('inputTituloQuiz')?.value?.trim();
  const descricao = document.getElementById('inputDescricaoQuiz')?.value?.trim() || null;
  const numPergStr = document.getElementById('inputNumPerguntas')?.value || '1';
  const numPerguntas = Math.max(1, Math.min(20, parseInt(numPergStr, 10) || 1));
  const quizIdEdit = document.getElementById('quizIdEdit')?.value || '';

  if (!titulo) {
    alert('Título do quiz é obrigatório.');
    return;
  }

  QuizWizardState.totalPerguntas = numPerguntas;

  try {
    let quizId = quizIdEdit || null;

    if (!quizId) {
      // Novo quiz
      const { data, error } = await supabase
        .from('cnv25_quiz')
        .insert({
          titulo,
          descricao,
          total_perguntas: numPerguntas,
          status: 'preparando',
          pergunta_atual: 0
        })
        .select('id')
        .single();

      if (error) throw error;
      quizId = data.id;
    } else {
      // Editar quiz existente
      const { error } = await supabase
        .from('cnv25_quiz')
        .update({
          titulo,
          descricao,
          total_perguntas: numPerguntas
        })
        .eq('id', quizId);

      if (error) throw error;
    }

    QuizWizardState.quizId = quizId;
    QuizWizardState.perguntaAtualIndex = 1;

    // Avança para etapa 2
    const etapa1 = document.getElementById('etapa1Quiz');
    const etapa2 = document.getElementById('etapa2Quiz');
    if (etapa1) etapa1.classList.add('hidden');
    if (etapa2) etapa2.classList.remove('hidden');

    preencherFormularioPergunta(QuizWizardState.perguntaAtualIndex);
  } catch (e) {
    console.error('Erro ao salvar informações do quiz:', e);
    alert('Erro ao salvar informações do quiz.');
  }
}

// ---------- SUBMIT ETAPA 2 (perguntas) ----------

async function handleSubmitPerguntaQuiz(event) {
  event.preventDefault();

  const ordem = QuizWizardState.perguntaAtualIndex;
  const quizId = QuizWizardState.quizId;

  if (!quizId) {
    alert('Quiz não identificado. Volte e salve as informações do quiz.');
    return;
  }

  const pergunta = document.getElementById('inputPerguntaQuiz')?.value?.trim();
  const opA = document.getElementById('inputOpcaoA')?.value?.trim();
  const opB = document.getElementById('inputOpcaoB')?.value?.trim();
  const opC = document.getElementById('inputOpcaoC')?.value?.trim();
  const opD = document.getElementById('inputOpcaoD')?.value?.trim();
  const respCorretaStr = document.getElementById('inputRespostaCorreta')?.value;
  const tempoStr = document.getElementById('inputTempoLimite')?.value || '30';

  if (!pergunta || !opA || !opB || !opC || !opD || respCorretaStr === '') {
    alert('Preencha pergunta, todas as opções e escolha a resposta correta.');
    return;
  }

  const respostaCorreta = parseInt(respCorretaStr, 10);
  const tempoLimite = Math.max(10, Math.min(120, parseInt(tempoStr, 10) || 30));

  const payload = {
    quiz_id: quizId,
    ordem,
    pergunta,
    opcoes: [opA, opB, opC, opD],
    resposta_correta: respostaCorreta,
    tempo_limite: tempoLimite,
    revelada: false
  };

  try {
    // 1) Verifica se já existe pergunta para (quiz_id, ordem)
    const { data: existentes, error: selectError } = await supabase
      .from('cnv25_quiz_perguntas')
      .select('id')
      .eq('quiz_id', quizId)
      .eq('ordem', ordem);

    if (selectError) throw selectError;

    if (existentes && existentes.length > 0) {
      // 2a) Já existe -> UPDATE
      const idExistente = existentes[0].id;

      const { error: updateError } = await supabase
        .from('cnv25_quiz_perguntas')
        .update(payload)
        .eq('id', idExistente);

      if (updateError) throw updateError;
    } else {
      // 2b) Não existe -> INSERT
      const { error: insertError } = await supabase
        .from('cnv25_quiz_perguntas')
        .insert(payload);

      if (insertError) throw insertError;
    }

    // cache local
    QuizWizardState.perguntasCache[ordem] = payload;

    // Já é a última pergunta?
    if (ordem >= QuizWizardState.totalPerguntas) {
      if (window.ModuloQuiz && typeof window.ModuloQuiz.recarregarQuizzes === 'function') {
        window.ModuloQuiz.recarregarQuizzes();
      }
      alert('Quiz salvo com sucesso!');
      fecharModalQuizCRUD();
      return;
    }

    // Avança para a próxima
    QuizWizardState.perguntaAtualIndex += 1;
    preencherFormularioPergunta(QuizWizardState.perguntaAtualIndex);
  } catch (e) {
    console.error('Erro ao salvar pergunta do quiz:', e);
    alert('Erro ao salvar pergunta do quiz.');
  }
}


// ---------- Exclusão de Quiz ----------

function abrirModalExcluirQuiz() {
  const select = document.getElementById('quizSelect');
  if (!select || !select.value) {
    alert('Selecione um quiz para excluir.');
    return;
  }

  const quizId = select.value;
  const quiz = (window.ModuloQuiz && window.ModuloQuiz._getQuizById)
    ? window.ModuloQuiz._getQuizById(quizId)
    : null;

  const titulo = quiz?.titulo || 'este quiz';

  const modal = document.getElementById('modalConfirmarExclusao');
  const msg = document.getElementById('mensagemExclusao');
  const btnConfirmar = document.getElementById('btnConfirmarExclusao');

  if (msg) {
    msg.textContent = `Tem certeza que deseja excluir "${titulo}"? Isto apagará perguntas e respostas.`;
  }

  if (btnConfirmar) {
    btnConfirmar.onclick = async () => {
      try {
        // apagar respostas
        await supabase
          .from('cnv25_quiz_respostas')
          .delete()
          .eq('quiz_id', quizId);

        // apagar perguntas
        await supabase
          .from('cnv25_quiz_perguntas')
          .delete()
          .eq('quiz_id', quizId);

        // apagar quiz
        const { error } = await supabase
          .from('cnv25_quiz')
          .delete()
          .eq('id', quizId);

        if (error) throw error;

        if (window.ModuloQuiz && typeof window.ModuloQuiz.recarregarQuizzes === 'function') {
          window.ModuloQuiz.recarregarQuizzes();
        }

        fecharModalConfirmarExclusao();
        alert('Quiz excluído com sucesso.');
      } catch (e) {
        console.error('Erro ao excluir quiz:', e);
        alert('Erro ao excluir quiz.');
      }
    };
  }

  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

// ---------- Wire-up de eventos dos formulários ----------

(function configurarQuizCrudForms() {
  const formInfo = document.getElementById('formQuizInfo');
  const formPergunta = document.getElementById('formPerguntaQuiz');

  if (formInfo) {
    formInfo.addEventListener('submit', handleSubmitQuizInfo);
  }
  if (formPergunta) {
    formPergunta.addEventListener('submit', handleSubmitPerguntaQuiz);
  }

  // expõe funções globais usadas no HTML
  window.abrirModalQuizNovo = abrirModalQuizNovo;
  window.abrirModalQuizEditar = abrirModalQuizEditar;
  window.voltarEtapa1Quiz = voltarEtapa1Quiz;
  window.fecharModalQuizCRUD = fecharModalQuizCRUD;
  window.abrirModalExcluirQuiz = abrirModalExcluirQuiz;
})();

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


window.abrirModalEnqueteNova   = abrirModalEnqueteNova;
window.abrirModalEnqueteEditar = abrirModalEnqueteEditar;
window.fecharModalEnqueteCRUD  = fecharModalEnqueteCRUD;
console.log('✅ CRUD Modais carregado');
