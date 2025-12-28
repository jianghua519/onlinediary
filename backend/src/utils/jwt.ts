import jwt, { JwtPayload, type SignOptions } from "jsonwebtoken";
import { config } from "../config";

const asSubject = (payload: string | JwtPayload): string | null => {
  if (typeof payload === "string") {
    return null;
  }
  const subject = payload.sub;
  return typeof subject === "string" ? subject : null;
};

const accessExpiresIn = config.jwt.accessTtl as SignOptions["expiresIn"];
const refreshExpiresIn = config.jwt.refreshTtl as SignOptions["expiresIn"];

export const signAccessToken = (userId: string) =>
  jwt.sign({ sub: userId }, config.jwt.accessSecret, {
    expiresIn: accessExpiresIn
  });

export const signRefreshToken = (userId: string) =>
  jwt.sign({ sub: userId }, config.jwt.refreshSecret, {
    expiresIn: refreshExpiresIn
  });

export const verifyAccessToken = (token: string): string | null => {
  const payload = jwt.verify(token, config.jwt.accessSecret) as string | JwtPayload;
  return asSubject(payload);
};

export const verifyRefreshToken = (token: string): string | null => {
  const payload = jwt.verify(token, config.jwt.refreshSecret) as string | JwtPayload;
  return asSubject(payload);
};
