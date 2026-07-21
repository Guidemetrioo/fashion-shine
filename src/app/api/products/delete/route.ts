import { NextRequest, NextResponse } from "next/server";
import { getDBProducts, saveDBProducts } from "../../../../utils/productStorage";
import { sql, isNeonConfigured } from "../../../../utils/neonClient";
import { deleteProductFromChannels } from "../../../../utils/syncEngine";

export async function POST(request: NextRequest) {
  try {
    const { productId } = await request.json();

    if (!productId) {
      return NextResponse.json({ error: "Missing productId" }, { status: 400 });
    }

    const dbProducts = await getDBProducts();
    const productIndex = dbProducts.findIndex(p => p.id === productId);

    if (productIndex === -1) {
      return NextResponse.json({ error: "Product not found in database" }, { status: 404 });
    }

    const product = dbProducts[productIndex];

    // Delete from sales channels (Mercado Livre, Shopee) if connected
    try {
      await deleteProductFromChannels(product);
    } catch (chErr) {
      console.error(`Failed to delete product ${product.sku} from sales channels:`, chErr);
    }

    // Remove from array
    dbProducts.splice(productIndex, 1);

    // Save local JSON backup/DB file
    await saveDBProducts(dbProducts);

    // Remove from Neon database if configured
    if (isNeonConfigured()) {
      try {
        await sql`DELETE FROM products WHERE id = ${productId}`;
        console.log(`Successfully deleted product ${productId} (${product.sku}) from Neon Database.`);
      } catch (dbErr: any) {
        console.error("Neon database deletion failed:", dbErr);
        // We continue since the local storage was already updated and saved
      }
    }

    return NextResponse.json({
      success: true,
      message: `Product ${product.name} (SKU: ${product.sku}) successfully deleted.`
    });
  } catch (error: any) {
    console.error("Failed to delete product:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
