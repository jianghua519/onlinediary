import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db";

export interface AttachmentAttributes {
  id: string;
  entry_id: string;
  encrypted_filename: Buffer;
  file_path: string;
  encrypted_file_key: Buffer;
  mime_type?: string | null;
  file_size: number;
  thumbnail_path?: string | null;
  uploaded_at?: Date;
}

type AttachmentCreationAttributes = Optional<
  AttachmentAttributes,
  "id" | "mime_type" | "thumbnail_path" | "uploaded_at"
>;

export class Attachment
  extends Model<AttachmentAttributes, AttachmentCreationAttributes>
  implements AttachmentAttributes
{
  declare id: string;
  declare entry_id: string;
  declare encrypted_filename: Buffer;
  declare file_path: string;
  declare encrypted_file_key: Buffer;
  declare mime_type?: string | null;
  declare file_size: number;
  declare thumbnail_path?: string | null;
  declare uploaded_at?: Date;
}

Attachment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    entry_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    encrypted_filename: {
      type: DataTypes.BLOB("long"),
      allowNull: false
    },
    file_path: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    encrypted_file_key: {
      type: DataTypes.BLOB("long"),
      allowNull: false
    },
    mime_type: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    file_size: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    thumbnail_path: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    uploaded_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    tableName: "attachments",
    timestamps: false
  }
);
