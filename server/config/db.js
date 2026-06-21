const mongoose = require('mongoose');

const connectDB = async (retries = 5) => {
  while (retries > 0) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000
      });
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      
      // Drop the old index if it exists so Mongoose can rebuild it with the new partialFilterExpression
      try {
        await mongoose.connection.db.collection('users').dropIndex('employeeId_1_company_1');
        console.log('🗑️ Dropped old employeeId_1_company_1 index to update it');
      } catch (err) {
        // Index might not exist or already dropped, ignore
      }
      return; // Exit loop on success
    } catch (error) {
      console.error(`❌ MongoDB Connection Error: ${error.message}`);
      retries -= 1;
      if (retries === 0) {
        console.error('All retries failed. Exiting...');
        process.exit(1);
      }
      console.log(`Retrying connection... (${retries} retries left)`);
      await new Promise(res => setTimeout(res, 2000));
    }
  }
};

module.exports = connectDB;
