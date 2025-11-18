import { Stack, useRouter, useSegments } from "expo-router";
import {
  PaperProvider,
  MD3LightTheme,
  MD3DarkTheme,
  IconButton,
  useTheme,
  Portal,
  Dialog,
  Button,
  Paragraph,
} from "react-native-paper";
import { useColorScheme, BackHandler, Alert } from "react-native";
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
import { addBackgroundTaskRun, addDebugInfo } from "@/store/slices/preferencesSlice";
import { useFlutterMigration } from "@/hooks/useFlutterMigration";
import {
  getBackgroundTaskHistory,
  getBackgroundTaskLogs,
} from "@/services/backgroundTaskService";

function AppContent() {
  // Perform Flutter migration if needed (runs once on first launch after update)
  const migrationStatus = useFlutterMigration();
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
  const segments = useSegments();
  const [isInitialized, setIsInitialized] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [exitDialogVisible, setExitDialogVisible] = useState(false);

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

        // Load background task history from AsyncStorage and sync to Redux
        const taskHistory = await getBackgroundTaskHistory();
        const taskLogs = await getBackgroundTaskLogs();

        if (taskHistory.length > 0) {
          console.log(
            `[App] Found ${taskHistory.length} background task runs in storage`
          );
          // Sync to Redux store
          taskHistory.forEach((timestamp) => {
            store.dispatch(addBackgroundTaskRun(timestamp));
          });
        }

        if (taskLogs.length > 0) {
          console.log(`[App] Found ${taskLogs.length} background task logs`);
          // Add logs to Redux debugInfo
          taskLogs.forEach((log) => {
            store.dispatch(addDebugInfo(log));
          });
        }

        // // Initialize notifications and request permissions
        const permissionsGranted = await initializeNotifications();
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
    const responseListener = addNotificationResponseListener(async (response) => {
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

  // Handle Android hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        // If we're on the index screen (segments array is empty)
        // When on index, segments will be an empty array
        const isOnIndexScreen = !segments || segments.length < 1;

        if (isOnIndexScreen) {
          // Show exit dialog
          setExitDialogVisible(true);
          return true; // Prevent default back behavior
        }

        // For other screens, navigate back to index
        router.push("/");
        return true; // Prevent default back behavior
      }
    );

    return () => backHandler.remove();
  }, [segments, router]);

  const BackButton = () => (
    <IconButton
      icon="arrow-left"
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.push("/");
        }
      }}
    />
  );

  const handleExitApp = () => {
    setExitDialogVisible(false);
    // Disable the controller if it's enabled
    if (isEnabled) {
      Controller.getInstance()
        .disable()
        .catch((error) =>
          console.error("[App] Failed to disable controller on exit:", error)
        );
    }
    BackHandler.exitApp();
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={theme}>
        <CustomDrawer
          visible={drawerVisible}
          onClose={() => setDrawerVisible(false)}
        />
        <Portal>
          <Dialog
            visible={exitDialogVisible}
            onDismiss={() => setExitDialogVisible(false)}
          >
            <Dialog.Title>Exit App?</Dialog.Title>
            <Dialog.Content>
              <Paragraph>
                {isEnabled
                  ? "The background notification service will be terminated and the app will shut down. Are you sure you want to exit?"
                  : "Are you sure you want to exit the app?"}
              </Paragraph>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setExitDialogVisible(false)}>Cancel</Button>
              <Button onPress={handleExitApp}>Exit</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
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
