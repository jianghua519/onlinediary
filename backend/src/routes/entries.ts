import { Router } from "express";
import { z } from "zod";
import { Op } from "sequelize";
import fs from "fs/promises";
import { Entry } from "../models/Entry";
import { Attachment } from "../models/Attachment";
import { User } from "../models/User";
import { requireAuth } from "../middleware/auth";
import { getRealtimeServer } from "../realtime";

const router = Router();

router.use(requireAuth);

const entryPayload = z.object({
  encryptedTitle: z.string().min(1).optional(),
  encryptedContent: z.string().min(1),
  encryptedMetadata: z.string().min(1).optional(),
  encryptedEntryKey: z.string().min(1),
  entryDate: z.string().datetime(),
  isFavorite: z.boolean().optional(),
  version: z.number().int().positive().optional()
});

const entryPatch = entryPayload.partial().extend({
  entryDate: z.string().datetime().optional()
});

const toBase64 = (value?: Buffer | null) => {
  if (!value) return null;
  return value.toString("base64");
};

const fromBase64 = (value?: string | null) => {
  if (!value) return null;
  return Buffer.from(value, "base64");
};

const removeFile = async (filePath: string | null | undefined) => {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    return;
  }
};

router.post("/", async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const parsed = entryPayload.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    const created = await Entry.create({
      user_id: req.userId,
      encrypted_title: fromBase64(parsed.data.encryptedTitle),
      encrypted_content: Buffer.from(parsed.data.encryptedContent, "base64"),
      encrypted_metadata: fromBase64(parsed.data.encryptedMetadata),
      encrypted_entry_key: Buffer.from(parsed.data.encryptedEntryKey, "base64"),
      entry_date: new Date(parsed.data.entryDate),
      is_favorite: parsed.data.isFavorite ?? false,
      version: parsed.data.version ?? 1
    });

    const realtime = getRealtimeServer();
    realtime?.to(`user:${req.userId}`).emit("entry:created", {
      id: created.id,
      entryDate: created.entry_date,
      version: created.version
    });

    return res.status(201).json({
      entry: {
        id: created.id,
        encryptedTitle: toBase64(created.encrypted_title),
        encryptedContent: toBase64(created.encrypted_content),
        encryptedMetadata: toBase64(created.encrypted_metadata),
        encryptedEntryKey: toBase64(created.encrypted_entry_key),
        entryDate: created.entry_date,
        isFavorite: created.is_favorite,
        version: created.version,
        createdAt: created.created_at,
        updatedAt: created.updated_at
      }
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to create entry" });
  }
});

router.get("/", async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);

  const where: Record<string, unknown> = { user_id: req.userId };
  if (from || to) {
    where.entry_date = {
      ...(from ? { [Op.gte]: new Date(from) } : {}),
      ...(to ? { [Op.lte]: new Date(to) } : {})
    };
  }

  try {
    const entries = await Entry.findAll({
      where,
      order: [["entry_date", "DESC"]],
      limit: Number.isFinite(limit) ? limit : 50,
      offset: Number.isFinite(offset) ? offset : 0
    });

    return res.status(200).json({
      entries: entries.map((entry) => ({
        id: entry.id,
        encryptedTitle: toBase64(entry.encrypted_title),
        encryptedContent: toBase64(entry.encrypted_content),
        encryptedMetadata: toBase64(entry.encrypted_metadata),
        encryptedEntryKey: toBase64(entry.encrypted_entry_key),
        entryDate: entry.entry_date,
        isFavorite: entry.is_favorite,
        version: entry.version,
        createdAt: entry.created_at,
        updatedAt: entry.updated_at
      }))
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load entries" });
  }
});

router.get("/:id", async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const entry = await Entry.findOne({
      where: { id: req.params.id, user_id: req.userId }
    });

    if (!entry) {
      return res.status(404).json({ error: "Entry not found" });
    }

    const realtime = getRealtimeServer();
    realtime?.to(`user:${req.userId}`).emit("entry:updated", {
      id: entry.id,
      entryDate: entry.entry_date,
      version: entry.version
    });

    return res.status(200).json({
      entry: {
        id: entry.id,
        encryptedTitle: toBase64(entry.encrypted_title),
        encryptedContent: toBase64(entry.encrypted_content),
        encryptedMetadata: toBase64(entry.encrypted_metadata),
        encryptedEntryKey: toBase64(entry.encrypted_entry_key),
        entryDate: entry.entry_date,
        isFavorite: entry.is_favorite,
        version: entry.version,
        createdAt: entry.created_at,
        updatedAt: entry.updated_at
      }
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load entry" });
  }
});

router.patch("/:id", async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const parsed = entryPatch.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    const entry = await Entry.findOne({
      where: { id: req.params.id, user_id: req.userId }
    });

    if (!entry) {
      return res.status(404).json({ error: "Entry not found" });
    }

    if (parsed.data.encryptedTitle !== undefined) {
      entry.encrypted_title = fromBase64(parsed.data.encryptedTitle);
    }
    if (parsed.data.encryptedContent !== undefined) {
      entry.encrypted_content = Buffer.from(parsed.data.encryptedContent, "base64");
    }
    if (parsed.data.encryptedMetadata !== undefined) {
      entry.encrypted_metadata = fromBase64(parsed.data.encryptedMetadata);
    }
    if (parsed.data.encryptedEntryKey !== undefined) {
      entry.encrypted_entry_key = Buffer.from(parsed.data.encryptedEntryKey, "base64");
    }
    if (parsed.data.entryDate !== undefined) {
      entry.entry_date = new Date(parsed.data.entryDate);
    }
    if (parsed.data.isFavorite !== undefined) {
      entry.is_favorite = parsed.data.isFavorite;
    }
    if (
      parsed.data.version !== undefined &&
      parsed.data.version !== entry.version
    ) {
      return res.status(409).json({
        error: "Version conflict",
        currentVersion: entry.version
      });
    }

    entry.version = entry.version + 1;
    entry.updated_at = new Date();
    await entry.save();

    return res.status(200).json({
      entry: {
        id: entry.id,
        encryptedTitle: toBase64(entry.encrypted_title),
        encryptedContent: toBase64(entry.encrypted_content),
        encryptedMetadata: toBase64(entry.encrypted_metadata),
        encryptedEntryKey: toBase64(entry.encrypted_entry_key),
        entryDate: entry.entry_date,
        isFavorite: entry.is_favorite,
        version: entry.version,
        createdAt: entry.created_at,
        updatedAt: entry.updated_at
      }
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update entry" });
  }
});

router.delete("/:id", async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const entry = await Entry.findOne({
      where: { id: req.params.id, user_id: req.userId }
    });

    if (!entry) {
      return res.status(404).json({ error: "Entry not found" });
    }

    const attachments = await Attachment.findAll({
      where: { entry_id: entry.id }
    });
    const totalSize = attachments.reduce(
      (sum, attachment) => sum + Number(attachment.file_size),
      0
    );

    await Promise.all(
      attachments.map(async (attachment) => {
        await removeFile(attachment.file_path);
        await removeFile(attachment.thumbnail_path);
        await attachment.destroy();
      })
    );

    const user = await User.findByPk(req.userId);
    if (user && totalSize > 0) {
      user.storage_used = Math.max(
        0,
        Number(user.storage_used) - totalSize
      );
      await user.save();
    }

    await entry.destroy();
    const realtime = getRealtimeServer();
    realtime?.to(`user:${req.userId}`).emit("entry:deleted", { id: entry.id });
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete entry" });
  }
});

export default router;
