import { NextRequest, NextResponse } from "next/server";
import { getDBProducts, saveDBProducts, DBProduct } from "../../../../utils/productStorage";
import { syncStockToChannels } from "../../../../utils/syncEngine";
import { getTokens, fetchMeli } from "../../../../utils/tokenStorage";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      sku,
      description,
      imageUrl,
      basePrice,
      shopeeStock,
      mlStock,
      shopeeItemId,
      mlItemId: initialMlItemId,
      publishToMeli,
      categoryId
    } = body;

    if (!name || !sku) {
      return NextResponse.json({ error: "Nome e SKU são obrigatórios" }, { status: 400 });
    }

    const products = await getDBProducts();
    
    // Check if SKU already exists
    const skuExists = products.some(p => p.sku.toLowerCase() === sku.toLowerCase().trim());
    if (skuExists) {
      return NextResponse.json({ error: `O SKU '${sku}' já está cadastrado` }, { status: 400 });
    }

    const shopeeStockNum = Number(shopeeStock || 0);
    const mlStockNum = Number(mlStock || 0);
    const priceNum = Number(basePrice || 0);

    const productId = `prod-${Date.now()}`;
    let mlItemId = initialMlItemId || undefined;
    let mlSynced = !!initialMlItemId;

    // 1. Publish to Mercado Livre if requested
    if (publishToMeli) {
      const tokens = await getTokens();
      if (!tokens.mercadolivre.connected) {
        return NextResponse.json({ error: "Integração do Mercado Livre não está ativa." }, { status: 400 });
      }

      // Generate public image URL using the dynamic route handler
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const publicImageUrl = `${appUrl}/api/products/image/${productId}`;

      const mlPayload = {
        title: name.trim(),
        category_id: categoryId || "MLB1434", // Default to Jewelry/Necklaces
        price: priceNum,
        currency_id: "BRL",
        available_quantity: mlStockNum,
        buying_mode: "buy_it_now",
        listing_type_id: "gold_special", // Default to classic
        condition: "new",
        pictures: imageUrl ? [{ source: publicImageUrl }] : [],
        description: {
          plain_text: description || "Produto de alta qualidade da Fashion Shine."
        },
        attributes: [
          { id: "BRAND", value_name: "Fashion Shine" },
          { id: "MODEL", value_name: sku.trim() },
          { id: "GTIN", value_name: "Não se aplica" }
        ]
      };

      console.log(`[ML Publisher]: Publishing item SKU ${sku} to Mercado Livre...`);
      const mlResponse = await fetchMeli("/items", {
        method: "POST",
        body: JSON.stringify(mlPayload)
      });

      if (!mlResponse.ok) {
        const errorData = await mlResponse.json();
        console.error("[ML Publisher Error]:", errorData);
        return NextResponse.json({ 
          error: `Falha ao publicar no Mercado Livre: ${errorData.message || JSON.stringify(errorData)}` 
        }, { status: 400 });
      }

      const mlData = await mlResponse.json();
      mlItemId = mlData.id;
      mlSynced = true;
      console.log(`[ML Publisher Success]: Published successfully! Item ID: ${mlItemId}`);
    }

    const newProduct: DBProduct = {
      id: productId,
      name: name.trim(),
      sku: sku.trim(),
      basePrice: priceNum,
      shopeeStock: shopeeStockNum,
      shopeeSynced: !!shopeeItemId,
      shopeeItemId: shopeeItemId || undefined,
      mlStock: mlStockNum,
      mlSynced: mlSynced,
      mlItemId: mlItemId,
      totalStock: shopeeStockNum + mlStockNum,
      lastSync: new Date().toLocaleTimeString("pt-BR"),
      description: description || undefined,
      imageUrl: imageUrl || undefined
    };

    products.push(newProduct);
    await saveDBProducts(products);

    // If external Item IDs are provided (or was successfully published), propagate stock to channels immediately
    const promises: Promise<any>[] = [];
    if (shopeeItemId) {
      promises.push(syncStockToChannels(newProduct.sku, shopeeStockNum, "mercadolivre"));
    }
    if (mlItemId && !publishToMeli) {
      // If we manually entered the ML ID, sync the stock
      promises.push(syncStockToChannels(newProduct.sku, mlStockNum, "shopee"));
    }
    if (promises.length > 0) {
      await Promise.all(promises).catch(err => console.error("Initial stock sync failed:", err));
    }

    return NextResponse.json({ success: true, product: newProduct });
  } catch (err: any) {
    console.error("Error creating product:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
