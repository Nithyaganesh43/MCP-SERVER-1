import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

function parseCorsOrigins(raw: string | undefined, nodeEnv: string): string[] {
  const list = (raw ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  if (nodeEnv === "production" && list.length === 0) {
    throw new Error("Missing environment variable CORS_ORIGINS");
  }
  return list;
}

export type Config = {
  mongoUri: string;
  port: number;
  timezone: string;
  googleClientId: string;
  googleClientSecret: string;
  googleCallbackUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  nodeEnv: string;
  corsOrigins: string[];
  mcpApiKey?: string;
};

export function loadConfig(): Config {
  const nodeEnv = process.env.NODE_ENV ?? "development";

  return {
    mongoUri: required("MONGODB_URI"),
    port: Number(process.env.PORT ?? "3000"),
    timezone: process.env.TIMEZONE ?? "Asia/Kolkata",
    googleClientId: required("GOOGLE_CLIENT_ID"),
    googleClientSecret: required("GOOGLE_CLIENT_SECRET"),
    googleCallbackUrl: required("GOOGLE_CALLBACK_URL"),
    jwtSecret: required("JWT_SECRET"),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
    nodeEnv,
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS, nodeEnv),
    mcpApiKey: process.env.MCP_API_KEY,
  };
}
