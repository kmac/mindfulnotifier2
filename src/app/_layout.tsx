import { useRouter } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { PaperProvider, IconButton, useTheme } from "react-native-paper";
import { useColorScheme, AppState, BackHandler } from "react-native";
import { useEffect, useState } from "react";
import { Provider, useSelector } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  DrawerContentScrollView,
  DrawerItemList,
  DrawerItem,
  DrawerContentComponentProps,
} from "@react-navigation/drawer";

import { enableNotifications } from "@/src/services/notificationController";
import {
  initializeNotifications,
  addNotificationReceivedListener,
  addNotificationResponseListener,
} from "@/src/lib/notifications";
import * as Notifications from "expo-notifications";
import { store, persistor, RootState, useAppSelector } from "@/src/store/store";
import { setLastNotificationText } from "@/src/store/slices/remindersSlice";
import { useFlutterMigration } from "@/src/hooks/useFlutterMigration";
import { Themes } from "@/src/ui/styles";

const DO_FLUTTER_MIGRATION = false;

function AppContent() {
  // Perform Flutter migration if needed (runs once on first launch after update)
  const migrationStatus = DO_FLUTTER_MIGRATION
    ? useFlutterMigration()
    : undefined;
  const systemColorScheme = useColorScheme();
  const userColorScheme = useSelector(
    (state: RootState) => state.preferences.colorScheme,
  );
  const userColor = useSelector((state: RootState) => state.preferences.color);
  const isEnabled = useSelector(
    (state: RootState) => state.preferences.isEnabled,
  );

  const router = useRouter();
  const [randomColor, setRandomColor] =
    useState<keyof typeof Themes.light>("default");

  // Determine which theme to use based on user preference
  const effectiveColorScheme =
    userColorScheme === "auto" ? systemColorScheme : userColorScheme;

  // Helper function to get random color from available themes
  const getRandomColor = (): keyof typeof Themes.light => {
    const availableColors = Object.keys(Themes.light).filter(
      (c) => c !== "default",
    ) as Array<keyof typeof Themes.light>;
    return availableColors[Math.floor(Math.random() * availableColors.length)];
  };

  // Use random color if selected, otherwise use user preference
  const effectiveColor: keyof typeof Themes.light =
    // @ts-ignore TS2367
    userColor === "random"
      ? randomColor
      : (userColor as keyof typeof Themes.light);
  const theme =
    Themes[effectiveColorScheme === "dark" ? "dark" : "light"][effectiveColor];

  // Initialize random color on mount if random mode is enabled
  useEffect(() => {
    // @ts-ignore TS2367
    if (userColor === "random") {
      const initialRandomColor = getRandomColor();
      setRandomColor(initialRandomColor);
      console.log("[App] Initial random color selected:", initialRandomColor);
    }
  }, []);


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

        // Check if this is a warning notification that should open the app
        const notificationData = response.notification.request.content.data;
        const isWarningNotification =
          notificationData?.type === "warning" &&
          notificationData?.action === "openApp";

        if (isWarningNotification) {
          console.log(
            "[App] Warning notification tapped - opening app to home screen",
          );
          // Navigate to home screen
          router.push("/");
        }

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
          // can we handle this in index.ts via:
          // const lastNotificationResponse = Notifications.useLastNotificationResponse(); ??
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

        // Start notifications if enabled
        if (isEnabled) {
          await enableNotifications();
          console.log("[App] Notifications enabled");
        } else {
          console.log("[App] Notifications not enabled (isEnabled=false)");
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


  // Listen for app state changes and clear notifications when coming to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState) => {
        console.log("[App] App state changed:", nextAppState);

        if (nextAppState === "active") {
          // Select random color if random mode is enabled
          // @ts-ignore TS2367
          if (userColor === "random") {
            const newRandomColor = getRandomColor();
            setRandomColor(newRandomColor);
            console.log("[App] Random color selected:", newRandomColor);
          }

          // Clear notifications when app comes to foreground (if enabled)
          if (isEnabled) {
            try {
              await Notifications.dismissAllNotificationsAsync();
              console.log(
                "[App] Cleared all presented notifications on foreground",
              );
            } catch (error) {
              console.error(
                "[App] Failed to dismiss notifications on foreground:",
                error,
              );
            }
          }
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [isEnabled, userColor]);

  // Back button that returns to home screen (for modal screens)
  const BackToHomeButton = () => {
    const theme = useTheme();
    return (
      <IconButton
        icon="close"
        iconColor={theme.colors.onSurface}
        onPress={() => router.push("/")}
      />
    );
  };

  // Custom drawer content component with theming support
  const CustomDrawerContent = (props: DrawerContentComponentProps) => {
    const theme = useTheme();
    const debugInfoEnabled = useAppSelector(
      (state) => state.preferences.debugInfoEnabled,
    );

    return (
      <DrawerContentScrollView
        {...props}
        style={{ backgroundColor: theme.colors.surface }}
      >
        <DrawerItemList {...props} />
        {debugInfoEnabled && (
          <DrawerItem
            label="Logs"
            onPress={() => props.navigation.navigate("logs")}
            icon={() => (
              <MaterialCommunityIcons
                name="file-document-outline"
                size={24}
                color={theme.colors.onSurfaceVariant}
              />
            )}
            labelStyle={{ color: theme.colors.onSurface }}
            style={{
              backgroundColor:
                props.state.routes[props.state.index]?.name === "logs"
                  ? theme.colors.secondaryContainer
                  : "transparent",
            }}
          />
        )}
      </DrawerContentScrollView>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={theme}>
        <Drawer
          drawerContent={(props) => <CustomDrawerContent {...props} />}
          screenOptions={{
            headerStyle: {
              backgroundColor: theme.colors.surface,
            },
            headerTintColor: theme.colors.onSurface,
            headerShadowVisible: false,
            drawerStyle: {
              backgroundColor: theme.colors.surface,
            },
            drawerActiveTintColor: theme.colors.onSecondaryContainer,
            drawerActiveBackgroundColor: theme.colors.secondaryContainer,
            drawerInactiveTintColor: theme.colors.onSurfaceVariant,
          }}
        >
          <Drawer.Screen
            name="index"
            options={{
              title: "Mindful Notifier",
              drawerLabel: "Mindful Notifier",
              drawerIcon: ({ color, size }: { color: string; size: number }) => (
                <MaterialCommunityIcons name="home" size={size} color={color} />
              ),
            }}
          />
          <Drawer.Screen
            name="schedule"
            options={{
              title: "Manage Schedule",
              drawerLabel: "Schedule",
              drawerIcon: ({ color, size }: { color: string; size: number }) => (
                <MaterialCommunityIcons
                  name="calendar-clock"
                  size={size}
                  color={color}
                />
              ),
            }}
          />
          <Drawer.Screen
            name="reminders"
            options={{
              title: "Configure Reminders",
              drawerLabel: "Reminders",
              drawerIcon: ({ color, size }: { color: string; size: number }) => (
                <MaterialCommunityIcons name="bell" size={size} color={color} />
              ),
            }}
          />
          <Drawer.Screen
            name="sound"
            options={{
              title: "Configure Sound",
              drawerLabel: "Sound",
              drawerIcon: ({ color, size }: { color: string; size: number }) => (
                <MaterialCommunityIcons
                  name="volume-high"
                  size={size}
                  color={color}
                />
              ),
            }}
          />
          <Drawer.Screen
            name="preferences"
            options={{
              title: "App Preferences",
              drawerLabel: "Preferences",
              drawerIcon: ({ color, size }: { color: string; size: number }) => (
                <MaterialCommunityIcons name="cog" size={size} color={color} />
              ),
              headerLeft: () => <BackToHomeButton />,
            }}
          />
          <Drawer.Screen
            name="help"
            options={{
              title: "Help",
              drawerLabel: "Help",
              drawerIcon: ({ color, size }: { color: string; size: number }) => (
                <MaterialCommunityIcons
                  name="help-box-outline"
                  size={size}
                  color={color}
                />
              ),
              headerLeft: () => <BackToHomeButton />,
            }}
          />
          <Drawer.Screen
            name="about"
            options={{
              title: "About Mindful Notifier",
              drawerLabel: "About",
              drawerIcon: ({ color, size }: { color: string; size: number }) => (
                <MaterialCommunityIcons
                  name="information"
                  size={size}
                  color={color}
                />
              ),
              headerLeft: () => <BackToHomeButton />,
            }}
          />
          <Drawer.Screen
            name="logs"
            options={{
              title: "Logs",
              drawerLabel: "Logs",
              drawerIcon: ({ color, size }: { color: string; size: number }) => (
                <MaterialCommunityIcons
                  name="file-document-outline"
                  size={size}
                  color={color}
                />
              ),
              drawerItemStyle: { display: "none" },
              headerLeft: () => <BackToHomeButton />,
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
