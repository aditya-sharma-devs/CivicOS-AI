require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const connectDB = require('./config/db');

// Initialize database
connectDB();

const app = express();
const PORT = process.env.PORT;

// Security Middleware: Helmet
// Disable Cross-Origin Resource Policy constraints so frontend can load uploaded images statically
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false // disabled or relaxed for local development assets
}));

// Cross Origin Resource Sharing (CORS)
app.use(cors({
  origin: '*', // In production, replace with specific frontend domain
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150, // Limit each IP to 150 requests per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP address. Please try again in 15 minutes.' }
});
app.use('/api', apiLimiter);

// Parse JSON and URL-encoded request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Uploads Directory Statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/issues', require('./routes/issues'));

// Root Status Check
app.get('/', (req, res) => {
  res.json({ message: 'CivicOS-AI API is running successfully' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: err.message || 'An internal server error occurred.'
  });
});

// Background Auto-cleanup for Resolved Issues (Older than 3 days)
const Issue = require('./models/Issue');

const runResolvedIssuesCleanup = async () => {
  console.log('[Auto-Cleanup] Running check for expired resolved issues...');
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const result = await Issue.deleteMany({
      status: 'Resolved',
      resolvedAt: { $lte: threeDaysAgo }
    });
    if (result.deletedCount > 0) {
      console.log(`[Auto-Cleanup] Successfully deleted ${result.deletedCount} resolved issues older than 3 days.`);
    } else {
      console.log('[Auto-Cleanup] No expired resolved issues found.');
    }
  } catch (err) {
    console.error('[Auto-Cleanup] Error during resolved issues cleanup:', err.message);
  }
};

// Run on startup (after 5 seconds delay)
setTimeout(runResolvedIssuesCleanup, 5000);

// Run every 6 hours
setInterval(runResolvedIssuesCleanup, 6 * 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Server running in production-ready mode on port ${PORT}`);
});
