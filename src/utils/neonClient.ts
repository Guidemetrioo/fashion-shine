import { neon } from "@neondatabase/serverless";

const databaseUrl = 
  process.env.DATABASE_URL || 
  process.env.DETABASE_URL || 
  process.env.detabase_url || 
  "";

export const isNeonConfigured = () => {
  return (
    !!databaseUrl &&
    databaseUrl !== "" &&
    !databaseUrl.includes("placeholder")
  );
};

export const sql = isNeonConfigured()
  ? neon(databaseUrl)
  : (null as any);
