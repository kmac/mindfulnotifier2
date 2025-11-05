const { withAndroidManifest, withGradleProperties } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin to preserve raw resources (MP3 files) in Android builds
 * This ensures sound files are not stripped during the build process
 */

/**
 * Add keep.xml to preserve raw resources
 */
function withKeepXml(config) {
  return withAndroidManifest(config, async (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const resValuesPath = path.join(
      projectRoot,
      'android',
      'app',
      'src',
      'main',
      'res',
      'values'
    );

    // Ensure values directory exists
    if (!fs.existsSync(resValuesPath)) {
      fs.mkdirSync(resValuesPath, { recursive: true });
    }

    // Create keep.xml
    const keepXmlPath = path.join(resValuesPath, 'keep.xml');
    const keepXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:tools="http://schemas.android.com/tools"
    tools:keep="@raw/*,@drawable/rn_edit_text_material" />
`;

    fs.writeFileSync(keepXmlPath, keepXmlContent);
    console.log('✅ Created keep.xml to preserve raw resources');

    return config;
  });
}

/**
 * Modify app/build.gradle to add AAPT options for raw resources
 */
function withAppBuildGradle(config) {
  return withGradleProperties(config, async (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const appBuildGradlePath = path.join(
      projectRoot,
      'android',
      'app',
      'build.gradle'
    );

    if (!fs.existsSync(appBuildGradlePath)) {
      console.warn('⚠️  app/build.gradle not found, skipping modification');
      return config;
    }

    let buildGradleContent = fs.readFileSync(appBuildGradlePath, 'utf8');

    // Check if our modifications already exist
    if (buildGradleContent.includes('// Custom: Preserve MP3 raw resources')) {
      console.log('✅ build.gradle already configured for raw resources');
      return config;
    }

    // Find the androidResources block and modify it
    const androidResourcesRegex = /(androidResources\s*\{[^}]*)(}\s*)/;

    if (androidResourcesRegex.test(buildGradleContent)) {
      // Add noCompress to existing androidResources block
      buildGradleContent = buildGradleContent.replace(
        androidResourcesRegex,
        (match, block, closingBrace) => {
          if (!block.includes('noCompress')) {
            return `${block}\n        // Custom: Preserve MP3 raw resources\n        noCompress 'mp3'\n    ${closingBrace}`;
          }
          return match;
        }
      );
    }

    // Add aaptOptions block after androidResources
    const aaptOptionsBlock = `
    // Custom: Preserve MP3 raw resources
    aaptOptions {
        noCompress 'mp3'
        ignoreAssetsPattern '!.svn:!.git:!.ds_store:!*.scc:.*:!CVS:!thumbs.db:!picasa.ini:!*~'
    }
`;

    // Find a good place to insert aaptOptions (after androidResources closing brace)
    if (!buildGradleContent.includes('aaptOptions {')) {
      const insertAfter = /androidResources\s*\{[^}]*}\s*\n/;
      if (insertAfter.test(buildGradleContent)) {
        buildGradleContent = buildGradleContent.replace(
          insertAfter,
          (match) => match + aaptOptionsBlock
        );
      }
    }

    fs.writeFileSync(appBuildGradlePath, buildGradleContent);
    console.log('✅ Modified app/build.gradle to preserve MP3 resources');

    return config;
  });
}

/**
 * Main plugin function
 */
module.exports = function withRawResourceKeep(config) {
  config = withKeepXml(config);
  config = withAppBuildGradle(config);
  return config;
};
