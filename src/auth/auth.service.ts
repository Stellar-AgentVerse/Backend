import { Injectable, Inject, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import { Keypair } from '@stellar/stellar-sdk';
import type { ChallengeStore } from './stores/challenge-store.interface';
import type { UserRepository } from './repositories/user-repository.interface';
import { CHALLENGE_STORE, USER_REPOSITORY } from './common/auth-tokens';
import { AuthResult } from './common/interfaces/auth-result.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly challengeTTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    @Inject(CHALLENGE_STORE) private readonly challengeStore: ChallengeStore,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async generateChallenge(publicKey: string): Promise<{ challenge: string }> {
    // Check if there's already a valid cached challenge
    const existing = await this.challengeStore.get(publicKey);
    if (existing) {
      this.logger.log(`Returning cached challenge for ${publicKey}`);
      return { challenge: existing.challenge };
    }

    const challenge = randomUUID();
    await this.challengeStore.set(publicKey, {
      challenge,
      publicKey,
      expiresAt: new Date(Date.now() + this.challengeTTL),
    });

    this.logger.log(`Generated new challenge for ${publicKey}`);
    return { challenge };
  }

  async verifyWallet(publicKey: string, signature: string): Promise<AuthResult> {
    const entry = this.challengeStore.consume
      ? await this.challengeStore.consume(publicKey)
      : await this.challengeStore.get(publicKey);
    if (!entry) {
      throw new UnauthorizedException('Challenge not found or expired');
    }

    if (!/^[0-9a-f]{128}$/i.test(signature)) {
      if (!this.challengeStore.consume) await this.challengeStore.delete(publicKey);
      throw new UnauthorizedException('Invalid signature');
    }

    let isValid = false;
    try {
      const keypair = Keypair.fromPublicKey(publicKey);
      const signatureBytes = Buffer.from(signature, 'hex');
      const challengeBytes = Buffer.from(entry.challenge, 'utf-8');
      const sep53Prefix = Buffer.from('Stellar Signed Message:\n', 'utf-8');
      const sep53Message = createHash('sha256')
        .update(Buffer.concat([sep53Prefix, challengeBytes]))
        .digest();

      isValid =
        keypair.verify(challengeBytes, signatureBytes) ||
        keypair.verify(sep53Message, signatureBytes);
    } catch {
      if (!this.challengeStore.consume) await this.challengeStore.delete(publicKey);
      throw new UnauthorizedException('Invalid signature');
    }

    if (!isValid) {
      if (!this.challengeStore.consume) await this.challengeStore.delete(publicKey);
      throw new UnauthorizedException('Invalid signature');
    }

    // The durable consume path already deleted the challenge transactionally.
    // Keep the fallback single-use for isolated tests and legacy adapters.
    if (!this.challengeStore.consume) await this.challengeStore.delete(publicKey);

    // Upsert user
    const user = await this.userRepository.findOrCreate(publicKey);
    await this.userRepository.updateLastLogin(publicKey);

    // Sign JWT
    const token = this.jwtService.sign({
      publicKey,
      iat: Math.floor(Date.now() / 1000),
    });

    return { token, user };
  }
}
