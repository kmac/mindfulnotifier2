import { Button, Text, View } from "react-native";
import { getRandomReminder } from "@/components/reminders";

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text>{getRandomReminder()}</Text>
      <Button>Test</Button>
    </View>
  );
}
