import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User as UserEntity } from '../entities/user.entity';
import { User, UserStatus } from '../../auth/models/user.interface';
import { UserRepository } from '../../auth/repositories/user-repository.interface';

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  private readonly logger = new Logger(TypeOrmUserRepository.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  async findOrCreate(publicKey: string): Promise<User> {
    let entity = await this.repo.findOne({ where: { publicKey } });

    if (!entity) {
      entity = this.repo.create({
        publicKey,
        status: UserStatus.ACTIVE,
        displayName: '',
        avatar: '',
        lastLoginAt: new Date(),
      });
      entity = await this.repo.save(entity);
      this.logger.log(`Created user for ${publicKey}`);
    }

    return this.toDomain(entity);
  }

  async findByPublicKey(publicKey: string): Promise<User | null> {
    const entity = await this.repo.findOne({ where: { publicKey } });
    return entity ? this.toDomain(entity) : null;
  }

  async updateLastLogin(publicKey: string): Promise<User | null> {
    const entity = await this.repo.findOne({ where: { publicKey } });
    if (!entity) return null;

    entity.lastLoginAt = new Date();
    const updated = await this.repo.save(entity);
    return updated ? this.toDomain(updated) : null;
  }

  private toDomain(entity: UserEntity): User {
    return {
      publicKey: entity.publicKey,
      status: entity.status as UserStatus,
      displayName: entity.displayName,
      avatar: entity.avatar,
      createdAt: entity.createdAt,
      lastLoginAt: entity.lastLoginAt,
    };
  }
}
