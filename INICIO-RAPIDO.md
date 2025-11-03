# 🚀 INÍCIO RÁPIDO - CNV 2025

## ⏱️ Em 10 minutos no ar!

### PASSO 1: Supabase (5 minutos)
1. Acesse: https://supabase.com
2. Crie conta gratuita
3. Crie novo projeto
4. Vá em "SQL Editor" → Cole o conteúdo de `supabase-setup.sql` → Run
5. Vá em "Database" → "Replication" → Ative Realtime em: palestras, perguntas, palestras_flags
6. Vá em "Settings" → "API" → Copie:
   - Project URL
   - anon public key

### PASSO 2: Configurar Projeto (1 minuto)
1. Abra `js/supabase-config.js`
2. Cole suas credenciais nas linhas 9 e 13:
```javascript
url: 'https://xxxxx.supabase.co',  // Cole aqui
anonKey: 'eyJ...',                 // Cole aqui
```
3. Salve

### PASSO 3: Testar (1 minuto)
1. Abra `index.html` no navegador
2. Selecione uma palestra
3. Teste: Participante → Moderador → Telão

### PASSO 4: Colocar Online (3 minutos)

**GitHub Pages (recomendado):**
1. Crie repositório no GitHub
2. Arraste todos os arquivos
3. Settings → Pages → Ative
4. Pronto! URL: `seu-usuario.github.io/cnv2025`

**OU Netlify (mais fácil ainda):**
1. Acesse: https://app.netlify.com/drop
2. Arraste a pasta do projeto
3. Pronto! URL gerada automaticamente

---

## 🎯 URLs do Sistema

Depois do deploy, suas URLs serão:

- **Home:** `SEU_SITE/`
- **Participante:** `SEU_SITE/participante.html?palestra=ID`
- **Moderador:** `SEU_SITE/moderador.html?palestra=ID`
- **Telão:** `SEU_SITE/telao.html?palestra=ID`

**Dica:** Crie QR Codes apontando para a URL do participante!

---

## 📞 Precisa de Ajuda?

Leia o **README.md** completo para instruções detalhadas e solução de problemas.

---

**BOA SORTE NO SEU EVENTO! 🎉**
