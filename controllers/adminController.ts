import type { Request, Response } from "express";
import z from "zod";
import { prisma } from "../utils/prismaClient";
const contestInput = z.object({
  title: z.string(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
});
export const createContest=async (req:Request, res:Response) => {
  try {
    const parsedBody = contestInput.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(403).json({
        message: "The inputs are not valid",
      });
    }
    const { title, startTime, endTime } = parsedBody.data;
    const newContest = await prisma.contest.create({
      data: {
        title,
        startTime,
        endTime,
      },
    });
    res.status(200).json({
      message: "Contest successfully created",
      contest: newContest,
    });
  } catch (e) {
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export const createchallenge=async (req:Request, res:Response) => {
    try {
      const { notionDocId, title, maxPoints, index, contestId, body, examples } =
        req.body;
      if (
        !notionDocId ||
        !title ||
        !maxPoints ||
        !contestId ||
        !body 
      ) {
        return res.status(404).json({
          message: "The required input fields are missing",
        });
      }
      const contest = await prisma.contest.findFirst({
        where: {
          id: contestId,
        },
      });
      if (Number(contest?.endTime) < Number(Date.now())) {
        return res.status(403).json({
          message: "Deadline is over",
        });
      }
      const challenge = await prisma.challenge.create({
        data: {
          title,
          notionDocId,
          maxPoints:Number(maxPoints),
          body,
          examples,
        },
      });
      await prisma.contestToChallengeMapping.create({
        data: {
          challengeId: challenge.id,
          contestId,
          index,
        },
      });
      return res.status(200).json({
        message: "The challange is successfully created",
        contestId,
        challengeId: challenge.id,
        challenge
      });
    } catch (e:any) {
      console.log(e.message)
      return res.status(500).json({
        message: "Internal Server Error",
      });
    }
  }