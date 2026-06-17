const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Drop the old index if it exists so Mongoose can rebuild it with the new partialFilterExpression
    try {
      await mongoose.connection.db.collection('users').dropIndex('employeeId_1_company_1');
      console.log('🗑️ Dropped old employeeId_1_company_1 index to update it');
    } catch (err) {
      // Index might not exist or already dropped, ignore
    }
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
