import { NextResponse } from "next/server";
import { getDBProducts, saveDBProducts } from "@/utils/productStorage";
import { sql, isNeonConfigured } from "@/utils/neonClient";
import { fetchMeli, getTokens } from "@/utils/tokenStorage";

export async function POST(request: Request) {
  try {
    const { productId, name, basePrice } = await request.json();

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const products = await getDBProducts();
    const product = products.find(p => p.id === productId || p.sku === productId);

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    let isNameUpdated = false;
    let isPriceUpdated = false;

    if (name !== undefined && typeof name === "string" && name.trim() !== "") {
      product.name = name.trim();
      isNameUpdated = true;
    }

    if (basePrice !== undefined && typeof basePrice === "number" && !isNaN(basePrice) && basePrice >= 0) {
      product.basePrice = basePrice;
      isPriceUpdated = true;
    }

    product.lastSync = new Date().toLocaleTimeString("pt-BR");

    // Save back to DB / local JSON
    await saveDBProducts(products);

    // Also update Neon DB directly if configured
    if (isNeonConfigured()) {
      try {
        if (isNameUpdated && isPriceUpdated) {
          await sql`
            UPDATE products
            SET name = ${product.name}, base_price = ${product.basePrice}, last_sync = ${product.lastSync}
            WHERE id = ${product.id} OR sku = ${product.sku}
          `;
        } else if (isNameUpdated) {
          await sql`
            UPDATE products
            SET name = ${product.name}, last_sync = ${product.lastSync}
            WHERE id = ${product.id} OR sku = ${product.sku}
          `;
        } else if (isPriceUpdated) {
          await sql`
            UPDATE products
            SET base_price = ${product.basePrice}, last_sync = ${product.lastSync}
            WHERE id = ${product.id} OR sku = ${product.sku}
          `;
        }
      } catch (dbErr) {
        console.error("Failed to update product details in Neon DB:", dbErr);
      }
    }

    // Try updating Mercado Livre if synced
    let mlUpdateMsg = "";
    if (product.mlItemId) {
      try {
        const tokens = await getTokens();
        if (tokens.mercadolivre.connected) {
          const mlPayload: Record<string, any> = {};
          if (isPriceUpdated) mlPayload.price = product.basePrice;
          if (isNameUpdated) {
            // Mercado Livre title max length is 60 chars
            mlPayload.title = product.name.substring(0, 60);
          }

          if (Object.keys(mlPayload).length > 0) {
            const mlRes = await fetchMeli(`/items/${product.mlItemId}`, {
              method: "PUT",
              body: JSON.stringify(mlPayload),
            });

            if (mlRes.ok) {
              mlUpdateMsg = "Sincronizado com Mercado Livre.";
            } else {
              const mlErr = await mlRes.json();
              console.warn(`ML Update warning for item ${product.mlItemId}:`, mlErr);
              mlUpdateMsg = "Salvo localmente (anúncio ML mantido).";
            }
          }
        }
      } catch (mlErr) {
        console.error("Failed to sync updated product to ML:", mlErr);
      }
    }

    return NextResponse.json({
      success: true,
      product,
      message: `Produto atualizado com sucesso. ${mlUpdateMsg}`.trim(),
    });
  } catch (error: any) {
    console.error("Error updating product:", error);
    return NextResponse.json({ error: error.message || "Failed to update product" }, { status: 500 });
  }
}
