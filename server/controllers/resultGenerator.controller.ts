// require("dotenv").config();
// import xlsx from 'xlsx';
// import { Request, Response, NextFunction } from "express";

// import { ErrorHandler } from "../utils/ErrorHandler";
// import { CatchAsyncError } from "../middleware/catchAsyncError";
// import QuizSubmissionModel from '../models/QuizSubmissionModel';



// export const generateExcelSheet = CatchAsyncError(
//     async (req: Request, res: Response, next: NextFunction) => {
//         try {
//             await QuizSubmissionModel.find({}).then(result => {
//                 if(result.length > 0){
//                     let response = JSON.parse(JSON.stringify(result));
//                     let workbook = xlsx.utils.book_new();
//                     let worksheet = xlsx.utils.json_to_sheet(response);
//                     xlsx.utils.book_append_sheet(workbook, worksheet, 'Users');
//                     xlsx.writeFile(workbook, 'resultSheet.xlsx');
//                     res.status(200).json({success: true, message: "Excel file generated successfully", response})
//                 }else{
//                     return next(new ErrorHandler("NO data to found to export", 400));
//                 }
//             })
//         } catch (error: any) {
//             return next(new ErrorHandler(error.message, 400));
//         }
//     }
// );



// import mongoose from "mongoose";



import xlsx from "xlsx";
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { ErrorHandler } from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import QuizSubmissionModel from "../models/QuizSubmissionModel";
import ResultModel from "../models/result.model";
import { getResultsByAssignmentId, getStudentQuizResults } from "../services/result.service";

export const downloadExcelSheet = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { assignmentId } = req.params;

      // Validate if assignmentId is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
        return next(new ErrorHandler("Invalid assignmentId format", 400));
      }

      // Fetch data from QuizSubmissionModel
      const quizSubmissions = await QuizSubmissionModel.find({ assignmentId }).exec();

      if (quizSubmissions.length > 0) {
        // Save data to ResultModel
        const results = await ResultModel.insertMany(quizSubmissions.map(submission => ({
          assignmentId: submission.assignmentId,
          userId: submission.userId,
          registrationNumber: submission.registrationNumber,
          score: submission.score,
          timeTaken: submission.timeTaken,
          submittedAt: submission.submittedAt,
        })));

        // Convert only required fields to Excel
        const response = JSON.parse(JSON.stringify(results));
        const workbook = xlsx.utils.book_new();
        const worksheet = xlsx.utils.json_to_sheet(response);
        xlsx.utils.book_append_sheet(workbook, worksheet, "Results");

        // Create a buffer for the Excel file
        const excelBuffer = xlsx.write(workbook, {
          bookType: "xlsx",
          type: "buffer",
        });

        // Set headers for file download
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=resultSheet.xlsx"
        );
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        // Send the Excel file as a response
        res.send(excelBuffer);
      } else {
        return next(new ErrorHandler("No data found to export", 400));
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

export const downloadFullExcelSheet = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { assignmentId } = req.params;

      // Validate if assignmentId is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
        return next(new ErrorHandler("Invalid assignmentId format", 400));
      }

      const results = await QuizSubmissionModel.find({ assignmentId });

      if (results.length > 0) {
        const response = JSON.parse(JSON.stringify(results));
        const workbook = xlsx.utils.book_new();
        const worksheet = xlsx.utils.json_to_sheet(response);
        xlsx.utils.book_append_sheet(workbook, worksheet, "Users");

        // Create a buffer for the Excel file
        const excelBuffer = xlsx.write(workbook, {
          bookType: "xlsx",
          type: "buffer",
        });

        // Set headers for file download
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=resultSheet.xlsx"
        );
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        // Send the Excel file as a response
        res.send(excelBuffer);
      } else {
        return next(new ErrorHandler("No data found to export", 400));
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

export const getResultsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assignmentId } = req.params;

    // Validate if assignmentId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
      return next(new ErrorHandler("Invalid assignmentId format", 400));
    }
    if (!assignmentId) {
      return res.status(400).json({ success: false, message: "Assignment ID is required" });
    }

    const results = await QuizSubmissionModel.find({ assignmentId });

    if (!results || results.length === 0) {
      return res.status(404).json({ success: false, message: "No results found for this assignment" });
    }

    res.status(200).json({
      success: true,
      results,
    });
  } catch (error) {
    next(error);
  }
};

export const getStudentQuizResultsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assignmentId, userId } = req.params;
    const results = await getStudentQuizResults(assignmentId, userId);
    if (!results) {
      return res.status(404).json({ success: false, message: 'No submission found for this student.' });
    }
    res.status(200).json({
      success: true,
      results,
    });
  } catch (error) {
    next(error);
  }
};