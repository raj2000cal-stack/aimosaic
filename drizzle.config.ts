import { defineConfig } from "drizzle-kit";

// Read DATABASE_URL from .env.local when run from the command line.
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local; rely on the environment
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
