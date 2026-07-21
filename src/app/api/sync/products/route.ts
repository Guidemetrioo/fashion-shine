import { NextRequest, NextResponse } from "next/server";
import { getDBProducts, saveDBProducts } from "../../../../utils/productStorage";
import { syncStockToChannels } from "../../../../utils/syncEngine";

export const dynamic = "force-dynamic";

export async function GET() {
  const products = await getDBProducts();
  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  try {
    const { productId, shopeeStock, mlStock, channel } = await request.json();

    const products = await getDBProducts();
    const productIndex = products.findIndex(p => p.id === productId);

    if (productIndex === -1) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const p = products[productIndex];

    // Update the specific stock level changed
    if (channel === "shopee") {
      p.shopeeStock = shopeeStock;
    } else if (channel === "mercadolivre") {
      p.mlStock = mlStock;
    }

    // Consolidated unified stock
    const newStock = channel === "shopee" ? shopeeStock : mlStock;
    p.shopeeStock = newStock;
    p.mlStock = newStock;
    p.totalStock = newStock;
    p.lastSync = new Date().toLocaleTimeString("pt-BR");

    await saveDBProducts(products);

    // Push the updated stock level to all connected APIs
    await syncStockToChannels(p.sku, newStock, undefined);

    return NextResponse.json({ success: true, product: p });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
