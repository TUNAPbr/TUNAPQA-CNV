# 🔧 DOCUMENTAÇÃO TÉCNICA

## Arquitetura do Sistema

### Stack Tecnológico
```
┌─────────────────────────────────────┐
│     FRONTEND (Client-Side)          │
│  • HTML5 + JavaScript ES6+          │
│  • Tailwind CSS (via CDN)           │
│  • Supabase JS Client               │
└─────────────────────────────────────┘
              ↕ HTTPS
┌─────────────────────────────────────┐
│      BACKEND (Supabase)             │
│  • PostgreSQL 15                    │
│  • Realtime (WebSockets)            │
│  • Row Level Security (RLS)         │
└─────────────────────────────────────┘
```

---

## 📁 Estrutura de Arquivos

```
cnv2025-simples/
│
├── index.html              # Roteador inicial (seleção de palestra)
├── participante.html       # Interface de envio de perguntas
├── moderador.html          # Painel de controle e moderação
├── telao.html             # Exibição pública (fullscreen)
│
├── js/
│   ├── supabase-config.js # Configuração + funções auxiliares
│   ├── participante.js    # Lógica do participante
│   ├── moderador.js       # Lógica do moderador
│   └── telao.js           # Lógica do telão
│
├── supabase-setup.sql     # Script DDL (criar tabelas)
│
└── README.md              # Documentação principal
```

---

## 🗄️ Schema do Banco de Dados

### Tabela: `palestras`
```sql
CREATE TABLE palestras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sala TEXT NOT NULL,
  titulo TEXT NOT NULL,
  inicio TIMESTAMPTZ NOT NULL,
  fim TIMESTAMPTZ NOT NULL,
  status TEXT CHECK (status IN ('planejada','aberta','fechada','encerrada')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Status possíveis:**
- `planejada`: Criada mas não iniciada
- `aberta`: Perguntas sendo aceitas
- `fechada`: Perguntas bloqueadas, mas palestra continua
- `encerrada`: Palestra finalizada

---

### Tabela: `palestras_flags`
```sql
CREATE TABLE palestras_flags (
  palestra_id UUID PRIMARY KEY REFERENCES palestras(id),
  silencio_ate TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Uso:**
- `silencio_ate`: Se `NOW() < silencio_ate`, bloquear novos envios
- Permite "pausar" temporariamente sem fechar completamente

---

### Tabela: `perguntas`
```sql
CREATE TABLE perguntas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  palestra_id UUID REFERENCES palestras(id),
  texto VARCHAR(140) NOT NULL,
  nome_opt VARCHAR(80),
  anonimo BOOLEAN DEFAULT TRUE,
  device_id_hash TEXT NOT NULL,
  nonce TEXT UNIQUE NOT NULL,
  status TEXT CHECK (status IN ('pendente','aprovada','exibida','respondida','recusada')),
  motivo_recusa TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  exibida_em TIMESTAMPTZ,
  respondida_em TIMESTAMPTZ
);
```

**Ciclo de vida:**
```
pendente → aprovada → exibida → respondida
   ↓
recusada
```

**Campos importantes:**
- `device_id_hash`: SHA-256 do device_id + salt (identifica dispositivo)
- `nonce`: UUID único por envio (garante idempotência)
- `anonimo`: TRUE se não informou nome

---

### Tabela: `moderacoes_log`
```sql
CREATE TABLE moderacoes_log (
  id BIGSERIAL PRIMARY KEY,
  palestra_id UUID REFERENCES palestras(id),
  pergunta_id UUID REFERENCES perguntas(id),
  ator TEXT NOT NULL,
  acao TEXT NOT NULL,
  detalhe TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Uso:** Auditoria de ações (quem fez o quê e quando)

---

## 🔐 Segurança

### Device ID
```javascript
// Gerado no primeiro acesso e persistido
const deviceId = crypto.randomUUID(); // Ex: a1b2c3d4-...
localStorage.setItem('cnv_device_id', deviceId);

// Hash antes de enviar ao servidor
const hash = SHA256(deviceId + 'salt-secreto');
```

**Por que?**
- Rastrear dispositivos sem cookies
- Aplicar rate limit e cotas
- Resistente a clear do localStorage (hash é o mesmo)

---

### Validações

**Client-side:**
```javascript
function validarPergunta(texto) {
  if (texto.length > 140) return false;
  if (/https?:\/\//.test(texto)) return false; // Bloquear links
  if (palavrasProibidas.includes(...)) return false;
  return true;
}
```

**Server-side (Supabase):**
- Constraint `CHECK` no VARCHAR(140)
- Unique constraint no `nonce`

---

### Rate Limiting

**Implementação:**
```javascript
// localStorage
const ultimoEnvio = localStorage.getItem('cnv_ultimo_envio');
const tempoDecorrido = Date.now() - parseInt(ultimoEnvio);

if (tempoDecorrido < 60000) {
  throw new Error('Aguarde 60 segundos');
}
```

**Limitações:**
- Por dispositivo (device_id)
- 1 envio / 60 segundos
- Máximo 3 perguntas / palestra

---

## ⚡ Realtime (Supabase)

### Como funciona

```javascript
// Criar canal
const canal = supabase.channel('nome-do-canal');

// Escutar eventos
canal
  .on('postgres_changes', {
    event: 'INSERT',    // ou UPDATE, DELETE
    schema: 'public',
    table: 'perguntas',
    filter: 'palestra_id=eq.UUID'
  }, (payload) => {
    console.log('Novo dado:', payload.new);
    // Atualizar UI
  })
  .subscribe();
```

### Eventos Monitorados

**Participante:**
- `UPDATE` em `palestras` (status aberta/fechada)

**Moderador:**
- `INSERT` em `perguntas` (nova pergunta)
- `UPDATE` em `perguntas` (status mudou)
- `UPDATE` em `palestras` (status mudou)

**Telão:**
- `UPDATE` em `perguntas` onde `status = 'exibida'`

---

## 🔄 Fluxo de Dados

### Envio de Pergunta
```
1. Participante preenche formulário
2. Validações client-side
3. Gera nonce (UUID)
4. INSERT na tabela 'perguntas' (status: pendente)
5. Supabase Realtime emite evento
6. Moderador recebe evento e renderiza na Fila
```

### Aprovar e Exibir
```
1. Moderador clica "Aprovar"
2. UPDATE perguntas SET status='aprovada'
3. Realtime notifica (moderador move para "Aprovadas")
4. Moderador clica "Exibir no Telão"
5. UPDATE perguntas SET status='exibida', exibida_em=NOW()
6. Realtime notifica telão
7. Telão renderiza pergunta com animação
```

---

## 🎨 Componentes UI

### Tailwind Classes Principais

**Gradientes:**
```css
bg-gradient-to-r from-purple-500 to-purple-600
bg-gradient-to-br from-blue-500 to-blue-600
```

**Cards:**
```css
rounded-2xl shadow-2xl p-8
```

**Botões:**
```css
px-4 py-2 rounded-lg hover:shadow-lg transition duration-200
```

**Estados:**
```css
disabled:opacity-50 disabled:cursor-not-allowed
```

---

## 🐛 Debug

### Ativar Console Logs
Todos os arquivos JS têm `console.log()` para debug:

```javascript
console.log('✅ Supabase configurado');
console.log('Nova pergunta:', payload);
```

### Verificar Conexão Realtime
```javascript
const status = supabase.getChannels()[0].state;
// Deve ser: 'joined'
```

### Testar Manualmente no Console
```javascript
// No DevTools (F12)
await supabase.from('perguntas').select('*');
```

---

## 🚀 Performance

### Otimizações Implementadas

1. **Índices no Banco:**
```sql
CREATE INDEX ON perguntas (palestra_id, status, created_at);
CREATE INDEX ON perguntas (device_id_hash, palestra_id);
```

2. **Limit de Queries:**
```javascript
// Buscar apenas 1 (próxima pergunta)
.limit(1)
```

3. **CDN para Assets:**
- Tailwind via CDN
- Supabase JS via CDN

4. **Realtime Filters:**
```javascript
filter: 'palestra_id=eq.UUID' // Só recebe eventos da palestra
```

---

## 📊 Escalabilidade

### Limites Estimados (Plano Grátis Supabase)

| Métrica | Limite | Evento de 100 pessoas |
|---------|--------|----------------------|
| DB Storage | 500 MB | ~1 MB |
| Bandwidth | 2 GB/mês | ~100 MB |
| Realtime connections | 200 simultâneas | 100 OK |
| API Requests | 50k/mês | ~5k req |

**Conclusão:** Suporta até **~10 eventos de 100 pessoas** no plano grátis.

---

## 🔧 Customizações Comuns

### Mudar Limite de Caracteres
```javascript
// supabase-config.js
if (texto.length > 280) { // Era 140
  erros.push('Máximo 280 caracteres');
}

// supabase-setup.sql
texto VARCHAR(280) NOT NULL, -- Era 140
```

### Adicionar Novos Status
```sql
ALTER TABLE perguntas 
ADD CONSTRAINT check_status 
CHECK (status IN ('pendente','aprovada','exibida','respondida','recusada','em_analise'));
```

### Mudar Cores
```html
<!-- Trocar classes Tailwind -->
<div class="bg-green-500">  <!-- Era purple-500 -->
```

---

## 🧪 Testes

### Teste de Carga Manual
```javascript
// Simular 10 perguntas simultâneas
for (let i = 0; i < 10; i++) {
  await supabase.from('perguntas').insert({
    palestra_id: 'UUID',
    texto: `Pergunta ${i}`,
    device_id_hash: crypto.randomUUID(),
    nonce: crypto.randomUUID(),
    status: 'pendente'
  });
}
```

### Teste de Realtime
1. Abrir 2 abas: Moderador + Telão
2. Enviar pergunta
3. Aprovar no moderador
4. Verificar se aparece no telão

---

## 📝 Changelog

### v1.0 (Atual)
- ✅ Sistema completo funcionando
- ✅ HTML puro (sem build)
- ✅ Realtime integrado
- ✅ Export CSV
- ✅ Rate limiting
- ✅ Documentação completa

### Futuras Melhorias (Roadmap)
- [ ] Modo escuro
- [ ] Multi-idioma (i18n)
- [ ] Notificações sonoras (moderador)
- [ ] Reações aos perguntas (👍👎)
- [ ] Dashboard de analytics

---

## 🆘 Troubleshooting Técnico

### CORS Error
**Causa:** Supabase bloqueando origem  
**Solução:** Configurar allowed origins no Supabase Dashboard

### RLS Error
**Causa:** Row Level Security ativado  
**Solução:** Desabilitar RLS ou configurar policies

### Realtime não conecta
**Causa:** Realtime não habilitado na tabela  
**Solução:** Database → Replication → Enable

---

## 📚 Referências

- Supabase Docs: https://supabase.com/docs
- Supabase Realtime: https://supabase.com/docs/guides/realtime
- Tailwind CSS: https://tailwindcss.com/docs
- Web Crypto API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API

---

**Desenvolvido com ❤️ para CNV 2025**
