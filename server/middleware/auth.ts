import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "./catchAsyncError";
import { ErrorHandler } from "../utils/ErrorHandler";
import jwt, { JwtPayload } from "jsonwebtoken";
import UserModel from "../models/user.model";
import UserAdminModel from "../models/userAdmin.model";

export const isAuthenticated = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    let access_token = req.cookies.access_token as string;

    if (!access_token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        access_token = authHeader.split(' ')[1];
      }
    }

    if (!access_token) {
      return next(
        new ErrorHandler("Please login to access this resource", 400)
      );
    }

    const decoded = jwt.decode(access_token) as JwtPayload;

    if (!decoded) {
      return next(new ErrorHandler("Access token is not valid", 400));
    }

    if (decoded.exp && decoded.exp <= Date.now() / 1000) {
      return next(new ErrorHandler("Access token has expired", 401));
    }

    try {
      // Direct database lookup (no Redis caching)
      let user = await UserModel.findById(decoded.id).select('-password');
      
      if (!user) {
        user = await UserAdminModel.findById(decoded.id).select('-password');
      }
      
      if (!user) {
        return next(
          new ErrorHandler("User not found. Please login again.", 401)
        );
      }

      req.user = user;
      next();

    } catch (error: any) {
      return next(
        new ErrorHandler("Authentication failed. Please login again.", 401)
      );
    }
  }
);

export const authorizeRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user?.role || "")) {
      return next(
        new ErrorHandler(
          `Role: ${req.user?.role} is not allowed to access this resource`,
          403
        )
      );
    }
    next();
  };
};