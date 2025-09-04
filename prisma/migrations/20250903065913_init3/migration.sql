-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "verifiedTokenExpiry" TIMESTAMP(3),
ALTER COLUMN "hashedToken" DROP NOT NULL,
ALTER COLUMN "hashedToken" DROP DEFAULT;
