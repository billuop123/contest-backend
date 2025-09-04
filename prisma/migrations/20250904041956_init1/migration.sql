/*
  Warnings:

  - Added the required column `Examples` to the `Challenge` table without a default value. This is not possible if the table is not empty.
  - Added the required column `body` to the `Challenge` table without a default value. This is not possible if the table is not empty.
  - Added the required column `header` to the `Challenge` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Challenge" ADD COLUMN     "Examples" TEXT NOT NULL,
ADD COLUMN     "body" TEXT NOT NULL,
ADD COLUMN     "header" TEXT NOT NULL;
