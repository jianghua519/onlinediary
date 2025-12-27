import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    const userId = verifyAccessToken(token);
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }
    req.userId = userId;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};
