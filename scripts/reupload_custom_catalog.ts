import fs from "fs";
import path from "path";

// 1. Carrega as variáveis de ambiente do .env.local
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
import { sql, isNeonConfigured } from "../src/utils/neonClient";

const FOTOS_DIR = "C:\\Users\\guide\\OneDrive\\Desktop\\Next.hub\\Fashionfotos\\joias_editadas_100_fotos";
const BRAND_NAME = "Fashion Shine";
const PRICE = 40;
const STOCK = 1;
const SIZE = "P";

// Mapeamento visual das características específicas de cada foto
const CUSTOM_DESCRIPTIONS: Record<string, { title: string; details: string }> = {
  "3389": {
    title: "Brinco Sagrado Coração Madrepérola Pérolas e Rubí",
    details: "Brinco formato Sagrado Coração em madrepérola com zircônias corte baguete rubí e pérolas d'água ao redor. Acabamento banhado a ouro."
  },
  "3391": {
    title: "Brinco Coração Abulado Liso Banhado Ouro 18k",
    details: "Brinco de pino formato coração abulado com superfície lisa e alto brilho, banhado a ouro 18k. Design moderno e volumoso."
  },
  "3393": {
    title: "Brinco Botão Redondo com Pedra Vermelha Cabochão",
    details: "Brinco botão redondo estilo vintage com pedra sintética vermelha cabochão e moldura abaulada banhada a ouro."
  },
  "3397": {
    title: "Brinco Coração Esmaltado Lilás Mini Corações Dourados",
    details: "Brinco formato coração esmaltado na cor lilás com detalhes em mini corações dourados em relevo."
  },
  "3399": {
    title: "Brinco Flor Verde Turmalina Ródio Negro Zircônias",
    details: "Brinco formato flor com pétalas de zircônias na cor verde turmalina, contorno de pérolas brancas e banho em ródio negro."
  },
  "3400": {
    title: "Brinco Coração Vermelho Cravejado Esmaltado Branco",
    details: "Brinco coração com centro em pedra cabochão vermelha, borda cravejada de zircônias e moldura esmaltada branca em banho rosé."
  },
  "3404": {
    title: "Brinco Quadrado Esmaltado Amarelo Cristal Central",
    details: "Brinco geométrico quadrado esmaltado em tom amarelo vibrante com cristal facetado tom mel no centro."
  },
  "3406": {
    title: "Brinco Ear Cuff Curvo Cravejado Zircônias Brancas",
    details: "Brinco estilo Ear Cuff curvo cravejado com fileira de zircônias cristal reluzentes e haste de encaixe na orelha banhado a ouro."
  }
};

function generateProductMetadata(refNum: string, filename: string) {
  if (CUSTOM_DESCRIPTIONS[refNum]) {
    return CUSTOM_DESCRIPTIONS[refNum];
  }

  const num = parseInt(refNum, 10);
  let title = "";
  let details = "";

  if (num % 5 === 0) {
    title = `Pulseira Malha Elegante Banhada Ouro P Ref ${refNum}`.slice(0, 60);
    details = `Pulseira fina com malha trabalhada e acabamento de alta joalheria banhada a ouro. Tamanho P (Ajustável).`;
  } else if (num % 5 === 1) {
    title = `Colar Colar Pingente Banhado Ouro P Ref ${refNum}`.slice(0, 60);
    details = `Colar delicado com corrente veneziana e pingente trabalhado, banhado a ouro 18k. Tamanho P.`;
  } else if (num % 5 === 2) {
    title = `Anel Solitário Cravejado Zircônias P Ref ${refNum}`.slice(0, 60);
    details = `Anel ajustável de tamanho P com acabamento cravejado de zircônias cristais de alto brilho.`;
  } else if (num % 5 === 3) {
    title = `Brinco Argola Cravejada Zircônia Ouro P Ref ${refNum}`.slice(0, 60);
    details = `Brinco tipo argola fechamento clique, cravejado com micro zircônias e banho dourado.`;
  } else {
    title = `Brinco Design Exclusivo Semijoia P Ref ${refNum}`.slice(0, 60);
    details = `Brinco com design exclusivo e acabamento fino da coleção Fashion Shine. Banho antialérgico de altíssima qualidade.`;
  }

  return { title, details };
}

// 2. Função para Pausar/Encerrar anúncios antigos da marca no Mercado Livre para evitar duplicados
async function closeOldMeliListings() {
  console.log("\n🧹 Verificando e fechando anúncios antigos duplicados no Mercado Livre...");
  const tokens = await getTokens();
  if (!tokens.mercadolivre.connected) return;

  try {
    const searchRes = await fetchMeli(`/users/${tokens.mercadolivre.userId}/items/search?limit=100`);
    if (!searchRes.ok) return;

    const searchData = await searchRes.json();
    const itemIds: string[] = searchData.results || [];
    console.log(`Encontrados ${itemIds.length} itens ativos na conta do Mercado Livre.`);

    const batchSize = 20;
    let closedCount = 0;

    for (let i = 0; i < itemIds.length; i += batchSize) {
      const batchIds = itemIds.slice(i, i + batchSize).join(",");
      const detailRes = await fetchMeli(`/items?ids=${batchIds}`);
      if (!detailRes.ok) continue;

      const detailData = await detailRes.json();
      for (const resItem of detailData) {
        const item = resItem.body;
        if (!item) continue;

        const isFsJoia = item.title.includes("FS-JOIA") || item.title.includes("Fashion Shine") || item.title.startsWith("Joia Semijoia") || item.title.startsWith("Brinco") || item.title.startsWith("Pulseira") || item.title.startsWith("Colar") || item.title.startsWith("Anel");
        if (isFsJoia && item.status === "active") {
          await fetchMeli(`/items/${item.id}`, {
            method: "PUT",
            body: JSON.stringify({ status: "closed" })
          });
          closedCount++;
        }
      }
    }
    console.log(`✅ ${closedCount} anúncios antigos foram encerrados no Mercado Livre.`);
  } catch (err: any) {
    console.warn("Aviso ao limpar anúncios antigos no ML:", err.message);
  }
}

// 3. Execução principal
export async function runCatalogReupload() {
  console.log("=================================================");
  console.log("🚀 INICIANDO CADASTRO E SINCRONIZAÇÃO COMPLETA DE PRODUTOS");
  console.log(`Conexão com Banco Neon DB ativa: ${isNeonConfigured()}`);
  console.log("=================================================");

  await closeOldMeliListings();

  // Limpar registros antigos da tabela Neon DB
  if (isNeonConfigured()) {
    try {
      await sql`DELETE FROM products WHERE sku LIKE 'FS-JOIA-%' OR id LIKE 'prod-ml-MLB%' OR id LIKE 'ml-prod-%'`;
      console.log("🧹 Produtos antigos limpos no Neon DB.");
    } catch (e) {
      console.warn("Aviso ao limpar Neon DB:", e);
    }
  }

  const files = fs.readdirSync(FOTOS_DIR).filter(f => f.endsWith(".jpg") || f.endsWith(".png") || f.endsWith(".jpeg"));
  console.log(`\nEncontrados ${files.length} arquivos de fotos ÚNICAS para cadastrar.`);

  const tokens = await getTokens();
  if (!tokens.mercadolivre.connected) {
    throw new Error("Mercado Livre não conectado.");
  }

  const newProductsList: DBProduct[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filePath = path.join(FOTOS_DIR, filename);
    const match = filename.match(/\d+/);
    const refNum = match ? match[0] : `${i + 1}`;
    const sku = `FS-JOIA-${refNum}`;

    const metadata = generateProductMetadata(refNum, filename);
    const title = metadata.title.slice(0, 60);

    console.log(`\n[${i + 1}/${files.length}] Processando ${filename} -> SKU: ${sku}`);
    console.log(`   Título: "${title}"`);

    try {
      // a) Upload da Imagem para o Mercado Livre
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
        throw new Error(`Upload de imagem falhou: ${uploadRes.status}`);
      }

      const uploadData = await uploadRes.json();
      const pictureId = uploadData.id;
      const hostedImageUrl = uploadData.variations?.[0]?.url || uploadData.url;

      // b) Publicação no Mercado Livre usando a categoria universal MLB1440
      const mlPayload = {
        family_name: title,
        category_id: "MLB1440", // Categoria Outros em Joias e Bijuterias (Sem erros de campos estritos)
        price: PRICE,
        currency_id: "BRL",
        available_quantity: STOCK,
        buying_mode: "buy_it_now",
        listing_type_id: "gold_special",
        condition: "new",
        pictures: [{ id: pictureId }],
        description: {
          plain_text: `${title}\n\n` +
                     `${metadata.details}\n\n` +
                     `Ficha técnica:\n` +
                     `- Marca: ${BRAND_NAME}\n` +
                     `- Tamanho: ${SIZE}\n` +
                     `- Preço: R$ ${PRICE},00\n` +
                     `- Estoque disponível: ${STOCK} unidade\n` +
                     `- Código de Referência: ${sku}\n\n` +
                     `Produto original Fashion Shine, novo com garantia e excelente acabamento.`
        },
        attributes: [
          { id: "BRAND", value_name: BRAND_NAME },
          { id: "MODEL", value_name: sku },
          { id: "MATERIAL", value_name: "Semijoia / Folheado" },
          { id: "GENDER", value_name: "Feminino" },
          { id: "SIZE", value_name: SIZE },
          { id: "WITH_GEMSTONE", value_name: "Sim" }
        ]
      };

      const itemRes = await fetchMeli("/items", {
        method: "POST",
        body: JSON.stringify(mlPayload)
      });

      if (!itemRes.ok) {
        const itemErr = await itemRes.json();
        throw new Error(`Erro ao publicar no ML: ${JSON.stringify(itemErr)}`);
      }

      const itemData = await itemRes.json();
      const mlItemId = itemData.id;

      // c) Cria o objeto DBProduct do sistema
      const productObj: DBProduct = {
        id: `ml-prod-${mlItemId}`,
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
        description: metadata.details,
        imageUrl: hostedImageUrl,
        isChecked: false
      };

      newProductsList.push(productObj);
      successCount++;
      console.log(`   ✨ Publicado e Cadastrado com Sucesso! ML ID: ${mlItemId}`);
    } catch (err: any) {
      console.error(`   ❌ Erro ao processar ${filename}:`, err.message);
      failCount++;
    }
  }

  // 4. Salvar todos os produtos de uma vez no banco Neon DB e no products.json local
  console.log(`\n💾 Salvando ${newProductsList.length} produtos no Banco de Dados Neon DB e arquivo local...`);
  await saveDBProducts(newProductsList);
  console.log("✅ Todos os produtos foram salvos e sincronizados com o estoque do sistema!");

  console.log(`\n================ RESUMO FINAL ================`);
  console.log(`Fotos processadas: ${files.length}`);
  console.log(`Cadastrados no Estoque com Sucesso: ${successCount}`);
  console.log(`Falhas: ${failCount}`);
}

if (require.main === module) {
  runCatalogReupload().catch(console.error);
}
