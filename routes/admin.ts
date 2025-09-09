import express from "express";
import { createchallenge, createContest } from "../controllers/adminController";
import { adminMiddleware } from "../middlewares/adminMiddleware";
import { verificationMiddlware } from "../middlewares/verificationMiddleware";
export const router = express.Router();
router.post("/createcontest", adminMiddleware,verificationMiddlware,createContest);
router.post("/createchallenge", adminMiddleware,verificationMiddlware,createchallenge);
