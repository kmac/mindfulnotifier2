const { withGradleProperties } = require("@expo/config-plugins");

/**
 * Expo config plugin to increase JVM heap and metaspace for Gradle builds.
 * SDK 55 native compilation requires more memory than the default 512 MiB metaspace.
 */
module.exports = function withGradleJvmArgs(config) {
  return withGradleProperties(config, (config) => {
    const props = config.modResults;

    // Find and update org.gradle.jvmargs, or add it if missing
    const idx = props.findIndex(
      (item) => item.type === "property" && item.key === "org.gradle.jvmargs"
    );

    const value = "-Xmx4096m -XX:MaxMetaspaceSize=1024m";

    if (idx >= 0) {
      props[idx].value = value;
    } else {
      props.push({ type: "property", key: "org.gradle.jvmargs", value });
    }

    return config;
  });
};
