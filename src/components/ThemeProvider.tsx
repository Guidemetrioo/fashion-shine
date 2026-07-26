"use client";

import { useEffect } from "react";

interface Theme {
  colors: {
    background: string;
    foreground: string;
    foregroundMuted: string;
    gold: string;
    goldLight: string;
    goldHover: string;
    darkAccent: string;
  };
  fonts: {
    serif: string;
    sans: string;
  };
}

/**
 * Aplica as variáveis CSS do tema no elemento :root da página.
 * Isso sobrescreve os valores padrão do globals.css com os salvos no theme.json.
 */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.style.setProperty("--background-start", theme.colors.background);
  root.style.setProperty("--background-end", theme.colors.background);
  root.style.setProperty("--foreground", theme.colors.foreground);
  root.style.setProperty("--foreground-muted", theme.colors.foregroundMuted);
  root.style.setProperty("--gold", theme.colors.gold);
  root.style.setProperty("--gold-light", theme.colors.goldLight);
  root.style.setProperty("--gold-hover", theme.colors.goldHover);
  root.style.setProperty("--dark-accent", theme.colors.darkAccent);
  // Nota: fontes requerem que a fonte esteja carregada via Google Fonts.
  // O layout.tsx carrega Playfair Display e Outfit por padrão.
}

/**
 * ThemeProvider — componente invisível que carrega o tema salvo
 * e aplica as variáveis CSS assim que a página abre.
 *
 * Como funciona: faz um GET para /api/theme, recebe o JSON com as cores
 * salvas e sobrescreve as variáveis CSS do :root instantaneamente.
 */
export default function ThemeProvider() {
  useEffect(() => {
    fetch("/api/theme")
      .then((res) => res.json())
      .then((theme: Theme) => {
        applyTheme(theme);
      })
      .catch(() => {
        // Silenciosamente ignora — o tema padrão do globals.css continua válido
      });
  }, []);

  // Componente invisível — não renderiza nenhum elemento visual
  return null;
}
