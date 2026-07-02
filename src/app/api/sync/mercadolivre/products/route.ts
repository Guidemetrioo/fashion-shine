import { NextRequest, NextResponse } from "next/server";
import { getTokens } from "../../../../../utils/tokenStorage";

export async function GET(request: NextRequest) {
  const tokens = await getTokens();

  if (!tokens.mercadolivre.connected) {
    return NextResponse.json({ connected: false, products: [] });
  }

  try {
    // 1. Search item IDs of the seller
    const searchUrl = `https://api.mercadolibre.com/users/${tokens.mercadolivre.userId}/items/search`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${tokens.mercadolivre.accessToken}`,
      },
    });

    if (!searchRes.ok) {
      console.warn("Failed to fetch product list from ML API. Token might be expired.");
      return NextResponse.json({
        connected: true,
        products: [],
        error: "ML API error fetching product list"
      });
    }

    const searchData = await searchRes.json();
    const itemIds: string[] = searchData.results || [];

    if (itemIds.length === 0) {
      return NextResponse.json({ connected: true, products: [] });
    }

    // 2. Fetch details for items (Meli supports querying up to 20 IDs comma separated)
    const detailIds = itemIds.slice(0, 20).join(",");
    const detailUrl = `https://api.mercadolibre.com/items?ids=${detailIds}`;
    const detailRes = await fetch(detailUrl, {
      headers: {
        Authorization: `Bearer ${tokens.mercadolivre.accessToken}`,
      },
    });

    if (!detailRes.ok) {
      return NextResponse.json({
        connected: true,
        products: [],
        error: "ML API error fetching product details"
      });
    }

    const detailData = await detailRes.json();

    // Map Meli items into system products format
    const mappedProducts = detailData.map((resItem: any) => {
      const item = resItem.body;
      if (!item) return null;

      // Extract SKU attribute
      const skuAttr = (item.attributes || []).find((attr: any) => attr.id === "SELLER_SKU");
      const sku = skuAttr ? skuAttr.value_name : item.id;

      return {
        id: item.id,
        name: item.title,
        sku: sku || item.id,
        basePrice: item.price,
        shopeeStock: 0,
        shopeeSynced: false,
        mlStock: item.available_quantity,
        mlSynced: true,
        totalStock: item.available_quantity,
        lastSync: new Date().toLocaleTimeString("pt-BR"),
      };
    }).filter(Boolean);

    return NextResponse.json({
      connected: true,
      products: mappedProducts
    });
  } catch (error: any) {
    console.error("ML Products fetch failed:", error);
    return NextResponse.json({ error: "Failed to fetch products", details: error.message }, { status: 500 });
  }
}
