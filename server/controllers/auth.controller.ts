// controllers/auth.controller.ts
import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import { ErrorHandler } from "../utils/ErrorHandler";
import userAdminModel from "../models/userAdmin.model";
import jwt, { Secret } from "jsonwebtoken";
import sendMail from "../utils/sendMail";
import path from "path";
import { redis } from "../utils/redis";

// forgot password
interface IForgotPassword {
    email: string;
}

export const forgotPassword = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email } = req.body as IForgotPassword;

            const user = await userAdminModel.findOne({ email });

            if (!user) {
                return next(new ErrorHandler("User not found", 404));
            }

            // Generate reset token
            const resetToken = jwt.sign(
                { id: user._id },
                process.env.RESET_PASSWORD_SECRET as Secret,
                {
                    expiresIn: "60d",
                }
            );

            // Generate reset code
            const resetCode = Math.floor(1000 + Math.random() * 9000).toString();

            // Store reset info in Redis
            await redis.set(`resetPassword:${resetToken}`, JSON.stringify({
                userId: user._id,
                resetCode
            }), "EX", 900); // 15 minutes

            const data = {
                user: {
                    name: user.name
                },
                resetCode
            };

            try {
                await sendMail({
                    email: user.email,
                    subject: "Reset Your Password",
                    template: "reset-password-mail.ejs",
                    data,
                });

                res.status(200).json({
                    success: true,
                    message: "Password reset instructions sent to your email",
                    resetToken
                });
            } catch (error: any) {
                await redis.del(`resetPassword:${resetToken}`);
                return next(new ErrorHandler(error.message, 400));
            }
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }
);

// verify reset token and code
interface IVerifyReset {
    resetToken: string;
    resetCode: string;
}

export const verifyResetToken = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Changed from req.body to req.query since it's a GET request
            const { resetToken, resetCode } = req.query as { resetToken: string; resetCode: string };
            
            if (!resetToken || !resetCode) {
                return next(new ErrorHandler("Reset token and code are required", 400));
            }

            const resetInfo = await redis.get(`resetPassword:${resetToken}`);
            
            if (!resetInfo) {
                return next(new ErrorHandler("Reset token is invalid or has expired", 400));
            }

            const { resetCode: storedCode } = JSON.parse(resetInfo);

            if (resetCode !== storedCode) {
                return next(new ErrorHandler("Invalid reset code", 400));
            }

            res.status(200).json({
                success: true,
                message: "Reset token verified successfully"
            });

        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }
);
// reset password
interface IResetPassword {
    resetToken: string;
    newPassword: string;
}

export const resetPassword = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { resetToken, newPassword } = req.body as IResetPassword;

            const resetInfo = await redis.get(`resetPassword:${resetToken}`);

            if (!resetInfo) {
                return next(new ErrorHandler("Reset token is invalid or has expired", 400));
            }

            const { userId } = JSON.parse(resetInfo);

            const user = await userAdminModel.findById(userId).select("+password");

            if (!user) {
                return next(new ErrorHandler("User not found", 404));
            }

            // Update password
            user.password = newPassword;
            await user.save();

            // Delete reset token from Redis
            await redis.del(`resetPassword:${resetToken}`);

            res.status(200).json({
                success: true,
                message: "Password reset successful"
            });

        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }
);