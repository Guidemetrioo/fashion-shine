const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
if (match) {
  process.env.DATABASE_URL = match[1];
}

const { neon } = require('@neondatabase/serverless');

const databaseUrl = process.env.DATABASE_URL;
const neonSql = neon(databaseUrl);

async function test() {
  try {
    const r1 = await neonSql.query('SELECT * FROM integration_tokens');
    console.log('r1 via query:', r1);

    const channel = 'mercadolivre';
    const r2 = await neonSql`SELECT * FROM integration_tokens WHERE channel = ${channel}`;
    console.log('r2 via template:', r2);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
