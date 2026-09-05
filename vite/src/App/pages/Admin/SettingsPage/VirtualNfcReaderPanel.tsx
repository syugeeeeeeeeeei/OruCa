import { Button, Card, Field, Input, Text } from "@chakra-ui/react";
import { TWsMessage } from "@Apps/app.env";
import { useWebSocket } from "@contexts/WebSocketContext";
import { toaster } from "@snippets/toaster";
import { FormEvent, useEffect, useState } from "react";

function VirtualNfcReaderPanel() {
	const { socket, sendMessage } = useWebSocket();
	const [isEnabled, setIsEnabled] = useState(false);
	const [studentID, setStudentID] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (!socket || socket.readyState !== WebSocket.OPEN) return;

		const handleMessage = (event: MessageEvent) => {
			const message: TWsMessage = JSON.parse(event.data);
			if (message.type === "debug/nfc/status") {
				setIsEnabled(message.payload.result && message.payload.content?.[0]?.enabled === true);
			}
			if (message.type === "debug/nfc/read") {
				setIsSubmitting(false);
				toaster.create({
					title: message.payload.result ? "仮想NFC読み取り成功" : "仮想NFC読み取り失敗",
					description: message.payload.message,
					type: message.payload.result ? "success" : "error",
					duration: 1800,
				});
			}
		};

		socket.addEventListener("message", handleMessage);
		sendMessage({ type: "debug/nfc/status", payload: { result: true, content: [], message: "" } });
		return () => socket.removeEventListener("message", handleMessage);
	}, [sendMessage, socket]);

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		const normalizedStudentID = studentID.trim();
		if (!normalizedStudentID || isSubmitting) return;
		setIsSubmitting(true);
		sendMessage({
			type: "debug/nfc/read",
			payload: { result: true, content: { student_ID: normalizedStudentID }, message: "仮想NFC読み取り" },
		});
	};

	if (!isEnabled) return null;

	return (
		<Card.Root mt={6} borderWidth={2} borderColor="orange.300">
			<Card.Header>
				<Card.Title>仮想NFCリーダー（デバッグ専用）</Card.Title>
				<Text fontSize="sm">学籍番号を入力して読み取りを再現します。実機と同じ入退室更新が実行されます。</Text>
			</Card.Header>
			<Card.Body>
				<form onSubmit={handleSubmit}>
					<Field.Root>
						<Field.Label>学籍番号</Field.Label>
						<Input value={studentID} onChange={(event) => setStudentID(event.target.value)} autoComplete="off" />
					</Field.Root>
					<Button mt={3} type="submit" colorPalette="orange" loading={isSubmitting} disabled={!studentID.trim()}>
						読み取り
					</Button>
				</form>
			</Card.Body>
		</Card.Root>
	);
}

export default VirtualNfcReaderPanel;
