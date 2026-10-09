<div align="center">

# ⚡ Circuito Aberto

**Plataforma para compartilhamento de projetos Arduino e ESP32 da comunidade maker brasileira.**

Publique projetos, compartilhe esquemas e instruções de montagem, descubra o que outros makers estão construindo — tudo em português.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL%2FMariaDB-8.0%2B-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)

</div>

---

## 📖 Sobre o projeto

O **Circuito Aberto** é uma rede social voltada para a comunidade maker: um espaço onde estudantes e entusiastas de eletrônica podem publicar seus projetos com Arduino, ESP32, ESP8266 e outras plataformas, incluindo código-fonte, lista de componentes, esquema de montagem e instruções passo a passo.

Desenvolvido como projeto de conclusão de curso (PCC) no **IFRN**.

## ✨ Funcionalidades

- 🔐 **Contas e autenticação** — cadastro, login, recuperação de senha por e-mail
- 📦 **Publicação de projetos** — código-fonte com realce de sintaxe, lista de componentes, instruções de montagem e imagens
- ❤️ **Interações sociais** — curtir, salvar, copiar e comentar projetos
- 🔍 **Busca e filtros** — por plataforma (Arduino Uno, Mega, Nano, ESP32, ESP8266...), ordenação por recentes/populares
- 🔔 **Notificações** — avisos de curtidas, comentários e novidades
- 🛡️ **Moderação e denúncias** — usuários podem denunciar conteúdo impróprio
- 👑 **Painel administrativo** — gestão de usuários (promoção/banimento), projetos (remoção/arquivamento), denúncias e log de auditoria completo de ações administrativas
- 📱 **Totalmente responsivo** — funciona bem em celular, tablet e desktop

## 🛠️ Tecnologias

| Camada | Tecnologias |
|---|---|
| **Frontend** | HTML, CSS e JavaScript puro (sem frameworks) |
| **Backend** | Node.js + Express |
| **Banco de dados** | MySQL / MariaDB |
| **Autenticação** | JWT (JSON Web Tokens) + bcrypt |
| **Segurança** | Helmet, rate limiting (express-rate-limit), CORS configurado |
| **E-mail** | Nodemailer (recuperação de senha) |

## 📂 Estrutura do projeto

```
circuito_aberto/
├── backend/
│   ├── config/       # conexão com banco, esquema SQL, scripts de migração
│   ├── middlewares/  # autenticação, verificação de admin, etc.
│   ├── rotas/         # endpoints da API (projetos, usuários, admin...)
│   ├── uploads/       # imagens enviadas pelos usuários
│   └── servidor.js    # ponto de entrada da aplicação
├── frontend/
│   ├── css/           # estilos
│   ├── js/             # lógica das páginas e componentes
│   ├── paginas/        # páginas HTML
│   └── recursos/       # imagens, ícones, logo
├── teste_*.sh          # suítes de teste automatizado (bash + curl)
└── LEIAME.md           # guia técnico detalhado (migrações de banco, etc.)
```

## 🚀 Como rodar o projeto

### Pré-requisitos

- [Node.js](https://nodejs.org/) 18 ou superior
- [MySQL](https://www.mysql.com/) 8.0+ ou [MariaDB](https://mariadb.org/) 10.5+

### 1. Clone o repositório

```bash
git clone <url-do-repositorio>
cd circuito_aberto
```

### 2. Configure o banco de dados

```bash
mysql -u root -p < backend/config/esquema.sql
```

> Já tem um banco de uma versão anterior do projeto? Veja o **[LEIAME.md](LEIAME.md)** — lá tem o passo a passo de cada script de migração incremental.

### 3. Configure as variáveis de ambiente

```bash
cd backend
cp .env.example .env
```

Abra o `.env` e preencha com os dados do seu banco local (usuário, senha) e gere sua própria chave `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 4. Instale as dependências e rode o servidor

```bash
npm install
npm start
```

Acesse **http://localhost:4000** no navegador. 🎉

### 5. (Opcional) Rode as suítes de teste

```bash
cd ..
bash teste_e2e.sh
bash teste_admin.sh
bash teste_banimento.sh
bash teste_moderacao.sh
bash teste_migracao.sh
```

## 📚 Mais documentação

Para detalhes técnicos mais profundos — scrips de migração de banco, variáveis de ambiente avançadas, como funciona o sistema de administração — consulte o **[LEIAME.md](LEIAME.md)**.

## 👥 Equipe

| Nome | GitHub |
|---|---|
| Júnior Nascimento | [@JuniorNascimento2](https://github.com/JuniorNascimento2) |
| Gabryell Gonçalves | [@gabryellgs](https://github.com/gabryellgs) |
| Jadson Leitão | [@JadsonTSI](https://github.com/JadsonTSI) |
| Israel Cipriano | [@Israelf1lho](https://github.com/Israelf1lho) |
| Pedro Henrique | [@Henrriks](https://github.com/Henrriks) |

---

<div align="center">
Feito com 💚 por estudantes do IFRN para a comunidade maker brasileira.
</div>
