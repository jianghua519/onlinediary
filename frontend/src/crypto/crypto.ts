import { decodeBase64, encodeBase64, textDecoder, textEncoder } from "./base64";

const PBKDF2_ITERATIONS = 100_000;
const AES_KEY_LENGTH = 256;
const RSA_MODULUS_LENGTH = 2048;

export type EncryptedPayload = {
  iv: string;
  cipher: string;
};

export type EncryptedPrivateKeyPayload = EncryptedPayload & {
  salt: string;
  iterations: number;
};

export type EntryEncryptionPayload = EncryptedPayload & {
  encryptedEntryKey: string;
};

export type GeneratedKeyBundle = {
  publicKey: string;
  encryptedPrivateKey: string;
};

export type EntryKeyBundle = {
  entryKey: CryptoKey;
  encryptedEntryKey: string;
};

const getRandomBytes = (length: number) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  Uint8Array.from(bytes).buffer;

export const generateEntryKey = async () =>
  crypto.subtle.generateKey(
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );

const deriveKeyMaterial = async (password: string, salt: Uint8Array) => {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256"
    },
    baseKey,
    {
      name: "AES-GCM",
      length: AES_KEY_LENGTH
    },
    false,
    ["encrypt", "decrypt"]
  );
};

const encryptWithAesGcm = async (plaintext: Uint8Array, key: CryptoKey) => {
  const iv = getRandomBytes(12);
  const cipher = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv
    },
    key,
    toArrayBuffer(plaintext)
  );

  return {
    iv: encodeBase64(iv),
    cipher: encodeBase64(cipher)
  };
};

export const encryptWithEntryKey = async (
  plaintext: Uint8Array,
  entryKey: CryptoKey
) => encryptWithAesGcm(plaintext, entryKey);

export const decryptWithEntryKey = async (
  payload: EncryptedPayload,
  entryKey: CryptoKey
): Promise<Uint8Array> => decryptWithAesGcm(payload, entryKey);

const decryptWithAesGcm = async (
  payload: EncryptedPayload,
  key: CryptoKey
): Promise<Uint8Array> => {
  const iv = decodeBase64(payload.iv);
  const cipherBytes = decodeBase64(payload.cipher);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv
    },
    key,
    toArrayBuffer(cipherBytes)
  );
  return new Uint8Array(plaintext);
};

export const wrapEntryKey = async (publicKeyJson: string, entryKey: CryptoKey) => {
  const rawEntryKey = await crypto.subtle.exportKey("raw", entryKey);
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    JSON.parse(publicKeyJson) as JsonWebKey,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );

  const wrappedKey = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    rawEntryKey
  );

  return encodeBase64(wrappedKey);
};

export const unwrapEntryKey = async (
  encryptedEntryKey: string,
  privateKeyJson: JsonWebKey
) => {
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateKeyJson,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"]
  );

  const wrappedKey = decodeBase64(encryptedEntryKey);
  const rawKey = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    wrappedKey
  );

  return crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
};

export const generateKeyPair = async () => {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: RSA_MODULUS_LENGTH,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256"
    },
    true,
    ["encrypt", "decrypt"]
  );

  const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

  return {
    publicKey,
    privateKey
  };
};

export const encryptPrivateKeyWithPassword = async (
  privateKeyJson: JsonWebKey,
  password: string
) => {
  const salt = getRandomBytes(16);
  const masterKey = await deriveKeyMaterial(password, salt);
  const privateKeyPayload = JSON.stringify(privateKeyJson);
  const encrypted = await encryptWithAesGcm(
    textEncoder.encode(privateKeyPayload),
    masterKey
  );

  const payload: EncryptedPrivateKeyPayload = {
    ...encrypted,
    salt: encodeBase64(salt),
    iterations: PBKDF2_ITERATIONS
  };

  return JSON.stringify(payload);
};

export const createUserKeyBundle = async (
  password: string
): Promise<GeneratedKeyBundle> => {
  const salt = getRandomBytes(16);
  const masterKey = await deriveKeyMaterial(password, salt);
  const { publicKey, privateKey } = await generateKeyPair();

  const privateKeyJson = JSON.stringify(privateKey);
  const encrypted = await encryptWithAesGcm(
    textEncoder.encode(privateKeyJson),
    masterKey
  );

  const payload: EncryptedPrivateKeyPayload = {
    ...encrypted,
    salt: encodeBase64(salt),
    iterations: PBKDF2_ITERATIONS
  };

  return {
    publicKey: JSON.stringify(publicKey),
    encryptedPrivateKey: JSON.stringify(payload)
  };
};

export const decryptPrivateKey = async (
  encrypted: string,
  password: string
) => {
  const payload = JSON.parse(encrypted) as EncryptedPrivateKeyPayload;
  const salt = decodeBase64(payload.salt);
  const masterKey = await deriveKeyMaterial(password, salt);
  const plaintext = await decryptWithAesGcm(payload, masterKey);
  return JSON.parse(textDecoder.decode(plaintext)) as JsonWebKey;
};

export const encryptEntryPayload = async (
  plaintext: string,
  publicKeyJson: string
): Promise<EntryEncryptionPayload> => {
  const entryKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );

  const encrypted = await encryptWithAesGcm(textEncoder.encode(plaintext), entryKey);
  const rawEntryKey = await crypto.subtle.exportKey("raw", entryKey);

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    JSON.parse(publicKeyJson) as JsonWebKey,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );

  const wrappedKey = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    rawEntryKey
  );

  return {
    ...encrypted,
    encryptedEntryKey: encodeBase64(wrappedKey)
  };
};

export const decryptEntryPayload = async (
  payload: EntryEncryptionPayload,
  privateKeyJson: JsonWebKey
) => {
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateKeyJson,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"]
  );

  const wrappedKey = decodeBase64(payload.encryptedEntryKey);
  const rawKey = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, wrappedKey);
  const entryKey = await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const plaintext = await decryptWithAesGcm(payload, entryKey);
  return textDecoder.decode(plaintext);
};

export const runCryptoBenchmark = async () => {
  const message = "x".repeat(100);
  const bigMessage = "x".repeat(1024 * 1024);
  const { publicKey, privateKey } = await generateKeyPair();
  const privateKeyJson = JSON.stringify(privateKey);
  const payload = await encryptEntryPayload(message, JSON.stringify(publicKey));
  await decryptEntryPayload(payload, JSON.parse(privateKeyJson));

  const startSmall = performance.now();
  await encryptEntryPayload(message, JSON.stringify(publicKey));
  const endSmall = performance.now();

  const startBig = performance.now();
  await encryptEntryPayload(bigMessage, JSON.stringify(publicKey));
  const endBig = performance.now();

  return {
    smallMs: endSmall - startSmall,
    largeMs: endBig - startBig
  };
};
