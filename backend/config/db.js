const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Auto-seed default admin credentials if none exist
    const Admin = require('../models/Admin');
    const Counter = require('../models/Counter');
    
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      console.log('No admin users found in database. Auto-seeding default admin...');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      const defaultAdmin = new Admin({
        username: 'admin',
        password: hashedPassword
      });
      await defaultAdmin.save();
      console.log('Default admin seeded successfully (admin / admin123).');
    }

    // Auto-initialize Issue Sequence Counter
    const counterExists = await Counter.findOne({ id: 'issueId' });
    if (!counterExists) {
      const defaultCounter = new Counter({ id: 'issueId', seq: 0 });
      await defaultCounter.save();
      console.log('Issue counter auto-initialized.');
    }
    
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
