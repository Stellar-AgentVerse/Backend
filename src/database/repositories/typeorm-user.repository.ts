import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User as UserEntity } from '../entities/user.entity';
import { User } from '../../auth/models/user.interface';
import { UserStatus } from '../../auth/models/user.interface';
import { UserRepository } from '../../auth/repositories/user-repository.interface';

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  private readonly logger = new Logger(TypeOrmUserRepository.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  async findOrCreate(publicKey: string): Promise<User> {
    let entity = await this.repo.findOne({ where: { wallet: publicKey } });

    if (!entity) {
      entity = this.repo.create({ wallet: publicKey });
      entity = await this.repo.save(entity);
      this.logger.log(`Created user for wallet ${publicKey}`);
    }

    return this.toDomain(entity);
  }

  async findByPublicKey(publicKey: string): Promise<User | null> {
    const entity = await this.repo.findOne({ where: { wallet: publicKey } });
    return entity ? this.toDomain(entity) : null;
  }

  async updateLastLogin(publicKey: string): Promise<User | null> {
    const entity = await this.repo.findOne({ where: { wallet: publicKey } });
    if (!entity) return null;

    // TypeORM's @UpdateDateColumn will handle updatedAt automatically
    // We update a dummy field to trigger the update
    await this.repo.update(entity.id, {});
    const updated = await this.repo.findOne({ where: { wallet: publicKey } });
    return updated ? this.toDomain(updated) : null;
  }

  private toDomain(entity: UserEntity): User {
    return {
      publicKey: entity.wallet,
      status: UserStatus.ACTIVE,
      displayName: '',
      avatar: '',
      createdAt: entity.createdAt,
      lastLoginAt: entity.updatedAt,
    };
  }
}
