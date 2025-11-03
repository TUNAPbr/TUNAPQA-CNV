// =====================================================
// CONFIGURAÇÃO DO SUPABASE - VERSÃO FINAL CORRIGIDA
// =====================================================

const SUPABASE_CONFIG = {
  url: 'https://vwqfalhfeajwavkuewpp.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3cWZhbGhmZWFqd2F2a3Vld3BwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA2NDM5OTgsImV4cCI6MjAzNjIxOTk5OH0.4JsrInoo7vxhuE52BgnWVpgbJQfowo03HQjBS5OhTvMI',
};

// Validação básica (avisa se não configurou)
if (SUPABASE_CONFIG.url.includes('SUA_URL') || SUPABASE_CONFIG.anonKey.includes('SUA_ANON')) {
  console.error('❌ ATENÇÃO: Configure suas credenciais do Supabase no arquivo js/supabase-config.js');
  alert('⚠️ Configure o Supabase primeiro!\n\nEdite o arquivo js/supabase-config.js e cole suas credenciais.');
}

// Inicializar cliente Supabase
window.supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

console.log('✅ Supabase configurado');

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

// Gerar ou recuperar Device ID
function getDeviceId() {
  let deviceId = localStorage.getItem('cnv_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('cnv_device_id', deviceId);
  }
  return deviceId;
}

// Hash do device ID (SHA-256)
async function hashDeviceId(deviceId) {
  const encoder = new TextEncoder();
  const data = encoder.encode(deviceId + 'salt-secreto-cnv2025');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Validar pergunta
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

// Formatar data/hora
function formatarDataHora(timestamp) {
  const data = new Date(timestamp);
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Verificar rate limit (1 envio por 60s)
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

// Registrar envio
function registrarEnvio() {
  localStorage.setItem('cnv_ultimo_envio', Date.now().toString());
}

// Contar perguntas do device
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

// Obter palestra por ID
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

// Verificar silêncio ativo
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

console.log('✅ Funções auxiliares carregadas');
