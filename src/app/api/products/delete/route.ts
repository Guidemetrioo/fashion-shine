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

    // PRIMEIRO: Excluir do banco + tombstone IMEDIATAMENTE (garante que nunca volta)
    const deleted = await deleteDBProduct(productId);

    if (!deleted && !product) {
      return NextResponse.json({ error: "Produto não encontrado no banco de dados" }, { status: 404 });
    }

    // DEPOIS: Tentar excluir dos canais em background (não bloqueia a resposta)
    if (product) {
      // Fire-and-forget com timeout de 5s para não travar
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Channel delete timeout")), 5000));
      Promise.race([deleteProductFromChannels(product), timeoutPromise]).catch(err => {
        console.warn(`Channel deletion for ${product.sku} failed or timed out:`, err);
      });
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

