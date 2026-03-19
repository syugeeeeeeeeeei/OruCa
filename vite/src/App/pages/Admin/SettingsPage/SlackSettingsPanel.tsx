import { SlackSettings, TWsMessage } from "@Apps/app.env";
import { useWebSocket } from "@Apps/contexts/WebSocketContext";
import { Box, Button, Card, Field, HStack, Input, Text, VStack } from "@chakra-ui/react";
import { toaster } from "@snippets/toaster";
import { useEffect, useMemo, useState } from "react";

function SlackSettingsPanel() {
	const { socket, sendMessage } = useWebSocket();
	const [channelId, setChannelId] = useState("");
	const [botToken, setBotToken] = useState("");
	const [tokenConfigured, setTokenConfigured] = useState(false);
	const [updatedAt, setUpdatedAt] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	const canSave = useMemo(() => {
		return !!channelId.trim() && !isLoading && !isSaving;
	}, [channelId, isLoading, isSaving]);

	useEffect(() => {
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			return;
		}

		const handleMessage = (event: MessageEvent) => {
			const message: TWsMessage = JSON.parse(event.data);
			if (message.type === "admin/slack/get") {
				setIsLoading(false);
				if (!message.payload.result) {
					toaster.create({
						title: "Slack設定の取得に失敗しました",
						description: message.payload.message,
						type: "error",
						duration: 2000,
					});
					return;
				}

				const settings = message.payload.content?.[0] as SlackSettings | undefined;
				if (!settings) {
					return;
				}

				setChannelId(settings.channelId ?? "");
				setTokenConfigured(!!settings.tokenConfigured);
				setUpdatedAt(settings.updatedAt ?? "");
				return;
			}

			if (message.type === "admin/slack/update") {
				setIsSaving(false);
				if (!message.payload.result) {
					toaster.create({
						title: "Slack設定の保存に失敗しました",
						description: message.payload.message,
						type: "error",
						duration: 2200,
					});
					return;
				}

				const settings = message.payload.content?.[0] as SlackSettings | undefined;
				if (settings) {
					setChannelId(settings.channelId ?? "");
					setTokenConfigured(!!settings.tokenConfigured);
					setUpdatedAt(settings.updatedAt ?? "");
				}

				setBotToken("");
				toaster.create({
					title: "Slack設定を保存しました",
					type: "success",
					duration: 1500,
				});
			}
		};

		socket.addEventListener("message", handleMessage);
		setIsLoading(true);
		sendMessage({
			type: "admin/slack/get",
			payload: { result: true, content: [], message: "Slack設定取得" },
		});

		return () => {
			socket.removeEventListener("message", handleMessage);
		};
	}, [socket, sendMessage]);

	const handleSave = () => {
		if (!canSave) {
			return;
		}

		setIsSaving(true);
		sendMessage({
			type: "admin/slack/update",
			payload: {
				result: true,
				content: [{ channelId: channelId.trim(), botToken: botToken.trim() || undefined }],
				message: "Slack設定更新",
			},
		});
	};

	return (
		<Card.Root borderWidth={2} borderColor="default/20" shadow="sm" mt={6}>
			<Card.Header>
				<Text fontWeight="bold" fontSize={["md", null, "xl"]} color="default">Slack通知設定</Text>
			</Card.Header>
			<Card.Body>
				<VStack align="stretch" gap={4}>
					<Field.Root>
						<Field.Label fontSize={["sm", null, "md"]}>チャンネルID</Field.Label>
						<Input
							value={channelId}
							onChange={(e) => setChannelId(e.target.value)}
							placeholder="例: C0123456789"
							disabled={isLoading || isSaving}
						/>
					</Field.Root>

					<Field.Root>
						<Field.Label fontSize={["sm", null, "md"]}>Botトークン（更新時のみ入力）</Field.Label>
						<Input
							type="password"
							value={botToken}
							onChange={(e) => setBotToken(e.target.value)}
							placeholder={tokenConfigured ? "設定済み（変更時のみ再入力）" : "xoxb-..."}
							disabled={isLoading || isSaving}
							autoComplete="off"
						/>
					</Field.Root>

					<HStack justify="space-between" flexWrap="wrap" gap={2}>
						<Box>
							<Text fontSize={["xs", null, "sm"]} color="default/80">
								トークン状態: {tokenConfigured ? "設定済み" : "未設定"}
							</Text>
							{updatedAt && (
								<Text fontSize={["xs", null, "sm"]} color="default/70">
									最終更新: {new Date(updatedAt).toLocaleString("ja-JP")}
								</Text>
							)}
						</Box>
						<Button
							onClick={handleSave}
							disabled={!canSave}
							bgColor={{ base: "default", _hover: "rgb(83, 63, 194)" }}
							size={["sm", null, "md"]}
						>
							保存
						</Button>
					</HStack>
				</VStack>
			</Card.Body>
		</Card.Root>
	);
}

export default SlackSettingsPanel;
