-- =============================================================================
--  Circuito Aberto — Log de auditoria + sistema de denúncias
--
--  Rode este arquivo UMA VEZ no seu banco já existente para habilitar:
--   1) o log de ações de administrador (quem baniu/promoveu/removeu o quê)
--   2) o sistema de denúncias (aluno reporta projeto ou comentário)
--
--  Exige que "adicionar-admin.sql" já tenha sido rodado antes (precisa da
--  coluna "papel" em usuarios). Se você está instalando o projeto do zero
--  agora, NÃO precisa deste arquivo — o esquema.sql já vem com tudo.
-- =============================================================================

USE circuito_aberto;   -- troque se o seu banco tiver outro nome

CREATE TABLE IF NOT EXISTS log_admin (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  admin_id    INT NULL,
  admin_nome  VARCHAR(50) NOT NULL,
  acao        VARCHAR(50) NOT NULL,
  alvo_tipo   VARCHAR(30) NOT NULL,
  alvo_id     INT NOT NULL,
  alvo_desc   VARCHAR(255),
  detalhes    TEXT,
  criado_em   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS denuncias (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  denunciante_id INT NOT NULL,
  alvo_tipo      ENUM('projeto','comentario') NOT NULL,
  alvo_id        INT NOT NULL,
  motivo         TEXT NOT NULL,
  status         ENUM('pendente','resolvida','ignorada') NOT NULL DEFAULT 'pendente',
  resolvida_por  INT NULL,
  resolvida_em   DATETIME NULL,
  criado_em      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (denunciante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (resolvida_por)  REFERENCES usuarios(id) ON DELETE SET NULL
);
