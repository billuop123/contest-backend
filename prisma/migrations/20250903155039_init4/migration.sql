/*
  Warnings:

  - A unique constraint covering the columns `[contestId,userId]` on the table `Leaderboard` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Leaderboard_contestId_userId_key" ON "public"."Leaderboard"("contestId", "userId");
