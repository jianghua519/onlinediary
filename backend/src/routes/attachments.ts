import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { z } from "zod";
import { config } from "../config";
import { requireAuth } from "../middleware/auth";
import { Entry } from "../models/Entry";
import { Attachment } from "../models/Attachment";
import { User } from "../models/User";

const router = Router();

const ensureUploadsDir = async () => {
  await fs.mkdir(config.uploadsDir, { recursive: true });
};

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await ensureUploadsDir();
      cb(null, config.uploadsDir);
    } catch (error) {
      cb(error as Error, config.uploadsDir);
    }
  },
  filename: (_req, _file, cb) => {
    cb(null, `${crypto.randomUUID()}.bin`);
  }
});

const upload = multer({ storage });

const removeFile = async (filePath?: string | null) => {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    return;
  }
};

const cleanupUpload = async (
  file?: Express.Multer.File,
  thumbnail?: Express.Multer.File
) => {
  await removeFile(file?.path);
  await removeFile(thumbnail?.path);
};

router.use(requireAuth);

const uploadSchema = z.object({
  entryId: z.string().min(1),
  encryptedFilename: z.string().min(1),
  encryptedFileKey: z.string().min(1),
  mimeType: z.string().min(1).optional()
});

const toBase64 = (value?: Buffer | null) => {
  if (!value) return null;
  return value.toString("base64");
};

router.post(
  "/",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 }
  ]),
  async (req, res) => {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parsed = uploadSchema.safeParse(req.body);

    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const file = files?.file?.[0];
    const thumbnail = files?.thumbnail?.[0];

    if (!parsed.success) {
      await cleanupUpload(file, thumbnail);
      return res.status(400).json({ error: "Invalid payload" });
    }

    if (!file) {
      return res.status(400).json({ error: "File missing" });
    }

    if (file.size > config.maxImageSizeMb * 1024 * 1024) {
      await cleanupUpload(file, thumbnail);
      return res.status(400).json({ error: "File exceeds size limit" });
    }

    try {
      const entry = await Entry.findOne({
        where: { id: parsed.data.entryId, user_id: req.userId }
      });

      if (!entry) {
        return res.status(404).json({ error: "Entry not found" });
      }

      const attachmentCount = await Attachment.count({
        where: { entry_id: entry.id }
      });

      if (attachmentCount >= config.maxImagesPerEntry) {
        return res.status(400).json({ error: "Attachment limit reached" });
      }

      const user = await User.findByPk(req.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const addedBytes = file.size + (thumbnail?.size ?? 0);
      if (Number(user.storage_used) + addedBytes > Number(user.storage_quota)) {
        return res.status(400).json({ error: "Storage quota exceeded" });
      }

      const attachment = await Attachment.create({
        entry_id: entry.id,
        encrypted_filename: Buffer.from(parsed.data.encryptedFilename, "base64"),
        encrypted_file_key: Buffer.from(parsed.data.encryptedFileKey, "base64"),
        file_path: file.path,
        thumbnail_path: thumbnail?.path ?? null,
        mime_type: parsed.data.mimeType ?? null,
        file_size: file.size + (thumbnail?.size ?? 0)
      });

      user.storage_used = Number(user.storage_used) + addedBytes;
      await user.save();

      return res.status(201).json({
        attachment: {
          id: attachment.id,
          encryptedFilename: toBase64(attachment.encrypted_filename),
          encryptedFileKey: toBase64(attachment.encrypted_file_key),
          mimeType: attachment.mime_type,
          fileSize: Number(attachment.file_size),
          hasThumbnail: Boolean(attachment.thumbnail_path),
          uploadedAt: attachment.uploaded_at
        }
      });
    } catch (error) {
      await cleanupUpload(file, thumbnail);
      return res.status(500).json({ error: "Failed to upload attachment" });
    }
  }
);

router.get("/", async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const entryId = typeof req.query.entryId === "string" ? req.query.entryId : "";
  if (!entryId) {
    return res.status(400).json({ error: "Missing entryId" });
  }

  try {
    const entry = await Entry.findOne({
      where: { id: entryId, user_id: req.userId }
    });

    if (!entry) {
      return res.status(404).json({ error: "Entry not found" });
    }

    const attachments = await Attachment.findAll({
      where: { entry_id: entryId },
      order: [["uploaded_at", "DESC"]]
    });

    return res.status(200).json({
      attachments: attachments.map((attachment) => ({
        id: attachment.id,
        encryptedFilename: toBase64(attachment.encrypted_filename),
        encryptedFileKey: toBase64(attachment.encrypted_file_key),
        mimeType: attachment.mime_type,
        fileSize: Number(attachment.file_size),
        hasThumbnail: Boolean(attachment.thumbnail_path),
        uploadedAt: attachment.uploaded_at
      }))
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load attachments" });
  }
});

const loadAttachment = async (id: string, userId: string) => {
  const attachment = await Attachment.findByPk(id);
  if (!attachment) {
    return null;
  }

  const entry = await Entry.findOne({
    where: { id: attachment.entry_id, user_id: userId }
  });

  if (!entry) {
    return null;
  }

  return attachment;
};

router.get("/:id/file", async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const attachment = await loadAttachment(req.params.id, req.userId);
    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    return res.sendFile(path.resolve(attachment.file_path));
  } catch (error) {
    return res.status(500).json({ error: "Failed to download attachment" });
  }
});

router.get("/:id/thumbnail", async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const attachment = await loadAttachment(req.params.id, req.userId);
    if (!attachment || !attachment.thumbnail_path) {
      return res.status(404).json({ error: "Thumbnail not found" });
    }

    return res.sendFile(path.resolve(attachment.thumbnail_path));
  } catch (error) {
    return res.status(500).json({ error: "Failed to download thumbnail" });
  }
});

router.delete("/:id", async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const attachment = await loadAttachment(req.params.id, req.userId);
    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    const user = await User.findByPk(req.userId);
    if (user) {
      user.storage_used = Math.max(
        0,
        Number(user.storage_used) - Number(attachment.file_size)
      );
      await user.save();
    }

    await removeFile(attachment.file_path);
    await removeFile(attachment.thumbnail_path);
    await attachment.destroy();

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete attachment" });
  }
});

export default router;
