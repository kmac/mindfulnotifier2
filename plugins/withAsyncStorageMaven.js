const { withProjectBuildGradle } = require("@expo/config-plugins");

/**
 * Expo config plugin to add the local Maven repository required by
 * @react-native-async-storage/async-storage 3.x.
 *
 * The storage-android KMP artifact ships in the package's android/local_repo
 * directory but is not published to Maven Central.
 */
module.exports = function withAsyncStorageMaven(config) {
  return withProjectBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    if (contents.includes("async-storage/android/local_repo")) {
      return config;
    }

    const mavenLine = `maven { url "\${rootProject.projectDir}/../node_modules/@react-native-async-storage/async-storage/android/local_repo" }`;

    // Insert a new maven line after the jitpack line in allprojects.repositories
    config.modResults.contents = contents.replace(
      /maven \{ url 'https:\/\/www\.jitpack\.io' \}/,
      `maven { url 'https://www.jitpack.io' }\n    ${mavenLine}`
    );

    return config;
  });
};
