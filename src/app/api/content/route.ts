import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const CONTENT_PATH = path.join(process.cwd(), "content.json");

// Chaves permitidas — whitelist para evitar injeção de chaves arbitrárias
const ALLOWED_KEYS = new Set([
  "tab.overview",
  "tab.inventory",
  "tab.orders",
  "tab.settings",
  "card.orders_today",
  "card.revenue_today",
  "shipping.tab.today",
  "shipping.tab.next",
  "shipping.tab.transit",
  "shipping.tab.done",
]);

const DEFAULT_CONTENT: Record<string, string> = {
  "tab.overview": "Visão Geral",
  "tab.inventory": "Estoque",
  "tab.orders": "Rastreamento de Pedidos",
  "tab.settings": "Configurações de Integração",
  "card.orders_today": "Pedidos de Hoje",
  "card.revenue_today": "Faturamento de Hoje",
  "shipping.tab.today": "Envios de hoje",
  "shipping.tab.next": "Próximos dias",
  "shipping.tab.transit": "Em trânsito",
  "shipping.tab.done": "Finalizadas",
};

/**
 * GET /api/content
 * Retorna todos os textos editáveis da interface.
 */
export async function GET() {
  try {
    if (fs.existsSync(CONTENT_PATH)) {
      const raw = fs.readFileSync(CONTENT_PATH, "utf-8");
      return NextResponse.json(JSON.parse(raw));
    }
    return NextResponse.json(DEFAULT_CONTENT);
  } catch {
    return NextResponse.json(DEFAULT_CONTENT);
  }
}

/**
 * POST /api/content
 * Salva os textos editáveis.
 * Valida: apenas chaves permitidas, valores são strings, máximo 120 caracteres,
 * sem tags HTML (para evitar XSS).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Formato inválido." }, { status: 400 });
    }

    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(body)) {
      // Rejeita chaves desconhecidas
      if (!ALLOWED_KEYS.has(key)) {
        return NextResponse.json(
          { error: `Chave não permitida: ${key}` },
          { status: 400 }
        );
      }
      if (typeof value !== "string") {
        return NextResponse.json(
          { error: `Valor inválido para a chave '${key}'.` },
          { status: 400 }
        );
      }
      // Tamanho máximo por campo
      if (value.length > 120) {
        return NextResponse.json(
          { error: `Texto muito longo para '${key}' (máximo: 120 caracteres).` },
          { status: 400 }
        );
      }
      // Remove tags HTML para evitar XSS
      const clean = value.replace(/<[^>]*>/g, "").trim();
      sanitized[key] = clean;
    }

    // Mescla com o conteúdo atual
    const current = fs.existsSync(CONTENT_PATH)
      ? JSON.parse(fs.readFileSync(CONTENT_PATH, "utf-8"))
      : DEFAULT_CONTENT;

    const updated = { ...current, ...sanitized };
    fs.writeFileSync(CONTENT_PATH, JSON.stringify(updated, null, 2), "utf-8");

    return NextResponse.json({ success: true, content: updated });
  } catch (err) {
    console.error("[content/POST] Erro:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
