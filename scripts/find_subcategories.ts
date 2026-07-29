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

import { fetchMeli } from "../src/utils/tokenStorage";

async function findDomains() {
  const terms = ["brinco", "colar", "pulseira", "oculos de sol"];
  for (const term of terms) {
    const res = await fetchMeli(`/sites/MLB/domain_discovery/search?q=${encodeURIComponent(term)}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`\n=== Domain discovery for "${term}" ===`);
      data.slice(0, 3).forEach((item: any) => {
        console.log(`  - Category ID: ${item.category_id} | Name: ${item.category_name} | Domain: ${item.domain_id}`);
      });
    }
  }
}

findDomains().catch(console.error);
