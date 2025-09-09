import express from "express";
import { userMiddleware } from "../middlewares/userMiddleware";
import { activeContests, challenges, getChallengesByid, getContestsbyId, getLeaderboardByContests, inactiveContest, mappingId } from "../controllers/contestController";
export const router = express.Router();
router.get("/active", userMiddleware, activeContests);
router.get("/inactive", userMiddleware,inactiveContest);
router.get('/challenges',userMiddleware,challenges)
router.get("/getcontests/:contestId", userMiddleware,getContestsbyId);
router.get("/leaderboard/:contestId", userMiddleware,getLeaderboardByContests);
router.get('/mappingid',userMiddleware,mappingId)
router.get('/challenges/:challengeId',userMiddleware,getChallengesByid)