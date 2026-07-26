"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { applyTheme } from "../../../components/ThemeProvider";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
interface ThemeColors {
  background: string; foreground: string; foregroundMuted: string;
  gold: string; goldLight: string; goldHover: string; darkAccent: string;
}
interface ThemeFonts { serif: string; sans: string; }
interface Theme { colors: ThemeColors; fonts: ThemeFonts; }
interface LayoutCard { id: string; label: string; visible: boolean; size: string; }
interface Layout { cards: LayoutCard[]; }

const DEFAULT_THEME: Theme = {
  colors: {
    background: "#EFEBE0", foreground: "#2d2b27", foregroundMuted: "#78736a",
    gold: "#b3975a", goldLight: "#e5dcc6", goldHover: "#a18347", darkAccent: "#fbfaf8",
  },
  fonts: { serif: "Playfair Display", sans: "Outfit" },
};
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
const DEFAULT_LAYOUT: Layout = {
  cards: [
    { id: "orders_today", label: "Pedidos de Hoje", visible: true, size: "normal" },
    { id: "revenue_today", label: "Faturamento de Hoje", visible: true, size: "normal" },
    { id: "shipping_table", label: "Tabela de Envios", visible: true, size: "large" },
    { id: "sync_logs", label: "Logs de Sincronização", visible: true, size: "normal" },
  ],
};
const ALLOWED_FONTS = ["Playfair Display","Outfit","Inter","Roboto","Lato","Merriweather","Libre Baskerville","Montserrat","Open Sans","Raleway","Cormorant Garamond"];
const COLOR_LABELS: Record<keyof ThemeColors, string> = {
  background: "🎨 Cor de Fundo", foreground: "✏️ Texto Principal",
  foregroundMuted: "📝 Texto Suave", gold: "✨ Dourado (Destaque)",
  goldLight: "🌟 Dourado Claro", goldHover: "💛 Dourado Hover", darkAccent: "🃏 Fundo de Cards",
};
const CONTENT_LABELS: Record<string, string> = {
  "tab.overview": "Aba: Visão Geral", "tab.inventory": "Aba: Estoque",
  "tab.orders": "Aba: Pedidos", "tab.settings": "Aba: Configurações",
  "card.orders_today": "Card: Pedidos de Hoje", "card.revenue_today": "Card: Faturamento",
  "shipping.tab.today": "Envio: Hoje", "shipping.tab.next": "Envio: Próximos dias",
  "shipping.tab.transit": "Envio: Em trânsito", "shipping.tab.done": "Envio: Finalizadas",
};

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
export default function VisualEditor() {
  const [theme, setTheme]       = useState<Theme>(DEFAULT_THEME);
  const [savedTheme, setSavedTheme] = useState<Theme>(DEFAULT_THEME);
  const [content, setContent]   = useState<Record<string, string>>(DEFAULT_CONTENT);
  const [savedContent, setSavedContent] = useState<Record<string, string>>(DEFAULT_CONTENT);
  const [layout, setLayout]     = useState<Layout>(DEFAULT_LAYOUT);
  const [savedLayout, setSavedLayout] = useState<Layout>(DEFAULT_LAYOUT);

  const [isLoading, setIsLoading]     = useState(true);
  const [isSaving, setIsSaving]       = useState(false);
  const [saveStatus, setSaveStatus]   = useState<"idle"|"success"|"error">("idle");
  const [activeSection, setActiveSection] = useState<"colors"|"fonts"|"layout">("colors");

  // Estado do painel flutuante de edição de texto
  const [activeEditKey, setActiveEditKey]   = useState<string | null>(null);
  const [floatingValue, setFloatingValue]   = useState("");
  const floatingInputRef = useRef<HTMLInputElement>(null);

  // Drag-and-drop layout
  const [dragIndex, setDragIndex]     = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ── Carrega todos os dados ao abrir ─────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch("/api/theme").then(r => r.json()),
      fetch("/api/content").then(r => r.json()),
      fetch("/api/layout").then(r => r.json()),
    ]).then(([t, c, l]) => {
      setTheme(t); setSavedTheme(t);
      setContent(c); setSavedContent(c);
      setLayout(l); setSavedLayout(l);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  // ── Escuta mensagens do iframe ──────────────────────────────────────────
  // Quando o usuário clica num elemento editável no preview, o iframe
  // envia uma mensagem com a chave do elemento. Aqui abrimos o painel.
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const { type, payload } = event.data || {};
      if (type === "cms:elementClicked" && payload?.key) {
        const key = payload.key;
        setActiveEditKey(key);
        setFloatingValue(content[key] ?? DEFAULT_CONTENT[key] ?? "");
        setTimeout(() => floatingInputRef.current?.focus(), 50);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [content]);

  // ── Injeta handlers no iframe (event delegation — robusto com React) ────
  // Em vez de adicionar evento em cada elemento (que React pode remover
  // quando re-renderiza), adicionamos UM evento no document usando
  // event delegation. Isso funciona mesmo após re-renders do React.
  const injectEditHandlers = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow as Window & { _cmsHandlerAttached?: boolean };

    // Aplica tema ao iframe
    applyThemeToIframe(theme, doc);

    // Injeta CSS de hover nos elementos editáveis (só uma vez via ID único)
    if (!doc.getElementById("cms-editor-style")) {
      const style = doc.createElement("style");
      style.id = "cms-editor-style";
      style.textContent = `
        [data-edit-key] {
          cursor: pointer !important;
          position: relative;
          transition: outline 0.15s ease !important;
        }
        [data-edit-key]:hover {
          outline: 2px dashed rgba(179, 151, 90, 0.8) !important;
          outline-offset: 4px;
          border-radius: 3px;
        }
        [data-edit-key]:hover::after {
          content: '✏️ clique para editar';
          position: absolute;
          top: -26px;
          left: 0;
          background: rgba(179, 151, 90, 0.95);
          color: #000;
          font-size: 10px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 4px;
          white-space: nowrap;
          z-index: 9999;
          pointer-events: none;
          font-family: 'Outfit', sans-serif;
          letter-spacing: 0.03em;
        }
      `;
      (doc.head || doc.documentElement).appendChild(style);
    }

    // Adiciona event delegation APENAS UMA VEZ usando flag no window do iframe
    // Isso garante que re-renders do React não causem listeners duplicados
    if (!win._cmsHandlerAttached) {
      win._cmsHandlerAttached = true;
      doc.addEventListener("click", (e: MouseEvent) => {
        const target = (e.target as HTMLElement)?.closest?.("[data-edit-key]");
        if (target) {
          e.stopPropagation();
          const key = target.getAttribute("data-edit-key");
          win.parent.postMessage({ type: "cms:elementClicked", payload: { key } }, "*");
        }
      }, true); // capture phase — intercepta antes do React
    }
  }, [theme]);

  // Auxiliar: aplica tema nas CSS vars do iframe
  function applyThemeToIframe(t: Theme, doc: Document) {
    const root = doc.documentElement;
    root.style.setProperty("--background-start", t.colors.background);
    root.style.setProperty("--background-end", t.colors.background);
    root.style.setProperty("--foreground", t.colors.foreground);
    root.style.setProperty("--foreground-muted", t.colors.foregroundMuted);
    root.style.setProperty("--gold", t.colors.gold);
    root.style.setProperty("--gold-light", t.colors.goldLight);
    root.style.setProperty("--gold-hover", t.colors.goldHover);
    root.style.setProperty("--dark-accent", t.colors.darkAccent);
  }

  const handleIframeLoad = () => injectEditHandlers();

  // Envia mensagem para o iframe
  const sendToIframe = useCallback((type: string, payload: unknown) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type, payload }, window.location.origin
    );
  }, []);

  // ── Handlers de Tema ──────────────────────────────────────────────────────
  const updateColor = (key: keyof ThemeColors, value: string) => {
    const updated = { ...theme, colors: { ...theme.colors, [key]: value } };
    setTheme(updated);
    applyTheme(updated);
    if (iframeRef.current?.contentDocument) {
      applyThemeToIframe(updated, iframeRef.current.contentDocument);
    }
  };
  const updateFont = (key: keyof ThemeFonts, value: string) => {
    setTheme(prev => ({ ...prev, fonts: { ...prev.fonts, [key]: value } }));
  };

  // ── Painel flutuante: aplicar edição de texto ─────────────────────────────
  // Quando o usuário confirma a edição no painel flutuante, atualizamos
  // o estado e enviamos postMessage para o iframe atualizar em tempo real.
  const applyFloatingEdit = () => {
    if (!activeEditKey) return;
    const updated = { ...content, [activeEditKey]: floatingValue };
    setContent(updated);
    sendToIframe("cms:updateContent", { [activeEditKey]: floatingValue });
    sendToIframe("cms:getHighlight", { key: activeEditKey });
  };

  const confirmFloatingEdit = () => {
    applyFloatingEdit();
    setActiveEditKey(null);
  };

  const cancelFloatingEdit = () => {
    setActiveEditKey(null);
  };

  // Atualiza em tempo real enquanto digita
  const handleFloatingChange = (value: string) => {
    setFloatingValue(value);
    if (!activeEditKey) return;
    const updated = { ...content, [activeEditKey]: value };
    setContent(updated);
    sendToIframe("cms:updateContent", { [activeEditKey]: value });
  };

  // ── Handlers de Layout ────────────────────────────────────────────────────
  const toggleCardVisible = (id: string) => {
    const newLayout = {
      ...layout,
      cards: layout.cards.map(c => c.id === id ? { ...c, visible: !c.visible } : c),
    };
    setLayout(newLayout);
    sendToIframe("cms:updateLayout", newLayout);
  };
  const handleDragStart = (i: number) => setDragIndex(i);
  const handleDragOver  = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOverIndex(i); };
  const handleDrop = (targetIdx: number) => {
    if (dragIndex === null || dragIndex === targetIdx) { setDragIndex(null); setDragOverIndex(null); return; }
    const cards = [...layout.cards];
    const [moved] = cards.splice(dragIndex, 1);
    cards.splice(targetIdx, 0, moved);
    const newLayout = { ...layout, cards };
    setLayout(newLayout);
    sendToIframe("cms:updateLayout", newLayout);
    setDragIndex(null); setDragOverIndex(null);
  };
  const handleDragEnd = () => { setDragIndex(null); setDragOverIndex(null); };

  // ── Salvar ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true); setSaveStatus("idle");
    try {
      await Promise.all([
        fetch("/api/theme",   { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(theme) }),
        fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(content) }),
        fetch("/api/layout",  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(layout) }),
      ]);
      setSavedTheme(theme); setSavedContent(content); setSavedLayout(layout);
      setSaveStatus("success");
    } catch { setSaveStatus("error"); }
    finally { setIsSaving(false); setTimeout(() => setSaveStatus("idle"), 3000); }
  };

  const handleReset = () => {
    setTheme(DEFAULT_THEME); applyTheme(DEFAULT_THEME);
    if (iframeRef.current?.contentDocument) applyThemeToIframe(DEFAULT_THEME, iframeRef.current.contentDocument);
    setContent(DEFAULT_CONTENT); sendToIframe("cms:updateContent", DEFAULT_CONTENT);
    setLayout(DEFAULT_LAYOUT); sendToIframe("cms:updateLayout", DEFAULT_LAYOUT);
  };

  const handleCancel = () => {
    setTheme(savedTheme); applyTheme(savedTheme);
    if (iframeRef.current?.contentDocument) applyThemeToIframe(savedTheme, iframeRef.current.contentDocument);
    setContent(savedContent); sendToIframe("cms:updateContent", savedContent);
    setLayout(savedLayout); sendToIframe("cms:updateLayout", savedLayout);
  };

  const hasUnsaved =
    JSON.stringify(theme) !== JSON.stringify(savedTheme) ||
    JSON.stringify(content) !== JSON.stringify(savedContent) ||
    JSON.stringify(layout) !== JSON.stringify(savedLayout);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={s.wrapper}>

      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <div style={s.topbar}>
        <div style={s.topLeft}>
          <span style={s.logo}>✦</span>
          <span style={s.title}>Editor Visual</span>
          <span style={s.sub}>Fashion Shine</span>
          {hasUnsaved && <span style={s.badge}>● não salvo</span>}
        </div>
        <div style={s.topRight}>
          {hasUnsaved && <button onClick={handleCancel} style={s.btnSecondary}>↩ Desfazer</button>}
          <button onClick={handleReset} style={s.btnSecondary}>🔄 Resetar padrão</button>
          <button
            onClick={handleSave} disabled={isSaving || !hasUnsaved}
            style={{ ...s.btnPrimary, opacity: isSaving || !hasUnsaved ? 0.55 : 1 }}
          >
            {isSaving ? "Salvando…" : saveStatus === "success" ? "✓ Salvo!" : saveStatus === "error" ? "✗ Erro" : "💾 Salvar"}
          </button>
          <a href="/admin" style={s.btnLink}>← Painel</a>
        </div>
      </div>

      {/* ── Layout ──────────────────────────────────────────────────────── */}
      <div style={s.layout}>

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <div style={s.sidebar}>
          {isLoading ? (
            <div style={s.loadingBox}>
              <div style={s.spinner} />
              <span>Carregando configurações…</span>
            </div>
          ) : (
            <>
              {/* Instrução de uso */}
              <div style={s.helpBanner}>
                <span style={s.helpIcon}>💡</span>
                <span>Clique em qualquer texto no preview para editá-lo diretamente.</span>
              </div>

              {/* Tabs */}
              <div style={s.tabs}>
                {([
                  { id: "colors", label: "🎨", title: "Cores" },
                  { id: "fonts",  label: "🔤", title: "Fontes" },
                  { id: "layout", label: "🃏", title: "Layout" },
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSection(tab.id)}
                    style={{ ...s.tab, ...(activeSection === tab.id ? s.tabActive : {}) }}
                    title={tab.title}
                  >
                    <span style={{ fontSize: "1.2rem" }}>{tab.label}</span>
                    <span style={{ fontSize: "0.7rem", marginTop: "2px" }}>{tab.title}</span>
                  </button>
                ))}
              </div>

              {/* ── Cores ─────────────────────────────────────────────── */}
              {activeSection === "colors" && (
                <div style={s.section}>
                  {(Object.keys(theme.colors) as Array<keyof ThemeColors>).map(key => (
                    <label key={key} style={s.colorRow} title={`Editar: ${COLOR_LABELS[key]}`}>
                      <span style={s.colorLabel}>{COLOR_LABELS[key]}</span>
                      <div style={s.colorRight}>
                        <div style={{ ...s.colorPreview, background: theme.colors[key] }} />
                        <input
                          type="color"
                          value={theme.colors[key]}
                          onChange={e => updateColor(key, e.target.value)}
                          style={s.colorInput}
                        />
                        <span style={s.colorHex}>{theme.colors[key]}</span>
                      </div>
                    </label>
                  ))}
                  <p style={s.hint}>Clique no quadrado colorido para abrir o seletor. O preview atualiza instantaneamente.</p>
                </div>
              )}

              {/* ── Fontes ────────────────────────────────────────────── */}
              {activeSection === "fonts" && (
                <div style={s.section}>
                  {(["serif", "sans"] as const).map(key => (
                    <div key={key} style={s.fontBlock}>
                      <span style={s.colorLabel}>{key === "serif" ? "📖 Títulos (Serif)" : "📄 Textos (Sans)"}</span>
                      <select value={theme.fonts[key]} onChange={e => updateFont(key, e.target.value)} style={s.select}>
                        {ALLOWED_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                      <span style={{ ...s.fontPreview, fontFamily: `'${theme.fonts[key]}', Georgia, serif` }}>
                        Aa — Fashion Shine
                      </span>
                    </div>
                  ))}
                  <p style={s.hint}>Salve e recarregue a página para ver o efeito completo nas fontes.</p>
                </div>
              )}

              {/* ── Layout ────────────────────────────────────────────── */}
              {activeSection === "layout" && (
                <div style={s.section}>
                  <p style={s.hint}>Arraste ⠿ para reordenar. Clique no ícone para mostrar/ocultar a seção.</p>
                  {layout.cards.map((card, idx) => (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={e => handleDragOver(e, idx)}
                      onDrop={() => handleDrop(idx)}
                      onDragEnd={handleDragEnd}
                      style={{
                        ...s.layoutCard,
                        opacity: dragIndex === idx ? 0.35 : 1,
                        background: dragOverIndex === idx ? "rgba(179,151,90,0.12)" : "rgba(255,255,255,0.03)",
                        borderColor: dragOverIndex === idx ? "rgba(179,151,90,0.6)" : "rgba(255,255,255,0.08)",
                      }}
                    >
                      <span style={s.dragHandle}>⠿</span>
                      <span style={{ ...s.cardName, opacity: card.visible ? 1 : 0.4 }}>{card.label}</span>
                      <button onClick={() => toggleCardVisible(card.id)} style={s.visBtn} title={card.visible ? "Ocultar" : "Mostrar"}>
                        {card.visible ? "👁" : "🚫"}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={s.warning}>
                ⚠️ Em produção no Vercel o arquivo não persiste entre deploys — use localmente.
              </div>
            </>
          )}
        </div>

        {/* ── Preview + Painel Flutuante ───────────────────────────────── */}
        <div style={s.previewWrap}>

          {/* Barra do preview */}
          <div style={s.previewBar}>
            <span style={s.dot} /><span style={s.dot} /><span style={s.dot} />
            <span style={s.previewUrl}>localhost:3000/admin</span>
            <span style={s.editMode}>✏️ Modo Edição — passe o mouse sobre textos</span>
          </div>

          {/* iframe */}
          <iframe
            ref={iframeRef}
            src="/admin"
            onLoad={handleIframeLoad}
            style={{ flex: 1, border: "none", width: "100%", display: "block" }}
            title="Preview"
          />

          {/* ── Painel flutuante de edição (aparece ao clicar num texto) ── */}
          {/* Este é o coração da experiência Canva: o usuário clica no     */}
          {/* elemento no preview e um painel aparece aqui em baixo com     */}
          {/* o campo de edição em contexto — sem precisar trocar de aba.   */}
          {activeEditKey && (
            <div style={s.floatingBar}>
              <span style={s.floatingLabel}>
                ✏️ {CONTENT_LABELS[activeEditKey] ?? activeEditKey}
              </span>
              <input
                ref={floatingInputRef}
                type="text"
                value={floatingValue}
                maxLength={120}
                onChange={e => handleFloatingChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") confirmFloatingEdit();
                  if (e.key === "Escape") cancelFloatingEdit();
                }}
                style={s.floatingInput}
                placeholder="Digite o novo texto…"
              />
              <span style={s.charCount}>{floatingValue.length}/120</span>
              <button onClick={confirmFloatingEdit} style={s.floatingConfirm} title="Confirmar (Enter)">✓</button>
              <button onClick={cancelFloatingEdit} style={s.floatingClose} title="Cancelar (Esc)">✕</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Estilos
// ─────────────────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  wrapper:      { display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", fontFamily: "'Outfit', sans-serif", background: "#12121e", color: "#ddd" },
  topbar:       { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 1.25rem", height: "52px", background: "#0d0d1a", borderBottom: "1px solid rgba(179,151,90,0.25)", flexShrink: 0 },
  topLeft:      { display: "flex", alignItems: "center", gap: "0.6rem" },
  logo:         { fontSize: "1.3rem", color: "#b3975a" },
  title:        { fontSize: "0.95rem", fontWeight: 700, color: "#e8e8e8", letterSpacing: "0.04em" },
  sub:          { fontSize: "0.78rem", color: "#666", paddingLeft: "0.5rem", borderLeft: "1px solid rgba(179,151,90,0.25)", marginLeft: "0.2rem" },
  badge:        { fontSize: "0.72rem", color: "#e5c07b", marginLeft: "0.4rem", opacity: 0.85 },
  topRight:     { display: "flex", alignItems: "center", gap: "0.6rem" },
  btnSecondary: { padding: "0.35rem 0.9rem", background: "transparent", border: "1px solid rgba(179,151,90,0.3)", borderRadius: "6px", color: "#b3975a", cursor: "pointer", fontSize: "0.8rem", transition: "all 0.2s" },
  btnPrimary:   { padding: "0.35rem 1.1rem", background: "#b3975a", border: "none", borderRadius: "6px", color: "#000", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", transition: "opacity 0.2s" },
  btnLink:      { padding: "0.35rem 0.8rem", background: "transparent", border: "1px solid rgba(120,120,120,0.25)", borderRadius: "6px", color: "#777", fontSize: "0.78rem", textDecoration: "none" },

  layout:       { display: "flex", flex: 1, overflow: "hidden" },

  sidebar:      { width: "280px", flexShrink: 0, background: "#0d0d1a", borderRight: "1px solid rgba(179,151,90,0.15)", overflowY: "auto", display: "flex", flexDirection: "column" },
  loadingBox:   { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", flex: 1, color: "#555", padding: "2rem" },
  spinner:      { width: "28px", height: "28px", border: "3px solid rgba(179,151,90,0.2)", borderTop: "3px solid #b3975a", borderRadius: "50%", animation: "spin 0.8s linear infinite" },

  helpBanner:   { display: "flex", alignItems: "flex-start", gap: "0.5rem", padding: "0.9rem 1rem", background: "rgba(179,151,90,0.07)", borderBottom: "1px solid rgba(179,151,90,0.12)", fontSize: "0.77rem", color: "#999", lineHeight: 1.5 },
  helpIcon:     { fontSize: "1rem", flexShrink: 0 },

  tabs:         { display: "flex", borderBottom: "1px solid rgba(179,151,90,0.15)" },
  tab:          { flex: 1, padding: "0.65rem 0.25rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", background: "transparent", border: "none", borderBottom: "2px solid transparent", color: "#666", cursor: "pointer", transition: "all 0.2s", fontSize: "0.72rem" },
  tabActive:    { color: "#b3975a", borderBottom: "2px solid #b3975a", background: "rgba(179,151,90,0.06)" },

  section:      { padding: "1rem", display: "flex", flexDirection: "column", gap: "0.8rem", flex: 1 },
  hint:         { fontSize: "0.73rem", color: "#555", lineHeight: 1.6, marginTop: "0.25rem" },

  colorRow:     { display: "flex", flexDirection: "column", gap: "0.35rem", padding: "0.65rem 0.75rem", background: "rgba(255,255,255,0.025)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)", cursor: "pointer", transition: "border-color 0.2s" },
  colorLabel:   { fontSize: "0.78rem", color: "#bbb", fontWeight: 500 },
  colorRight:   { display: "flex", alignItems: "center", gap: "0.6rem" },
  colorPreview: { width: "28px", height: "28px", borderRadius: "6px", border: "2px solid rgba(255,255,255,0.1)", flexShrink: 0 },
  colorInput:   { width: "32px", height: "32px", border: "2px solid rgba(179,151,90,0.3)", borderRadius: "6px", cursor: "pointer", padding: "2px", background: "transparent", flexShrink: 0 },
  colorHex:     { fontSize: "0.75rem", color: "#666", fontFamily: "monospace" },

  fontBlock:    { display: "flex", flexDirection: "column", gap: "0.45rem", padding: "0.65rem 0.75rem", background: "rgba(255,255,255,0.025)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" },
  select:       { background: "#0d0d1a", border: "1px solid rgba(179,151,90,0.3)", borderRadius: "6px", color: "#ddd", padding: "0.4rem 0.6rem", fontSize: "0.82rem", cursor: "pointer" },
  fontPreview:  { fontSize: "1.05rem", color: "#b3975a", padding: "0.25rem 0" },

  layoutCard:   { display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.65rem 0.75rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)", cursor: "grab", transition: "all 0.15s", userSelect: "none" },
  dragHandle:   { fontSize: "1.1rem", color: "#444", cursor: "grab" },
  cardName:     { flex: 1, fontSize: "0.82rem", color: "#ccc" },
  visBtn:       { background: "transparent", border: "none", cursor: "pointer", fontSize: "1rem", padding: "0 2px" },

  warning:      { margin: "auto 1rem 1rem", padding: "0.65rem 0.75rem", fontSize: "0.7rem", color: "#666", background: "rgba(255,180,0,0.04)", border: "1px solid rgba(255,180,0,0.15)", borderRadius: "6px", lineHeight: 1.5 },

  // Preview + painel flutuante
  previewWrap:  { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" },
  previewBar:   { display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.55rem 1rem", background: "#0d0d1a", borderBottom: "1px solid rgba(179,151,90,0.15)", flexShrink: 0 },
  dot:          { width: "10px", height: "10px", borderRadius: "50%", background: "rgba(179,151,90,0.4)", display: "inline-block" },
  previewUrl:   { fontSize: "0.75rem", color: "#555", fontFamily: "monospace", marginLeft: "0.35rem" },
  editMode:     { marginLeft: "auto", fontSize: "0.72rem", color: "#b3975a", opacity: 0.8, fontStyle: "italic" },

  // O painel flutuante aparece no fundo do preview quando o usuário
  // clica num elemento editável — é a peça principal da UX Canva
  floatingBar:  {
    position: "absolute", bottom: 0, left: 0, right: 0,
    display: "flex", alignItems: "center", gap: "0.75rem",
    padding: "0.85rem 1.25rem",
    background: "rgba(13, 13, 26, 0.97)",
    borderTop: "2px solid #b3975a",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    zIndex: 100,
    boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
    animation: "slideUp 0.2s ease-out",
  },
  floatingLabel:  { fontSize: "0.8rem", color: "#b3975a", fontWeight: 600, whiteSpace: "nowrap" },
  floatingInput:  {
    flex: 1, background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(179,151,90,0.5)",
    borderRadius: "7px", color: "#fff", padding: "0.55rem 0.85rem", fontSize: "0.9rem",
    outline: "none", transition: "border-color 0.2s",
    fontFamily: "'Outfit', sans-serif",
  },
  charCount:      { fontSize: "0.72rem", color: "#555", whiteSpace: "nowrap" },
  floatingConfirm:{ padding: "0.5rem 1.1rem", background: "#b3975a", border: "none", borderRadius: "7px", color: "#000", fontWeight: 700, cursor: "pointer", fontSize: "0.88rem" },
  floatingClose:  { padding: "0.5rem 0.8rem", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "7px", color: "#777", cursor: "pointer", fontSize: "0.88rem" },
};
