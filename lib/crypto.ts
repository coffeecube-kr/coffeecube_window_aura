import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
// GCM에서는 12바이트 IV 권장
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * 환경변수에서 암호화 키를 가져오고 32바이트로 조정
 */
function getEncryptionKey(): Buffer {
  const key = process.env.NEXT_PUBLIC_ENCRYPTED_KEY || "default-encryption-key";
  return crypto.scryptSync(key, "salt", KEY_LENGTH);
}

/**
 * 문자열을 AES-256-GCM으로 암호화
 * @param text 암호화할 텍스트
 * @returns base64로 인코딩된 암호화된 문자열
 */
export function encryptPassword(text: string): string {
  try {
    if (!text) {
      return "";
    }

    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    // 필요 시 AAD를 고정 문자열로 설정하려면 아래 주석 해제 후 복호화에서도 동일하게 설정
    // cipher.setAAD(Buffer.from("password"));

    const encryptedBuffer = Buffer.concat([
      cipher.update(text, "utf8"),
      cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    // IV + TAG + 암호문
    const combined = Buffer.concat([iv, tag, encryptedBuffer]);
    return combined.toString("base64");
  } catch {
    return "";
  }
}

/**
 * AES-256-GCM으로 암호화된 문자열을 복호화
 * @param encryptedText base64로 인코딩된 암호화된 문자열
 * @returns 복호화된 원본 텍스트
 */
export function decryptPassword(encryptedText: string): string {
  try {
    if (!encryptedText) {
      return "";
    }

    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedText, "base64");

    // IV, TAG, 암호문 분리
    const iv = combined.slice(0, IV_LENGTH);
    const tag = combined.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encryptedBuffer = combined.slice(IV_LENGTH + TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    // 암호화에서 AAD를 설정했다면 동일하게 설정 필요
    // decipher.setAAD(Buffer.from("password"));
    decipher.setAuthTag(tag);

    const decryptedBuffer = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final(),
    ]);

    return decryptedBuffer.toString("utf8");
  } catch {
    return "";
  }
}

/**
 * 비밀번호 검증을 위한 함수
 * @param plainPassword 평문 비밀번호
 * @param encryptedPassword 암호화된 비밀번호
 * @returns 일치 여부
 */
export function verifyPassword(
  plainPassword: string,
  encryptedPassword: string
): boolean {
  try {
    const decrypted = decryptPassword(encryptedPassword);
    return decrypted === plainPassword;
  } catch {
    return false;
  }
}
