import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

type PathRef = {
  kind: 'doc' | 'collection' | 'query';
  path: string[];
  filters?: QueryFilter[];
};

type QueryFilter = {
  field: string;
  operator: '==';
  value: unknown;
};

type SetOptions = {
  merge?: boolean;
};

type SnapshotDocument = {
  id: string;
  data: () => any;
  exists: () => boolean;
};

type QuerySnapshot = {
  docs: SnapshotDocument[];
};

type DocumentSnapshot = SnapshotDocument;

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

let cachedUser: User | null = null;

function mapAuthUser(user: SupabaseUser | null): User | null {
  if (!user) return null;

  return {
    uid: user.id,
    email: user.email ?? null,
    displayName:
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email?.split('@')[0] ??
      null,
    photoURL:
      user.user_metadata?.avatar_url ??
      user.user_metadata?.picture ??
      null,
  };
}

export const auth = {
  get currentUser(): User | null {
    return cachedUser;
  },
  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    cachedUser = null;
  },
};

export const db = {};
export const googleProvider = { provider: 'google' as const };

export async function signInWithPopup(
  _auth: typeof auth,
  _provider: typeof googleProvider,
): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });

  if (error) throw error;
}

export function onAuthStateChanged(
  _auth: typeof auth,
  callback: (user: User | null) => void,
): () => void {
  let active = true;

  supabase.auth.getUser().then(({ data, error }) => {
    if (!active) return;
    if (error) {
      cachedUser = null;
      callback(null);
      return;
    }

    cachedUser = mapAuthUser(data.user);
    callback(cachedUser);
  });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!active) return;
    cachedUser = mapAuthUser(session?.user ?? null);
    callback(cachedUser);
  });

  return () => {
    active = false;
    subscription.unsubscribe();
  };
}

function buildPath(first: unknown, segments: string[]): string[] {
  if (isPathRef(first)) {
    return [...first.path, ...segments];
  }
  return segments;
}

function isPathRef(value: unknown): value is PathRef {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'kind' in value &&
      'path' in value,
  );
}

export function doc(first: unknown, ...segments: string[]): PathRef {
  return {
    kind: 'doc',
    path: buildPath(first, segments),
  };
}

export function collection(first: unknown, ...segments: string[]): PathRef {
  return {
    kind: 'collection',
    path: buildPath(first, segments),
  };
}

export function where(
  field: string,
  operator: '==',
  value: unknown,
): QueryFilter {
  if (operator !== '==') {
    throw new Error(`Unsupported Supabase compatibility operator: ${operator}`);
  }
  return { field, operator, value };
}

export function query(ref: PathRef, ...filters: QueryFilter[]): PathRef {
  return {
    ...ref,
    kind: 'query',
    filters,
  };
}

type Descriptor = {
  table: 'profiles' | 'groups' | 'chat_sessions' | 'chat_messages' | 'legacy_chats';
  id?: string;
  implicitFilters: Array<{ column: string; value: unknown }>;
};

function describe(ref: PathRef): Descriptor {
  const path = ref.path;

  if (path[0] === 'users') {
    return {
      table: 'profiles',
      id: path[1],
      implicitFilters: path[1] ? [{ column: 'id', value: path[1] }] : [],
    };
  }

  if (path[0] === 'groups' && path.length <= 2) {
    return {
      table: 'groups',
      id: path[1],
      implicitFilters: path[1] ? [{ column: 'id', value: path[1] }] : [],
    };
  }

  if (path[0] === 'groups' && path[2] === 'sessions' && path.length <= 4) {
    return {
      table: 'chat_sessions',
      id: path[3],
      implicitFilters: [
        { column: 'group_id', value: path[1] },
        ...(path[3] ? [{ column: 'id', value: path[3] }] : []),
      ],
    };
  }

  if (
    path[0] === 'groups' &&
    path[2] === 'sessions' &&
    path[4] === 'messages'
  ) {
    return {
      table: 'chat_messages',
      id: path[5],
      implicitFilters: [
        { column: 'group_id', value: path[1] },
        { column: 'session_id', value: path[3] },
        ...(path[5] ? [{ column: 'id', value: path[5] }] : []),
      ],
    };
  }

  if (path[0] === 'chats') {
    return {
      table: 'legacy_chats',
      id: path[1],
      implicitFilters: [],
    };
  }

  throw new Error(`Unsupported data path: ${path.join('/')}`);
}

function columnForField(field: string): string {
  const map: Record<string, string> = {
    uid: 'owner_id',
    groupId: 'group_id',
    sessionId: 'session_id',
    parentId: 'parent_id',
    createdAt: 'created_at',
  };
  return map[field] ?? field;
}

function toIsoDate(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return new Date(value).toISOString();
  if (typeof value === 'string') return value;
  return undefined;
}

function toRow(table: Descriptor['table'], id: string | undefined, data: any): any {
  const ownerId = data.uid ?? cachedUser?.uid;

  if (table === 'profiles') {
    return {
      id: id ?? data.uid,
      email: data.email,
      display_name: data.displayName,
      photo_url: data.photoURL,
      personal_rules: data.personalRules,
      updated_at: new Date().toISOString(),
    };
  }

  if (table === 'groups') {
    return {
      id: id ?? data.id,
      owner_id: ownerId,
      name: data.name,
      parent_id: data.parentId,
      project_address: data.projectAddress,
      project_addresses: data.projectAddresses,
      lot_area: data.lotArea,
      site_investigation: data.siteInvestigation,
      is_project: data.isProject,
      urls: data.urls,
      files: data.files,
      building_overview: data.buildingOverview,
      created_at: toIsoDate(data.createdAt),
      updated_at: new Date().toISOString(),
    };
  }

  if (table === 'chat_sessions') {
    return {
      id: id ?? data.id,
      owner_id: ownerId,
      group_id: data.groupId,
      title: data.title,
      created_at: toIsoDate(data.createdAt),
      is_archived: data.isArchived,
      updated_at: new Date().toISOString(),
    };
  }

  if (table === 'chat_messages') {
    return {
      id: id ?? data.id,
      owner_id: ownerId,
      group_id: data.groupId,
      session_id: data.sessionId,
      text: data.text,
      sender: data.sender,
      timestamp: toIsoDate(data.timestamp),
      url_context: data.urlContext,
      grounding_chunks: data.groundingChunks,
      was_search_enabled: data.wasSearchEnabled,
      suggested_rules: data.suggestedRules,
    };
  }

  return data;
}

function removeUndefined(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  );
}

function fromRow(table: Descriptor['table'], row: any): any {
  if (table === 'profiles') {
    return {
      uid: row.id,
      email: row.email,
      displayName: row.display_name,
      photoURL: row.photo_url,
      personalRules: row.personal_rules ?? [],
      updatedAt: row.updated_at,
    };
  }

  if (table === 'groups') {
    return {
      id: row.id,
      name: row.name,
      parentId: row.parent_id,
      projectAddress: row.project_address,
      projectAddresses: row.project_addresses ?? [],
      lotArea: row.lot_area,
      siteInvestigation: row.site_investigation,
      isProject: row.is_project,
      urls: row.urls ?? [],
      files: row.files ?? [],
      buildingOverview: row.building_overview,
      uid: row.owner_id,
      createdAt: row.created_at ? Date.parse(row.created_at) : undefined,
    };
  }

  if (table === 'chat_sessions') {
    return {
      id: row.id,
      title: row.title,
      createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
      groupId: row.group_id,
      uid: row.owner_id,
      isArchived: row.is_archived,
    };
  }

  if (table === 'chat_messages') {
    return {
      id: row.id,
      text: row.text,
      sender: row.sender,
      timestamp: row.timestamp ? Date.parse(row.timestamp) : Date.now(),
      urlContext: row.url_context ?? [],
      groundingChunks: row.grounding_chunks ?? [],
      wasSearchEnabled: row.was_search_enabled,
      suggestedRules: row.suggested_rules ?? [],
      sessionId: row.session_id,
      groupId: row.group_id,
      uid: row.owner_id,
    };
  }

  return row;
}

function makeDocumentSnapshot(
  table: Descriptor['table'],
  id: string,
  row: any | null,
): DocumentSnapshot {
  return {
    id,
    exists: () => row !== null,
    data: () => (row === null ? undefined : fromRow(table, row)),
  };
}

async function selectRows(ref: PathRef): Promise<any[]> {
  const descriptor = describe(ref);
  if (descriptor.table === 'legacy_chats') return [];

  let builder: any = supabase.from(descriptor.table).select('*');

  for (const filter of descriptor.implicitFilters) {
    builder = builder.eq(filter.column, filter.value);
  }

  for (const filter of ref.filters ?? []) {
    builder = builder.eq(columnForField(filter.field), filter.value);
  }

  const { data, error } = await builder;
  if (error) throw error;
  return data ?? [];
}

export async function getDoc(ref: PathRef): Promise<DocumentSnapshot> {
  const descriptor = describe(ref);
  if (descriptor.table === 'legacy_chats') {
    return makeDocumentSnapshot('legacy_chats', descriptor.id ?? '', null);
  }

  const rows = await selectRows(ref);
  const row = rows[0] ?? null;
  return makeDocumentSnapshot(descriptor.table, descriptor.id ?? row?.id ?? '', row);
}

export async function setDoc(
  ref: PathRef,
  data: any,
  _options?: SetOptions,
): Promise<void> {
  const descriptor = describe(ref);
  if (descriptor.table === 'legacy_chats') return;

  const row = removeUndefined(toRow(descriptor.table, descriptor.id, data));

  if (_options?.merge && descriptor.id) {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      const { error } = await supabase
        .from(descriptor.table)
        .update(row)
        .eq('id', descriptor.id);
      if (error) throw error;
      return;
    }
  }

  const { error } = await supabase
    .from(descriptor.table)
    .upsert(row, { onConflict: 'id' });

  if (error) throw error;
}

export async function deleteDoc(ref: PathRef): Promise<void> {
  const descriptor = describe(ref);
  if (descriptor.table === 'legacy_chats' || !descriptor.id) return;

  const { error } = await supabase
    .from(descriptor.table)
    .delete()
    .eq('id', descriptor.id);

  if (error) throw error;
}

export function writeBatch(_db: unknown) {
  const operations: Array<() => Promise<void>> = [];

  return {
    set(ref: PathRef, data: any, options?: SetOptions) {
      operations.push(() => setDoc(ref, data, options));
    },
    delete(ref: PathRef) {
      operations.push(() => deleteDoc(ref));
    },
    async commit() {
      for (const operation of operations) {
        await operation();
      }
    },
  };
}

export function onSnapshot(
  ref: PathRef,
  onNext: ((snapshot: QuerySnapshot) => void) | ((snapshot: DocumentSnapshot) => void),
  onError?: (error: unknown) => void,
): () => void {
  const descriptor = describe(ref);
  let active = true;

  const refresh = async () => {
    try {
      const rows = await selectRows(ref);
      if (!active) return;

      if (ref.kind === 'doc') {
        const row = rows[0] ?? null;
        (onNext as (snapshot: DocumentSnapshot) => void)(
          makeDocumentSnapshot(
            descriptor.table,
            descriptor.id ?? row?.id ?? '',
            row,
          ),
        );
        return;
      }

      const docs = rows.map((row) =>
        makeDocumentSnapshot(descriptor.table, row.id, row),
      );
      (onNext as (snapshot: QuerySnapshot) => void)({ docs });
    } catch (error) {
      if (active) onError?.(error);
    }
  };

  void refresh();

  if (descriptor.table === 'legacy_chats') {
    return () => {
      active = false;
    };
  }

  const primaryFilter =
    descriptor.implicitFilters[0] ??
    (ref.filters?.[0]
      ? {
          column: columnForField(ref.filters[0].field),
          value: ref.filters[0].value,
        }
      : undefined);

  const channelName = [
    'compat',
    descriptor.table,
    primaryFilter?.column ?? 'all',
    String(primaryFilter?.value ?? 'all'),
    crypto.randomUUID(),
  ].join(':');

  const config: {
    event: '*';
    schema: 'public';
    table: string;
    filter?: string;
  } = {
    event: '*',
    schema: 'public',
    table: descriptor.table,
  };

  if (primaryFilter) {
    config.filter = `${primaryFilter.column}=eq.${primaryFilter.value}`;
  }

  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', config, () => {
      void refresh();
    })
    .subscribe();

  return () => {
    active = false;
    void supabase.removeChannel(channel);
  };
}

export const Timestamp = {
  now: () => new Date().toISOString(),
};
