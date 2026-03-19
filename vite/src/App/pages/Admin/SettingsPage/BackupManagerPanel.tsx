import { BackupItem, TWsMessage } from "@Apps/app.env";
import { useWebSocket } from "@Apps/contexts/WebSocketContext";
import { Box, Button, Card, HStack, Table, Text, VStack } from "@chakra-ui/react";
import GenericDataTable, { ColumnDefinition, getDefaultCellStyles } from "@components/GenericDataTable";
import { toaster } from "@snippets/toaster";
import { useCallback, useEffect, useState } from "react";
import RestoreDialog from "./RestoreDialog";

const MESSAGE_TYPES = {
	LIST: "admin/backup/list",
	CREATE: "admin/backup/create",
	RESTORE: "admin/backup/restore",
} as const;

type RestoreResponse = {
	restoredBackup: string;
	preRestoreBackup: string;
};

function formatSize(sizeBytes: number): string {
	if (sizeBytes < 1024) return `${sizeBytes} B`;
	if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
	return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function BackupManagerPanel() {
	const { socket, sendMessage } = useWebSocket();
	const [backups, setBackups] = useState<BackupItem[]>([]);
	const [isFetching, setIsFetching] = useState(false);
	const [isCreating, setIsCreating] = useState(false);
	const [restoringName, setRestoringName] = useState("");

	const requestBackupList = useCallback(() => {
		setIsFetching(true);
		sendMessage({
			type: MESSAGE_TYPES.LIST,
			payload: { result: true, content: [], message: "バックアップ一覧取得" },
		});
	}, [sendMessage]);

	useEffect(() => {
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			return;
		}

		const handleMessage = (event: MessageEvent) => {
			const message: TWsMessage = JSON.parse(event.data);

			if (message.type === MESSAGE_TYPES.LIST) {
				setIsFetching(false);
				if (!message.payload.result) {
					toaster.create({
						title: "バックアップ一覧の取得に失敗しました",
						description: message.payload.message,
						type: "error",
						duration: 2200,
					});
					return;
				}

				setBackups((message.payload.content ?? []) as BackupItem[]);
				return;
			}

			if (message.type === MESSAGE_TYPES.CREATE) {
				setIsCreating(false);
				if (!message.payload.result) {
					toaster.create({
						title: "バックアップ作成に失敗しました",
						description: message.payload.message,
						type: "error",
						duration: 2200,
					});
					return;
				}

				toaster.create({
					title: "バックアップを作成しました",
					type: "success",
					duration: 1500,
				});
				requestBackupList();
				return;
			}

			if (message.type === MESSAGE_TYPES.RESTORE) {
				setRestoringName("");
				if (!message.payload.result) {
					toaster.create({
						title: "リストアに失敗しました",
						description: message.payload.message,
						type: "error",
						duration: 2500,
					});
					return;
				}

				const result = message.payload.content?.[0] as RestoreResponse | undefined;
				toaster.create({
					title: "リストアを実行しました",
					description: result
						? `自動退避: ${result.preRestoreBackup}`
						: "自動退避バックアップを作成済み",
					type: "success",
					duration: 2500,
				});
				requestBackupList();
			}
		};

		socket.addEventListener("message", handleMessage);
		requestBackupList();

		return () => {
			socket.removeEventListener("message", handleMessage);
		};
	}, [requestBackupList, socket]);

	const handleCreateBackup = () => {
		if (isCreating || restoringName) {
			return;
		}

		setIsCreating(true);
		sendMessage({
			type: MESSAGE_TYPES.CREATE,
			payload: { result: true, content: [], message: "バックアップ作成" },
		});
	};

	const handleRestoreBackup = (backupName: string) => {
		if (restoringName || isCreating) {
			return;
		}
		setRestoringName(backupName);
		sendMessage({
			type: MESSAGE_TYPES.RESTORE,
			payload: {
				result: true,
				content: [{ backupName, confirmRestore: true }],
				message: "バックアップリストア",
			},
		});
	};

	const columns: ColumnDefinition[] = [
		{ header: "バックアップ", width: "45%", key: "name" },
		{ header: "サイズ", width: "20%", key: "size" },
		{ header: "更新時刻", width: "20%", key: "updatedAt" },
		{ header: "操作", width: "15%", key: "actions" },
	];

	const renderRow = (item: BackupItem) => {
		const tdStyles = getDefaultCellStyles();
		const isRestoring = restoringName === item.name;
		const disabled = isCreating || !!restoringName;

		return (
			<Table.Row key={item.name} _hover={{ bg: "gray.100" }}>
				<Table.Cell {...tdStyles}>{item.name}</Table.Cell>
				<Table.Cell {...tdStyles}>{formatSize(item.sizeBytes)}</Table.Cell>
				<Table.Cell {...tdStyles}>{new Date(item.updatedAt).toLocaleString("ja-JP")}</Table.Cell>
				<Table.Cell {...tdStyles}>
					<RestoreDialog
						backupName={item.name}
						trigger={
							<Button
								size={["2xs", null, "sm"]}
								variant="outline"
								disabled={disabled}
								loading={isRestoring}
							>
								リストア
							</Button>
						}
						onApproved={() => handleRestoreBackup(item.name)}
					/>
				</Table.Cell>
			</Table.Row>
		);
	};

	return (
		<Card.Root borderWidth={2} borderColor="default/20" shadow="sm" mt={6}>
			<Card.Header>
				<HStack justify="space-between" flexWrap="wrap" gap={2}>
					<Text fontWeight="bold" fontSize={["md", null, "xl"]} color="default">
						MySQLバックアップ
					</Text>
					<HStack gap={2}>
						<Button
							variant="outline"
							size={["xs", null, "sm"]}
							onClick={requestBackupList}
							disabled={isFetching || isCreating || !!restoringName}
						>
							再読込
						</Button>
						<Button
							size={["xs", null, "sm"]}
							onClick={handleCreateBackup}
							disabled={isCreating || !!restoringName}
							bgColor={{ base: "default", _hover: "rgb(83, 63, 194)" }}
						>
							バックアップ作成
						</Button>
					</HStack>
				</HStack>
			</Card.Header>
			<Card.Body>
				<VStack align="stretch" gap={3}>
					<Box>
						<Text fontSize={["xs", null, "sm"]} color="default/75">
							リストア時は実行前に自動退避バックアップを作成します。
						</Text>
					</Box>
					<GenericDataTable
						columns={columns}
						data={backups}
						renderRow={renderRow}
						styles={{ maxHeight: "45vh", borderWidth: "1px" }}
					/>
				</VStack>
			</Card.Body>
		</Card.Root>
	);
}

export default BackupManagerPanel;
