#!/bin/bash
# Testa as 3 features novas: campo de montagem, log de auditoria e denúncias.
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

echo "═══ 1. BANCO: esquema do zero (já com montagem/log_admin/denuncias) ═══"
mysql -u root -e "DROP DATABASE IF EXISTS circuito_aberto;"
mysql -u root < "$BACK/config/esquema.sql"
verificar "coluna montagem existe em projetos" "montagem" \
  "$(mysql -u root -N -e "SELECT column_name FROM information_schema.columns WHERE table_schema='circuito_aberto' AND table_name='projetos' AND column_name='montagem';")"
verificar "tabela log_admin existe" "log_admin" \
  "$(mysql -u root -N -e "SELECT table_name FROM information_schema.tables WHERE table_schema='circuito_aberto' AND table_name='log_admin';")"
verificar "tabela denuncias existe" "denuncias" \
  "$(mysql -u root -N -e "SELECT table_name FROM information_schema.tables WHERE table_schema='circuito_aberto' AND table_name='denuncias';")"

echo ""
echo "═══ 2. SUBINDO O SERVIDOR ═══"
cd "$BACK"
DB_NAME=circuito_aberto DB_USER=teste DB_PASSWORD=teste123 DB_HOST=127.0.0.1 \
  JWT_SECRET=chave_teste PORT=4000 LIMITE_GERAL=99999 LIMITE_AUTENTICACAO=9999 LIMITE_ACOES=9999 \
  node servidor.js > /tmp/servidor-moderacao.log 2>&1 &
for i in $(seq 1 25); do curl -s "$API/saude" >/dev/null 2>&1 && break; sleep 1; done
grep -q "Banco de dados conectado" /tmp/servidor-moderacao.log && echo "  ✅ conectou ao banco" || { echo "  ❌ não conectou"; cat /tmp/servidor-moderacao.log; }

echo ""
echo "═══ 3. USUÁRIOS DE TESTE (admin, dono do projeto, denunciante) ═══"
cadastrar() {
  curl -s -X POST "$API/autenticacao/cadastrar" -H 'Content-Type: application/json' \
    -d "{\"nome_usuario\":\"$1\",\"email\":\"$1@teste.com\",\"senha\":\"senha123\"}" \
    | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))"
}
TOK_ADMIN=$(cadastrar admin1)
TOK_DONO=$(cadastrar dono1)
TOK_DENUNCIANTE=$(cadastrar denunciante1)
mysql -u root -e "UPDATE circuito_aberto.usuarios SET papel='admin' WHERE email='admin1@teste.com';"
verificar "admin promovido no banco" "admin" "$(mysql -u root -N -e "SELECT papel FROM circuito_aberto.usuarios WHERE email='admin1@teste.com';")"

AU_ADMIN="Authorization: Bearer $TOK_ADMIN"
AU_DONO="Authorization: Bearer $TOK_DONO"
AU_DEN="Authorization: Bearer $TOK_DENUNCIANTE"

echo ""
echo "═══ 4. CAMPO DE MONTAGEM ═══"
printf '\x89PNG\r\n\x1a\n' > /tmp/teste.png
head -c 200 /dev/urandom >> /tmp/teste.png
RESP=$(curl -s -X POST "$API/projetos" -H "$AU_DONO" \
  -F "titulo=Sensor de presença" \
  -F "descricao=Liga um LED quando detecta movimento." \
  -F "plataforma=Arduino Uno" \
  -F "dificuldade=Iniciante" \
  -F "materiais=1x Arduino Uno
1x sensor PIR" \
  -F "montagem=1. Conecte o VCC do sensor ao 5V
2. Conecte o GND ao GND
3. Conecte o sinal ao pino 7" \
  -F "codigo=void setup() { pinMode(7, INPUT); }" \
  -F "imagem=@/tmp/teste.png;type=image/png")
PROJ_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")
verificar "projeto criado com montagem" "sim" "$([ -n "$PROJ_ID" ] && echo sim || echo "nao: $RESP")"
verificar "montagem foi persistida" "sim" \
  "$(mysql -u root -N -e "SELECT IF(montagem LIKE '%pino 7%',1,0) FROM circuito_aberto.projetos WHERE id=$PROJ_ID;" | sed 's/1/sim/;s/0/nao/')"

RESP=$(curl -s "$API/projetos/$PROJ_ID" -H "$AU_DONO")
verificar "GET do projeto devolve montagem" "sim" \
  "$(echo "$RESP" | python3 -c "import sys,json; print('sim' if 'pino 7' in json.load(sys.stdin).get('montagem','') else 'nao')")"

# Projeto sem montagem (campo é opcional)
RESP2=$(curl -s -X POST "$API/projetos" -H "$AU_DONO" \
  -F "titulo=Projeto sem montagem" -F "descricao=x" -F "plataforma=ESP32" \
  -F "imagem=@/tmp/teste.png;type=image/png")
PROJ_SEM_MONTAGEM=$(echo "$RESP2" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")
verificar "montagem opcional (não quebra o cadastro)" "sim" "$([ -n "$PROJ_SEM_MONTAGEM" ] && echo sim || echo nao)"

# Edição atualiza montagem
RESP=$(curl -s -X PUT "$API/projetos/$PROJ_ID" -H "$AU_DONO" \
  -F "titulo=Sensor de presença" -F "descricao=Liga um LED quando detecta movimento." -F "plataforma=Arduino Uno" \
  -F "montagem=Passo único: conecte tudo em um protoboard.")
verificar "edição atualiza montagem" "1" \
  "$(mysql -u root -N -e "SELECT IF(montagem LIKE '%protoboard%',1,0) FROM circuito_aberto.projetos WHERE id=$PROJ_ID;")"

echo ""
echo "═══ 5. DENÚNCIA DE PROJETO ═══"
RESP=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/projetos/$PROJ_ID/denunciar" -H "$AU_DONO" \
  -H 'Content-Type: application/json' -d '{"motivo":"teste"}')
verificar "dono não pode denunciar o próprio projeto" "400" "$RESP"

RESP=$(curl -s -X POST "$API/projetos/$PROJ_ID/denunciar" -H "$AU_DEN" \
  -H 'Content-Type: application/json' -d '{"motivo":""}')
verificar "motivo vazio é rejeitado" "Informe o motivo da denúncia." \
  "$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('erro',''))")"

RESP=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/projetos/$PROJ_ID/denunciar" -H "$AU_DEN" \
  -H 'Content-Type: application/json' -d '{"motivo":"Conteúdo copiado de outro site."}')
verificar "denúncia de projeto criada" "201" "$RESP"

RESP=$(curl -s -X POST "$API/projetos/$PROJ_ID/denunciar" -H "$AU_DEN" \
  -H 'Content-Type: application/json' -d '{"motivo":"De novo."}')
verificar "denúncia duplicada (mesmo usuário) é bloqueada" \
  "Você já denunciou este conteúdo. Aguarde a análise da equipe." \
  "$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('erro',''))")"

verificar "denúncia sem login é rejeitada" "401" \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/projetos/$PROJ_ID/denunciar" -H 'Content-Type: application/json' -d '{"motivo":"x"}')"

echo ""
echo "═══ 6. DENÚNCIA DE COMENTÁRIO ═══"
RESP=$(curl -s -X POST "$API/projetos/$PROJ_ID/comentarios" -H "$AU_DONO" \
  -H 'Content-Type: application/json' -d '{"conteudo":"Comentário do próprio dono"}')
COM_ID=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('id',''))")
verificar "comentário criado" "sim" "$([ -n "$COM_ID" ] && echo sim || echo nao)"

RESP=$(curl -s -X POST "$API/projetos/$PROJ_ID/comentarios/$COM_ID/denunciar" -H "$AU_DEN" \
  -H 'Content-Type: application/json' -d '{"motivo":"Comentário ofensivo."}')
verificar "denúncia de comentário criada" "Denúncia enviada. Nossa equipe vai analisar." \
  "$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('mensagem',''))")"

echo ""
echo "═══ 7. PAINEL ADMIN: FILA DE DENÚNCIAS ═══"
verificar "comum não acessa fila de denúncias" "403" \
  "$(curl -s -o /dev/null -w '%{http_code}' "$API/admin/denuncias" -H "$AU_DONO")"

RESP=$(curl -s "$API/admin/denuncias?status=pendente" -H "$AU_ADMIN")
verificar "2 denúncias pendentes na fila" "2" \
  "$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin)['total'])")"
verificar "denúncia traz resumo do projeto" "sim" \
  "$(echo "$RESP" | python3 -c "
import sys,json
d = json.load(sys.stdin)['denuncias']
alvo = next(x for x in d if x['alvo_tipo']=='projeto')
print('sim' if alvo['alvo_resumo']=='Sensor de presença' else 'nao')")"
verificar "estatísticas contam denúncias pendentes" "2" \
  "$(curl -s "$API/admin/estatisticas" -H "$AU_ADMIN" | python3 -c "import sys,json;print(json.load(sys.stdin)['geral']['total_denuncias_pendentes'])")"

# Resolve a denúncia do comentário SEM remover o conteúdo
DEN_COMENTARIO_ID=$(echo "$RESP" | python3 -c "
import sys,json
d = json.load(sys.stdin)['denuncias']
alvo = next(x for x in d if x['alvo_tipo']=='comentario')
print(alvo['id'])")
RESP=$(curl -s -X POST "$API/admin/denuncias/$DEN_COMENTARIO_ID/resolver" -H "$AU_ADMIN" \
  -H 'Content-Type: application/json' -d '{}')
verificar "denúncia de comentário marcada resolvida" "resolvida" \
  "$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin)['status'])")"
verificar "comentário NÃO foi removido (resolver sem excluir)" "1" \
  "$(mysql -u root -N -e "SELECT COUNT(*) FROM circuito_aberto.projeto_comentarios WHERE id=$COM_ID;")"

# Resolve a denúncia do projeto REMOVENDO o conteúdo
DEN_PROJETO_ID=$(curl -s "$API/admin/denuncias?status=pendente" -H "$AU_ADMIN" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['denuncias'][0]['id'])")
RESP=$(curl -s -X POST "$API/admin/denuncias/$DEN_PROJETO_ID/resolver" -H "$AU_ADMIN" \
  -H 'Content-Type: application/json' -d '{"excluir_conteudo":true}')
verificar "resolver com excluir_conteudo remove o projeto" "1" \
  "$(echo "$RESP" | python3 -c "import sys,json;print(1 if json.load(sys.stdin)['conteudo_removido'] else 0)")"
verificar "projeto denunciado foi removido do banco" "0" \
  "$(mysql -u root -N -e "SELECT COUNT(*) FROM circuito_aberto.projetos WHERE id=$PROJ_ID;")"

verificar "0 denúncias pendentes restantes" "0" \
  "$(curl -s "$API/admin/denuncias?status=pendente" -H "$AU_ADMIN" | python3 -c "import sys,json;print(json.load(sys.stdin)['total'])")"
verificar "2 denúncias na aba 'resolvidas'" "2" \
  "$(curl -s "$API/admin/denuncias?status=resolvida" -H "$AU_ADMIN" | python3 -c "import sys,json;print(json.load(sys.stdin)['total'])")"

echo ""
echo "═══ 8. IGNORAR DENÚNCIA ═══"
curl -s -X POST "$API/projetos/$PROJ_SEM_MONTAGEM/denunciar" -H "$AU_DEN" \
  -H 'Content-Type: application/json' -d '{"motivo":"Denúncia sem procedência."}' > /dev/null
DEN_ID=$(curl -s "$API/admin/denuncias?status=pendente" -H "$AU_ADMIN" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['denuncias'][0]['id'])")
RESP=$(curl -s -X POST "$API/admin/denuncias/$DEN_ID/ignorar" -H "$AU_ADMIN")
verificar "denúncia ignorada" "ignorada" "$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin)['status'])")"
verificar "conteúdo NÃO removido ao ignorar" "1" \
  "$(mysql -u root -N -e "SELECT COUNT(*) FROM circuito_aberto.projetos WHERE id=$PROJ_SEM_MONTAGEM;")"
verificar "já analisada não pode ser resolvida de novo" "Esta denúncia já foi analisada." \
  "$(curl -s -X POST "$API/admin/denuncias/$DEN_ID/resolver" -H "$AU_ADMIN" -H 'Content-Type: application/json' -d '{}' | python3 -c "import sys,json;print(json.load(sys.stdin).get('erro',''))")"

echo ""
echo "═══ 9. LOG DE AUDITORIA ═══"
verificar "comum não acessa o log" "403" \
  "$(curl -s -o /dev/null -w '%{http_code}' "$API/admin/logs" -H "$AU_DONO")"

RESP=$(curl -s "$API/admin/logs" -H "$AU_ADMIN")
TOTAL_LOGS=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin)['total'])")
# Esperado: deletar_projeto (via denúncia) + resolver_denuncia + ignorar_denuncia = pelo menos 3
verificar "log tem ao menos 3 entradas" "sim" "$([ "$TOTAL_LOGS" -ge 3 ] && echo sim || echo "nao: $TOTAL_LOGS")"
verificar "log registra admin_nome correto" "admin1" \
  "$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin)['logs'][0]['admin_nome'])")"
verificar "log tem entrada de deletar_projeto" "1" \
  "$(echo "$RESP" | python3 -c "
import sys,json
logs = json.load(sys.stdin)['logs']
print(1 if any(l['acao']=='deletar_projeto' for l in logs) else 0)")"

# Banir gera log
RESP=$(curl -s -X POST "$API/admin/usuarios/$(mysql -u root -N -e "SELECT id FROM circuito_aberto.usuarios WHERE email='dono1@teste.com';")/banir" \
  -H "$AU_ADMIN" -H 'Content-Type: application/json' -d '{"motivo":"Teste de log."}')
verificar "banimento gera entrada no log" "1" \
  "$(curl -s "$API/admin/logs" -H "$AU_ADMIN" | python3 -c "
import sys,json
logs = json.load(sys.stdin)['logs']
print(1 if any(l['acao']=='banir' and l['alvo_desc']=='dono1' for l in logs) else 0)")"

echo ""
echo "════════════════════════════════════════════════════════════"
if [ "$falhas" -eq 0 ]; then
  echo "✅ TODOS OS TESTES DE MODERAÇÃO (montagem/log/denúncias) PASSARAM"
else
  echo "❌ $falhas TESTE(S) FALHARAM"
fi
echo "--- log do servidor ---"
tail -20 /tmp/servidor-moderacao.log
for p in mariadbd node; do pkill -9 -x "$p" 2>/dev/null; done
exit $falhas
