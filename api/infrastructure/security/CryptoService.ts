import { SLACK_TOKEN_ENC_KEY } from "@src/config";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

type EncryptedValue = {
	cipherText: string;
	iv: string;
	authTag: string;
};

function resolveKey(secret: string): Buffer {
	return createHash("sha256").update(secret, "utf-8").digest();
}

export class CryptoService {
	private readonly key: Buffer;

	constructor(secret: string) {
		if (!secret.trim()) {
			throw new Error("SLACK_TOKEN_ENC_KEY が未設定です。");
		}
		this.key = resolveKey(secret.trim());
	}

	public static fromEnv(): CryptoService {
		return new CryptoService(SLACK_TOKEN_ENC_KEY);
	}

	public static isConfigured(): boolean {
		return SLACK_TOKEN_ENC_KEY.trim().length > 0;
	}

	public encrypt(value: string): EncryptedValue {
		const iv = randomBytes(12);
		const cipher = createCipheriv(ALGORITHM, this.key, iv);
		const cipherText = Buffer.concat([cipher.update(value, "utf-8"), cipher.final()]);
		const authTag = cipher.getAuthTag();

		return {
			cipherText: cipherText.toString("base64"),
			iv: iv.toString("base64"),
			authTag: authTag.toString("base64"),
		};
	}

	public decrypt(data: EncryptedValue): string {
		const iv = Buffer.from(data.iv, "base64");
		const authTag = Buffer.from(data.authTag, "base64");
		const encrypted = Buffer.from(data.cipherText, "base64");

		const decipher = createDecipheriv(ALGORITHM, this.key, iv);
		decipher.setAuthTag(authTag);
		const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
		return plain.toString("utf-8");
	}
}

export type { EncryptedValue };
