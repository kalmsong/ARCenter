import { supabase } from '../services/supabaseClient';

const KNOWLEDGE_BUCKET = 'knowledge-files';
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

type StorageLocation = {
  bucket: string;
  path: string;
};

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(-160) || 'file';
}

export function parseStorageLocation(value?: string): StorageLocation | null {
  if (!value?.startsWith('storage://')) return null;

  const withoutScheme = value.slice('storage://'.length);
  const slashIndex = withoutScheme.indexOf('/');
  if (slashIndex <= 0) return null;

  return {
    bucket: withoutScheme.slice(0, slashIndex),
    path: withoutScheme.slice(slashIndex + 1),
  };
}

/**
 * Transitional compatibility name.
 *
 * This function no longer creates Base64. It uploads the raw File directly to
 * private Supabase Storage and returns a lightweight storage:// reference.
 */
export const fileToBase64 = async (file: File): Promise<string> => {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `파일 크기는 최대 ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB까지 업로드할 수 있습니다.`,
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('파일을 업로드하려면 로그인이 필요합니다.');
  }

  const fileId = crypto.randomUUID();
  const path = `${user.id}/${fileId}/${sanitizeFileName(file.name)}`;

  const { error } = await supabase.storage
    .from(KNOWLEDGE_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    });

  if (error) throw error;

  return `storage://${KNOWLEDGE_BUCKET}/${path}`;
};

export async function createKnowledgeFileUrl(
  storageReference?: string,
  expiresInSeconds = 300,
): Promise<string | null> {
  if (!storageReference) return null;

  if (storageReference.startsWith('data:') || storageReference.startsWith('blob:')) {
    return storageReference;
  }

  if (/^https?:\/\//i.test(storageReference)) {
    return storageReference;
  }

  const location = parseStorageLocation(storageReference);
  if (!location) return null;

  const { data, error } = await supabase.storage
    .from(location.bucket)
    .createSignedUrl(location.path, expiresInSeconds);

  if (error) throw error;
  return data.signedUrl;
}

export async function downloadKnowledgeFile(
  storageReference?: string,
): Promise<Blob | null> {
  const location = parseStorageLocation(storageReference);
  if (!location) return null;

  const { data, error } = await supabase.storage
    .from(location.bucket)
    .download(location.path);

  if (error) throw error;
  return data;
}
