import { IAssignment } from '../models/mcq.model';
import AssignmentModel from '../models/mcq.model';
import QuizSubmissionModel, { IQuizSubmission } from '../models/QuizSubmissionModel';
import mongoose from 'mongoose';
import userModel from '../models/user.model';
import { ErrorHandler } from '../utils/ErrorHandler';

export const createAssignment = async (assignmentData: IAssignment): Promise<IAssignment> => {
  // Validate date logic
  const startDate = new Date(assignmentData.startDate);
  const endDate = new Date(assignmentData.endDate);
  
  if (startDate >= endDate) {
    throw new ErrorHandler('End date must be after start date', 400);
  }
  
  const assignment = new AssignmentModel(assignmentData);
  return await assignment.save();
};

export const getAssignmentById = async (id: string): Promise<IAssignment | null> => {
  return await AssignmentModel.findById(id);
};

export const updateAssignment = async (id: string, assignmentData: Partial<IAssignment>): Promise<IAssignment | null> => {
  // If updating dates, validate them
  if (assignmentData.startDate || assignmentData.endDate) {
    const assignment = await AssignmentModel.findById(id);
    if (!assignment) {
      throw new ErrorHandler('Assignment not found', 404);
    }
    
    const startDate = new Date(assignmentData.startDate || assignment.startDate);
    const endDate = new Date(assignmentData.endDate || assignment.endDate);
    
    if (startDate >= endDate) {
      throw new ErrorHandler('End date must be after start date', 400);
    }
  }
  
  return await AssignmentModel.findByIdAndUpdate(
    id,
    { $set: assignmentData },
    { new: true, runValidators: true }
  );
};

export const deleteAssignment = async (id: string): Promise<void> => {
  await AssignmentModel.findByIdAndDelete(id);
};

export const getAllAssignments = async (teacherId: string): Promise<IAssignment[]> => {
  return await AssignmentModel.find({ teacherId });
};

export const getActiveAssignments = async (teacherId: string): Promise<IAssignment[]> => {
  const currentDate = new Date();
  return await AssignmentModel.find({
    teacherId,
    startDate: { $lte: currentDate },
    endDate: { $gte: currentDate }
  });
};

export const getUpcomingAssignments = async (teacherId: string): Promise<IAssignment[]> => {
  const currentDate = new Date();
  return await AssignmentModel.find({
    teacherId,
    startDate: { $gt: currentDate }
  });
};

export const getPastAssignments = async (teacherId: string): Promise<IAssignment[]> => {
  const currentDate = new Date();
  return await AssignmentModel.find({
    teacherId,
    endDate: { $lt: currentDate }
  });
};

export interface QuizSubmission {
  assignmentId: string;
  userId: string;
  answers: {
    questionId: string;
    selectedOption: string;
  }[];
  startTime: Date;
}

export const startQuiz = async (assignmentId: string, userId: string): Promise<{ assignment: IAssignment; startTime: Date, score: number }> => {
  const assignment = await AssignmentModel.findById(assignmentId);
  if (!assignment) {
    throw new ErrorHandler('Assignment not found', 404);
  }

  // Check if the assignment is currently available
  const currentDate = new Date();
  if (currentDate < assignment.startDate) {
    throw new ErrorHandler('This assignment is not yet available', 403);
  }
  
  if (currentDate > assignment.endDate) {
    throw new ErrorHandler('This assignment has expired', 403);
  }

  const startTime = new Date();
  const score = 0;
  
  return { assignment, startTime, score };
};

// Update score in real time
export const updateScore = (assignment: IAssignment, answers: { questionId: string; selectedOption: string }[]): number => {
  let score = 0;

  answers.forEach(answer => {
    const question = assignment.questions.find(q => q._id && q._id.toString() === answer.questionId);
    if (question) {
      const correctOption = question.options.find(option => option.isCorrect);
      if (correctOption && correctOption._id && correctOption._id.toString() === answer.selectedOption) {
        score = score + question.pointsForQuestion; // Add points for the correct answer
      }
    }
  });

  return score;
};

export const submitQuiz = async (submission: QuizSubmission): Promise<IQuizSubmission> => {
  // Fetch the complete assignment
  const assignment = await AssignmentModel.findById(submission.assignmentId);
  if (!assignment) {
    throw new ErrorHandler('Assignment not found', 404);
  }
  
  // Check if the assignment is still available for submission
  const currentDate = new Date();
  if (currentDate > assignment.endDate) {
    throw new ErrorHandler('This assignment has expired, submissions are no longer accepted', 403);
  }
  
  console.log('Assignment structure:', JSON.stringify(assignment, null, 2));

  const user = await userModel.findById(submission.userId);
  if (!user) {
    throw new ErrorHandler('User not found', 404);
  }

  const registrationNumber = user.registrationNumber;
  const endTime = new Date();
  const timeTaken = (endTime.getTime() - submission.startTime.getTime()) / 60000;

  // Check if time limit is exceeded
  if (timeTaken > assignment.timeLimit) {
    throw new ErrorHandler('Time limit exceeded', 400);
  }

  let score = 0;
  const enrichedAnswers = submission.answers.map(answer => {
    // Find the question
    const question = assignment.questions.find(
      q => q._id.toString() === answer.questionId
    );
    
    console.log('Question found:', JSON.stringify(question, null, 2));
    
    if (!question) {
      throw new ErrorHandler(`Question ${answer.questionId} not found`, 400);
    }

    // Try different possible locations of the question text
    const questionText = question.questionText;
    if (!questionText) {
      console.log('Question object structure:', question);
      throw new ErrorHandler(`Question text not found in structure for question ${answer.questionId}`, 400);
    }

    const selectedOption = question.options.find(
      opt => opt._id.toString() === answer.selectedOption
    );

    if (!selectedOption) {
      throw new ErrorHandler(`Option ${answer.selectedOption} not found for question ${answer.questionId}`, 400);
    }

    // Try different possible locations of the option text
    const optionText = selectedOption.text;
    if (!optionText) {
      console.log('Option object structure:', selectedOption);
      throw new ErrorHandler(`Option text not found in structure for option ${answer.selectedOption}`, 400);
    }

    if (selectedOption.isCorrect) {
      score = score + question.pointsForQuestion; // Add points for the correct answer
    }

    return {
      questionId: new mongoose.Types.ObjectId(answer.questionId),
      questionText: questionText,
      selectedOption: new mongoose.Types.ObjectId(answer.selectedOption),
      selectedOptionText: optionText
    };
  });

  const quizSubmission = new QuizSubmissionModel({
    assignmentId: new mongoose.Types.ObjectId(submission.assignmentId),
    userId: new mongoose.Types.ObjectId(submission.userId),
    registrationNumber,
    answers: enrichedAnswers,
    score,
    timeTaken,
    submittedAt: endTime
  });

  await quizSubmission.save();
  return quizSubmission;
};

export const getQuizSubmission = async (submissionId: string): Promise<IQuizSubmission | null> => {
  return await QuizSubmissionModel.findById(submissionId);
};

export const getQuizSubmissionsByUser = async (userId: string): Promise<IQuizSubmission[]> => {
  return await QuizSubmissionModel.find({ userId });
};

export const getQuizSubmissionsByAssignment = async (assignmentId: string): Promise<IQuizSubmission[]> => {
  return await QuizSubmissionModel.find({ assignmentId });
};

export const updateAttemptedStudentsService = async (assignmentId: string, studentId: string): Promise<IAssignment> => {
  
  const assignment = await AssignmentModel.findById(assignmentId);
  if (!assignment) {
    throw new ErrorHandler('Assignment not found', 404);
  }
  const updatedAssignment = await AssignmentModel.findByIdAndUpdate(
    assignmentId,
    { $addToSet: { attemptedStudents: studentId } },
    { new: true }
  );
  

  console.log(`Student ${studentId} has been added to attempted students for assignment ${assignmentId}.`);
  // Optionally, you can also return the updated assignment if needed
  
  return updatedAssignment as IAssignment;
}