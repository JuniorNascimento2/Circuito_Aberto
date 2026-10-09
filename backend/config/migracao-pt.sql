-- =============================================================================
--  Circuito Aberto — Migração para nomes em português
--
--  Use este arquivo se você JÁ TEM dados no banco antigo e quer preservá-los.
--  Se for começar do zero, ignore este arquivo e rode apenas "esquema.sql".
--
--  COMO USAR
--  1. Faça um backup antes (sério, leva 10 segundos):
--       mysqldump -u root -p NOME_DO_BANCO_ANTIGO > backup.sql
--  2. Troque "nexus" na linha USE abaixo pelo nome real do seu banco.
--  3. Rode:
--       mysql -u root -p < migracao-pt.sql
--  4. Ajuste DB_NAME no .env para o nome do banco que você está usando.
--
--  O script é seguro de rodar em um banco já migrado? NÃO. Rode uma vez só.
-- =============================================================================

USE nexus;   -- <<< TROQUE pelo nome do seu banco atual

SET FOREIGN_KEY_CHECKS = 0;

-- ── 1. Renomeia as tabelas ──────────────────────────────────────────────────
RENAME TABLE
  users            TO usuarios,
  projects         TO projetos,
  project_likes    TO projeto_curtidas,
  project_copies   TO projeto_copias,
  project_comments TO projeto_comentarios,
  comment_likes    TO comentario_curtidas,
  tags             TO etiquetas,
  project_tags     TO projeto_etiquetas,
  notifications    TO notificacoes,
  saved_projects   TO projetos_salvos,
  project_views    TO projeto_visualizacoes;

-- ── 2. Colunas ─────────────────────────────────────────────────────────────
--
-- Usamos RENAME COLUMN (e não CHANGE COLUMN) de propósito, por dois motivos:
--   1. CHANGE COLUMN exige redeclarar o tipo. Se o seu banco tiver algum tipo
--      levemente diferente do esperado, ele seria sobrescrito sem aviso.
--   2. Renomear com CHANGE uma coluna que participa de chave estrangeira falha
--      com "ALGORITHM=COPY is not supported" no MariaDB.
-- RENAME COLUMN só troca o nome, preservando tipo, default e as FKs.
--
-- Requer MySQL 8.0+ ou MariaDB 10.5.2+. Para versões anteriores, veja a nota
-- no fim deste arquivo.

ALTER TABLE usuarios
  RENAME COLUMN username            TO nome_usuario,
  RENAME COLUMN password_hash       TO senha_hash,
  RENAME COLUMN bio                 TO biografia,
  RENAME COLUMN avatar_url          TO url_avatar,
  RENAME COLUMN reset_token         TO token_redefinicao,
  RENAME COLUMN reset_token_expires TO token_redefinicao_expira,
  RENAME COLUMN created_at          TO criado_em;

ALTER TABLE projetos
  RENAME COLUMN user_id      TO usuario_id,
  RENAME COLUMN title        TO titulo,
  RENAME COLUMN description  TO descricao,
  RENAME COLUMN platform     TO plataforma,
  RENAME COLUMN difficulty   TO dificuldade,
  RENAME COLUMN materials    TO materiais,
  RENAME COLUMN code         TO codigo,
  RENAME COLUMN image_url    TO url_imagem,
  RENAME COLUMN likes_count  TO total_curtidas,
  RENAME COLUMN copies_count TO total_copias,
  RENAME COLUMN views_count  TO total_visualizacoes,
  RENAME COLUMN created_at   TO criado_em;

ALTER TABLE projeto_curtidas
  RENAME COLUMN user_id TO usuario_id, RENAME COLUMN project_id TO projeto_id,
  RENAME COLUMN created_at TO criado_em;

ALTER TABLE projeto_copias
  RENAME COLUMN user_id TO usuario_id, RENAME COLUMN project_id TO projeto_id,
  RENAME COLUMN created_at TO criado_em;

ALTER TABLE projetos_salvos
  RENAME COLUMN user_id TO usuario_id, RENAME COLUMN project_id TO projeto_id,
  RENAME COLUMN created_at TO criado_em;

ALTER TABLE projeto_visualizacoes
  RENAME COLUMN user_id TO usuario_id, RENAME COLUMN project_id TO projeto_id,
  RENAME COLUMN created_at TO criado_em;

ALTER TABLE projeto_comentarios
  RENAME COLUMN project_id TO projeto_id, RENAME COLUMN user_id TO usuario_id,
  RENAME COLUMN content TO conteudo, RENAME COLUMN created_at TO criado_em;

ALTER TABLE comentario_curtidas
  RENAME COLUMN user_id TO usuario_id, RENAME COLUMN comment_id TO comentario_id,
  RENAME COLUMN created_at TO criado_em;

ALTER TABLE etiquetas
  RENAME COLUMN name TO nome;

ALTER TABLE projeto_etiquetas
  RENAME COLUMN project_id TO projeto_id, RENAME COLUMN tag_id TO etiqueta_id;

ALTER TABLE notificacoes
  RENAME COLUMN user_id TO usuario_id, RENAME COLUMN actor_id TO autor_id,
  RENAME COLUMN project_id TO projeto_id, RENAME COLUMN read_at TO lida_em,
  RENAME COLUMN created_at TO criado_em, RENAME COLUMN type TO tipo;

-- ── 3. Valores do ENUM de notificação ──────────────────────────────────────
-- Aqui o tipo muda de verdade, então usamos MODIFY. A coluna "tipo" não
-- participa de nenhuma chave estrangeira, então não há o problema acima.

-- Abre o ENUM para aceitar os dois conjuntos de valores ao mesmo tempo...
ALTER TABLE notificacoes
  MODIFY COLUMN tipo
  ENUM('like','copy','comment','comment_like',
       'curtida','copia','comentario','curtida_comentario') NOT NULL;

-- ...traduz as linhas existentes...
UPDATE notificacoes SET tipo = 'curtida'            WHERE tipo = 'like';
UPDATE notificacoes SET tipo = 'copia'              WHERE tipo = 'copy';
UPDATE notificacoes SET tipo = 'comentario'         WHERE tipo = 'comment';
UPDATE notificacoes SET tipo = 'curtida_comentario' WHERE tipo = 'comment_like';

-- ...e fecha o ENUM só nos valores em português.
ALTER TABLE notificacoes
  MODIFY COLUMN tipo
  ENUM('curtida','copia','comentario','curtida_comentario') NOT NULL;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
--  MySQL 5.7 ou MariaDB anterior à 10.5.2?
--  Essas versões não têm RENAME COLUMN. Nesse caso troque cada linha
--     RENAME COLUMN antigo TO novo
--  por
--     CHANGE COLUMN antigo novo <TIPO EXATO DA COLUNA>
--  copiando o tipo exato de "SHOW CREATE TABLE <tabela>", e adicione
--  ", ALGORITHM=INPLACE" ao fim dos ALTER que mexem em colunas de FK.
-- =============================================================================

-- =============================================================================
--  OPCIONAL: renomear o próprio banco para "circuito_aberto"
--
--  O MySQL não tem RENAME DATABASE. O caminho seguro é dump + restore,
--  rodado no terminal (NÃO dentro deste arquivo), depois da migração acima:
--
--    mysqldump -u root -p nexus > migrado.sql
--    mysql -u root -p -e "CREATE DATABASE circuito_aberto \
--      CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
--    mysql -u root -p circuito_aberto < migrado.sql
--    mysql -u root -p -e "DROP DATABASE nexus;"
--
--  Se preferir, pode simplesmente manter o nome antigo do banco e apontar
--  DB_NAME no .env para ele. Nada mais no código depende disso.
-- =============================================================================
