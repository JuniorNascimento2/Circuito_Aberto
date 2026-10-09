require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const caminho = require('path');
const limitadorRequisicoes = require('express-rate-limit');

const app = express();

// Trust proxy: necessário quando a aplicação roda atrás de um proxy reverso
// (Nginx/Apache/gateway da instituição, balanceador de carga, etc). Sem isso,
// o Express vê o IP do proxy em vez do IP real de cada visitante, o que faz
// o rate limiting abaixo tratar todo mundo atrás do proxy como um único IP.
// Ajuste o número de "hops" confiáveis via variável de ambiente TRUST_PROXY
// se a infraestrutura da instituição tiver mais de um proxy na frente
// (ex: TRUST_PROXY=2). O padrão (1) cobre o caso comum de um único proxy.
app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : 1);

// Cabeçalhos de segurança HTTP (proteção básica contra clickjacking, sniffing, etc).
// crossOriginResourcePolicy desabilitado pois as imagens de /uploads e /uploads/avatars
// precisam poder ser carregadas a partir do próprio frontend servido no mesmo domínio.
app.use(helmet({
  contentSecurityPolicy: false, // o frontend usa scripts/estilos inline e CDN (Prism, ícones)
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS: em produção, restrinja a CLIENT_URL. Em desenvolvimento (sem a variável
// definida), libera geral para não travar quem está só testando localmente.
const origemCors = process.env.CLIENT_URL || '*';
app.use(cors({ origin: origemCors }));
app.use(express.json());
app.use('/uploads', express.static(caminho.join(__dirname, 'uploads')));
app.use('/uploads/avatars', express.static(caminho.join(__dirname, 'uploads/avatars')));

// ── Limite de requisições ─────────────────────────────────────────────────────

// Os três limites abaixo podem ser ajustados por variável de ambiente. Isso é
// útil para rodar testes automatizados e para ambientes onde muita gente
// compartilha o mesmo IP (laboratório da escola, rede da instituição).
const numeroEnv = (nome, padrao) => Number(process.env[nome]) || padrao;

// Geral: 100 requisições por 15 minutos por IP
const limiteGeral = limitadorRequisicoes({
  windowMs: 15 * 60 * 1000,
  max: numeroEnv('LIMITE_GERAL', 100),
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas requisições. Tente novamente em alguns minutos.' },
});

// Autenticação: 10 tentativas por 15 minutos (entrar, cadastrar, recuperar senha)
const limiteAutenticacao = limitadorRequisicoes({
  windowMs: 15 * 60 * 1000,
  max: numeroEnv('LIMITE_AUTENTICACAO', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' },
});

// Ações sociais: 60 por minuto (curtir, copiar)
const limiteAcoes = limitadorRequisicoes({
  windowMs: 60 * 1000,
  max: numeroEnv('LIMITE_ACOES', 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Você está agindo rápido demais. Aguarde um momento.' },
});

// Aplica o limitador geral em toda a API
app.use('/api/', limiteGeral);

// Limitadores específicos — devem vir ANTES das rotas
app.use('/api/autenticacao', limiteAutenticacao);
app.use('/api/projetos/:id/curtir', limiteAcoes);
app.use('/api/projetos/:id/copiar', limiteAcoes);
app.use('/api/projetos/:id/denunciar', limiteAcoes);
app.use('/api/projetos/:projetoId/comentarios', limiteAcoes);

// Rotas da API
app.use('/api/autenticacao', require('./rotas/autenticacao'));
app.use('/api/projetos', require('./rotas/projetos'));
app.use('/api/projetos/:projetoId/comentarios', require('./rotas/comentarios'));
app.use('/api/usuarios', require('./rotas/usuarios'));
app.use('/api/notificacoes', require('./rotas/notificacoes'));
app.use('/api/salvos', require('./rotas/salvos'));
app.use('/api/minhas-estatisticas', require('./rotas/estatisticas'));
app.use('/api/admin', require('./rotas/admin'));

app.get('/api/saude', (req, res) => res.json({ status: 'ok' }));

// Estatísticas públicas
app.get('/api/estatisticas', async (req, res) => {
  try {
    const banco = require('./config/banco');
    const [[{ projetos }]] = await banco.execute('SELECT COUNT(*) as projetos FROM projetos');
    const [[{ makers }]]   = await banco.execute('SELECT COUNT(*) as makers FROM usuarios');
    const [[{ copias }]]   = await banco.execute('SELECT COALESCE(SUM(total_copias), 0) as copias FROM projetos');
    res.json({ projetos, makers, copias });
  } catch {
    res.json({ projetos: 0, makers: 0, copias: 0 });
  }
});

// Serve o frontend (HTML/CSS/JS puro, na pasta ../frontend — páginas em ../frontend/paginas)
const PASTA_FRONTEND = caminho.join(__dirname, '..', 'frontend');
app.use(express.static(PASTA_FRONTEND));

// Raiz do site: redireciona para a página inicial real, já que as páginas
// usam links relativos entre si (ex: href="entrar.html" precisa resolver a
// partir de /paginas/).
app.get('/', (req, res) => {
  res.redirect('/paginas/inicio.html');
});

// Qualquer outra rota desconhecida (que não seja /api e não bateu em
// nenhum arquivo estático acima) é realmente uma página inexistente:
// devolve a 404 personalizada com o status HTTP correto, em vez de
// redirecionar tudo silenciosamente para a home.
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ erro: 'Rota não encontrada.' });
  }
  res.status(404).sendFile(caminho.join(PASTA_FRONTEND, 'paginas', '404.html'));
});

const PORTA = process.env.PORT || 4000;
app.listen(PORTA, () => {
  console.log(`✅ Circuito Aberto rodando em http://localhost:${PORTA}`);
});
