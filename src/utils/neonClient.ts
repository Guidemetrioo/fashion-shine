import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL || "";

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
