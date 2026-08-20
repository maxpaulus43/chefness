import { getStateFromPath } from "@react-navigation/core";
import type {
  LinkingOptions,
  NavigatorScreenParams,
} from "@react-navigation/native";

// React Navigation requires exact type aliases rather than open interfaces.
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type ChatStackParamList = {
  Chat: { sessionId?: string } | undefined;
  ChatHistory: undefined;
};

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type RecipesStackParamList = {
  RecipeList: undefined;
  RecipeDetail: { recipeId: string };
  RecipeEdit: { recipeId: string };
};

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type SettingsStackParamList = {
  Settings: undefined;
  ModelSelection: undefined;
};

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type RootTabParamList = {
  ChatTab: NavigatorScreenParams<ChatStackParamList> | undefined;
  RecipesTab: NavigatorScreenParams<RecipesStackParamList> | undefined;
  HistoryTab: undefined;
  SettingsTab: NavigatorScreenParams<SettingsStackParamList> | undefined;
};

const config: NonNullable<LinkingOptions<RootTabParamList>["config"]> = {
  screens: {
    ChatTab: {
      initialRouteName: "Chat",
      screens: { Chat: "chats/:sessionId?" },
    },
    RecipesTab: {
      initialRouteName: "RecipeList",
      screens: {
        RecipeList: "recipes",
        RecipeDetail: "recipes/:recipeId",
        RecipeEdit: "recipes/:recipeId/edit",
      },
    },
    HistoryTab: "history",
    SettingsTab: {
      initialRouteName: "Settings",
      screens: { Settings: "settings", ModelSelection: "settings/models" },
    },
  },
};

const tabNames: (keyof RootTabParamList)[] = [
  "ChatTab",
  "RecipesTab",
  "HistoryTab",
  "SettingsTab",
];
const getCompleteTabState: NonNullable<
  LinkingOptions<RootTabParamList>["getStateFromPath"]
> = (path) => {
  const parsed = getStateFromPath(path, config);
  const target = parsed?.routes[0];
  if (!parsed || !target) return parsed;
  const index = tabNames.indexOf(target.name as keyof RootTabParamList);
  if (index < 0) return parsed;
  return {
    ...parsed,
    index,
    routes: tabNames.map((name) => (name === target.name ? target : { name })),
  };
};

export const linking: LinkingOptions<RootTabParamList> = {
  prefixes: ["chefness://"],
  config,
  getStateFromPath: getCompleteTabState,
};
