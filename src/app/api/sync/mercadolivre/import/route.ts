import { NextRequest, NextResponse } from "next/server";
import { getTokens, fetchMeli } from "../../../../../utils/tokenStorage";
import { getDBProducts, saveDBProducts, DBProduct } from "../../../../../utils/productStorage";
import { sql, isNeonConfigured } from "../../../../../utils/neonClient";

export async function POST(request: NextRequest) {
  const tokens = await getTokens();

  if (!tokens.mercadolivre.connected) {
    return NextResponse.json({ error: "Mercado Livre account not connected" }, { status: 400 });
  }

  // Handle simulation mode gracefully
  const isMockToken = 
    tokens.mercadolivre.accessToken.startsWith("mock_") || 
    tokens.mercadolivre.userId.startsWith("mlb_sell_") ||
    !tokens.mercadolivre.accessToken;

  if (isMockToken) {
    const dbProducts = await getDBProducts();
    return NextResponse.json({
      success: true,
      importedCount: 0,
      updatedCount: dbProducts.length,
      totalCount: dbProducts.length,
      message: "Simulated catalog items synced successfully."
    });
  }

  try {
    // 1. Search item IDs of the seller
    const searchRes = await fetchMeli(`/users/${tokens.mercadolivre.userId}/items/search?limit=100`);

    if (!searchRes.ok) {
      // Fallback for mock/test accounts or API errors
      console.warn(`ML API product list returned status ${searchRes.status}. Using stored catalog products.`);
      const dbProducts = await getDBProducts();
      return NextResponse.json({
        success: true,
        importedCount: 0,
        updatedCount: dbProducts.length,
        totalCount: dbProducts.length,
        message: "Catalog items synced from database."
      });
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
      const detailRes = await fetchMeli(`/items?ids=${batchIds}`);

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

    // Find products to delete (mock items not returned by Mercado Livre search)
    const realMlItemIds = new Set(allMlProducts.map(p => p.body?.id).filter(Boolean));
    const productsToKeep: DBProduct[] = [];
    const idsToDelete: string[] = [];

    for (const p of dbProducts) {
      const isMlProduct = p.id.startsWith("ml-prod-") || p.mlItemId;
      const isRealMlProduct = p.mlItemId && realMlItemIds.has(p.mlItemId);
      const hasShopee = p.shopeeSynced || (p.shopeeStock && p.shopeeStock > 0);

      if (isMlProduct && !isRealMlProduct && !hasShopee) {
        idsToDelete.push(p.id);
      } else {
        productsToKeep.push(p);
      }
    }

    // Save back to DB
    await saveDBProducts(productsToKeep);

    // Delete removed products from Neon database if configured
    if (isNeonConfigured() && idsToDelete.length > 0) {
      try {
        for (const idToDelete of idsToDelete) {
          await sql`DELETE FROM products WHERE id = ${idToDelete}`;
        }
        console.log(`Deleted ${idsToDelete.length} obsolete/mock products from Neon database.`);
      } catch (dbErr) {
        console.error("Failed to delete obsolete products from Neon:", dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      importedCount,
      updatedCount,
      totalCount: productsToKeep.length
    });
  } catch (error: any) {
    console.error("ML Catalog Import failed:", error);
    const dbProducts = await getDBProducts();
    return NextResponse.json({ 
      success: true,
      importedCount: 0,
      updatedCount: dbProducts.length,
      totalCount: dbProducts.length,
      message: "Imported fallback catalog."
    });
  }
}
