import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken"
interface AuthRequest extends Request{
    user:string,
    isAdmin?:boolean
}
interface JwtPayload{
    userId:string,
    admin:boolean
}
export function userMiddleware(req:Request,res:Response,next:NextFunction){
    try{
        const token=req.headers.authorization
        if(!token){
            return res.status(401).json({
                message:"No token found"
            })
        }
        const verified_token=jwt.verify(token,process.env.JWT_SECRET!) as JwtPayload;
        const authReq=req as AuthRequest
        authReq.user=verified_token.userId
        authReq.isAdmin=verified_token.admin
        next()
    }catch(e){
        return res.status(401).json({
            message:"Invalid token"
        })
    }
}