import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthChallenges1700000005000 implements MigrationInterface {
  name = 'AddAuthChallenges1700000005000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "auth_challenges" (
      "publicKey" varchar(56) PRIMARY KEY,
      "challenge" varchar(128) NOT NULL,
      "expiresAt" timestamptz NOT NULL
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_challenges_expiresAt" ON "auth_challenges" ("expiresAt")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_auth_challenges_expiresAt"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "auth_challenges"`);
  }
}
