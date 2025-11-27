/**
 * Themes
 */

import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper'

import Colors from '@/src/ui/styles/colors'

// const fonts = configureFonts({ config: { fontFamily: 'NotoSans_400Regular' } })
const fonts = configureFonts()

const BaseLightTheme = {
  ...MD3LightTheme,
  fonts,
}

const BaseDarkTheme = {
  ...MD3DarkTheme,
  fonts,
}

const Themes = {
  light: {
    default: BaseLightTheme,
    orange: {
      ...BaseLightTheme,
      colors: {
        ...BaseLightTheme.colors,
        ...Colors.light.orange,
      },
    },
    red: {
      ...BaseLightTheme,
      colors: {
        ...BaseLightTheme.colors,
        ...Colors.light.red,
      },
    },
    violet: {
      ...BaseLightTheme,
      colors: {
        ...BaseLightTheme.colors,
        ...Colors.light.violet,
      },
    },
    indigo: {
      ...BaseLightTheme,
      colors: {
        ...BaseLightTheme.colors,
        ...Colors.light.indigo,
      },
    },
    blue: {
      ...BaseLightTheme,
      colors: {
        ...BaseLightTheme.colors,
        ...Colors.light.blue,
      },
    },
    teal: {
      ...BaseLightTheme,
      colors: {
        ...BaseLightTheme.colors,
        ...Colors.light.teal,
      },
    },
    cyan: {
      ...BaseLightTheme,
      colors: {
        ...BaseLightTheme.colors,
        ...Colors.light.cyan,
      },
    },
    green: {
      ...BaseLightTheme,
      colors: {
        ...BaseLightTheme.colors,
        ...Colors.light.green,
      },
    },
    sage: {
      ...BaseLightTheme,
      colors: {
        ...BaseLightTheme.colors,
        ...Colors.light.sage,
      },
    },
    olive: {
      ...BaseLightTheme,
      colors: {
        ...BaseLightTheme.colors,
        ...Colors.light.olive,
      },
    },
    brown: {
      ...BaseLightTheme,
      colors: {
        ...BaseLightTheme.colors,
        ...Colors.light.brown,
      },
    },
  },
  dark: {
    default: BaseDarkTheme,
    red: {
      ...BaseDarkTheme,
      colors: {
        ...BaseDarkTheme.colors,
        ...Colors.dark.red,
      },
    },
    orange: {
      ...BaseDarkTheme,
      colors: {
        ...BaseDarkTheme.colors,
        ...Colors.dark.orange,
      },
    },
    violet: {
      ...BaseDarkTheme,
      colors: {
        ...BaseDarkTheme.colors,
        ...Colors.dark.violet,
      },
    },
    indigo: {
      ...BaseDarkTheme,
      colors: {
        ...BaseDarkTheme.colors,
        ...Colors.dark.indigo,
      },
    },
    blue: {
      ...BaseDarkTheme,
      colors: {
        ...BaseDarkTheme.colors,
        ...Colors.dark.blue,
      },
    },
    teal: {
      ...BaseDarkTheme,
      colors: {
        ...BaseDarkTheme.colors,
        ...Colors.dark.teal,
      },
    },
    cyan: {
      ...BaseDarkTheme,
      colors: {
        ...BaseDarkTheme.colors,
        ...Colors.dark.cyan,
      },
    },
    green: {
      ...BaseDarkTheme,
      colors: {
        ...BaseDarkTheme.colors,
        ...Colors.dark.green,
      },
    },
    sage: {
      ...BaseDarkTheme,
      colors: {
        ...BaseDarkTheme.colors,
        ...Colors.dark.sage,
      },
    },
    olive: {
      ...BaseDarkTheme,
      colors: {
        ...BaseDarkTheme.colors,
        ...Colors.dark.olive,
      },
    },
    brown: {
      ...BaseDarkTheme,
      colors: {
        ...BaseDarkTheme.colors,
        ...Colors.dark.brown,
      },
    },
  },
}

export default Themes
