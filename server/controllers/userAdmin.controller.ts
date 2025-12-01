require("dotenv").config();
import { Request, Response, NextFunction } from "express";
import userAdminModel, { IUser } from "../models/userAdmin.model";
import { ErrorHandler } from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import ejs from "ejs";
import path from "path";
import sendMail from "../utils/sendMail";
import {
    accessTokenOptions,
    refreshTokenOptions,
    sendToken,
} from "../utils/jwt";
import { redis } from "../utils/redis";
import { getUserById, updateUserService } from "../services/userAdmin.service";

// register user
interface IRegistrationBody {
    name: string;
    email: string;
    password: string;
    avatar?: {
        public_id: string;
        url: string;
    };
}

export const registrationUser = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { name, email, password, avatar } = req.body;

            const isEmailExist = await userAdminModel.findOne({ email });
            if (isEmailExist) {
                return next(new ErrorHandler("Email already exists", 400));
            }

            const user: IRegistrationBody = {
                name,
                email,
                password,
                avatar
            };

            const activationToken = createActivationToken(user);
            const activationCode = activationToken.activationCode;

            const data = { user: { name: user.name }, activationCode };
            const html = await ejs.renderFile(
                path.join(__dirname, "../mails/activation-mail.ejs"),
                data
            );

            try {
                await sendMail({
                    email: user.email,
                    subject: "Activate your account",
                    template: "activation-mail.ejs",
                    data,
                });

                res.status(201).json({
                    success: true,
                    message: `Please check your email: ${user.email} to activate your account!`,
                    activationToken: activationToken.token,
                });
            } catch (error: any) {
                return next(new ErrorHandler(error.message, 400));
            }
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }
);

interface IActivationToken {
    token: string;
    activationCode: string;
}

export const createActivationToken = (user: any): IActivationToken => {
    const activationCode = Math.floor(1000 + Math.random() * 9000).toString();

    const token = jwt.sign(
        {
            user,
            activationCode,
        },
        process.env.ACTIVATION_SECRET as Secret,
        {
            expiresIn: "60d",
        }
    );

    return { token, activationCode };
};

// activate user
interface IActivationRequest {
    activation_token: string;
    activation_code: string;
}

export const activateUser = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { activation_token, activation_code } =
                req.body as IActivationRequest;

            const newUser: { user: IUser; activationCode: string } = jwt.verify(
                activation_token,
                process.env.ACTIVATION_SECRET as string
            ) as { user: IUser; activationCode: string };

            if (newUser.activationCode !== activation_code) {
                return next(new ErrorHandler("Invalid activation code", 400));
            }

            const { name, email, password, avatar } = newUser.user;

            const existUser = await userAdminModel.findOne({ email });

            if (existUser) {
                return next(new ErrorHandler("Email already exists", 400));
            }

            const user = await userAdminModel.create({
                name,
                email,
                password,
                avatar,
                role: "admin",
                isVerified: true,
                courses: []
            });

            res.status(201).json({
                success: true,
                message: "Account activated successfully"
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }
);

// Login user
interface ILoginRequest {
    email: string;
    password: string;
}

export const loginUser = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email, password } = req.body as ILoginRequest;

            if (!email || !password) {
                return next(
                    new ErrorHandler("Please enter email and password", 400)
                );
            }

            const user = await userAdminModel
                .findOne({ email, role: "admin" })
                .select("+password");

            if (!user) {
                return next(
                    new ErrorHandler("Invalid email or password", 400)
                );
            }

            const isPasswordMatch = await user.comparePassword(password);
            if (!isPasswordMatch) {
                return next(
                    new ErrorHandler("Invalid email or password", 400)
                );
            }

            sendToken(user, 200, res);
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }
);

// logout user
export const logoutUser = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            res.cookie("access_token", "", { maxAge: 1 });
            res.cookie("refresh_token", "", { maxAge: 1 });
            
            const userId = req.user?._id || "";
            if (typeof userId === "string" && userId.length > 0) {
                await redis.del(userId);
            }
            
            res.status(200).json({
                success: true,
                message: "Logged out successfully",
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }
);

// update access token
export const updateAccessToken = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const refresh_token = req.cookies.refresh_token as string;

            if (!refresh_token) {
                return next(new ErrorHandler("No refresh token provided", 400));
            }

            let decoded: JwtPayload;

            try {
                decoded = jwt.verify(refresh_token, process.env.REFRESH_TOKEN as string) as JwtPayload;
            } catch (error) {
                return next(new ErrorHandler("Invalid or expired refresh token", 400));
            }

            if (!decoded || !decoded.id) {
                return next(new ErrorHandler("Invalid token payload", 400));
            }

            const session = await redis.get(decoded.id as string);

            if (!session) {
                return next(
                    new ErrorHandler("Please login to access this resource", 401)
                );
            }

            const user = JSON.parse(session);

            // Verify user is an admin
            if (user.role !== "admin") {
                return next(
                    new ErrorHandler("Access denied: Admin privileges required", 403)
                );
            }

            const accessToken = jwt.sign(
                { id: user._id },
                process.env.ACCESS_TOKEN as string,
                {
                    expiresIn: "60d",
                }
            );

            const newRefreshToken = jwt.sign(
                { id: user._id },
                process.env.REFRESH_TOKEN as string,
                {
                    expiresIn: "60d",
                }
            );

            req.user = user;

            res.cookie("access_token", accessToken, accessTokenOptions);
            res.cookie("refresh_token", newRefreshToken, refreshTokenOptions);

            // Extend session expiration in Redis
            await redis.set(user._id, JSON.stringify(user), "EX", 604800); // 7 days

            res.status(200).json({
                success: true,
                accessToken,
                refreshToken: newRefreshToken,
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 500));
        }
    }
);

// get admin info
export const getAdminInfo = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?._id;
            if (typeof userId === 'string') {
                const user = await userAdminModel.findById(userId);
                
                if (!user || user.role !== "admin") {
                    return next(new ErrorHandler("Admin not found", 404));
                }
                
                getUserById(userId, res);
            } else {
                return next(new ErrorHandler("Invalid user ID", 400));
            }
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }
);

// update user password
export const updateUserPasswordController = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { oldPassword, newPassword } = req.body;
            const userId = req.user?._id;

            if (typeof userId === 'string') {
                const user = await userAdminModel.findById(userId).select("+password");
                
                if (!user) {
                    return next(new ErrorHandler("User not found", 404));
                }
                
                const isPasswordMatch = await user.comparePassword(oldPassword);
                if (!isPasswordMatch) {
                    return next(new ErrorHandler("Old password is incorrect", 400));
                }
                
                user.password = newPassword;
                await user.save();
                
                res.status(200).json({
                    success: true,
                    message: "Password updated successfully",
                });
            } else {
                return next(new ErrorHandler("Invalid user ID", 400));
            }
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }
);

// update user profile
export const updateUserAdminProfileController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, email } = req.body;
        const userId = req.user?._id;
        if (typeof userId ==='string') {
            const user = await userAdminModel.findById(userId);
            if (!user) {
                return next(new ErrorHandler("User not found", 404));
            }
            
            user.name = name || user.name;
            user.email = email || user.email;
            
            const updateResult = await updateUserService(userId, req.body);
            
            res.status(200).json({
                success: true,
                message: "Profile updated successfully",
                updateResult,
            });
        }
        else {
            return next(new ErrorHandler("Invalid user ID", 400));
        }
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
}