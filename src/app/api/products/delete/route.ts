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

    // DEPOIS: Tentar excluir dos canais (cada chamada tem timeout de 10s no fetchMeli)
    let channelResult = "não tentado";
    if (product) {
      try {
        await deleteProductFromChannels(product);
        channelResult = "removido dos marketplaces";
      } catch (err: any) {
        console.warn(`Channel deletion for ${product.sku} failed:`, err?.message || err);
        channelResult = "falha ao remover dos marketplaces (token expirado ou API offline)";
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `Produto ${product?.name || productId} excluído com sucesso.`,
        channelResult
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

