const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# [withMinIosDeploymentTarget] forced minimum deployment target';

// A handful of third-party pods' resource-bundle sub-targets (RevenueCat,
// RNCAsyncStorage, RNSVG as of this writing) ship a podspec-level deployment
// target below 15.0, which react_native_post_install's own normalization
// doesn't touch. Recent Xcode SDKs no longer support anything under iOS 15,
// so `pod install` fails outright without this — see the post_install hook
// this appends for the actual fix. `expo prebuild` regenerates ios/Podfile
// from scratch every time, so the fix has to be injected here rather than
// hand-edited directly in ios/Podfile.
function withMinIosDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (contents.includes(MARKER)) return config;

      const snippet = `
    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        deployment_target = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if deployment_target && deployment_target.to_f < 15.1
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
        end
      end
    end`;

      // Lazy match stops at the first "\n  end" (two-space indent) after
      // "post_install do |installer|" — that's the line closing this block,
      // since the outer "target 'UlamHub' do ... end" closes with a
      // zero-indent "end" instead.
      const postInstallEndPattern = /(post_install do \|installer\|[\s\S]*?\n)(  end)/;
      if (!postInstallEndPattern.test(contents)) {
        throw new Error('withMinIosDeploymentTarget: could not find post_install block in ios/Podfile to patch.');
      }
      contents = contents.replace(postInstallEndPattern, `$1${snippet}\n$2`);
      fs.writeFileSync(podfilePath, contents);
      return config;
    },
  ]);
}

module.exports = withMinIosDeploymentTarget;
