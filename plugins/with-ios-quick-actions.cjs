const { withInfoPlist } = require("@expo/config-plugins");

// Home Screen quick actions (long-press app icon). Types must match the
// mapping in plugins/with-ios-scene-lifecycle.cjs, which turns each action
// into a chefness:// deep link.
const QUICK_ACTIONS = [
  {
    UIApplicationShortcutItemType: "new-chat",
    UIApplicationShortcutItemTitle: "New Chat",
    UIApplicationShortcutItemSubtitle: "Start a fresh conversation",
    UIApplicationShortcutItemIconType: "UIApplicationShortcutIconTypeCompose",
  },
  {
    UIApplicationShortcutItemType: "recipes",
    UIApplicationShortcutItemTitle: "Recipes",
    UIApplicationShortcutItemIconSymbolName: "book",
  },
  {
    UIApplicationShortcutItemType: "history",
    UIApplicationShortcutItemTitle: "Cooking History",
    UIApplicationShortcutItemIconSymbolName: "clock",
  },
  {
    UIApplicationShortcutItemType: "settings",
    UIApplicationShortcutItemTitle: "Settings",
    UIApplicationShortcutItemIconSymbolName: "gearshape",
  },
];

module.exports = function withIosQuickActions(config) {
  return withInfoPlist(config, (infoPlistConfig) => {
    infoPlistConfig.modResults.UIApplicationShortcutItems = QUICK_ACTIONS;
    return infoPlistConfig;
  });
};
