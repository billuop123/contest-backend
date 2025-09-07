import bcrypt from "bcryptjs";
import { prisma } from "./prismaClient";
import nodemailer from "nodemailer";
interface EmailOptions {
  email: string;
  emailType: "VERIFY"|"RESET";
  userId: string;
}
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "465"),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});
export const sendEmail = async ({ email, emailType, userId }: EmailOptions) => {
  try {
    const hashedToken = await bcrypt.hash(userId, 10);
    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        hashedToken,
        verifiedTokenExpiry: new Date(Date.now() + 3600000000),
      },
    });
    const verifyUrl=`${process.env.FRONTEND_URL}/verifyemail?token=${hashedToken}&userId=${userId}`
    console.log(process.env.FRONTEND_URL)
    const mailResponse = await transporter.sendMail({
        from:"biplovthapa456@gmail.com",
        to:email,
        subject:emailType=="VERIFY"?"verify your email":"",
        html:`<p>Click here to verify your email <a href="${verifyUrl}">here</a>
        </p>`
    });
    return mailResponse
  } catch (e:any) {
    throw new Error(e.message)
  }
};
