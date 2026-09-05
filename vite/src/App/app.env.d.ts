export type APIData = {
	student_ID: string;
	student_Name:string|undefined;
	isInRoom: number;
	updated_at: string;
};

export type BackupItem = {
	name: string;
	sizeBytes: number;
	updatedAt: string;
};

export type SlackSettings = {
	channelId: string;
	tokenConfigured: boolean;
	updatedAt: string;
};

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
	| "debug/nfc/status"
	| "debug/nfc/read";
export type TWsPayLoad = {
	result: boolean,
	// WebSocket payloads use an array for most messages and an object for log/write.
	content: any,
	message: string,
}
export type TWsMessage = {
	type: TWsProcessType,
	payload: TWsPayLoad
}
