import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "apps/web/.env.local") });
config({ path: path.resolve(__dirname, ".env") });
config();

export default {
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  migrations: {
    seed: "npx tsx prisma/seed.ts",
  },
};
