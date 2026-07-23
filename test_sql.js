const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
process.env.DATABASE_URL = match[1];

const { sql } = require('./src/utils/neonClient');

async function test() {
  try {
    const r1 = await sql('SELECT * FROM integration_tokens');
    console.log('R1:', r1);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
