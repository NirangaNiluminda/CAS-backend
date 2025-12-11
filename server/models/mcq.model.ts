import mongoose, { Document, Model, Schema, Types } from "mongoose";

const mcqOptionSchema: Schema = new mongoose.Schema({
  text: {
    type: String,
    required: [true, "Option text is required"],
  },
  isCorrect: {
    type: Boolean,
    default: false,
  },
});

const mcqQuestionSchema: Schema = new mongoose.Schema({
  questionText: {
    type: String,
    required: [true, "Question text is required"],
  },
  options: {
    type: [mcqOptionSchema],
    validate: {
      validator: function (options: any[]) {
        return options.length === 4;
      },
      message: "Each question must have exactly four options",
    },
    required: [true, "Options are required"],
  },
  pointsForQuestion: { // for give different points per question
    type: Number,
    default: 1,
  },
});

export interface IMCQOption extends Document {
  _id: Types.ObjectId;
  text: string;
  isCorrect: boolean;
}

export interface IMCQQuestion extends Document {
  _id: Types.ObjectId;
  questionText: string;
  options: IMCQOption[];
  pointsForQuestion: number; // for give different points per question
}

export interface IAssignment extends Document {
  title: string;
  description: string;
  questions: IMCQQuestion[];
  teacherId: mongoose.Schema.Types.ObjectId;
  timeLimit: number; // Time limit in minutes
  createdAt: Date;
  updatedAt: Date;
  guidelines: string[];
  intendedBatch: number;
  password: string;
  startDate: Date; // Start date for the assignment
  endDate: Date;   // End date for the assignment
  attemptedStudents: mongoose.Schema.Types.ObjectId[]; // Array of student IDs who attempted the assignment
}

const assignmentSchema: Schema<IAssignment> = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      minlength: 3,
      maxlength: 100,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      minlength: 10,
      maxlength: 1000,
    },
    questions: [mcqQuestionSchema],
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    timeLimit: {
      type: Number,
      required: [true, "Time limit is required"],
      min: 1,
      max: 180, // Maximum 3 hours
    },
    guidelines: {
      type: [String],
      default: ["Read all questions carefully before answering", "Manage your time effectively", "Once submitted, you cannot change your answers", "Do not refresh the page during the quiz"],
      validate: {
        validator: function (guidelines: any[]) {
          return guidelines.length === 4;
        },
        message: "Each question must have exactly four guidelines",
      },
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    intendedBatch: {
      type: Number,
      required: [true, "Intended batch is required"],
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    attemptedStudents: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [], // Initialize with an empty array
    },
  },
  { timestamps: true }
);

const AssignmentModel: Model<IAssignment> = mongoose.model("Assignment", assignmentSchema);

export default AssignmentModel;

// Example of a Postman request body for creating an assignment
// const exampleRequestBody = {
//   title: "Basic Quiz",
//   description: "Test your basic skills",
//   timeLimit: 10,
//   questions: [
//     {
//       questionText: "What is 2 + 2?",
//       options: [
//         { text: "3", isCorrect: false },
//         { text: "4", isCorrect: true },
//         { text: "5", isCorrect: false },
//         { text: "6", isCorrect: false }
//       ]
//     }
//   ],
//   guidelines: ["Guideline 1", "Guideline 2", "Guideline 3", "Guideline 4"],
//   password: "Test",
//   teacherId: "66f7bd8a6a41a029fdb5b47b",
//   startDate: "2025-04-01T08:00:00.000Z",
//   endDate: "2025-04-10T18:00:00.000Z"
// };