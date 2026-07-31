import { NextResponse } from "next/server";
import { getDBProducts, saveDBProducts } from "@/utils/productStorage";
import { sql, isNeonConfigured } from "@/utils/neonClient";

export async function POST(request: Request) {
  try {
    const { productId } = await request.json();

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const products = await getDBProducts();
    const product = products.find(p => p.id === productId || p.sku === productId);

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const newCheckedState = !product.isChecked;
    product.isChecked = newCheckedState;

    // Save locally to products.json
    await saveDBProducts(products);

    // Also update directly in Neon DB
    if (isNeonConfigured()) {
      try {
        await sql`
          UPDATE products
          SET is_checked = ${newCheckedState}
          WHERE id = ${product.id} OR sku = ${product.sku}
        `;
      } catch (dbErr) {
        console.error("Failed to update is_checked in Neon DB:", dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      productId: product.id,
      isChecked: newCheckedState
    });
  } catch (error: any) {
    console.error("Error toggling product check state:", error);
    return NextResponse.json({ error: error.message || "Failed to toggle check state" }, { status: 500 });
  }
}
