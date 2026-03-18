// api/infrastructure/server/http/HttpHandler.ts
import { DatabaseHandler } from "@infra/database/DataBaseHandler"; // DatabaseHandler をインポート
import express from "express";

export class HttpHandler {
	private dbHandler: DatabaseHandler; // mysql.PoolConnection から DatabaseHandler に変更
	// private slackService: SlackService; // 削除
	private onDataUpdated: () => Promise<void>; // 変更: WebSocket 更新用のコールバックを保持

	constructor(
		app: express.Express,
		dbHandler: DatabaseHandler, // 引数を DatabaseHandler に変更
		onDataUpdated: () => Promise<void> // 💡 引数は残し、内部で使用する
	) {
		this.dbHandler = dbHandler; // DatabaseHandler を保持
		this.onDataUpdated = onDataUpdated; // 変更: コールバックを保持
		this.initializeHttpRoutes(app);
	}

	private initializeHttpRoutes(app: express.Express) {
		app.get("/health", (_req: express.Request, res: express.Response) => {
			res.status(200).json({ status: "ok" });
		});

		// 💡 削除: app.post("/log/write", ... ) { ... } ルートを完全に削除
		app.get("/echo", express.json(), async (req: express.Request, res: express.Response) => {
			res.status(200).json("http(api) is connected\n");
		});

		// 変更: ここから追加
		// テスト用: 全ユーザーを強制的に退室させるエンドポイント
		app.post("/admin/reset_all", async (req: express.Request, res: express.Response) => {
			console.log("Manual reset request received: setting all users to out of room...");
			try {
				// DataBaseHandler のメソッドを呼び出す
				const affectedRows = await this.dbHandler.setAllUsersOutOfRoom();

				if (affectedRows > 0) {
					// 1人以上が退室処理された場合のみブロードキャスト
					await this.onDataUpdated();
					console.log("Manual reset: Broadcasted updated data to all clients.");
				} else {
					console.log("Manual reset: No users were in room. No broadcast needed.");
				}

				res.status(200).json({ success: true, message: `Manual reset complete. ${affectedRows} users set to 'out of room'.` });

			} catch (err) {
				console.error("Failed to run manual reset:", err);
				// エラーログをより詳細に出力
				const errorMessage = err instanceof Error ? err.message : String(err);
				res.status(500).json({ success: false, message: "Failed to run manual reset.", error: errorMessage });
			}
		});
		// 変更: ここまで追加
	}
}
