require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');
const Counter = require('./models/Counter');

const seedDatabase = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/civicos';
    await mongoose.connect(mongoUri);
    console.log('Connected to database for seeding...');

    // 1. Seed Admin
    const defaultUsername = 'admin';
    const defaultPassword = 'admin123';

    const existingAdmin = await Admin.findOne({ username: defaultUsername });
    if (existingAdmin) {
      console.log(`Admin user '${defaultUsername}' already exists. Skipping seed.`);
    } else {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(defaultPassword, salt);

      const admin = new Admin({
        username: defaultUsername,
        password: hashedPassword
      });

      await admin.save();
      console.log(`Successfully seeded default admin:`);
      console.log(`Username: ${defaultUsername}`);
      console.log(`Password: ${defaultPassword}`);
    }

    // 2. Initialize Counter if not present
    const counterExists = await Counter.findOne({ id: 'issueId' });
    if (!counterExists) {
      const counter = new Counter({ id: 'issueId', seq: 0 });
      await counter.save();
      console.log('Initialized Issue ID sequence counter.');
    }

    console.log('Seeding completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error during database seeding:', error.message);
    process.exit(1);
  }
};

seedDatabase();
