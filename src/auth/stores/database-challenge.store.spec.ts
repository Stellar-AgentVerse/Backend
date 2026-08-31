import { DataSource, Repository } from 'typeorm';
import { AuthChallenge } from '../../database/entities/auth-challenge.entity';
import { DatabaseChallengeStore } from './database-challenge.store';

describe('DatabaseChallengeStore', () => {
  it('atomically consumes a non-expired challenge inside a transaction', async () => {
    const entity = {
      publicKey: 'GBUSER',
      challenge: 'challenge-1',
      expiresAt: new Date(Date.now() + 60_000),
    };
    const manager = {
      findOne: jest.fn().mockResolvedValue(entity),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const repository = {
      manager: {
        transaction: jest.fn(async (callback: (tx: typeof manager) => unknown) =>
          callback(manager),
        ),
      },
    } as unknown as Repository<AuthChallenge>;
    const dataSource = {
      getRepository: jest.fn().mockReturnValue(repository),
    } as unknown as DataSource;

    const store = new DatabaseChallengeStore(dataSource);

    await expect(store.consume('GBUSER')).resolves.toEqual(entity);
    expect(repository.manager.transaction).toHaveBeenCalledTimes(1);
    expect(manager.findOne).toHaveBeenCalledWith(AuthChallenge, {
      where: { publicKey: 'GBUSER' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(manager.delete).toHaveBeenCalledWith(AuthChallenge, {
      publicKey: 'GBUSER',
    });
  });

  it('consumes expired challenges without returning them', async () => {
    const manager = {
      findOne: jest.fn().mockResolvedValue({
        publicKey: 'GBUSER',
        challenge: 'expired',
        expiresAt: new Date(Date.now() - 1),
      }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const repository = {
      manager: {
        transaction: jest.fn(async (callback: (tx: typeof manager) => unknown) =>
          callback(manager),
        ),
      },
    } as unknown as Repository<AuthChallenge>;
    const dataSource = {
      getRepository: jest.fn().mockReturnValue(repository),
    } as unknown as DataSource;

    await expect(new DatabaseChallengeStore(dataSource).consume('GBUSER')).resolves.toBeNull();
    expect(manager.delete).toHaveBeenCalledWith(AuthChallenge, { publicKey: 'GBUSER' });
  });
});
