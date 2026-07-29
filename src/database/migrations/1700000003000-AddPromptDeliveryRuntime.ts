import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromptDeliveryRuntime1700000003000 implements MigrationInterface {
  name = 'AddPromptDeliveryRuntime1700000003000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "delivery_state_enum" AS ENUM ('RECEIVED','AUTHORIZED','PROCESSING','SUCCEEDED','RETRYABLE_FAILURE','TERMINAL_FAILURE','EXPIRED','DEAD_LETTERED')`,
    );
    await queryRunner.query(`CREATE TABLE "delivery_commands" (
      "id" uuid PRIMARY KEY, "canonicalId" varchar(64) NOT NULL UNIQUE, "canonicalJson" text NOT NULL,
      "version" smallint NOT NULL, "network" varchar(100) NOT NULL, "contractId" varchar(56) NOT NULL,
      "transactionHash" varchar(128) NOT NULL, "ledgerSequence" bigint NOT NULL, "eventIndex" integer NOT NULL,
      "purchaseId" uuid NOT NULL, "assetId" uuid NOT NULL, "buyerPublicKey" varchar(56) NOT NULL,
      "tenantId" varchar(128) NOT NULL, "providerName" varchar(64) NOT NULL, "expiresAt" timestamptz NOT NULL,
      "wrappedDek" text NOT NULL, "encryptedPrompt" text NOT NULL, "state" "delivery_state_enum" NOT NULL DEFAULT 'RECEIVED',
      "attempts" integer NOT NULL DEFAULT 0, "leaseUntil" timestamptz, "nextAttemptAt" timestamptz,
      "failureCode" varchar(80), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_delivery_commands_work" ON "delivery_commands" ("state", "nextAttemptAt")`,
    );
    await queryRunner.query(`CREATE TABLE "delivery_outbox" (
      "id" uuid PRIMARY KEY, "commandId" uuid NOT NULL, "canonicalId" varchar(64) NOT NULL,
      "attempts" integer NOT NULL DEFAULT 0, "publishedAt" timestamptz, "availableAt" timestamptz NOT NULL DEFAULT now(),
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_delivery_outbox_pending" ON "delivery_outbox" ("publishedAt", "availableAt")`,
    );
    await queryRunner.query(`CREATE TABLE "delivery_results" (
      "id" uuid PRIMARY KEY, "canonicalId" varchar(64) NOT NULL UNIQUE, "purchaseId" uuid NOT NULL UNIQUE,
      "commandId" uuid NOT NULL, "buyerPublicKey" varchar(56) NOT NULL,
      "tenantId" varchar(128) NOT NULL, "encryptedResult" jsonb NOT NULL, "expiresAt" timestamptz NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "delivery_results"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "delivery_outbox"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "delivery_commands"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "delivery_state_enum"`);
  }
}
