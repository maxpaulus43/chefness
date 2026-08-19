const { IOSConfig, withAppDelegate } = require("@expo/config-plugins");

const sceneDelegate = `internal import Expo
import React

/// Owns the application window on iOS 27 and later, where UIKit requires the
/// scene-based lifecycle for apps built with the current SDK.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    factory.startReactNative(withModuleName: "main", in: window, launchOptions: nil)
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      _ = RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
  }
}
`;

module.exports = function withIosSceneLifecycle(config) {
  config = IOSConfig.XcodeProjectFile.withBuildSourceFile(config, {
    filePath: "SceneDelegate.swift",
    contents: sceneDelegate,
    overwrite: true,
  });

  return withAppDelegate(config, (appDelegateConfig) => {
    const source = appDelegateConfig.modResults.contents;
    const legacyWindowSetup = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

`;
    if (source.includes(legacyWindowSetup)) {
      appDelegateConfig.modResults.contents = source.replace(
        legacyWindowSetup,
        "    // The UISceneDelegate owns the window on current iOS SDKs.\n",
      );
    }
    return appDelegateConfig;
  });
};
