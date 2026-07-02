import { NextRequest, NextResponse } from "next/server";
import { getTokens } from "../../../../../utils/tokenStorage";
import { getDBProducts, saveDBProducts, DBProduct } from "../../../../../utils/productStorage";

export async function POST(request: NextRequest) {
  const tokens = await getTokens();

  if (!tokens.mercadolivre.connected) {
    return NextResponse.json({ error: "Mercado Livre account not connected" }, { status: 400 });
  }

  try {
    // 1. Search item IDs of the seller
    const searchUrl = `https://api.mercadolibre.com/users/${tokens.mercadolivre.userId}/items/search?limit=100`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${tokens.mercadolivre.accessToken}`,
      },
    });

    if (!searchRes.ok) {
      console.error("Failed to fetch product list from ML API.");
      return NextResponse.json({ error: "ML API error fetching product list" }, { status: searchRes.status });
    }

    const searchData = await searchRes.json();
    const itemIds: string[] = searchData.results || [];

    if (itemIds.length === 0) {
      return NextResponse.json({ 
        success: true, 
        importedCount: 0, 
        updatedCount: 0, 
        message: "No products found in Mercado Livre account." 
      });
    }

    // 2. Fetch details for items in batches of 20
    const allMlProducts: any[] = [];
    const batchSize = 20;
    for (let i = 0; i < itemIds.length; i += batchSize) {
      const batchIds = itemIds.slice(i, i + batchSize).join(",");
      const detailUrl = `https://api.mercadolibre.com/items?ids=${batchIds}`;
      const detailRes = await fetch(detailUrl, {
        headers: {
          Authorization: `Bearer ${tokens.mercadolivre.accessToken}`,
        },
      });

      if (detailRes.ok) {
        const detailData = await detailRes.json();
        allMlProducts.push(...detailData);
      }
    }

    const dbProducts = await getDBProducts();
    let importedCount = 0;
    let updatedCount = 0;

    for (const resItem of allMlProducts) {
      const item = resItem.body;
      if (!item) continue;

      // Extract SKU attribute
      const skuAttr = (item.attributes || []).find((attr: any) => attr.id === "SELLER_SKU");
      const sku = skuAttr && skuAttr.value_name ? skuAttr.value_name.trim() : "";
      
      const mlItemId = item.id;
      const name = item.title;
      const basePrice = item.price || 0;
      const mlStock = item.available_quantity || 0;

      // Find if product already exists in local DB
      // We look by mlItemId first, then by SKU (if SKU is defined)
      let existingProduct = dbProducts.find(p => p.mlItemId === mlItemId);
      if (!existingProduct && sku) {
        existingProduct = dbProducts.find(p => p.sku === sku);
      }

      if (existingProduct) {
        // Update existing product
        existingProduct.mlItemId = mlItemId;
        existingProduct.mlStock = mlStock;
        existingProduct.mlSynced = true;
        // Keep Shopee stock, update total
        existingProduct.totalStock = existingProduct.shopeeStock + mlStock;
        existingProduct.lastSync = new Date().toLocaleTimeString("pt-BR");
        
        // Update name and price if they match the central product
        if (!existingProduct.name) {
          existingProduct.name = name;
        }
        updatedCount++;
      } else {
        // Create new product
        const newProduct: DBProduct = {
          id: `ml-prod-${mlItemId}`,
          name: name,
          sku: sku || mlItemId,
          basePrice: basePrice,
          shopeeStock: 0,
          shopeeSynced: false,
          mlStock: mlStock,
          mlSynced: true,
          mlItemId: mlItemId,
          totalStock: mlStock,
          lastSync: new Date().toLocaleTimeString("pt-BR")
        };
        dbProducts.push(newProduct);
        importedCount++;
      }
    }

    // Save back to DB
    await saveDBProducts(dbProducts);

    return NextResponse.json({
      success: true,
      importedCount,
      updatedCount,
      totalCount: dbProducts.length
    });
  } catch (error: any) {
    console.error("ML Catalog Import failed:", error);
    return NextResponse.json({ error: "Catalog import failed", details: error.message }, { status: 500 });
  }
}
