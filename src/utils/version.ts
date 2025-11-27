import * as Application from "expo-application";
import { Platform } from "react-native";
import Constants from "expo-constants";

export interface VersionInfo {
  version: string;
  buildNumber: string;
  bundleId: string;
  platform: string;
  formattedVersion: string;
}

export class VersionManager {
  private static instance: VersionManager;
  private versionInfo: VersionInfo | null = null;

  private constructor() {}

  public static getInstance(): VersionManager {
    if (!VersionManager.instance) {
      VersionManager.instance = new VersionManager();
    }
    return VersionManager.instance;
  }

  /**
   * Gets comprehensive version information for the app
   */
  public async getVersionInfo(): Promise<VersionInfo> {
    if (this.versionInfo) {
      return this.versionInfo;
    }

    let version: string;
    let buildNumber: string;
    let bundleId: string;

    if (Platform.OS === "web") {
      // For web, get version from Constants which reads from app.json/package.json
      //console.log(`expoConfig: ${Constants.expoConfig?.version}`)
      version =
        Constants.expoConfig?.version ||
        "1.0.0";
      buildNumber =
        Constants.expoConfig?.web?.buildNumber?.toString() ||
        "1";
      bundleId =
        Constants.expoConfig?.web?.bundleIdentifier ||
        Constants.expoConfig?.slug ||
        "com.pbsessions.app";
    } else {
      // For native platforms, use Application API
      version = Application.nativeApplicationVersion || "1.0.0";
      buildNumber = Application.nativeBuildVersion || "1";
      bundleId = Application.applicationId || "com.kmac5dev.pbsessions";
    }

    const platform = Platform.OS;
    const formattedVersion = `${version} (${buildNumber})`;

    this.versionInfo = {
      version,
      buildNumber,
      bundleId,
      platform,
      formattedVersion,
    };

    return this.versionInfo;
  }

  /**
   * Gets just the version string (e.g., "1.2.3")
   */
  public async getVersion(): Promise<string> {
    const info = await this.getVersionInfo();
    return info.version;
  }

  /**
   * Gets just the build number
   */
  public async getBuildNumber(): Promise<string> {
    const info = await this.getVersionInfo();
    return info.buildNumber;
  }

  /**
   * Gets formatted version string (e.g., "1.2.3 (45)")
   */
  public async getFormattedVersion(): Promise<string> {
    const info = await this.getVersionInfo();
    return info.formattedVersion;
  }

  /**
   * Gets the platform-specific app name
   */
  public async getAppName(): Promise<string> {
    if (Platform.OS === "web") {
      return (
        Constants.expoConfig?.name || "PB Sessions"
      );
    }
    return Application.applicationName || "PB Sessions";
  }

  /**
   * Compares current version with another version string
   * Returns: -1 if current < other, 0 if equal, 1 if current > other
   */
  public async compareVersion(otherVersion: string): Promise<number> {
    const currentVersion = await this.getVersion();
    // console.log(`currentVersion: ${currentVersion}`)
    return this.compareVersionStrings(currentVersion, otherVersion);
  }

  /**
   * Checks if current version is newer than the provided version
   */
  public async isNewerThan(otherVersion: string): Promise<boolean> {
    const comparison = await this.compareVersion(otherVersion);
    return comparison > 0;
  }

  /**
   * Checks if current version is older than the provided version
   */
  public async isOlderThan(otherVersion: string): Promise<boolean> {
    const comparison = await this.compareVersion(otherVersion);
    return comparison < 0;
  }

  /**
   * Helper method to compare two version strings
   */
  private compareVersionStrings(version1: string, version2: string): number {
    const v1Parts = version1.split(".").map(Number);
    const v2Parts = version2.split(".").map(Number);

    const maxLength = Math.max(v1Parts.length, v2Parts.length);

    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part < v2Part) return -1;
      if (v1Part > v2Part) return 1;
    }

    return 0;
  }

  /**
   * Gets platform-specific build information
   */
  public async getBuildInfo(): Promise<{
    platform: string;
    buildDate?: string;
    buildHash?: string;
  }> {
    const platform = Platform.OS;

    if (Platform.OS === "web") {
      // For web, we can include build timestamp from Constants
      return {
        platform,
        buildDate: Constants.expoConfig?.extra?.buildDate,
        buildHash: Constants.expoConfig?.extra?.buildHash,
      };
    }

    return { platform };
  }

  /**
   * Clears cached version info (useful for testing)
   */
  public clearCache(): void {
    this.versionInfo = null;
  }
}

// Export a default instance for convenience
export const versionManager = VersionManager.getInstance();
