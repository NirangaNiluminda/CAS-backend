import mongoose from 'mongoose';
require('dotenv').config();

const dbUrl: string = process.env.DB_URL || '';

if (!dbUrl) {
    throw new Error('DB_URL is not defined in the environment variables.');
}

const connectDB = async () => {
    try {
        const connection = await mongoose.connect(dbUrl, {});
        console.log(`Database connected with host: ${connection.connection.host}`);
    } catch (error: any) {
        console.error('Database connection error:', error.message);
        console.log('Retrying in 5 seconds...');
        setTimeout(connectDB, 5000); // Retry after 5 seconds
    }
};

export default connectDB;