-- =============================================================================
--  Circuito Aberto — Esquema do banco de dados
--  Rode este arquivo para criar o banco do ZERO.
--  Se você já tem dados e quer apenas renomear, use "migracao-pt.sql".
-- =============================================================================

CREATE DATABASE IF NOT EXISTS circuito_aberto
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE circuito_aberto;

-- ── Usuários ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  nome_usuario            VARCHAR(50)  NOT NULL UNIQUE,
  email                   VARCHAR(150) NOT NULL UNIQUE,
  senha_hash              VARCHAR(255) NOT NULL,
  papel                   ENUM('comum','admin') NOT NULL DEFAULT 'comum',
  banido_em               DATETIME     DEFAULT NULL,
  banido_ate              DATETIME     DEFAULT NULL,
  motivo_banimento        TEXT,
  biografia               TEXT,
  url_avatar              VARCHAR(255),
  token_redefinicao       VARCHAR(500) DEFAULT NULL,
  token_redefinicao_expira DATETIME    DEFAULT NULL,
  criado_em               TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ── Projetos ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projetos (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id            INT NOT NULL,
  titulo                VARCHAR(200) NOT NULL,
  descricao             TEXT NOT NULL,
  plataforma            VARCHAR(50) NOT NULL,
  dificuldade           ENUM('Iniciante','Intermediário','Avançado') DEFAULT 'Iniciante',
  materiais             TEXT,
  montagem              TEXT,
  codigo                TEXT,
  url_imagem            VARCHAR(255),
  total_curtidas        INT DEFAULT 0,
  total_copias          INT DEFAULT 0,
  total_visualizacoes   INT DEFAULT 0,
  arquivado             TINYINT(1) NOT NULL DEFAULT 0,
  criado_em             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- ── Curtidas em projetos ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projeto_curtidas (
  usuario_id INT NOT NULL,
  projeto_id INT NOT NULL,
  criado_em  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, projeto_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE
);

-- ── Cópias de projetos ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projeto_copias (
  usuario_id INT NOT NULL,
  projeto_id INT NOT NULL,
  criado_em  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, projeto_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE
);

-- ── Comentários nos projetos ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projeto_comentarios (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  projeto_id INT NOT NULL,
  usuario_id INT NOT NULL,
  conteudo   TEXT NOT NULL,
  criado_em  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- ── Curtidas em comentários ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comentario_curtidas (
  usuario_id    INT NOT NULL,
  comentario_id INT NOT NULL,
  criado_em     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, comentario_id),
  FOREIGN KEY (usuario_id)    REFERENCES usuarios(id)            ON DELETE CASCADE,
  FOREIGN KEY (comentario_id) REFERENCES projeto_comentarios(id) ON DELETE CASCADE
);

-- ── Etiquetas (tags) ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS etiquetas (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS projeto_etiquetas (
  projeto_id  INT NOT NULL,
  etiqueta_id INT NOT NULL,
  PRIMARY KEY (projeto_id, etiqueta_id),
  FOREIGN KEY (projeto_id)  REFERENCES projetos(id)  ON DELETE CASCADE,
  FOREIGN KEY (etiqueta_id) REFERENCES etiquetas(id) ON DELETE CASCADE
);

-- ── Notificações ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notificacoes (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  tipo       ENUM('curtida','copia','comentario','curtida_comentario') NOT NULL,
  autor_id   INT NOT NULL,
  projeto_id INT NOT NULL,
  lida_em    DATETIME DEFAULT NULL,
  criado_em  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (autor_id)   REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE
);

-- ── Projetos salvos ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projetos_salvos (
  usuario_id INT NOT NULL,
  projeto_id INT NOT NULL,
  criado_em  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, projeto_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE
);

-- ── Visualizações únicas por usuário ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projeto_visualizacoes (
  usuario_id INT NOT NULL,
  projeto_id INT NOT NULL,
  criado_em  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, projeto_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE
);

-- ── Log de auditoria (ações de admin) ───────────────────────────────────────
-- Registra quem fez o quê: banir/desbanir, promover/rebaixar, remover projeto
-- ou comentário como admin, e resolução de denúncias. O admin_id não tem
-- ON DELETE CASCADE proposital: se a conta do admin for removida no futuro,
-- o registro histórico da ação continua existindo (SET NULL), já que o log
-- existe justamente para consulta posterior.
CREATE TABLE IF NOT EXISTS log_admin (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  admin_id    INT NULL,
  admin_nome  VARCHAR(50) NOT NULL, -- nome do admin no momento da ação (histórico, sobrevive a rebaixamento/exclusão)
  acao        VARCHAR(50) NOT NULL, -- ex: 'banir', 'desbanir', 'promover', 'rebaixar', 'deletar_projeto', 'deletar_comentario', 'resolver_denuncia', 'ignorar_denuncia'
  alvo_tipo   VARCHAR(30) NOT NULL, -- 'usuario', 'projeto', 'comentario', 'denuncia'
  alvo_id     INT NOT NULL,
  alvo_desc   VARCHAR(255),         -- descrição legível do alvo no momento (nome de usuário, título do projeto, etc)
  detalhes    TEXT,                 -- ex: motivo do banimento, duração
  criado_em   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- ── Denúncias (aluno reporta projeto ou comentário) ─────────────────────────
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
