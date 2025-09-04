-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "hashedToken" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false;
