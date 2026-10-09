#!/bin/bash
set -u
BACK=/home/claude/saida/circuito_aberto/backend
API=http://localhost:4000/api
falhas=0

verificar() {
  if [ "$2" = "$3" ]; then printf "  ✅ %-46s %s\n" "$1" "$3"
  else printf "  ❌ %-46s esperado=%s obtido=%s\n" "$1" "$2" "$3"; falhas=$((falhas+1)); fi
}

for p in mariadbd node; do pkill -9 -x "$p" 2>/dev/null; done; sleep 2
mariadbd --user=mysql --datadir=/var/lib/mysql --socket=/run/mysqld/mysqld.sock \
         --log-error=/tmp/m.log --port=3306 >/dev/null 2>&1 &
for i in $(seq 1 40); do mysqladmin ping >/dev/null 2>&1 && break; sleep 1; done

echo "═══ 1. BANCO: esquema do zero (já com papel/banido_em) ═══"
mysql -u root -e "DROP DATABASE IF EXISTS circuito_aberto;"
mysql -u root < "$BACK/config/esquema.sql"
verificar "colunas papel e banido_em existem" "banido_em,papel" \
  "$(mysql -u root --default-character-set=utf8mb4 -N -e "SELECT GROUP_CONCAT(column_name ORDER BY column_name) FROM information_schema.columns WHERE table_schema='circuito_aberto' AND table_name='usuarios' AND column_name IN ('banido_em','papel');")"

echo ""
echo "═══ 2. SUBINDO O SERVIDOR ═══"
cd "$BACK"
DB_NAME=circuito_aberto DB_USER=teste DB_PASSWORD=teste123 DB_HOST=127.0.0.1 \
  JWT_SECRET=chave_teste PORT=4000 LIMITE_GERAL=99999 LIMITE_AUTENTICACAO=9999 LIMITE_ACOES=9999 \
  node servidor.js > /tmp/servidor-admin.log 2>&1 &
for i in $(seq 1 25); do curl -s "$API/saude" >/dev/null 2>&1 && break; sleep 1; done
grep -q "Banco de dados conectado" /tmp/servidor-admin.log && echo "  ✅ conectou ao banco" || { echo "  ❌ não conectou"; cat /tmp/servidor-admin.log; }

# ── 3 usuários: master (promovido manualmente), comum1, comum2 ──────────────
echo ""
echo "═══ 3. CRIANDO USUÁRIOS DE TESTE ═══"
cadastrar() {
  curl -s -X POST "$API/autenticacao/cadastrar" -H 'Content-Type: application/json' \
    -d "{\"nome_usuario\":\"$1\",\"email\":\"$1@teste.com\",\"senha\":\"senha123\"}" \
    | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))"
}
TOK_MASTER=$(cadastrar master)
TOK_C1=$(cadastrar comum1)
TOK_C2=$(cadastrar comum2)
verificar "3 usuários criados" "3" "$(mysql -u root -N -e "SELECT COUNT(*) FROM circuito_aberto.usuarios;")"
verificar "cadastro traz papel=comum" "comum" \
  "$(curl -s -X POST "$API/autenticacao/entrar" -H 'Content-Type: application/json' -d '{"email":"comum1@teste.com","senha":"senha123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['usuario']['papel'])")"

# Promove "master" manualmente no banco (como você fez no Workbench)
mysql -u root -e "UPDATE circuito_aberto.usuarios SET papel='admin' WHERE email='master@teste.com';"
# Token antigo não tem papel dentro, mas nosso middleware busca do banco a cada request — então nem precisa logar de novo
verificar "master virou admin no banco" "admin" "$(mysql -u root -N -e "SELECT papel FROM circuito_aberto.usuarios WHERE email='master@teste.com';")"

AU_MASTER="Authorization: Bearer $TOK_MASTER"
AU_C1="Authorization: Bearer $TOK_C1"
AU_C2="Authorization: Bearer $TOK_C2"

echo ""
echo "═══ 4. TOKEN ANTIGO JÁ RECONHECE O NOVO PAPEL (sem relogar) ═══"
verificar "rota /admin/usuarios acessível com token antigo" "200" \
  "$(curl -s -o /dev/null -w '%{http_code}' "$API/admin/usuarios" -H "$AU_MASTER")"
verificar "comum1 NÃO acessa rota admin" "403" \
  "$(curl -s -o /dev/null -w '%{http_code}' "$API/admin/usuarios" -H "$AU_C1")"
verificar "mensagem de acesso negado" "Apenas administradores podem acessar este recurso." \
  "$(curl -s "$API/admin/usuarios" -H "$AU_C1" | python3 -c "import sys,json;print(json.load(sys.stdin)['erro'])")"

echo ""
echo "═══ 5. LISTAR E BUSCAR USUÁRIOS ═══"
RESP=$(curl -s "$API/admin/usuarios" -H "$AU_MASTER")
verificar "lista os 3 usuários" "3" "$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin)['total'])")"
verificar "busca por nome funciona" "1" \
  "$(curl -s -G "$API/admin/usuarios" --data-urlencode "busca=comum1" -H "$AU_MASTER" | python3 -c "import sys,json;print(json.load(sys.stdin)['total'])")"

echo ""
echo "═══ 6. BANIR CONTA ═══"
C1_ID=$(mysql -u root -N -e "SELECT id FROM circuito_aberto.usuarios WHERE email='comum1@teste.com';")
verificar "banir comum1" "True" \
  "$(curl -s -X POST "$API/admin/usuarios/$C1_ID/banir" -H "$AU_MASTER" -H 'Content-Type: application/json' -d '{"motivo":"teste de moderação"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['banido'])")"
verificar "banido não consegue logar" "Sua conta foi banida permanentemente. Motivo: teste de moderação. Entre em contato com a coordenação." \
  "$(curl -s -X POST "$API/autenticacao/entrar" -H 'Content-Type: application/json' -d '{"email":"comum1@teste.com","senha":"senha123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['erro'])")"
verificar "token antigo do banido é rejeitado nas rotas" "401" \
  "$(curl -s -o /dev/null -w '%{http_code}' "$API/projetos" -H "$AU_C1")"
verificar "admin não pode banir a si mesmo" "Você não pode banir a própria conta." \
  "$(curl -s -X POST "$API/admin/usuarios/$(mysql -u root -N -e "SELECT id FROM circuito_aberto.usuarios WHERE email='master@teste.com';")/banir" -H "$AU_MASTER" | python3 -c "import sys,json;print(json.load(sys.stdin)['erro'])")"
verificar "desbanir comum1" "False" \
  "$(curl -s -X POST "$API/admin/usuarios/$C1_ID/banir" -H "$AU_MASTER" | python3 -c "import sys,json;print(json.load(sys.stdin)['banido'])")"
verificar "desbanido consegue logar de novo" "sim" \
  "$(curl -s -X POST "$API/autenticacao/entrar" -H 'Content-Type: application/json' -d '{"email":"comum1@teste.com","senha":"senha123"}' | python3 -c "import sys,json;d=json.load(sys.stdin);print('sim' if 'token' in d else 'nao')")"

echo ""
echo "═══ 7. PROMOVER / REBAIXAR + TRAVA DO ÚLTIMO ADMIN ═══"
verificar "promover comum2 a admin" "admin" \
  "$(curl -s -X POST "$API/admin/usuarios/$(mysql -u root -N -e "SELECT id FROM circuito_aberto.usuarios WHERE email='comum2@teste.com';")/promover" -H "$AU_MASTER" | python3 -c "import sys,json;print(json.load(sys.stdin)['papel'])")"
verificar "agora existem 2 admins" "2" "$(mysql -u root -N -e "SELECT COUNT(*) FROM circuito_aberto.usuarios WHERE papel='admin';")"
C2_ID=$(mysql -u root -N -e "SELECT id FROM circuito_aberto.usuarios WHERE email='comum2@teste.com';")
verificar "rebaixar comum2 de volta" "comum" \
  "$(curl -s -X POST "$API/admin/usuarios/$C2_ID/promover" -H "$AU_MASTER" | python3 -c "import sys,json;print(json.load(sys.stdin)['papel'])")"
verificar "voltou a ter 1 admin só" "1" "$(mysql -u root -N -e "SELECT COUNT(*) FROM circuito_aberto.usuarios WHERE papel='admin';")"
MASTER_ID=$(mysql -u root -N -e "SELECT id FROM circuito_aberto.usuarios WHERE email='master@teste.com';")
verificar "não deixa rebaixar o ÚLTIMO admin" "Não é possível rebaixar o último administrador da plataforma." \
  "$(curl -s -X POST "$API/admin/usuarios/$MASTER_ID/promover" -H "$AU_MASTER" | python3 -c "import sys,json;print(json.load(sys.stdin)['erro'])")"
verificar "continua só 1 admin depois da tentativa" "1" "$(mysql -u root -N -e "SELECT COUNT(*) FROM circuito_aberto.usuarios WHERE papel='admin';")"

echo ""
echo "═══ 8. MODERAÇÃO: EDITAR/DELETAR PROJETO E COMENTÁRIO DE OUTRO USUÁRIO ═══"
printf '\x89PNG\r\n\x1a\n' > /tmp/t.png
PROJ_ID=$(curl -s -X POST "$API/projetos" -H "$AU_C1" \
  -F "titulo=Projeto do Comum1" -F "descricao=Descrição de teste" -F "plataforma=ESP32" \
  -F "imagem=@/tmp/t.png;type=image/png" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
COM_ID=$(curl -s -X POST "$API/projetos/$PROJ_ID/comentarios" -H "$AU_C2" \
  -H 'Content-Type: application/json' -d '{"conteudo":"Comentário do comum2"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")

verificar "comum2 NÃO edita projeto do comum1" "Sem permissão." \
  "$(curl -s -X PUT "$API/projetos/$PROJ_ID" -H "$AU_C2" -F "titulo=Invadido" -F "descricao=x" -F "plataforma=ESP32" | python3 -c "import sys,json;print(json.load(sys.stdin).get('erro',''))")"
verificar "admin EDITA projeto de outro usuário" "Projeto atualizado." \
  "$(curl -s -X PUT "$API/projetos/$PROJ_ID" -H "$AU_MASTER" -F "titulo=Editado pelo admin" -F "descricao=Moderado" -F "plataforma=ESP32" | python3 -c "import sys,json;print(json.load(sys.stdin).get('mensagem',''))")"
verificar "edição do admin persistiu" "Editado pelo admin" \
  "$(curl -s "$API/projetos/$PROJ_ID" -H "$AU_MASTER" | python3 -c "import sys,json;print(json.load(sys.stdin)['titulo'])")"
verificar "admin DELETA comentário de outro usuário" "Comentário deletado." \
  "$(curl -s -X DELETE "$API/projetos/$PROJ_ID/comentarios/$COM_ID" -H "$AU_MASTER" | python3 -c "import sys,json;print(json.load(sys.stdin).get('mensagem',''))")"
verificar "admin DELETA projeto de outro usuário" "Projeto deletado." \
  "$(curl -s -X DELETE "$API/projetos/$PROJ_ID" -H "$AU_MASTER" | python3 -c "import sys,json;print(json.load(sys.stdin).get('mensagem',''))")"

echo ""
echo "═══ 9. ESTATÍSTICAS GERAIS DA PLATAFORMA ═══"
RESP=$(curl -s "$API/admin/estatisticas" -H "$AU_MASTER")
verificar "total_usuarios" "3" "$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin)['geral']['total_usuarios'])")"
verificar "total_admins" "1" "$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin)['geral']['total_admins'])")"
verificar "total_banidos" "0" "$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin)['geral']['total_banidos'])")"
verificar "comum não acessa estatísticas admin" "403" \
  "$(curl -s -o /dev/null -w '%{http_code}' "$API/admin/estatisticas" -H "$AU_C1")"

echo ""
echo "════════════════════════════════════════════════════════════"
if [ "$falhas" -eq 0 ]; then echo "✅ TODOS OS TESTES DO SISTEMA ADMIN PASSARAM"
else echo "❌ $falhas TESTE(S) FALHARAM"; tail -25 /tmp/servidor-admin.log; fi
for p in node mariadbd; do pkill -9 -x "$p" 2>/dev/null; done
exit 0
