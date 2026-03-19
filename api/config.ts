import dotenv from "dotenv";
import mysql from "mysql2";

const runtimeConfigDir = process.env.RUNTIME_CONFIG_DIR ?? "/app/runtime-config";
dotenv.config();
dotenv.config({ path: `${runtimeConfigDir}/api.env`, override: true });

// 型安全な取得関数
function getEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`環境変数 ${name} が設定されていません。`);
	}
	return value;
}

function getEnvOptional(name: string, fallback = ""): string {
	return process.env[name] ?? fallback;
}

interface IServerConfig{
	port :number;
	host :string;
}

export interface IDBConfig extends mysql.PoolOptions {
	host:string;
	user:string;
	password:string;
	database:string;
	waitForConnections: boolean;
	connectionLimit: number;
	queueLimit: number;
	connectTimeout: number;
}

export const SERVER_CONFIG:IServerConfig = {
	port:Number(getEnvOptional("PORT", "3000")),
	host:getEnvOptional("HOST", "0.0.0.0")
}

export const DB_CONFIG:IDBConfig = {
	host: getEnvOptional("DB_HOST", "mysql"),
	user: getEnv("MYSQL_USER"),
	password: getEnv("MYSQL_PASSWORD"),
	database: getEnv("MYSQL_DATABASE"),
	waitForConnections:true,
	connectionLimit:3,
	queueLimit:0,
	connectTimeout: 60000 // 60秒に設定 (ミリ秒)
}

export type TWsProcessType =
	| "ack"
	| "unauthorized"
	| "log/fetch"
	| "log/write"
	| "user/auth"
	| "user/update_name"
	| "user/fetchToken"
	| "user/delete"
	| "admin/slack/get"
	| "admin/slack/update"
	| "admin/backup/create"
	| "admin/backup/list"
	| "admin/backup/restore"
	| "slackBot/post";
export type TWsPayLoad = {
	result:boolean,
	content: Record<string,any>[],
	message:string,
}
export type TWsMessage = {
	type:TWsProcessType,
	payload:TWsPayLoad
}

export type DBresult = {
	"default": [mysql.RowDataPacket[], mysql.ResultSetHeader];
	"noHead": [mysql.RowDataPacket[]];
}

export const ADMIN_FIXED_PASSWORD = getEnv("ADMIN_FIXED_PASSWORD");
export const SLACK_TOKEN_ENC_KEY = getEnvOptional("SLACK_TOKEN_ENC_KEY", "");
export const BACKUP_DIR = getEnvOptional("BACKUP_DIR", "/backups");
