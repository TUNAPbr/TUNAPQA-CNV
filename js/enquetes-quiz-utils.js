// js/enquetes-quiz-utils.js

// Gera um ID estável por dispositivo (fica no localStorage)
function getOrCreateDeviceId() {
  const KEY = 'cnv25_device_id_hash';
  let id = localStorage.getItem(KEY);
  if (!id) {
    // não precisa ser cifra NSA, só ser estável e único
    id = 'dev_' + crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

window.DeviceId = getOrCreateDeviceId();

// ==========================
//  BROADCAST SERVICE
//  controla cnv25_broadcast_controle (linha única, id=1)
// ==========================
window.BroadcastService = (function () {
  const TABLE = 'cnv25_broadcast_controle';
  const BROADCAST_ID = 1;

  async function getEstado() {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', BROADCAST_ID)
      .single();

    if (error) {
      console.error('Erro ao carregar broadcast:', error);
      return null;
    }
    return data;
  }

  async function patchEstado(patch) {
    const { data, error } = await supabase
      .from(TABLE)
      .update({
        ...patch,
        updated_at: new Date().toISOString()
      })
      .eq('id', BROADCAST_ID)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar broadcast:', error);
      throw error;
    }
    return data;
  }

  function subscribe(callback) {
    // callback(estadoAtual) toda vez que mudar
    const channel = supabase
      .channel('cnv25_broadcast_controle_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLE,
          filter: `id=eq.${BROADCAST_ID}`
        },
        async (payload) => {
          const novo = payload.new || (await getEstado());
          callback(novo);
        }
      )
      .subscribe();

    // opcional: já chama uma vez com o estado atual
    getEstado().then((estado) => {
      if (estado) callback(estado);
    });

    return channel;
  }

  // Helpers específicos para ENQUETE
  async function ativarEnquete(enqueteId) {
    return patchEstado({
      modo_global: 'enquete',
      enquete_ativa: enqueteId,
      mostrar_resultado_enquete: false,
      quiz_ativo: null,
      pergunta_exibida: null
    });
  }

  async function encerrarEnquete() {
    return patchEstado({
      modo_global: null,
      enquete_ativa: null,
      mostrar_resultado_enquete: false
    });
  }

  async function mostrarResultadoEnquete(flag) {
    return patchEstado({
      mostrar_resultado_enquete: !!flag
    });
  }

  return {
    getEstado,
    patchEstado,
    subscribe,
    ativarEnquete,
    encerrarEnquete,
    mostrarResultadoEnquete
  };
})();

// ==========================
//  ENQUETE SERVICE
//  CRUD e voto de enquetes
// ==========================
window.EnqueteService = (function () {
  const TABLE = 'cnv25_enquetes';
  const RESPOSTAS_TABLE = 'cnv25_enquete_respostas';

  async function listarEnquetes() {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao listar enquetes:', error);
      return [];
    }
    return data;
  }

  async function carregarEnquete(id) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Erro ao carregar enquete:', error);
      return null;
    }
    return data;
  }

  async function votar(enquete, opcaoIndex) {
    const deviceId = window.DeviceId;

    // opcoes pode ser array ou json com textos
    let opcoesArray = [];
    if (Array.isArray(enquete.opcoes)) {
      opcoesArray = enquete.opcoes;
    } else if (enquete.opcoes) {
      try {
        opcoesArray = Array.isArray(enquete.opcoes)
          ? enquete.opcoes
          : JSON.parse(enquete.opcoes);
      } catch (e) {
        console.warn('Opções de enquete em formato inesperado', e);
      }
    }

    const valor = opcoesArray[opcaoIndex] ?? '';

    const payload = {
      enquete_id: enquete.id,
      device_id_hash: deviceId,
      resposta: {
        opcaoIndex,
        valor
      }
    };

    const { error } = await supabase
      .from(RESPOSTAS_TABLE)
      .insert(payload);

    if (error) {
      // se cair no unique (já votou), só devolve erro para o front tratar
      console.error('Erro ao votar na enquete:', error);
      throw error;
    }
  }

  return {
    listarEnquetes,
    carregarEnquete,
    votar
  };
})();
