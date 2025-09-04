/*
  Warnings:

  - You are about to drop the column `Examples` on the `Challenge` table. All the data in the column will be lost.
  - You are about to drop the column `header` on the `Challenge` table. All the data in the column will be lost.
  - Added the required column `examples` to the `Challenge` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Challenge" DROP COLUMN "Examples",
DROP COLUMN "header",
ADD COLUMN     "examples" TEXT NOT NULL;
