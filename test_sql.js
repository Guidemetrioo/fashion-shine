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

const { getDBProducts, saveDBProducts } = require('./src/utils/productStorage');

async function registerInDb() {
  const products = await getDBProducts();

  const newProd = {
    id: "prod-brinco-argolinha-2400002307486",
    name: "Brinco Argolinha Joiafina Ródio Negro",
    sku: "2400002307486",
    basePrice: 25,
    shopeeStock: 1,
    shopeeSynced: false,
    mlStock: 1,
    mlSynced: true,
    mlItemId: "MLB7238449392",
    totalStock: 1,
    lastSync: new Date().toLocaleTimeString("pt-BR"),
    description: "Brinco Argolinha Joiafina Ródio Negro com pedras. Semijoia elegante da coleção Fashion Shine.",
    imageUrl: "/brinco-argolinha.jpg"
  };

  const exists = products.some(p => p.sku === newProd.sku || p.mlItemId === newProd.mlItemId);
  if (!exists) {
    products.unshift(newProd);
    await saveDBProducts(products);
    console.log('✅ Registered product in local database and Neon DB!');
  } else {
    console.log('Product already registered in database.');
  }
}

registerInDb().catch(console.error);
