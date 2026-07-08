import crypto from "crypto";

/**
 * Cifrado simétrico server-side (AES-256-GCM) para secretos de terceros
 * (ej. Access Token de MercadoPago del estudio). La clave vive en env `MP_ENC_KEY`
 * (32 bytes base64), NUNCA en la base ni en el cliente. Se guarda solo el ciphertext.
 * Formato: `iv.tag.data` (todo base64).
 */
function key(): Buffer {
  const raw = process.env.MP_ENC_KEY;
  if (!raw) throw new Error("MP_ENC_KEY no configurada");
  const b = Buffer.from(raw, "base64");
  if (b.length !== 32) throw new Error("MP_ENC_KEY debe ser 32 bytes en base64");
  return b;
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decryptSecret(payload: string): string {
  const [ivB, tagB, encB] = payload.split(".");
  if (!ivB || !tagB || !encB) throw new Error("secreto con formato inválido");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encB, "base64")), decipher.final()]).toString("utf8");
}
