import { NextResponse } from "next/server";
import { mirrorProductsToMercadoLivre } from "../../../../utils/syncEngine";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s for mirror operation

/**
 * POST /api/sync/mirror
 * 
 * Espelha todos os produtos do sistema para o Mercado Livre:
 * 1. Produtos com mlItemId → atualiza estoque/preço
 * 2. Produtos sem mlItemId → publica como anúncio novo
 * 3. Anúncios no ML sem produto no sistema → fecha o anúncio
 */
export async function POST() {
  try {
    console.log("[Mirror API] Starting mirror sync...");
    const result = await mirrorProductsToMercadoLivre();

    return NextResponse.json({
      success: true,
      ...result,
      message: `Espelhamento concluído: ${result.updated} atualizados, ${result.published} publicados, ${result.closed} fechados.`,
    });
  } catch (error: any) {
    console.error("[Mirror API Error]:", error);
    return NextResponse.json(
      { error: "Falha no espelhamento", details: error.message },
      { status: 500 }
    );
  }
}
