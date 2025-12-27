import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db";

export interface EntryAttributes {
  id: string;
  user_id: string;
  encrypted_title?: Buffer | null;
  encrypted_content: Buffer;
  encrypted_metadata?: Buffer | null;
  encrypted_entry_key: Buffer;
  entry_date: Date;
  is_favorite: boolean;
  version: number;
  created_at?: Date;
  updated_at?: Date;
}

type EntryCreationAttributes = Optional<
  EntryAttributes,
  | "id"
  | "encrypted_title"
  | "encrypted_metadata"
  | "is_favorite"
  | "version"
  | "created_at"
  | "updated_at"
>;

export class Entry extends Model<EntryAttributes, EntryCreationAttributes>
  implements EntryAttributes
{
  declare id: string;
  declare user_id: string;
  declare encrypted_title?: Buffer | null;
  declare encrypted_content: Buffer;
  declare encrypted_metadata?: Buffer | null;
  declare encrypted_entry_key: Buffer;
  declare entry_date: Date;
  declare is_favorite: boolean;
  declare version: number;
  declare created_at?: Date;
  declare updated_at?: Date;
}

Entry.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    encrypted_title: {
      type: DataTypes.BLOB("long"),
      allowNull: true
    },
    encrypted_content: {
      type: DataTypes.BLOB("long"),
      allowNull: false
    },
    encrypted_metadata: {
      type: DataTypes.BLOB("long"),
      allowNull: true
    },
    encrypted_entry_key: {
      type: DataTypes.BLOB("long"),
      allowNull: false
    },
    entry_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    is_favorite: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    tableName: "entries",
    timestamps: false
  }
);
