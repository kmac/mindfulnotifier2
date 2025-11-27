import React from "react";
import { View, StyleSheet, Modal, TouchableOpacity } from "react-native";
import { Drawer, useTheme, Divider } from "react-native-paper";
import { useRouter, usePathname } from "expo-router";
import { useAppSelector } from "@/src/store/store";

interface CustomDrawerProps {
  visible: boolean;
  onClose: () => void;
}

export default function CustomDrawer({ visible, onClose }: CustomDrawerProps) {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const debugInfoEnabled = useAppSelector(
    (state) => state.preferences.debugInfoEnabled,
  );

  const handleNavigation = (route: string) => {
    router.push(route as any);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Drawer Content */}
        <View
          style={[
            styles.drawerContainer,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <Drawer.Section style={styles.drawerSection}>
            <Drawer.Item
              label="Mindful Notifier"
              active={pathname === "/"}
              onPress={() => handleNavigation("/")}
              icon="home"
            />
            <Divider />
            <Drawer.Item
              label="Schedule"
              active={pathname === "/schedule"}
              onPress={() => handleNavigation("/schedule")}
              icon="calendar-clock"
            />
            <Drawer.Item
              label="Reminders"
              active={pathname === "/reminders"}
              onPress={() => handleNavigation("/reminders")}
              icon="bell"
            />
            <Drawer.Item
              label="Sound"
              active={pathname === "/sound"}
              onPress={() => handleNavigation("/sound")}
              icon="volume-high"
            />
            <Drawer.Item
              label="Preferences"
              active={pathname === "/preferences"}
              onPress={() => handleNavigation("/preferences")}
              icon="cog"
            />
            <Divider />
            <Drawer.Item
              label="Help"
              active={pathname === "/help"}
              onPress={() => handleNavigation("/help")}
              icon="help-box-outline"
            />
            <Drawer.Item
              label="About"
              active={pathname === "/about"}
              onPress={() => handleNavigation("/about")}
              icon="information"
            />
            {debugInfoEnabled && (
              <Drawer.Item
                label="Logs"
                active={pathname === "/logs"}
                onPress={() => handleNavigation("/logs")}
                icon="file-document-outline"
              />
            )}
          </Drawer.Section>
        </View>

        {/* Backdrop */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    flexDirection: "row",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  drawerContainer: {
    width: 280,
    height: "100%",
    shadowColor: "#000",
    shadowOffset: {
      width: 2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  drawerSection: {
    marginTop: 48,
  },
});
