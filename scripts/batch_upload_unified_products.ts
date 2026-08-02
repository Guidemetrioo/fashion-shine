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

const FOTOS_BASE_DIR = "C:\\Users\\guide\\OneDrive\\Desktop\\Next.hub\\Fashionfotos\\fotos fashion";
const PRICE = 40;
const STOCK = 1;
const BRAND_NAME = "Fashion Shine";

interface CategoryConfig {
  folder: string;
  category_id: string;
  skuPrefix: string;
  name: string;
}

const CATEGORIES: CategoryConfig[] = [
  { folder: "Brincos", category_id: "MLB1432", skuPrefix: "FS-BRINCO", name: "Brincos" },
  { folder: "Colares", category_id: "MLB457383", skuPrefix: "FS-COLAR", name: "Colares" },
  { folder: "Pulseiras", category_id: "MLB1434", skuPrefix: "FS-PULSEIRA", name: "Pulseiras" },
  { folder: "Óculos", category_id: "MLB8378", skuPrefix: "FS-OCULOS", name: "Óculos de Sol" }
];

function generateSeoTitle(categoryName: string, folderName: string): string {
  const cleanName = folderName.replace(/_/g, " ").replace(/\d+/g, "").trim();
  const skuRef = folderName.split("_").pop() || "01";

  if (categoryName === "Brincos") {
    return `${cleanName} Semijoia Banhada Ouro 18k Ref ${skuRef}`.slice(0, 60);
  }
  if (categoryName === "Colares") {
    return `${cleanName} Feminino Banhado Ouro 18k Ref ${skuRef}`.slice(0, 60);
  }
  if (categoryName === "Pulseiras") {
    return `${cleanName} Feminina Banhada Ouro Ref ${skuRef}`.slice(0, 60);
  }
  return `Óculos de Sol ${cleanName} Proteção UV400 Ref ${skuRef}`.slice(0, 60);
}

function generateSeoDescription(title: string, categoryName: string, sku: string, photoCount: number): string {
  const photoNote = photoCount > 1 
    ? `\n📷 ANÚNCIO COM GALERIA COMPLETA: Inclui ${photoCount} fotos em alta resolução mostrando diferentes ângulos e detalhes reais da peça.`
    : ``;

  if (categoryName === "Óculos de Sol") {
    return `${title} - Fashion Shine
${photoNote}

Modelagem exclusiva de alta qualidade para compor seu visual com sofisticação e total proteção solar.

FICHA TÉCNICA:
- Marca: ${BRAND_NAME}
- Modelo / Linha: Óculos de Sol Premium
- Proteção Solar: Lentes com Proteção UV400 (UVA/UVB)
- Código SKU: ${sku}
- Preço: R$ ${PRICE},00
- Estoque: Produto Pronta Entrega (${STOCK} unidade)

DIFERENCIAIS:
✔ Design moderno e elegante que valoriza o formato do rosto.
✔ Lentes com filtragem contra raios UVA/UVB para máximo conforto visual.
✔ Armação leve, resistente e extremamente confortável.
✔ Acompanha garantia de qualidade Fashion Shine.

CUIDADOS:
- Limpar as lentes com flanela macia e limpa.
- Guardar em estojo protetor quando não estiver em uso.

Envio rápido e seguro para todo o Brasil. Adquira já o seu!`;
  }

  return `${title} - Fashion Shine
${photoNote}

Semijoia fina de altíssima qualidade com banho nobre antialérgico, desenvolvida para realçar a beleza e elegância feminina em qualquer ocasião.

FICHA TÉCNICA:
- Marca: ${BRAND_NAME}
- Categoria: ${categoryName}
- Banho: Ouro 18k / Ródio Nobre Hipoalergênico (Livre de Níquel)
- Código SKU: ${sku}
- Preço: R$ ${PRICE},00
- Condição: Produto Novo e Embalado
- Estoque: Pronta Entrega (${STOCK} unidade)

DIFERENCIAIS DA MARCA FASHION SHINE:
✔ Verniz de proteção de alta durabilidade (brilho prolongado).
✔ Design moderno, leve e sofisticado.
✔ Acabamento artesanal com rigoroso controle de qualidade.
✔ Excelente opção para presentear alguém especial.

DICAS DE CONSERVAÇÃO:
- Evite contato direto com perfumes, cremes e produtos químicos.
- Retire suas peças antes de tomar banho de mar ou piscina.
- Guarde individualmente em local seco e protegido da luz.

Garantia de satisfação e envio imediato com nota fiscal.`;
}

async function uploadUnifiedProducts() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const isForce = args.includes("--force");
  const limitArgIndex = args.indexOf("--limit");
  const limit = limitArgIndex >= 0 ? parseInt(args[limitArgIndex + 1], 10) : 0;

  console.log("=================================================");
  console.log("🚀 UPLOAD DE PRODUTOS UNIFICADOS (COM MÚLTIPLAS FOTOS)");
  console.log(`Modo Dry-Run: ${isDryRun} | Forçar Recadastro (--force): ${isForce} | Limite: ${limit > 0 ? limit : "Sem limite (Todos)"}`);
  console.log("=================================================\n");

  const tokens = await getTokens();
  if (!isDryRun && !tokens.mercadolivre.connected) {
    throw new Error("❌ Mercado Livre não está conectado! Conecte a conta antes de rodar.");
  }

  const existingProducts = await getDBProducts();
  const existingSkuMap = new Map<string, number>();
  existingProducts.forEach((p, idx) => existingSkuMap.set(p.sku, idx));

  let totalUploaded = 0;
  let totalErrors = 0;
  let totalProcessed = 0;

  for (const cat of CATEGORIES) {
    const catFolderPath = path.join(FOTOS_BASE_DIR, cat.folder);
    if (!fs.existsSync(catFolderPath)) {
      console.log(`⚠️ Pasta não encontrada: ${catFolderPath}`);
      continue;
    }

    const productFolders = fs.readdirSync(catFolderPath).filter(f => {
      const fullPath = path.join(catFolderPath, f);
      return fs.statSync(fullPath).isDirectory();
    });

    console.log(`\n📁 Categoria: [${cat.name}] - Total de Produtos Unificados: ${productFolders.length}`);

    for (const prodFolder of productFolders) {
      if (limit > 0 && totalProcessed >= limit) {
        console.log(`\n🛑 Limite de ${limit} produto(s) atingido.`);
        break;
      }

      const prodPath = path.join(catFolderPath, prodFolder);
      const photoFiles = fs.readdirSync(prodPath)
        .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

      if (photoFiles.length === 0) {
        console.log(`⚠️ Nenhuma foto encontrada na pasta: ${prodFolder}`);
        continue;
      }

      const sku = `FS-${prodFolder.toUpperCase()}`;

      // Se não estiver no modo --force e o SKU já tiver mlItemId ativo na base local, pula
      if (!isForce && existingSkuMap.has(sku)) {
        const existingProd = existingProducts[existingSkuMap.get(sku)!];
        if (existingProd && existingProd.mlItemId) {
          console.log(`⏩ SKU ${sku} já possui ML ID (${existingProd.mlItemId}). Pulando... (Use --force para recadastrar)`);
          continue;
        }
      }

      const seoTitle = generateSeoTitle(cat.name, prodFolder);
      const seoDescription = generateSeoDescription(seoTitle, cat.name, sku, photoFiles.length);

      console.log(`\n----------------------------------------`);
      console.log(`[${totalProcessed + 1}] Cadastrando ${cat.name} | SKU: ${sku}`);
      console.log(`Pasta do Produto: ${prodFolder}`);
      console.log(`Fotos encontradas (${photoFiles.length}): ${photoFiles.join(", ")}`);
      console.log(`Título SEO: "${seoTitle}"`);

      totalProcessed++;

      if (isDryRun) {
        console.log(`[DRY-RUN] Produto validado com sucesso (${photoFiles.length} fotos). Nenhuma requisição enviada.`);
        totalUploaded++;
        continue;
      }

      try {
        // 1. Upload de TODAS as Fotos do Produto para o Mercado Livre
        console.log(`📤 Enviando ${photoFiles.length} foto(s) para o Mercado Livre...`);
        const pictureIds: { id: string }[] = [];
        let firstPictureUrl = "";

        for (const photoFile of photoFiles) {
          const photoPath = path.join(prodPath, photoFile);
          const fileBuffer = fs.readFileSync(photoPath);
          const blob = new Blob([fileBuffer], { type: "image/jpeg" });
          const formData = new FormData();
          formData.append("file", blob, photoFile);

          const uploadRes = await fetch("https://api.mercadolibre.com/pictures/items/upload", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tokens.mercadolivre.accessToken}`
            },
            body: formData
          });

          if (!uploadRes.ok) {
            const errTxt = await uploadRes.text();
            throw new Error(`Upload da foto ${photoFile} falhou (${uploadRes.status}): ${errTxt}`);
          }

          const uploadData = await uploadRes.json();
          const pictureId = uploadData.id;
          pictureIds.push({ id: pictureId });

          if (!firstPictureUrl) {
            firstPictureUrl = uploadData.variations?.[0]?.url || uploadData.url || "";
          }

          console.log(`  └─ ✅ Foto [${photoFile}] enviada! Picture ID: ${pictureId}`);
        }

        // 2. Criar Anúncio Unificado no Mercado Livre com o Array Completo de Fotos
        let targetCategory = cat.category_id;
        let mlPayload: Record<string, any> = {
          family_name: seoTitle,
          category_id: targetCategory,
          price: PRICE,
          currency_id: "BRL",
          available_quantity: STOCK,
          buying_mode: "buy_it_now",
          listing_type_id: "gold_special",
          condition: "new",
          pictures: pictureIds,
          description: { plain_text: seoDescription },
          attributes: [
            { id: "BRAND", value_name: BRAND_NAME },
            { id: "MODEL", value_name: sku },
            { id: "SELLER_SKU", value_name: sku },
            { id: "MATERIAL", value_name: cat.name === "Óculos de Sol" ? "Acetato / Metal" : "Banhado a Ouro 18k" },
            { id: "SALE_FORMAT", value_id: "1359391" },  // "Unidade"
            { id: "UNITS_PER_PACK", value_name: "1" },
            { id: "EMPTY_GTIN_REASON", value_name: "O produto não tem código cadastrado" },
            // WITH_GEMSTONE is required for earrings (MLB1432)
            ...(cat.category_id === "MLB1432" ? [{ id: "WITH_GEMSTONE", value_name: "Não" }] : [])
          ]
        };

        console.log(`🚀 Criando anúncio unificado no Mercado Livre com ${pictureIds.length} foto(s)...`);
        let itemRes = await fetchMeli("/items", {
          method: "POST",
          body: JSON.stringify(mlPayload)
        });

        if (!itemRes.ok) {
          const errData = await itemRes.json();
          console.warn(`⚠️ Tentativa com categoria ${targetCategory} retornou erro. Tentando fallback MLB1440...`);
          mlPayload.category_id = "MLB1440";
          itemRes = await fetchMeli("/items", {
            method: "POST",
            body: JSON.stringify(mlPayload)
          });

          if (!itemRes.ok) {
            const fallbackErr = await itemRes.json();
            throw new Error(`Erro ao criar item no ML: ${JSON.stringify(fallbackErr)}`);
          }
        }

        const itemData = await itemRes.json();
        const mlItemId = itemData.id;
        console.log(`🎉 Sucesso! Produto unificado criado no ML: ${mlItemId} (${pictureIds.length} fotos)`);
        console.log(`Link: ${itemData.permalink}`);

        // 3. Salvar/Atualizar no Banco de Dados local
        const newProduct: DBProduct = {
          id: `prod-${sku}`,
          name: seoTitle,
          sku: sku,
          basePrice: PRICE,
          shopeeStock: 0,
          shopeeSynced: false,
          mlStock: STOCK,
          mlSynced: true,
          mlItemId: mlItemId,
          totalStock: STOCK,
          lastSync: new Date().toLocaleTimeString("pt-BR"),
          description: seoDescription,
          imageUrl: firstPictureUrl || `http://http2.mlstatic.com/D_NQ_NP_${pictureIds[0].id}-F.jpg`,
          images: pictureIds.map(p => `http://http2.mlstatic.com/D_NQ_NP_${p.id}-F.jpg`)
        };

        if (existingSkuMap.has(sku)) {
          const existingIdx = existingSkuMap.get(sku)!;
          existingProducts[existingIdx] = newProduct;
        } else {
          existingProducts.push(newProduct);
          existingSkuMap.set(sku, existingProducts.length - 1);
        }

        await saveDBProducts(existingProducts);

        totalUploaded++;
        console.log(`💾 Produto unificado ${sku} atualizado no sistema.`);

        await new Promise(r => setTimeout(r, 800));

      } catch (err: any) {
        console.error(`❌ Erro no cadastro do produto ${sku}:`, err.message || err);
        totalErrors++;
      }
    }
  }

  console.log("\n=================================================");
  console.log(`✅ UPLOAD UNIFICADO CONCLUÍDO!`);
  console.log(`Total de produtos processados: ${totalProcessed}`);
  console.log(`Total de produtos cadastrados com sucesso: ${totalUploaded}`);
  console.log(`Total de erros: ${totalErrors}`);
  console.log("=================================================");
}

uploadUnifiedProducts().catch(console.error);
