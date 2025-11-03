-- =====================================================
-- CNV 2025 - SCRIPT DE CRIAÇÃO DO BANCO DE DADOS
-- =====================================================
-- Execute este script no SQL Editor do Supabase
-- VERSÃO COM PREFIXO: cnv25_
-- =====================================================

-- 1) Tabela de Palestras
CREATE TABLE IF NOT EXISTS cnv25_palestras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sala TEXT NOT NULL,
  titulo TEXT NOT NULL,
  inicio TIMESTAMPTZ NOT NULL,
  fim TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('planejada','aberta','fechada','encerrada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Tabela de Flags (controle de silêncio)
CREATE TABLE IF NOT EXISTS cnv25_palestras_flags (
  palestra_id UUID PRIMARY KEY REFERENCES cnv25_palestras(id) ON DELETE CASCADE,
  silencio_ate TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3) Tabela de Perguntas
CREATE TABLE IF NOT EXISTS cnv25_perguntas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  palestra_id UUID NOT NULL REFERENCES cnv25_palestras(id) ON DELETE CASCADE,
  texto VARCHAR(140) NOT NULL,
  nome_opt VARCHAR(80),
  anonimo BOOLEAN NOT NULL DEFAULT TRUE,
  device_id_hash TEXT NOT NULL,
  nonce TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pendente','aprovada','exibida','respondida','recusada')),
  motivo_recusa TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exibida_em TIMESTAMPTZ,
  respondida_em TIMESTAMPTZ
);

-- 4) Tabela de Log de Moderação
CREATE TABLE IF NOT EXISTS cnv25_moderacoes_log (
  id BIGSERIAL PRIMARY KEY,
  palestra_id UUID NOT NULL REFERENCES cnv25_palestras(id) ON DELETE CASCADE,
  pergunta_id UUID REFERENCES cnv25_perguntas(id) ON DELETE SET NULL,
  ator TEXT NOT NULL,
  acao TEXT NOT NULL,
  detalhe TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5) Índices para performance
CREATE INDEX IF NOT EXISTS idx_cnv25_perguntas_palestra_status ON cnv25_perguntas (palestra_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_cnv25_perguntas_device_palestra ON cnv25_perguntas (device_id_hash, palestra_id);
CREATE INDEX IF NOT EXISTS idx_cnv25_moderacoes_palestra ON cnv25_moderacoes_log (palestra_id, created_at);

-- 6) Inserir dados de exemplo (OPCIONAL - para testes)
INSERT INTO cnv25_palestras (sala, titulo, inicio, fim, status) VALUES
  ('A', 'Inovação em Tecnologia 2025', NOW(), NOW() + INTERVAL '2 hours', 'aberta'),
  ('B', 'Futuro da IA no Brasil', NOW() + INTERVAL '2 hours', NOW() + INTERVAL '4 hours', 'planejada');

-- 7) IMPORTANTE: Habilitar Realtime
-- Após executar este script, vá em:
-- Database → Replication → Enable Realtime para as tabelas:
-- ✓ cnv25_palestras
-- ✓ cnv25_perguntas  
-- ✓ cnv25_palestras_flags

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================
-- Próximos passos:
-- 1. Copie suas credenciais do Supabase
-- 2. Cole no arquivo js/supabase-config.js
-- 3. ⚠️ IMPORTANTE: Atualize os nomes das tabelas no código JavaScript
-- 4. Abra index.html no navegador
-- =====================================================
