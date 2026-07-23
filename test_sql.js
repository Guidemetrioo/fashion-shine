const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) {
    process.env[m[1].trim()] = m[2].trim();
  }
});

const { neon } = require('@neondatabase/serverless');
const databaseUrl = process.env.DATABASE_URL;
const sql = neon(databaseUrl);

async function verifyCounts() {
  const fileData = JSON.parse(fs.readFileSync('products.json', 'utf8'));
  console.log('LOCAL PRODUCTS.JSON COUNT:', fileData.length);
  const dbData = await sql.query('SELECT COUNT(*) FROM products');
  console.log('NEON DB PRODUCTS COUNT:', dbData[0].count);
}

verifyCounts().catch(console.error);
