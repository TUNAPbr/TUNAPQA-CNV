# 🎪 GUIA DE USO NO EVENTO

## 📋 CHECKLIST PRÉ-EVENTO

### 1 Semana Antes
- [ ] Sistema testado e funcionando
- [ ] Credenciais do Supabase configuradas
- [ ] Deploy realizado (site no ar)
- [ ] URLs anotadas
- [ ] Palestras criadas no banco
- [ ] QR Codes gerados

### 1 Dia Antes
- [ ] Testar internet do local
- [ ] Testar projetor/TV
- [ ] Imprimir QR Codes
- [ ] Preparar avisos para participantes
- [ ] Treinar moderadores

### No Dia
- [ ] Verificar se site está acessível
- [ ] Conectar telão ao projetor
- [ ] Colocar QR Codes nas mesas
- [ ] Briefing com moderadores
- [ ] Abrir telão em fullscreen

---

## 🎯 WORKFLOW RECOMENDADO

### ANTES DA PALESTRA (15 min antes)
1. **Moderador:**
   - Acessar painel do moderador
   - Verificar status: "PLANEJADA"
   - Aguardar

2. **Telão:**
   - Abrir telão em fullscreen (F11)
   - Verificar se está na palestra correta
   - Deixar projetado (mostrará "Aguardando perguntas")

### INÍCIO DA PALESTRA
1. **Moderador clica em "Abrir Perguntas"**
2. **Participantes veem status mudar para "ABERTAS"**
3. Perguntas começam a chegar!

### DURANTE A PALESTRA
**Moderador faz:**
1. Aprovar perguntas relevantes
2. Recusar perguntas inadequadas/duplicadas
3. Exibir perguntas no telão
4. Marcar como respondida quando palestrante responder

**Palestrante:**
- Responde perguntas que aparecem no telão
- Avisa moderador quando terminar de responder

### QUANDO MUITAS PERGUNTAS
**Moderador pode:**
- Clicar em "Silêncio 60s" (bloqueia novos envios temporariamente)
- Focar em aprovar/exibir as pendentes

### FIM DO Q&A
1. **Moderador clica em "Fechar Perguntas"**
2. Participantes não podem mais enviar
3. Terminar de responder perguntas pendentes

### FIM DA PALESTRA
1. **Moderador clica em "Encerrar Palestra"**
2. **Moderador clica em "Exportar CSV"**
3. Salvar arquivo para registro

---

## 📱 DISTRIBUIÇÃO DOS QR CODES

### Opção 1: Impressos nas Mesas
```
┌─────────────────┐
│   📱 [QR CODE]  │
│                 │
│  Envie sua      │
│  pergunta!      │
│                 │
│  Escaneie o     │
│  código acima   │
└─────────────────┘
```
**Tamanho:** A6 ou A7  
**Onde:** Uma por mesa ou cadeira  
**Quando:** Colocar antes dos participantes chegarem

### Opção 2: Slide Inicial
- Exibir QR Code no telão ANTES da palestra começar
- Participantes escaneiam enquanto aguardam

### Opção 3: Link Curto
- Use um encurtador (bit.ly, tinyurl)
- Exemplo: `bit.ly/cnv-sala-a`
- Mais fácil de digitar

---

## 👥 EQUIPE RECOMENDADA

### Por Sala:
- **1 Moderador:** Fica no painel o tempo todo
- **1 Backup:** Conhece o sistema (se moderador precisar sair)
- **1 Técnico:** Monitora projetor/internet

### Geral:
- **1 Coordenador:** Supervisiona todas as salas
- **Suporte TI:** Resolve problemas técnicos

---

## 🚨 PROBLEMAS COMUNS E SOLUÇÕES

### "Não consigo enviar pergunta"
**Possíveis causas:**
1. Perguntas fechadas → Moderador deve abrir
2. Silêncio ativo → Aguardar 60s
3. Limite de 3 perguntas atingido → Normal
4. Rate limit (60s) → Aguardar

**Solução:** Avisar para aguardar ou verificar status

### "Pergunta não aparece no telão"
**Causa:** Moderador não exibiu ainda  
**Solução:** Perguntas precisam ser aprovadas E exibidas

### "Telão não atualiza"
**Causas:**
1. Internet caiu → Reconectar
2. Página travou → F5 para recarregar
3. Realtime desconectado → Verificar Supabase

### "Muitas perguntas duplicadas"
**Solução:** Moderador pode:
1. Recusar duplicadas
2. Avisar no telão: "Não repetir perguntas"

### "Internet lenta"
**Soluções:**
1. Usar cabo ethernet (não Wi-Fi) para moderador/telão
2. Pedir para participantes desligarem vídeos
3. Ativar "Silêncio" temporariamente

---

## 💡 DICAS PRÓ

### Para Moderadores
✅ Aprovar rápido (não ler tudo, só verificar se é adequado)  
✅ Priorizar perguntas curtas e claras  
✅ Mesclar perguntas similares mentalmente  
✅ Usar "Silêncio" se ficar sobrecarregado  

### Para Palestrantes
✅ Avisar no início: "Enviem perguntas pelo QR Code"  
✅ Reservar 10-15 min para Q&A  
✅ Responder objetivamente  
✅ Agradecer a pergunta antes de responder  

### Para Participantes
✅ Perguntas curtas (≤140 chars)  
✅ Sem links  
✅ Perguntar uma coisa por vez  
✅ Aguardar aprovação (pode demorar 1-2 min)  

---

## 📊 MÉTRICAS PÓS-EVENTO

Após o evento, você pode analisar:
- Total de perguntas por palestra
- Taxa de aprovação
- Perguntas respondidas vs recusadas
- Horário de pico de perguntas
- Palestras com mais engajamento

**Como ver:** Exporte o CSV e analise no Excel/Google Sheets

---

## 🎬 ROTEIRO DE ABERTURA

**Sugestão de anúncio no início:**

> "Olá! Durante a palestra, vocês podem enviar perguntas em tempo real.  
> Escaneiem o QR Code na mesa ou acessem [LINK].  
> As perguntas aprovadas aparecerão neste telão.  
> Limite de 3 perguntas por pessoa.  
> Vamos lá!"

---

## ✅ CHECKLIST FINAL

### Antes de cada palestra:
- [ ] Telão aberto e projetado
- [ ] Moderador logado no painel
- [ ] Status da palestra: "ABERTA"
- [ ] QR Codes visíveis
- [ ] Internet testada

### Durante:
- [ ] Moderador atento às novas perguntas
- [ ] Perguntas sendo exibidas regularmente
- [ ] Palestrante respondendo

### Depois:
- [ ] Fechar perguntas
- [ ] Encerrar palestra
- [ ] Exportar CSV
- [ ] Limpar telão para próxima palestra

---

**BOA SORTE NO SEU EVENTO! 🎉**

Qualquer problema, respire fundo e resolva com calma.  
O sistema é simples e resiliente! 💪
