import { NextRequest, NextResponse } from "next/server";
import { getTokens, fetchMeli } from "../../../../../utils/tokenStorage";
import { getDBProducts, saveDBProducts, DBProduct, getDeletedIdentifiers } from "../../../../../utils/productStorage";
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
    // 1. Search ALL item IDs of the seller (paginate through results)
    const allItemIds: string[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const searchRes = await fetchMeli(`/users/${tokens.mercadolivre.userId}/items/search?limit=${limit}&offset=${offset}`);

      if (!searchRes.ok) {
        console.warn(`ML API product list returned status ${searchRes.status} at offset ${offset}. Using stored catalog products.`);
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
      const batchIds: string[] = searchData.results || [];
      allItemIds.push(...batchIds);

      const total = searchData.paging?.total || 0;
      offset += limit;
      hasMore = offset < total && batchIds.length > 0;
    }

    const itemIds = allItemIds;

    if (itemIds.length === 0) {
      // Even if ML returns 0 items, keep existing system products
      const dbProducts = await getDBProducts();
      return NextResponse.json({ 
        success: true, 
        importedCount: 0, 
        updatedCount: dbProducts.length,
        totalCount: dbProducts.length,
        message: "No new products found in Mercado Livre account. Existing catalog preserved." 
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
    const deletedSet = await getDeletedIdentifiers();
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

      // Check tombstone set - skip permanently deleted items
      if (
        deletedSet.has(mlItemId) ||
        (sku && deletedSet.has(sku)) ||
        deletedSet.has(`ml-prod-${mlItemId}`) ||
        deletedSet.has(`prod-ml-${mlItemId}`)
      ) {
        console.log(`[ML Import]: Skipping permanently deleted item ${mlItemId} (SKU: ${sku})`);
        continue;
      }

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
        existingProduct.shopeeStock = mlStock;
        existingProduct.totalStock = mlStock;
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

    // Keep ALL products in the database.
    // Only remove products that are clearly mock/test items (not real ML items AND not system-registered).
    // NEVER remove products with FS-JOIA or prod-ml- prefixes — these were registered by the system.
    const realMlItemIds = new Set(allMlProducts.map(p => p.body?.id).filter(Boolean));
    const productsToKeep: DBProduct[] = [];
    const idsToDelete: string[] = [];

    for (const p of dbProducts) {
      // System-registered products are ALWAYS kept (FS-JOIA SKUs, prod-ml- IDs)
      const isSystemRegistered = p.sku.startsWith("FS-JOIA") || p.id.startsWith("prod-ml-") || p.id.startsWith("prod-");
      const isRealMlProduct = p.mlItemId && realMlItemIds.has(p.mlItemId);
      const hasShopee = p.shopeeSynced || (p.shopeeStock && p.shopeeStock > 0);

      if (isSystemRegistered || isRealMlProduct || hasShopee) {
        // Keep it
        productsToKeep.push(p);
      } else {
        // Only delete pure ml-prod- imports that are NOT returned by ML anymore
        const isMlOnlyProduct = p.id.startsWith("ml-prod-");
        if (isMlOnlyProduct && !isRealMlProduct) {
          idsToDelete.push(p.id);
        } else {
          productsToKeep.push(p);
        }
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
