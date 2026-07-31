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

async function testCreate() {
  console.log("=== TESTING POST /items WITH family_name ONLY ===");

  const titleStr = "Brinco Solitário Cravejado Zircônias Teste";
  const payload: Record<string, any> = {
    family_name: titleStr,
    category_id: "MLB1432",
    price: 40,
    currency_id: "BRL",
    available_quantity: 1,
    buying_mode: "buy_it_now",
    listing_type_id: "gold_special",
    condition: "new",
    attributes: [
      { id: "BRAND", value_name: "Fashion Shine" },
      { id: "MODEL", value_name: "FS-TEST-1" },
      { id: "MATERIAL", value_name: "Banhado a ouro" },
      { id: "WITH_GEMSTONE", value_name: "Sim" },
    ],
    pictures: [
      { source: "https://http2.mlstatic.com/D_945111-MLB107118219513_022026-O.jpg" }
    ]
  };

  const res = await fetchMeli("/items", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log("Status:", res.status);
  if (res.ok) {
    console.log("SUCCESS! Created item ID:", data.id);
  } else {
    console.log("Response:", JSON.stringify(data, null, 2));
  }
}

testCreate().catch(console.error);
