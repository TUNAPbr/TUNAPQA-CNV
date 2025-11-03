# 📚 ÍNDICE DE ARQUIVOS - CNV 2025

## 🗂️ Navegação Rápida

### 📖 DOCUMENTAÇÃO (Comece por aqui!)

1. **[INICIO-RAPIDO.md](INICIO-RAPIDO.md)** ⭐ COMECE AQUI!
   - Guia de 10 minutos
   - Passos essenciais
   - URLs do sistema

2. **[README.md](README.md)** 📘 Manual Completo
   - Instalação detalhada
   - Configuração passo-a-passo
   - Deploy (GitHub Pages, Render, Netlify)
   - Troubleshooting

3. **[GUIA-EVENTO.md](GUIA-EVENTO.md)** 🎪 Durante o Evento
   - Checklist pré-evento
   - Workflow recomendado
   - Problemas comuns
   - Dicas práticas

4. **[PREVIEW.md](PREVIEW.md)** 🎨 Como Ficará
   - Prévia visual (ASCII art)
   - Paleta de cores
   - Fluxo completo

5. **[DOCUMENTACAO-TECNICA.md](DOCUMENTACAO-TECNICA.md)** 🔧 Para Devs
   - Arquitetura
   - Schema do banco
   - Segurança
   - Customizações

6. **[RESUMO-FINAL.md](RESUMO-FINAL.md)** 🎉 Visão Geral
   - O que foi criado
   - Funcionalidades
   - Estatísticas
   - Próximos passos

---

### 🌐 PÁGINAS HTML (Interface do Usuário)

1. **[index.html](index.html)** 🏠 Página Inicial
   - Seleção de palestras
   - Links para todas as interfaces

2. **[participante.html](participante.html)** 💬 Enviar Perguntas
   - Formulário de pergunta
   - Contador de caracteres
   - Status (aberta/fechada)

3. **[moderador.html](moderador.html)** 🛡️ Painel de Controle
   - Fila de pendentes
   - Controles de palestra
   - Exibição no telão
   - Logs e histórico

4. **[telao.html](telao.html)** 📺 Exibição Pública
   - Pergunta atual (grande)
   - Próxima pergunta (preview)
   - Design fullscreen

---

### 💻 SCRIPTS JAVASCRIPT (Lógica)

1. **[js/supabase-config.js](js/supabase-config.js)** ⚙️ Configuração
   - **⚠️ EDITAR ESTE ARQUIVO PRIMEIRO!**
   - Credenciais do Supabase
   - Funções auxiliares

2. **[js/participante.js](js/participante.js)** 📝 Lógica Participante
   - Validações
   - Envio de pergunta
   - Rate limiting

3. **[js/moderador.js](js/moderador.js)** 🎛️ Lógica Moderador
   - Aprovar/Recusar
   - Exibir no telão
   - Controles de palestra
   - Exportar CSV

4. **[js/telao.js](js/telao.js)** 📡 Lógica Telão
   - Receber perguntas em tempo real
   - Renderização
   - Animações

---

### 🗄️ BANCO DE DADOS

1. **[supabase-setup.sql](supabase-setup.sql)** 🛠️ Script SQL
   - Criar tabelas
   - Índices
   - Dados de exemplo
   - **Execute no Supabase SQL Editor**

---

### 🔧 ARQUIVOS DE CONFIGURAÇÃO

1. **[.gitignore](.gitignore)** 📦 Git
   - Arquivos a ignorar
   - Para versionar no GitHub

---

## 🎯 ORDEM DE LEITURA RECOMENDADA

### Para Iniciantes:
1. **INICIO-RAPIDO.md** (entender o básico)
2. **README.md** (instalação completa)
3. **Testar localmente**
4. **GUIA-EVENTO.md** (preparar para uso)

### Para Desenvolvedores:
1. **DOCUMENTACAO-TECNICA.md** (arquitetura)
2. **Ler código fonte** (HTML + JS)
3. **supabase-setup.sql** (schema)
4. **Customizar**

### Para Organizadores de Evento:
1. **GUIA-EVENTO.md** (workflow)
2. **README.md** (seção "Como Usar no Evento")
3. **PREVIEW.md** (ver como ficará)

---

## 📂 ESTRUTURA COMPLETA DO PROJETO

```
cnv2025-simples/
│
├── 📖 DOCUMENTAÇÃO
│   ├── INICIO-RAPIDO.md          ⭐ Comece aqui!
│   ├── README.md                 📘 Manual completo
│   ├── GUIA-EVENTO.md            🎪 Usar no evento
│   ├── PREVIEW.md                🎨 Prévia visual
│   ├── DOCUMENTACAO-TECNICA.md   🔧 Para devs
│   ├── RESUMO-FINAL.md           🎉 Visão geral
│   └── INDICE.md                 📚 Este arquivo
│
├── 🌐 PÁGINAS HTML
│   ├── index.html                🏠 Página inicial
│   ├── participante.html         💬 Enviar perguntas
│   ├── moderador.html            🛡️ Painel moderador
│   └── telao.html                📺 Telão público
│
├── 💻 JAVASCRIPT
│   ├── js/supabase-config.js     ⚙️ Configuração (EDITAR!)
│   ├── js/participante.js        📝 Lógica participante
│   ├── js/moderador.js           🎛️ Lógica moderador
│   └── js/telao.js               📡 Lógica telão
│
├── 🗄️ BANCO DE DADOS
│   └── supabase-setup.sql        🛠️ Script SQL
│
└── 🔧 CONFIGURAÇÃO
    └── .gitignore                📦 Git ignore
```

---

## 🚦 STATUS DO PROJETO

✅ **COMPLETO E FUNCIONAL**

- [x] Interface completa (4 páginas)
- [x] Lógica implementada (4 arquivos JS)
- [x] Banco configurado (SQL pronto)
- [x] Documentação completa (6 arquivos)
- [x] Testado e validado
- [x] Pronto para deploy

---

## 📋 CHECKLIST DE USO

### Antes de Usar:
- [ ] Ler INICIO-RAPIDO.md
- [ ] Criar conta Supabase
- [ ] Executar supabase-setup.sql
- [ ] Editar js/supabase-config.js
- [ ] Testar localmente (abrir index.html)

### Deploy:
- [ ] Escolher plataforma (GitHub Pages / Netlify / Render)
- [ ] Fazer upload dos arquivos
- [ ] Testar online
- [ ] Anotar URLs

### No Evento:
- [ ] Criar QR Codes
- [ ] Testar internet local
- [ ] Abrir telão
- [ ] Briefing com moderadores

---

## 🔗 LINKS ÚTEIS

- **Supabase:** https://supabase.com
- **GitHub Pages:** https://pages.github.com
- **Netlify:** https://netlify.com
- **Render:** https://render.com
- **Tailwind CSS:** https://tailwindcss.com
- **QR Code Generator:** https://qr-code-generator.com

---

## 💡 DICAS FINAIS

1. **Leia a documentação na ordem** (INICIO-RAPIDO → README → GUIA-EVENTO)
2. **Teste ANTES do evento** (evite surpresas)
3. **Tenha internet backup** (4G/5G de reserva)
4. **Treine os moderadores** (15 min de prática)
5. **Faça backup do CSV** (após cada palestra)

---

## 🎊 PRONTO PARA COMEÇAR?

**Próximo passo:** Abra [INICIO-RAPIDO.md](INICIO-RAPIDO.md) e siga o guia de 10 minutos!

---

**Boa sorte com seu evento CNV 2025! 🚀**
