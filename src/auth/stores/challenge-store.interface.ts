export interface ChallengeEntry {
  challenge: string;
  publicKey: string;
  expiresAt: Date;
}

export interface ChallengeStore {
  set(publicKey: string, entry: ChallengeEntry): Promise<void>;
  get(publicKey: string): Promise<ChallengeEntry | null>;
  delete(publicKey: string): Promise<void>;
  sweep(): Promise<number>;
}
