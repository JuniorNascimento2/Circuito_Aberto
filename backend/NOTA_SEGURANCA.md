# ⚠️ Ação necessária antes de usar este projeto novamente

O `.env` original enviado continha segredos reais (senha de banco, JWT_SECRET
e credenciais de e-mail) e foi removido deste pacote por segurança — ele
nunca deve circular em .zip, git ou qualquer outro canal.

## Faça isto agora, na ordem:

1. **Revogue a senha de app do Gmail** usada em `MAIL_PASS`:
   myaccount.google.com → Segurança → Senhas de app → remover a antiga e
   gerar uma nova.
2. **Troque a senha do usuário do MySQL** usado em `DB_PASSWORD` (ou ao
   menos garanta que esse banco não é acessível publicamente).
3. **Gere um novo `JWT_SECRET`** (isso invalida tokens/sessões antigas,
   o que é esperado):
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
4. Copie `.env.example` para `.env` e preencha com os NOVOS valores:
   ```bash
   cp .env.example .env
   ```
5. Confirme que `.env` está no `.gitignore` (já está, incluído neste pacote)
   e nunca o envie por e-mail, zip, chat ou repositório público.
