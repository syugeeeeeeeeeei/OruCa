import {
	ADMIN_FIXED_PASSWORD,
	DEBUG_ADMIN_ENABLED,
	DEBUG_ADMIN_PASSWORD,
	DEBUG_ADMIN_USER,
} from "@src/config";
import { createHash, timingSafeEqual } from "crypto";

function generateSHA256Hash(input: string): string {
	return createHash("sha256").update(input).digest("hex");
}

function normalizeFixedPassword(): string {
	return ADMIN_FIXED_PASSWORD.trim();
}

function normalizeDebugUser(): string {
	return DEBUG_ADMIN_USER.trim();
}

function normalizeDebugPassword(): string {
	return DEBUG_ADMIN_PASSWORD.trim();
}

export function isAdminPasswordConfigured(): boolean {
	return normalizeFixedPassword().length > 0;
}

export function isDebugAdminEnabled(): boolean {
	return DEBUG_ADMIN_ENABLED;
}

export function isDebugAdminLogin(studentID: string, passwordInput: string): boolean {
	if (!isDebugAdminEnabled()) {
		return false;
	}

	const debugUser = normalizeDebugUser();
	const debugPassword = normalizeDebugPassword();
	if (!debugUser || !debugPassword) {
		return false;
	}

	return studentID === debugUser && passwordInput === debugPassword;
}

function createSalt(studentID: string): string {
	return generateSHA256Hash(studentID);
}

function compareHash(storedToken: string, expectedToken: string): boolean {
	const stored = Buffer.from(storedToken, "utf-8");
	const expected = Buffer.from(expectedToken, "utf-8");
	if (stored.length !== expected.length) {
		return false;
	}
	return timingSafeEqual(stored, expected);
}

export function createStudentToken(studentID: string): string {
	const fixedPassword = normalizeFixedPassword();
	if (!fixedPassword) {
		throw new Error("ADMIN_FIXED_PASSWORD が未設定です。");
	}

	const salt = createSalt(studentID);
	const derivedPassword = `${fixedPassword}${studentID}`;
	return generateSHA256Hash(`${studentID}${derivedPassword}${salt}`);
}

export function verifyAdminLogin(
	studentID: string,
	passwordInput: string,
	storedToken: string
): { isValid: boolean; message?: string } {
	if (!isAdminPasswordConfigured()) {
		return {
			isValid: false,
			message: "サーバー設定エラー: 固定パスワードが未設定です。",
		};
	}

	const fixedPassword = normalizeFixedPassword();
	if (passwordInput !== fixedPassword) {
		return { isValid: false };
	}

	// 新方式: 固定パスワード + 学籍番号
	const expectedToken = createStudentToken(studentID);
	if (compareHash(storedToken, expectedToken)) {
		return { isValid: true };
	}

	// 旧方式との互換性 (移行期間用)
	const salt = createSalt(studentID);
	const legacyToken = generateSHA256Hash(`${studentID}${fixedPassword}${salt}`);
	return { isValid: compareHash(storedToken, legacyToken) };
}
