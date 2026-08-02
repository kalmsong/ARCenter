import '../services/firebase';

type SnapshotDocument = {
  id: string;
  data: () => any;
  exists: () => boolean;
};

type SnapshotCompat = SnapshotDocument & {
  docs: SnapshotDocument[];
};

declare module '../services/firebase' {
  export function onSnapshot(
    ref: unknown,
    onNext: (snapshot: SnapshotCompat) => void,
    onError?: (error: any) => void,
  ): () => void;
}
