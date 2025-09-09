import express from "express";
import { getToken, isAdmin, isloggedin, isVerified, logout, signin, signup, userSubmission, verifyUser } from "../controllers/userController";
import { userMiddleware } from "../middlewares/userMiddleware";
import { verificationMiddlware } from "../middlewares/verificationMiddleware";
export const router = express.Router();
router.post("/signup",signup);
router.post("/signin",signin);
router.get("/verify",verifyUser);
router.post("/submissions", userMiddleware, verificationMiddlware,userSubmission);
router.get("/isadmin",isAdmin)
router.get("/isloggedin",isloggedin)
router.get('/gettoken',getToken)
router.get('/logout',logout)
router.get('/isverified',userMiddleware,isVerified)