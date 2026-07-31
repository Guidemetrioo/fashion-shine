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

import { sql, isNeonConfigured } from "../src/utils/neonClient";

async function verifyNeon() {
  if (!isNeonConfigured()) {
    console.log("Neon DB não está configurado neste ambiente.");
    return;
  }
  try {
    const totalRes = await sql`SELECT count(*) as count FROM products`;
    const total = totalRes[0]?.count;

    const unifiedRes = await sql`
      SELECT count(*) as count FROM products 
      WHERE (
        sku LIKE 'FS-BRINCO_%' OR 
        sku LIKE 'FS-COLAR_%' OR 
        sku LIKE 'FS-COLARE_%' OR 
        sku LIKE 'FS-PULSEIRA_%' OR 
        sku LIKE 'FS-OCULOS_%'
      )
    `;
    const unified = unifiedRes[0]?.count;

    console.log("=== VERIFICAÇÃO NO NEON POSTGRESQL ===");
    console.log(`Total de produtos no Neon DB: ${total}`);
    console.log(`Produtos Unificados Oficiais: ${unified}`);
    console.log(`Produtos Não Desejados / Legados Restantes: ${parseInt(total, 10) - parseInt(unified, 10)}`);
  } catch (err: any) {
    console.error("Erro ao consultar Neon DB:", err.message || err);
  }
}

verifyNeon().catch(console.error);
