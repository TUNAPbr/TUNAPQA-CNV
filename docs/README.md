# 🎯 CNV 2025 - Sistema de Perguntas em Palestras

Sistema web simplificado para gerenciar perguntas de participantes em palestras, sem necessidade de login, com moderação em tempo real.

---

## 📋 Funcionalidades

✅ **Participantes** podem enviar perguntas (máx 140 caracteres)  
✅ **Moderadores** aprovam, recusam e exibem perguntas  
✅ **Telão** exibe perguntas ao vivo em tempo real  
✅ Limite de 3 perguntas por dispositivo por palestra  
✅ Rate limit de 1 envio por 60 segundos  
✅ Sistema em tempo real (atualização instantânea)  
✅ Exportação de perguntas em CSV  

---

## 🛠️ Tecnologias Utilizadas

- **HTML5 + JavaScript puro** (sem frameworks complexos)
- **Tailwind CSS** via CDN (estilização)
- **Supabase** (banco de dados PostgreSQL + Realtime)
- **Render/Netlify/Vercel** (hospedagem - escolha um)

---

## 📦 Estrutura do Projeto

```
cnv2025-simples/
├── index.html              # Página inicial (seleção de palestra)
├── participante.html       # Enviar perguntas
├── moderador.html          # Painel de controle
├── telao.html             # Exibição pública
├── js/
│   ├── supabase-config.js # ⚠️ CONFIGURAR SUAS CREDENCIAIS AQUI
│   ├── participante.js    # Lógica do participante
│   ├── moderador.js       # Lógica do moderador
│   └── telao.js           # Lógica do telão
├── supabase-setup.sql     # Script de criação do banco
└── README.md              # Este arquivo
```

---

## 🚀 GUIA DE INSTALAÇÃO COMPLETO

### **PASSO 1: Configurar o Supabase**

#### 1.1 Criar Conta e Projeto
1. Acesse https://supabase.com
2. Crie uma conta gratuita
3. Clique em **"New Project"**
4. Preencha:
   - **Name:** CNV 2025
   - **Database Password:** (crie uma senha forte e anote)
   - **Region:** South America (São Paulo) - se disponível
5. Clique em **"Create new project"**
6. Aguarde 2-3 minutos até o projeto estar pronto

#### 1.2 Criar as Tabelas do Banco
1. No menu lateral, clique em **"SQL Editor"**
2. Clique em **"New Query"**
3. Abra o arquivo `supabase-setup.sql` deste projeto
4. **Copie TODO o conteúdo** do arquivo
5. **Cole no SQL Editor** do Supabase
6. Clique em **"Run"** (ou pressione Ctrl+Enter)
7. Você deve ver a mensagem: **"Success. No rows returned"**

#### 1.3 Habilitar Realtime
1. No menu lateral, clique em **"Database"**
2. Clique em **"Replication"**
3. Localize as tabelas e ative o Realtime para:
   - ✅ `palestras`
   - ✅ `perguntas`
   - ✅ `palestras_flags`
4. Clique em **"Save"**

#### 1.4 Copiar Credenciais
1. No menu lateral, clique em **"Project Settings"** (ícone de engrenagem)
2. Clique em **"API"**
3. Copie e anote:
   - **Project URL** (algo como: `https://xxxxx.supabase.co`)
   - **anon public key** (começa com `eyJ...`)

---

### **PASSO 2: Configurar o Projeto**

#### 2.1 Editar o Arquivo de Configuração
1. Abra o arquivo `js/supabase-config.js` no editor de código
2. Localize estas linhas:
```javascript
const SUPABASE_CONFIG = {
  url: 'SUA_URL_SUPABASE_AQUI',
  anonKey: 'SUA_ANON_KEY_AQUI',
};
```
3. Substitua pelos valores que você copiou:
```javascript
const SUPABASE_CONFIG = {
  url: 'https://xxxxx.supabase.co',  // Cole sua URL aqui
  anonKey: 'eyJ...',  // Cole sua anon key aqui
};
```
4. **Salve o arquivo**

---

### **PASSO 3: Testar Localmente**

#### 3.1 Abrir no Navegador
1. Abra o arquivo `index.html` no seu navegador
2. Você deve ver a página inicial com seleção de palestras
3. Se aparecer um alerta dizendo "Configure o Supabase", volte ao Passo 2

#### 3.2 Testar Fluxo Completo
1. **Selecione uma palestra** na página inicial
2. **Clique em "Participante"**
   - Digite uma pergunta
   - Clique em "Enviar"
   - Deve aparecer "Pergunta enviada com sucesso!"
3. **Volte e clique em "Moderador"**
   - Clique em "Abrir Perguntas"
   - Sua pergunta deve aparecer na fila
   - Clique em "Aprovar"
   - Clique em "Exibir no Telão"
4. **Volte e clique em "Telão"**
   - Sua pergunta deve aparecer na tela grande!

Se tudo funcionou até aqui, **parabéns!** 🎉 O sistema está funcionando localmente.

---

### **PASSO 4: Fazer Deploy (Colocar no Ar)**

Escolha uma das opções abaixo:

---

#### **OPÇÃO A: GitHub Pages (GRÁTIS e MAIS FÁCIL)**

**Vantagens:** 100% gratuito, super rápido  
**Desvantagens:** URL será `seu-usuario.github.io/cnv2025`

1. **Criar conta no GitHub** (se não tiver)
   - Acesse https://github.com
   - Clique em "Sign up"

2. **Criar repositório**
   - Clique no "+" no canto superior direito
   - Clique em "New repository"
   - Nome: `cnv2025`
   - Marque **"Public"**
   - Clique em "Create repository"

3. **Fazer upload dos arquivos**
   - Na página do repositório, clique em "uploading an existing file"
   - **Arraste TODOS os arquivos do projeto** (exceto este README se quiser)
   - Clique em "Commit changes"

4. **Ativar GitHub Pages**
   - Clique em "Settings" (no menu do repositório)
   - No menu lateral, clique em "Pages"
   - Em "Source", selecione "main" ou "master"
   - Clique em "Save"
   - Aguarde 1-2 minutos

5. **Acessar seu site**
   - A URL será: `https://seu-usuario.github.io/cnv2025`
   - Pronto! Já está no ar! 🚀

---

#### **OPÇÃO B: Render (GRÁTIS com algumas limitações)**

**Vantagens:** Domínio customizável, mais profissional  
**Desvantagens:** Site "dorme" após 15 min sem uso (plano grátis)

1. **Criar conta no Render**
   - Acesse https://render.com
   - Clique em "Get Started for Free"
   - Faça login com GitHub

2. **Criar Static Site**
   - No dashboard, clique em "New +"
   - Selecione "Static Site"
   - Conecte seu repositório do GitHub (passo anterior necessário)
   - Configurações:
     - **Name:** cnv2025
     - **Build Command:** (deixe vazio)
     - **Publish Directory:** `.` (ponto)
   - Clique em "Create Static Site"

3. **Aguardar deploy**
   - Aguarde 1-2 minutos
   - Sua URL será: `https://cnv2025.onrender.com`

---

#### **OPÇÃO C: Netlify (GRÁTIS, recomendado)**

1. Acesse https://netlify.com
2. Arraste a pasta do projeto direto no site
3. Pronto! URL gerada automaticamente

---

## 📱 Como Usar no Evento

### **Para Participantes**
1. Crie um **QR Code** apontando para: `SEU_SITE/participante.html?palestra=ID_DA_PALESTRA`
2. Imprima e coloque nas cadeiras/mesas
3. Participantes escaneiam e enviam perguntas

### **Para Moderadores**
1. Acesse: `SEU_SITE/moderador.html?palestra=ID_DA_PALESTRA`
2. Clique em "Abrir Perguntas"
3. Aprove as perguntas e exiba no telão

### **Para o Telão**
1. Abra em fullscreen: `SEU_SITE/telao.html?palestra=ID_DA_PALESTRA`
2. Pressione F11 para tela cheia
3. Conecte no projetor/TV

---

## ⚙️ Configurações Adicionais

### Criar Novas Palestras
1. Acesse o Supabase
2. Vá em "Table Editor"
3. Selecione a tabela `palestras`
4. Clique em "Insert row"
5. Preencha:
   - **sala:** A, B, C, etc
   - **titulo:** Nome da palestra
   - **inicio:** Data/hora de início
   - **fim:** Data/hora de fim
   - **status:** `planejada`
6. Copie o **ID** gerado (será usado na URL)

---

## 🔒 Segurança

✅ **Credenciais públicas seguras:** Usamos apenas a `anon key` do Supabase  
✅ **Rate limiting:** 1 pergunta por 60 segundos por dispositivo  
✅ **Cotas:** Máximo 3 perguntas por dispositivo por palestra  
✅ **Validação:** Bloqueia links e termos proibidos  
✅ **Device ID:** Cada dispositivo tem um ID único no localStorage  

---

## 🐛 Solução de Problemas

### "Configure o Supabase primeiro"
→ Você não editou o arquivo `js/supabase-config.js`  
→ Volte ao **Passo 2**

### "Erro ao carregar palestras"
→ Verifique se executou o script SQL corretamente  
→ Volte ao **Passo 1.2**

### "Perguntas não aparecem em tempo real"
→ Verifique se habilitou o Realtime  
→ Volte ao **Passo 1.3**

### Site offline no Render após 15 minutos
→ Normal no plano grátis  
→ O site "acorda" quando alguém acessa (demora 30s)  
→ Upgrade para plano pago se precisar estar sempre online

---

## 📊 Limites do Plano Grátis

### Supabase (Banco de Dados)
- ✅ 500 MB de armazenamento
- ✅ 2 GB de transferência/mês
- ✅ Até 50.000 leituras/mês
- ⚠️ Suficiente para **centenas de eventos**

### GitHub Pages / Netlify
- ✅ Banda ilimitada
- ✅ Sites ilimitados
- ✅ 100% gratuito sempre

### Render (Plano grátis)
- ⚠️ Site "dorme" após 15 min sem uso
- ✅ 750 horas/mês de uptime
- ✅ Acorda em ~30s quando alguém acessa

---

## 📞 Suporte

- 📧 Email: (seu email aqui)
- 📚 Documentação Supabase: https://supabase.com/docs
- 💬 GitHub Issues: (se subir no GitHub)

---

## 📄 Licença

Este projeto é de código aberto. Sinta-se livre para usar, modificar e distribuir.

---

## ✅ Checklist de Deploy

Marque conforme for completando:

- [ ] Conta no Supabase criada
- [ ] Projeto do Supabase criado
- [ ] Script SQL executado
- [ ] Realtime habilitado nas tabelas
- [ ] Credenciais copiadas
- [ ] Arquivo `supabase-config.js` editado
- [ ] Testado localmente (index.html no navegador)
- [ ] Conta no GitHub criada
- [ ] Repositório criado
- [ ] Arquivos enviados para o GitHub
- [ ] GitHub Pages ativado OU Render configurado
- [ ] Site acessível na internet
- [ ] Testado fluxo completo online

---

**🎉 Pronto! Seu sistema está no ar!**

Boa sorte no seu evento CNV 2025! 🚀
