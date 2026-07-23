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

const { getDBProducts } = require('./src/utils/productStorage');

async function checkProductsCheckedState() {
  console.log('--- Testing DB Products for isChecked field ---');
  const products = await getDBProducts();
  console.log(`Loaded ${products.length} products from DB.`);
  const checkedProducts = products.filter(p => p.isChecked);
  console.log(`Currently Checked Products: ${checkedProducts.length}`);
}

checkProductsCheckedState().catch(console.error);
