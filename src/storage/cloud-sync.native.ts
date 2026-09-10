import { requireNativeModule } from "expo";
import { nativeLibrary } from "@/storage/indexed-db.native";
import {
  CloudSyncService,
  type CloudTransport,
} from "@/storage/cloud-sync-service";

const transport = requireNativeModule<
  CloudTransport & {
    addListener(
      event: "accountChanged",
      listener: () => void,
    ): { remove(): void };
  }
>("ChefnessCloud");
export const cloudSync = new CloudSyncService(nativeLibrary, transport);
transport.addListener("accountChanged", () => cloudSync.accountChanged());
