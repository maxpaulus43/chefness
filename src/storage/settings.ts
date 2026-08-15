import type { StorageRepository } from "@/storage/interface";
import type { Settings, CreateSettingsInput, UpdateSettingsInput } from "@/types/settings";
import { IndexedDBRepository } from "@/storage/indexed-db";
import { FirestoreRepository } from "@/storage/firestore";
import { firebaseAuth } from "@/lib/firebase";

export type SettingsRepository = StorageRepository<
  Settings,
  CreateSettingsInput,
  UpdateSettingsInput
>;

export const SETTINGS_SINGLETON_ID = "user-settings";
const CLOUD_SETTINGS_ID = "app";

interface CloudSettings {
  id: string;
  llmProvider: string;
  llmModel: string;
  dietaryRestrictions: string[];
  otherDietaryNotes: string;
  createdAt: string;
  updatedAt: string;
}

type CreateCloudSettings = Omit<CloudSettings, "id" | "createdAt" | "updatedAt">;
type UpdateCloudSettings = Partial<CreateCloudSettings> & { id: string };

interface LocalCredentials {
  id: string;
  llmApiKey: string;
  openRouterOAuthKey: string;
  createdAt: string;
  updatedAt: string;
}

type CreateLocalCredentials = Pick<LocalCredentials, "id" | "llmApiKey" | "openRouterOAuthKey">;
type UpdateLocalCredentials = Partial<Omit<CreateLocalCredentials, "id">> & { id: string };

function buildSettings(data: CreateSettingsInput): Settings {
  const now = new Date().toISOString();
  return {
    id: SETTINGS_SINGLETON_ID,
    llmProvider: data.llmProvider,
    llmModel: data.llmModel,
    llmApiKey: data.llmApiKey,
    openRouterOAuthKey: data.openRouterOAuthKey,
    dietaryRestrictions: data.dietaryRestrictions,
    otherDietaryNotes: data.otherDietaryNotes,
    createdAt: now,
    updatedAt: now,
  };
}

function applySettingsUpdate(existing: Settings, data: UpdateSettingsInput): Settings {
  const { id: _, ...patch } = data;
  return {
    ...existing,
    ...(patch.llmProvider !== undefined && { llmProvider: patch.llmProvider }),
    ...(patch.llmModel !== undefined && { llmModel: patch.llmModel }),
    ...(patch.llmApiKey !== undefined && { llmApiKey: patch.llmApiKey }),
    ...(patch.openRouterOAuthKey !== undefined && { openRouterOAuthKey: patch.openRouterOAuthKey }),
    ...(patch.dietaryRestrictions !== undefined && { dietaryRestrictions: patch.dietaryRestrictions }),
    ...(patch.otherDietaryNotes !== undefined && { otherDietaryNotes: patch.otherDietaryNotes }),
    updatedAt: new Date().toISOString(),
  };
}

const guestRepository = new IndexedDBRepository<Settings, CreateSettingsInput, UpdateSettingsInput>({
  storeName: "settings",
  buildEntity: buildSettings,
  applyUpdate: applySettingsUpdate,
});

const cloudRepository = new FirestoreRepository<
  CloudSettings,
  CreateCloudSettings,
  UpdateCloudSettings
>({
  collectionName: "settings",
  buildEntity: (data) => {
    const now = new Date().toISOString();
    return { id: CLOUD_SETTINGS_ID, ...data, createdAt: now, updatedAt: now };
  },
  applyUpdate: (existing, data) => {
    const { id: _, ...patch } = data;
    return { ...existing, ...patch, updatedAt: new Date().toISOString() };
  },
});

const credentialRepository = new IndexedDBRepository<
  LocalCredentials,
  CreateLocalCredentials,
  UpdateLocalCredentials
>({
  storeName: "local-credentials",
  buildEntity: (data) => {
    const now = new Date().toISOString();
    return { ...data, createdAt: now, updatedAt: now };
  },
  applyUpdate: (existing, data) => ({
    ...existing,
    ...(data.llmApiKey !== undefined && { llmApiKey: data.llmApiKey }),
    ...(data.openRouterOAuthKey !== undefined && { openRouterOAuthKey: data.openRouterOAuthKey }),
    updatedAt: new Date().toISOString(),
  }),
});

function credentialId(uid: string): string {
  return `firebase:${uid}`;
}

function cloudFields(settings: Settings | CreateSettingsInput): CreateCloudSettings {
  return {
    llmProvider: settings.llmProvider,
    llmModel: settings.llmModel,
    dietaryRestrictions: settings.dietaryRestrictions,
    otherDietaryNotes: settings.otherDietaryNotes,
  };
}

export async function saveLocalCredentialsForUid(
  uid: string,
  llmApiKey: string,
  openRouterOAuthKey: string,
): Promise<void> {
  const id = credentialId(uid);
  const existing = await credentialRepository.getById(id);
  if (existing) {
    await credentialRepository.update({ id, llmApiKey, openRouterOAuthKey });
  } else {
    await credentialRepository.create({ id, llmApiKey, openRouterOAuthKey });
  }
}

class HybridSettingsRepository implements SettingsRepository {
  private uid(): string | null {
    return firebaseAuth.currentUser?.uid ?? null;
  }

  async getAll(): Promise<Settings[]> {
    const settings = await this.getById(SETTINGS_SINGLETON_ID);
    return settings ? [settings] : [];
  }

  async getById(id: string): Promise<Settings | undefined> {
    if (id !== SETTINGS_SINGLETON_ID) return undefined;
    const uid = this.uid();
    if (!uid) return guestRepository.getById(id);

    const cloud = await cloudRepository.getById(CLOUD_SETTINGS_ID);
    if (!cloud) return undefined;
    const credentials = await credentialRepository.getById(credentialId(uid));

    return {
      id: SETTINGS_SINGLETON_ID,
      llmProvider: cloud.llmProvider,
      llmModel: cloud.llmModel,
      llmApiKey: credentials?.llmApiKey ?? "",
      openRouterOAuthKey: credentials?.openRouterOAuthKey ?? "",
      dietaryRestrictions: cloud.dietaryRestrictions,
      otherDietaryNotes: cloud.otherDietaryNotes,
      createdAt: cloud.createdAt,
      updatedAt: cloud.updatedAt,
    };
  }

  async create(data: CreateSettingsInput): Promise<Settings> {
    const uid = this.uid();
    if (!uid) return guestRepository.create(data);

    const cloud = await cloudRepository.create(cloudFields(data));
    await saveLocalCredentialsForUid(uid, data.llmApiKey, data.openRouterOAuthKey);
    return {
      id: SETTINGS_SINGLETON_ID,
      ...cloudFields(data),
      llmApiKey: data.llmApiKey,
      openRouterOAuthKey: data.openRouterOAuthKey,
      createdAt: cloud.createdAt,
      updatedAt: cloud.updatedAt,
    };
  }

  async update(data: UpdateSettingsInput): Promise<Settings | undefined> {
    const uid = this.uid();
    if (!uid) return guestRepository.update(data);

    const existing = await this.getById(SETTINGS_SINGLETON_ID);
    if (!existing) return undefined;
    const updated = applySettingsUpdate(existing, data);
    await cloudRepository.update({ id: CLOUD_SETTINGS_ID, ...cloudFields(updated) });
    await saveLocalCredentialsForUid(uid, updated.llmApiKey, updated.openRouterOAuthKey);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    if (id !== SETTINGS_SINGLETON_ID) return false;
    const uid = this.uid();
    if (!uid) return guestRepository.delete(id);

    const deleted = await cloudRepository.delete(CLOUD_SETTINGS_ID);
    await credentialRepository.delete(credentialId(uid));
    return deleted;
  }
}

export const settingsRepository: SettingsRepository = new HybridSettingsRepository();
