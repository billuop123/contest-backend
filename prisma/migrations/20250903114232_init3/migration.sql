-- AlterTable
ALTER TABLE "public"."ContestToChallengeMapping" ALTER COLUMN "index" DROP DEFAULT;
DROP SEQUENCE "ContestToChallengeMapping_index_seq";

-- AlterTable
ALTER TABLE "public"."Submission" ADD COLUMN     "feedback" TEXT;

-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "isVerified" SET DEFAULT true;
