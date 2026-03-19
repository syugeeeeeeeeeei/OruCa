// src/pages/AdminSetting.tsx
import { Box, Heading, Text } from "@chakra-ui/react";
import HomeButton from "@components/Buttons/HomeButton";
import ReturnButton from "@components/Buttons/ReturnButton";
import HeadBar from "@components/HeadBar";
import { useWebSocket } from "@contexts/WebSocketContext";
import { Toaster, toaster } from "@snippets/toaster";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import BackupManagerPanel from "./BackupManagerPanel";
import EditableDataTable from "./EditableDataTable";
import SlackSettingsPanel from "./SlackSettingsPanel";


function SettingsPage() {
	const location = useLocation();
	const navigate = useNavigate();
	const { socket } = useWebSocket();
	useEffect(()=>{
		if (location.state?.loginStatus) {
			Promise.resolve().then(() => {
				toaster.create({
					title: "ログイン成功",
					type: "success",
					duration: 1500,
				});
			});
			// これがないと戻るときにも表示される可能性があるため state を消す
			window.history.replaceState({}, document.title);
		}
	},[location.state]);

	useEffect(() => {
		if (!socket || socket.readyState !== WebSocket.OPEN) return;

		const handleUnauthorized = (event: MessageEvent) => {
			try {
				const message = JSON.parse(event.data);
				if (message.type !== "unauthorized") return;
				toaster.create({
					title: "認証が無効になりました",
					description: "再ログインしてください。",
					type: "error",
					duration: 1800,
				});
				navigate("/admin", { state: { loginStatus: false } });
			} catch (error) {
				console.error("Unauthorizedメッセージ処理エラー:", error);
			}
		};

		socket.addEventListener("message", handleUnauthorized);
		return () => {
			socket.removeEventListener("message", handleUnauthorized);
		};
	}, [navigate, socket]);

	return (
		<>
			<HeadBar otherElements={[<ReturnButton address={"/admin"} />,<HomeButton address={"/"} />]}>
					<Box 
						w={"100%"} 
						h={"100%"}
						px={"5%"}
						py={["10%", null, "5%"]}
						>
						<Heading size={["lg", null, "2xl"]}>管理者用ページ</Heading>
						<Text fontSize={["sm", null, "md"]}>ここはログイン済みのユーザーのみアクセス可能です。</Text>
						<EditableDataTable/>
						<SlackSettingsPanel />
						<BackupManagerPanel />
					</Box>
			</HeadBar>
			<Toaster />
		</>
	);
}

export default SettingsPage;
