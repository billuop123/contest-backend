import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
declare module "express-serve-static-core" {
  interface Request {
    user: string;
    isAdmin?: boolean;
  }
}
declare global{
interface JwtPayload {
  userId: string;
  admin: boolean;
}}
export function adminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }
  try {
    const decoded_token = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as JwtPayload;
    req.user = decoded_token.userId;
    req.isAdmin = decoded_token.admin;
    if (decoded_token.admin) {
      next();
    }else{
        return res.status(401).json({
            message:"You are not an admin"
        })
    }
  } catch (e) {
    return res.status(401).json({
      message: "The jwt token is not valid",
    });
  }
}
