const path = require('path');
const dotenv = require('dotenv');

// Carrega as variáveis do arquivo .env (raiz do projeto)
dotenv.config();

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Injeção das credenciais do Supabase para o browser (site estático, sem bundler).
// O supabaseClient.js lê window.__SUPABASE_URL__ e window.__SUPABASE_ANON_KEY__.
// Mantém os segredos fora do frontend: apenas a anon key (pública) é exposta.
app.get('/env-config.js', (req, res) => {
  res.type('application/javascript');
  res.send(
    'window.__SUPABASE_URL__ = ' +
      JSON.stringify(process.env.SUPABASE_URL || '') +
      ';\n' +
      'window.__SUPABASE_ANON_KEY__ = ' +
      JSON.stringify(process.env.SUPABASE_ANON_KEY || '') +
      ';\n'
  );
});

app.use(express.static(path.join(__dirname)));

// Configuração flexível para rodar localmente ou na nuvem (Render, Railway, etc.)
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: 10
};

async function initDatabase() {
  const conn = await mysql.createConnection(DB_CONFIG);

  await conn.query(
    'CREATE DATABASE IF NOT EXISTS auth_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
  );
  await conn.query('USE auth_db');

  await conn.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      senha VARCHAR(255) NOT NULL,
      tipo VARCHAR(20) NOT NULL DEFAULT 'aluno',
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [rows] = await conn.query('SELECT id FROM usuarios WHERE email = ?', ['joao@email.com']);
  if (rows.length === 0) {
    const hashedPassword = await bcrypt.hash('123456', 10);
    await conn.query(
      'INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)',
      ['João Silva', 'joao@email.com', hashedPassword, 'aluno']
    );
    console.log('  Usuário demo criado: joao@email.com / 123456');
  }

  await conn.end();
}

const pool = mysql.createPool({
  ...DB_CONFIG,
  database: process.env.DB_NAME || 'auth_db'
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/cadastro', async (req, res) => {
  try {
    const { nome, email, senha, tipo } = req.body;
    const tipoUsuario = (tipo === 'professor') ? 'professor' : 'aluno';

    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    const [existing] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'E-mail já cadastrado.' });
    }

    const hashedPassword = await bcrypt.hash(senha, 10);
    await pool.query('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)', [nome, email, hashedPassword, tipoUsuario]);

    res.status(201).json({ message: 'Cadastro realizado com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const user = rows[0];
    const validPassword = await bcrypt.compare(senha, user.senha);
    if (!validPassword) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    res.json({ message: 'Login realizado com sucesso!', user: { id: user.id, nome: user.nome, email: user.email, tipo: user.tipo } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Falha ao iniciar o banco de dados:', err.message);
    process.exit(1);
  });