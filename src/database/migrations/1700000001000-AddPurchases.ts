import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPurchases1700000001000 implements MigrationInterface {
  name = 'AddPurchases1700000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "purchase_status_enum" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'EXPIRED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "purchases" (
        "id" uuid PRIMARY KEY,
        "assetId" uuid NOT NULL,
        "buyerPublicKey" varchar(56) NOT NULL,
        "status" "purchase_status_enum" NOT NULL DEFAULT 'PENDING',
        "idempotencyKey" varchar(64) NOT NULL UNIQUE,
        "transactionHash" varchar(128),
        "contractId" varchar(56) NOT NULL,
        "networkPassphrase" varchar(100) NOT NULL,
        "amount" numeric(20,2) NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "confirmedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_purchases_asset" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_purchases_transactionHash" ON "purchases" ("transactionHash") WHERE "transactionHash" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_purchases_buyer_status" ON "purchases" ("buyerPublicKey", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_purchases_asset_buyer" ON "purchases" ("assetId", "buyerPublicKey")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_purchases_asset_buyer"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_purchases_buyer_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_purchases_transactionHash"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "purchases"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "purchase_status_enum"`);
  }
}
