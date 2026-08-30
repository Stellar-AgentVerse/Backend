import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromptPublication1700000004000 implements MigrationInterface {
  name = 'AddPromptPublication1700000004000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // A dedicated type, not a new value on "assets_status_enum": PostgreSQL
    // refuses to use a value added by ALTER TYPE inside the same transaction,
    // and TypeORM runs every migration in one.
    await queryRunner.query(
      `CREATE TYPE "prompt_publication_state_enum" AS ENUM ('DRAFT','PENDING_REVIEW','PUBLISHING','PUBLISHED','FAILED')`,
    );

    await queryRunner.query(`CREATE TABLE "prompt_publications" (
      "id" uuid PRIMARY KEY,
      "assetId" uuid NOT NULL,
      "state" "prompt_publication_state_enum" NOT NULL DEFAULT 'DRAFT',
      "priceAtomic" numeric(39,0) NOT NULL,
      "commitmentVersion" smallint NOT NULL DEFAULT 1,
      "commitment" char(64),
      "network" varchar(32) NOT NULL,
      "contractId" varchar(56),
      "transactionHash" varchar(64),
      "ledgerSequence" bigint,
      "submittedAt" timestamptz,
      "reviewerPublicKey" varchar(56),
      "reviewedAt" timestamptz,
      "publishedAt" timestamptz,
      "failureCode" varchar(80),
      "failureDetail" text,
      "attempts" integer NOT NULL DEFAULT 0,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "FK_prompt_publications_asset" FOREIGN KEY ("assetId")
        REFERENCES "assets"("id") ON DELETE CASCADE
    )`);

    // Mirrors the contract: register_private_prompt asserts price > 0 and takes
    // an i128, so anything outside that range can never be registered.
    await queryRunner.query(
      `ALTER TABLE "prompt_publications" ADD CONSTRAINT "CHK_prompt_publications_price" CHECK ("priceAtomic" > 0 AND "priceAtomic" <= 170141183460469231731687303715884105727)`,
    );

    // PUBLISHED is only reachable with authoritative on-chain evidence. The
    // acceptance criterion lives in the schema rather than in service code, so
    // no future caller can mark a row published without it.
    await queryRunner.query(
      `ALTER TABLE "prompt_publications" ADD CONSTRAINT "CHK_prompt_publications_published_evidence" CHECK ("state" <> 'PUBLISHED' OR ("commitment" IS NOT NULL AND "contractId" IS NOT NULL AND "transactionHash" IS NOT NULL AND "ledgerSequence" IS NOT NULL))`,
    );

    // One publication per asset. Declared as a named index, not a table
    // constraint, so `synchronize` (dev and CI) and this migration produce the
    // same database object.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UX_prompt_publications_asset" ON "prompt_publications" ("assetId")`,
    );

    // Partial uniqueness: a retry cannot create a second contract record for
    // the same commitment or reuse a transaction hash.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UX_prompt_publications_commitment" ON "prompt_publications" ("commitment") WHERE "commitment" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UX_prompt_publications_tx" ON "prompt_publications" ("transactionHash") WHERE "transactionHash" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_prompt_publications_work" ON "prompt_publications" ("state", "updatedAt")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_prompt_publications_work"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "UX_prompt_publications_tx"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UX_prompt_publications_commitment"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UX_prompt_publications_asset"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "prompt_publications"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "prompt_publication_state_enum"`,
    );
  }
}
