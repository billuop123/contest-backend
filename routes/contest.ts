import express, { type Request, type Response } from "express";
import { userMiddleware } from "../middlewares/userMiddleware";
import { prisma } from "../utils/prismaClient";
export const router = express.Router();
import { createClient } from "redis";
import { getLeaderboard } from "../utils/helperFunctions";
const redisClient = await createClient()
  .on("error", (err) => console.log("Redis Client Error", err))
  .connect();
router.get("/active", userMiddleware, async (req: Request, res: Response) => {
  try{
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;
  const now=new Date()    
  const [contests,total]=await Promise.all([
    prisma.contest.findMany({
      where:{
        startTime:{
          lte:now,
        },
        endTime:{
          gte:now
        } 
      },
      take:limit,
      skip,
      orderBy:{startTime:"asc"}
    }),
    prisma.contest.count({
      where:{
        startTime:{lte:now},
        endTime:{gte:now}
      }
    })
  ])
  res.status(200).json({
    page,
    limit,
    total,
    contests
  });}
  catch(e){
    return res.status(500).json({
      message:"Internal Server Error"
    })
  }
});
router.get("/inactive", async (req, res) => {
  try{
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const now=new Date()
    const [contests,total]=await  Promise.all([
      prisma.contest.findMany({
        where:{endTime:{lte:now}},
        take:limit,
        skip,
        orderBy:{startTime:'asc'}
      }),prisma.contest.count({
        where:{
          endTime:{lte:now}
        }
      })
    ])
    res.status(200).json({
      page,
      limit,
      total,
      contests
    })
  }catch(e){
    res.status(500).json({
      message:"Internal Server Error"
    })
  }
});
router.get("/:contestId", async (req, res) => {
  try {
    const { contestId } = req.params;
    if (!contestId) {
      return res.status(404).json({
        message: "there is no required inputs",
      });
    }
    const contest = await prisma.contest.findUnique({
      where: {
        id: contestId,
      },
    });
    if (!contest) {
      return res.status(404).json({
        message: "there is no record of specific input",
      });
    }
    res.status(200).json({
      contest,
    });
  } catch (e) {
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

router.get("/leaderboard/:contestId", userMiddleware, async (req, res) => {
  try {
    const { contestId } = req.params;
    if (!contestId) {
      return res.status(404).json({
        message: "there is no required inputs",
      });
    }
    const topUsers = await redisClient.zRangeWithScores(
      `leaderboard:${contestId}`,
      0,
      -1,
      {
        REV: true,
      }
    );
    if (topUsers.length>0) {
      return res.json({
        topUsers,
      });
    }else{
    const contest = await prisma.contest.findUnique({
      where: {
        id: contestId,
      },
    });
    if (!contest) {
      return res.status(404).json({
        message: "there is no record of specific input",
      });
    }
    const topUsersRevived=await getLeaderboard(contestId)
    return res.status(200).json({
      topUsers:topUsersRevived,
    });}
  } catch (e) {
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

