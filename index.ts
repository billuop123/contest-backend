import express from "express"
import {router as contestRouter} from "./routes/contest"
import { router as userRouter } from "./routes/user"
import {router as adminRouter} from './routes/admin'

export const app=express()
app.use(express.json())
app.use("/users",userRouter)
app.use("/contest",contestRouter)
app.use("/admin",adminRouter)

