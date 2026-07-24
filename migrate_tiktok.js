const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

// Lê .env.local manualmente sem depender do pacote dotenv
const envFile = path.join(__dirname, '.env.local');
const envVars = {};
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) envVars[key.trim()] = rest.join('=').trim();
  });
}

const dbUrl = envVars['DATABASE_URL'] || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ DATABASE_URL não encontrada no .env.local');
  process.exit(1);
}

const sql = neon(dbUrl);

async function migrate() {
  try {
    // Adiciona colunas TikTok na tabela products (ignora se já existirem)
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS tiktok_stock INTEGER DEFAULT 0`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS tiktok_synced BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS tiktok_item_id VARCHAR(100)`;
    console.log('✅ Colunas TikTok adicionadas na tabela products');

    // Insere linha vazia para TikTok em integration_tokens (se não existir)
    await sql`
      INSERT INTO integration_tokens (channel, connected) VALUES ('tiktok', false)
      ON CONFLICT (channel) DO NOTHING
    `;
    console.log('✅ Row tiktok criado em integration_tokens');

    console.log('\n🎉 Migração concluída com sucesso!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro na migração:', err.message);
    process.exit(1);
  }
}

migrate();
