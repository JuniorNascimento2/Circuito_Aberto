# Circuito Aberto

Plataforma para compartilhamento de projetos Arduino e ESP32 da comunidade maker brasileira.

Todo o sistema está em português: banco de dados, backend, rotas da API e frontend.

---

## Como rodar

### 1. Banco de dados

**Se você está começando do zero:**

```bash
mysql -u root -p < backend/config/esquema.sql
```

**Se você já tem dados no banco antigo (em inglês) e quer preservá-los:**

```bash
# 1. Faça backup antes
mysqldump -u root -p NOME_DO_SEU_BANCO > backup.sql

# 2. Abra backend/config/migracao-pt.sql e troque o nome do banco na linha "USE"

# 3. Rode a migração (uma vez só!)
mysql -u root -p < backend/config/migracao-pt.sql
```

A migração renomeia tabelas, colunas e traduz os valores do ENUM de notificação,
preservando todos os dados. Requer MySQL 8.0+ ou MariaDB 10.5.2+ (o arquivo tem
uma nota explicando o que fazer em versões mais antigas).

**Se você já rodou a migração acima (ou já tem `circuito_aberto` em português)
e ainda não tem o sistema de administrador**, rode também:

```bash
mysql -u root -p < backend/config/adicionar-admin.sql
```

**Se você já tinha rodado uma versão anterior de `adicionar-admin.sql`** (sem
banimento temporário/motivo), rode também:

```bash
mysql -u root -p < backend/config/adicionar-motivo-banimento.sql
```

**Se você já tem o banco em português mas ainda não tem o campo de instruções
de montagem** nos projetos:

```bash
mysql -u root -p < backend/config/adicionar-montagem.sql
```

**Se você já tem o sistema de admin mas ainda não tem log de auditoria e
denúncias**:

```bash
mysql -u root -p < backend/config/adicionar-log-denuncias.sql
```

**Se você já tem o painel admin mas ainda não tem o botão de arquivar
projetos**:

```bash
mysql -u root -p < backend/config/adicionar-arquivamento.sql
```

Isso adiciona as colunas `papel`, `banido_em`, `banido_ate` e
`motivo_banimento` em `usuarios`. Depois, promova você mesmo a admin (o
arquivo `adicionar-admin.sql` tem o `UPDATE` comentado, é só trocar o e-mail):

```sql
UPDATE usuarios SET papel = 'admin' WHERE email = 'seuemail@exemplo.com';
```

Quem instala do zero com `esquema.sql` já recebe todas essas colunas de
fábrica — esses passos extras são só para quem migrou de um banco anterior.

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env    # e preencha os valores
npm run dev             # ou: npm start
```

Acesse `http://localhost:4000`.

### 3. Variáveis de ambiente

| Variável | Para que serve |
|---|---|
| `PORT` | Porta do servidor (padrão 4000) |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | Conexão com o MySQL |
| `JWT_SECRET` | Chave de assinatura dos tokens — **gere a sua** |
| `CLIENT_URL` | URL do frontend (usada no CORS e no link de redefinir senha) |
| `TRUST_PROXY` | Quantos proxies reversos existem na frente da aplicação |
| `MAIL_USER` `MAIL_PASS` | Gmail + Senha de App, para o e-mail de redefinição |
| `LIMITE_GERAL` `LIMITE_AUTENTICACAO` `LIMITE_ACOES` | Limites de requisição por IP |

Para gerar a chave JWT:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Sem `MAIL_USER`/`MAIL_PASS`, o link de redefinição de senha é impresso no
terminal em vez de enviado por e-mail — útil para desenvolvimento.

---

## Estrutura

```
circuito_aberto/
├── backend/
│   ├── config/
│   │   ├── banco.js            conexão MySQL
│   │   ├── email.js            envio do e-mail de redefinição
│   │   ├── notificar.js        criação de notificações
│   │   ├── auditoria.js        registro no log de auditoria
│   │   ├── denuncias.js        validações da criação de denúncia
│   │   ├── banimento.js        checagem/expiração de banimento
│   │   ├── esquema.sql         criar o banco do zero
│   │   ├── migracao-pt.sql     migrar banco antigo preservando dados
│   │   ├── adicionar-admin.sql              banco já em PT → sistema admin
│   │   ├── adicionar-motivo-banimento.sql   admin antigo → motivo/prazo
│   │   ├── adicionar-montagem.sql           → campo de montagem
│   │   ├── adicionar-log-denuncias.sql      → log de auditoria + denúncias
│   │   └── adicionar-arquivamento.sql       → botão de arquivar projetos
│   ├── middlewares/
│   │   ├── autenticacao.js     validação do token JWT + checagem de banimento
│   │   └── exigirAdmin.js      bloqueia rotas de admin para quem não é admin
│   ├── rotas/
│   │   ├── autenticacao.js     cadastro, login, senha
│   │   ├── projetos.js         CRUD, curtir, copiar, denunciar
│   │   ├── comentarios.js      comentários, curtidas e denúncias neles
│   │   ├── usuarios.js         perfil, bio, avatar
│   │   ├── notificacoes.js     sino de notificações
│   │   ├── salvos.js           projetos salvos
│   │   ├── estatisticas.js     painel do usuário
│   │   └── admin.js            usuários, projetos, denúncias, log
│   ├── uploads/                imagens enviadas
│   └── servidor.js
└── frontend/
    ├── css/estilo.css
    ├── js/
    │   ├── api.js              cliente HTTP
    │   ├── sessao.js           token e usuário logado
    │   ├── protecao.js         proteção de rotas
    │   ├── utilitarios.js      helpers compartilhados
    │   ├── aviso.js            mensagens flutuantes
    │   ├── cartao-projeto.js   cartão da grade
    │   ├── bloco-codigo.js     realce de sintaxe
    │   ├── barra-navegacao.js  navegação + notificações
    │   ├── rodape.js
    │   ├── captura-erros.js
    │   └── paginas/            um arquivo por página
    ├── paginas/                13 páginas HTML
    └── recursos/               logo, ícones, favicon
```

> A pasta `uploads` manteve o nome em inglês de propósito: os caminhos das
> imagens já enviadas estão gravados no banco como `/uploads/...`. Renomeá-la
> exigiria um UPDATE em massa nessas colunas.
>
> As classes do CSS também foram mantidas como estavam, conforme combinado.

---

## Banco de dados

| Tabela | O que guarda |
|---|---|
| `usuarios` | contas, bio, avatar, token de redefinição |
| `projetos` | projetos publicados e seus contadores |
| `projeto_curtidas` | quem curtiu qual projeto |
| `projeto_copias` | quem copiou qual projeto |
| `projeto_comentarios` | comentários |
| `comentario_curtidas` | curtidas em comentários |
| `etiquetas` | etiquetas (tags) únicas |
| `projeto_etiquetas` | ligação projeto ↔ etiqueta |
| `notificacoes` | notificações do sino |
| `projetos_salvos` | projetos que o usuário salvou |
| `projeto_visualizacoes` | visualizações únicas por usuário |
| `log_admin` | histórico de ações de moderação (quem fez o quê e quando) |
| `denuncias` | denúncias de projeto/comentário feitas por usuários |

`projetos.montagem` guarda o passo a passo de conexão dos componentes
(opcional, uma linha por passo, exibido como lista numerada na página do
projeto — separado do campo `codigo`).

O ENUM de `notificacoes.tipo` aceita: `curtida`, `copia`, `comentario`,
`curtida_comentario`.

---

## Painel administrativo

Existe um papel de **admin** (`usuarios.papel`) separado do usuário comum.
Quem tem esse papel acessa `/paginas/admin.html` (aparece um link "Painel
admin" no menu do usuário) e pode:

- Ver estatísticas gerais da plataforma (usuários, projetos, banidos, etc.)
- Listar e buscar todos os usuários
- Banir / desbanir uma conta — conta banida não consegue mais logar, e um
  token já emitido também para de funcionar imediatamente (o banimento é
  checado no banco a cada requisição, não só no login)
  - **Motivo obrigatório**: todo banimento exige um texto explicando o porquê
    (ex: "comentário ofensivo na publicação X"). Esse motivo aparece para o
    usuário banido quando ele tenta logar.
  - **Duração opcional**: o admin escolhe entre banimento permanente ou por
    um número de dias (1, 3, 7, 30 ou um valor customizado). Quando o prazo
    vence, a conta recupera o acesso **automaticamente** — não precisa o
    admin voltar lá pra desbanir. A checagem de expiração roda a cada
    requisição autenticada, então funciona tanto no login quanto em qualquer
    outra tela.
- Promover outro usuário a admin, ou rebaixar um admin a comum
- Editar ou excluir **qualquer** projeto e **qualquer** comentário, não só
  os próprios
- **Arquivar projetos**: diferente de "Remover" (que apaga o projeto pra
  sempre), "Arquivar" só esconde o projeto do Explorar e do perfil público
  do autor — o projeto continua existindo no banco e pode ser desarquivado
  a qualquer momento. Útil para projetos de teste, duplicados ou em revisão
  sem precisar excluir.
- **Fila de denúncias**: alunos podem denunciar um projeto ou comentário
  (botão "Denunciar" com motivo obrigatório). O admin vê a fila em abas
  (pendentes / resolvidas / ignoradas), com um resumo do conteúdo denunciado
  e quem denunciou. Para cada denúncia pendente, o admin escolhe entre
  **remover o conteúdo** (some da plataforma e a denúncia fecha como
  resolvida), **marcar como resolvida** sem remover (ex: já tratou de outro
  jeito, tipo conversando com o aluno), ou **ignorar** (denúncia sem
  procedência). Um usuário não pode denunciar o próprio conteúdo, nem
  denunciar a mesma coisa duas vezes enquanto a denúncia anterior ainda
  está pendente.
- **Log de auditoria**: toda ação de moderação (banir, desbanir, promover,
  rebaixar, remover projeto/comentário como admin, resolver/ignorar
  denúncia) fica registrada com quem fez, quando, em quem/o quê, e detalhes
  (motivo do banimento, por exemplo). É só leitura — existe pra responder
  "quem baniu o fulano e por quê" sem depender da memória de ninguém, já
  que o sistema permite vários admins sem hierarquia entre eles.

**Segurança embutida:** o sistema nunca deixa a plataforma sem nenhum admin —
tentar rebaixar o último admin restante é bloqueado. Um admin também não
consegue banir a própria conta (pra evitar se trancar pra fora sem querer).

**Como criar o primeiro admin:** não existe cadastro público de admin, de
propósito. Você mesmo promove a primeira conta direto no banco (veja a seção
anterior, `adicionar-admin.sql`). Depois disso, esse primeiro admin pode
promover outras pessoas pela própria interface, sem precisar mexer no banco
de novo.

---



Todas as rotas exigem `Authorization: Bearer <token>`, exceto as de
autenticação, `/api/estatisticas` e `/api/saude`.

**Autenticação** — `POST /api/autenticacao/cadastrar` · `entrar` ·
`esqueci-senha` · `redefinir-senha`

**Projetos** — `GET /api/projetos` (filtros: `plataforma`, `busca`, `ordem`,
`pagina`) · `GET|PUT|DELETE /api/projetos/:id` · `POST /api/projetos` ·
`POST /api/projetos/:id/curtir` · `POST /api/projetos/:id/copiar` ·
`POST /api/projetos/:id/denunciar` (corpo `{ motivo }`)

Campos de `POST|PUT /api/projetos`: `titulo`, `descricao`, `plataforma`,
`dificuldade`, `materiais`, `montagem`, `codigo`, `etiquetas`, `imagem`.

Valores de `ordem`: `recentes`, `recomendados`, `curtidas`, `copias`.

**Comentários** — `GET|POST /api/projetos/:id/comentarios` ·
`POST .../:comentarioId/curtir` · `DELETE .../:comentarioId` ·
`POST .../:comentarioId/denunciar` (corpo `{ motivo }`)

**Usuários** — `GET /api/usuarios/:nomeUsuario` ·
`PUT /api/usuarios/eu/perfil` · `POST /api/usuarios/eu/avatar`

**Outros** — `GET|PUT /api/notificacoes` (+ `nao-lidas`, `marcar-todas`,
`:id/marcar`) · `GET|POST /api/salvos` · `GET /api/minhas-estatisticas` ·
`GET /api/estatisticas` · `GET /api/saude`

**Admin** (exigem `papel = 'admin'`) — `GET /api/admin/usuarios` (busca:
`busca`, paginação: `pagina`) ·
`POST /api/admin/usuarios/:id/banir` (corpo `{ motivo, dias? }` — `dias`
ausente = banimento permanente; chamar de novo numa conta já banida desbane) ·
`POST /api/admin/usuarios/:id/promover` · `GET /api/admin/estatisticas` ·
`GET /api/admin/denuncias` (filtro `status`: `pendente`|`resolvida`|`ignorada`,
paginação `pagina`) ·
`POST /api/admin/denuncias/:id/resolver` (corpo opcional
`{ excluir_conteudo: true }` para remover o conteúdo denunciado no mesmo
passo) · `POST /api/admin/denuncias/:id/ignorar` ·
`GET /api/admin/logs` (paginação `pagina`)

---

## Páginas

| Arquivo | Página |
|---|---|
| `inicio.html` | apresentação (visitante) |
| `entrar.html` · `cadastro.html` | acesso |
| `esqueci-senha.html` · `redefinir-senha.html` | recuperação de senha |
| `explorar.html` | busca e listagem de projetos |
| `projeto.html` | detalhe + comentários |
| `publicar.html` · `editar.html` | formulário de projeto |
| `perfil.html` | perfil e projetos do usuário |
| `salvos.html` | projetos salvos |
| `estatisticas.html` | painel de estatísticas |
| `404.html` | página não encontrada |

---

## Correções feitas junto com a tradução

1. **`CREATE DATABASE` inválido** — o esquema antigo tinha
   `CREATE DATABASE IF NOT EXISTS Circuito Aberto`, com espaço e sem crase, o
   que é SQL inválido. O banco agora se chama `circuito_aberto`.

2. **Botão de comentar travava** — no código antigo a variável `sending` nunca
   voltava para `false` após um comentário ser enviado com sucesso, então o
   botão ficava desabilitado até recarregar a página.

3. **Limites de requisição fixos no código** — agora configuráveis por variável
   de ambiente, o que permite testes automatizados e evita bloquear todo mundo
   quando várias pessoas usam o mesmo IP (laboratório, rede da escola).

4. **`teste_migracao.sh` não aplicava os scripts de admin/banimento** —
   o script testava só a migração base (`migracao-pt.sql`), sem rodar
   `adicionar-admin.sql` e os demais depois. Como o middleware de autenticação
   passou a consultar `papel`/`banido_em` em toda requisição, um banco migrado
   sem esses scripts quebra a aplicação inteira (foi exatamente o que
   aconteceu em produção quando `adicionar-motivo-banimento.sql` ficou de
   fora). O script de teste agora aplica a sequência completa de upgrade, do
   jeito que está documentado nesse LEIAME, pra pegar esse tipo de problema
   antes de virar incidente.

> `publicar.html` e `editar.html` compartilham o mesmo formulário e o mesmo
> `publicar.js`, mas são dois arquivos HTML separados — não há inclusão nem
> template. Qualquer campo novo no formulário (como `montagem`) precisa ser
> adicionado nos dois arquivos manualmente, senão a edição quebra em silêncio
> (o JS tenta preencher um campo que não existe em `editar.html`, lança
> erro, e o `.catch` redireciona pra `explorar.html` sem aviso nenhum). Os
> testes automatizados não pegam isso porque testam a API diretamente, não
> as páginas HTML.

---

## Testes automatizados

Cinco scripts, todos incluídos no pacote — rode com `bash nome_do_arquivo.sh`
(exigem MySQL/MariaDB local e Python 3):

| Script | O que cobre |
|---|---|
| `teste_e2e.sh` | fluxo completo da API: cadastro, login, projetos, busca, curtidas, comentários, notificações, permissões |
| `teste_migracao.sh` | migração do banco antigo (inglês) + toda a sequência de scripts incrementais, validando que a aplicação funciona no banco migrado |
| `teste_admin.sh` | papéis, promoção/rebaixamento, trava do último admin, moderação cruzada dono vs admin |
| `teste_banimento.sh` | motivo obrigatório, duração, expiração automática, estatísticas |
| `teste_moderacao.sh` | campo de montagem, denúncias (criar/listar/resolver/ignorar, bloqueios de autodenúncia e duplicidade), log de auditoria |
