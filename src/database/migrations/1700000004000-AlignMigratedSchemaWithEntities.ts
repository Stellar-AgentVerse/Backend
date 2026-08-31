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
 *
 * It does not touch purchases."transactionHash", whose width differs from the
 * entity for a reason recorded at the end of up().
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

    // purchases."transactionHash" is deliberately left at the varchar(128)
    // 1700000001000 created it with, even though the entity declares
    // varchar(64). ConfirmPurchaseDto accepts 32-128 characters with no hex or
    // exact-length check, so narrowing the column converts a malformed hash
    // from a rejected request into a 22001 error inside confirm() — a 500
    // where a 400 belongs. Narrow it together with the DTO, not before.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
