import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createUserKeyBundle,
  decryptEntryPayload,
  decryptPrivateKey,
  decryptWithEntryKey,
  encryptEntryPayload,
  encryptPrivateKeyWithPassword,
  encryptWithEntryKey,
  generateEntryKey,
  unwrapEntryKey,
  wrapEntryKey
} from "./crypto";

if (!globalThis.crypto) {
  (globalThis as unknown as { crypto: Crypto }).crypto = webcrypto as Crypto;
}

describe("crypto module", () => {
  it("encrypts and decrypts entry payloads", async () => {
    const bundle = await createUserKeyBundle("correct horse battery staple");
    const privateKey = await decryptPrivateKey(
      bundle.encryptedPrivateKey,
      "correct horse battery staple"
    );
    const payload = await encryptEntryPayload("hello diary", bundle.publicKey);
    const plaintext = await decryptEntryPayload(payload, privateKey);
    expect(plaintext).toBe("hello diary");
  });

  it("re-encrypts the private key with a new password", async () => {
    const bundle = await createUserKeyBundle("old password");
    const privateKey = await decryptPrivateKey(bundle.encryptedPrivateKey, "old password");
    const rotated = await encryptPrivateKeyWithPassword(privateKey, "new password");
    const decrypted = await decryptPrivateKey(rotated, "new password");
    expect(decrypted.kty).toBe(privateKey.kty);
    expect(decrypted.d).toBe(privateKey.d);
  });

  it("wraps and unwraps entry keys", async () => {
    const bundle = await createUserKeyBundle("wrap test");
    const privateKey = await decryptPrivateKey(bundle.encryptedPrivateKey, "wrap test");
    const entryKey = await generateEntryKey();
    const wrapped = await wrapEntryKey(bundle.publicKey, entryKey);
    const unwrapped = await unwrapEntryKey(wrapped, privateKey);

    const payload = await encryptWithEntryKey(
      new TextEncoder().encode("secret"),
      entryKey
    );
    const decrypted = await decryptWithEntryKey(payload, unwrapped);
    expect(new TextDecoder().decode(decrypted)).toBe("secret");
  });
});
