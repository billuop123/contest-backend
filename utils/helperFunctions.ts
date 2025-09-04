import { createClient } from "redis";
import { prisma } from "./prismaClient";
const redisClient = await createClient()
  .on("error", (err) => console.log("Redis Client Error", err))
  .connect();
export async function  getLeaderboard(contestId:string){
    const leaderboard = await prisma.leaderboard.findMany({
        where: {
          contestId,
        },
      });
      await Promise.all(leaderboard.map(async(item)=>{
          await redisClient.zAdd(
              `leaderboard:${item.contestId}`,
              [{ score: item.score, value: item.userId }]
            );
      }))
      const topUsersRevived = await redisClient.zRangeWithScores(
          `leaderboard:${contestId}`,
          0,
          -1,
          {
            REV: true,
          }
        );
        return topUsersRevived
}