import { neon } from "@neondatabase/serverless";

let cachedClient: any = null;

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

export const sql = (strings: TemplateStringsArray | string, ...values: any[]) => {
  if (!cachedClient) {
    const databaseUrl = 
      process.env.DATABASE_URL || 
      process.env.DETABASE_URL || 
      process.env.detabase_url || 
      "";
    
    if (!databaseUrl || databaseUrl.includes("placeholder")) {
      throw new Error("Neon database URL not configured");
    }
    
    cachedClient = neon(databaseUrl);
  }

  if (typeof strings === "string") {
    return cachedClient(strings, values[0] || []);
  } else {
    return cachedClient(strings, ...values);
  }
};
