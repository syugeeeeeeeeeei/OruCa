export class SlackService {
	public async postMessage(
		message: string,
		token: string,
		channelId: string
	): Promise<void> {
		if (!token.trim() || !channelId.trim()) {
			console.log("Slack設定が未設定のため投稿をスキップしました。");
			return;
		}

		const response = await fetch("https://slack.com/api/chat.postMessage", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				channel: channelId,
				text: message,
			}),
		});

		if (!response.ok) {
			throw new Error(`Slack API error: ${response.status}`);
		}

		const result = await response.json() as { ok?: boolean; error?: string };
		if (!result.ok) {
			throw new Error(`Slack API error: ${result.error ?? "unknown_error"}`);
		}

		console.log("SlackBotにメッセージを送信しました");
	}
}
