import { NextResponse } from "next/server";
import { sql, isNeonConfigured } from "@/utils/neonClient";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isNeonConfigured()) {
    return NextResponse.json({ error: "Neon database not configured" }, { status: 500 });
  }

  try {
    // 1. Count how many prod-pdf products exist
    const countResult = await sql(
      `SELECT COUNT(*) as total FROM products WHERE id LIKE 'prod-pdf-%'`,
      []
    );
    const total = parseInt((countResult as any)[0]?.total ?? "0");

    return NextResponse.json({
      action: "preview",
      pdf_products_found: total,
      message: `Found ${total} prod-pdf products in the database.`,
      instructions: "To delete them, call POST to this same endpoint."
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST() {
  if (!isNeonConfigured()) {
    return NextResponse.json({ error: "Neon database not configured" }, { status: 500 });
  }

  try {
    // 1. Count before
    const countBefore = await sql(
      `SELECT COUNT(*) as total FROM products WHERE id LIKE 'prod-pdf-%'`,
      []
    );
    const totalBefore = parseInt((countBefore as any)[0]?.total ?? "0");

    if (totalBefore === 0) {
      return NextResponse.json({
        success: true,
        deleted: 0,
        message: "No prod-pdf products found in the database. Nothing to delete."
      });
    }

    // 2. Delete
    await sql(
      `DELETE FROM products WHERE id LIKE 'prod-pdf-%'`,
      []
    );

    // 3. Count after
    const countAfter = await sql(
      `SELECT COUNT(*) as total FROM products`,
      []
    );
    const remaining = parseInt((countAfter as any)[0]?.total ?? "0");

    return NextResponse.json({
      success: true,
      deleted: totalBefore,
      remaining_products: remaining,
      message: `Successfully deleted ${totalBefore} prod-pdf products. ${remaining} products remain in the database.`
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
