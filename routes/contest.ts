import express, { type Request, type Response } from "express";
import { createClient } from "redis";
import { userMiddleware } from "../middlewares/userMiddleware";

import { prisma } from "../utils/prismaClient";
import { activeContests, challenges, getChallengesByid, getContestsbyId, getLeaderboardByContests, inactiveContest, mappingId } from "../controllers/contestController";
export const router = express.Router();
const redisClient = await createClient()
  .on("error", (err) => console.log("Redis Client Error", err))
  .connect();
router.get("/active", userMiddleware, activeContests);
router.get("/inactive", userMiddleware,inactiveContest);
router.get('/challenges',userMiddleware,challenges)
router.get("/getcontests/:contestId", userMiddleware,getContestsbyId);

router.get("/leaderboard/:contestId", userMiddleware,getLeaderboardByContests);
router.get('/mappingid',userMiddleware,mappingId)
router.get('/challenges/:challengeId',userMiddleware,getChallengesByid)