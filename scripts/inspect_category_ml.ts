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

async function inspectCategory() {
  console.log("=== INSPECTING CATEGORY MLB1432 (BRINCOS) ===");
  const res = await fetchMeli("/categories/MLB1432/attributes");
  if (!res.ok) {
    console.error("Failed to fetch MLB1432 attributes:", await res.text());
    return;
  }
  const attrs = await res.json();
  const required = attrs.filter((a: any) => a.tags && a.tags.required);
  console.log(`Required attributes count: ${required.length}`);
  required.forEach((a: any) => {
    console.log(`  - ${a.id} (${a.name}) | value_type: ${a.value_type}`);
    if (a.values) {
      console.log(`    Sample values:`, a.values.slice(0, 5).map((v: any) => v.name));
    }
  });
}

inspectCategory().catch(console.error);
