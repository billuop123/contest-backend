import { createClient } from "redis";
import { prisma } from "./prismaClient";
const redisHost = process.env.REDIS_HOST || "localhost";
const redisPort = parseInt(process.env.REDIS_PORT || "6379");
console.log(`Attempting to connect to Redis at ${redisHost}:${redisPort}`);
export const redisClient = await createClient({
  socket: {
    host: redisHost,
    port: redisPort,
  },
})
  .on("error", (err) => console.log("Redis Client Error", err))
  .on("connect", () => console.log("Redis client connected"))
  .on("ready", () => console.log("Redis client ready"))
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