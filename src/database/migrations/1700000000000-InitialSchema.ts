import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "asset_type_enum" AS ENUM ('AGENT', 'DATASET', 'PROMPT', 'TOOL')`);
    await queryRunner.query(`CREATE TYPE "asset_status_enum" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'ARCHIVED')`);
    await queryRunner.query(`CREATE TYPE "transaction_type_enum" AS ENUM ('PURCHASE', 'INCOME', 'FEE', 'REFILL')`);
    await queryRunner.query(`CREATE TYPE "user_asset_role_enum" AS ENUM ('CREATOR', 'FOLLOWER')`);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "publicKey" varchar(56) PRIMARY KEY,
        "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
        "displayName" varchar(100) NOT NULL DEFAULT '',
        "avatar" varchar(500) NOT NULL DEFAULT '',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "lastLoginAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "assets" (
        "id" uuid PRIMARY KEY,
        "name" varchar(120) NOT NULL,
        "slug" varchar(200) NOT NULL UNIQUE,
        "description" text NOT NULL DEFAULT '',
        "type" "asset_type_enum" NOT NULL,
        "creatorPublicKey" varchar(56) NOT NULL,
        "price" numeric(20,2) NOT NULL DEFAULT 0,
        "status" "asset_status_enum" NOT NULL DEFAULT 'DRAFT',
        "imageUrl" varchar(500) NOT NULL DEFAULT '',
        "tags" jsonb,
        "metadata" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_assets_creator_status" ON "assets" ("creatorPublicKey", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_assets_type_status" ON "assets" ("type", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_assets_creatorPublicKey" ON "assets" ("creatorPublicKey")`);

    await queryRunner.query(`
      CREATE TABLE "asset_metrics" (
        "id" uuid PRIMARY KEY,
        "assetId" uuid NOT NULL,
        "executions" bigint NOT NULL DEFAULT 0,
        "revenue" numeric(20,2) NOT NULL DEFAULT 0,
        "activeUsers" integer NOT NULL DEFAULT 0,
        "rating" numeric(3,2) NOT NULL DEFAULT 0,
        "reliability" numeric(5,2) NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_asset_metrics_asset" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_asset_metrics_assetId" ON "asset_metrics" ("assetId")`);

    await queryRunner.query(`
      CREATE TABLE "asset_capabilities" (
        "id" uuid PRIMARY KEY,
        "assetId" uuid NOT NULL,
        "icon" varchar(64) NOT NULL,
        "title" varchar(100) NOT NULL,
        "description" text NOT NULL,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_asset_capabilities_asset" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "asset_workflow_steps" (
        "id" uuid PRIMARY KEY,
        "assetId" uuid NOT NULL,
        "stepOrder" integer NOT NULL,
        "icon" varchar(64) NOT NULL,
        "label" varchar(100) NOT NULL,
        "isActive" boolean NOT NULL DEFAULT false,
        "isFilled" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_asset_workflow_steps_asset" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "asset_specs" (
        "id" uuid PRIMARY KEY,
        "assetId" uuid NOT NULL,
        "parameter" varchar(200) NOT NULL,
        "value" varchar(200) NOT NULL,
        "notes" varchar(300) NOT NULL DEFAULT '',
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_asset_specs_asset" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "wallets" (
        "id" uuid PRIMARY KEY,
        "userPublicKey" varchar(56) NOT NULL UNIQUE,
        "credits" numeric(20,2) NOT NULL DEFAULT 0,
        "xlmBalance" numeric(20,7) NOT NULL DEFAULT 0,
        "monthlyUsage" numeric(5,2) NOT NULL DEFAULT 0,
        "monthlyAllocation" numeric(5,2) NOT NULL DEFAULT 100,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_wallets_userPublicKey" ON "wallets" ("userPublicKey")`);

    await queryRunner.query(`
      CREATE TABLE "credit_packages" (
        "id" uuid PRIMARY KEY,
        "name" varchar(100) NOT NULL,
        "slug" varchar(100) NOT NULL UNIQUE,
        "description" varchar(500) NOT NULL DEFAULT '',
        "icon" varchar(64) NOT NULL,
        "credits" integer NOT NULL,
        "price" numeric(20,2) NOT NULL,
        "originalPrice" numeric(20,2),
        "features" jsonb,
        "popular" boolean NOT NULL DEFAULT false,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "wallet_transactions" (
        "id" uuid PRIMARY KEY,
        "walletId" uuid NOT NULL,
        "type" "transaction_type_enum" NOT NULL,
        "description" varchar(300) NOT NULL,
        "txid" varchar(100) NOT NULL DEFAULT '',
        "amount" numeric(20,2) NOT NULL,
        "currency" varchar(20) NOT NULL DEFAULT 'Credits',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_wallet_transactions_wallet" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_wallet_transactions_wallet_created" ON "wallet_transactions" ("walletId", "createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_wallet_transactions_walletId" ON "wallet_transactions" ("walletId")`);

    await queryRunner.query(`
      CREATE TABLE "activity_logs" (
        "id" uuid PRIMARY KEY,
        "assetId" uuid,
        "event" varchar(100) NOT NULL,
        "asset" varchar(200) NOT NULL DEFAULT '',
        "status" varchar(50) NOT NULL DEFAULT 'Active',
        "revenue" varchar(50) NOT NULL DEFAULT '--',
        "userPublicKey" varchar(56),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_activity_logs_asset" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_activity_logs_asset_created" ON "activity_logs" ("assetId", "createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_activity_logs_userPublicKey" ON "activity_logs" ("userPublicKey")`);

    await queryRunner.query(`
      CREATE TABLE "user_assets" (
        "id" uuid PRIMARY KEY,
        "userPublicKey" varchar(56) NOT NULL,
        "assetId" uuid NOT NULL,
        "role" "user_asset_role_enum" NOT NULL DEFAULT 'FOLLOWER',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_user_assets_asset" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_user_assets_user_asset" ON "user_assets" ("userPublicKey", "assetId")`);

    await queryRunner.query(`
      CREATE TABLE "tags" (
        "id" uuid PRIMARY KEY,
        "name" varchar(50) NOT NULL UNIQUE,
        "slug" varchar(50) NOT NULL UNIQUE,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tags"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_assets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "activity_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wallet_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "credit_packages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wallets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_specs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_workflow_steps"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_capabilities"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_metrics"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_asset_role_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "transaction_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "asset_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "asset_type_enum"`);
  }
}
