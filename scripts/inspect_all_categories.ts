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

async function inspectCategories() {
  console.log("=== VERIFYING MERCADO LIVRE CATEGORIES ===");
  
  // Search categories under MLB1430 (Joias e Bijuterias) and MLB1434 (Óculos, Relógios e Acessórios)
  const categoriesToTest = [
    { name: "Brincos", id: "MLB1432" },
    { name: "Colares / Cordões", id: "MLB1435" },
    { name: "Pulseiras", id: "MLB1437" },
    { name: "Óculos de Sol", id: "MLB6124" },
    { name: "Outros Joias", id: "MLB1440" }
  ];

  for (const cat of categoriesToTest) {
    const res = await fetchMeli(`/categories/${cat.id}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`✅ ${cat.name} [${cat.id}]: ${data.name} (Path: ${data.path_from_root?.map((p: any) => p.name).join(" > ")})`);
    } else {
      console.log(`❌ ${cat.name} [${cat.id}]: Invalid category (${res.status})`);
    }
  }
}

inspectCategories().catch(console.error);
