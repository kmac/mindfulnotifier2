import { Stack, useRouter } from "expo-router";
import {
  PaperProvider,
  MD3LightTheme,
  MD3DarkTheme,
  IconButton,
  useTheme,
} from "react-native-paper";
import { useColorScheme, BackHandler } from "react-native";
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
import * as Notifications from "expo-notifications";
import { store, persistor, RootState } from "@/store/store";
import { setLastNotificationText } from "@/store/slices/remindersSlice";
import { useFlutterMigration } from "@/hooks/useFlutterMigration";

const DO_FLUTTER_MIGRATION = false;

function AppContent() {
  // Perform Flutter migration if needed (runs once on first launch after update)
  const migrationStatus = DO_FLUTTER_MIGRATION ? useFlutterMigration() : undefined;
  const systemColorScheme = useColorScheme();
  const userColorScheme = useSelector(
    (state: RootState) => state.preferences.colorScheme,
  );
  const isEnabled = useSelector(
    (state: RootState) => state.preferences.isEnabled,
  );

  // Determine which theme to use based on user preference
  const effectiveColorScheme =
    userColorScheme === "auto" ? systemColorScheme : userColorScheme;
  const theme = effectiveColorScheme === "dark" ? MD3DarkTheme : MD3LightTheme;

  const router = useRouter();
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

    console.log("[App] Initializing app...");

    // Configure notification handler FIRST (synchronous, runs once)
    // This determines how notifications are displayed when app is in foreground
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // Listen for notifications received while the app is in the foreground
    const notificationListener = addNotificationReceivedListener(
      (notification) => {
        console.log("[App] Notification received in foreground:", notification);

        // Update the last notification text when received in foreground
        const reminderText = notification.request.content.body;
        if (reminderText) {
          store.dispatch(setLastNotificationText(reminderText));
        }
      },
    );

    // Listen for notification taps (when user interacts with notification)
    const responseListener = addNotificationResponseListener(
      async (response) => {
        console.log("[App] Notification response received:", response);

        // Dismiss all presented notifications when user taps any notification
        // This clears the notification tray of accumulated notifications
        try {
          await Notifications.dismissAllNotificationsAsync();
          console.log("[App] Dismissed all presented notifications");
        } catch (error) {
          console.error("[App] Failed to dismiss notifications:", error);
        }

        const reminderText = response.notification.request.content.body;
        if (reminderText) {
          // TODO if app is in background this will not have any effect (?)
          store.dispatch(setLastNotificationText(reminderText));
        }
      },
    );

    // Perform async initialization tasks
    async function initializeAsync() {
      try {
        // Initialize notification channels (Android) and request permissions
        // Note: We continue even if permissions not granted - user can enable later
        await initializeNotifications();

        // Start the notification controller if enabled
        if (isEnabled) {
          const controller = Controller.getInstance();
          await controller.initialize(); // sets up alarm service
          await controller.enable(); // starts scheduling
          console.log("[App] Controller enabled");
        } else {
          console.log("[App] Controller not enabled (isEnabled=false)");
        }

        if (isMounted) {
          console.log("[App] App initialized successfully");
        }
      } catch (error) {
        console.error("[App] Failed to initialize app:", error);
      }
    }

    // Start async initialization
    initializeAsync();

    // Cleanup on unmount
    return () => {
      isMounted = false;
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  // Handle Android hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        // Always allow default behavior
        // React Navigation handles screen navigation, system handles minimizing
        return false;
      },
    );

    // on unmount:
    return () => backHandler.remove();
  }, []);

  const BackButton = () => (
    <IconButton
      icon="arrow-left"
      onPress={() => router.back()}
    />
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
            name="help"
            options={{
              title: "Help",
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
          <Stack.Screen
            name="logs"
            options={{
              title: "Logs",
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
