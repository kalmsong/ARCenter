import { supabaseAdmin } from './supabaseServer';

type KnowledgeFileInput = {
  id: string;
  name: string;
  mimeType?: string;
  base64Data?: string;
  storageReference?: string;
  content?: string;
};

const MAX_FILES_PER_REQUEST = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

function parseStorageReference(value: string) {
  if (!value.startsWith('storage://')) return null;
  const rest = value.slice('storage://'.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  return {
    bucket: rest.slice(0, slash),
    path: rest.slice(slash + 1),
  };
}

function toDataUri(mimeType: string, buffer: Buffer): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

export async function hydrateKnowledgeFiles(
  files: KnowledgeFileInput[],
  userId: string,
): Promise<KnowledgeFileInput[]> {
  const hydrated: KnowledgeFileInput[] = [];
  let totalBytes = 0;

  for (const file of files.slice(0, MAX_FILES_PER_REQUEST)) {
    const mimeType = file.mimeType || 'application/octet-stream';

    if (typeof file.content === 'string') {
      const buffer = Buffer.from(file.content, 'utf8');
      if (buffer.byteLength > MAX_FILE_BYTES) continue;
      totalBytes += buffer.byteLength;
      if (totalBytes > MAX_TOTAL_BYTES) break;
      hydrated.push({
        ...file,
        base64Data: toDataUri(mimeType, buffer),
      });
      continue;
    }

    const reference = file.storageReference || file.base64Data;
    if (!reference) continue;

    if (reference.startsWith('data:')) {
      if (reference.length > MAX_FILE_BYTES * 1.5) continue;
      totalBytes += Math.floor(reference.length * 0.75);
      if (totalBytes > MAX_TOTAL_BYTES) break;
      hydrated.push({ ...file, base64Data: reference });
      continue;
    }

    const location = parseStorageReference(reference);
    if (!location) continue;

    if (!location.path.startsWith(`${userId}/`)) {
      throw new Error('다른 사용자의 파일에는 접근할 수 없습니다.');
    }

    const { data, error } = await supabaseAdmin.storage
      .from(location.bucket)
      .download(location.path);

    if (error) throw error;
    if (data.size > MAX_FILE_BYTES) continue;

    totalBytes += data.size;
    if (totalBytes > MAX_TOTAL_BYTES) break;

    const buffer = Buffer.from(await data.arrayBuffer());
    hydrated.push({
      ...file,
      base64Data: toDataUri(mimeType, buffer),
    });
  }

  return hydrated;
}
