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
      categoryId,
      condition,
      listing_type_id,
      gtin,
      brand,
      material,
      color,
      gender,
      sizes,
      weight,
      length,
      width,
      height
    } = body;

    if (!name || !sku) {
      return NextResponse.json({ error: "Nome e SKU são obrigatórios" }, { status: 400 });
    }

    if (publishToMeli) {
      if (name.trim().length > 60) {
        return NextResponse.json({ error: "O título do anúncio para o Mercado Livre deve ter no máximo 60 caracteres." }, { status: 400 });
      }
      if (!brand || !brand.trim()) {
        return NextResponse.json({ error: "A marca (BRAND) é obrigatória para publicar no Mercado Livre." }, { status: 400 });
      }
      if (!material || !material.trim()) {
        return NextResponse.json({ error: "O material principal (MATERIAL) é obrigatório para publicar no Mercado Livre." }, { status: 400 });
      }
      if (!gender || !gender.trim()) {
        return NextResponse.json({ error: "O gênero (GENDER) é obrigatório para publicar no Mercado Livre." }, { status: 400 });
      }
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

      // Build ML attributes array dynamically
      const mlAttributes = [
        { id: "BRAND", value_name: brand.trim() },
        { id: "MODEL", value_name: sku.trim() },
        { id: "GTIN", value_name: gtin ? gtin.trim() : "Não se aplica" },
        { id: "MATERIAL", value_name: material.trim() },
        { id: "GENDER", value_name: gender.trim() }
      ];

      if (color && color.trim()) {
        mlAttributes.push({ id: "COLOR", value_name: color.trim() });
      }
      if (sizes && sizes.trim()) {
        mlAttributes.push({ id: "SIZE", value_name: sizes.trim() });
      }
      if (weight) {
        mlAttributes.push({ id: "PACKAGE_WEIGHT", value_name: `${weight} g` });
      }
      if (length) {
        mlAttributes.push({ id: "PACKAGE_LENGTH", value_name: `${length} cm` });
      }
      if (width) {
        mlAttributes.push({ id: "PACKAGE_WIDTH", value_name: `${width} cm` });
      }
      if (height) {
        mlAttributes.push({ id: "PACKAGE_HEIGHT", value_name: `${height} cm` });
      }

      const mlPayload = {
        title: name.trim(),
        category_id: categoryId || "MLB1434", // Default to Jewelry/Necklaces
        price: priceNum,
        currency_id: "BRL",
        available_quantity: mlStockNum,
        buying_mode: "buy_it_now",
        listing_type_id: listing_type_id || "gold_special",
        condition: condition || "new",
        pictures: imageUrl ? [{ source: publicImageUrl }] : [],
        description: {
          plain_text: description || "Produto de alta qualidade da Fashion Shine."
        },
        attributes: mlAttributes
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
