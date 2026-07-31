import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Caminho absoluto para o theme.json na raiz do projeto
const THEME_PATH = path.join(process.cwd(), "theme.json");

// Tema padrão — usado como fallback se o arquivo não existir
const DEFAULT_THEME = {
  colors: {
    background: "#EFEBE0",
    foreground: "#2d2b27",
    foregroundMuted: "#78736a",
    gold: "#b3975a",
    goldLight: "#e5dcc6",
    goldHover: "#a18347",
    darkAccent: "#fbfaf8",
  },
  fonts: {
    serif: "Playfair Display",
    sans: "Outfit",
  },
};

// Valida se uma string é uma cor hexadecimal válida (ex: #EFEBE0)
function isValidHex(color: string): boolean {
  return /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(color);
}

// Fontes permitidas — evita injeção de fontes não confiáveis
const ALLOWED_FONTS = [
  "Playfair Display",
  "Outfit",
  "Inter",
  "Roboto",
  "Lato",
  "Merriweather",
  "Libre Baskerville",
  "Montserrat",
  "Open Sans",
  "Raleway",
  "Cormorant Garamond",
];

/**
 * GET /api/theme
 * Retorna o tema atual do arquivo theme.json.
 * Se o arquivo não existir, retorna o tema padrão.
 */
export async function GET() {
  try {
    if (fs.existsSync(THEME_PATH)) {
      const raw = fs.readFileSync(THEME_PATH, "utf-8");
      const theme = JSON.parse(raw);
      return NextResponse.json(theme);
    }
    return NextResponse.json(DEFAULT_THEME);
  } catch (err) {
    console.error("[theme/GET] Erro ao ler theme.json:", err);
    return NextResponse.json(DEFAULT_THEME);
  }
}

/**
 * POST /api/theme
 * Recebe um novo tema, valida todos os campos e salva no theme.json.
 *
 * ATENÇÃO: Esta rota salva no filesystem local.
 * No Vercel (produção), o filesystem é somente leitura — as mudanças
 * não serão persistidas entre deploys. Para produção, migre para banco de dados.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validação dos campos de cor
    const { colors, fonts } = body;

    if (!colors || typeof colors !== "object") {
      return NextResponse.json(
        { error: "Campo 'colors' inválido ou ausente." },
        { status: 400 }
      );
    }

    const colorFields = [
      "background",
      "foreground",
      "foregroundMuted",
      "gold",
      "goldLight",
      "goldHover",
      "darkAccent",
    ];

    for (const field of colorFields) {
      if (colors[field] && !isValidHex(colors[field])) {
        return NextResponse.json(
          { error: `Cor inválida para o campo '${field}': ${colors[field]}` },
          { status: 400 }
        );
      }
    }

    // Validação das fontes
    if (fonts) {
      if (fonts.serif && !ALLOWED_FONTS.includes(fonts.serif)) {
        return NextResponse.json(
          { error: `Fonte serif não permitida: ${fonts.serif}` },
          { status: 400 }
        );
      }
      if (fonts.sans && !ALLOWED_FONTS.includes(fonts.sans)) {
        return NextResponse.json(
          { error: `Fonte sans não permitida: ${fonts.sans}` },
          { status: 400 }
        );
      }
    }

    // Monta o tema final mesclando com os padrões (para não perder campos)
    const currentTheme = fs.existsSync(THEME_PATH)
      ? JSON.parse(fs.readFileSync(THEME_PATH, "utf-8"))
      : DEFAULT_THEME;

    const newTheme = {
      colors: { ...currentTheme.colors, ...colors },
      fonts: { ...currentTheme.fonts, ...(fonts || {}) },
    };

    fs.writeFileSync(THEME_PATH, JSON.stringify(newTheme, null, 2), "utf-8");

    return NextResponse.json({ success: true, theme: newTheme });
  } catch (err) {
    console.error("[theme/POST] Erro ao salvar tema:", err);
    return NextResponse.json(
      { error: "Erro interno ao salvar o tema." },
      { status: 500 }
    );
  }
}
