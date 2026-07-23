import { Pool } from "@neondatabase/serverless";

let poolInstance: Pool | null = null;

const getPool = () => {
  if (!poolInstance) {
    const databaseUrl = 
      process.env.DATABASE_URL || 
      process.env.DETABASE_URL || 
      process.env.detabase_url || 
      "";
    
    if (!databaseUrl || databaseUrl.includes("placeholder")) {
      throw new Error("Neon database URL not configured");
    }
    
    poolInstance = new Pool({ connectionString: databaseUrl });
  }
  return poolInstance;
};

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

export const sql = async (strings: TemplateStringsArray | string, ...values: any[]) => {
  const pool = getPool();
  
  if (typeof strings === "string") {
    // Conventional call: sql(queryText, params)
    const result = await pool.query(strings, values[0] || []);
    return result.rows;
  } else {
    // Template literal call: sql`SELECT * FROM users WHERE id = ${id}`
    const queryText = strings.reduce((acc, str, idx) => acc + str + `$${idx + 1}`, "").slice(0, -`$${strings.length}`.length);
    const result = await pool.query(queryText, values);
    return result.rows;
  }
};
