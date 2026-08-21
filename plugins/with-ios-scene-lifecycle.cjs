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

    // Home Screen quick actions arrive on the scene under modern iOS, not
    // UIApplication launchOptions. Open them as chefness:// deep links so
    // React Navigation linking can resolve them (including cold start via
    // RCTLinkingManager's pending initial URL).
    if let shortcutItem = connectionOptions.shortcutItem,
       let url = Self.deepLink(for: shortcutItem) {
      _ = RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
    }

    for context in connectionOptions.urlContexts {
      _ = RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
    }
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

  func windowScene(
    _ windowScene: UIWindowScene,
    performActionFor shortcutItem: UIApplicationShortcutItem,
    completionHandler: @escaping (Bool) -> Void
  ) {
    if let url = Self.deepLink(for: shortcutItem) {
      _ = RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
      completionHandler(true)
      return
    }
    completionHandler(false)
  }

  /// Maps Home Screen quick-action types (Info.plist) to chefness:// destinations.
  private static func deepLink(for item: UIApplicationShortcutItem) -> URL? {
    switch item.type {
    case "new-chat":
      // Fresh timestamp so repeated New Chat shortcuts always clear the session.
      let newTs = Int(Date().timeIntervalSince1970 * 1000)
      return URL(string: "chefness://chats?newTs=\\(newTs)")
    case "recipes":
      return URL(string: "chefness://recipes")
    case "history":
      return URL(string: "chefness://history")
    case "settings":
      return URL(string: "chefness://settings")
    default:
      return nil
    }
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
