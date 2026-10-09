-- =============================================================================
--  Circuito Aberto — Adicionar arquivamento de projetos
--
--  Rode este arquivo UMA VEZ no seu banco já existente para habilitar o
--  botão "Arquivar" no painel admin (esconde o projeto da plataforma sem
--  excluí-lo — diferente de "Remover", que é permanente).
--
--  Se você está instalando o projeto do zero agora, NÃO precisa deste
--  arquivo — o esquema.sql já vem com a coluna.
-- =============================================================================

USE circuito_aberto;   -- troque se o seu banco tiver outro nome

ALTER TABLE projetos
  ADD COLUMN arquivado TINYINT(1) NOT NULL DEFAULT 0 AFTER total_visualizacoes;
