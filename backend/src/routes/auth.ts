import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { User } from "../models/User";
import { config } from "../config";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { requireAuth } from "../middleware/auth";

const router = Router();

const registerSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(8).max(128),
  email: z.string().email().optional(),
  publicKey: z.string().min(10),
  encryptedPrivateKey: z.string().min(10)
});

const loginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(128)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20)
});

const passwordSchema = z.object({
  currentPassword: z.string().min(8).max(128),
  newPassword: z.string().min(8).max(128),
  encryptedPrivateKey: z.string().min(10)
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const { username, password, email, publicKey, encryptedPrivateKey } = parsed.data;

  try {
    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return res.status(409).json({ error: "Username already exists" });
    }

    const userCount = await User.count();
    const isFirstUser = userCount === 0;
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      username,
      password_hash: passwordHash,
      email: email ?? null,
      public_key: publicKey,
      encrypted_private_key: encryptedPrivateKey,
      is_admin: isFirstUser,
      is_approved: isFirstUser || !config.requireApproval
    });

    return res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin,
        is_approved: user.is_approved
      },
      approvalRequired: config.requireApproval && !isFirstUser
    });
  } catch (error) {
    return res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const { username, password } = parsed.data;

  try {
    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (config.requireApproval && !user.is_approved) {
      return res.status(403).json({ error: "Account pending approval" });
    }

    const accessToken = signAccessToken(user.id);
    const refreshToken = signRefreshToken(user.id);
    user.refresh_token_hash = await bcrypt.hash(refreshToken, 12);
    user.last_login = new Date();
    await user.save();

    return res.status(200).json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin,
        is_approved: user.is_approved,
        public_key: user.public_key,
        encrypted_private_key: user.encrypted_private_key
      }
    });
  } catch (error) {
    return res.status(500).json({ error: "Login failed" });
  }
});

router.post("/refresh", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const { refreshToken } = parsed.data;

  try {
    const userId = verifyRefreshToken(refreshToken);
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const user = await User.findByPk(userId);
    if (!user || !user.refresh_token_hash) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const matches = await bcrypt.compare(refreshToken, user.refresh_token_hash);
    if (!matches) {
      return res.status(401).json({ error: "Invalid token" });
    }

    if (config.requireApproval && !user.is_approved) {
      return res.status(403).json({ error: "Account pending approval" });
    }

    const accessToken = signAccessToken(user.id);
    const nextRefreshToken = signRefreshToken(user.id);
    user.refresh_token_hash = await bcrypt.hash(nextRefreshToken, 12);
    await user.save();

    return res.status(200).json({
      accessToken,
      refreshToken: nextRefreshToken
    });
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
});

router.post("/password", requireAuth, async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const { currentPassword, newPassword, encryptedPrivateKey } = parsed.data;

  try {
    const user = await User.findByPk(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const matches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!matches) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    user.password_hash = await bcrypt.hash(newPassword, 12);
    user.encrypted_private_key = encryptedPrivateKey;
    user.refresh_token_hash = null;
    await user.save();

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update password" });
  }
});

router.post("/logout", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(200).json({ ok: true });
  }

  try {
    const userId = verifyRefreshToken(parsed.data.refreshToken);
    if (!userId) {
      return res.status(200).json({ ok: true });
    }

    const user = await User.findByPk(userId);
    if (user) {
      user.refresh_token_hash = null;
      await user.save();
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(200).json({ ok: true });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: "Invalid token" });
  }

  try {
    const user = await User.findByPk(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin,
        is_approved: user.is_approved,
        public_key: user.public_key,
        encrypted_private_key: user.encrypted_private_key
      }
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load user" });
  }
});

export default router;
