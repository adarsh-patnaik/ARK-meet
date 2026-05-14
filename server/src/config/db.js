import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';

let bucket;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ark-meet');
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Initialize GridFS bucket after connection
    bucket = new GridFSBucket(conn.connection.db, { bucketName: 'uploads' });
    console.log('GridFS bucket initialized');
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export const getBucket = () => bucket;

export default connectDB;
