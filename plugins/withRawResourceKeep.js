const { withAndroidManifest, withGradleProperties, AndroidConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin to preserve raw resources (MP3 files) in Android builds
 * This ensures sound files are not stripped during the build process
 */

/**
 * Copy MP3 files from assets to res/raw
 * This ensures they're included in EAS builds
 */
function withCopySoundFiles(config) {
  return withAndroidManifest(config, async (config) => {
    const projectRoot = config.modRequest.projectRoot;

    // Source: assets/sounds/
    const sourceSoundsDir = path.join(projectRoot, 'assets', 'sounds');

    // Destination: android/app/src/main/res/raw/
    const destRawDir = path.join(
      projectRoot,
      'android',
      'app',
      'src',
      'main',
      'res',
      'raw'
    );

    // Ensure destination directory exists
    if (!fs.existsSync(destRawDir)) {
      fs.mkdirSync(destRawDir, { recursive: true });
    }

    // List of sound files to copy
    const soundFiles = [
      'bell_inside.mp3',
      'bowl_struck.mp3',
      'ding_soft.mp3',
      'tibetan_bell_ding_b.mp3',
      'zenbell_1.mp3'
    ];

    // Copy each file
    let copiedCount = 0;
    for (const soundFile of soundFiles) {
      const sourcePath = path.join(sourceSoundsDir, soundFile);
      const destPath = path.join(destRawDir, soundFile);

      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        copiedCount++;
      } else {
        console.warn(`⚠️  Sound file not found: ${sourcePath}`);
      }
    }

    console.log(`✅ Copied ${copiedCount} sound files to res/raw/`);

    return config;
  });
}

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

    // Also create xml/keep.xml for resource shrinking
    const resXmlPath = path.join(
      projectRoot,
      'android',
      'app',
      'src',
      'main',
      'res',
      'xml'
    );

    if (!fs.existsSync(resXmlPath)) {
      fs.mkdirSync(resXmlPath, { recursive: true });
    }

    const xmlKeepPath = path.join(resXmlPath, 'keep.xml');
    const xmlKeepContent = `<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:tools="http://schemas.android.com/tools"
    tools:shrinkMode="strict"
    tools:keep="@raw/*,@drawable/*" />
`;
    fs.writeFileSync(xmlKeepPath, xmlKeepContent);
    console.log('✅ Created xml/keep.xml for resource shrinking');

    // Note: We do NOT create raw_sounds.xml because files in res/raw/ are automatically
    // registered as resources by Android. Creating explicit <item> declarations would
    // cause duplicate resource errors.

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
  // Step 1: Copy sound files from assets to res/raw (must happen first!)
  config = withCopySoundFiles(config);

  // Step 2: Create keep.xml files to prevent resource stripping
  config = withKeepXml(config);

  // Step 3: Modify build.gradle to add AAPT options
  config = withAppBuildGradle(config);

  return config;
};
