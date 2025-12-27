import { Router } from "express";
import { z } from "zod";
import { User } from "../models/User";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get("/users", async (_req, res) => {
  try {
    const users = await User.findAll({
      order: [["created_at", "ASC"]]
    });

    return res.status(200).json({
      users: users.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        is_admin: user.is_admin,
        is_approved: user.is_approved,
        storage_quota: Number(user.storage_quota),
        storage_used: Number(user.storage_used),
        created_at: user.created_at,
        last_login: user.last_login
      }))
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load users" });
  }
});

const approvalSchema = z.object({
  approved: z.boolean().optional()
});

router.patch("/users/:id/approve", async (req, res) => {
  const parsed = approvalSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.is_approved = parsed.data.approved ?? true;
    await user.save();

    return res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        is_approved: user.is_approved
      }
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update approval" });
  }
});

const quotaSchema = z.object({
  storageQuota: z.number().int().positive()
});

router.patch("/users/:id/quota", async (req, res) => {
  const parsed = quotaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.storage_quota = parsed.data.storageQuota;
    await user.save();

    return res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        storage_quota: Number(user.storage_quota)
      }
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update quota" });
  }
});

export default router;
