export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { saveTokens, getTokens } from "../../../../utils/tokenStorage";

/**
 * POST /api/admin/tiktok-creds
 *
 * Salva as credenciais do TikTok Shop (App Key + App Secret) no banco
 * antes de iniciar o fluxo OAuth. Essas credenciais são necessárias
 * para a rota de callback fazer a troca do code pelo token.
 *
 * Body: { clientKey: string, clientSecret: string }
 *
 * Segurança:
 * - clientSecret nunca é exposto de volta para o frontend
 * - Os valores são salvos no banco criptografados via saveTokens()
 */
export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { clientKey, clientSecret } = body;

  // Validação básica dos inputs antes de salvar
  if (
    !clientKey ||
    typeof clientKey !== "string" ||
    clientKey.trim().length < 5
  ) {
    return NextResponse.json(
      { error: "App Key inválido. Verifique no TikTok Shop Partner Center." },
      { status: 400 }
    );
  }

  if (
    !clientSecret ||
    typeof clientSecret !== "string" ||
    clientSecret.trim().length < 10
  ) {
    return NextResponse.json(
      { error: "App Secret inválido. Verifique no TikTok Shop Partner Center." },
      { status: 400 }
    );
  }

  try {
    await saveTokens({
      tiktok: {
        clientKey: clientKey.trim(),
        clientSecret: clientSecret.trim(),
        // Mantém os demais campos sem alterar (ex: token existente)
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Erro ao salvar credenciais TikTok:", err);
    return NextResponse.json(
      { error: "Erro interno ao salvar credenciais" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/tiktok-creds
 * Desconecta o TikTok Shop limpando todos os tokens do canal.
 */
export async function DELETE() {
  try {
    await saveTokens({
      tiktok: {
        connected: false,
        accessToken: "",
        refreshToken: "",
        expiresAt: 0,
        openId: "",
        // Mantém clientKey e clientSecret para facilitar reconexão futura
      },
    });

    // Lê os tokens atuais para pegar o clientKey/Secret (não apagamos)
    const current = await getTokens();
    await saveTokens({
      tiktok: {
        connected: false,
        accessToken: "",
        refreshToken: "",
        expiresAt: 0,
        openId: "",
        clientKey: current.tiktok.clientKey,
        clientSecret: current.tiktok.clientSecret,
      },
    });

    return NextResponse.json({ success: true, message: "TikTok Shop desconectado." });
  } catch (err) {
    console.error("Erro ao desconectar TikTok:", err);
    return NextResponse.json(
      { error: "Erro interno ao desconectar" },
      { status: 500 }
    );
  }
}
