import { Stack, useRouter } from "expo-router";
import { Image, Text, View, StyleSheet } from "react-native";
import {
  PaperProvider,
  MD3LightTheme,
  MD3DarkTheme,
  IconButton,
  useTheme,
} from "react-native-paper";
import { useColorScheme } from "react-native";
import { useEffect, useState } from "react";
import { Provider, useSelector } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { useNavigation } from "@react-navigation/native";
import { DrawerNavigationProp } from "@react-navigation/drawer";

import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Drawer } from "expo-router/drawer";

import { Controller } from "@/services/notificationController";
import * as Notifications from "expo-notifications";
import { store, persistor, RootState } from "@/store/store";

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function AppContent() {
  const systemColorScheme = useColorScheme();
  const userColorScheme = useSelector(
    (state: RootState) => state.preferences.colorScheme
  );

  // Determine which theme to use based on user preference
  const effectiveColorScheme =
    userColorScheme === "auto" ? systemColorScheme : userColorScheme;
  const theme = effectiveColorScheme === "dark" ? MD3DarkTheme : MD3LightTheme;

  const router = useRouter();
  const [isInitialized, setIsInitialized] = useState(false);

  // Custom drawer toggle button that respects theme
  const ThemedDrawerToggle = () => {
    const theme = useTheme();
    const navigation = useNavigation<DrawerNavigationProp<any>>();
    return (
      <IconButton
        icon="menu"
        iconColor={theme.colors.onSurface}
        onPress={() => navigation.toggleDrawer()}
      />
    );
  };

  // Initialize the controller and notification system on app startup
  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        console.log("[App] Initializing app...");

        // Request notification permissions
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") {
          console.warn("[App] Notification permissions not granted");
          // Continue anyway - user can enable later
        }

        const controller = Controller.getInstance();

        await controller.initialize(); // sets up alarm service
        await controller.enable(); // starts scheduling

        if (isMounted) {
          setIsInitialized(true);
          console.log("[App] App initialized successfully");
        }
      } catch (error) {
        console.error("[App] Failed to initialize app:", error);
      }
    }

    initialize();

    // Listen for notifications received while the app is in the foreground
    const notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("[App] Notification received in foreground:", notification);
      },
    );

    // Listen for notification interactions (when user taps on notification)
    const responseListener =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("[App] Notification response received:", response);
      });

    // Cleanup on unmount
    return () => {
      isMounted = false;
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  const BackButton = () => (
    <IconButton icon="arrow-left" onPress={() => router.push("/")} />
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={theme}>
            <Drawer
              screenOptions={{
                drawerPosition: "left",
                headerStyle: {
                  backgroundColor: theme.colors.surface,
                },
                headerTintColor: theme.colors.onSurface,
                drawerStyle: {
                  backgroundColor: theme.colors.surface,
                },
                drawerActiveTintColor: theme.colors.primary,
                drawerInactiveTintColor: theme.colors.onSurfaceVariant,
              }}
            >
              <Drawer.Screen
                name="index"
                options={{
                  drawerLabel: "Mindful Notifier",
                  title: "Mindful Notifier",
                  headerTitle: "Mindful Notifier",
                  headerLeft: () => <ThemedDrawerToggle />,
                }}
              />
              <Drawer.Screen
                name="schedule"
                options={{
                  drawerLabel: "Schedule",
                  title: "Schedule",
                  headerTitle: "Manage Schedule",
                  headerLeft: () => <BackButton />,
                }}
              />
              <Drawer.Screen
                name="reminders"
                options={{
                  drawerLabel: "Reminders",
                  title: "Reminders",
                  headerTitle: "Configure Reminders",
                  headerLeft: () => <BackButton />,
                }}
              />
              <Drawer.Screen
                name="sound"
                options={{
                  drawerLabel: "Sound",
                  title: "Sound",
                  headerTitle: "Configure Sound",
                  headerLeft: () => <BackButton />,
                }}
              />
              <Drawer.Screen
                name="preferences"
                options={{
                  drawerLabel: "Preferences",
                  title: "Preferences",
                  headerTitle: "App Preferences",
                  headerLeft: () => <BackButton />,
                }}
              />
              <Drawer.Screen
                name="about"
                options={{
                  drawerLabel: "About",
                  title: "About",
                  headerTitle: "About Mindful Notifier",
                  headerLeft: () => <BackButton />,
                }}
              />
            </Drawer>
          </PaperProvider>
        </GestureHandlerRootView>
  );
}

export default function Layout() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <AppContent />
      </PersistGate>
    </Provider>
  );
}
