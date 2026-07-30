import fs from "fs";
import path from "path";
import { fetchMeli, getTokens } from "../src/utils/tokenStorage";
import { getDBProducts, saveDBProducts, DBProduct } from "../src/utils/productStorage";

const FOTOS_DIR = "C:\\Users\\guide\\OneDrive\\Desktop\\Next.hub\\Fashionfotos\\joias_editadas_100_fotos";
const BRAND_NAME = "Fashion Shine";
const PRICE = 40;
const STOCK = 1;
const SIZE = "P";

export async function processSinglePhoto(filename: string, dryRun: boolean = false) {
  const filePath = path.join(FOTOS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo não encontrado: ${filePath}`);
  }

  // Extract reference ID from file name (e.g. IMG_3389_editado.jpg -> 3389)
  const match = filename.match(/\d+/);
  const refNum = match ? match[0] : Date.now().toString().slice(-4);
  const sku = `FS-JOIA-${refNum}`;
  const title = `Joia Semijoia Banhada Fashion Shine P Ref ${refNum}`.slice(0, 60);

  console.log(`\n----------------------------------------`);
  console.log(`Processando [${filename}] -> SKU: ${sku}`);
  console.log(`Título: "${title}" (${title.length} chars)`);

  if (dryRun) {
    console.log(`[DRY-RUN] Foto existe ok. Nenhuma requisição enviada ao ML.`);
    return { success: true, sku, dryRun: true };
  }

  const tokens = await getTokens();
  if (!tokens.mercadolivre.connected) {
    throw new Error("Mercado Livre não está conectado.");
  }

  // 1. Upload foto para o Mercado Livre (/pictures/items/upload)
  console.log(`Uploading imagem para o Mercado Livre...`);
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: "image/jpeg" });
  const formData = new FormData();
  formData.append("file", blob, filename);

  const uploadRes = await fetch("https://api.mercadolibre.com/pictures/items/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.mercadolivre.accessToken}`
    },
    body: formData
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Falha no upload da foto: ${uploadRes.status} - ${errText}`);
  }

  const uploadData = await uploadRes.json();
  const pictureId = uploadData.id;
  const hostedImageUrl = uploadData.variations?.[0]?.url || uploadData.url;
  console.log(`Foto enviada com sucesso! Picture ID: ${pictureId}`);

  // 2. Criar Anúncio no Mercado Livre (POST /items)
  const mlPayload = {
    family_name: title,
    category_id: "MLB1440", // Outros em Joias e Bijuterias
    price: PRICE,
    currency_id: "BRL",
    available_quantity: STOCK,
    buying_mode: "buy_it_now",
    listing_type_id: "gold_special", // Anúncio Clássico / Premium
    condition: "new",
    pictures: [{ id: pictureId }],
    description: {
      plain_text: `Joia / Semijoia da marca Fashion Shine.\n\n` +
        `Ficha técnica:\n` +
        `- Marca: ${BRAND_NAME}\n` +
        `- Tamanho: ${SIZE}\n` +
        `- Preço: R$ ${PRICE},00\n` +
        `- Código de Referência: ${sku}\n\n` +
        `Produto novo, com excelente acabamento e alta durabilidade.`
    },
    attributes: [
      { id: "BRAND", value_name: BRAND_NAME },
      { id: "MODEL", value_name: sku }
    ]
  };

  console.log(`Publicando anúncio no Mercado Livre...`);
  const itemRes = await fetchMeli("/items", {
    method: "POST",
    body: JSON.stringify(mlPayload)
  });

  if (!itemRes.ok) {
    const itemErr = await itemRes.json();
    throw new Error(`Erro ao criar item no ML: ${JSON.stringify(itemErr)}`);
  }

  const itemData = await itemRes.json();
  const mlItemId = itemData.id;
  const permalink = itemData.permalink;
  console.log(`✨ Anúncio publicado com Sucesso! ML ID: ${mlItemId}`);
  console.log(`Link: ${permalink}`);

  // 3. Salvar no banco de dados local / Neon DB
  const existingProducts = await getDBProducts();
  const newProduct: DBProduct = {
    id: `prod-ml-${mlItemId}`,
    name: title,
    sku: sku,
    basePrice: PRICE,
    shopeeStock: 0,
    shopeeSynced: false,
    mlStock: STOCK,
    mlSynced: true,
    mlItemId: mlItemId,
    totalStock: STOCK,
    lastSync: new Date().toLocaleTimeString("pt-BR"),
    description: mlPayload.description.plain_text,
    imageUrl: hostedImageUrl,
    isChecked: false
  };

  // Evita duplicar se já existir por SKU
  const index = existingProducts.findIndex(p => p.sku === sku || p.id === newProduct.id);
  if (index >= 0) {
    existingProducts[index] = newProduct;
  } else {
    existingProducts.push(newProduct);
  }

  await saveDBProducts(existingProducts);
  console.log(`Salvo no sistema interno com sucesso.`);

  return { success: true, mlItemId, permalink, sku };
}

async function runBatch() {
  const files = fs.readdirSync(FOTOS_DIR).filter(f => f.endsWith(".jpg") || f.endsWith(".png") || f.endsWith(".jpeg"));
  console.log(`Encontrados ${files.length} arquivos de imagem para processar em: ${FOTOS_DIR}`);

  const args = process.argv.slice(2);
  const isLimit1 = args.includes("--limit1");

  const filesToProcess = isLimit1 ? files.slice(0, 1) : files;

  let successCount = 0;
  let failCount = 0;
  const errors: { file: string; error: string }[] = [];

  for (let i = 0; i < filesToProcess.length; i++) {
    const file = filesToProcess[i];
    console.log(`\n[${i + 1}/${filesToProcess.length}] Processando ${file}...`);
    try {
      await processSinglePhoto(file, false);
      successCount++;
    } catch (err: any) {
      console.error(`❌ Erro no arquivo ${file}:`, err.message);
      failCount++;
      errors.push({ file, error: err.message });
    }
  }

  console.log(`\n================ RESUMO FINAL ================`);
  console.log(`Total processado: ${filesToProcess.length}`);
  console.log(`Sucesso: ${successCount}`);
  console.log(`Falha: ${failCount}`);
  if (errors.length > 0) {
    console.log(`Erros:`, JSON.stringify(errors, null, 2));
  }
}

if (require.main === module) {
  runBatch();
}
