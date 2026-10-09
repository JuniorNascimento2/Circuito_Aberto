#!/bin/bash
# Teste end-to-end: sobe MariaDB, cria o esquema, sobe o servidor e exercita a API.
set -u
API=http://localhost:4000/api
BACK=/home/claude/saida/circuito_aberto/backend
falhas=0

verificar() { # verificar "descrição" "esperado" "obtido"
  if [ "$2" = "$3" ]; then
    printf "  ✅ %-46s %s\n" "$1" "$3"
  else
    printf "  ❌ %-46s esperado=%s obtido=%s\n" "$1" "$2" "$3"
    falhas=$((falhas+1))
  fi
}

# ── 1. Banco ────────────────────────────────────────────────────────────────
for proc in mariadbd mysqld_safe node; do pkill -9 -x "$proc" 2>/dev/null; done
rm -f /run/mysqld/mysqld.sock /run/mysqld/mysqld.pid
sleep 1
mariadbd --user=mysql --datadir=/var/lib/mysql --socket=/run/mysqld/mysqld.sock \
         --log-error=/tmp/mariadb-err.log --port=3306 > /dev/null 2>&1 &
for i in $(seq 1 45); do mysqladmin ping > /dev/null 2>&1 && break; sleep 1; done

echo "═══ 1. ESQUEMA DO BANCO ═══"
mysql -u root -e "DROP DATABASE IF EXISTS circuito_aberto;" 2>/dev/null
# O root do MariaDB autentica por socket unix; o driver do Node conecta por TCP.
# Por isso criamos um usuário comum só para o teste.
mysql -u root -e "CREATE USER IF NOT EXISTS 'teste'@'%' IDENTIFIED BY 'teste123';
                  CREATE USER IF NOT EXISTS 'teste'@'localhost' IDENTIFIED BY 'teste123';
                  GRANT ALL PRIVILEGES ON *.* TO 'teste'@'%';
                  GRANT ALL PRIVILEGES ON *.* TO 'teste'@'localhost';
                  FLUSH PRIVILEGES;" 2>/dev/null
if mysql -u root < "$BACK/config/esquema.sql" 2>/tmp/sql-err.log; then
  echo "  ✅ esquema.sql executou sem erros"
else
  echo "  ❌ esquema.sql falhou:"; cat /tmp/sql-err.log; exit 1
fi
tabelas=$(mysql -u root -N -e "USE circuito_aberto; SHOW TABLES;" | tr '\n' ' ')
echo "  Tabelas criadas: $tabelas"
verificar "total de tabelas" "13" "$(mysql -u root -N -e "USE circuito_aberto; SHOW TABLES;" | wc -l)"

# ── 2. Servidor ─────────────────────────────────────────────────────────────
echo ""
echo "═══ 2. SERVIDOR ═══"
cd "$BACK"
DB_NAME=circuito_aberto DB_USER=teste DB_PASSWORD=teste123 DB_HOST=127.0.0.1 JWT_SECRET=chave_de_teste_local \
  PORT=4000 LIMITE_GERAL=100000 LIMITE_AUTENTICACAO=10000 LIMITE_ACOES=10000 node servidor.js > /tmp/servidor.log 2>&1 &
for i in $(seq 1 25); do
  curl -s http://localhost:4000/api/saude > /dev/null 2>&1 && break; sleep 1
done
grep -q "Banco de dados conectado" /tmp/servidor.log \
  && echo "  ✅ conectou ao banco" || { echo "  ❌ não conectou:"; cat /tmp/servidor.log; }

# ── 3. Cadastro e login ─────────────────────────────────────────────────────
echo ""
echo "═══ 3. AUTENTICAÇÃO ═══"
RESP=$(curl -s -X POST "$API/autenticacao/cadastrar" -H 'Content-Type: application/json' \
  -d '{"nome_usuario":"maker_teste","email":"maker@teste.com","senha":"senha123"}')
TOKEN=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")
verificar "cadastro devolve token" "sim" "$([ -n "$TOKEN" ] && echo sim || echo "nao: $RESP")"
verificar "cadastro devolve nome_usuario" "maker_teste" \
  "$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('usuario',{}).get('nome_usuario',''))")"

RESP=$(curl -s -X POST "$API/autenticacao/entrar" -H 'Content-Type: application/json' \
  -d '{"email":"maker@teste.com","senha":"senha123"}')
TOKEN=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")
verificar "login devolve token" "sim" "$([ -n "$TOKEN" ] && echo sim || echo "nao: $RESP")"

RESP=$(curl -s -X POST "$API/autenticacao/entrar" -H 'Content-Type: application/json' \
  -d '{"email":"maker@teste.com","senha":"senha_errada"}')
verificar "senha errada é rejeitada" "Credenciais inválidas." \
  "$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('erro',''))")"

AUTH="Authorization: Bearer $TOKEN"

# ── 4. Criar projeto (multipart, com imagem) ────────────────────────────────
echo ""
echo "═══ 4. PROJETOS ═══"
printf '\x89PNG\r\n\x1a\n' > /tmp/teste.png
head -c 200 /dev/urandom >> /tmp/teste.png
RESP=$(curl -s -X POST "$API/projetos" -H "$AUTH" \
  -F "titulo=Semáforo com Arduino" \
  -F "descricao=Um semáforo automático usando LEDs e temporização." \
  -F "plataforma=Arduino Uno" \
  -F "dificuldade=Iniciante" \
  -F "materiais=1x Arduino Uno
3x LED" \
  -F "codigo=void setup() { pinMode(13, OUTPUT); }" \
  -F 'etiquetas=["led","semaforo"]' \
  -F "imagem=@/tmp/teste.png;type=image/png")
PROJ_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")
verificar "criar projeto devolve id" "sim" "$([ -n "$PROJ_ID" ] && echo sim || echo "nao: $RESP")"
verificar "projeto salva titulo" "Semáforo com Arduino" \
  "$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('titulo',''))")"
verificar "projeto salva etiquetas" "led,semaforo" \
  "$(echo "$RESP" | python3 -c "import sys,json; print(','.join(sorted(json.load(sys.stdin).get('etiquetas',[]))))")"

RESP=$(curl -s "$API/projetos/$PROJ_ID" -H "$AUTH")
verificar "buscar projeto por id" "Semáforo com Arduino" \
  "$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('titulo',''))")"
verificar "conta visualização única" "1" \
  "$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total_visualizacoes',''))")"

# ── 5. Listagem, busca, filtro e ordenação ──────────────────────────────────
echo ""
echo "═══ 5. LISTAGEM E BUSCA ═══"
for par in "" "?busca=sem%C3%A1foro" "?plataforma=Arduino%20Uno" "?ordem=recomendados" \
           "?ordem=curtidas" "?ordem=copias" "?pagina=1"; do
  RESP=$(curl -s "$API/projetos$par" -H "$AUTH")
  n=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total','ERRO'))" 2>/dev/null)
  verificar "listar projetos '${par:-sem filtro}'" "1" "$n"
done
RESP=$(curl -s "$API/projetos?busca=led" -H "$AUTH")
verificar "busca por etiqueta encontra o projeto" "1" \
  "$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total',''))")"
RESP=$(curl -s "$API/projetos?busca=xyzinexistente" -H "$AUTH")
verificar "busca sem resultado devolve 0" "0" \
  "$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total',''))")"

# ── 6. Curtir, copiar, salvar ───────────────────────────────────────────────
echo ""
echo "═══ 6. AÇÕES SOCIAIS ═══"
verificar "curtir" "True" "$(curl -s -X POST "$API/projetos/$PROJ_ID/curtir" -H "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('curtido'))")"
verificar "descurtir" "False" "$(curl -s -X POST "$API/projetos/$PROJ_ID/curtir" -H "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('curtido'))")"
verificar "curtir de novo" "True" "$(curl -s -X POST "$API/projetos/$PROJ_ID/curtir" -H "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('curtido'))")"
verificar "copiar" "True" "$(curl -s -X POST "$API/projetos/$PROJ_ID/copiar" -H "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('copiado'))")"
verificar "salvar" "True" "$(curl -s -X POST "$API/salvos/$PROJ_ID" -H "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('salvo'))")"
verificar "verificar salvo" "True" "$(curl -s "$API/salvos/$PROJ_ID/verificar" -H "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('salvo'))")"
verificar "listar salvos" "1" "$(curl -s "$API/salvos" -H "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total'))")"

# ── 7. Comentários ──────────────────────────────────────────────────────────
echo ""
echo "═══ 7. COMENTÁRIOS ═══"
RESP=$(curl -s -X POST "$API/projetos/$PROJ_ID/comentarios" -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"conteudo":"Muito bom esse projeto!"}')
COM_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")
verificar "criar comentário" "Muito bom esse projeto!" \
  "$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('conteudo',''))")"
verificar "listar comentários" "1" \
  "$(curl -s "$API/projetos/$PROJ_ID/comentarios" -H "$AUTH" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")"
verificar "curtir comentário" "1" \
  "$(curl -s -X POST "$API/projetos/$PROJ_ID/comentarios/$COM_ID/curtir" -H "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total_curtidas'))")"
verificar "comentário vazio é rejeitado" "Comentário não pode ser vazio." \
  "$(curl -s -X POST "$API/projetos/$PROJ_ID/comentarios" -H "$AUTH" -H 'Content-Type: application/json' -d '{"conteudo":"   "}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('erro',''))")"

# ── 8. Perfil, estatísticas, notificações ───────────────────────────────────
echo ""
echo "═══ 8. PERFIL E ESTATÍSTICAS ═══"
RESP=$(curl -s "$API/usuarios/maker_teste" -H "$AUTH")
verificar "perfil devolve total_projetos" "1" \
  "$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total_projetos'))")"
verificar "perfil devolve estatisticas.total_curtidas" "1" \
  "$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('estatisticas',{}).get('total_curtidas'))")"
verificar "atualizar bio" "Perfil atualizado." \
  "$(curl -s -X PUT "$API/usuarios/eu/perfil" -H "$AUTH" -H 'Content-Type: application/json' -d '{"biografia":"Maker de Natal-RN"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('mensagem',''))")"
verificar "bio foi persistida" "Maker de Natal-RN" \
  "$(curl -s "$API/usuarios/maker_teste" -H "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('biografia',''))")"

RESP=$(curl -s "$API/minhas-estatisticas" -H "$AUTH")
verificar "estatisticas.totais.total_projetos" "1" \
  "$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('totais',{}).get('total_projetos'))")"
verificar "estatisticas.top_projetos" "1" \
  "$(echo "$RESP" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('top_projetos',[])))")"
verificar "estatisticas.por_plataforma" "Arduino Uno" \
  "$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('por_plataforma',[{}])[0].get('plataforma',''))")"
verificar "estatisticas.atividade tem mes" "sim" \
  "$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin)['atividade']; print('sim' if d and 'mes' in d[0] else 'nao')")"

verificar "notificações não-lidas (0, é o próprio dono)" "0" \
  "$(curl -s "$API/notificacoes/nao-lidas" -H "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total'))")"

# ── 9. Segundo usuário gera notificação ─────────────────────────────────────
echo ""
echo "═══ 9. NOTIFICAÇÕES ENTRE USUÁRIOS ═══"
TOKEN2=$(curl -s -X POST "$API/autenticacao/cadastrar" -H 'Content-Type: application/json' \
  -d '{"nome_usuario":"outro_maker","email":"outro@teste.com","senha":"senha123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")
AUTH2="Authorization: Bearer $TOKEN2"
curl -s -X POST "$API/projetos/$PROJ_ID/curtir" -H "$AUTH2" > /dev/null
curl -s -X POST "$API/projetos/$PROJ_ID/comentarios" -H "$AUTH2" \
  -H 'Content-Type: application/json' -d '{"conteudo":"Vou montar aqui!"}' > /dev/null
verificar "dono recebeu 2 notificações" "2" \
  "$(curl -s "$API/notificacoes/nao-lidas" -H "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total'))")"
RESP=$(curl -s "$API/notificacoes" -H "$AUTH")
verificar "notificação traz autor_nome_usuario" "outro_maker" \
  "$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)[0].get('autor_nome_usuario',''))")"
verificar "notificação traz projeto_titulo" "Semáforo com Arduino" \
  "$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)[0].get('projeto_titulo',''))")"
verificar "tipos de notificação traduzidos" "comentario,curtida" \
  "$(echo "$RESP" | python3 -c "import sys,json; print(','.join(sorted(set(n['tipo'] for n in json.load(sys.stdin)))))")"
verificar "marcar todas como lidas" "0" \
  "$(curl -s -X PUT "$API/notificacoes/marcar-todas" -H "$AUTH" > /dev/null; curl -s "$API/notificacoes/nao-lidas" -H "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total'))")"

# ── 10. Permissões e edição ─────────────────────────────────────────────────
echo ""
echo "═══ 10. PERMISSÕES E EDIÇÃO ═══"
verificar "outro usuário não edita projeto alheio" "Sem permissão." \
  "$(curl -s -X PUT "$API/projetos/$PROJ_ID" -H "$AUTH2" -F "titulo=Invadido" -F "descricao=x" -F "plataforma=ESP32" | python3 -c "import sys,json; print(json.load(sys.stdin).get('erro',''))")"
verificar "outro usuário não deleta projeto alheio" "Sem permissão." \
  "$(curl -s -X DELETE "$API/projetos/$PROJ_ID" -H "$AUTH2" | python3 -c "import sys,json; print(json.load(sys.stdin).get('erro',''))")"
verificar "sem token devolve 401" "401" \
  "$(curl -s -o /dev/null -w '%{http_code}' "$API/projetos")"
verificar "dono edita o projeto" "Projeto atualizado." \
  "$(curl -s -X PUT "$API/projetos/$PROJ_ID" -H "$AUTH" -F "titulo=Semáforo v2" -F "descricao=Versão melhorada" -F "plataforma=ESP32" -F 'etiquetas=["esp32"]' | python3 -c "import sys,json; print(json.load(sys.stdin).get('mensagem',''))")"
RESP=$(curl -s "$API/projetos/$PROJ_ID" -H "$AUTH")
verificar "edição persistiu o titulo" "Semáforo v2" \
  "$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('titulo',''))")"
verificar "edição preservou o código" "sim" \
  "$(echo "$RESP" | python3 -c "import sys,json; print('sim' if json.load(sys.stdin).get('codigo') else 'nao')")"
verificar "edição trocou as etiquetas" "esp32" \
  "$(echo "$RESP" | python3 -c "import sys,json; print(','.join(json.load(sys.stdin).get('etiquetas',[])))")"

# ── 11. Estatísticas públicas + deleção ─────────────────────────────────────
echo ""
echo "═══ 11. PÚBLICO E DELEÇÃO ═══"
RESP=$(curl -s "$API/estatisticas")
verificar "estatísticas públicas: projetos" "1" "$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('projetos'))")"
verificar "estatísticas públicas: makers" "2" "$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('makers'))")"
verificar "deletar comentário" "Comentário deletado." \
  "$(curl -s -X DELETE "$API/projetos/$PROJ_ID/comentarios/$COM_ID" -H "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('mensagem',''))")"
verificar "deletar projeto" "Projeto deletado." \
  "$(curl -s -X DELETE "$API/projetos/$PROJ_ID" -H "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('mensagem',''))")"
verificar "CASCADE limpou os comentários" "0" \
  "$(mysql -u root -N -e "USE circuito_aberto; SELECT COUNT(*) FROM projeto_comentarios;")"
verificar "CASCADE limpou os salvos" "0" \
  "$(mysql -u root -N -e "USE circuito_aberto; SELECT COUNT(*) FROM projetos_salvos;")"

# ── Resultado ───────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
if [ "$falhas" -eq 0 ]; then
  echo "✅ TODOS OS TESTES PASSARAM"
else
  echo "❌ $falhas TESTE(S) FALHARAM"
  echo "--- log do servidor ---"; tail -25 /tmp/servidor.log
fi
for proc in node mariadbd; do pkill -9 -x "$proc" 2>/dev/null; done
exit 0
