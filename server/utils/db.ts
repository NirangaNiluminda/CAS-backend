import mongoose from 'mongoose';
require('dotenv').config();

const dbUrl: string = process.env.DB_URL || '';

if (!dbUrl) {
    throw new Error('DB_URL is not defined in the environment variables.');
}

const connectDB = async () => {
    try {
        const options = {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            heartbeatFrequencyMS: 10000,
            retryWrites: true,
        };

        const connection = await mongoose.connect(dbUrl, options);
        console.log(`Database connected with host: ${connection.connection.host}`);

    } catch (error: any) {
        console.error('Database connection error:', error.message);
        console.log('Retrying in 5 seconds...');
        setTimeout(connectDB, 5000);
    }
};

export default connectDB;