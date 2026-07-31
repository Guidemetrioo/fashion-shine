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

import { fetchMeli, getTokens } from "../src/utils/tokenStorage";
import { getDBProducts, saveDBProducts, DBProduct } from "../src/utils/productStorage";

async function cleanupOldCatalog() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const shouldCloseML = args.includes("--close-ml");

  console.log("=================================================");
  console.log("🧹 LIMPEZA E UNIFICAÇÃO FINAL DA BASE DE PRODUTOS");
  console.log(`Modo Dry-Run: ${isDryRun} | Fechar no Mercado Livre: ${shouldCloseML}`);
  console.log("=================================================\n");

  const existingProducts = await getDBProducts();
  console.log(`📦 Total de produtos cadastrados atualmente: ${existingProducts.length}`);

  // Identifica produtos unificados novos (prefixos com underline: FS-BRINCO_, FS-COLARE_, etc.)
  const isUnifiedSku = (sku: string = "") => {
    const upper = sku.toUpperCase();
    return upper.startsWith("FS-BRINCO_") || 
           upper.startsWith("FS-COLARE_") || 
           upper.startsWith("FS-PULSEIRA_") || 
           upper.startsWith("FS-OCULOS_");
  };

  const unifiedProducts = existingProducts.filter(p => isUnifiedSku(p.sku));
  const oldProducts = existingProducts.filter(p => !isUnifiedSku(p.sku));

  console.log(`✅ Produtos Unificados Atuais (Manter): ${unifiedProducts.length}`);
  console.log(`❌ Produtos Antigos (Remover/Fechar): ${oldProducts.length}\n`);

  if (isDryRun) {
    console.log("---------------- DRY-RUN (SIMULAÇÃO) ----------------");
    console.log("Primeiros 5 produtos antigos que serão removidos:");
    for (const p of oldProducts.slice(0, 5)) {
      console.log(`  SKU: ${p.sku} | ML ID: ${p.mlItemId || 'N/A'} | Nome: "${p.name}"`);
    }
    console.log("\nModo simulação concluído. Nenhuma alteração realizada.");
    return;
  }

  // 2. Se a opção --close-ml estiver ativa, encerra os anúncios no Mercado Livre
  if (shouldCloseML) {
    const tokens = await getTokens();
    if (!tokens.mercadolivre.connected) {
      console.warn("⚠️ Mercado Livre não conectado. Pulando encerramento na API.");
    } else {
      console.log("🛑 Encerrando anúncios antigos duplicados no Mercado Livre...");
      let closedCount = 0;
      let errCount = 0;

      for (let i = 0; i < oldProducts.length; i++) {
        const p = oldProducts[i];
        if (!p.mlItemId) continue;

        console.log(`[${i + 1}/${oldProducts.length}] Encerrando ML ID: ${p.mlItemId} (SKU: ${p.sku})...`);
        try {
          const res = await fetchMeli(`/items/${p.mlItemId}`, {
            method: "PUT",
            body: JSON.stringify({ status: "closed" })
          });

          if (res.ok) {
            closedCount++;
            console.log(`  └─ ✅ Anúncio ${p.mlItemId} encerrado com sucesso.`);
          } else {
            const errTxt = await res.text();
            console.warn(`  └─ ⚠️ Aviso ao fechar ${p.mlItemId}: ${errTxt}`);
          }

          // Pausa leve para não exceder limites de requisições
          await new Promise(r => setTimeout(r, 250));
        } catch (err: any) {
          console.error(`  └─ ❌ Erro ao fechar ${p.mlItemId}:`, err.message || err);
          errCount++;
        }
      }

      console.log(`\nResumo ML: ${closedCount} anúncios encerrados, ${errCount} avisos/erros.`);
    }
  }

  // 3. Salva no deleted_products.json o histórico dos produtos removidos
  const deletedPath = path.join(process.cwd(), "deleted_products.json");
  let currentDeleted: DBProduct[] = [];
  if (fs.existsSync(deletedPath)) {
    try {
      currentDeleted = JSON.parse(fs.readFileSync(deletedPath, "utf8"));
    } catch (e) {
      currentDeleted = [];
    }
  }

  // Evita duplicar no deleted_products
  const existingDeletedSkus = new Set(currentDeleted.map(p => p.sku));
  for (const p of oldProducts) {
    if (!existingDeletedSkus.has(p.sku)) {
      currentDeleted.push(p);
    }
  }

  fs.writeFileSync(deletedPath, JSON.stringify(currentDeleted, null, 2), "utf8");
  console.log(`💾 Registros antigos movidos para deleted_products.json (${currentDeleted.length} total no histórico).`);

  // 4. Sobrescreve products.json apenas com os produtos unificados
  await saveDBProducts(unifiedProducts);
  console.log(`✨ Base principal (products.json) atualizada com exatamente ${unifiedProducts.length} produtos unificados!`);

  console.log("\n=================================================");
  console.log("✅ LIMPEZA DA BASE DE PRODUTOS CONCLUÍDA!");
  console.log(`Nova Base Oficial: ${unifiedProducts.length} produtos unificados.`);
  console.log("=================================================");
}

cleanupOldCatalog().catch(console.error);
