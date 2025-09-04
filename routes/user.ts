import express, { type Request, type Response } from "express";
import { prisma } from "../utils/prismaClient";
import z from "zod";
import { sendEmail } from "../utils/email";
import jwt from "jsonwebtoken";
export const router = express.Router();
const signupInput = z.object({
  email: z.email(),
  password: z.string(),
  confirmPassword: z.string(),
});
import OpenAI from "openai";
import { userMiddleware } from "../middlewares/userMiddleware";
import { createClient } from "redis";

const redisClient = await createClient()
  .on("error", (err) => console.log("Redis Client Error", err))
  .connect();
const client = new OpenAI();
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { email, password, confirmPassword } = req.body;
    if (password !== confirmPassword) {
      return res.status(403).json({
        message: "passwords donot match",
      });
    }
    const parsedBody = signupInput.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(403).json({
        message: "incorrect inputs",
      });
    }
    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });
    if (existingUser) {
      return res.json({
        message: "User already exists",
      });
    }
    const newUser = await prisma.user.create({
      data: {
        email,
        password,
      },
    });
    sendEmail({ email, emailType: "VERIFY", userId: newUser.id });
    res.status(200).json({
      message: "The user is successfully signedup",
    });
  } catch (e) {
    res.status(500).json({
      message: "Internal server error",
    });
  }
});
const signinInputs = z.object({
  email: z.email(),
  password: z.string(),
});
router.post("/signin", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const parsedBody = signinInputs.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(403).json({
        message: "The input fields are not valid",
      });
    }
    const user = await prisma.user.findUnique({
      where: {
        email,
        password,
      },
    });
    if (!user) {
      return res.status(404).json({
        message: "The user and password donot match",
      });
    }
    const token = jwt.sign(
      { userId: user.id, admin: user.role == "admin" },
      process.env.JWT_SECRET!
    );
    return res.status(200).json({
      message: "User successfully signed in",
      token,
    });
  } catch (e) {
    res.status(500).json({
      message: "Internal server error",
    });
  }
});
router.post("/verify", async (req, res) => {
  try {
    const { hashedToken } = req.query;
    const { userId } = req.body;
    if (!hashedToken || !userId) {
      return res.status(404).json({
        message: "required fields are not found",
      });
    }
    const unverifiedUser = await prisma.user.findFirst({
      where: {
        id: userId,
        hashedToken: hashedToken as string,
      },
    });
    if (!unverifiedUser) {
      return res.status(404).json({
        message: "Unverified user is not found",
      });
    }
    if (Date.now() > Number(unverifiedUser.verifiedTokenExpiry)) {
      return res.status(403).json({
        message: "Token is expired",
      });
    }
    if (unverifiedUser.isVerified === false) {
      await prisma.user.update({
        where: {
          id: userId,
          hashedToken: hashedToken as string,
        },
        data: {
          isVerified: true,
        },
      });
      return res.status(200).json({
        message: "User is successfully verified",
      });
    }
    return res.status(404).json({
      message: "The unverified user is not found",
    });
  } catch (e) {
    res.status(500).json({
      message: "Internal server error",
    });
  }
});

interface llmOutput {
  score: number;
  feedback: string;
}
router.post("/submissions", userMiddleware, async (req: Request, res: Response) => {
  try {
    const { submissions, contestToChallengeMappingId } = req.body;

    const contestToChallengeMapping = await prisma.contestToChallengeMapping.findUnique({
      where: { id: contestToChallengeMappingId },
    });
    if (!contestToChallengeMapping) {
      return res.status(404).json({ message: "Invalid contest mapping" });
    }

    const challenge = await prisma.challenge.findUnique({
      where: { id: contestToChallengeMapping.challengeId },
      select: { notionDocId: true, title: true },
    });
    const contest=await prisma.contest.findUnique({
      where:{
        id:contestToChallengeMapping.contestId
      }
    })
    if(Number(contest?.endTime)<Number(Date.now())){
      return res.status(403).json({
        message:"The deadline for the following contest is already over"
      })
    }
    const response = await client.responses.create({
      model: "gpt-5",
      input: [
        {
          role: "system",
          content: `You are an evaluator for DevForces. 
            Rate the code on a scale of 1–10.
            For this challenge the context is ${challenge?.notionDocId}.
            Return strictly in schema: { "score": string, "feedback": string }.
            Feedback should be a full paragraph. the return format should stricly be json,like above`,
        },
        { role: "user", content: submissions },
      ],
    });

    const parsed: llmOutput = JSON.parse(response.output_text);
    const score = Number(parsed.score);

    const previousSubmission = await prisma.submission.findFirst({
      where: {
        contestToChallengeMappingId,
        userId: req.user,
      },
      orderBy: { createdAt: "desc" },
    });

    const newSubmission = await prisma.submission.create({
      data: {
        submission: submissions,
        contestToChallengeMappingId,
        userId: req.user,
        points: score,
        feedback: parsed.feedback,
      },
      select: { points: true, feedback: true },
    });

    if (previousSubmission) {
      if (score > previousSubmission.points) {
        const currentScore = await redisClient.zScore(
          `leaderboard:${contestToChallengeMapping.contestId}`,
          req.user
        );
        const newContestScore = (currentScore ?? 0) - previousSubmission.points + score;

        await redisClient.zAdd(
          `leaderboard:${contestToChallengeMapping.contestId}`,
          [{ score: newContestScore, value: req.user }]
        );
      }
    } else {
      await redisClient.zIncrBy(
        `leaderboard:${contestToChallengeMapping.contestId}`,
        score,
        req.user
      );
    }

    const newScore = await redisClient.zScore(
      `leaderboard:${contestToChallengeMapping.contestId}`,
      req.user
    );
    await prisma.leaderboard.upsert({
      where: {
        contestId_userId: {
          contestId: contestToChallengeMapping.contestId,
          userId: req.user,
        },
      },
      update: { score: newScore ?? 0 },
      create: {
        contestId: contestToChallengeMapping.contestId,
        score: newScore ?? 0,
        userId: req.user,
      },
    });

    return res.status(200).json({
      message: "Submitted successfully",
      points: newSubmission.points,
      feedback: newSubmission.feedback,
    });
  } catch (e: any) {
    return res.status(500).json({ message: "Internal server error" });
  }
});

