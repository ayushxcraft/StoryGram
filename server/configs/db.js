
import mongoose from "mongoose";

let connectionPromise;

const connectDB = async () => {
    const mongoUrl = process.env.MONGODB_URL;

    if (!mongoUrl) {
        throw new Error(
            "MONGODB_URL is missing from environment variables."
        );
    }

    // Reuse an existing connection.
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    // Reuse an ongoing connection attempt.
    if (!connectionPromise) {
        connectionPromise = mongoose
            .connect(mongoUrl, {
                dbName: "storygram",
                serverSelectionTimeoutMS: 10000,
            })
            .then(() => {
                console.log(
                    `MongoDB connected successfully: ${mongoose.connection.name}`
                );

                return mongoose.connection;
            })
            .catch((error) => {
                connectionPromise = null;

                console.error(
                    "MongoDB connection failed:",
                    error.message
                );

                throw error;
            });
    }

    return connectionPromise;
};

export default connectDB;
