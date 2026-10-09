#!/bin/bash
set -u
BACK=/home/claude/saida/circuito_aberto/backend
API=http://localhost:4000/api
falhas=0

verificar() {
  if [ "$2" = "$3" ]; then printf "  ✅ %-52s %s\n" "$1" "$3"
  else printf "  ❌ %-52s esperado=%s obtido=%s\n" "$1" "$2" "$3"; falhas=$((falhas+1)); fi
}

for p in mariadbd node; do pkill -9 -x "$p" 2>/dev/null; done; sleep 2
mariadbd --user=mysql --datadir=/var/lib/mysql --socket=/run/mysqld/mysqld.sock \
         --log-error=/tmp/m.log --port=3306 >/dev/null 2>&1 &
for i in $(seq 1 40); do mysqladmin ping >/dev/null 2>&1 && break; sleep 1; done

echo "═══ 1. BANCO: esquema novo já com as colunas de banimento ═══"
mysql -u root -e "DROP DATABASE IF EXISTS circuito_aberto;"
mysql -u root < "$BACK/config/esquema.sql"
verificar "colunas de banimento existem" "banido_ate,motivo_banimento" \
  "$(mysql -u root --default-character-set=utf8mb4 -N -e "SELECT GROUP_CONCAT(column_name ORDER BY column_name) FROM information_schema.columns WHERE table_schema='circuito_aberto' AND table_name='usuarios' AND column_name IN ('banido_ate','motivo_banimento');")"

echo ""
echo "═══ 1b. SCRIPT INCREMENTAL (simula quem já tinha rodado adicionar-admin.sql antigo) ═══"
mysql -u root -e "ALTER TABLE circuito_aberto.usuarios DROP COLUMN banido_ate, DROP COLUMN motivo_banimento;"
mysql -u root < "$BACK/config/adicionar-motivo-banimento.sql"
verificar "colunas voltaram após rodar o script incremental" "banido_ate,motivo_banimento" \
  "$(mysql -u root --default-character-set=utf8mb4 -N -e "SELECT GROUP_CONCAT(column_name ORDER BY column_name) FROM information_schema.columns WHERE table_schema='circuito_aberto' AND table_name='usuarios' AND column_name IN ('banido_ate','motivo_banimento');")"

echo ""
echo "═══ 2. SUBINDO O SERVIDOR ═══"
cd "$BACK"
DB_NAME=circuito_aberto DB_USER=teste DB_PASSWORD=teste123 DB_HOST=127.0.0.1 \
  JWT_SECRET=chave_teste PORT=4000 LIMITE_GERAL=99999 LIMITE_AUTENTICACAO=9999 LIMITE_ACOES=9999 \
  node servidor.js > /tmp/servidor-ban.log 2>&1 &
for i in $(seq 1 25); do curl -s "$API/saude" >/dev/null 2>&1 && break; sleep 1; done
grep -q "Banco de dados conectado" /tmp/servidor-ban.log && echo "  ✅ conectou ao banco" || { echo "  ❌ não conectou"; cat /tmp/servidor-ban.log; }

cadastrar() {
  curl -s -X POST "$API/autenticacao/cadastrar" -H 'Content-Type: application/json' \
    -d "{\"nome_usuario\":\"$1\",\"email\":\"$1@teste.com\",\"senha\":\"senha123\"}" \
    | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))"
}
TOK_MASTER=$(cadastrar master)
TOK_JUNIOR=$(cadastrar junior)
mysql -u root -e "UPDATE circuito_aberto.usuarios SET papel='admin' WHERE email='master@teste.com';"
AU_MASTER="Authorization: Bearer $TOK_MASTER"
AU_JUNIOR="Authorization: Bearer $TOK_JUNIOR"
JUNIOR_ID=$(mysql -u root -N -e "SELECT id FROM circuito_aberto.usuarios WHERE email='junior@teste.com';")

echo ""
echo "═══ 3. BANIR SEM MOTIVO → REJEITADO ═══"
verificar "banir sem motivo é rejeitado" "Informe o motivo do banimento." \
  "$(curl -s -X POST "$API/admin/usuarios/$JUNIOR_ID/banir" -H "$AU_MASTER" -H 'Content-Type: application/json' -d '{}' | python3 -c "import sys,json;print(json.load(sys.stdin)['erro'])")"
verificar "banir com motivo vazio também é rejeitado" "Informe o motivo do banimento." \
  "$(curl -s -X POST "$API/admin/usuarios/$JUNIOR_ID/banir" -H "$AU_MASTER" -H 'Content-Type: application/json' -d '{"motivo":"   "}' | python3 -c "import sys,json;print(json.load(sys.stdin)['erro'])")"

echo ""
echo "═══ 4. BANIMENTO PERMANENTE (sem dias) COM MOTIVO ═══"
RESP=$(curl -s -X POST "$API/admin/usuarios/$JUNIOR_ID/banir" -H "$AU_MASTER" -H 'Content-Type: application/json' \
  -d '{"motivo":"Comentário ofensivo em uma publicação"}')
verificar "banido = true" "True" "$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin)['banido'])")"
verificar "banido_ate é nulo (permanente)" "None" "$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('banido_ate'))")"

RESP=$(curl -s -X POST "$API/autenticacao/entrar" -H 'Content-Type: application/json' -d '{"email":"junior@teste.com","senha":"senha123"}')
verificar "mensagem de login traz 'permanentemente'" "sim" \
  "$(echo "$RESP" | python3 -c "import sys,json; e=json.load(sys.stdin)['erro']; print('sim' if 'permanentemente' in e else 'nao: '+e)")"
verificar "mensagem de login traz o motivo" "sim" \
  "$(echo "$RESP" | python3 -c "import sys,json; e=json.load(sys.stdin)['erro']; print('sim' if 'Comentário ofensivo' in e else 'nao: '+e)")"

# Desbane pra testar o próximo cenário
curl -s -X POST "$API/admin/usuarios/$JUNIOR_ID/banir" -H "$AU_MASTER" > /dev/null

echo ""
echo "═══ 5. BANIMENTO TEMPORÁRIO (7 dias) ═══"
RESP=$(curl -s -X POST "$API/admin/usuarios/$JUNIOR_ID/banir" -H "$AU_MASTER" -H 'Content-Type: application/json' \
  -d '{"motivo":"Spam nos comentários","dias":7}')
verificar "banido_ate foi preenchido" "sim" \
  "$(echo "$RESP" | python3 -c "import sys,json; print('sim' if json.load(sys.stdin).get('banido_ate') else 'nao')")"

RESP=$(curl -s -X POST "$API/autenticacao/entrar" -H 'Content-Type: application/json' -d '{"email":"junior@teste.com","senha":"senha123"}')
verificar "mensagem de login traz data (não 'permanentemente')" "sim" \
  "$(echo "$RESP" | python3 -c "import sys,json; e=json.load(sys.stdin)['erro']; print('sim' if 'até' in e and 'permanentemente' not in e else 'nao: '+e)")"

echo ""
echo "═══ 6. VALIDAÇÃO DE DIAS INVÁLIDOS ═══"
curl -s -X POST "$API/admin/usuarios/$JUNIOR_ID/banir" -H "$AU_MASTER" > /dev/null  # desbane
verificar "dias = 0 é rejeitado" "Duração inválida. Use um número inteiro de dias maior que zero." \
  "$(curl -s -X POST "$API/admin/usuarios/$JUNIOR_ID/banir" -H "$AU_MASTER" -H 'Content-Type: application/json' -d '{"motivo":"teste","dias":0}' | python3 -c "import sys,json;print(json.load(sys.stdin)['erro'])")"
verificar "dias = -5 é rejeitado" "Duração inválida. Use um número inteiro de dias maior que zero." \
  "$(curl -s -X POST "$API/admin/usuarios/$JUNIOR_ID/banir" -H "$AU_MASTER" -H 'Content-Type: application/json' -d '{"motivo":"teste","dias":-5}' | python3 -c "import sys,json;print(json.load(sys.stdin)['erro'])")"
verificar "dias = 2.5 é rejeitado" "Duração inválida. Use um número inteiro de dias maior que zero." \
  "$(curl -s -X POST "$API/admin/usuarios/$JUNIOR_ID/banir" -H "$AU_MASTER" -H 'Content-Type: application/json' -d '{"motivo":"teste","dias":"2.5"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['erro'])")"
verificar "ninguém foi banido pelas tentativas inválidas" "NULL" \
  "$(mysql -u root -N -e "SELECT banido_em FROM circuito_aberto.usuarios WHERE id=$JUNIOR_ID;")"

echo ""
echo "═══ 7. EXPIRAÇÃO AUTOMÁTICA (banimento no passado) ═══"
# Simula um banimento de 1 dia que já venceu ontem (edita direto no banco,
# já que não dá pra esperar 1 dia de verdade no teste)
mysql -u root -e "UPDATE circuito_aberto.usuarios SET banido_em = NOW(), banido_ate = DATE_SUB(NOW(), INTERVAL 1 DAY), motivo_banimento = 'Já expirado' WHERE id = $JUNIOR_ID;"
verificar "conta está marcada como banida no banco" "sim" \
  "$(mysql -u root -N -e "SELECT IF(banido_em IS NOT NULL,'sim','nao') FROM circuito_aberto.usuarios WHERE id=$JUNIOR_ID;")"

RESP=$(curl -s -X POST "$API/autenticacao/entrar" -H 'Content-Type: application/json' -d '{"email":"junior@teste.com","senha":"senha123"}')
verificar "login funciona normalmente (expirou)" "sim" \
  "$(echo "$RESP" | python3 -c "import sys,json;d=json.load(sys.stdin);print('sim' if 'token' in d else 'nao: '+str(d))")"
verificar "banco foi limpo automaticamente (auto-desban)" "None,None,None" \
  "$(mysql -u root -N -e "SELECT CONCAT(COALESCE(banido_em,'None'),',',COALESCE(banido_ate,'None'),',',COALESCE(motivo_banimento,'None')) FROM circuito_aberto.usuarios WHERE id=$JUNIOR_ID;")"

echo ""
echo "═══ 8. EXPIRAÇÃO VIA MIDDLEWARE (token já em uso quando expira) ═══"
# Bane por 1 dia, pega um token válido, depois simula o vencimento e confere
# se uma rota autenticada comum (não login) também libera e limpa sozinha.
TOK_J2=$(cadastrar junior2)
J2_ID=$(mysql -u root -N -e "SELECT id FROM circuito_aberto.usuarios WHERE email='junior2@teste.com';")
curl -s -X POST "$API/admin/usuarios/$J2_ID/banir" -H "$AU_MASTER" -H 'Content-Type: application/json' -d '{"motivo":"teste","dias":1}' > /dev/null
verificar "banido: acesso a rota comum é negado" "401" \
  "$(curl -s -o /dev/null -w '%{http_code}' "$API/projetos" -H "Authorization: Bearer $TOK_J2")"
mysql -u root -e "UPDATE circuito_aberto.usuarios SET banido_ate = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE id = $J2_ID;"
verificar "expirado: mesma rota agora libera" "200" \
  "$(curl -s -o /dev/null -w '%{http_code}' "$API/projetos" -H "Authorization: Bearer $TOK_J2")"
verificar "banco foi limpo pelo middleware também" "None" \
  "$(mysql -u root -N -e "SELECT COALESCE(banido_em,'None') FROM circuito_aberto.usuarios WHERE id=$J2_ID;")"

echo ""
echo "═══ 9. ESTATÍSTICAS NÃO CONTAM EXPIRADOS ═══"
J3_TOK=$(cadastrar junior3)
J3_ID=$(mysql -u root -N -e "SELECT id FROM circuito_aberto.usuarios WHERE email='junior3@teste.com';")
curl -s -X POST "$API/admin/usuarios/$J3_ID/banir" -H "$AU_MASTER" -H 'Content-Type: application/json' -d '{"motivo":"teste ativo","dias":30}' > /dev/null
verificar "1 banido ativo nas estatísticas" "1" \
  "$(curl -s "$API/admin/estatisticas" -H "$AU_MASTER" | python3 -c "import sys,json;print(json.load(sys.stdin)['geral']['total_banidos'])")"
# Expira no banco sem ninguém logar de novo (registro "sujo": banido_em setado mas já vencido)
mysql -u root -e "UPDATE circuito_aberto.usuarios SET banido_ate = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE id = $J3_ID;"
verificar "estatística já não conta o expirado, mesmo sem auto-limpeza" "0" \
  "$(curl -s "$API/admin/estatisticas" -H "$AU_MASTER" | python3 -c "import sys,json;print(json.load(sys.stdin)['geral']['total_banidos'])")"

echo ""
echo "═══ 10. LISTAGEM DE ADMIN TRAZ OS NOVOS CAMPOS ═══"
mysql -u root -e "UPDATE circuito_aberto.usuarios SET banido_em=NOW(), banido_ate=NULL, motivo_banimento='Motivo final de teste' WHERE id=$JUNIOR_ID;"
RESP=$(curl -s "$API/admin/usuarios" -H "$AU_MASTER")
verificar "motivo aparece na listagem" "Motivo final de teste" \
  "$(echo "$RESP" | python3 -c "import sys,json; u=[x for x in json.load(sys.stdin)['usuarios'] if x['email']=='junior@teste.com'][0]; print(u['motivo_banimento'])")"

echo ""
echo "════════════════════════════════════════════════════════════"
if [ "$falhas" -eq 0 ]; then echo "✅ TODOS OS TESTES DE BANIMENTO PASSARAM"
else echo "❌ $falhas TESTE(S) FALHARAM"; tail -25 /tmp/servidor-ban.log; fi
for p in node mariadbd; do pkill -9 -x "$p" 2>/dev/null; done
exit 0
