import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { isNeonConfigured } from "../../../../utils/neonClient";
import { getDBProducts } from "../../../../utils/productStorage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const dbUrl = process.env.DATABASE_URL;
    const neonConfigured = isNeonConfigured();
    
    // Check if products.json exists in the filesystem
    const productsFilePath = path.join(process.cwd(), "products.json");
    const deletedFilePath = path.join(process.cwd(), "deleted_products.json");
    
    let productsFileExists = false;
    let productsFileCount = 0;
    let deletedFileExists = false;
    let deletedFileCount = 0;
    
    try {
      productsFileExists = fs.existsSync(productsFilePath);
      if (productsFileExists) {
        const data = JSON.parse(fs.readFileSync(productsFilePath, "utf8"));
        productsFileCount = Array.isArray(data) ? data.length : 0;
      }
    } catch (e) {
      // ignore
    }

    try {
      deletedFileExists = fs.existsSync(deletedFilePath);
      if (deletedFileExists) {
        const data = JSON.parse(fs.readFileSync(deletedFilePath, "utf8"));
        deletedFileCount = Array.isArray(data) ? data.length : 0;
      }
    } catch (e) {
      // ignore
    }

    // Get products via the standard method
    const products = await getDBProducts();
    
    // Count FS-JOIA products
    const fsJoiaCount = products.filter(p => p.sku.startsWith("FS-JOIA")).length;
    const otherCount = products.length - fsJoiaCount;
    
    return NextResponse.json({
      diagnosis: {
        neonConfigured,
        databaseUrlPresent: !!dbUrl,
        databaseUrlPrefix: dbUrl ? dbUrl.substring(0, 30) + "..." : "NOT SET",
        cwd: process.cwd(),
        productsFilePath,
        productsFileExists,
        productsFileCount,
        deletedFilePath,
        deletedFileExists,
        deletedFileCount,
        getDBProductsCount: products.length,
        fsJoiaCount,
        otherCount,
        sampleIds: products.slice(0, 3).map(p => ({ id: p.id, sku: p.sku })),
      }
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache"
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
