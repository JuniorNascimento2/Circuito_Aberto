-- =============================================================================
--  Circuito Aberto — Adicionar campo de instruções de montagem
--
--  Rode este arquivo UMA VEZ no seu banco já existente para habilitar o
--  campo de montagem (passo a passo de conexão dos componentes) nos projetos.
--
--  Se você está instalando o projeto do zero agora, NÃO precisa deste
--  arquivo — o esquema.sql já vem com a coluna.
-- =============================================================================

USE circuito_aberto;   -- troque se o seu banco tiver outro nome

ALTER TABLE projetos
  ADD COLUMN montagem TEXT DEFAULT NULL AFTER materiais;
