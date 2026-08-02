// Standalone script - no project imports to avoid side effects
const fs = require("fs");
const path = require("path");

// Load env
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const t = line.trim();
    if (t && !t.startsWith("#") && t.includes("=")) {
      const [k, ...v] = t.split("=");
      process.env[k.trim()] = v.join("=").trim();
    }
  }
}

// Load tokens
const tokensPath = path.join(__dirname, "..", "tokens.json");
const tokens = JSON.parse(fs.readFileSync(tokensPath, "utf8"));
let accessToken = tokens.mercadolivre.accessToken;

async function fetchMeli(endpoint, opts = {}) {
  const url = `https://api.mercadolibre.com${endpoint}`;
  return fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
}

function getCategory(sku) {
  const u = sku.toUpperCase();
  if (u.includes("BRINCO")) return "MLB1432";
  if (u.includes("COLAR")) return "MLB457383";
  if (u.includes("PULSEIRA")) return "MLB1434";
  if (u.includes("OCULOS")) return "MLB8378";
  return "MLB1440";
}

function buildAttrs(sku, cat) {
  const attrs = [
    { id: "BRAND", value_name: "Fashion Shine" },
    { id: "MODEL", value_name: sku },
    { id: "SELLER_SKU", value_name: sku },
    { id: "SALE_FORMAT", value_id: "1359391" },
    { id: "UNITS_PER_PACK", value_name: "1" },
    { id: "EMPTY_GTIN_REASON", value_name: "O produto não tem código cadastrado" },
  ];
  const u = sku.toUpperCase();
  if (u.includes("OCULOS")) {
    attrs.push({ id: "MATERIAL", value_name: "Acetato / Metal" });
    attrs.push({ id: "GENDER", value_name: "Sem gênero" });
  } else {
    attrs.push({ id: "MATERIAL", value_name: "Banhado a Ouro 18k" });
  }
  if (cat === "MLB1432") attrs.push({ id: "WITH_GEMSTONE", value_name: "Não" });
  if (cat === "MLB457383") {
    attrs.push({ id: "NECKLACE_STYLES", value_name: "Moderno" });
    attrs.push({ id: "GENDER", value_name: "Feminino" });
  }
  return attrs;
}

async function main() {
  // Read from products_full.json (has all 244)
  const fullProducts = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "products_full.json"), "utf8"));
  const toCreate = fullProducts.filter(p =>
    p.mlItemId && !p.mlItemId.startsWith("MLB498") && !p.mlItemId.startsWith("MLB731")
  );

  console.log(`\n📋 ${toCreate.length} produtos precisam de novos anúncios ML\n`);

  let created = 0, errors = 0;

  for (const p of toCreate) {
    const cat = getCategory(p.sku);
    const attrs = buildAttrs(p.sku, cat);

    // Try to get photos from old listing
    let pictures = [];
    try {
      const r = await fetchMeli(`/items/${p.mlItemId}`);
      if (r.ok) {
        const d = await r.json();
        pictures = (d.pictures || []).map(pic => ({ id: pic.id }));
      }
    } catch {}
    if (!pictures.length) pictures = [{ source: "https://fashion-shine.vercel.app/logo.png" }];

    const payload = {
      family_name: p.name,
      category_id: cat,
      price: p.basePrice || 79.9,
      currency_id: "BRL",
      available_quantity: 1,
      buying_mode: "buy_it_now",
      listing_type_id: "gold_special",
      condition: "new",
      pictures,
      attributes: attrs,
    };

    try {
      const res = await fetchMeli("/items", { method: "POST", body: JSON.stringify(payload) });
      if (res.ok) {
        const data = await res.json();
        console.log(`[${created+errors+1}/${toCreate.length}] ✅ ${p.sku} → ${data.id}`);
        p.mlItemId = data.id;
        p.mlSynced = true;
        p.mlStock = 1;
        p.totalStock = 1;
        created++;
      } else {
        const err = await res.json();
        console.log(`[${created+errors+1}/${toCreate.length}] ❌ ${p.sku}: ${JSON.stringify(err).slice(0,150)}`);
        errors++;
      }
      await new Promise(r => setTimeout(r, 600));
    } catch (e) {
      console.log(`[${created+errors+1}/${toCreate.length}] ❌ ${p.sku}: ${e.message}`);
      errors++;
    }
  }

  // Save updated products_full.json  
  fs.writeFileSync(path.join(__dirname, "..", "products_full.json"), JSON.stringify(fullProducts, null, 2));
  console.log(`\n💾 Salvo products_full.json`);
  console.log(`📊 Criados: ${created} | Erros: ${errors}`);
}

main().catch(e => { console.error(e); process.exit(1); });
