import { Injectable, Inject, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { Keypair } from '@stellar/stellar-sdk';
import { ChallengeStore } from './stores/challenge-store.interface';
import { UserRepository } from './repositories/user-repository.interface';
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
    const entry = await this.challengeStore.get(publicKey);
    if (!entry) {
      throw new UnauthorizedException('Challenge not found or expired');
    }

    // Delete challenge immediately (single-use)
    await this.challengeStore.delete(publicKey);

    // Verify the signature
    const keypair = Keypair.fromPublicKey(publicKey);
    const isValid = keypair.verify(
      Buffer.from(entry.challenge, 'utf-8'),
      Buffer.from(signature, 'hex'),
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }

    // Upsert user
    const user = this.userRepository.findOrCreate(publicKey);
    this.userRepository.updateLastLogin(publicKey);

    // Sign JWT
    const token = this.jwtService.sign({
      publicKey,
      iat: Math.floor(Date.now() / 1000),
    });

    return { token, user };
  }
}
