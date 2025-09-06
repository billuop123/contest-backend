import type { NextFunction, Request, Response } from "express";
import { prisma } from "../utils/prismaClient";

export async function verificationMiddlware(req:Request,res:Response,next:NextFunction){
    const isVerified=await prisma.user.findUnique({
        where:{
            id:req.user,
            isVerified:true
        }
    })
    if(isVerified){
        next()
    }else{
        return res.status(403).json({
            message:"User is not verified"
        })
    }
}