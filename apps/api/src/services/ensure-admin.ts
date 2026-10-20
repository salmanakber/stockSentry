import bcrypt from "bcryptjs";
import { prisma } from "@stocksentry/database";

/**
 * Boot sync: when ADMIN_PASSWORD is set, upsert an OWNER AdminUser so
 * env credentials are the source of truth (passwordHash refreshed every boot).
 */
export async function ensureAdminFromEnv(): Promise<void> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return;

  if (!process.env.ADMIN_JWT_SECRET) {
    throw new Error(
      "ADMIN_JWT_SECRET is required when ADMIN_PASSWORD is set",
    );
  }

  const email = (
    process.env.ADMIN_EMAIL || "admin@stocksentry.local"
  )
    .trim()
    .toLowerCase();

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.adminUser.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      name: "Owner",
      role: "OWNER",
    },
    update: {
      passwordHash,
      role: "OWNER",
    },
  });

  console.log("[admin] synced AdminUser from ADMIN_EMAIL/ADMIN_PASSWORD");
}
