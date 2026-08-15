import { FirebaseError } from "firebase/app";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  setDoc,
  type DocumentReference,
  type Query,
} from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";
import type { StorageRepository } from "@/storage/interface";

interface FirestoreRepositoryOptions<
  TEntity extends { id: string },
  TCreate,
  TUpdate extends { id: string },
> {
  collectionName: string;
  buildEntity: (data: TCreate) => TEntity;
  applyUpdate: (existing: TEntity, data: TUpdate) => TEntity;
  validateEntity?: (entity: TEntity) => void;
}

function requireUid(): string {
  const uid = firebaseAuth.currentUser?.uid;
  if (!uid) throw new Error("Sign in before accessing cloud data.");
  return uid;
}

function canUseCacheFallback(cause: unknown): boolean {
  return !navigator.onLine ||
    (cause instanceof FirebaseError &&
      (cause.code === "unavailable" || cause.code === "deadline-exceeded"));
}

async function readOne<TEntity>(reference: DocumentReference): Promise<TEntity | undefined> {
  try {
    const snapshot = await getDoc(reference);
    return snapshot.exists() ? snapshot.data() as TEntity : undefined;
  } catch (cause) {
    if (!canUseCacheFallback(cause)) throw cause;
    const snapshot = await getDocFromCache(reference);
    return snapshot.exists() ? snapshot.data() as TEntity : undefined;
  }
}

async function readMany<TEntity>(query: Query): Promise<TEntity[]> {
  try {
    const snapshot = await getDocs(query);
    return snapshot.docs.map((item) => item.data() as TEntity);
  } catch (cause) {
    if (!canUseCacheFallback(cause)) throw cause;
    const snapshot = await getDocsFromCache(query);
    return snapshot.docs.map((item) => item.data() as TEntity);
  }
}

export class FirestoreRepository<
  TEntity extends { id: string },
  TCreate,
  TUpdate extends { id: string },
> implements StorageRepository<TEntity, TCreate, TUpdate> {
  private readonly collectionName: string;
  private readonly buildEntity: (data: TCreate) => TEntity;
  private readonly applyUpdate: (existing: TEntity, data: TUpdate) => TEntity;
  private readonly validateEntity?: (entity: TEntity) => void;

  constructor(options: FirestoreRepositoryOptions<TEntity, TCreate, TUpdate>) {
    this.collectionName = options.collectionName;
    this.buildEntity = options.buildEntity;
    this.applyUpdate = options.applyUpdate;
    this.validateEntity = options.validateEntity;
  }

  async getAll(): Promise<TEntity[]> {
    return readMany<TEntity>(collection(firebaseDb, "users", requireUid(), this.collectionName));
  }

  async getById(id: string): Promise<TEntity | undefined> {
    return readOne<TEntity>(doc(firebaseDb, "users", requireUid(), this.collectionName, id));
  }

  async create(data: TCreate): Promise<TEntity> {
    const entity = this.buildEntity(data);
    this.validateEntity?.(entity);
    await setDoc(
      doc(firebaseDb, "users", requireUid(), this.collectionName, entity.id),
      entity,
    );
    return entity;
  }

  async update(data: TUpdate): Promise<TEntity | undefined> {
    const existing = await this.getById(data.id);
    if (!existing) return undefined;
    const updated = this.applyUpdate(existing, data);
    this.validateEntity?.(updated);
    await setDoc(
      doc(firebaseDb, "users", requireUid(), this.collectionName, updated.id),
      updated,
    );
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const reference = doc(firebaseDb, "users", requireUid(), this.collectionName, id);
    const existing = await readOne<TEntity>(reference);
    if (!existing) return false;
    await deleteDoc(reference);
    return true;
  }
}
