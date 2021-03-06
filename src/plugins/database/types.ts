import { StoreObject } from '@/shared-types';

export type ChangeCb<T> = (obj: T) => unknown;
export type DeleteCb = (id: string) => unknown;

export interface EventHandler<T = StoreObject> {
  id: string;
  onChanged: ChangeCb<T>;
  onDeleted: DeleteCb;
}

export interface BrewbloxDatabase {

  /**
   * Connect to actual database.
   * Is called by App.vue during create
   */
  connect(): Awaitable<void>;

  /**
   * Be notified of external changes to a collection.
   *
   * @param handler Object containing callbacks
   */
  subscribe(handler: EventHandler): void;

  /**
   * Fetch all documents from the collection where ID is `moduleId`
   *
   * @param moduleId collection identifier.
   */
  fetchAll<T extends StoreObject>(moduleId: string): Promise<T[]>;

  /**
   * Fetch a single document.
   *
   * @param moduleId collection ID.
   * @param objId unique document ID.
   */
  fetchById<T extends StoreObject>(moduleId: string, objId: string): Promise<T>;

  /**
   * Save a new document to the store.
   *
   * @param moduleId collection ID.
   * @param obj document. Its ID should be unique.
   */
  create<T extends StoreObject>(moduleId: string, obj: T): Promise<T>;

  /**
   * Save an already created document.
   *
   * @param moduleId collection ID.
   * @param obj existing document in the database.
   */
  persist<T extends StoreObject>(moduleId: string, obj: T): Promise<T>;

  /**
   * Remove an existing document from the store.
   *
   * @param moduleId collection ID.
   * @param obj existing document in the database.
   */
  remove<T extends StoreObject>(moduleId: string, obj: T): Promise<T>;
}
