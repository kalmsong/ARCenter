import '../services/firebase';

type SnapshotDocument = {
  id: string;
  data: () => any;
  exists: () => boolean;
};

declare module '../services/firebase' {
  export function onSnapshot(
    ref: unknown,
    onNext: (snapshot: { docs: SnapshotDocument[] }) => void,
    onError?: (error: any) => void,
  ): () => void;

  export function onSnapshot(
    ref: unknown,
    onNext: (snapshot: SnapshotDocument) => void,
    onError?: (error: any) => void,
  ): () => void;
}
