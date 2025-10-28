import { Request,Response, NextFunction } from "express";
import { CatchAsyncError } from "./catchAsyncError";
import {ErrorHandler} from "../utils/ErrorHandler";
import jwt, { JwtPayload } from "jsonwebtoken";
// import {updateAccessToken} from "../controllers/user.controller"
import { redis } from "../utils/redis";

//authenticate user

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

      // check if the access token is expired
      if (decoded.exp && decoded.exp <= Date.now() / 1000) {
          try {
              // await updateAccessToken(req, res, next);
          } catch (error) {
              return next(error);
          }
      } else {
          const user = await redis.get(decoded.id);

          if (!user) {
              return next(
                  new ErrorHandler("Please login to access this resource", 400)
              );
          }

          req.user = JSON.parse(user);

          next();
      }
  }
);

// // validate user role
// export const authorizeRoles = (...roles: string[]) => {
//   return (req: Request, res: Response, next: NextFunction) => {
//     try {
//       if (!req.user) {
//         return next(new ErrorHandler("User not authenticated", 401));
//       }

//       const userRole = req.user.role.toLowerCase();
//       const allowedRoles = roles.map(role => role.toLowerCase());

//       console.log("Role Check:", {
//         userRole,
//         allowedRoles,
//         hasAccess: allowedRoles.includes(userRole)
//       });

//       if (!allowedRoles.includes(userRole)) {
//         return next(
//           new ErrorHandler(
//             `Role: ${req.user.role} is not allowed to access this resource`,
//             403
//           )
//         );
//       }

//       next();
//     } catch (error: any) {
//       return next(new ErrorHandler("Role authorization failed", 403));
//     }
//   };
// };

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
