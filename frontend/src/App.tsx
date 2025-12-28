
import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { marked } from "marked";
import { defaultMarkdownSerializer } from "prosemirror-markdown";
import imageCompression from "browser-image-compression";
import { io } from "socket.io-client";
import "./App.css";
import {
  createUserKeyBundle,
  decryptPrivateKey,
  decryptWithEntryKey,
  encryptWithEntryKey,
  generateEntryKey,
  runCryptoBenchmark,
  unwrapEntryKey,
  wrapEntryKey,
  type EncryptedPayload
} from "./crypto";
import { decodeBase64, encodeBase64, textDecoder, textEncoder } from "./crypto";

type User = {
  id: string;
  username: string;
  email?: string | null;
  is_admin: boolean;
  is_approved: boolean;
  public_key: string;
  encrypted_private_key: string;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
};

type EntryRecord = {
  id: string;
  encryptedTitle: string | null;
  encryptedContent: string;
  encryptedMetadata: string | null;
  encryptedEntryKey: string;
  entryDate: string;
  isFavorite: boolean;
  version: number;
  createdAt?: string;
  updatedAt?: string;
};

type EntryMetadata = {
  tags: string[];
  mood?: string;
  weather?: string;
  location?: string;
};

type EntryView = {
  id: string;
  title: string;
  content: string;
  tags: string;
  mood: string;
  weather: string;
  location: string;
  entryDate: Date;
  isFavorite: boolean;
  version: number;
  createdAt?: string;
  updatedAt?: string;
  encryptedEntryKey: string;
};

type DraftState = {
  id?: string;
  title: string;
  content: string;
  tags: string;
  mood: string;
  weather: string;
  location: string;
  entryDate: Date;
  isFavorite: boolean;
};

type AdminUser = {
  id: string;
  username: string;
  email?: string | null;
  is_admin: boolean;
  is_approved: boolean;
  storage_quota: number;
  storage_used: number;
  created_at?: string;
  last_login?: string | null;
};

type StoredDraft = {
  id: string;
  encryptedTitle?: string | null;
  encryptedContent: string;
  encryptedMetadata?: string | null;
  encryptedEntryKey: string;
  entryDate: string;
  isFavorite: boolean;
  updatedAt: string;
};

type AttachmentRecord = {
  id: string;
  encryptedFilename: string | null;
  encryptedFileKey: string | null;
  mimeType?: string | null;
  fileSize: number;
  hasThumbnail: boolean;
  uploadedAt?: string;
};

type AttachmentView = {
  id: string;
  name: string;
  mimeType?: string | null;
  fileSize: number;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
  encryptedFileKey: string;
};

type FiltersState = {
  query: string;
  from?: Date;
  to?: Date;
};

type ViewMode = "overview" | "list" | "calendar" | "media" | "map";

type MediaFilter = "all" | "image" | "video" | "audio" | "pdf";

const UI = {
  appName: "\u65e5\u8bb0\u672c",
  year: "\u5e74",
  overview: "\u6982\u89c8",
  list: "\u5217\u8868",
  calendar: "\u65e5\u5386",
  media: "\u5a92\u4f53",
  map: "\u5730\u56fe",
  loginTitle: "\u4e3a\u6bcf\u4e00\u5929\u7559\u4e0b\u5b89\u9759\u7684\u8bb0\u5f55",
  loginSubtitle: "\u4e3a\u5bb6\u4eba\u6253\u9020\u79c1\u5bc6\u4e14\u7aef\u5230\u7aef\u52a0\u5bc6\u7684\u65e5\u8bb0\u672c\u3002",
  login: "\u767b\u5f55",
  register: "\u6ce8\u518c",
  username: "\u7528\u6237\u540d",
  password: "\u5bc6\u7801",
  email: "\u90ae\u7bb1",
  createAccount: "\u521b\u5efa\u8d26\u6237",
  generatingKeys: "\u6b63\u5728\u751f\u6210\u5bc6\u94a5...",
  unlockTitle: "\u89e3\u9501\u65e5\u8bb0\u672c",
  unlockHint: "\u5bc6\u94a5\u6c38\u4e0d\u79bb\u5f00\u6b64\u8bbe\u5907\u3002",
  unlockPassword: "\u89e3\u9501\u5bc6\u7801",
  unlock: "\u89e3\u9501",
  unlocking: "\u6b63\u5728\u89e3\u9501...",
  unlockFailed: "\u89e3\u9501\u5931\u8d25",
  hintKeys:
    "\u5bc6\u94a5\u4ec5\u5728\u6b64\u8bbe\u5907\u751f\u6210\u3002\u9057\u5fd8\u5bc6\u7801\u5c06\u65e0\u6cd5\u6062\u590d\u6570\u636e\u3002",
  description: "\u63cf\u8ff0",
  descriptionHint: "\u6dfb\u52a0\u63cf\u8ff0\uff0c\u8bb0\u5f55\u8fd9\u4e00\u5e74\u7684\u5fc3\u8def\u4e0e\u56de\u5fc6\u3002",
  stats: "\u7edf\u8ba1",
  statDays: "\u6301\u7eed\u5929\u6570",
  statEntries: "\u6761\u76ee",
  statMedia: "\u5a92\u4f53",
  statFavorites: "\u6536\u85cf",
  searchPlaceholder: "\u641c\u7d22\u6807\u9898\u6216\u5185\u5bb9...",
  selectedDate: "\u5df2\u9009",
  clear: "\u6e05\u9664",
  noEntries: "\u6682\u65e0\u5185\u5bb9\u3002",
  noFiltered: "\u6ca1\u6709\u7b26\u5408\u7b5b\u9009\u6761\u4ef6\u7684\u5185\u5bb9\u3002",
  untitled: "\u672a\u547d\u540d",
  noContent: "(\u6682\u65e0\u5185\u5bb9)",
  mediaEmpty: "\u5a92\u4f53\u65f6\u95f4\u8868\u4f1a\u5728\u8fd9\u91cc\u663e\u793a\u3002",
  mediaNoMatch: "\u8be5\u7b5b\u9009\u6761\u4ef6\u4e0b\u6682\u65e0\u5a92\u4f53\u3002",
  open: "\u6253\u5f00",
  remove: "\u5220\u9664",
  mapSoon: "\u5730\u56fe\u89c6\u56fe\u5373\u5c06\u4e0a\u7ebf\u3002",
  editorClose: "\u5173\u95ed",
  editorDone: "\u5b8c\u6210",
  saving: "\u4fdd\u5b58\u4e2d",
  tags: "\u6807\u7b7e",
  location: "\u4f4d\u7f6e",
  attachments: "\u9644\u4ef6",
  addImages: "\u6dfb\u52a0\u56fe\u7247",
  uploading: "\u4e0a\u4f20\u4e2d...",
  saveFirst: "\u4fdd\u5b58\u6761\u76ee\u540e\u5373\u53ef\u4e0a\u4f20\u9644\u4ef6\u3002",
  noAttachments: "\u6682\u65e0\u9644\u4ef6\u3002",
  menuUserInfo: "\u7528\u6237\u4fe1\u606f",
  menuAdmin: "\u7528\u6237\u7ba1\u7406",
  menuLogout: "\u9000\u51fa\u767b\u5f55",
  close: "\u5173\u95ed",
  menuUsername: "\u7528\u6237\u540d",
  menuRole: "\u89d2\u8272",
  menuStatus: "\u72b6\u6001",
  roleAdmin: "\u7ba1\u7406\u5458",
  roleUser: "\u7528\u6237",
  statusApproved: "\u5df2\u6279\u51c6",
  statusPending: "\u5f85\u6279\u51c6",
  refreshUsers: "\u5237\u65b0\u7528\u6237",
  approve: "\u6279\u51c6",
  quota: "\u914d\u989d(GB)",
  savedSynced: "\u5df2\u4fdd\u5b58\u5e76\u540c\u6b65",
  loginFailed: "\u767b\u5f55\u5931\u8d25",
  registerFailed: "\u6ce8\u518c\u5931\u8d25",
  accountCreatedApproval:
    "\u8d26\u6237\u5df2\u521b\u5efa\uff0c\u9700\u7ba1\u7406\u5458\u6279\u51c6\u540e\u624d\u80fd\u767b\u5f55\u3002",
  accountCreated: "\u8d26\u6237\u5df2\u521b\u5efa\uff0c\u8bf7\u767b\u5f55\u3002",
  passwordUpdated: "\u5bc6\u7801\u5df2\u66f4\u65b0\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55\u3002",
  entryDeleted: "\u5df2\u5220\u9664",
  passwordConfirm: "\u786e\u8ba4\u5bc6\u7801",
  registering: "\u6b63\u5728\u6ce8\u518c...",
  refresh: "\u5237\u65b0\u4f1a\u8bdd",
  logout: "\u9000\u51fa",
  entryDate: "\u65e5\u671f",
  mediaAll: "\u5168\u90e8",
  mediaImage: "\u7167\u7247",
  mediaVideo: "\u89c6\u9891",
  mediaAudio: "\u97f3\u9891",
  mediaPdf: "PDF",
  currentPassword: "\u5f53\u524d\u5bc6\u7801",
  newPassword: "\u65b0\u5bc6\u7801",
  updatePassword: "\u66f4\u65b0\u5bc6\u7801",
  cryptoBenchmark: "\u5bc6\u7801\u5b66\u6027\u80fd\u6d4b\u8bd5",
  benchmarkSmall: "\u5c0f\u6587\u672c",
  benchmarkLarge: "\u5927\u6587\u672c",
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const STORAGE_KEY = "diary_auth";
const DRAFT_DB = "diary_drafts";
const DRAFT_STORE = "drafts";

const readStoredAuth = (): AuthState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { accessToken: null, refreshToken: null, user: null };
    const parsed = JSON.parse(raw) as AuthState;
    return {
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null,
      user: parsed.user ?? null
    };
  } catch {
    return { accessToken: null, refreshToken: null, user: null };
  }
};

const persistAuth = (next: AuthState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
};

const clearAuth = () => {
  localStorage.removeItem(STORAGE_KEY);
};

const serializePayload = (payload: EncryptedPayload) =>
  encodeBase64(textEncoder.encode(JSON.stringify(payload)));

const parsePayload = (value: string) =>
  JSON.parse(textDecoder.decode(decodeBase64(value))) as EncryptedPayload;

const toLocalInputValue = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join("-") +
    "T" +
    [pad(date.getHours()), pad(date.getMinutes())].join(":")
  );
};

const parseLocalDate = (value: string) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const toDateInputValue = (date?: Date) => {
  if (!date) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-");
};

const deriveTitle = (markdown: string) => {
  const line = markdown
    .split("\n")
    .map((item) => item.trim())
    .find((item) => item.length > 0);
  if (!line) return "";
  return line.replace(/^#+\s*/, "").slice(0, 80).trim();
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const highlightText = (value: string, query: string) => {
  if (!query.trim()) return escapeHtml(value);
  const escaped = escapeHtml(value);
  const pattern = new RegExp(
    `(${query.replace(/[-/\\^$*+?.()|[\\]{}]/g, "\\$&")})`,
    "gi"
  );
  return escaped.replace(pattern, "<mark>$1</mark>");
};

const formatSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

const openDraftDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DRAFT_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DRAFT_STORE)) {
        db.createObjectStore(DRAFT_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const saveDraft = async (draft: StoredDraft) => {
  const db = await openDraftDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DRAFT_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(DRAFT_STORE).put(draft);
  });
};

const loadDraft = async (id: string) => {
  const db = await openDraftDb();
  return new Promise<StoredDraft | null>((resolve, reject) => {
    const tx = db.transaction(DRAFT_STORE, "readonly");
    const request = tx.objectStore(DRAFT_STORE).get(id);
    request.onsuccess = () => resolve((request.result as StoredDraft) ?? null);
    request.onerror = () => reject(request.error);
  });
};

const removeDraft = async (id: string) => {
  const db = await openDraftDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DRAFT_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(DRAFT_STORE).delete(id);
  });
};

const getMonthDays = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const days: Date[] = [];
  for (let i = 1; i <= end.getDate(); i += 1) {
    days.push(new Date(date.getFullYear(), date.getMonth(), i));
  }
  return { start, days };
};
export default function App() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTransient, setStatusTransient] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthState>(() => readStoredAuth());
  const [registering, setRegistering] = useState(false);
  const [privateKey, setPrivateKey] = useState<JsonWebKey | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [entries, setEntries] = useState<EntryView[]>([]);
  const [draft, setDraft] = useState<DraftState>(() => ({
    title: "",
    content: "# ",
    tags: "",
    mood: "",
    weather: "",
    location: "",
    entryDate: new Date(),
    isFavorite: false
  }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [benchmark, setBenchmark] = useState<{ smallMs: number; largeMs: number } | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [attachments, setAttachments] = useState<AttachmentView[]>([]);
  const [uploading, setUploading] = useState(false);
  const [filters, setFilters] = useState<FiltersState>({
    query: "",
    from: undefined,
    to: undefined
  });
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [showUserInfo, setShowUserInfo] = useState(true);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const autosaveTimer = useRef<number | null>(null);
  const statusTimer = useRef<number | null>(null);
  const lastSyncedContent = useRef<string | null>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: marked.parse(draft.content || ""),
    onUpdate: ({ editor }) => {
      const markdown = defaultMarkdownSerializer.serialize(editor.state.doc);
      const nextTitle = deriveTitle(markdown);
      lastSyncedContent.current = markdown;
      setDraft((prev) => ({ ...prev, content: markdown, title: nextTitle }));
    }
  });

  const isAuthed = Boolean(auth.accessToken && auth.user);
  const isUnlocked = Boolean(privateKey);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json"
    }),
    []
  );

  const updateAuth = (next: AuthState) => {
    setAuth(next);
    persistAuth(next);
  };

  const refreshTokens = async (refreshToken: string) => {
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers,
      body: JSON.stringify({ refreshToken })
    });

    if (!response.ok) {
      throw new Error("refresh_failed");
    }

    return (await response.json()) as {
      accessToken: string;
      refreshToken: string;
    };
  };

  const fetchMe = async (accessToken: string) => {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      headers: {
        ...headers,
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error("unauthorized");
    }

    const payload = (await response.json()) as { user: User };
    return payload.user;
  };

  const apiFetch = async (path: string, init?: RequestInit, retry = true) => {
    if (!auth.accessToken) {
      throw new Error("missing_token");
    }

    const isFormData = init?.body instanceof FormData;
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(isFormData ? {} : headers),
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${auth.accessToken}`
      }
    });

    if (response.status !== 401 || !auth.refreshToken || !retry) {
      return response;
    }

    const refreshed = await refreshTokens(auth.refreshToken);
    const user = await fetchMe(refreshed.accessToken);
    updateAuth({
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      user
    });

    return apiFetch(path, init, false);
  };

  const hydrateSession = async () => {
    setLoading(true);
    setError(null);
    setStatus(null);

    const stored = readStoredAuth();
    if (!stored.accessToken || !stored.refreshToken) {
      setLoading(false);
      updateAuth({ accessToken: null, refreshToken: null, user: null });
      return;
    }

    try {
      const user = await fetchMe(stored.accessToken);
      updateAuth({ ...stored, user });
    } catch {
      try {
        const refreshed = await refreshTokens(stored.refreshToken);
        const user = await fetchMe(refreshed.accessToken);
        updateAuth({
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          user
        });
      } catch {
        clearAuth();
        updateAuth({ accessToken: null, refreshToken: null, user: null });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    hydrateSession();
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStatus(null);

    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers,
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "login_failed");
      }

      const payload = (await response.json()) as {
        accessToken: string;
        refreshToken: string;
        user: User;
      };

      updateAuth({
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        user: payload.user
      });

      if (password.length) {
        await unlockWithPassword(password, payload.user);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : UI.loginFailed;
      setError(message);
    }
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setRegistering(true);

    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");
    const email = String(form.get("email") ?? "");

    try {
      const { publicKey, encryptedPrivateKey } = await createUserKeyBundle(password);
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          username,
          password,
          email: email.length ? email : undefined,
          publicKey,
          encryptedPrivateKey
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "register_failed");
      }

      const payload = (await response.json()) as {
        user: User;
        approvalRequired: boolean;
      };

      setMode("login");
      if (payload.approvalRequired) {
        setStatus(UI.accountCreatedApproval);
      } else {
        setStatus(UI.accountCreated);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : UI.registerFailed;
      setError(message);
    } finally {
      setRegistering(false);
    }
  };
  const handleLogout = async () => {
    setError(null);
    setStatus(null);

    if (auth.refreshToken) {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        headers,
        body: JSON.stringify({ refreshToken: auth.refreshToken })
      });
    }

    clearAuth();
    updateAuth({ accessToken: null, refreshToken: null, user: null });
    setPrivateKey(null);
    setEntries([]);
    setSelectedId(null);
    setAttachments([]);
  };


  const unlockWithPassword = async (password: string, user?: User | null) => {
    const target = user ?? auth.user;
    if (!target) return;
    setUnlocking(true);
    setError(null);
    setStatus(null);
    try {
      const key = await decryptPrivateKey(target.encrypted_private_key, password);
      setPrivateKey(key);
      setStatus("Vault unlocked on this device.");
    } catch {
      setError("Unable to unlock with that password.");
      setPrivateKey(null);
    } finally {
      setUnlocking(false);
    }
  };

  const mapMetadataToDraft = (metadata?: EntryMetadata | null) => ({
    tags: metadata?.tags?.join(", ") ?? "",
    mood: metadata?.mood ?? "",
    weather: metadata?.weather ?? "",
    location: metadata?.location ?? ""
  });

  const decryptEntryRecord = async (record: EntryRecord, key: JsonWebKey) => {
    const entryKey = await unwrapEntryKey(record.encryptedEntryKey, key);
    const contentPayload = parsePayload(record.encryptedContent);
    const contentBytes = await decryptWithEntryKey(contentPayload, entryKey);
    const content = textDecoder.decode(contentBytes);

    let title = "";
    if (record.encryptedTitle) {
      const titlePayload = parsePayload(record.encryptedTitle);
      const titleBytes = await decryptWithEntryKey(titlePayload, entryKey);
      title = textDecoder.decode(titleBytes);
    }

    let metadata: EntryMetadata | null = null;
    if (record.encryptedMetadata) {
      const metaPayload = parsePayload(record.encryptedMetadata);
      const metaBytes = await decryptWithEntryKey(metaPayload, entryKey);
      metadata = JSON.parse(textDecoder.decode(metaBytes)) as EntryMetadata;
    }

    const draftMeta = mapMetadataToDraft(metadata);

    return {
      id: record.id,
      title,
      content,
      tags: draftMeta.tags,
      mood: draftMeta.mood,
      weather: draftMeta.weather,
      location: draftMeta.location,
      entryDate: new Date(record.entryDate),
      isFavorite: record.isFavorite,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      encryptedEntryKey: record.encryptedEntryKey
    } as EntryView;
  };

  const encryptDraftPayload = async (next: DraftState, publicKey: string) => {
    const entryKey = await generateEntryKey();
    const encryptedEntryKey = await wrapEntryKey(publicKey, entryKey);
    const encryptedContent = await encryptWithEntryKey(
      textEncoder.encode(next.content),
      entryKey
    );
    const encryptedTitle = next.title
      ? await encryptWithEntryKey(textEncoder.encode(next.title), entryKey)
      : null;

    const metadata: EntryMetadata = {
      tags: next.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      mood: next.mood || undefined,
      weather: next.weather || undefined,
      location: next.location || undefined
    };

    const hasMetadata =
      metadata.tags.length || metadata.mood || metadata.weather || metadata.location;
    const encryptedMetadata = hasMetadata
      ? await encryptWithEntryKey(
          textEncoder.encode(JSON.stringify(metadata)),
          entryKey
        )
      : null;

    return {
      encryptedEntryKey,
      encryptedContent: serializePayload(encryptedContent),
      encryptedTitle: encryptedTitle ? serializePayload(encryptedTitle) : null,
      encryptedMetadata: encryptedMetadata ? serializePayload(encryptedMetadata) : null
    };
  };

  const decryptAttachmentMeta = async (record: AttachmentRecord, key: JsonWebKey) => {
    if (!record.encryptedFilename || !record.encryptedFileKey) {
      return {
        id: record.id,
        name: "",
        mimeType: record.mimeType ?? undefined,
        fileSize: record.fileSize,
        encryptedFileKey: ""
      } as AttachmentView;
    }

    const fileKey = await unwrapEntryKey(record.encryptedFileKey, key);
    const filenamePayload = parsePayload(record.encryptedFilename);
    const filenameBytes = await decryptWithEntryKey(filenamePayload, fileKey);
    const filename = textDecoder.decode(filenameBytes);

    return {
      id: record.id,
      name: filename,
      mimeType: record.mimeType ?? undefined,
      fileSize: record.fileSize,
      encryptedFileKey: record.encryptedFileKey
    } as AttachmentView;
  };

  const encryptAttachmentPayload = async (file: File, filename: string, publicKey: string) => {
    const fileKey = await generateEntryKey();
    const encryptedFileKey = await wrapEntryKey(publicKey, fileKey);
    const encryptedFilename = await encryptWithEntryKey(textEncoder.encode(filename), fileKey);
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const encryptedFile = await encryptWithEntryKey(fileBytes, fileKey);
    return {
      encryptedFileKey,
      encryptedFilename,
      encryptedFile
    };
  };
  const loadAttachments = async (entryId: string, key: JsonWebKey) => {
    try {
      const response = await apiFetch(
        `/api/attachments?entryId=${encodeURIComponent(entryId)}`
      );
      if (!response.ok) {
        throw new Error("Failed to load attachments");
      }
      const payload = (await response.json()) as { attachments: AttachmentRecord[] };
      const items = await Promise.all(
        payload.attachments.map((attachment) => decryptAttachmentMeta(attachment, key))
      );
      setAttachments(items.map((item) => ({ ...item })));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load attachments";
      setError(message);
    }
  };

  const handleAttachmentUpload = async (files: FileList | File[] | null) => {
    if (!files || !auth.user || !selectedId) return;
    setError(null);
    setStatus(null);
    setUploading(true);

    try {
      const fileList = Array.from(files);
      if (attachments.length + fileList.length > 10) {
        throw new Error("Attachment limit is 10 per entry.");
      }
      const tasks = fileList.slice(0, 10);
      for (const file of tasks) {
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`File ${file.name} exceeds 10MB.`);
        }
        const compressed = await imageCompression(file, {
          maxSizeMB: 2,
          maxWidthOrHeight: 2048,
          useWebWorker: true
        });
        const thumb = await imageCompression(file, {
          maxSizeMB: 0.3,
          maxWidthOrHeight: 400,
          useWebWorker: true
        });

        const encrypted = await encryptAttachmentPayload(
          compressed,
          file.name,
          auth.user.public_key
        );
        const encryptedThumb = await encryptAttachmentPayload(
          thumb,
          `${file.name}-thumb`,
          auth.user.public_key
        );

        const form = new FormData();
        form.append("entryId", selectedId);
        form.append("encryptedFileKey", encrypted.encryptedFileKey);
        form.append("encryptedFilename", serializePayload(encrypted.encryptedFilename));
        form.append("file", new Blob([serializePayload(encrypted.encryptedFile)]));
        form.append("mimeType", file.type);
        form.append("fileSize", String(file.size));
        form.append(
          "thumbnail",
          new Blob([serializePayload(encryptedThumb.encryptedFile)])
        );

        const response = await apiFetch("/api/attachments", {
          method: "POST",
          body: form
        });
        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? "Upload failed");
        }
      }

      if (privateKey) {
        await loadAttachments(selectedId, privateKey);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const handleAttachmentOpen = async (attachment: AttachmentView) => {
    if (!privateKey) return;
    try {
      const response = await apiFetch(`/api/attachments/${attachment.id}/file`);
      if (!response.ok) {
        throw new Error("Download failed");
      }
      const payloadText = await response.text();
      const fileKey = await unwrapEntryKey(attachment.encryptedFileKey, privateKey);
      const filePayload = parsePayload(payloadText);
      const fileBytes = await decryptWithEntryKey(filePayload, fileKey);
      const fileBuffer = Uint8Array.from(fileBytes).buffer;
      const blob = new Blob([fileBuffer], {
        type: attachment.mimeType ?? "application/octet-stream"
      });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Download failed";
      setError(message);
    }
  };

  const handleAttachmentDelete = async (id: string) => {
    if (!confirm("Delete this attachment?")) return;
    setError(null);
    try {
      const response = await apiFetch(`/api/attachments/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Delete failed");
      }
      setAttachments((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      setError(message);
    }
  };

  const loadEntries = async (key: JsonWebKey) => {
    setError(null);
    try {
      const response = await apiFetch("/api/entries");
      if (!response.ok) {
        throw new Error("Failed to load entries");
      }
      const payload = (await response.json()) as { entries: EntryRecord[] };
      const decrypted = await Promise.all(
        payload.entries.map((entry) => decryptEntryRecord(entry, key))
      );
      decrypted.sort((a, b) => b.entryDate.getTime() - a.entryDate.getTime());
      setEntries(decrypted);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load entries";
      setError(message);
    }
  };

  const draftKey = (entryId?: string | null) => {
    if (!auth.user) return "draft-unknown";
    return `draft-${auth.user.id}-${entryId ?? "new"}`;
  };

  const restoreDraft = async (entryId?: string | null) => {
    if (!auth.user || !privateKey) return;
    try {
      const stored = await loadDraft(draftKey(entryId));
      if (!stored) return;

      const entryKey = await unwrapEntryKey(stored.encryptedEntryKey, privateKey);
      const contentPayload = parsePayload(stored.encryptedContent);
      const contentBytes = await decryptWithEntryKey(contentPayload, entryKey);
      const content = textDecoder.decode(contentBytes);

      let title = "";
      if (stored.encryptedTitle) {
        const titlePayload = parsePayload(stored.encryptedTitle);
        const titleBytes = await decryptWithEntryKey(titlePayload, entryKey);
        title = textDecoder.decode(titleBytes);
      }

      let metadata: EntryMetadata | null = null;
      if (stored.encryptedMetadata) {
        const metaPayload = parsePayload(stored.encryptedMetadata);
        const metaBytes = await decryptWithEntryKey(metaPayload, entryKey);
        metadata = JSON.parse(textDecoder.decode(metaBytes)) as EntryMetadata;
      }

      const draftMeta = mapMetadataToDraft(metadata);
      setDraft({
        title,
        content,
        tags: draftMeta.tags,
        mood: draftMeta.mood,
        weather: draftMeta.weather,
        location: draftMeta.location,
        entryDate: new Date(stored.entryDate),
        isFavorite: stored.isFavorite
      });
      setSelectedId(entryId ?? null);
    } catch {
      setError("Failed to restore draft.");
    }
  };

  useEffect(() => {
    if (!editor) return;
    if (draft.content === lastSyncedContent.current) return;
    editor.commands.setContent(marked.parse(draft.content || ""), false);
  }, [draft.content, editor]);

  useEffect(() => {
    if (!auth.user || !privateKey) return;
    loadEntries(privateKey);
  }, [auth.user?.id, privateKey]);

  useEffect(() => {
    const publicKey = auth.user?.public_key;
    if (!publicKey || !privateKey) return;
    if (autosaveTimer.current) {
      window.clearTimeout(autosaveTimer.current);
    }
    autosaveTimer.current = window.setTimeout(async () => {
      try {
        const payload = await encryptDraftPayload(draft, publicKey);
        await saveDraft({
          id: draftKey(selectedId),
          encryptedTitle: payload.encryptedTitle,
          encryptedContent: payload.encryptedContent,
          encryptedMetadata: payload.encryptedMetadata,
          encryptedEntryKey: payload.encryptedEntryKey,
          entryDate: draft.entryDate.toISOString(),
          isFavorite: draft.isFavorite,
          updatedAt: new Date().toISOString()
        });
      } catch {
        setError("Failed to save draft locally.");
      }
    }, 3000);

    return () => {
      if (autosaveTimer.current) {
        window.clearTimeout(autosaveTimer.current);
      }
    };
  }, [draft, auth.user?.public_key, privateKey, selectedId]);

  useEffect(() => {
    if (!privateKey || !selectedId) return;
    loadAttachments(selectedId, privateKey);
  }, [selectedId, privateKey]);

  useEffect(() => {
    if (!auth.accessToken || !auth.user || !privateKey) return;

    const socket = io(API_BASE || window.location.origin, {
      auth: { token: auth.accessToken }
    });
    socketRef.current = socket;

    const refresh = () => {
      loadEntries(privateKey);
      if (selectedId) {
        loadAttachments(selectedId, privateKey);
      }
    };

    socket.on("entry:created", refresh);
    socket.on("entry:updated", refresh);
    socket.on("entry:deleted", refresh);

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [auth.accessToken, auth.user, privateKey, selectedId]);

  useEffect(() => {
    if (!auth.user?.is_admin) return;
    if (auth.user?.is_admin && privateKey) {
      loadAdminUsers();
    }
  }, [auth.user?.is_admin, privateKey]);

  const resetDraft = () => {
    const next = {
      title: "",
      content: "# ",
      tags: "",
      mood: "",
      weather: "",
      location: "",
      entryDate: new Date(),
      isFavorite: false
    };
    lastSyncedContent.current = next.content;
    setDraft(next);
    setSelectedId(null);
    setAttachments([]);
  };

  const handleSelectEntry = async (entry: EntryView) => {
    setError(null);
    setStatus(null);
    setSelectedId(entry.id);
    setDraft({
      title: entry.title,
      content: entry.content || "# ",
      tags: entry.tags ?? "",
      mood: entry.mood ?? "",
      weather: entry.weather ?? "",
      location: entry.location ?? "",
      entryDate: entry.entryDate,
      isFavorite: entry.isFavorite
    });
    setIsEditing(true);
    setShowSidePanel(false);
    try {
      await restoreDraft(entry.id);
    } catch {
      return;
    }
  };

  const handleCreateNew = async () => {
    resetDraft();
    setIsEditing(true);
    setShowSidePanel(false);
    await restoreDraft(null);
  };

  const handleCloseEditor = () => {
    setIsEditing(false);
    setStatus(null);
    setError(null);
  };

  const showTransientStatus = (message: string) => {
    setStatus(message);
    setStatusTransient(true);
    if (statusTimer.current) {
      window.clearTimeout(statusTimer.current);
    }
    statusTimer.current = window.setTimeout(() => {
      setStatus(null);
      setStatusTransient(false);
    }, 2000);
  };

  const handleSaveEntry = async () => {
    if (!auth.user || !privateKey) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const payload = await encryptDraftPayload(draft, auth.user.public_key);
      const entryDate = draft.entryDate.toISOString();
      const isFavorite = draft.isFavorite;

      let response: Response;
      if (selectedId) {
        const current = entries.find((entry) => entry.id === selectedId);
        response = await apiFetch(`/api/entries/${selectedId}`, {
          method: "PATCH",
          body: JSON.stringify({
            ...payload,
            entryDate,
            isFavorite,
            version: current?.version ?? 1
          })
        });
      } else {
        response = await apiFetch("/api/entries", {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            entryDate,
            isFavorite
          })
        });
      }

      if (!response.ok) {
        const data = (await response.json()) as { error?: string; currentVersion?: number };
        if (response.status === 409 && data.currentVersion) {
          setError(`Version conflict. Latest version is ${data.currentVersion}.`);
        } else {
          setError(data.error ?? "Failed to save entry");
        }
        return;
      }

      const data = (await response.json()) as { entry: EntryRecord };
      const decrypted = await decryptEntryRecord(data.entry, privateKey);
      setEntries((prev) => {
        const exists = prev.find((item) => item.id === decrypted.id);
        if (exists) {
          return prev.map((item) => (item.id === decrypted.id ? decrypted : item));
        }
        return [decrypted, ...prev].sort(
          (a, b) => b.entryDate.getTime() - a.entryDate.getTime()
        );
      });
      setSelectedId(decrypted.id);
      setDraft({
        title: decrypted.title,
        content: decrypted.content || "# ",
        tags: decrypted.tags ?? "",
        mood: decrypted.mood ?? "",
        weather: decrypted.weather ?? "",
        location: decrypted.location ?? "",
        entryDate: decrypted.entryDate,
        isFavorite: decrypted.isFavorite
      });
      await removeDraft(draftKey(null));
      await removeDraft(draftKey(decrypted.id));
      showTransientStatus(UI.savedSynced);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save entry";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!selectedId) return;
    if (!confirm("Delete this entry?")) return;
    setError(null);
    try {
      const response = await apiFetch(`/api/entries/${selectedId}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        throw new Error("Failed to delete entry");
      }
      setEntries((prev) => prev.filter((entry) => entry.id !== selectedId));
      setSelectedId(null);
      setIsEditing(false);
      resetDraft();
      showTransientStatus(UI.entryDeleted);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete entry";
      setError(message);
    }
  };

  const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const currentPassword = new FormData(form).get("currentPassword")?.toString() ?? "";
    const newPassword = new FormData(form).get("newPassword")?.toString() ?? "";
    setError(null);
    setStatus(null);

    try {
      const response = await apiFetch("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword })
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to update password");
      }
      clearAuth();
      setAuth({ accessToken: null, refreshToken: null, user: null });
      setPrivateKey(null);
      setStatus(UI.passwordUpdated);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update password";
      setError(message);
    }
  };

  const handleBenchmark = async () => {
    setBenchmark(null);
    try {
      const result = await runCryptoBenchmark();
      setBenchmark(result);
    } catch {
      setError("Benchmark failed");
    }
  };

  const handleUnlockSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!auth.user) return;
    const form = event.currentTarget;
    const password = new FormData(form).get("password")?.toString() ?? "";
    setError(null);
    setUnlocking(true);

    try {
      const decryptedKey = await decryptPrivateKey(
        auth.user.encrypted_private_key,
        password
      );
      setPrivateKey(decryptedKey);
      setStatus(null);
    } catch {
      setError(UI.unlockFailed);
    } finally {
      setUnlocking(false);
    }
  };

  const handleSelectCalendarDay = (day: Date) => {
    const iso = day.toISOString().slice(0, 10);
    setSelectedDate(iso);
    setFilters((prev) => ({
      ...prev,
      from: day,
      to: day
    }));
    setViewMode("list");
  };

  const handleClearDateFilter = () => {
    setSelectedDate(null);
    setFilters((prev) => ({ ...prev, from: undefined, to: undefined }));
  };

  const handlePasteImage = async (event: ClipboardEvent<HTMLDivElement>) => {
    if (!auth.user || !selectedId) return;
    const items = Array.from(event.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;

    event.preventDefault();
    await handleAttachmentUpload([file]);
  };

  const handleToggleSidePanel = () => {
    setShowSidePanel((prev) => !prev);
  };

  const handleCloseSidePanel = () => {
    setShowSidePanel(false);
  };

  const loadAdminUsers = async () => {
    if (!auth.user?.is_admin) return;
    setError(null);
    try {
      const response = await apiFetch("/api/admin/users");
      if (!response.ok) {
        throw new Error("Failed to load users");
      }
      const payload = (await response.json()) as { users: AdminUser[] };
      setAdminUsers(payload.users);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load users";
      setError(message);
    }
  };

  const handleApproveUser = async (id: string) => {
    setError(null);
    try {
      const response = await apiFetch(`/api/admin/users/${id}/approve`, {
        method: "PATCH",
        body: JSON.stringify({ approved: true })
      });
      if (!response.ok) {
        throw new Error("Failed to approve user");
      }
      const payload = (await response.json()) as { user: { id: string; is_approved: boolean } };
      setAdminUsers((prev) =>
        prev.map((user) =>
          user.id === payload.user.id
            ? { ...user, is_approved: payload.user.is_approved }
            : user
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to approve user";
      setError(message);
    }
  };

  const handleQuotaUpdate = async (id: string, quota: number) => {
    setError(null);
    try {
      const response = await apiFetch(`/api/admin/users/${id}/quota`, {
        method: "PATCH",
        body: JSON.stringify({ storageQuota: quota })
      });
      if (!response.ok) {
        throw new Error("Failed to update quota");
      }
      const payload = (await response.json()) as { user: { id: string; storage_quota: number } };
      setAdminUsers((prev) =>
        prev.map((user) =>
          user.id === payload.user.id
            ? { ...user, storage_quota: payload.user.storage_quota }
            : user
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update quota";
      setError(message);
    }
  };

  const stats = useMemo(() => {
    const total = entries.length;
    const mediaCount = attachments.length;
    const favoriteCount = entries.filter((entry) => entry.isFavorite).length;
    let dayCount = 0;
    if (total > 0) {
      const newest = entries[0].entryDate.getTime();
      const oldest = entries[entries.length - 1].entryDate.getTime();
      dayCount = Math.max(1, Math.ceil((newest - oldest) / 86400000) + 1);
    }
    return {
      total,
      mediaCount,
      favoriteCount,
      dayCount
    };
  }, [entries, attachments]);

  const filteredEntries = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    const from = filters.from ?? null;
    const to = filters.to ?? null;
    return entries.filter((entry) => {
      if (from && entry.entryDate < from) return false;
      if (to && entry.entryDate > new Date(to.getTime() + 86400000 - 1)) return false;
      if (!query) return true;
      const haystack = `${entry.title} ${entry.content}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [entries, filters]);

  const filteredAttachments = useMemo(() => {
    if (mediaFilter === "all") return attachments;
    return attachments.filter((attachment) => {
      const type = attachment.mimeType ?? "";
      if (mediaFilter === "image") return type.startsWith("image/");
      if (mediaFilter === "video") return type.startsWith("video/");
      if (mediaFilter === "audio") return type.startsWith("audio/");
      if (mediaFilter === "pdf") return type === "application/pdf";
      return true;
    });
  }, [attachments, mediaFilter]);

  const { start: calendarStart, days: calendarDays } = getMonthDays(calendarMonth);
  const calendarCells: (Date | null)[] = [];
  for (let i = 0; i < calendarStart.getDay(); i += 1) {
    calendarCells.push(null);
  }
  calendarDays.forEach((day) => calendarCells.push(day));
  while (calendarCells.length % 7 !== 0) {
    calendarCells.push(null);
  }

  const entryDates = useMemo(() => {
    return new Set(entries.map((entry) => entry.entryDate.toISOString().slice(0, 10)));
  }, [entries]);

  if (loading) {
    return (
      <div className="app-shell">
        <div className="loader" />
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-header">
            <p className="eyebrow">DIARY</p>
            <h1>{UI.loginTitle}</h1>
            <p className="subtitle">{UI.loginSubtitle}</p>
          </div>
          <div className="tabs">
            <button
              type="button"
              className={`tab ${mode === "login" ? "active" : ""}`}
              onClick={() => setMode("login")}
            >
              {UI.login}
            </button>
            <button
              type="button"
              className={`tab ${mode === "register" ? "active" : ""}`}
              onClick={() => setMode("register")}
            >
              {UI.register}
            </button>
          </div>
          <form className="form" onSubmit={mode === "login" ? handleLogin : handleRegister}>
            <label>
              {UI.username}
              <input name="username" required />
            </label>
            {mode === "register" ? (
              <label>
                {UI.email}
                <input name="email" type="email" />
              </label>
            ) : null}
            <label>
              {UI.password}
              <input name="password" type="password" required minLength={8} />
            </label>
            {mode === "register" ? (
              <label>
                {UI.passwordConfirm}
                <input name="passwordConfirm" type="password" required minLength={8} />
              </label>
            ) : null}
            <button className="primary" disabled={registering}>
              {mode === "login" ? UI.login : registering ? UI.registering : UI.register}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => hydrateSession()}
            >
              {UI.refresh}
            </button>
          </form>
          {status ? <p className="hint">{status}</p> : null}
          {error ? <p className="hint">{error}</p> : null}
        </div>
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-header">
            <p className="eyebrow">DIARY</p>
            <h1>{UI.unlockTitle}</h1>
            <p className="subtitle">{UI.unlockHint}</p>
            <p className="hint">{UI.hintKeys}</p>
          </div>
          <form className="form" onSubmit={handleUnlockSubmit}>
            <label>
              {UI.password}
              <input name="password" type="password" required minLength={8} />
            </label>
            <button className="primary" disabled={unlocking}>
              {unlocking ? UI.unlocking : UI.unlock}
            </button>
            <button type="button" className="ghost" onClick={handleLogout}>
              {UI.logout}
            </button>
          </form>
          {error ? <p className="hint">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <main className="main">
        <header className="topbar">
          <div className="top-left">
            <button type="button" className="icon-btn" onClick={handleToggleSidePanel}>
              {"\u2261"}
            </button>
            <div>
              <h1>{UI.appName}</h1>
              <span>{new Date().getFullYear()} {UI.year}</span>
            </div>
          </div>
        </header>
        <section className="panel">
          <div className="tabs tabs--main">
            <button
              type="button"
              className={`tab ${viewMode === "overview" ? "active" : ""}`}
              onClick={() => setViewMode("overview")}
            >
              {UI.overview}
            </button>
            <button
              type="button"
              className={`tab ${viewMode === "list" ? "active" : ""}`}
              onClick={() => setViewMode("list")}
            >
              {UI.list}
            </button>
            <button
              type="button"
              className={`tab ${viewMode === "calendar" ? "active" : ""}`}
              onClick={() => setViewMode("calendar")}
            >
              {UI.calendar}
            </button>
            <button
              type="button"
              className={`tab ${viewMode === "media" ? "active" : ""}`}
              onClick={() => setViewMode("media")}
            >
              {UI.media}
            </button>
            <button
              type="button"
              className={`tab ${viewMode === "map" ? "active" : ""}`}
              onClick={() => setViewMode("map")}
            >
              {UI.map}
            </button>
          </div>

          {viewMode === "overview" ? (
            <div>
              <div className="section">
                <h3>{UI.description}</h3>
                <p className="muted">{UI.descriptionHint}</p>
              </div>
              <div className="section">
                <h3>{UI.stats}</h3>
                <div className="stats-grid">
                  <div className="stat-card">
                    <span>{UI.statDays}</span>
                    <strong>{stats.dayCount}</strong>
                  </div>
                  <div className="stat-card">
                    <span>{UI.statEntries}</span>
                    <strong>{stats.total}</strong>
                  </div>
                  <div className="stat-card">
                    <span>{UI.statMedia}</span>
                    <strong>{stats.mediaCount}</strong>
                  </div>
                  <div className="stat-card">
                    <span>{UI.statFavorites}</span>
                    <strong>{stats.favoriteCount}</strong>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {viewMode === "list" ? (
            <div>
              <div className="filters">
                <input
                  placeholder={UI.searchPlaceholder}
                  value={filters.query}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, query: event.target.value }))
                  }
                />
                <input
                  type="date"
                  value={toDateInputValue(filters.from)}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      from: parseLocalDate(event.target.value)
                    }))
                  }
                />
                <input
                  type="date"
                  value={toDateInputValue(filters.to)}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      to: parseLocalDate(event.target.value)
                    }))
                  }
                />
                {selectedDate ? (
                  <div className="date-chip">
                    <span>{UI.selectedDate}: {selectedDate}</span>
                    <button type="button" onClick={handleClearDateFilter}>
                      {UI.clear}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="entry-list">
                {filteredEntries.length === 0 ? (
                  <p className="muted">
                    {filters.query || filters.from || filters.to ? UI.noFiltered : UI.noEntries}
                  </p>
                ) : (
                  filteredEntries.map((entry) => {
                    const preview = entry.content
                      .replace(/^#\s+.*\n/, "")
                      .replace(/\n+/g, " ")
                      .trim();
                    return (
                      <div key={entry.id} className="entry-row">
                        <button type="button" onClick={() => handleSelectEntry(entry)}>
                          <div
                            className="entry-title"
                            dangerouslySetInnerHTML={{
                              __html: highlightText(entry.title || UI.untitled, filters.query)
                            }}
                          />
                          <div
                            className="entry-preview"
                            dangerouslySetInnerHTML={{
                              __html: highlightText(preview || UI.noContent, filters.query)
                            }}
                          />
                          <div className="entry-meta">
                            <span>{entry.entryDate.toLocaleDateString()}</span>
                            <span>{entry.isFavorite ? "\u2605" : ""}</span>
                          </div>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}

          {viewMode === "calendar" ? (
            <div className="calendar-view">
              <div className="calendar-header">
                <button
                  type="button"
                  onClick={() =>
                    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                  }
                >
                  {"\u2039"}
                </button>
                <strong>
                  {calendarMonth.getFullYear()} {calendarMonth.getMonth() + 1}
                </strong>
                <button
                  type="button"
                  onClick={() =>
                    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                  }
                >
                  {"\u203a"}
                </button>
              </div>
              <div className="calendar-weekdays">
                {["S", "M", "T", "W", "T", "F", "S"].map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <div className="calendar-grid">
                {calendarCells.map((day, index) => {
                  if (!day) {
                    return <div key={`empty-${index}`} className="calendar-cell empty" />;
                  }
                  const iso = day.toISOString().slice(0, 10);
                  const hasEntry = entryDates.has(iso);
                  const isSelected = selectedDate === iso;
                  return (
                    <button
                      type="button"
                      key={iso}
                      className={`calendar-cell${hasEntry ? " has-entry" : ""}${
                        isSelected ? " selected" : ""
                      }`}
                      onClick={() => handleSelectCalendarDay(day)}
                    >
                      <span>{day.getDate()}</span>
                      {hasEntry ? <span className="dot" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {viewMode === "media" ? (
            <div>
              <div className="segmented">
                {["all", "image", "video", "audio", "pdf"].map((segment) => (
                  <button
                    key={segment}
                    type="button"
                    className={`seg ${mediaFilter === segment ? "active" : ""}`}
                    onClick={() => setMediaFilter(segment as MediaFilter)}
                  >
                    {segment === "all"
                      ? UI.mediaAll
                      : segment === "image"
                        ? UI.mediaImage
                        : segment === "video"
                          ? UI.mediaVideo
                          : segment === "audio"
                            ? UI.mediaAudio
                            : UI.mediaPdf}
                  </button>
                ))}
              </div>
              <div className="attachment-list">
                {filteredAttachments.length === 0 ? (
                  <p className="muted">
                    {attachments.length === 0 ? UI.mediaEmpty : UI.mediaNoMatch}
                  </p>
                ) : (
                  filteredAttachments.map((attachment) => (
                    <div key={attachment.id} className="attachment-card">
                      {attachment.previewUrl ? (
                        <img src={attachment.previewUrl} alt="" className="attachment-thumb" />
                      ) : (
                        <div className="attachment-thumb placeholder">FILE</div>
                      )}
                      <div className="attachment-info">
                        <p>{attachment.name || UI.untitled}</p>
                        <span>{formatSize(attachment.fileSize)}</span>
                      </div>
                      <div className="attachment-actions">
                        <button
                          type="button"
                          className="pill ghost"
                          onClick={() => handleAttachmentOpen(attachment)}
                        >
                          {UI.open}
                        </button>
                        <button
                          type="button"
                          className="pill"
                          onClick={() => handleAttachmentDelete(attachment.id)}
                        >
                          {UI.remove}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {viewMode === "map" ? (
            <div className="map-view">
              <p className="muted">{UI.mapSoon}</p>
            </div>
          ) : null}
        </section>

        <button type="button" className="fab" onClick={handleCreateNew}>
          +
        </button>
      </main>

      {isEditing ? (
        <div className="editor-sheet">
          <div className="editor-header">
            <button type="button" className="pill ghost" onClick={handleCloseEditor}>
              {UI.editorClose}
            </button>
            <div>
              <button
                type="button"
                className="pill"
                onClick={handleSaveEntry}
                disabled={saving}
              >
                {saving ? UI.saving : UI.editorDone}
              </button>
            </div>
          </div>
          <div className="editor-body" onPaste={handlePasteImage}>
            <div className="editor-meta">
              <label>
                {UI.entryDate}
                <input
                  type="date"
                  value={toLocalInputValue(draft.entryDate)}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      entryDate: parseLocalDate(event.target.value) ?? new Date()
                    }))
                  }
                />
              </label>
              <label>
                {UI.location}
                <input
                  value={draft.location}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, location: event.target.value }))
                  }
                />
              </label>
            </div>
            <div className="editor-surface">
              <EditorContent editor={editor} />
            </div>
            <div className="section-header">
              <h4>{UI.attachments}</h4>
              <label className="upload">
                {uploading ? UI.uploading : UI.addImages}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={!selectedId || uploading}
                  onChange={(event) =>
                    handleAttachmentUpload(Array.from(event.target.files ?? []))
                  }
                />
              </label>
            </div>
            {!selectedId ? (
              <p className="muted">{UI.saveFirst}</p>
            ) : attachments.length === 0 ? (
              <p className="muted">{UI.noAttachments}</p>
            ) : (
              <div className="attachment-list">
                {attachments.map((attachment) => (
                  <div key={attachment.id} className="attachment-card">
                    {attachment.previewUrl ? (
                      <img src={attachment.previewUrl} alt="" className="attachment-thumb" />
                    ) : (
                      <div className="attachment-thumb placeholder">FILE</div>
                    )}
                    <div className="attachment-info">
                      <p>{attachment.name || UI.untitled}</p>
                      <span>{formatSize(attachment.fileSize)}</span>
                    </div>
                    <div className="attachment-actions">
                      <button
                        type="button"
                        className="pill ghost"
                        onClick={() => handleAttachmentOpen(attachment)}
                      >
                        {UI.open}
                      </button>
                      <button
                        type="button"
                        className="pill"
                        onClick={() => handleAttachmentDelete(attachment.id)}
                      >
                        {UI.remove}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectedId ? (
              <button type="button" className="pill" onClick={handleDeleteEntry}>
                {UI.remove}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={`side-panel ${showSidePanel ? "open" : ""}`}>
        <div className="menu-header">
          <div className="menu-avatar">
            {(auth.user?.username ?? "U").slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div>{auth.user?.username}</div>
            <div className="muted">{auth.user?.email ?? ""}</div>
          </div>
        </div>
        <div className="menu-list">
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              setShowUserInfo(true);
              setShowAdminPanel(false);
            }}
          >
            {UI.menuUserInfo}
          </button>
          {auth.user?.is_admin ? (
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setShowUserInfo(false);
                setShowAdminPanel(true);
                loadAdminUsers();
              }}
            >
              {UI.menuAdmin}
            </button>
          ) : null}
          <button type="button" className="menu-item danger" onClick={handleLogout}>
            {UI.menuLogout}
          </button>
          <button type="button" className="menu-item" onClick={handleCloseSidePanel}>
            {UI.close}
          </button>
        </div>

        {showUserInfo ? (
          <div className="menu-info">
            <div>
              <span>{UI.menuUsername}</span>
              <strong>{auth.user?.username}</strong>
            </div>
            <div>
              <span>{UI.menuRole}</span>
              <strong>{auth.user?.is_admin ? UI.roleAdmin : UI.roleUser}</strong>
            </div>
            <div>
              <span>{UI.menuStatus}</span>
              <strong>{auth.user?.is_approved ? UI.statusApproved : UI.statusPending}</strong>
            </div>
          </div>
        ) : null}

        {showAdminPanel ? (
          <div className="menu-info">
            <div className="section-header">
              <strong>{UI.menuAdmin}</strong>
              <button type="button" className="pill ghost" onClick={loadAdminUsers}>
                {UI.refreshUsers}
              </button>
            </div>
            <div className="attachment-list">
              {adminUsers.map((user) => (
                <div key={user.id} className="attachment-card">
                  <div className="attachment-thumb placeholder">
                    {user.username.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="attachment-info">
                    <p>{user.username}</p>
                    <span>{user.email ?? ""}</span>
                    <span>
                      {user.storage_used} / {user.storage_quota} MB
                    </span>
                  </div>
                  <div className="attachment-actions">
                    {!user.is_approved ? (
                      <button
                        type="button"
                        className="pill"
                        onClick={() => handleApproveUser(user.id)}
                      >
                        {UI.approve}
                      </button>
                    ) : null}
                    <label className="upload">
                      {UI.quota}
                      <input
                        type="number"
                        min={1}
                        defaultValue={Math.ceil(user.storage_quota / 1024)}
                        onBlur={(event) =>
                          handleQuotaUpdate(user.id, Number(event.target.value) * 1024)
                        }
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <form className="form" onSubmit={handlePasswordChange}>
          <label>
            {UI.currentPassword}
            <input name="currentPassword" type="password" required minLength={8} />
          </label>
          <label>
            {UI.newPassword}
            <input name="newPassword" type="password" required minLength={8} />
          </label>
          <button className="primary">{UI.updatePassword}</button>
        </form>

        <button type="button" className="ghost" onClick={handleBenchmark}>
          {UI.cryptoBenchmark}
        </button>
        {benchmark ? (
          <p className="hint">
            {UI.benchmarkSmall}: {benchmark.smallMs.toFixed(1)}ms, {UI.benchmarkLarge}: {benchmark.largeMs.toFixed(1)}ms
          </p>
        ) : null}
      </div>

      {showSidePanel ? <div className="side-panel-overlay" onClick={handleCloseSidePanel} /> : null}

      {status || error ? (
        <div
          className={`notice ${error ? "error" : ""} ${statusTransient ? "transient" : ""}`}
        >
          {error ?? status}
        </div>
      ) : null}
    </div>
  );
}
