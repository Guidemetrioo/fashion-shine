import { NextRequest, NextResponse } from "next/server";
import { getDBProducts } from "../../../../../utils/productStorage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const products = await getDBProducts();
    const product = products.find(p => p.id === id);

    if (!product || !product.imageUrl) {
      return new Response("Product or image not found", { status: 404 });
    }

    const base64Data = product.imageUrl;

    // Check if it is a valid base64 image data URL
    const matches = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (!matches) {
      // If it is already a public HTTP/S URL, redirect to it!
      if (base64Data.startsWith("http")) {
        return NextResponse.redirect(base64Data);
      }
      return new Response("Invalid image data", { status: 400 });
    }

    const contentType = matches[1];
    const buffer = Buffer.from(matches[2], "base64");

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch (err: any) {
    console.error("Error serving image:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
