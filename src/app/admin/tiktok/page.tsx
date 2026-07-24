"use client";

import React, { useState, useEffect, useCallback } from "react";
import "../admin.css";

// ─── Tipos locais ────────────────────────────────────────────────────────────

interface TikTokStatus {
  connected: boolean;
  openId: string | null;
  tokenExpired: boolean;
  tokenExpiresInMinutes: number;
  clientKey: string | null;
}

interface TikTokOrder {
  id: string;
  status: string;
  createTime: number;
  buyerInfo: { buyer_username?: string };
  lineItems: Array<{ product_name: string; quantity: number }>;
  paymentTotal: string;
  currency: string;
}

interface TikTokProduct {
  id: string;
  name: string;
  status: string;
  skus: Array<{ id: string; sellerSku: string; price: string; stock: number }>;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function TikTokAdminPage() {
  const [status, setStatus] = useState<TikTokStatus | null>(null);
  const [orders, setOrders] = useState<TikTokOrder[]>([]);
  const [products, setProducts] = useState<TikTokProduct[]>([]);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Credenciais para configuração manual (antes do primeiro OAuth)
  const [clientKey, setClientKey] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [isSavingCreds, setIsSavingCreds] = useState(false);

  // ─── Lê status da URL (retorno do OAuth) ───────────────────────────────────

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const success = params.get("success");
      const err = params.get("error");
      if (success === "true") setSyncResult("✅ TikTok Shop conectado com sucesso!");
      if (err) setError(`❌ Erro OAuth: ${err}`);
      // Limpa os params da URL sem recarregar
      window.history.replaceState({}, "", "/admin/tiktok");
    }
  }, []);

  // ─── Busca o status de conexão ─────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetch("/api/tiktok/sync");
      const data = await res.json();
      setStatus(data);
    } catch {
      setError("Não foi possível verificar o status da conexão TikTok.");
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // ─── Busca pedidos ─────────────────────────────────────────────────────────

  const fetchOrders = useCallback(async () => {
    setIsLoadingOrders(true);
    setError(null);
    try {
      const res = await fetch("/api/tiktok/orders?page_size=10");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrders(data.orders || []);
    } catch (err: any) {
      setError(err.message || "Erro ao buscar pedidos");
    } finally {
      setIsLoadingOrders(false);
    }
  }, []);

  // ─── Busca produtos ────────────────────────────────────────────────────────

  const fetchProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    setError(null);
    try {
      const res = await fetch("/api/tiktok/products?page_size=10");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProducts(data.products || []);
    } catch (err: any) {
      setError(err.message || "Erro ao buscar produtos");
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  // ─── Sincronização manual ──────────────────────────────────────────────────

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const res = await fetch("/api/tiktok/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSyncResult(
        `✅ Sincronizado! ${data.newOrders} pedidos novos, ${data.skipped} já processados.`
      );
      fetchOrders();
    } catch (err: any) {
      setError(err.message || "Erro durante sincronização");
    } finally {
      setIsSyncing(false);
    }
  };

  // ─── Salva credenciais antes do OAuth ─────────────────────────────────────

  const handleSaveCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientKey.trim() || !clientSecret.trim()) {
      setError("Preencha o App Key e o App Secret antes de continuar.");
      return;
    }
    setIsSavingCreds(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tiktok-creds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientKey: clientKey.trim(), clientSecret: clientSecret.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSyncResult("✅ Credenciais salvas! Clique em 'Conectar com TikTok Shop' para autorizar.");
    } catch (err: any) {
      setError(err.message || "Erro ao salvar credenciais");
    } finally {
      setIsSavingCreds(false);
    }
  };

  // ─── Desconectar ───────────────────────────────────────────────────────────

  const handleDisconnect = async () => {
    if (!confirm("Tem certeza que deseja desconectar o TikTok Shop?")) return;
    try {
      await fetch("/api/admin/tiktok-creds", { method: "DELETE" });
      setStatus(null);
      setSyncResult("TikTok Shop desconectado.");
      fetchStatus();
    } catch {
      setError("Erro ao desconectar.");
    }
  };

  // ─── Formatação helpers ────────────────────────────────────────────────────

  const formatDate = (ts: number) =>
    ts ? new Date(ts * 1000).toLocaleString("pt-BR") : "-";

  const statusLabel: Record<string, string> = {
    UNPAID: "Aguardando Pagamento",
    ON_HOLD: "Em Espera",
    AWAITING_SHIPMENT: "Aguardando Envio",
    AWAITING_COLLECTION: "Aguardando Coleta",
    IN_TRANSIT: "Em Trânsito",
    DELIVERED: "Entregue",
    COMPLETED: "Concluído",
    CANCELLED: "Cancelado",
  };

  const statusColor: Record<string, string> = {
    AWAITING_SHIPMENT: "#f0ad4e",
    IN_TRANSIT: "#5bc0de",
    DELIVERED: "#5cb85c",
    COMPLETED: "#5cb85c",
    CANCELLED: "#d9534f",
    UNPAID: "#999",
    ON_HOLD: "#999",
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f1a", color: "#e0e0e0", fontFamily: "Inter, sans-serif" }}>

      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        padding: "24px 32px",
        display: "flex",
        alignItems: "center",
        gap: "16px",
      }}>
        <a href="/admin" style={{ color: "#aaa", textDecoration: "none", fontSize: 14 }}>
          ← Voltar ao Admin
        </a>
        <span style={{ color: "#333" }}>|</span>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Ícone TikTok */}
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: "linear-gradient(135deg, #010101, #ff0050)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22,
          }}>
            🎵
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#fff" }}>
              TikTok Shop
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: "#aaa" }}>
              Integração de Pedidos e Produtos
            </p>
          </div>
        </div>

        {/* Badge de status */}
        {!isLoadingStatus && status && (
          <div style={{ marginLeft: "auto" }}>
            <span style={{
              padding: "6px 14px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              background: status.connected && !status.tokenExpired
                ? "rgba(92,184,92,0.15)"
                : "rgba(217,83,79,0.15)",
              color: status.connected && !status.tokenExpired ? "#5cb85c" : "#d9534f",
              border: `1px solid ${status.connected && !status.tokenExpired ? "#5cb85c44" : "#d9534f44"}`,
            }}>
              {status.connected && !status.tokenExpired
                ? `✅ Conectado (${status.openId?.slice(0, 8)}...)`
                : status.connected && status.tokenExpired
                  ? "⚠️ Token Expirado"
                  : "🔴 Desconectado"}
            </span>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>

        {/* Alertas de feedback */}
        {error && (
          <div style={{
            background: "rgba(217,83,79,0.12)", border: "1px solid #d9534f44",
            borderRadius: 10, padding: "14px 18px", marginBottom: 20, color: "#ff7070",
          }}>
            {error}
          </div>
        )}
        {syncResult && (
          <div style={{
            background: "rgba(92,184,92,0.12)", border: "1px solid #5cb85c44",
            borderRadius: 10, padding: "14px 18px", marginBottom: 20, color: "#7dde7d",
          }}>
            {syncResult}
          </div>
        )}

        {/* ─── Seção 1: Configuração / Conexão ─── */}
        <div style={{
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16, padding: 28, marginBottom: 24,
        }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 18, color: "#fff" }}>
            🔑 Configuração da Conta
          </h2>

          {status?.connected && !status.tokenExpired ? (
            /* Já conectado */
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
                <InfoCard label="Open ID" value={status.openId || "-"} />
                <InfoCard label="App Key" value={status.clientKey || "-"} />
                <InfoCard
                  label="Token expira em"
                  value={`${status.tokenExpiresInMinutes} min`}
                  highlight={status.tokenExpiresInMinutes < 30}
                />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <ActionButton
                  label={isLoadingOrders ? "Carregando..." : "🛍️ Ver Pedidos"}
                  onClick={fetchOrders}
                  disabled={isLoadingOrders}
                  primary
                />
                <ActionButton
                  label={isLoadingProducts ? "Carregando..." : "📦 Ver Produtos"}
                  onClick={fetchProducts}
                  disabled={isLoadingProducts}
                />
                <ActionButton
                  label={isSyncing ? "Sincronizando..." : "🔄 Sincronizar Agora"}
                  onClick={handleSync}
                  disabled={isSyncing}
                />
                <ActionButton
                  label="🔌 Desconectar"
                  onClick={handleDisconnect}
                  danger
                />
              </div>
            </div>
          ) : (
            /* Não conectado — formulário de credenciais */
            <div>
              <p style={{ color: "#aaa", fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
                Para conectar, você precisa do <strong style={{ color: "#fff" }}>App Key</strong> e{" "}
                <strong style={{ color: "#fff" }}>App Secret</strong> gerados no{" "}
                <a
                  href="https://partner.tiktokshop.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#69C9D0" }}
                >
                  TikTok Shop Partner Center
                </a>
                .{" "}
                A Redirect URI a cadastrar lá é:{" "}
                <code style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: 4, fontSize: 12 }}>
                  {typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}
                  /api/auth/tiktok/callback
                </code>
              </p>

              <form onSubmit={handleSaveCreds} style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 480 }}>
                <label style={{ fontSize: 13, color: "#bbb" }}>
                  App Key (client_key)
                  <input
                    type="text"
                    value={clientKey}
                    onChange={(e) => setClientKey(e.target.value)}
                    placeholder="ex: aw6xxxxxxxxxxxxxx"
                    style={inputStyle}
                  />
                </label>
                <label style={{ fontSize: 13, color: "#bbb" }}>
                  App Secret (client_secret)
                  <input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="••••••••••••••••••••"
                    style={inputStyle}
                  />
                </label>
                <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                  <button type="submit" disabled={isSavingCreds} style={{ ...btnStyle, background: "#4f46e5" }}>
                    {isSavingCreds ? "Salvando..." : "💾 Salvar Credenciais"}
                  </button>
                  <a href="/api/auth/tiktok" style={{ ...btnStyle, background: "#ff2d55", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                    🎵 Conectar com TikTok Shop
                  </a>
                </div>
              </form>

              <div style={{
                marginTop: 24, padding: 16, borderRadius: 10,
                background: "rgba(105,201,208,0.07)", border: "1px solid rgba(105,201,208,0.2)",
              }}>
                <p style={{ margin: 0, fontSize: 13, color: "#69C9D0", lineHeight: 1.7 }}>
                  <strong>📋 Como configurar no Partner Center:</strong><br />
                  1. Acesse <a href="https://partner.tiktokshop.com" target="_blank" rel="noopener noreferrer" style={{ color: "#69C9D0" }}>partner.tiktokshop.com</a> → Develop → Apps → Create App<br />
                  2. Em &quot;Basic Info&quot;, cadastre a Redirect URI acima<br />
                  3. Em &quot;Permissions&quot;, ative: product.list, order.list, inventory.read, inventory.write<br />
                  4. Copie App Key e App Secret e cole no formulário acima
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ─── Seção 2: Pedidos ─── */}
        {orders.length > 0 && (
          <div style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16, padding: 28, marginBottom: 24,
          }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 18, color: "#fff" }}>
              🛍️ Últimos Pedidos TikTok Shop
            </h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    {["ID do Pedido", "Status", "Comprador", "Itens", "Total", "Data"].map((h) => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "#888", fontWeight: 600 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#69C9D0" }}>
                        {order.id}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{
                          padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                          background: `${statusColor[order.status] || "#666"}22`,
                          color: statusColor[order.status] || "#aaa",
                        }}>
                          {statusLabel[order.status] || order.status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "#ccc" }}>
                        {order.buyerInfo?.buyer_username || "-"}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#ccc" }}>
                        {order.lineItems?.map((item: any) => (
                          <div key={item.product_name} style={{ fontSize: 12 }}>
                            {item.product_name} × {item.quantity}
                          </div>
                        ))}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#fff", fontWeight: 600 }}>
                        {order.currency} {order.paymentTotal}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#888", fontSize: 12 }}>
                        {formatDate(order.createTime)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── Seção 3: Produtos ─── */}
        {products.length > 0 && (
          <div style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16, padding: 28, marginBottom: 24,
          }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 18, color: "#fff" }}>
              📦 Produtos no TikTok Shop
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {products.map((product) => (
                <div key={product.id} style={{
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12, padding: 16,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 8 }}>
                    {product.name}
                  </div>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>
                    ID: {product.id}
                  </div>
                  <div style={{ fontSize: 12, color: product.status === "ACTIVE" ? "#5cb85c" : "#d9534f" }}>
                    ● {product.status === "ACTIVE" ? "Ativo" : product.status}
                  </div>
                  {product.skus?.map((sku) => (
                    <div key={sku.id} style={{
                      marginTop: 8, padding: "8px 10px", borderRadius: 8,
                      background: "rgba(255,255,255,0.03)", fontSize: 12, color: "#bbb",
                    }}>
                      SKU: {sku.sellerSku || sku.id} · Estoque: <strong style={{ color: "#fff" }}>{sku.stock}</strong>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Seção 4: Webhook Info ─── */}
        <div style={{
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16, padding: 28,
        }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 18, color: "#fff" }}>
            🔔 Webhook (Notificações em Tempo Real)
          </h2>
          <p style={{ color: "#aaa", fontSize: 14, marginBottom: 16, lineHeight: 1.6 }}>
            Para receber notificações automáticas de novos pedidos, configure o Webhook URL
            no TikTok Shop Partner Center → App → Webhooks:
          </p>
          <div style={{
            background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "12px 16px",
            fontFamily: "monospace", fontSize: 13, color: "#69C9D0",
            border: "1px solid rgba(105,201,208,0.2)",
          }}>
            {typeof window !== "undefined" ? window.location.origin : "https://seu-dominio.com"}
            /api/webhooks/tiktok
          </div>
          <p style={{ color: "#666", fontSize: 12, marginTop: 12 }}>
            ⚠️ O webhook só funciona em ambiente com HTTPS (produção/Vercel). Em localhost, use o botão &quot;Sincronizar Agora&quot; acima.
          </p>
        </div>

      </div>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function InfoCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10, padding: "14px 16px",
    }}>
      <div style={{ fontSize: 11, color: "#666", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: highlight ? "#f0ad4e" : "#fff", fontFamily: "monospace" }}>
        {value}
      </div>
    </div>
  );
}

function ActionButton({
  label, onClick, disabled, primary, danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...btnStyle,
        background: danger ? "rgba(217,83,79,0.2)" : primary ? "#4f46e5" : "rgba(255,255,255,0.08)",
        color: danger ? "#d9534f" : "#fff",
        border: `1px solid ${danger ? "#d9534f44" : "rgba(255,255,255,0.12)"}`,
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {label}
    </button>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "9px 18px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.12)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  color: "#fff",
  transition: "all 0.2s ease",
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 6,
  padding: "10px 14px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  color: "#fff",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};
