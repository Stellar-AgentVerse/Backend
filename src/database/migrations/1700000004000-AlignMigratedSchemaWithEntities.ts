import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aligns a migration-provisioned schema with the entity definitions the
 * application actually boots with.
 *
 * Migrations 1700000000000-1700000003000 declare every uuid primary key as
 * `"id" uuid PRIMARY KEY` with no default, but the entities use
 * `@PrimaryGeneratedColumn('uuid')`, for which TypeORM's Postgres driver relies
 * on the column default rather than generating the value in the application.
 * Under `DB_SYNCHRONIZE=true` the auto-sync adds the default and the mismatch is
 * invisible; under `DB_SYNCHRONIZE=false` every insert that does not set `id`
 * explicitly fails with `null value in column "id" ... violates not-null
 * constraint`.
 *
 * The same class of drift applies to `asset_type_enum`, which was created with
 * four values while `AssetType` declares six.
 */
const UUID_PRIMARY_KEY_TABLES = [
  'activity_logs',
  'asset_capabilities',
  'asset_metrics',
  'asset_specs',
  'asset_workflow_steps',
  'assets',
  'credit_packages',
  'delivery_commands',
  'delivery_outbox',
  'delivery_results',
  'purchases',
  'tags',
  'user_assets',
  'wallet_transactions',
  'wallets',
];

const MISSING_ASSET_TYPES = ['MODEL', 'ORACLE'];

export class AlignMigratedSchemaWithEntities1700000004000 implements MigrationInterface {
  name = 'AlignMigratedSchemaWithEntities1700000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    for (const table of UUID_PRIMARY_KEY_TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4()`,
      );
    }

    for (const value of MISSING_ASSET_TYPES) {
      await queryRunner.query(
        `ALTER TYPE "asset_type_enum" ADD VALUE IF NOT EXISTS '${value}'`,
      );
    }

    // Purchase.transactionHash is varchar(64); 1700000001000 created it as
    // varchar(128). A Stellar transaction hash is 64 hex characters, so no
    // stored value can exceed the narrower width. Left as-is, a later
    // `synchronize` run would reconcile this by dropping and re-adding the
    // column, which would discard the hashes the replay guard depends on.
    await queryRunner.query(
      `ALTER TABLE "purchases" ALTER COLUMN "transactionHash" TYPE varchar(64)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchases" ALTER COLUMN "transactionHash" TYPE varchar(128)`,
    );

    for (const table of UUID_PRIMARY_KEY_TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "id" DROP DEFAULT`,
      );
    }

    // PostgreSQL cannot remove a value from an enum type. 'MODEL' and 'ORACLE'
    // stay on asset_type_enum after a revert; they are additive and unused by
    // any row this migration creates, so leaving them is safe.
  }
}
