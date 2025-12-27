import dotenv from "dotenv";

dotenv.config();

const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  env: process.env.NODE_ENV ?? "development",
  port: toNumber(process.env.PORT, 3000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  db: {
    host: process.env.DB_HOST ?? "192.168.31.240",
    port: toNumber(process.env.DB_PORT, 3307),
    name: process.env.DB_NAME ?? "onlinediary",
    user: process.env.DB_USER ?? "onlinediary",
    password: process.env.DB_PASSWORD ?? ")UOsR95HEGfBX0rN",
    sync: process.env.DB_SYNC === "true",
    syncAlter: process.env.DB_SYNC_ALTER === "true"
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? "change-me-access",
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? "change-me-refresh",
    accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
    refreshTtl: process.env.JWT_REFRESH_TTL ?? "30d"
  },
  requireApproval: process.env.REQUIRE_APPROVAL === "true",
  uploadsDir: process.env.UPLOADS_DIR ?? "uploads",
  maxImagesPerEntry: toNumber(process.env.MAX_IMAGES_PER_ENTRY, 10),
  maxImageSizeMb: toNumber(process.env.MAX_IMAGE_MB, 10)
};
