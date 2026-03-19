import { DatabaseHandler } from "@infra/database/DataBaseHandler";
import { SlackService } from "@infra/integrations/SlackServive";
import {
	isDebugAdminEnabled,
	isDebugAdminLogin,
	verifyAdminLogin,
} from "@infra/security/AdminAuth";
import { CryptoService } from "@infra/security/CryptoService";
import { BackupService } from "@infra/services/BackupService";
import { TWsMessage, TWsProcessType } from "@src/config";
import { sendWsMessage } from "@src/utils";
import { WebSocket, WebSocketServer } from "ws";
import { z } from "zod";

const StudentIdPayload = z.object({
	content: z.array(
		z.object({
			student_ID: z.string().min(1),
		})
	),
});

const AuthPayload = z.object({
	content: z.array(
		z.object({
			student_ID: z.string().min(1),
			password: z.string(),
		})
	),
});

const UpdateNamePayload = z.object({
	content: z.array(
		z.object({
			student_ID: z.string().min(1),
			student_Name: z.string().min(1),
		})
	),
});

const LogWritePayload = z.object({
	content: z.object({
		student_ID: z.string().min(1),
	}),
});

const SlackUpdatePayload = z.object({
	content: z.array(
		z.object({
			channelId: z.string().trim(),
			botToken: z.string().optional(),
		})
	),
});

const BackupRestorePayload = z.object({
	content: z.array(
		z.object({
			backupName: z.string().min(1),
			confirmRestore: z.boolean(),
		})
	),
});

export class MessageHandler {
	private wss: WebSocketServer;
	private dbHandler: DatabaseHandler;
	private slackService: SlackService;
	private backupService: BackupService;
	private adminSessionMap: WeakMap<WebSocket, boolean>;
	public handlers: Record<string, (ws: WebSocket, data: TWsMessage) => Promise<void>>;

	constructor(wss: WebSocketServer, dbHandler: DatabaseHandler) {
		this.wss = wss;
		this.dbHandler = dbHandler;
		this.slackService = new SlackService();
		this.backupService = new BackupService();
		this.adminSessionMap = new WeakMap();
		this.handlers = this.initializeHandlers();

		if (isDebugAdminEnabled()) {
			console.warn("[DEBUG_ADMIN] デバッグ管理者ログインが有効です。本番では必ず無効化してください。");
		}
	}

	public onClientConnected(ws: WebSocket): void {
		this.adminSessionMap.set(ws, false);
	}

	public onClientDisconnected(ws: WebSocket): void {
		this.adminSessionMap.delete(ws);
	}

	private initializeHandlers(): Record<string, (ws: WebSocket, data: TWsMessage) => Promise<void>> {
		return {
			"log/fetch": this.handleFetchLogs.bind(this),
			"log/write": this.handleLogWrite.bind(this),
			"user/auth": this.handleUserAuth.bind(this),
			"user/update_name": this.handleUpdateName.bind(this),
			"user/fetchToken": this.handleFetchToken.bind(this),
			"user/delete": this.handleDeleteUser.bind(this),
			"admin/slack/get": this.handleGetSlackSettings.bind(this),
			"admin/slack/update": this.handleUpdateSlackSettings.bind(this),
			"admin/backup/create": this.handleCreateBackup.bind(this),
			"admin/backup/list": this.handleListBackups.bind(this),
			"admin/backup/restore": this.handleRestoreBackup.bind(this),
		};
	}

	private getWsAuthState(ws: WebSocket): boolean {
		if (!this.adminSessionMap.has(ws)) {
			this.adminSessionMap.set(ws, false);
		}
		return this.adminSessionMap.get(ws) === true;
	}

	private setWsAuthState(ws: WebSocket, isAuthorized: boolean): void {
		this.adminSessionMap.set(ws, isAuthorized);
	}

	private ensureAdminAuthorized(ws: WebSocket, requestedType: TWsProcessType): boolean {
		if (this.getWsAuthState(ws)) {
			return true;
		}

		sendWsMessage(ws, {
			type: "unauthorized",
			payload: {
				result: false,
				content: [{ requestedType }],
				message: "unauthorized",
			},
		});
		return false;
	}

	public async broadcastData(): Promise<void> {
		try {
			const logs = await this.fetchLogs();
			const message = JSON.stringify({
				type: "log/fetch",
				payload: { result: true, content: logs, message: "ブロードキャストデータ" },
			});
			this.wss.clients.forEach((client) => {
				if (client.readyState === WebSocket.OPEN) {
					client.send(message);
				}
			});
		} catch (error) {
			console.error("ブロードキャストエラー:", error);
		}
	}

	public async fetchLogs(): Promise<any[]> {
		return this.dbHandler.fetchStudentLogs();
	}

	private async handleFetchLogs(ws: WebSocket, data: TWsMessage): Promise<void> {
		try {
			console.log(`[REQ] type: ${data.type}`);
			const logs = await this.fetchLogs();
			sendWsMessage(ws, {
				type: "log/fetch",
				payload: { result: true, content: logs, message: "ログ取得成功" },
			});
		} catch (error) {
			console.error("ログ取得エラー (handleFetchLogs):", error, JSON.stringify(data.payload));
			sendWsMessage(ws, {
				type: "log/fetch",
				payload: { result: false, content: [], message: "ログ取得失敗" },
			});
		}
	}

	private async handleLogWrite(ws: WebSocket, data: TWsMessage): Promise<void> {
		try {
			console.log(`[REQ] type: ${data.type}, payload: ${JSON.stringify(data.payload)}`);
			const payload = LogWritePayload.parse(data.payload);
			const studentID = payload.content.student_ID;

			await this.dbHandler.insertOrUpdateLog(studentID);

			const updatedLogs = await this.fetchLogs();
			const inRoomCount = await this.dbHandler.getInRoomCount();
			const user = updatedLogs.find((log) => log.student_ID === studentID);

			if (user) {
				const studentName = user.student_Name || "";
				const isInRoom = !!user.isInRoom;
				const action = isInRoom ? "来た" : "帰った";
				const name = studentName ? `(${studentName})` : "";
				const postMsg = `${studentID}${name}が${action}よ～ (今の人数：${inRoomCount}人)`;

				try {
					const slackSettings = await this.dbHandler.getSlackSettings();
					if (
						slackSettings.slack_channel_id &&
						slackSettings.slack_bot_token_encrypted &&
						slackSettings.slack_bot_token_iv &&
						slackSettings.slack_bot_token_auth_tag
					) {
						if (!CryptoService.isConfigured()) {
							console.warn("SLACK_TOKEN_ENC_KEY が未設定のため Slack 投稿をスキップしました。");
						} else {
							const cryptoService = CryptoService.fromEnv();
							const decryptedToken = cryptoService.decrypt({
								cipherText: slackSettings.slack_bot_token_encrypted,
								iv: slackSettings.slack_bot_token_iv,
								authTag: slackSettings.slack_bot_token_auth_tag,
							});

							await this.slackService.postMessage(
								postMsg,
								decryptedToken,
								slackSettings.slack_channel_id
							);
						}
					}
				} catch (slackError) {
					console.error("Slack へのメッセージ投稿に失敗しました:", slackError);
				}
			}

			await this.broadcastData();
		} catch (error) {
			console.error("ログ書き込みまたはブロードキャストエラー (handleLogWrite):", error, JSON.stringify(data.payload));
			sendWsMessage(ws, {
				type: "ack",
				payload: {
					result: false,
					content: [],
					message: `ログ書き込み失敗: ${error instanceof Error ? error.message : "不明なエラー"}`,
				},
			});
		}
	}

	private async handleUserAuth(ws: WebSocket, data: TWsMessage): Promise<void> {
		try {
			console.log(`[REQ] type: ${data.type}, payload: ${JSON.stringify(data.payload)}`);
			const payload = AuthPayload.parse(data.payload);
			const { student_ID, password } = payload.content[0];

			if (isDebugAdminLogin(student_ID, password)) {
				this.setWsAuthState(ws, true);
				sendWsMessage(ws, {
					type: "user/auth",
					payload: {
						result: true,
						content: [{ student_ID, token: "debug-session-token", debug: true }],
						message: "認証成功 (debug mode)",
					},
				});
				return;
			}

			const storedToken = await this.dbHandler.getStudentToken(student_ID);
			if (!storedToken) {
				this.setWsAuthState(ws, false);
				sendWsMessage(ws, {
					type: "user/auth",
					payload: {
						result: false,
						content: [],
						message: "学籍番号またはパスワードが異なります",
					},
				});
				return;
			}

			const verifyResult = verifyAdminLogin(student_ID, password, storedToken);
			if (!verifyResult.isValid) {
				this.setWsAuthState(ws, false);
				sendWsMessage(ws, {
					type: "user/auth",
					payload: {
						result: false,
						content: [],
						message: verifyResult.message ?? "学籍番号またはパスワードが異なります",
					},
				});
				return;
			}

			this.setWsAuthState(ws, true);
			sendWsMessage(ws, {
				type: "user/auth",
				payload: {
					result: true,
					content: [{ student_ID, token: storedToken }],
					message: "認証成功",
				},
			});
		} catch (error) {
			this.setWsAuthState(ws, false);
			console.error("認証エラー (handleUserAuth):", error, JSON.stringify(data.payload));
			sendWsMessage(ws, {
				type: "user/auth",
				payload: {
					result: false,
					content: [],
					message: `認証処理エラー: ${error instanceof Error ? error.message : "不明なエラー"}`,
				},
			});
		}
	}

	private async handleUpdateName(ws: WebSocket, data: TWsMessage): Promise<void> {
		if (!this.ensureAdminAuthorized(ws, "user/update_name")) {
			return;
		}

		try {
			console.log(`[REQ] type: ${data.type}, payload: ${JSON.stringify(data.payload)}`);
			const payload = UpdateNamePayload.parse(data.payload);
			await this.dbHandler.updateStudentName(payload.content[0].student_ID, payload.content[0].student_Name);

			sendWsMessage(ws, {
				type: "user/update_name",
				payload: { result: true, content: [], message: "氏名更新成功" },
			});
			await this.broadcastData();
		} catch (error) {
			console.error("氏名更新エラー (handleUpdateName):", error, JSON.stringify(data.payload));
			sendWsMessage(ws, {
				type: "user/update_name",
				payload: {
					result: false,
					content: [],
					message: `氏名更新失敗: ${error instanceof Error ? error.message : "不明なエラー"}`,
				},
			});
		}
	}

	private async handleFetchToken(ws: WebSocket, data: TWsMessage): Promise<void> {
		if (!this.ensureAdminAuthorized(ws, "user/fetchToken")) {
			return;
		}

		try {
			console.log(`[REQ] type: ${data.type}, payload: ${JSON.stringify(data.payload)}`);
			const payload = StudentIdPayload.parse(data.payload);
			const token = await this.dbHandler.getStudentToken(payload.content[0].student_ID);

			if (!token) {
				sendWsMessage(ws, {
					type: "user/fetchToken",
					payload: { result: false, content: [], message: "該当する学生が見つかりません" },
				});
				return;
			}

			sendWsMessage(ws, {
				type: "user/fetchToken",
				payload: {
					result: true,
					content: [{ student_ID: payload.content[0].student_ID, token }],
					message: "トークン取得成功",
				},
			});
		} catch (error) {
			console.error("トークン取得エラー (handleFetchToken):", error, JSON.stringify(data.payload));
			sendWsMessage(ws, {
				type: "user/fetchToken",
				payload: {
					result: false,
					content: [],
					message: `トークン取得失敗: ${error instanceof Error ? error.message : "不明なエラー"}`,
				},
			});
		}
	}

	private async handleDeleteUser(ws: WebSocket, data: TWsMessage): Promise<void> {
		if (!this.ensureAdminAuthorized(ws, "user/delete")) {
			return;
		}

		try {
			console.log(`[REQ] type: ${data.type}, payload: ${JSON.stringify(data.payload)}`);
			const payload = StudentIdPayload.parse(data.payload);
			await this.dbHandler.deleteStudent(payload.content[0].student_ID);

			sendWsMessage(ws, {
				type: "user/delete",
				payload: { result: true, content: [], message: "ユーザー削除成功" },
			});

			await this.broadcastData();
		} catch (error) {
			console.error("ユーザー削除エラー (handleDeleteUser):", error, JSON.stringify(data.payload));
			sendWsMessage(ws, {
				type: "user/delete",
				payload: {
					result: false,
					content: [],
					message: `ユーザー削除処理エラー: ${error instanceof Error ? error.message : "不明なエラー"}`,
				},
			});
		}
	}

	private async handleGetSlackSettings(ws: WebSocket): Promise<void> {
		if (!this.ensureAdminAuthorized(ws, "admin/slack/get")) {
			return;
		}

		try {
			const settings = await this.dbHandler.getSlackSettings();
			sendWsMessage(ws, {
				type: "admin/slack/get",
				payload: {
					result: true,
					content: [
						{
							channelId: settings.slack_channel_id ?? "",
							tokenConfigured: !!settings.slack_bot_token_encrypted,
							updatedAt: settings.updated_at,
						},
					],
					message: "Slack設定取得成功",
				},
			});
		} catch (error) {
			sendWsMessage(ws, {
				type: "admin/slack/get",
				payload: {
					result: false,
					content: [],
					message: `Slack設定取得失敗: ${error instanceof Error ? error.message : "不明なエラー"}`,
				},
			});
		}
	}

	private async handleUpdateSlackSettings(ws: WebSocket, data: TWsMessage): Promise<void> {
		if (!this.ensureAdminAuthorized(ws, "admin/slack/update")) {
			return;
		}

		try {
			const payload = SlackUpdatePayload.parse(data.payload);
			const { channelId, botToken } = payload.content[0];
			const trimmedChannel = channelId.trim();
			const trimmedBotToken = botToken?.trim();

			if (!trimmedChannel) {
				throw new Error("SlackチャンネルIDは必須です。");
			}

			if (trimmedBotToken) {
				if (!CryptoService.isConfigured()) {
					throw new Error("SLACK_TOKEN_ENC_KEY が未設定です。");
				}
				const cryptoService = CryptoService.fromEnv();
				const encrypted = cryptoService.encrypt(trimmedBotToken);
				await this.dbHandler.updateSlackSettings(trimmedChannel, encrypted);
			} else {
				await this.dbHandler.updateSlackSettings(trimmedChannel);
			}

			const settings = await this.dbHandler.getSlackSettings();
			sendWsMessage(ws, {
				type: "admin/slack/update",
				payload: {
					result: true,
					content: [
						{
							channelId: settings.slack_channel_id ?? "",
							tokenConfigured: !!settings.slack_bot_token_encrypted,
							updatedAt: settings.updated_at,
						},
					],
					message: "Slack設定保存成功",
				},
			});
		} catch (error) {
			sendWsMessage(ws, {
				type: "admin/slack/update",
				payload: {
					result: false,
					content: [],
					message: `Slack設定保存失敗: ${error instanceof Error ? error.message : "不明なエラー"}`,
				},
			});
		}
	}

	private async handleCreateBackup(ws: WebSocket): Promise<void> {
		if (!this.ensureAdminAuthorized(ws, "admin/backup/create")) {
			return;
		}

		try {
			const backup = await this.backupService.createBackup();
			sendWsMessage(ws, {
				type: "admin/backup/create",
				payload: {
					result: true,
					content: [backup],
					message: "バックアップ作成成功",
				},
			});
		} catch (error) {
			sendWsMessage(ws, {
				type: "admin/backup/create",
				payload: {
					result: false,
					content: [],
					message: `バックアップ作成失敗: ${error instanceof Error ? error.message : "不明なエラー"}`,
				},
			});
		}
	}

	private async handleListBackups(ws: WebSocket): Promise<void> {
		if (!this.ensureAdminAuthorized(ws, "admin/backup/list")) {
			return;
		}

		try {
			const backups = await this.backupService.listBackups();
			sendWsMessage(ws, {
				type: "admin/backup/list",
				payload: {
					result: true,
					content: backups,
					message: "バックアップ一覧取得成功",
				},
			});
		} catch (error) {
			sendWsMessage(ws, {
				type: "admin/backup/list",
				payload: {
					result: false,
					content: [],
					message: `バックアップ一覧取得失敗: ${error instanceof Error ? error.message : "不明なエラー"}`,
				},
			});
		}
	}

	private async handleRestoreBackup(ws: WebSocket, data: TWsMessage): Promise<void> {
		if (!this.ensureAdminAuthorized(ws, "admin/backup/restore")) {
			return;
		}

		try {
			const payload = BackupRestorePayload.parse(data.payload);
			const { backupName, confirmRestore } = payload.content[0];

			if (!confirmRestore) {
				throw new Error("リストア確認フラグが不足しています。");
			}

			const result = await this.backupService.restoreBackup(backupName);
			await this.broadcastData();
			sendWsMessage(ws, {
				type: "admin/backup/restore",
				payload: {
					result: true,
					content: [result],
					message: "バックアップリストア成功",
				},
			});
		} catch (error) {
			sendWsMessage(ws, {
				type: "admin/backup/restore",
				payload: {
					result: false,
					content: [],
					message: `バックアップリストア失敗: ${error instanceof Error ? error.message : "不明なエラー"}`,
				},
			});
		}
	}
}
