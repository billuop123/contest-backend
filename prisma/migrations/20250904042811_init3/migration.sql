/*
  Warnings:

  - Added the required column `endTime` to the `Contest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Contest" ADD COLUMN     "endTime" TIMESTAMP(3) NOT NULL;
