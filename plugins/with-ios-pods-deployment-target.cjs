const { withPodfile, withXcodeProject } = require("@expo/config-plugins");
const {
  mergeContents,
} = require("@expo/config-plugins/build/utils/generateCode");

const IOS_DEPLOYMENT_TARGET = "16.4";

module.exports = function withIosPodsDeploymentTarget(config) {
  config = withXcodeProject(config, (xcodeConfig) => {
    // Apply this after target-creating plugins so app extensions inherit the
    // same minimum as Expo modules and the main app.
    for (const buildConfig of Object.values(
      xcodeConfig.modResults.pbxXCBuildConfigurationSection(),
    )) {
      if (typeof buildConfig !== "object" || !buildConfig?.buildSettings) {
        continue;
      }
      buildConfig.buildSettings.IPHONEOS_DEPLOYMENT_TARGET =
        IOS_DEPLOYMENT_TARGET;
    }
    return xcodeConfig;
  });

  return withPodfile(config, (podfileConfig) => {
    podfileConfig.modResults.contents = mergeContents({
      tag: "chefness-ios-pods-deployment-target",
      src: podfileConfig.modResults.contents,
      anchor: /:ccache_enabled => ccache_enabled\?\(podfile_properties\),/,
      offset: 2,
      comment: "#",
      newSrc: `    # Xcode 27 rejects pod targets below its supported iOS range.
    ios_deployment_target = podfile_properties['ios.deploymentTarget'] || '${IOS_DEPLOYMENT_TARGET}'
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_configuration|
        build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = ios_deployment_target
      end
    end`,
    }).contents;
    return podfileConfig;
  });
};
