/**
 * Notification configuration types
 * Separated from implementation to allow testing without loading native modules
 */

/**
 * Notification configuration interface
 */
export interface NotificationConfig {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: boolean;
  badge?: number; // Badge count for app icon
}
