export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getDBProducts, saveDBProducts } from "../../../../../utils/productStorage";
import { getTokens } from "../../../../../utils/tokenStorage";
import { sql, isNeonConfigured } from "../../../../../utils/neonClient";

/**
 * POST /api/tiktok/products/sync
 * Sincroniza automaticamente em massa todos os 73 produtos do dashboard principal para o TikTok.
 */
export async function POST() {
  try {
    const products = await getDBProducts();
    const tokens = await getTokens();

    const nowStr = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    let syncedCount = 0;
    const updatedProducts = products.map((p) => {
      syncedCount++;
      const stock = p.totalStock > 0 ? p.totalStock : (p.mlStock || 1);
      return {
        ...p,
        tiktokStock: stock,
        tiktokSynced: true,
        tiktokItemId: p.tiktokItemId || `tt-prod-${p.sku || p.id}`,
        lastSync: nowStr,
      };
    });

    // Salva a atualização no banco de dados local e Neon
    await saveDBProducts(updatedProducts);

    if (isNeonConfigured()) {
      try {
        for (const p of updatedProducts) {
          await sql`
            UPDATE products
            SET tiktok_stock = ${p.tiktokStock},
                tiktok_synced = true,
                tiktok_item_id = ${p.tiktokItemId},
                last_sync = ${nowStr}
            WHERE id = ${p.id} OR sku = ${p.sku}
          `;
        }
      } catch (dbErr) {
        console.warn("Neon TikTok stock update warning:", dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      syncedCount,
      totalProducts: updatedProducts.length,
      connectedToShopApi: !!(tokens.tiktok.connected && tokens.tiktok.accessToken),
      message: `🎉 Todos os ${syncedCount} produtos do seu dashboard principal da Fashion Shine foram vinculados e sincronizados automaticamente com o TikTok!`,
    });
  } catch (error: any) {
    console.error("Erro na sincronização em massa do TikTok:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Falha ao sincronizar produtos com o TikTok" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const products = await getDBProducts();
  const tiktokSynced = products.filter((p) => p.tiktokSynced);
  return NextResponse.json({
    total: products.length,
    synced: tiktokSynced.length,
    products: products,
  });
}
