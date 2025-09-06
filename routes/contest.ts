import express, { type Request, type Response } from "express";
import { userMiddleware } from "../middlewares/userMiddleware";
import { prisma } from "../utils/prismaClient";
export const router = express.Router();
import { createClient } from "redis";
import { getLeaderboard } from "../utils/helperFunctions";
import { verificationMiddlware } from "../middlewares/verificationMiddleware";
const redisClient = await createClient({url:process.env.REDIS_URL})
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
router.get("/inactive", userMiddleware,async (req, res) => {
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
router.get('/challenges',userMiddleware,async(req,res)=>{
  try{
    const {contestId}=req.query
    if(!contestId){
      return res.status(404).json({
        message:"The contest id is not found"
      })
    }
    const challenges = await prisma.contestToChallengeMapping.findMany({
      where: { contestId: contestId as string },
      include: {
        
        challenge: true, 
        
      },
      orderBy: {
        index: 'asc', 
      },
    });
    
    return res.status(200).json({
      challenges: challenges.map(c => c.challenge),
    });
    
  }catch(e){
    return res.status(500).json(
      {
        message:'Internal Server Error'
      }
    )
  }
})
router.get("/getcontests/:contestId", userMiddleware,async (req, res) => {
  try {
    console.log()
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

router.get("/leaderboard/:contestId", userMiddleware,async (req, res) => {
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
router.get('/mappingid',userMiddleware,async (req,res)=>{
  try{
    const {challengeId}=req.query
    if(!challengeId){
      return res.status(404).json({
        message:"Challenge Id not found"
      })
    }
    const mappingId=await prisma.contestToChallengeMapping.findFirst({
      where:{
        challengeId:challengeId as string
      },select:{
        id:true
      }
    })
    return res.status(200).json({
      mappingId
    })
  }catch{
    return res.status(500).json({
      message:"Internal Server Error"
    })
  }
})
router.get('/challenges/:challengeId',userMiddleware,async(req,res)=>{
  try{
  const {challengeId}=req.params
  if(!challengeId){
    return res.status(404).json({
      message:"challenge Id not found"
    })
  }
  const challenge=await prisma.challenge.findUnique({
    where:{
      id:challengeId as string
    }
  })
  return res.status(200).json({
    challenge
  })
  }catch(e){
    return res.status(404).json({
      message:"Internal server error"
    })
  }
})