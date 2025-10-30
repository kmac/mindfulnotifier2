import { Stack, useRouter } from "expo-router";
import { Image, Text, View, StyleSheet } from 'react-native';
import { PaperProvider, MD3LightTheme, MD3DarkTheme, IconButton } from 'react-native-paper';
import { useColorScheme } from 'react-native';
import { DrawerToggleButton } from '@react-navigation/drawer';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';

export default function Layout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
  const router = useRouter();

  const BackButton = () => (
    <IconButton
      icon="arrow-left"
      onPress={() => router.push('/')}
    />
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={theme}>
        <Drawer
          screenOptions={{
            drawerPosition: 'left',
          }}
        >
          <Drawer.Screen
            name="index"
            options={{
              drawerLabel: 'Mindful Notifier',
              title: 'Mindful Notifier',
              headerTitle: 'Mindful Notifier',
              headerLeft: () => <DrawerToggleButton />,
            }}
          />
          <Drawer.Screen
            name="schedule"
            options={{
              drawerLabel: 'Schedule',
              title: 'Schedule',
              headerTitle: 'Mindful Notifier - Schedule',
              headerLeft: () => <BackButton />,
            }}
          />
          <Drawer.Screen
            name="reminders"
            options={{
              drawerLabel: 'Reminders',
              title: 'Reminders',
              headerTitle: 'Configure Reminders',
              headerLeft: () => <BackButton />,
            }}
          />
          <Drawer.Screen
            name="sound"
            options={{
              drawerLabel: 'Sound',
              title: 'Sound',
              headerTitle: 'Sound Settings',
              headerLeft: () => <BackButton />,
            }}
          />
          <Drawer.Screen
            name="preferences"
            options={{
              drawerLabel: 'Preferences',
              title: 'Preferences',
              headerTitle: 'App Preferences',
              headerLeft: () => <BackButton />,
            }}
          />
          <Drawer.Screen
            name="about"
            options={{
              drawerLabel: 'About',
              title: 'About',
              headerTitle: 'About Mindful Notifier',
              headerLeft: () => <BackButton />,
            }}
          />
        </Drawer>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}


// export default function RootLayout() {
//   return (
//     <Stack style={styles.container}
//       screenOptions={{
//         headerStyle: {
//           backgroundColor: "#0087ff",
//         },
//         headerTintColor: "#fff",
//         headerTitleStyle: {
//           fontWeight: "bold",
//         },
//       }}
//     >
//       <Stack.Screen
//         name="index"
//         options={{ title: "Mindful Notifier", headerShown: true }}
//       />
//     </Stack>
//   );
// }
//
// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   // image: {
//   //   width: 50,
//   //   height: 50,
//   // },
// });
//

