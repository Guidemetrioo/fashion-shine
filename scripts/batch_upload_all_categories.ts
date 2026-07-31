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
  { folder: "Colares", category_id: "MLB457416", skuPrefix: "FS-COLAR", name: "Colares" },
  { folder: "Pulseiras", category_id: "MLB1434", skuPrefix: "FS-PULSEIRA", name: "Pulseiras" },
  { folder: "Óculos", category_id: "MLB8378", skuPrefix: "FS-OCULOS", name: "Óculos de Sol" }
];

// Otimizador SEO de Títulos (Respeita limite de 60 caracteres do Mercado Livre)
function generateSeoTitle(categoryName: string, refNum: string): string {
  const num = parseInt(refNum, 10) || 0;
  
  if (categoryName === "Brincos") {
    const variants = [
      `Brinco Semijoia Banhado Ouro 18k Ref ${refNum}`,
      `Brinco Feminino Elegante Banhado Ouro Ref ${refNum}`,
      `Brinco Cravejado Zircônia Banhado Ouro Ref ${refNum}`,
      `Brinco Design Exclusivo Semijoia Fina Ref ${refNum}`
    ];
    return variants[num % variants.length].slice(0, 60);
  }
  
  if (categoryName === "Colares") {
    const variants = [
      `Colar Feminino Semijoia Banhado Ouro Ref ${refNum}`,
      `Colar Corrente Pingente Banhado Ouro Ref ${refNum}`,
      `Gargantilha Colar Elegante Banhado Ouro Ref ${refNum}`,
      `Colar Feminino Delicado Semijoia Fina Ref ${refNum}`
    ];
    return variants[num % variants.length].slice(0, 60);
  }

  if (categoryName === "Pulseiras") {
    const variants = [
      `Pulseira Feminina Semijoia Banhada Ouro Ref ${refNum}`,
      `Pulseira Elegante Malha Banhada a Ouro Ref ${refNum}`,
      `Pulseira Delicada Feminina Banhada Ouro Ref ${refNum}`
    ];
    return variants[num % variants.length].slice(0, 60);
  }

  // Óculos de Sol
  const variants = [
    `Óculos de Sol Feminino Proteção UV400 Ref ${refNum}`,
    `Óculos de Sol Design Moderno Lentes UV Ref ${refNum}`,
    `Óculos de Sol Proteção UV400 Fashion Ref ${refNum}`
  ];
  return variants[num % variants.length].slice(0, 60);
}

// Otimizador SEO de Descrições Ricas
function generateSeoDescription(title: string, categoryName: string, sku: string, refNum: string): string {
  if (categoryName === "Óculos de Sol") {
    return `${title} - Fashion Shine

Modelagem exclusiva de alta qualidade para compor seu visual com sofisticação e total proteção solar.

FICHA TÉCNICA:
- Marca: ${BRAND_NAME}
- Modelo / Linha: Óculos de Sol Premium
- Proteção Solar: Lentes com Proteção UV400
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

async function runBatchUpload() {
  console.log("=================================================");
  console.log("🚀 INICIANDO CADASTRO MASSIVO DE PRODUTOS (SEO)");
  console.log("=================================================\n");

  const tokens = await getTokens();
  if (!tokens.mercadolivre.connected) {
    throw new Error("❌ Mercado Livre não está conectado! Conecte a conta antes de rodar.");
  }

  const existingProducts = await getDBProducts();
  const existingSkus = new Set(existingProducts.map(p => p.sku));
  console.log(`📦 Produtos existentes no sistema: ${existingProducts.length}`);

  let totalUploaded = 0;
  let totalErrors = 0;

  for (const cat of CATEGORIES) {
    const folderPath = path.join(FOTOS_BASE_DIR, cat.folder);
    if (!fs.existsSync(folderPath)) {
      console.log(`⚠️ Pasta não encontrada: ${folderPath}`);
      continue;
    }

    const files = fs.readdirSync(folderPath).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    console.log(`\n📁 Categoria: [${cat.name}] - Total de fotos: ${files.length}`);

    for (let i = 0; i < files.length; i++) {
      const filename = files[i];
      const filePath = path.join(folderPath, filename);

      const match = filename.match(/\d+/);
      const refNum = match ? match[0] : `${i + 100}`;
      const sku = `${cat.skuPrefix}-${refNum}`;

      // Evitar recadastrar SKU que já está no banco de dados local
      if (existingSkus.has(sku)) {
        console.log(`⏩ SKU ${sku} já cadastrado no sistema. Pulando...`);
        continue;
      }

      const seoTitle = generateSeoTitle(cat.name, refNum);
      const seoDescription = generateSeoDescription(seoTitle, cat.name, sku, refNum);

      console.log(`\n----------------------------------------`);
      console.log(`[${i + 1}/${files.length}] Cadastrando ${cat.name} | SKU: ${sku}`);
      console.log(`Foto: ${filename}`);
      console.log(`Título SEO: "${seoTitle}"`);

      try {
        // 1. Upload da Foto para o Mercado Livre
        console.log(`📤 Enviando foto ao Mercado Livre...`);
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
          const errTxt = await uploadRes.text();
          throw new Error(`Upload da foto falhou (${uploadRes.status}): ${errTxt}`);
        }

        const uploadData = await uploadRes.json();
        const pictureId = uploadData.id;
        const pictureUrl = uploadData.variations?.[0]?.url || uploadData.url || "";
        console.log(`✅ Foto enviada! Picture ID: ${pictureId}`);

        // 2. Criar Anúncio no Mercado Livre
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
          pictures: [{ id: pictureId }],
          description: { plain_text: seoDescription },
          attributes: [
            { id: "BRAND", value_name: BRAND_NAME },
            { id: "MODEL", value_name: sku },
            { id: "SELLER_SKU", value_name: sku },
            { id: "MATERIAL", value_name: cat.name === "Óculos de Sol" ? "Acetato / Metal" : "Banhado a Ouro 18k" }
          ]
        };

        console.log(`🚀 Criando anúncio no Mercado Livre (Categoria: ${targetCategory})...`);
        let itemRes = await fetchMeli("/items", {
          method: "POST",
          body: JSON.stringify(mlPayload)
        });

        // Se der erro de categoria específica, tentar fallback na categoria geral MLB1440
        if (!itemRes.ok) {
          const errData = await itemRes.json();
          console.warn(`⚠️ Tentativa com categoria ${targetCategory} retornou erro. Tentando fallback MLB1440 (Outros)...`);
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
        console.log(`🎉 Sucesso! Item criado no ML: ${mlItemId}`);

        // 3. Salvar no Banco de Dados / products.json
        const newProduct: DBProduct = {
          id: `ml-prod-${mlItemId}`,
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
          imageUrl: pictureUrl || `http://http2.mlstatic.com/D_NQ_NP_${pictureId}-F.jpg`
        };

        existingProducts.push(newProduct);
        existingSkus.add(sku);
        await saveDBProducts(existingProducts);

        totalUploaded++;
        console.log(`💾 Produto ${sku} salvo no sistema com sucesso!`);

        // Pequena pausa para evitar rate limit de requisições na API do Mercado Livre
        await new Promise(r => setTimeout(r, 800));

      } catch (err: any) {
        console.error(`❌ Erro no cadastro do produto ${sku}:`, err.message || err);
        totalErrors++;
      }
    }
  }

  console.log("\n=================================================");
  console.log(`✅ CADASTRO CONCLUÍDO!`);
  console.log(`Total de produtos cadastrados nesta sessão: ${totalUploaded}`);
  console.log(`Total de erros: ${totalErrors}`);
  console.log(`Total geral no sistema: ${existingProducts.length}`);
  console.log("=================================================");
}

runBatchUpload().catch(console.error);
