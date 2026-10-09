const mysql = require('mysql2/promise');

const conexoes = mysql.createPool({
  host:                  process.env.DB_HOST     || 'localhost',
  port:                  process.env.DB_PORT     || 3306,
  user:                  process.env.DB_USER     || 'root',
  password:              process.env.DB_PASSWORD || '',
  database:              process.env.DB_NAME     || 'circuito_aberto',
  waitForConnections:    true,
  connectionLimit:       10,
  queueLimit:            0,
  enableKeepAlive:       true,
  keepAliveInitialDelay: 0,
  charset:               'utf8mb4',
});

// Testa a conexão ao iniciar
conexoes.getConnection()
  .then(conexao => { console.log('✅ Banco de dados conectado.'); conexao.release(); })
  .catch(erro => console.error('❌ Erro ao conectar ao banco:', erro.message));

module.exports = conexoes;
