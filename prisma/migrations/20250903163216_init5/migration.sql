/*
  Warnings:

  - You are about to drop the column `rank` on the `Leaderboard` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Leaderboard_contestId_rank_key";

-- AlterTable
ALTER TABLE "public"."Leaderboard" DROP COLUMN "rank";
