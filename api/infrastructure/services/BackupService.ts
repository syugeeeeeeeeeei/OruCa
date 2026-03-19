import { BACKUP_DIR, DB_CONFIG } from "@src/config";
import { createReadStream, createWriteStream } from "fs";
import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";

export type BackupItem = {
	name: string;
	sizeBytes: number;
	updatedAt: string;
};

export type RestoreResult = {
	restoredBackup: string;
	preRestoreBackup: string;
};

export class BackupService {
	private readonly backupDir: string;
	private isRestoreRunning = false;

	constructor(backupDir = BACKUP_DIR) {
		this.backupDir = backupDir;
	}

	private nowStamp(): string {
		const d = new Date();
		const yyyy = d.getFullYear();
		const mm = `${d.getMonth() + 1}`.padStart(2, "0");
		const dd = `${d.getDate()}`.padStart(2, "0");
		const hh = `${d.getHours()}`.padStart(2, "0");
		const mi = `${d.getMinutes()}`.padStart(2, "0");
		const ss = `${d.getSeconds()}`.padStart(2, "0");
		return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
	}

	private getMysqlArgs(): string[] {
		return [
			"-h",
			DB_CONFIG.host,
			"-u",
			DB_CONFIG.user,
			`-p${DB_CONFIG.password}`,
			DB_CONFIG.database,
		];
	}

	private async ensureBackupDir(): Promise<void> {
		await fs.mkdir(this.backupDir, { recursive: true });
	}

	private async runDump(outputPath: string): Promise<void> {
		await this.ensureBackupDir();
		const dumpArgs = ["--no-tablespaces", ...this.getMysqlArgs()];

		await new Promise<void>((resolve, reject) => {
			const dumpProc = spawn("mysqldump", dumpArgs, {
				stdio: ["ignore", "pipe", "pipe"],
			});
			const output = createWriteStream(outputPath, { encoding: "utf-8" });
			let stderr = "";

			if (!dumpProc.stdout || !dumpProc.stderr) {
				reject(new Error("mysqldump process stream の初期化に失敗しました。"));
				return;
			}

			dumpProc.stdout.pipe(output);
			dumpProc.stderr.on("data", (chunk: Buffer | string) => {
				stderr += chunk.toString();
			});

			output.on("error", (error) => {
				dumpProc.kill();
				reject(error);
			});

			dumpProc.on("error", (error) => {
				reject(error);
			});

			dumpProc.on("close", (code) => {
				if (code === 0) {
					resolve();
					return;
				}
				reject(new Error(stderr || `mysqldump failed with code ${code}`));
			});
		});
	}

	private async runRestore(inputPath: string): Promise<void> {
		await new Promise<void>((resolve, reject) => {
			const restoreProc = spawn("mysql", this.getMysqlArgs(), {
				stdio: ["pipe", "ignore", "pipe"],
			});

			const input = createReadStream(inputPath, { encoding: "utf-8" });
			let stderr = "";

			if (!restoreProc.stdin || !restoreProc.stderr) {
				reject(new Error("mysql restore process stream の初期化に失敗しました。"));
				return;
			}

			input.pipe(restoreProc.stdin);

			restoreProc.stderr.on("data", (chunk: Buffer | string) => {
				stderr += chunk.toString();
			});

			input.on("error", (error) => {
				restoreProc.kill();
				reject(error);
			});

			restoreProc.on("error", (error) => {
				reject(error);
			});

			restoreProc.on("close", (code) => {
				if (code === 0) {
					resolve();
					return;
				}
				reject(new Error(stderr || `mysql restore failed with code ${code}`));
			});
		});
	}

	public async createBackup(prefix = "backup"): Promise<BackupItem> {
		const fileName = `${prefix}-${this.nowStamp()}.sql`;
		const backupPath = path.join(this.backupDir, fileName);
		await this.runDump(backupPath);
		const stat = await fs.stat(backupPath);

		return {
			name: fileName,
			sizeBytes: stat.size,
			updatedAt: stat.mtime.toISOString(),
		};
	}

	public async listBackups(): Promise<BackupItem[]> {
		await this.ensureBackupDir();
		const entries = await fs.readdir(this.backupDir, { withFileTypes: true });
		const sqlFiles = entries
			.filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
			.map((entry) => entry.name);

		const backups: BackupItem[] = [];
		for (const fileName of sqlFiles) {
			const backupPath = path.join(this.backupDir, fileName);
			const stat = await fs.stat(backupPath);
			backups.push({
				name: fileName,
				sizeBytes: stat.size,
				updatedAt: stat.mtime.toISOString(),
			});
		}

		return backups.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	}

	public async restoreBackup(backupName: string): Promise<RestoreResult> {
		if (this.isRestoreRunning) {
			throw new Error("リストア処理が進行中です。完了後に再実行してください。");
		}

		this.isRestoreRunning = true;
		try {
			const sanitizedName = path.basename(backupName);
			if (sanitizedName !== backupName || !sanitizedName.endsWith(".sql")) {
				throw new Error("不正なバックアップファイル名です。");
			}

			const targetPath = path.join(this.backupDir, sanitizedName);
			await fs.access(targetPath);

			const preRestore = await this.createBackup("pre-restore");
			await this.runRestore(targetPath);

			return {
				restoredBackup: sanitizedName,
				preRestoreBackup: preRestore.name,
			};
		} finally {
			this.isRestoreRunning = false;
		}
	}
}
