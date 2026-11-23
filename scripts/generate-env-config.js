// Gera o arquivo env-config.js a partir do .env (fonte de verdade local).
// Uso: npm run env:generate
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
dotenv.config({ path: path.join(root, '.env') });

const url = (process.env.SUPABASE_URL || '').trim()
  .replace(/\/+$/, '')
  .replace(/\/(rest|realtime|storage|auth)\/v1$/, '');
const key = (process.env.SUPABASE_ANON_KEY || '').trim();

if (!url || !key) {
  console.error('Erro: SUPABASE_URL e SUPABASE_ANON_KEY devem estar definidos no .env');
  process.exit(1);
}

const content = [
  '// ============================================================================',
  '// Configuracao publica do Supabase para o browser.',
  '// ATENCAO: a anon key do Supabase e PUBLICA por design (segura no frontend).',
  '// Gerado automaticamente a partir do .env. Nao edite manualmente.',
  '// Regenere com: npm run env:generate',
  '// ============================================================================',
  'window.__SUPABASE_URL__ = ' + JSON.stringify(url) + ';',
  'window.__SUPABASE_ANON_KEY__ = ' + JSON.stringify(key) + ';',
  ''
].join('\n');

fs.writeFileSync(path.join(root, 'env-config.js'), content, 'utf8');
console.log('env-config.js gerado a partir do .env com sucesso.');