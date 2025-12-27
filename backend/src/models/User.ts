import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db";

export interface UserAttributes {
  id: string;
  username: string;
  password_hash: string;
  email?: string | null;
  public_key: string;
  encrypted_private_key: string;
  is_admin: boolean;
  is_approved: boolean;
  storage_quota: number;
  storage_used: number;
  refresh_token_hash?: string | null;
  created_at?: Date;
  last_login?: Date | null;
  settings?: Record<string, unknown> | null;
}

type UserCreationAttributes = Optional<
  UserAttributes,
  | "id"
  | "email"
  | "is_admin"
  | "is_approved"
  | "storage_quota"
  | "storage_used"
  | "refresh_token_hash"
  | "created_at"
  | "last_login"
  | "settings"
>;

export class User extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  declare id: string;
  declare username: string;
  declare password_hash: string;
  declare email?: string | null;
  declare public_key: string;
  declare encrypted_private_key: string;
  declare is_admin: boolean;
  declare is_approved: boolean;
  declare storage_quota: number;
  declare storage_used: number;
  declare refresh_token_hash?: string | null;
  declare created_at?: Date;
  declare last_login?: Date | null;
  declare settings?: Record<string, unknown> | null;
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    public_key: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    encrypted_private_key: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    is_admin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    is_approved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    storage_quota: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 5 * 1024 * 1024 * 1024
    },
    storage_used: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0
    },
    refresh_token_hash: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true
    },
    settings: {
      type: DataTypes.JSON,
      allowNull: true
    }
  },
  {
    sequelize,
    tableName: "users",
    timestamps: false
  }
);
