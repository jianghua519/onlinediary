import { Request, Response, NextFunction } from "express";
import { User } from "../models/User";

export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const user = await User.findByPk(req.userId);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!user.is_admin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return next();
  } catch (error) {
    return res.status(500).json({ error: "Authorization failed" });
  }
};
