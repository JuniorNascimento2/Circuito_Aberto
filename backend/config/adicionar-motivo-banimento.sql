-- =============================================================================
--  Circuito Aberto — Banimento temporário + motivo
--
--  Rode este arquivo se você JÁ tinha rodado "adicionar-admin.sql" antes
--  (ou seja, sua tabela "usuarios" já tem as colunas "papel" e "banido_em",
--  mas ainda não tem "banido_ate" e "motivo_banimento").
--
--  Se você está instalando o projeto do zero agora, NÃO precisa deste
--  arquivo — o esquema.sql já vem com tudo.
-- =============================================================================

USE circuito_aberto;   -- troque se o seu banco tiver outro nome

ALTER TABLE usuarios
  ADD COLUMN banido_ate       DATETIME DEFAULT NULL AFTER banido_em,
  ADD COLUMN motivo_banimento TEXT     DEFAULT NULL AFTER banido_ate;
