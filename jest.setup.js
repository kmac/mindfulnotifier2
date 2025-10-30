/**
 * Jest setup file for Mindful Notifier
 *
 * This file runs after the jest-expo preset setup to add additional
 * configuration needed for our tests to run properly.
 */

// Mock the Expo winter runtime modules that use import.meta
jest.mock('expo/src/winter/ImportMetaRegistry', () => ({
  ImportMetaRegistry: {
    url: null,
  },
}));

jest.mock('expo/src/utils/getBundleUrl', () => ({
  getBundleUrl: jest.fn(() => null),
}));

// Mock the winter runtime entirely to avoid import.meta issues
jest.mock('expo/src/winter/runtime.native', () => ({}));

// Provide structuredClone polyfill for Jest environment
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj) => {
    return JSON.parse(JSON.stringify(obj));
  };
}

// Suppress console warnings during tests (optional - remove if you want to see warnings)
global.console = {
  ...console,
  // Uncomment to suppress specific console methods during tests
  // warn: jest.fn(),
  // error: jest.fn(),
};
