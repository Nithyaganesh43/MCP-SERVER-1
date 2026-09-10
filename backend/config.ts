import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
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
  mcpApiKey?: string;
  mcpUserId?: string;
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
    mcpApiKey: process.env.MCP_API_KEY,
    mcpUserId: process.env.MCP_USER_ID,
  };
}
