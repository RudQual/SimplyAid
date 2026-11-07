const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

/** Connect to MongoDB, retrying a few times before giving up. */
const connectDB = async (uri = process.env.MONGO_URI, retries = 5) => {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, autoIndex: false });
      console.log(`✅ MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
      return conn;
    } catch (error) {
      console.error(`❌ MongoDB connection error (attempt ${attempt}/${retries}): ${error.message}`);
      if (attempt === retries) throw error;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return null;
};

module.exports = connectDB;
