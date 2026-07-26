import { NextRequest, NextResponse } from "next/server";
import { getDBProducts, deleteDBProduct } from "../../../../utils/productStorage";
import { deleteProductFromChannels } from "../../../../utils/syncEngine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const { productId } = await request.json();

    if (!productId || typeof productId !== "string" || !productId.trim()) {
      return NextResponse.json({ error: "productId é obrigatório" }, { status: 400 });
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
      return NextResponse.json({ error: "Produto não encontrado no banco de dados" }, { status: 404 });
    }

    return NextResponse.json(
      {
        success: true,
        message: `Produto ${product?.name || productId} excluído com sucesso.`
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      }
    );
  } catch (error: any) {
    console.error("Failed to delete product:", error);
    return NextResponse.json({ error: "Erro interno no servidor ao excluir produto", details: error.message }, { status: 500 });
  }
}
