import { AppRegistry } from "react-native";
import ShareExtensionScreen from "./src/native/ShareExtensionScreen";

// The first argument must be "shareExtension" (expo-share-extension contract).
AppRegistry.registerComponent("shareExtension", () => ShareExtensionScreen);
