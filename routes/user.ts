import express, { type Request, type Response } from "express";
import { prisma } from "../utils/prismaClient";
import z from "zod";
import { sendEmail } from "../utils/email";
import jwt from "jsonwebtoken";
export const router = express.Router();
const signupInput = z.object({
  username: z.string(),
  password: z.string(),
  confirmPassword: z.string(),
  email: z.string().email()
});
import OpenAI from "openai";
import { userMiddleware } from "../middlewares/userMiddleware";
import { createClient } from "redis";
import { verificationMiddlware } from "../middlewares/verificationMiddleware";

const redisClient = await createClient({url:process.env.REDIS_URL})
  .on("error", (err) => console.log("Redis Client Error", err))
  .connect();
const client = new OpenAI();
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { username, password, confirmPassword ,email} = req.body;
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
      return res.status(403).json({
        message: "User already exists",
      });
    }
    const existingUsername=await prisma.user.findUnique({
      where:{
        username
      }
    })
    if(existingUsername){
      return res.status(403).json({
        message:"Username is not available"
      })
    }
    const newUser = await prisma.user.create({
      data: {
        username,
        password,
        email
      },
    });
    try {
      await sendEmail({ email, emailType: "VERIFY", userId: newUser.id });
    } catch (e) {
      // Ignore email errors for now
    }
    res.status(200).json({
      message: "The user is successfully signedup",
    });
  } catch (e:any) {
    console.log(e.message)
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
    res.cookie("token", token, {
      httpOnly: true,  
      secure: true,    
      sameSite: "strict", 
      maxAge: 24 * 60 * 60 * 1000 
    });
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
router.get("/verify",async (req, res) => {
  try {
    console.log("/verify called")
    const { hashedToken,userId } = req.query;
    if (!hashedToken || !userId) {
      return res.status(404).json({
        message: "required fields are not found",
      });
    }
    const unverifiedUser = await prisma.user.findFirst({
      where: {
        id: userId as string,
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
          id: userId as string,
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
router.post("/submissions", userMiddleware, verificationMiddlware,async (req: Request, res: Response) => {
  try {
    const { submissions, contestToChallengeMappingId } = req.body;
    if (!submissions || !contestToChallengeMappingId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user } });
    if (!user) return res.status(404).json({ message: "User not found" });

    const mapping = await prisma.contestToChallengeMapping.findUnique({
      where: { id: contestToChallengeMappingId },
    });
    if (!mapping) return res.status(404).json({ message: "Invalid contest mapping" });

    const challenge = await prisma.challenge.findUnique({
      where: { id: mapping.challengeId },
      select: { notionDocId: true, title: true, body: true, maxPoints: true },
    });

    const contest = await prisma.contest.findUnique({ where: { id: mapping.contestId } });
    if (!contest) return res.status(404).json({ message: "Contest not found" });

    if (Number(contest.endTime) < Date.now())
      return res.status(403).json({ message: "The contest deadline is over" });
    const response = await client.responses.create({
      model: "gpt-5",
      input: [
        {
          role: "system",
          content: `You are an evaluator for DevForces. You should evaluate on the basis on one file text given you.
            Donot refer whats need to be on the next files,for example if the task is creating a express server and user defines a port 3000,
            then donot repond with some thing like that should have been on the .env folder ,evaluate on the basis of one file text.
            When make sure to return feedback in a paragraph format.
            if user is writing any unnecessary message insted of the code then respond with something like lets talk about coding,i donot know about 
            other things in feedback.
            Rate the code on a scale of 1–${challenge?.maxPoints}.
            Challenge context: ${challenge?.body}, title: ${challenge?.title}
            Return strictly in JSON: { "score": string, "feedback": string }`,
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

    let newSubmission;
    if(previousSubmission?.submission==submissions){
      return res.status(200).json({
        points: previousSubmission?.points,
        feedback: "You have already submitted this code try,different one!!",
        
      })
    }
    if (!previousSubmission || score > previousSubmission.points) {
      newSubmission = await prisma.submission.create({
        data: {
          submission: submissions,
          contestToChallengeMappingId,
          userId: req.user,
          points: score,
          feedback: parsed.feedback,
        },
        select: { points: true, feedback: true },
      });
    } else {
      newSubmission = previousSubmission;
    }
    const bestSubmissions = await prisma.submission.findMany({
      where: {
        userId: req.user,
        contestToChallengeMapping: { contestId: mapping.contestId },
      },
      distinct: ["contestToChallengeMappingId"], 
      orderBy: { points: "desc" }, 
    });

    const totalScore = bestSubmissions.reduce((sum, s) => sum + s.points, 0);
    const redisKey = `leaderboard:${mapping.contestId}`;
    await redisClient.zAdd(redisKey, [{ score: totalScore, value: user.username }]);
    await prisma.leaderboard.upsert({
      where: { contestId_userId: { contestId: mapping.contestId, userId: req.user } },
      update: { score: totalScore },
      create: { contestId: mapping.contestId, userId: req.user, score: totalScore },
    });

    return res.status(200).json({
      message: "Submitted successfully",
      points: newSubmission.points,
      feedback: newSubmission.feedback,
      totalScore,
    });
  } catch (e: any) {
    console.error(e.message);
    return res.status(500).json({ message: "Internal server error" });
  }
});
router.get("/isadmin",(req:Request,res:Response)=>{
  try{
    const {jwtToken}=req.query 
    if(!jwtToken){
      return res.status(404).json({
        message:"The token is not found"
      })
    }
    const decodedToken=jwt.decode(jwtToken as string)
    if(!decodedToken || typeof decodedToken==="string"){
      return res.status(400).json({
        message:"Invalid token"
      })
    }
    return res.status(200).json({
      isAdmin:decodedToken.admin
    })
  }
    catch(e){
      
      return res.status(500).json({
        message:"Internal server error"
      })
    }
})
router.get("/isloggedin",async (req:Request,res:Response)=>{
  try{
    const token=req.cookies.token 
    if(!token){
      return res.status(200).json({
        isLoggedIn:false
      })
    }
    const decodedToken=jwt.decode(token as string)
    if(!decodedToken || typeof decodedToken==="string"){
      return res.status(400).json({
        message:"Invalid token"
      })
    }
    const user=await prisma.user.findFirst({
      where:{
        id:decodedToken.userId
      }
    })
    
    return res.status(200).json({
      isLoggedIn:user?true:false
    })
  }
    catch(e:any){
        console.log(e.message)
      return res.status(500).json({
        message:"Internal server error"
      })
    }
})

router.get('/gettoken',(req,res)=>{
  const token=req.cookies.token
  if(!token){
    return res.status(404).json({
      message:"token is not found"
    })
  }
  return res.status(200).json({
    token
  })
})

router.get('/logout',(req,res)=>{
  try{
  res.cookie("token", "", {
    httpOnly: true,
    secure: true,  
    sameSite: "strict",   
    expires: new Date(0), 
  })
  return res.status(200).json({
    message:"Logged out successfully"
  })
}catch(e){
  return res.status(500).json({
    message:"Failed to logout"
  })
}
})
router.get('/isverified',userMiddleware,async(req,res)=>{
  try{
    const user=await prisma.user.findUnique({
      where:{
        id:req.user
      }
    })
    return res.status(200).json({
      isverified:user?.isVerified
    })
  }catch{
    res.status(500).json({
      message:"Internal server error"
    })
  }
})