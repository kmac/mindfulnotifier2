import { View, Pressable } from "react-native";
import { Button, Text  } from "react-native-paper";
import { getRandomReminder } from "@/lib/reminders";
import { useState } from "react";

export default function Index() {
  const [currentReminder, setCurrentReminder] = useState(getRandomReminder());

  const handleGetNewReminder = () => {
    setCurrentReminder(getRandomReminder());
  };

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontSize: 18,
          fontWeight: "bold",
          color: "#333",
          textAlign: "center",
          marginBottom: 20,
          paddingHorizontal: 20,
          lineHeight: 24,
        }}
      >
        {currentReminder}
      </Text>
      <Button mode="contained" onPress={handleGetNewReminder}>Refresh</Button>
    </View>
  );
}
