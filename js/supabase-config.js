// =====================================================
// CONFIGURAÇÃO DO SUPABASE - VERSÃO MELHORADA
// =====================================================

const SUPABASE_CONFIG = {
  url: 'https://vwqfalhfeajwavkuewpp.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3cWZhbGhmZWFqd2F2a3Vld3BwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA2NDM5OTgsImV4cCI6MjAzNjIxOTk5OH0.4JsrInoo7vxhuE52BgnWVpgbJQfowo03HQjBS5OhTvM',
};

// Validação básica
if (SUPABASE_CONFIG.url.includes('SUA_URL') || SUPABASE_CONFIG.anonKey.includes('SUA_ANON')) {
  console.error('❌ ATENÇÃO: Configure suas credenciais do Supabase');
  alert('⚠️ Configure o Supabase primeiro!');
}

// Inicializar cliente Supabase
window.supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

console.log('✅ Supabase configurado');

// =====================================================
// FUNÇÕES AUXILIARES ORIGINAIS
// =====================================================

function getDeviceId() {
  let deviceId = localStorage.getItem('cnv_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('cnv_device_id', deviceId);
  }
  return deviceId;
}

async function hashDeviceId(deviceId) {
  const encoder = new TextEncoder();
  const data = encoder.encode(deviceId + 'salt-secreto-cnv2025');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function validarPergunta(texto) {
  const erros = [];
  
  if (!texto || texto.trim().length === 0) {
    erros.push('A pergunta não pode estar vazia');
  }
  
  if (texto.length > 140) {
    erros.push('A pergunta deve ter no máximo 140 caracteres');
  }
  
  const temLink = /https?:\/\/|www\./i.test(texto);
  if (temLink) {
    erros.push('Links não são permitidos');
  }
  
  const palavrasProibidas = ['spam', 'teste-proibido'];
  const temPalavraProibida = palavrasProibidas.some(palavra => 
    texto.toLowerCase().includes(palavra)
  );
  if (temPalavraProibida) {
    erros.push('Texto contém palavras não permitidas');
  }
  
  return erros;
}

function validarEmail(email) {
  if (!email) return true; // Email é opcional
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function formatarDataHora(timestamp) {
  const data = new Date(timestamp);
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function verificarRateLimit() {
  const ultimoEnvio = localStorage.getItem('cnv_ultimo_envio');
  if (ultimoEnvio) {
    const tempoDecorrido = Date.now() - parseInt(ultimoEnvio);
    const tempoRestante = 60000 - tempoDecorrido;
    
    if (tempoRestante > 0) {
      return {
        permitido: false,
        segundosRestantes: Math.ceil(tempoRestante / 1000)
      };
    }
  }
  
  return { permitido: true };
}

// Nova função com intervalo dinâmico
function verificarRateLimitDinamico(intervaloSegundos) {
  const ultimoEnvio = localStorage.getItem('cnv_ultimo_envio');
  if (ultimoEnvio) {
    const tempoDecorrido = Date.now() - parseInt(ultimoEnvio);
    const tempoRestante = (intervaloSegundos * 1000) - tempoDecorrido;
    
    if (tempoRestante > 0) {
      return {
        permitido: false,
        segundosRestantes: Math.ceil(tempoRestante / 1000)
      };
    }
  }
  
  return { permitido: true };
}

function registrarEnvio() {
  localStorage.setItem('cnv_ultimo_envio', Date.now().toString());
}

async function contarPerguntasDevice(palestraId, deviceIdHash) {
  const { count, error } = await window.supabase
    .from('cnv25_perguntas')
    .select('*', { count: 'exact', head: true })
    .eq('palestra_id', palestraId)
    .eq('device_id_hash', deviceIdHash);
  
  if (error) {
    console.error('Erro ao contar perguntas:', error);
    return 0;
  }
  
  return count || 0;
}

async function obterPalestra(palestraId) {
  const { data, error } = await window.supabase
    .from('cnv25_palestras')
    .select('*')
    .eq('id', palestraId)
    .single();
  
  if (error) {
    console.error('Erro ao buscar palestra:', error);
    return null;
  }
  
  return data;
}

async function verificarSilencio(palestraId) {
  const { data, error } = await window.supabase
    .from('cnv25_palestras_flags')
    .select('silencio_ate')
    .eq('palestra_id', palestraId)
    .single();
  
  if (error || !data || !data.silencio_ate) {
    return false;
  }
  
  const silencioAte = new Date(data.silencio_ate);
  return silencioAte > new Date();
}

// =====================================================
// NOVAS FUNÇÕES - MELHORIAS
// =====================================================

// Obter palestra com controles
async function obterPalestraCompleta(palestraId) {
  const { data: palestra } = await window.supabase
    .from('cnv25_palestras')
    .select('*')
    .eq('id', palestraId)
    .single();
  
  if (!palestra) return null;
  
  const { data: controle } = await window.supabase
    .from('cnv25_palestra_controle')
    .select('*')
    .eq('palestra_id', palestraId)
    .single();
  
  return {
    ...palestra,
    controle: controle || { perguntas_abertas: false, silencio_ativo: false }
  };
}

// Verificar se perguntas estão abertas (novo sistema)
async function verificarPerguntasAbertas(palestraId) {
  const { data, error } = await window.supabase
    .from('cnv25_palestra_controle')
    .select('perguntas_abertas, silencio_ativo')
    .eq('palestra_id', palestraId)
    .single();
  
  if (error || !data) return false;
  
  // Perguntas abertas E silêncio inativo
  return data.perguntas_abertas && !data.silencio_ativo;
}

// Atualizar controle de palestra
async function atualizarControlePalestra(palestraId, updates) {
  const { data, error } = await window.supabase
    .from('cnv25_palestra_controle')
    .upsert({
      palestra_id: palestraId,
      ...updates,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) {
    console.error('Erro ao atualizar controle:', error);
    return null;
  }
  
  return data;
}

// =====================================================
// FUNÇÕES DE ENQUETE
// =====================================================

// Criar enquete
async function criarEnquete(palestraId, titulo, tipo, opcoes = null) {
  const { data, error } = await window.supabase
    .from('cnv25_enquetes')
    .insert([{
      palestra_id: palestraId,
      titulo: titulo,
      tipo: tipo,
      opcoes: opcoes,
      ativa: true
    }])
    .select()
    .single();
  
  if (error) {
    console.error('Erro ao criar enquete:', error);
    return null;
  }
  
  return data;
}

// Obter enquete ativa
async function obterEnqueteAtiva(palestraId) {
  const { data, error } = await window.supabase
    .from('cnv25_enquetes')
    .select('*')
    .eq('palestra_id', palestraId)
    .eq('ativa', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Erro ao buscar enquete:', error);
    return null;
  }
  
  return data || null;
}

// Votar em enquete
async function votarEnquete(enqueteId, deviceIdHash, resposta) {
  const { data, error } = await window.supabase
    .from('cnv25_enquete_respostas')
    .insert([{
      enquete_id: enqueteId,
      device_id_hash: deviceIdHash,
      resposta: { valor: resposta }
    }])
    .select()
    .single();
  
  if (error) {
    if (error.code === '23505') {
      return { error: 'Você já votou nesta enquete' };
    }
    console.error('Erro ao votar:', error);
    return { error: 'Erro ao registrar voto' };
  }
  
  return { success: true, data };
}

// Obter resultados da enquete
async function obterResultadosEnquete(enqueteId) {
  const { data, error } = await window.supabase
    .from('cnv25_enquete_respostas')
    .select('resposta')
    .eq('enquete_id', enqueteId);
  
  if (error) {
    console.error('Erro ao buscar resultados:', error);
    return null;
  }
  
  // Contar votos por resposta
  const contagem = {};
  data.forEach(r => {
    const valor = r.resposta.valor;
    contagem[valor] = (contagem[valor] || 0) + 1;
  });
  
  return {
    total: data.length,
    distribuicao: contagem
  };
}

// Encerrar enquete
async function encerrarEnquete(enqueteId) {
  const { data, error } = await window.supabase
    .from('cnv25_enquetes')
    .update({
      ativa: false,
      encerrada_em: new Date().toISOString()
    })
    .eq('id', enqueteId)
    .select()
    .single();
  
  if (error) {
    console.error('Erro ao encerrar enquete:', error);
    return null;
  }
  
  return data;
}

// Verificar se já votou
async function verificouVotou(enqueteId, deviceIdHash) {
  const { count } = await window.supabase
    .from('cnv25_enquete_respostas')
    .select('*', { count: 'exact', head: true })
    .eq('enquete_id', enqueteId)
    .eq('device_id_hash', deviceIdHash);
  
  return count > 0;
}

console.log('✅ Funções auxiliares carregadas (versão melhorada)');
