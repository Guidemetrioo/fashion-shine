import { NextRequest, NextResponse } from "next/server";
import { getDBProducts, saveDBProducts, DBProduct } from "../../../../utils/productStorage";
import { syncStockToChannels } from "../../../../utils/syncEngine";

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
      mlItemId
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

    const newProduct: DBProduct = {
      id: `prod-${Date.now()}`,
      name: name.trim(),
      sku: sku.trim(),
      basePrice: priceNum,
      shopeeStock: shopeeStockNum,
      shopeeSynced: !!shopeeItemId,
      shopeeItemId: shopeeItemId || undefined,
      mlStock: mlStockNum,
      mlSynced: !!mlItemId,
      mlItemId: mlItemId || undefined,
      totalStock: shopeeStockNum + mlStockNum,
      lastSync: new Date().toLocaleTimeString("pt-BR"),
      description: description || undefined,
      imageUrl: imageUrl || undefined
    };

    products.push(newProduct);
    await saveDBProducts(products);

    // If external Item IDs are provided, propagate stock to channels immediately
    const promises: Promise<any>[] = [];
    if (shopeeItemId) {
      promises.push(syncStockToChannels(newProduct.sku, shopeeStockNum, "mercadolivre"));
    }
    if (mlItemId) {
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
