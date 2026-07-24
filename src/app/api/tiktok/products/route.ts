export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getTokens, fetchTikTok } from "../../../../utils/tokenStorage";

/**
 * GET /api/tiktok/products
 *
 * Busca os produtos cadastrados na sua conta do TikTok Shop.
 * Requer que o canal TikTok esteja conectado.
 *
 * Parâmetros de query opcionais:
 * - page_size: itens por página (padrão: 20, max: 100)
 * - page_number: número da página (padrão: 1)
 * - status: ACTIVE | INACTIVE | DELETED
 */
export async function GET(request: Request) {
  const tokens = await getTokens();

  if (!tokens.tiktok.connected || !tokens.tiktok.accessToken) {
    return NextResponse.json(
      { error: "TikTok Shop não conectado. Acesse /admin/tiktok para conectar." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const pageSize = searchParams.get("page_size") || "20";
  const pageNumber = searchParams.get("page_number") || "1";
  const status = searchParams.get("status") || "ACTIVE";

  try {
    const params = new URLSearchParams({
      page_size: pageSize,
      page_number: pageNumber,
      status,
    });

    const response = await fetchTikTok(
      `/api/products/search?${params.toString()}`,
      { method: "POST", body: JSON.stringify({}) }
    );

    const data = await response.json();

    if (!response.ok || data.code !== 0) {
      console.error("TikTok products API error:", data);
      return NextResponse.json(
        { error: data.message || "Erro ao buscar produtos do TikTok Shop" },
        { status: response.status }
      );
    }

    // Normaliza para o formato interno
    const products = (data.data?.products || []).map((product: any) => ({
      id: product.id,
      name: product.title,
      status: product.status,
      description: product.description,
      categoryId: product.category_id,
      brandId: product.brand_id,
      images: product.images?.map((img: any) => img.url_list?.[0]) || [],
      skus: (product.skus || []).map((sku: any) => ({
        id: sku.id,
        sellerSku: sku.seller_sku,
        price: sku.price?.original_price,
        currency: sku.price?.currency,
        stock: sku.stock_infos?.[0]?.available_stock ?? 0,
      })),
      channel: "tiktok",
    }));

    return NextResponse.json({
      products,
      total: data.data?.total || products.length,
    });
  } catch (err) {
    console.error("TikTok products route error:", err);
    return NextResponse.json(
      { error: "Erro interno ao buscar produtos do TikTok Shop" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tiktok/products
 *
 * Atualiza o estoque de um produto/SKU no TikTok Shop.
 * Body: { productId: string, skuId: string, stock: number }
 */
export async function POST(request: Request) {
  const tokens = await getTokens();

  if (!tokens.tiktok.connected || !tokens.tiktok.accessToken) {
    return NextResponse.json(
      { error: "TikTok Shop não conectado" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { productId, skuId, stock } = body;

    if (!productId || !skuId || stock === undefined) {
      return NextResponse.json(
        { error: "Campos obrigatórios: productId, skuId, stock" },
        { status: 400 }
      );
    }

    // Sanitização básica — stock deve ser número não-negativo
    const stockValue = Math.max(0, Math.floor(Number(stock)));

    const response = await fetchTikTok(`/api/products/${productId}/stocks`, {
      method: "PUT",
      body: JSON.stringify({
        skus: [
          {
            id: skuId,
            stock_infos: [{ available_stock: stockValue }],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok || data.code !== 0) {
      return NextResponse.json(
        { error: data.message || "Erro ao atualizar estoque no TikTok Shop" },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Estoque do SKU ${skuId} atualizado para ${stockValue} no TikTok Shop`,
    });
  } catch (err) {
    console.error("TikTok products POST error:", err);
    return NextResponse.json(
      { error: "Erro interno ao atualizar produto no TikTok Shop" },
      { status: 500 }
    );
  }
}
