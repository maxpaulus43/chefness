const { withPodfile } = require("@expo/config-plugins");
const { mergeContents } = require("@expo/config-plugins/build/utils/generateCode");

module.exports = function withIosPodsDeploymentTarget(config) {
  return withPodfile(config, (podfileConfig) => {
    podfileConfig.modResults.contents = mergeContents({
      tag: "chefness-ios-pods-deployment-target",
      src: podfileConfig.modResults.contents,
      anchor: /:ccache_enabled => ccache_enabled\?\(podfile_properties\),/,
      offset: 2,
      comment: "#",
      newSrc: `    # Xcode 27 rejects pod targets below its supported iOS range.
    ios_deployment_target = podfile_properties['ios.deploymentTarget'] || '16.4'
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_configuration|
        build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = ios_deployment_target
      end
    end`,
    }).contents;
    return podfileConfig;
  });
};
