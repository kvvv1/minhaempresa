import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

const projectRoot = process.cwd();

for (const envFile of [".env", ".env.local"]) {
  const envPath = resolve(projectRoot, envFile);

  if (existsSync(envPath)) {
    loadEnv({ path: envPath, override: envFile === ".env.local" });
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
