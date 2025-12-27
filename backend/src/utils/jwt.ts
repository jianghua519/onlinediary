import jwt, { JwtPayload } from "jsonwebtoken";
import { config } from "../config";

const asSubject = (payload: string | JwtPayload): string | null => {
  if (typeof payload === "string") {
    return null;
  }
  const subject = payload.sub;
  return typeof subject === "string" ? subject : null;
};

export const signAccessToken = (userId: string) =>
  jwt.sign({ sub: userId }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessTtl
  });

export const signRefreshToken = (userId: string) =>
  jwt.sign({ sub: userId }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshTtl
  });

export const verifyAccessToken = (token: string): string | null => {
  const payload = jwt.verify(token, config.jwt.accessSecret) as string | JwtPayload;
  return asSubject(payload);
};

export const verifyRefreshToken = (token: string): string | null => {
  const payload = jwt.verify(token, config.jwt.refreshSecret) as string | JwtPayload;
  return asSubject(payload);
};
