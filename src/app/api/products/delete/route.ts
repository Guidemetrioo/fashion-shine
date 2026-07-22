import { NextRequest, NextResponse } from "next/server";
import { getDBProducts, deleteDBProduct } from "../../../../utils/productStorage";
import { deleteProductFromChannels } from "../../../../utils/syncEngine";

export async function POST(request: NextRequest) {
  try {
    const { productId } = await request.json();

    if (!productId) {
      return NextResponse.json({ error: "Missing productId" }, { status: 400 });
    }

    const dbProducts = await getDBProducts();
    const product = dbProducts.find(
      p => p.id === productId || p.sku === productId || p.mlItemId === productId || p.shopeeItemId === productId
    );

    if (product) {
      // Delete from sales channels (Mercado Livre, Shopee) if connected
      try {
        await deleteProductFromChannels(product);
      } catch (chErr) {
        console.error(`Failed to delete product ${product.sku} from sales channels:`, chErr);
      }
    }

    // Delete permanently from local storage and Neon DB
    const deleted = await deleteDBProduct(productId);

    if (!deleted && !product) {
      return NextResponse.json({ error: "Product not found in database" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Product ${product?.name || productId} successfully deleted.`
    });
  } catch (error: any) {
    console.error("Failed to delete product:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
