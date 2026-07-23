import { neon } from "@neondatabase/serverless";

export const isNeonConfigured = () => {
  const databaseUrl = 
    process.env.DATABASE_URL || 
    process.env.DETABASE_URL || 
    process.env.detabase_url || 
    "";
  return (
    !!databaseUrl &&
    databaseUrl !== "" &&
    !databaseUrl.includes("placeholder")
  );
};

const getNeonSql = () => {
  const databaseUrl = 
    process.env.DATABASE_URL || 
    process.env.DETABASE_URL || 
    process.env.detabase_url || 
    "";
  
  if (!databaseUrl || databaseUrl.includes("placeholder")) {
    throw new Error("Neon database URL not configured");
  }
  
  return neon(databaseUrl);
};

export const sql = async (strings: TemplateStringsArray | string, ...values: any[]) => {
  const neonSql = getNeonSql();
  
  if (typeof strings === "string") {
    // Conventional call: sql("SELECT * FROM table WHERE id = $1", [id])
    const rows = await neonSql.query(strings, values[0] || []);
    return rows;
  } else {
    // Template literal call: sql`SELECT * FROM table WHERE id = ${id}`
    const rows = await (neonSql as any)(strings, ...values);
    return rows;
  }
};
