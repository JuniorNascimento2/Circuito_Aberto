#!/bin/bash
# Testa migracao-pt.sql: cria o banco ANTIGO com dados, migra, e confere se
# nada se perdeu e se a aplicação nova funciona em cima do banco migrado.
set -u
BACK=/home/claude/saida/circuito_aberto/backend
ANTIGO="proj_antigo"
falhas=0

verificar() {
  if [ "$2" = "$3" ]; then printf "  ✅ %-44s %s\n" "$1" "$3"
  else printf "  ❌ %-44s esperado=%s obtido=%s\n" "$1" "$2" "$3"; falhas=$((falhas+1)); fi
}

for p in mariadbd node; do pkill -9 -x $p 2>/dev/null; done; sleep 2
mariadbd --user=mysql --datadir=/var/lib/mysql --socket=/run/mysqld/mysqld.sock \
         --log-error=/tmp/m.log --port=3306 >/dev/null 2>&1 &
for i in $(seq 1 40); do mysqladmin ping >/dev/null 2>&1 && break; sleep 1; done

echo "═══ 1. CRIANDO O BANCO ANTIGO (esquema em inglês) ═══"
mysql -u root -e "DROP DATABASE IF EXISTS $ANTIGO; CREATE DATABASE $ANTIGO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root --default-character-set=utf8mb4 "$ANTIGO" <<'SQL'
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  bio TEXT, avatar_url VARCHAR(255),
  reset_token VARCHAR(500) DEFAULT NULL,
  reset_token_expires DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE projects (
  id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL,
  title VARCHAR(200) NOT NULL, description TEXT NOT NULL,
  platform VARCHAR(50) NOT NULL,
  difficulty ENUM('Iniciante','Intermediário','Avançado') DEFAULT 'Iniciante',
  materials TEXT, code TEXT, image_url VARCHAR(255),
  likes_count INT DEFAULT 0, copies_count INT DEFAULT 0, views_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE project_likes (user_id INT, project_id INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, project_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE);
CREATE TABLE project_copies (user_id INT, project_id INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, project_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE);
CREATE TABLE project_comments (id INT AUTO_INCREMENT PRIMARY KEY, project_id INT NOT NULL,
  user_id INT NOT NULL, content TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE comment_likes (user_id INT, comment_id INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, comment_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (comment_id) REFERENCES project_comments(id) ON DELETE CASCADE);
CREATE TABLE tags (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(50) NOT NULL UNIQUE);
CREATE TABLE project_tags (project_id INT, tag_id INT, PRIMARY KEY (project_id, tag_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE);
CREATE TABLE notifications (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL,
  type ENUM('like','copy','comment','comment_like') NOT NULL, actor_id INT NOT NULL,
  project_id INT NOT NULL, read_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE);
CREATE TABLE saved_projects (user_id INT, project_id INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, project_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE);
CREATE TABLE project_views (user_id INT, project_id INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, project_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE);

-- Dados de teste (senha = "senha123", hash bcrypt real)
INSERT INTO users (username,email,password_hash,bio) VALUES
 ('joao','joao@teste.com','$2a$10$FJpb6Fudtfngk9uHHHdciegdPheoCOLVkZgSWitPS55X475ocZzrm','Maker do RN'),
 ('maria','maria@teste.com','$2a$10$FJpb6Fudtfngk9uHHHdciegdPheoCOLVkZgSWitPS55X475ocZzrm','Estudante');
INSERT INTO projects (user_id,title,description,platform,difficulty,materials,code,image_url,likes_count,copies_count,views_count) VALUES
 (1,'Semáforo Inteligente','Controla trânsito com sensores','Arduino Uno','Iniciante','3x LED','void setup(){}','/uploads/foto1.png',1,1,5),
 (2,'Estação Meteorológica','Mede temperatura e umidade','ESP32','Avançado','1x DHT22','void loop(){}','/uploads/foto2.png',0,0,2);
INSERT INTO project_likes (user_id,project_id) VALUES (2,1);
INSERT INTO project_copies (user_id,project_id) VALUES (2,1);
INSERT INTO project_comments (project_id,user_id,content) VALUES (1,2,'Ficou ótimo!');
INSERT INTO comment_likes (user_id,comment_id) VALUES (1,1);
INSERT INTO tags (name) VALUES ('led'),('sensor'),('iot');
INSERT INTO project_tags (project_id,tag_id) VALUES (1,1),(1,2),(2,3);
INSERT INTO notifications (user_id,type,actor_id,project_id) VALUES
 (1,'like',2,1),(1,'copy',2,1),(1,'comment',2,1),(2,'comment_like',1,1);
INSERT INTO saved_projects (user_id,project_id) VALUES (1,2);
INSERT INTO project_views (user_id,project_id) VALUES (2,1),(1,2);
SQL
echo "  ✅ banco antigo criado com dados de teste"
ANTES_U=$(mysql -u root --default-character-set=utf8mb4 -N -e "SELECT COUNT(*) FROM $ANTIGO.users;")
ANTES_P=$(mysql -u root --default-character-set=utf8mb4 -N -e "SELECT COUNT(*) FROM $ANTIGO.projects;")
ANTES_N=$(mysql -u root --default-character-set=utf8mb4 -N -e "SELECT COUNT(*) FROM $ANTIGO.notifications;")
echo "  antes: $ANTES_U usuários, $ANTES_P projetos, $ANTES_N notificações"

echo ""
echo "═══ 2. RODANDO A MIGRAÇÃO ═══"
sed "s/^USE nexus;.*/USE $ANTIGO;/" "$BACK/config/migracao-pt.sql" > /tmp/mig.sql
if mysql -u root < /tmp/mig.sql 2>/tmp/mig-err.log; then
  echo "  ✅ migracao-pt.sql executou sem erros"
else
  echo "  ❌ migração falhou:"; cat /tmp/mig-err.log; falhas=$((falhas+1))
fi

echo ""
echo "═══ 2b. APLICANDO SCRIPTS INCREMENTAIS (admin, montagem, log/denúncias) ═══"
# Simula o caminho real de upgrade de quem já tinha um banco migrado antes
# dessas features existirem — é exatamente essa sequência que vai no LEIAME.
# adicionar-motivo-banimento.sql NÃO entra aqui: ele só é necessário para quem
# rodou uma versão ANTIGA de adicionar-admin.sql (sem banido_ate/motivo_banimento);
# a versão atual de adicionar-admin.sql já inclui essas colunas.
for script in adicionar-admin.sql adicionar-montagem.sql adicionar-log-denuncias.sql adicionar-arquivamento.sql; do
  sed "s/^USE circuito_aberto;.*/USE $ANTIGO;/" "$BACK/config/$script" > /tmp/inc.sql
  if mysql -u root < /tmp/inc.sql 2>/tmp/inc-err.log; then
    echo "  ✅ $script executou sem erros"
  else
    echo "  ❌ $script falhou:"; cat /tmp/inc-err.log; falhas=$((falhas+1))
  fi
done

echo ""
echo "═══ 3. CONFERINDO A ESTRUTURA ═══"
verificar "11 tabelas em português" "11" \
  "$(mysql -u root --default-character-set=utf8mb4 -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$ANTIGO' AND table_name IN ('usuarios','projetos','projeto_curtidas','projeto_copias','projeto_comentarios','comentario_curtidas','etiquetas','projeto_etiquetas','notificacoes','projetos_salvos','projeto_visualizacoes');")"
verificar "nenhuma tabela em inglês sobrou" "0" \
  "$(mysql -u root --default-character-set=utf8mb4 -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$ANTIGO' AND table_name IN ('users','projects','project_likes','project_copies','project_comments','comment_likes','tags','project_tags','notifications','saved_projects','project_views');")"
verificar "nenhuma coluna em inglês sobrou" "0" \
  "$(mysql -u root --default-character-set=utf8mb4 -N -e "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='$ANTIGO' AND column_name IN ('username','password_hash','bio','avatar_url','user_id','project_id','title','description','platform','difficulty','materials','code','image_url','likes_count','copies_count','views_count','created_at','content','name','tag_id','type','actor_id','read_at','comment_id','reset_token','reset_token_expires');")"

echo ""
echo "═══ 4. CONFERINDO OS DADOS ═══"
verificar "usuários preservados" "$ANTES_U" "$(mysql -u root --default-character-set=utf8mb4 -N -e "SELECT COUNT(*) FROM $ANTIGO.usuarios;")"
verificar "projetos preservados" "$ANTES_P" "$(mysql -u root --default-character-set=utf8mb4 -N -e "SELECT COUNT(*) FROM $ANTIGO.projetos;")"
verificar "notificações preservadas" "$ANTES_N" "$(mysql -u root --default-character-set=utf8mb4 -N -e "SELECT COUNT(*) FROM $ANTIGO.notificacoes;")"
verificar "título com acento intacto" "Semáforo Inteligente" "$(mysql -u root --default-character-set=utf8mb4 -N -e "SELECT titulo FROM $ANTIGO.projetos WHERE id=1;")"
verificar "bio preservada" "Maker do RN" "$(mysql -u root --default-character-set=utf8mb4 -N -e "SELECT biografia FROM $ANTIGO.usuarios WHERE id=1;")"
verificar "hash da senha intacto" "1" "$(mysql -u root --default-character-set=utf8mb4 -N -e "SELECT COUNT(*) FROM $ANTIGO.usuarios WHERE id=1 AND senha_hash LIKE '\$2%';")"
verificar "contadores preservados" "1|1|5" "$(mysql -u root --default-character-set=utf8mb4 -N -e "SELECT CONCAT(total_curtidas,'|',total_copias,'|',total_visualizacoes) FROM $ANTIGO.projetos WHERE id=1;")"
verificar "url da imagem intacta" "/uploads/foto1.png" "$(mysql -u root --default-character-set=utf8mb4 -N -e "SELECT url_imagem FROM $ANTIGO.projetos WHERE id=1;")"
verificar "dificuldade ENUM preservada" "Avançado" "$(mysql -u root --default-character-set=utf8mb4 -N -e "SELECT dificuldade FROM $ANTIGO.projetos WHERE id=2;")"
verificar "comentário preservado" "Ficou ótimo!" "$(mysql -u root --default-character-set=utf8mb4 -N -e "SELECT conteudo FROM $ANTIGO.projeto_comentarios WHERE id=1;")"
verificar "etiquetas preservadas" "iot,led,sensor" "$(mysql -u root --default-character-set=utf8mb4 -N -e "SELECT GROUP_CONCAT(nome ORDER BY nome) FROM $ANTIGO.etiquetas;")"
verificar "vínculo projeto-etiqueta" "3" "$(mysql -u root --default-character-set=utf8mb4 -N -e "SELECT COUNT(*) FROM $ANTIGO.projeto_etiquetas;")"

echo ""
echo "═══ 5. ENUM DE NOTIFICAÇÃO TRADUZIDO ═══"
verificar "valores traduzidos" "curtida,copia,comentario,curtida_comentario" \
  "$(mysql -u root --default-character-set=utf8mb4 -N -e "SELECT GROUP_CONCAT(DISTINCT tipo ORDER BY tipo) FROM $ANTIGO.notificacoes;")"
verificar "ENUM aceita só português" "0" \
  "$(mysql -u root --default-character-set=utf8mb4 -N -e "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='$ANTIGO' AND table_name='notificacoes' AND column_type LIKE '%like%';")"
verificar "curtida veio de 'like'" "1" \
  "$(mysql -u root --default-character-set=utf8mb4 -N -e "SELECT COUNT(*) FROM $ANTIGO.notificacoes WHERE tipo='curtida' AND usuario_id=1 AND autor_id=2;")"

echo ""
echo "═══ 6. APLICAÇÃO NOVA RODANDO NO BANCO MIGRADO ═══"
cd "$BACK"
DB_NAME=$ANTIGO DB_USER=teste DB_PASSWORD=teste123 DB_HOST=127.0.0.1 \
  JWT_SECRET=chave_teste PORT=4000 LIMITE_GERAL=99999 LIMITE_AUTENTICACAO=9999 \
  node servidor.js > /tmp/srv-mig.log 2>&1 &
for i in $(seq 1 25); do curl -s localhost:4000/api/saude >/dev/null 2>&1 && break; sleep 1; done
API=http://localhost:4000/api
TOK=$(curl -s -X POST "$API/autenticacao/entrar" -H 'Content-Type: application/json' \
  -d '{"email":"joao@teste.com","senha":"senha123"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))")
verificar "login com usuário antigo funciona" "sim" "$([ -n "$TOK" ] && echo sim || echo nao)"
AU="Authorization: Bearer $TOK"
verificar "lista os 2 projetos antigos" "2" \
  "$(curl -s "$API/projetos" -H "$AU" | python3 -c "import sys,json;print(json.load(sys.stdin).get('total'))")"
verificar "projeto antigo traz etiquetas" "led,sensor" \
  "$(curl -s "$API/projetos/1" -H "$AU" | python3 -c "import sys,json;print(','.join(sorted(json.load(sys.stdin).get('etiquetas',[]))))")"
verificar "comentário antigo aparece" "Ficou ótimo!" \
  "$(curl -s "$API/projetos/1/comentarios" -H "$AU" | python3 -c "import sys,json;print(json.load(sys.stdin)[0]['conteudo'])")"
verificar "título com acento via API" "Semáforo Inteligente" \
  "$(curl -s "$API/projetos/1" -H "$AU" | python3 -c "import sys,json;print(json.load(sys.stdin)['titulo'])")"
verificar "curtida antiga reconhecida" "1" \
  "$(curl -s "$API/projetos/1" -H "$AU" | python3 -c "import sys,json;print(json.load(sys.stdin)['total_curtidas'])")"
verificar "projeto salvo antigo aparece" "1" \
  "$(curl -s "$API/salvos" -H "$AU" | python3 -c "import sys,json;print(json.load(sys.stdin)['total'])")"
verificar "notificações antigas aparecem" "3" \
  "$(curl -s "$API/notificacoes" -H "$AU" | python3 -c "import sys,json;print(len(json.load(sys.stdin)))")"
verificar "estatísticas do usuário antigo" "1" \
  "$(curl -s "$API/minhas-estatisticas" -H "$AU" | python3 -c "import sys,json;print(json.load(sys.stdin)['totais']['total_projetos'])")"

echo ""
echo "════════════════════════════════════════════════════════════"
if [ "$falhas" -eq 0 ]; then echo "✅ MIGRAÇÃO VALIDADA — TODOS OS TESTES PASSARAM"
else echo "❌ $falhas TESTE(S) FALHARAM"; tail -20 /tmp/srv-mig.log; fi
for p in node mariadbd; do pkill -9 -x $p 2>/dev/null; done
exit 0
