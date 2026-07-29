import { MigrationInterface, QueryRunner } from 'typeorm';

export class ScopePurchaseIdempotency1700000002000 implements MigrationInterface {
  name = 'ScopePurchaseIdempotency1700000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE constraint_name text;
      BEGIN
        SELECT con.conname INTO constraint_name
        FROM pg_constraint con
        JOIN pg_attribute attr ON attr.attrelid = con.conrelid AND attr.attnum = ANY(con.conkey)
        WHERE con.conrelid = 'purchases'::regclass
          AND con.contype = 'u'
          AND array_length(con.conkey, 1) = 1
          AND attr.attname = 'idempotencyKey';
        IF constraint_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE purchases DROP CONSTRAINT %I', constraint_name);
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_purchases_buyer_idempotency" ON "purchases" ("buyerPublicKey", "idempotencyKey")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_purchases_buyer_idempotency"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchases" ADD CONSTRAINT "UQ_purchases_idempotencyKey" UNIQUE ("idempotencyKey")`,
    );
  }
}
