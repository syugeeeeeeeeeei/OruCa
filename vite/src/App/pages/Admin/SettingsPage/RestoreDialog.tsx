import { Button, CloseButton, Dialog, Portal, Text, VStack } from "@chakra-ui/react";
import React from "react";

type RestoreDialogProps = {
	trigger: React.ReactElement<HTMLButtonElement>;
	backupName: string;
	onApproved?: () => void;
	onCanceled?: () => void;
};

const RestoreDialog: React.FC<RestoreDialogProps> = ({
	trigger,
	backupName,
	onApproved,
	onCanceled,
}) => {
	return (
		<Dialog.Root size={["xs", null, "lg"]}>
			<Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
			<Portal>
				<Dialog.Backdrop />
				<Dialog.Positioner>
					<Dialog.Content w={["85%", null, "100%"]} color="default">
						<Dialog.Header>
							<Dialog.Title fontSize={["md", null, "2xl"]}>DBリストアの確認</Dialog.Title>
						</Dialog.Header>
						<Dialog.Body>
							<VStack p={[1, null, 4]} gapY={6} align="flex-start">
								<Text fontWeight="bold" fontSize={["md", null, "xl"]}>
									対象バックアップ
								</Text>
								<Text fontSize={["xs", null, "lg"]}>{backupName}</Text>
								<Text color="red.600" fontWeight="medium" fontSize={["md", null, "xl"]}>
									実行前に自動バックアップを作成してからリストアします。実行しますか？
								</Text>
							</VStack>
						</Dialog.Body>
						<Dialog.Footer>
							<Button
								variant="surface"
								onClick={onApproved}
								colorPalette="red"
								size={["xs", null, "md"]}
								fontSize={["xs", null, "lg"]}
							>
								RESTORE
							</Button>
						</Dialog.Footer>
						<Dialog.CloseTrigger asChild>
							<CloseButton size="sm" onClick={onCanceled} />
						</Dialog.CloseTrigger>
					</Dialog.Content>
				</Dialog.Positioner>
			</Portal>
		</Dialog.Root>
	);
};

export default RestoreDialog;
