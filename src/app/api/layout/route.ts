import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const LAYOUT_PATH = path.join(process.cwd(), "layout.json");

// IDs de cards permitidos — whitelist de segurança
const ALLOWED_CARD_IDS = new Set([
  "orders_today",
  "revenue_today",
  "shipping_table",
  "sync_logs",
]);

const ALLOWED_SIZES = new Set(["normal", "compact", "large"]);

const DEFAULT_LAYOUT = {
  cards: [
    { id: "orders_today", label: "Pedidos de Hoje", visible: true, size: "normal" },
    { id: "revenue_today", label: "Faturamento de Hoje", visible: true, size: "normal" },
    { id: "shipping_table", label: "Tabela de Envios", visible: true, size: "large" },
    { id: "sync_logs", label: "Logs de Sincronização", visible: true, size: "normal" },
  ],
};

/**
 * GET /api/layout
 * Retorna a configuração de layout do dashboard (ordem, visibilidade, tamanho).
 */
export async function GET() {
  try {
    if (fs.existsSync(LAYOUT_PATH)) {
      const raw = fs.readFileSync(LAYOUT_PATH, "utf-8");
      return NextResponse.json(JSON.parse(raw));
    }
    return NextResponse.json(DEFAULT_LAYOUT);
  } catch {
    return NextResponse.json(DEFAULT_LAYOUT);
  }
}

/**
 * POST /api/layout
 * Salva a configuração de layout do dashboard.
 * Valida: apenas IDs conhecidos, boolean para visible, tamanhos em lista permitida.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.cards || !Array.isArray(body.cards)) {
      return NextResponse.json(
        { error: "Campo 'cards' deve ser um array." },
        { status: 400 }
      );
    }

    const validatedCards = [];
    const seenIds = new Set<string>();

    for (const card of body.cards) {
      if (!ALLOWED_CARD_IDS.has(card.id)) {
        return NextResponse.json(
          { error: `ID de card desconhecido: ${card.id}` },
          { status: 400 }
        );
      }
      if (seenIds.has(card.id)) {
        return NextResponse.json(
          { error: `ID duplicado: ${card.id}` },
          { status: 400 }
        );
      }
      if (typeof card.visible !== "boolean") {
        return NextResponse.json(
          { error: `Campo 'visible' deve ser boolean para '${card.id}'.` },
          { status: 400 }
        );
      }
      if (!ALLOWED_SIZES.has(card.size)) {
        return NextResponse.json(
          { error: `Tamanho inválido para '${card.id}': ${card.size}` },
          { status: 400 }
        );
      }

      seenIds.add(card.id);
      validatedCards.push({
        id: card.id,
        label: typeof card.label === "string" ? card.label.slice(0, 60) : card.id,
        visible: card.visible,
        size: card.size,
      });
    }

    const newLayout = { cards: validatedCards };
    fs.writeFileSync(LAYOUT_PATH, JSON.stringify(newLayout, null, 2), "utf-8");

    return NextResponse.json({ success: true, layout: newLayout });
  } catch (err) {
    console.error("[layout/POST] Erro:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
