import { NextRequest, NextResponse } from "next/server";
import { getDBProducts, saveDBProducts, DBProduct } from "../../../../utils/productStorage";
import { syncStockToChannels, publishProductToShopee } from "../../../../utils/syncEngine";
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
      shopeeItemId: initialShopeeItemId,
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
      height,
      publishToShopee,
      shopeeCategoryId,
      shopeeBrandId,
      shopeeIsPreOrder,
      shopeeDaysToShip,
      shopeeLogistics,
      publishToTiktok,
      tiktokCategoryId,
      tiktokBrandId,
      withGemstone
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

      // Support direct picture upload to ML if base64 is provided
      let mlPictureId: string | null = null;
      if (imageUrl && imageUrl.startsWith("data:image")) {
        try {
          const match = imageUrl.match(/^data:(image\/\w+);base64,(.*)$/);
          if (match) {
            const mimeType = match[1];
            const base64Data = match[2];
            const buffer = Buffer.from(base64Data, "base64");
            const blob = new Blob([buffer], { type: mimeType });
            const formData = new FormData();
            formData.append("file", blob, `product-${productId}.jpg`);

            const uploadRes = await fetchMeli("/pictures/items/upload", {
              method: "POST",
              body: formData as any
            });

            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              if (uploadData.id) {
                mlPictureId = uploadData.id;
              }
            }
          }
        } catch (e) {
          console.error("Failed direct ML picture upload:", e);
        }
      }

      // Generate public image URL using the dynamic route handler as fallback
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const publicImageUrl = `${appUrl}/api/products/image/${productId}`;

      const mlAttributes = [
        { id: "BRAND", value_name: brand.trim() },
        { id: "MODEL", value_name: sku.trim() },
        { id: "MATERIAL", value_name: material.trim() },
        { id: "GENDER", value_name: gender.trim() }
      ];

      if (gtin && gtin.trim() !== "" && gtin.trim().toLowerCase() !== "não se aplica" && gtin.trim().toLowerCase() !== "naoseaplica") {
        mlAttributes.push({ id: "GTIN", value_name: gtin.trim() });
      }

      if (categoryId === "MLB1432" || withGemstone) {
        mlAttributes.push({ id: "WITH_GEMSTONE", value_name: withGemstone ? withGemstone.trim() : "Sim" });
      }

      if (color && color.trim()) {
        mlAttributes.push({ id: "COLOR", value_name: color.trim() });
      }
      if (sizes && sizes.trim()) {
        mlAttributes.push({ id: "SIZE", value_name: sizes.trim() });
      }
      if (weight) {
        mlAttributes.push({ id: "seller_package_weight", value_name: `${weight} g` });
      }
      if (length) {
        mlAttributes.push({ id: "seller_package_length", value_name: `${length} cm` });
      }
      if (width) {
        mlAttributes.push({ id: "seller_package_width", value_name: `${width} cm` });
      }
      if (height) {
        mlAttributes.push({ id: "seller_package_height", value_name: `${height} cm` });
      }

      const mlPayload: any = {
        family_name: name.trim(),
        category_id: categoryId || "MLB1434",
        price: priceNum,
        currency_id: "BRL",
        available_quantity: mlStockNum,
        buying_mode: "buy_it_now",
        listing_type_id: listing_type_id || "gold_special",
        condition: condition || "new",
        pictures: mlPictureId
          ? [{ id: mlPictureId }]
          : (imageUrl 
            ? (imageUrl.startsWith("http") ? [{ source: imageUrl }] : [{ source: publicImageUrl }])
            : []),
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

    let shopeeItemId = initialShopeeItemId || undefined;
    let shopeeSynced = !!initialShopeeItemId;

    if (publishToShopee) {
      const tokens = await getTokens();
      if (!tokens.shopee.connected) {
        return NextResponse.json({ error: "Integração da Shopee não está ativa." }, { status: 400 });
      }

      console.log(`[Shopee Publisher]: Publishing item SKU ${sku} to Shopee...`);
      const result = await publishProductToShopee({
        name,
        description: description || "Produto de alta qualidade da Fashion Shine.",
        sku,
        price: priceNum,
        stock: shopeeStockNum,
        categoryId: Number(shopeeCategoryId || 101140),
        brandId: Number(shopeeBrandId || 0),
        weight: Number(weight || 0) / 1000, // convert grams to kg
        length: length ? Number(length) : undefined,
        width: width ? Number(width) : undefined,
        height: height ? Number(height) : undefined,
        imageUrl,
        isPreOrder: !!shopeeIsPreOrder,
        daysToShip: shopeeDaysToShip ? Number(shopeeDaysToShip) : 7,
        logistics: shopeeLogistics || ["correios"]
      });

      if (!result.success) {
        return NextResponse.json({ error: `Falha ao publicar na Shopee: ${result.error}` }, { status: 400 });
      }

      shopeeItemId = result.itemId;
      shopeeSynced = true;
    }

    const newProduct: DBProduct = {
      id: productId,
      name: name.trim(),
      sku: sku.trim(),
      basePrice: priceNum,
      shopeeStock: shopeeStockNum,
      shopeeSynced: shopeeSynced,
      shopeeItemId: shopeeItemId,
      mlStock: mlStockNum,
      mlSynced: mlSynced,
      mlItemId: mlItemId,
      totalStock: shopeeStockNum,
      lastSync: new Date().toLocaleTimeString("pt-BR"),
      description: description || undefined,
      imageUrl: imageUrl || undefined,
      shopeeCategoryId: shopeeCategoryId || undefined,
      shopeeBrandId: shopeeBrandId || undefined,
      shopeeIsPreOrder: !!shopeeIsPreOrder,
      shopeeDaysToShip: shopeeDaysToShip ? Number(shopeeDaysToShip) : undefined,
      shopeeLogistics: shopeeLogistics || [],
      tiktokCategoryId: tiktokCategoryId || undefined,
      tiktokBrandId: tiktokBrandId || undefined
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
