import { createStudentToken } from "@infra/security/AdminAuth";
import { EncryptedValue } from "@infra/security/CryptoService";
import { IDBConfig } from "@src/config";
import mysql from "mysql2/promise";

export type SlackSettingsRow = {
	slack_channel_id: string | null;
	slack_bot_token_encrypted: string | null;
	slack_bot_token_iv: string | null;
	slack_bot_token_auth_tag: string | null;
	updated_at: string;
};

export class DatabaseHandler {
	private pool: mysql.Pool;

	constructor(config: IDBConfig) {
		this.pool = mysql.createPool({
			connectionLimit: config.connectionLimit,
			host: config.host,
			user: config.user,
			password: config.password,
			database: config.database,
			waitForConnections: config.waitForConnections,
			queueLimit: config.queueLimit,
			connectTimeout: config.connectTimeout,
			timezone: "+09:00",
		});
	}

	public async connect(): Promise<void> {
		let connection: mysql.PoolConnection | null = null;
		try {
			connection = await this.pool.getConnection();
			console.log("MySQL データベースに接続しました。");
			await this.bootstrapSchema(connection);
		} catch (err) {
			console.error("MySQL データベース接続エラー:", err);
			throw err;
		} finally {
			connection?.release();
		}
	}

	private async bootstrapSchema(connection: mysql.PoolConnection): Promise<void> {
		await connection.query(`CREATE TABLE IF NOT EXISTS app_settings (
			id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
			slack_channel_id VARCHAR(64),
			slack_bot_token_encrypted TEXT,
			slack_bot_token_iv VARCHAR(64),
			slack_bot_token_auth_tag VARCHAR(64),
			updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		)`);

		await connection.query(
			"INSERT INTO app_settings (id) VALUES (1) ON DUPLICATE KEY UPDATE id = id"
		);
	}

	public async close(): Promise<void> {
		try {
			await this.pool.end();
			console.log("MySQL データベース接続が正常にクローズされました。");
		} catch (err) {
			console.error("MySQL 接続クローズエラー:", err);
			throw err;
		}
	}

	public async fetchStudentLogs(): Promise<any[]> {
		const sql = "SELECT * FROM student_log_view";
		try {
			const [rows] = await this.pool.query(sql);
			return rows as any[];
		} catch (err) {
			console.error("SQL実行エラー (fetchStudentLogs):", err);
			throw err;
		}
	}

	public async insertOrUpdateLog(studentID: string): Promise<void> {
		const connection = await this.pool.getConnection();
		try {
			await connection.beginTransaction();

			const token = createStudentToken(studentID);
			await connection.query(
				`INSERT INTO users (student_ID, student_Name, student_token)
				 VALUES (?, NULL, ?)
				 ON DUPLICATE KEY UPDATE student_token = VALUES(student_token)`,
				[studentID, token]
			);

			await connection.query(
				`INSERT INTO logs (student_ID, isInRoom)
				 VALUES (?, TRUE)
				 ON DUPLICATE KEY UPDATE
					isInRoom = NOT isInRoom,
					updated_at = CURRENT_TIMESTAMP`,
				[studentID]
			);

			await connection.commit();
		} catch (err) {
			await connection.rollback();
			console.error("SQL実行エラー (insertOrUpdateLog):", err);
			throw err;
		} finally {
			connection.release();
		}
	}

	public async updateStudentName(
		studentID: string,
		studentName: string
	): Promise<void> {
		const sql = "UPDATE users SET student_Name = ? WHERE student_ID = ?";
		try {
			await this.pool.query(sql, [studentName, studentID]);
		} catch (err) {
			console.error("SQL実行エラー (updateStudentName):", err);
			throw err;
		}
	}

	public async getStudentToken(studentID: string): Promise<string | null> {
		const sql = "SELECT student_token FROM student_token_view WHERE student_ID = ?";
		try {
			const [rows] = (await this.pool.query(sql, [studentID])) as any[];
			if (rows && rows.length > 0) {
				return rows[0].student_token;
			}
			return null;
		} catch (err) {
			console.error("SQL実行エラー (getStudentToken):", err);
			throw err;
		}
	}

	public async getInRoomCount(): Promise<number> {
		const sql = "SELECT COUNT(*) AS inRoomCount FROM logs WHERE isInRoom = TRUE";
		try {
			const [rows] = (await this.pool.query(sql)) as any[];
			if (rows && rows.length > 0) {
				return rows[0].inRoomCount;
			}
			return 0;
		} catch (err) {
			console.error("SQL実行エラー (getInRoomCount):", err);
			throw err;
		}
	}

	public async deleteStudent(studentID: string): Promise<void> {
		const sql = "DELETE FROM users WHERE student_ID = ?";
		try {
			await this.pool.query(sql, [studentID]);
		} catch (err) {
			console.error("SQL実行エラー (deleteStudent):", err);
			throw err;
		}
	}

	public async setAllUsersOutOfRoom(): Promise<number> {
		const sql = "UPDATE logs SET isInRoom = FALSE WHERE isInRoom = TRUE";
		try {
			const [results] = (await this.pool.query(sql)) as [
				mysql.ResultSetHeader,
				any,
			];
			console.log(
				`Daily reset: ${results.affectedRows} users set to 'out of room'.`
			);
			return results.affectedRows;
		} catch (err) {
			console.error("SQL実行エラー (setAllUsersOutOfRoom):", err);
			throw err;
		}
	}

	private async ensureAppSettingsRow(): Promise<void> {
		await this.pool.query(
			"INSERT INTO app_settings (id) VALUES (1) ON DUPLICATE KEY UPDATE id = id"
		);
	}

	public async getSlackSettings(): Promise<SlackSettingsRow> {
		await this.ensureAppSettingsRow();

		const sql = `SELECT
			slack_channel_id,
			slack_bot_token_encrypted,
			slack_bot_token_iv,
			slack_bot_token_auth_tag,
			updated_at
		FROM app_settings
		WHERE id = 1`;

		const [rows] = (await this.pool.query(sql)) as any[];
		if (!rows || rows.length === 0) {
			throw new Error("Slack設定の取得に失敗しました。");
		}
		return rows[0] as SlackSettingsRow;
	}

	public async updateSlackSettings(
		channelId: string,
		encryptedToken?: EncryptedValue
	): Promise<void> {
		await this.ensureAppSettingsRow();

		if (encryptedToken) {
			const sql = `UPDATE app_settings
			SET
				slack_channel_id = ?,
				slack_bot_token_encrypted = ?,
				slack_bot_token_iv = ?,
				slack_bot_token_auth_tag = ?,
				updated_at = CURRENT_TIMESTAMP
			WHERE id = 1`;

			await this.pool.query(sql, [
				channelId,
				encryptedToken.cipherText,
				encryptedToken.iv,
				encryptedToken.authTag,
			]);
			return;
		}

		const sql = `UPDATE app_settings
		SET
			slack_channel_id = ?,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = 1`;

		await this.pool.query(sql, [channelId]);
	}
}
