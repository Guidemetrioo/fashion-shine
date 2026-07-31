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

import { getTokens } from "../src/utils/tokenStorage";
import { saveDBProducts, getDBProducts, DBProduct } from "../src/utils/productStorage";
import { sql, isNeonConfigured } from "../src/utils/neonClient";

async function getMeliAccessToken() {
  const tokens = await getTokens();
  if (!tokens.mercadolivre.connected || !tokens.mercadolivre.accessToken) {
    throw new Error("Mercado Livre não conectado em tokens.json");
  }
  return tokens.mercadolivre.accessToken;
}

async function uploadPicture(token: string, filePath: string) {
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: "image/jpeg" });
  const formData = new FormData();
  formData.append("file", blob, path.basename(filePath));

  const res = await fetch("https://api.mercadolibre.com/pictures/items/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erro ao subir imagem ${filePath}: ${err}`);
  }

  const data = await res.json();
  return {
    id: data.id as string,
    url: data.variations && data.variations[0] ? data.variations[0].url : `http://http2.mlstatic.com/D_NQ_NP_${data.id}-F.jpg`
  };
}

async function mergeColares() {
  console.log("=================================================");
  console.log("🔄 RE-UPLOADING COLARE VERDE LARGO 08 COM 3 FOTOS");
  console.log("=================================================\n");

  const token = await getMeliAccessToken();
  const folderPath = "C:\\Users\\guide\\OneDrive\\Desktop\\Next.hub\\Fashionfotos\\fotos fashion\\Colares\\Colare_Verde_Largo_08";
  
  const files = fs.readdirSync(folderPath).filter(f => f.endsWith(".jpg") || f.endsWith(".png"));
  console.log(`📸 Fotos encontradas na pasta 08 (${files.length}):`, files);

  const pictureObjects: { id: string; url: string }[] = [];
  for (const file of files) {
    const filePath = path.join(folderPath, file);
    console.log(`📤 Enviando ${file} para o ML...`);
    const pic = await uploadPicture(token, filePath);
    pictureObjects.push(pic);
    console.log(`  └─ ✅ Foto [${file}] ID: ${pic.id}`);
  }

  const targetSku = "FS-COLARE_VERDE_LARGO_08";
  const prods = await getDBProducts();
  const item08 = prods.find(p => p.sku === targetSku);

  if (!item08 || !item08.mlItemId) {
    throw new Error(`Item ${targetSku} não encontrado ou sem mlItemId!`);
  }

  console.log(`\n🚀 Atualizando anúncio no Mercado Livre (${item08.mlItemId}) com ${pictureObjects.length} fotos no carrossel...`);
  
  const updateRes = await fetch(`https://api.mercadolibre.com/items/${item08.mlItemId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      pictures: pictureObjects.map(p => ({ id: p.id }))
    })
  });

  let newMlItemId = item08.mlItemId;
  if (!updateRes.ok) {
    console.warn("⚠️ Não foi possível atualizar a foto do item existente diretamente. Recriando anúncio unificado com 3 fotos...");
    const createRes = await fetch("https://api.mercadolibre.com/items", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: "Colare Verde Largo Feminino Banhado Ouro 18k Ref 08",
        category_id: "MLB1440",
        price: 89,
        currency_id: "BRL",
        available_quantity: 1,
        buying_mode: "buy_it_now",
        listing_type_id: "gold_pro",
        condition: "new",
        pictures: pictureObjects.map(p => ({ id: p.id })),
        description: { plain_text: "Colare Verde Largo Feminino Banhado Ouro 18k Ref 08 - Fashion Shine\n📷 GALERIA COMPLETA: Inclui 3 fotos em alta resolução." }
      })
    });
    if (createRes.ok) {
      const createData = await createRes.json();
      newMlItemId = createData.id;
      console.log(`🎉 Novo anúncio unificado criado no ML: ${newMlItemId} com 3 fotos!`);
      // Fechar antigo 08 single photo
      await fetch(`https://api.mercadolibre.com/items/${item08.mlItemId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" })
      }).catch(() => {});
    }
  } else {
    console.log("🎉 Anúncio no Mercado Livre atualizado com sucesso!");
  }

  const itemImages: string[] = pictureObjects.map(p => p.url);

  // Fechar anúncios 09 e 10 se existirem no ML
  for (const oldSku of ["FS-COLARE_VERDE_LARGO_09", "FS-COLARE_VERDE_LARGO_10"]) {
    const oldItem = prods.find(p => p.sku === oldSku);
    if (oldItem && oldItem.mlItemId) {
      console.log(`🔒 Fechando anúncio duplicado ${oldSku} (${oldItem.mlItemId}) no ML...`);
      try {
        await fetch(`https://api.mercadolibre.com/items/${oldItem.mlItemId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ status: "closed" })
        });
        console.log(`  └─ ✅ Anúncio ${oldItem.mlItemId} fechado!`);
      } catch (e) {
        console.warn(`  └─ ⚠️ Aviso ao fechar ${oldItem.mlItemId}`);
      }
    }
  }

  // Remover 09 e 10 da lista de produtos e atualizar o 08 com array images
  const updatedProds = prods
    .filter(p => p.sku !== "FS-COLARE_VERDE_LARGO_09" && p.sku !== "FS-COLARE_VERDE_LARGO_10")
    .map(p => {
      if (p.sku === targetSku) {
        return {
          ...p,
          mlItemId: newMlItemId,
          imageUrl: itemImages[0],
          images: itemImages
        };
      }
      return p;
    });

  // Salvar no Neon DB e products.json
  await saveDBProducts(updatedProds);

  if (isNeonConfigured()) {
    try {
      await sql`DELETE FROM products WHERE sku IN ('FS-COLARE_VERDE_LARGO_09', 'FS-COLARE_VERDE_LARGO_10')`;
      console.log("🧹 Registros antigos de 09 e 10 removidos do Neon DB.");
    } catch (e) {}
  }

  console.log("\n=================================================");
  console.log("✨ UNIFICAÇÃO CONCLUÍDA COM SUCESSO!");
  console.log(`Produto: ${targetSku}`);
  console.log(`Total de Fotos no Carrossel: ${itemImages.length}`);
  console.log("=================================================");
}

mergeColares().catch(console.error);
