import fs from "fs";
import path from "path";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const [key, ...valParts] = trimmed.split("=");
        process.env[key.trim()] = valParts.join("=").trim();
      }
    }
  }
}
loadEnvLocal();

import { fetchMeli, getTokens } from "../src/utils/tokenStorage";
import { getDBProducts, saveDBProducts, DBProduct } from "../src/utils/productStorage";

function getCorrectCategoryBySku(sku: string): string {
  const u = sku.toUpperCase();
  if (u.includes("BRINCO")) return "MLB1432";
  if (u.includes("COLAR")) return "MLB457383";
  if (u.includes("PULSEIRA")) return "MLB1434";
  if (u.includes("OCULOS")) return "MLB8378";
  return "MLB1440";
}

function buildAttributes(sku: string, categoryId: string): any[] {
  const attrs: any[] = [
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
  if (categoryId === "MLB1432") attrs.push({ id: "WITH_GEMSTONE", value_name: "Não" });
  if (categoryId === "MLB457383") {
    attrs.push({ id: "NECKLACE_STYLES", value_name: "Moderno" });
    attrs.push({ id: "GENDER", value_name: "Feminino" });
  }
  return attrs;
}

async function createMissingListings() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🆕 CRIANDO ANÚNCIOS PARA PRODUTOS SEM LISTING ATIVO");
  console.log("═══════════════════════════════════════════════════════════\n");

  const tokens = await getTokens();
  if (!tokens.mercadolivre.connected || !tokens.mercadolivre.accessToken) {
    throw new Error("ML não conectado!");
  }

  // Read directly from local JSON (Neon may not have all products yet)
  const dbProducts: DBProduct[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "products.json"), "utf8"));
  const toCreate = dbProducts.filter(p =>
    p.mlItemId && !p.mlItemId.startsWith("MLB498") && !p.mlItemId.startsWith("MLB731")
  );

  console.log(`📋 Produtos sem listing ativo: ${toCreate.length}\n`);

  let created = 0, errors = 0;

  for (const product of toCreate) {
    const categoryId = getCorrectCategoryBySku(product.sku);
    const attrs = buildAttributes(product.sku, categoryId);

    console.log(`[${created + errors + 1}/${toCreate.length}] ${product.sku} → ${categoryId}`);

    // Get pictures from old listing if possible
    let pictures: any[] = [];
    try {
      const oldRes = await fetchMeli(`/items/${product.mlItemId}`);
      if (oldRes.ok) {
        const oldData = await oldRes.json();
        pictures = (oldData.pictures || []).map((p: any) => ({ id: p.id }));
      }
    } catch {}

    if (pictures.length === 0) {
      // Fallback: use product image URL
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      pictures = [{ source: `${appUrl}/api/products/image/${product.id}` }];
    }

    const payload = {
      family_name: product.name,
      category_id: categoryId,
      price: product.basePrice,
      currency_id: "BRL",
      available_quantity: 1,
      buying_mode: "buy_it_now",
      listing_type_id: "gold_special",
      condition: "new",
      pictures,
      attributes: attrs,
      description: { plain_text: product.description || `${product.name} - Fashion Shine` },
    };

    try {
      const res = await fetchMeli("/items", { method: "POST", body: JSON.stringify(payload) });
      if (res.ok) {
        const data = await res.json();
        console.log(`   ✅ ${data.id} - ${data.permalink}`);
        product.mlItemId = data.id;
        product.mlSynced = true;
        product.mlStock = 1;
        product.totalStock = 1;
        product.lastSync = new Date().toLocaleTimeString("pt-BR");
        created++;
      } else {
        const err = await res.json();
        console.log(`   ❌ ${JSON.stringify(err).slice(0, 200)}`);
        errors++;
      }
      await new Promise(r => setTimeout(r, 600));
    } catch (e: any) {
      console.log(`   ❌ ${e.message}`);
      errors++;
    }
  }

  if (created > 0) {
    // Save to local JSON first
    fs.writeFileSync(path.join(process.cwd(), "products.json"), JSON.stringify(dbProducts, null, 2));
    console.log(`\n💾 products.json atualizado.`);
    // Also try to sync to Neon
    try {
      await saveDBProducts(dbProducts);
      console.log(`💾 Neon DB sincronizado.`);
    } catch (e: any) {
      console.log(`⚠️ Neon sync falhou (${e.message}) - products.json está correto.`);
    }
  }

  console.log(`\n📊 Criados: ${created} | Erros: ${errors}`);
}

createMissingListings().catch(e => { console.error(e); process.exit(1); });
