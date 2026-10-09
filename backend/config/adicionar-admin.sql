-- =============================================================================
--  Circuito Aberto — Adicionar papel de administrador (admin/master)
--
--  Rode este arquivo UMA VEZ no seu banco já existente para habilitar o
--  sistema de moderação (admin, banimento de contas).
--
--  Depois de rodar, promova você mesmo a admin com o UPDATE no final deste
--  arquivo (troque o e-mail pelo seu).
-- =============================================================================

USE circuito_aberto;   -- troque se o seu banco tiver outro nome

ALTER TABLE usuarios
  ADD COLUMN papel            ENUM('comum','admin') NOT NULL DEFAULT 'comum' AFTER senha_hash,
  ADD COLUMN banido_em        DATETIME DEFAULT NULL AFTER papel,
  ADD COLUMN banido_ate       DATETIME DEFAULT NULL AFTER banido_em,
  ADD COLUMN motivo_banimento TEXT     DEFAULT NULL AFTER banido_ate;

-- ── Promova o primeiro admin (master) ────────────────────────────────────────
-- Troque o e-mail abaixo pelo e-mail da conta que vai virar admin,
-- descomente a linha e rode só ela.

-- UPDATE usuarios SET papel = 'admin' WHERE email = 'seuemail@exemplo.com';

-- Para conferir quem é admin no seu banco:
-- SELECT id, nome_usuario, email, papel FROM usuarios WHERE papel = 'admin';
