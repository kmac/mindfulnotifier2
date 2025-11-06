# Agent Configuration

## Project Overview - Technology

This is an Expo react native TypeScript project using redux for storage, and testing with Jest.

### Development Commands
- **Development**: `npm start` (Expo dev server), `npm run web` (web version)
    - `npx expo start -d` - Start development server
    - `npm expo export --platform web` - Export static site for production
- **Build**: Use Expo CLI commands for platform-specific builds
- **Test**: `npm run test` (all tests), `npm run test:watch` (watch mode), `npm run test:coverage` (with coverage)
- **Test single file**: `npm test -- src/services/__tests__/sessionService.test.ts`

## Commands

### Code Style
- **TypeScript**: Strict mode enabled, use proper typing for all functions and interfaces
    - Use TypeScript for all new files
- **Style**: Follow existing naming conventions (camelCase for variables, PascalCase for components)
    - Prefer const assertions and strict typing
- **Imports**: Use `@/` for root imports, `src/` for src-relative imports
- **Components**: Export default functions, use PascalCase naming
    - Use functional components with hooks
- **State**: Use Redux Toolkit with createSlice, follow existing slice patterns
- **Formatting**: Use double quotes, prefer function declarations over arrows for components

### Error Handling
- Use try-catch for async operations
- Proper TypeScript error types
- Redux error state management in slices

### File Structure
- Expo top-level app structure in `src/app`
- Components in `src/components/`
- Utilities in `src/utils/`
- Types in `src/types/`
- Storage (redux) in `src/store/`

### Dependencies
- Prefer built-in browser APIs when possible
- Always check if dependency already exists before adding new ones
- Use exact versions in package.json

### Testing
- Jest with React Native preset
- Tests are under `__tests__/` folders in `*.test.ts` files
- Use React Testing Library for component tests
- Coverage reports available with `npm run test:coverage`
- Mock external dependencies
- Aim for 80%+ test coverage


## Application Overview

This project is a new cross-platform (web/android/ios) application using the react-native expo framework.

The app is called "Mindful Notifier" and its intent is to provide a background notification service which schedules
reminder notifications (either periodical or random) which remind the user to be mindful. There is an associated bell
that is run when the reminder is triggered.  The notifications are local notifications.

Note: the "ios" funcationaly is not yet a focus.  Ignore it for the most part; for now we are focussing on android and
web functionality.


Sections:

The app consists of the following main areas.

- Mindful Notifier (main screen)
    - Shows the current mindful notification content.
    - Allows basic operations: enable/disable, mute, vibrate.
    - Starting path: `src/app/index.tsx`
- Schedule:
    - Provide the options for scheduling notifications.
    - Peridical, or random (within a given range of times)
    - Quiet hours, where no notifications are produced
    - Starting path: `src/app/schedule.tsx`
- Reminders:
    - Manage the user's list of reminders.
    - These reminders are stored in redux.
    - Provide an export/import function for JSON format.
    - Starting path: `src/app/reminders.tsx`
- Sound:
    - Manage sound settings
    - Choice of bell sounds
    - Starting path: `src/app/sound.tsx`
- Preferences
    - for app configuration, help/about, etc
    - Starting path: `src/app/preferences.tsx`
