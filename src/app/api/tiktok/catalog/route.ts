export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDBProducts } from "../../../../utils/productStorage";
import * as XLSX from "xlsx";

/**
 * GET /api/tiktok/catalog
 * Exporta os 73 produtos da Fashion Shine no formato oficial de Catálogo do TikTok (Excel, CSV ou JSON).
 */
export async function GET(request: NextRequest) {
  try {
    const products = await getDBProducts();
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.nextUrl.origin ||
      "http://localhost:3000";

    const { searchParams } = request.nextUrl;
    const format = searchParams.get("format");
    const type = searchParams.get("type");
    const download = searchParams.get("download") === "true";
    const compact = searchParams.get("compact") === "true";
    const part = searchParams.get("part"); // "1" ou "2"

    // Filtra por parte se solicitado (Divisão para arquivos < 15 KB)
    let targetProducts = [...products];
    if (part === "1") {
      targetProducts = targetProducts.slice(0, 25);
    } else if (part === "2") {
      targetProducts = targetProducts.slice(25, 50);
    } else if (part === "3") {
      targetProducts = targetProducts.slice(50);
    }

    // Formato Excel (.xlsx) para Central do Vendedor TikTok Shop
    if (format === "excel" || type === "seller_excel") {
      const excelData = targetProducts.map((p) => {
        let desc = p.description || p.name;
        if (compact && desc.length > 80) {
          desc = desc.substring(0, 77) + "...";
        }
        return {
          "Nome do Produto": p.name,
          "SKU do Vendedor": p.sku || p.id,
          "Preço (BRL)": Number(p.basePrice || 0),
          "Estoque Quantidade": p.totalStock > 0 ? p.totalStock : (p.mlStock || 1),
          "Descrição do Produto": desc,
          "URL da Imagem Principal": p.imageUrl || "",
          "Marca": "Fashion Shine",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Produtos TikTok");

      const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      const fileName = part
        ? `fashion_shine_tiktok_parte_${part}.xlsx`
        : compact
        ? "fashion_shine_tiktok_73produtos_compacto.xlsx"
        : "fashion_shine_tiktok_produtos.xlsx";

      const headers: Record<string, string> = {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      };

      return new NextResponse(excelBuffer, { status: 200, headers });
    }

    // Formato JSON
    if (format === "json") {
      return NextResponse.json({
        success: true,
        count: products.length,
        updatedAt: new Date().toISOString(),
        products: products.map((p) => ({
          sku_id: p.sku || p.id,
          title: p.name,
          description: p.description || p.name,
          availability: (p.totalStock > 0 || (p.mlStock > 0 || p.shopeeStock > 0)) ? "in stock" : "out of stock",
          condition: "new",
          price: `${Number(p.basePrice || 0).toFixed(2)} BRL`,
          link: `${appUrl}/products/${p.sku || p.id}`,
          image_link: p.imageUrl || "",
          brand: "Fashion Shine",
          google_product_category: "Apparel & Accessories > Jewelry",
        })),
      });
    }

    // Formato CSV para Central do Vendedor TikTok Shop BR (seller-br.tiktok.com)
    if (type === "seller") {
      const sellerHeader = [
        "Nome do Produto",
        "SKU do Vendedor",
        "Preço (BRL)",
        "Estoque Quantidade",
        "Descrição do Produto",
        "URL da Imagem Principal",
        "Marca",
      ].join(",");

      const sellerRows = products.map((p) => {
        const title = escapeCsv(p.name);
        const skuId = escapeCsv(p.sku || p.id);
        const price = Number(p.basePrice || 0).toFixed(2);
        const stock = p.totalStock > 0 ? p.totalStock : (p.mlStock || 1);
        const desc = escapeCsv(p.description || p.name);
        const imageLink = escapeCsv(p.imageUrl || "");
        const brand = "Fashion Shine";

        return [title, skuId, price, stock, desc, imageLink, brand].join(",");
      });

      const sellerCsvContent = "\uFEFF" + [sellerHeader, ...sellerRows].join("\r\n");

      const headers: Record<string, string> = {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      };

      if (download) {
        headers["Content-Disposition"] =
          'attachment; filename="fashion_shine_tiktok_seller_central.csv"';
      }

      return new NextResponse(sellerCsvContent, { status: 200, headers });
    }

    // Formato CSV (Padrão para TikTok Catalog Feed & Ads)
    const csvHeader = [
      "sku_id",
      "title",
      "description",
      "availability",
      "condition",
      "price",
      "link",
      "image_link",
      "brand",
      "google_product_category",
    ].join(",");

    const csvRows = products.map((p) => {
      const skuId = escapeCsv(p.sku || p.id);
      const title = escapeCsv(p.name);
      const desc = escapeCsv(p.description || p.name);
      const isAvailable = (p.totalStock > 0 || p.mlStock > 0 || p.shopeeStock > 0 || p.basePrice > 0);
      const availability = isAvailable ? "in stock" : "out of stock";
      const condition = "new";
      const price = `${Number(p.basePrice || 0).toFixed(2)} BRL`;
      const link = escapeCsv(`${appUrl}/products/${p.sku || p.id}`);
      const imageLink = escapeCsv(p.imageUrl || "");
      const brand = "Fashion Shine";
      const category = "Apparel & Accessories > Jewelry";

      return [
        skuId,
        title,
        desc,
        availability,
        condition,
        price,
        link,
        imageLink,
        brand,
        category,
      ].join(",");
    });

    const csvContent = "\uFEFF" + [csvHeader, ...csvRows].join("\r\n"); // UTF-8 BOM para acentuação correta no Excel / TikTok

    const responseHeaders: Record<string, string> = {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    };

    if (download) {
      responseHeaders["Content-Disposition"] =
        'attachment; filename="fashion_shine_tiktok_catalog.csv"';
    }

    return new NextResponse(csvContent, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error("Erro ao gerar catálogo TikTok:", error);
    return NextResponse.json(
      { success: false, error: "Falha ao gerar o catálogo de produtos para o TikTok" },
      { status: 500 }
    );
  }
}

function escapeCsv(val: string): string {
  if (!val) return '""';
  const clean = val.replace(/"/g, '""').replace(/\r?\n/g, " ");
  return `"${clean}"`;
}
