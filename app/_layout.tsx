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

import { GestureHandlerRootView } from "react-native-gesture-handler";
import CustomDrawer from "@/components/CustomDrawer";

import { Controller } from "@/services/notificationController";
import {
  initializeNotifications,
  addNotificationReceivedListener,
  addNotificationResponseListener,
} from "@/lib/notifications";
import { store, persistor, RootState } from "@/store/store";
import { setLastNotificationText } from "@/store/slices/remindersSlice";

function AppContent() {
  const systemColorScheme = useColorScheme();
  const userColorScheme = useSelector(
    (state: RootState) => state.preferences.colorScheme
  );
  const isEnabled = useSelector(
    (state: RootState) => state.preferences.isEnabled
  );

  // Determine which theme to use based on user preference
  const effectiveColorScheme =
    userColorScheme === "auto" ? systemColorScheme : userColorScheme;
  const theme = effectiveColorScheme === "dark" ? MD3DarkTheme : MD3LightTheme;

  const router = useRouter();
  const [isInitialized, setIsInitialized] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Custom drawer toggle button that respects theme
  const ThemedDrawerToggle = () => {
    const theme = useTheme();
    return (
      <IconButton
        icon="menu"
        iconColor={theme.colors.onSurface}
        onPress={() => setDrawerVisible(true)}
      />
    );
  };

  // Initialize the controller and notification system on app startup
  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        console.log("[App] Initializing app...");

        // // Initialize notifications and request permissions
        // const permissionsGranted = await initializeNotifications();
        // if (!permissionsGranted) {
        //   console.warn("[App] Notification permissions not granted");
        //   // Continue anyway - user can enable later
        // }

        if (isEnabled) {
          const controller = Controller.getInstance();

          await controller.initialize(); // sets up alarm service
          await controller.enable(); // starts scheduling
          console.log("[App] Controller enabled");
        } else {
          console.log("[App] Controller not enabled (isEnabled=false)");
        }

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
    const notificationListener = addNotificationReceivedListener(
      (notification) => {
        console.log("[App] Notification received in foreground:", notification);
      },
    );

    // Update the last notification text when user taps notification
    const responseListener = addNotificationResponseListener((response) => {
      console.log("[App] Notification response received:", response);
      const reminderText = response.notification.request.content.body;
      if (reminderText) {
        store.dispatch(setLastNotificationText(reminderText));
      }
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
        <CustomDrawer
          visible={drawerVisible}
          onClose={() => setDrawerVisible(false)}
        />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: theme.colors.surface,
            },
            headerTintColor: theme.colors.onSurface,
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              title: "Mindful Notifier",
              headerLeft: () => <ThemedDrawerToggle />,
            }}
          />
          <Stack.Screen
            name="schedule"
            options={{
              title: "Manage Schedule",
              headerLeft: () => <BackButton />,
            }}
          />
          <Stack.Screen
            name="reminders"
            options={{
              title: "Configure Reminders",
              headerLeft: () => <BackButton />,
            }}
          />
          <Stack.Screen
            name="sound"
            options={{
              title: "Configure Sound",
              headerLeft: () => <BackButton />,
            }}
          />
          <Stack.Screen
            name="preferences"
            options={{
              title: "App Preferences",
              headerLeft: () => <BackButton />,
            }}
          />
          <Stack.Screen
            name="about"
            options={{
              title: "About Mindful Notifier",
              headerLeft: () => <BackButton />,
            }}
          />
        </Stack>
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
