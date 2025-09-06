import express from "express"
import {router as contestRouter} from "./routes/contest"
import { router as userRouter } from "./routes/user"
import {router as adminRouter} from './routes/admin'
import cookieParser from "cookie-parser"
import cors from "cors"
const app=express()
app.use(cors(
{
    origin:process.env.FRONTEND_URL,
    credentials:true
}
))
app.use(cookieParser())
app.use(express.json())
app.use("/users",userRouter)
app.use("/contest",contestRouter)
app.use("/admin",adminRouter)

export default app