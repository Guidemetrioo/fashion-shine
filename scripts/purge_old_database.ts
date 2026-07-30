import fs from "fs";
import path from "path";

// 1. Carregar variáveis de ambiente do .env.local
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

import { sql, isNeonConfigured } from "../src/utils/neonClient";
import { DBProduct } from "../src/utils/productStorage";

function isUnifiedSku(sku: string = "") {
  const upper = sku.toUpperCase();
  return upper.startsWith("FS-BRINCO_") || 
         upper.startsWith("FS-COLAR_") || 
         upper.startsWith("FS-COLARE_") || 
         upper.startsWith("FS-PULSEIRA_") || 
         upper.startsWith("FS-OCULOS_");
}

async function purgeOldDatabase() {
  console.log("=================================================");
  console.log("🧹 EXPURGO DEFINITIVO DA BASE DE DADOS (NEON DB & JSON)");
  console.log("=================================================\n");

  const productsJsonPath = path.join(process.cwd(), "products.json");
  let localProducts: DBProduct[] = [];
  if (fs.existsSync(productsJsonPath)) {
    localProducts = JSON.parse(fs.readFileSync(productsJsonPath, "utf8"));
  }

  console.log(`📊 Total em products.json antes do expurgo: ${localProducts.length}`);

  const unifiedProducts = localProducts.filter(p => isUnifiedSku(p.sku));
  const oldProducts = localProducts.filter(p => !isUnifiedSku(p.sku));

  console.log(`✅ Produtos Unificados Oficiais a MANTER: ${unifiedProducts.length}`);
  console.log(`❌ Produtos Legados a EXPURGAR: ${oldProducts.length}\n`);

  // 1. Expurga no Neon DB (se configurado)
  if (isNeonConfigured()) {
    console.log("🌐 Conectando ao Neon PostgreSQL para expurgar registros legados...");
    try {
      // Deleta produtos que não pertençam ao padrão de SKU unificado (FS-BRINCO_, FS-COLARE_, etc.)
      const deleteResult = await sql`
        DELETE FROM products 
        WHERE NOT (
          sku LIKE 'FS-BRINCO_%' OR 
          sku LIKE 'FS-COLAR_%' OR 
          sku LIKE 'FS-COLARE_%' OR 
          sku LIKE 'FS-PULSEIRA_%' OR 
          sku LIKE 'FS-OCULOS_%'
        )
      `;
      console.log("  └─ ✅ Registros antigos removidos da tabela 'products' no Neon DB com sucesso.");
    } catch (err: any) {
      console.error("  └─ ⚠️ Erro ao expurgar Neon DB:", err.message || err);
    }
  }

  // 2. Sobrescreve products.json com EXATAMENTE os 246 produtos unificados
  fs.writeFileSync(productsJsonPath, JSON.stringify(unifiedProducts, null, 2), "utf8");
  console.log(`💾 Base local (products.json) sobrescrita com exatamente ${unifiedProducts.length} produtos unificados!`);

  // 3. Atualiza arquivo de historico deleted_products.json
  const deletedJsonPath = path.join(process.cwd(), "deleted_products.json");
  let deletedList: DBProduct[] = [];
  if (fs.existsSync(deletedJsonPath)) {
    try {
      deletedList = JSON.parse(fs.readFileSync(deletedJsonPath, "utf8"));
    } catch (e) {
      deletedList = [];
    }
  }

  const existingDeletedSkus = new Set(deletedList.map(p => p.sku));
  for (const p of oldProducts) {
    if (!existingDeletedSkus.has(p.sku)) {
      deletedList.push(p);
    }
  }
  fs.writeFileSync(deletedJsonPath, JSON.stringify(deletedList, null, 2), "utf8");

  console.log("\n=================================================");
  console.log("✨ BASE DE DADOS SINCRONIZADA E TOTALMENTE LIMPA!");
  console.log(`Estoque Oficial Ativo: ${unifiedProducts.length} produtos unificados.`);
  console.log("=================================================");
}

purgeOldDatabase().catch(console.error);
