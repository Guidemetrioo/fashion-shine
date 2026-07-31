import fs from "fs";
import path from "path";
import { getDBProducts, DBProduct } from "../src/utils/productStorage";

function isUnifiedSku(sku: string = "") {
  const upper = sku.toUpperCase();
  return upper.startsWith("FS-BRINCO_") || 
         upper.startsWith("FS-COLARE_") || 
         upper.startsWith("FS-PULSEIRA_") || 
         upper.startsWith("FS-OCULOS_");
}

async function exportForUpSeller() {
  console.log("=================================================");
  console.log("📦 GERANDO PLANILHA DE EXPORTAÇÃO PARA O UPSELLER");
  console.log("=================================================\n");

  const products = await getDBProducts();
  const unifiedProducts = products.filter(p => isUnifiedSku(p.sku));

  console.log(`✅ Total de produtos unificados na base: ${unifiedProducts.length}`);

  // Formato CSV compatível com UpSeller (Separado por vírgula / Ponto e vírgula UTF-8)
  const header = [
    "SKU",
    "Nome do Produto",
    "Preco",
    "Estoque",
    "Categoria",
    "Link Imagem Principal",
    "Mercado Livre ID",
    "Descricao"
  ].join(";");

  const rows = unifiedProducts.map(p => {
    // Determina categoria legível
    let category = "Joias e Semijoias";
    if (p.sku.startsWith("FS-BRINCO_")) category = "Brincos";
    if (p.sku.startsWith("FS-COLARE_")) category = "Colares";
    if (p.sku.startsWith("FS-PULSEIRA_")) category = "Pulseiras";
    if (p.sku.startsWith("FS-OCULOS_")) category = "Óculos de Sol";

    // Limpa quebras de linha na descrição para não quebrar o CSV
    const cleanDesc = (p.description || "").replace(/[\r\n]+/g, " ");
    const cleanName = (p.name || "").replace(/;/g, " ");

    return [
      `"${p.sku}"`,
      `"${cleanName}"`,
      `"${p.basePrice}"`,
      `"${p.totalStock}"`,
      `"${category}"`,
      `"${p.imageUrl || ''}"`,
      `"${p.mlItemId || ''}"`,
      `"${cleanDesc}"`
    ].join(";");
  });

  const csvContent = "\uFEFF" + [header, ...rows].join("\n"); // \uFEFF adiciona BOM UTF-8 para o Excel abrir perfeitamente

  const outputPath = path.join(process.cwd(), "upseller_catalog_export.csv");
  fs.writeFileSync(outputPath, csvContent, "utf8");

  console.log(`\n🎉 Planilha gerada com sucesso!`);
  console.log(`📁 Arquivo salvo em: ${outputPath}`);
  console.log(`📊 Total de linhas exportadas: ${unifiedProducts.length}`);
  console.log("\n=================================================");
}

exportForUpSeller().catch(console.error);
