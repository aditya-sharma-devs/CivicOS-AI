const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Issue = require('../models/Issue');
const authMiddleware = require('../middleware/authMiddleware');
const { analyzeIssueImage } = require('../services/aiService');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary only if credentials are provided in env
const isCloudinaryConfigured = 
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_API_KEY && 
  process.env.CLOUDINARY_API_SECRET;

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('Cloudinary Storage Service initialized.');
} else {
  console.log('Cloudinary credentials missing. Serving uploads locally from disk.');
}


// Ensure uploads folder exists
const uploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Multer File Filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const isMimeValid = allowedTypes.test(file.mimetype);
  const isExtValid = allowedTypes.test(path.extname(file.originalname).toLowerCase());

  if (isMimeValid && isExtValid) {
    return cb(null, true);
  }
  cb(new Error('Upload failed: Only JPEG, JPG, and PNG image files are allowed!'));
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB file size limit
  fileFilter: fileFilter
});

/**
 * @route   GET /api/issues/analytics
 * @desc    Get dashboard analytics (counts of statuses, critical severity, etc.)
 * @access  Public
 */
router.get('/analytics', async (req, res) => {
  try {
    const total = await Issue.countDocuments();
    const pending = await Issue.countDocuments({ status: 'Pending' });
    const resolved = await Issue.countDocuments({ status: 'Resolved' });
    const critical = await Issue.countDocuments({ severity: 'Critical' });
    
    // Today's start timestamp
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayReports = await Issue.countDocuments({ createdAt: { $gte: startOfToday } });

    res.json({
      total,
      pending,
      resolved,
      critical,
      todayReports
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving analytics data', error: error.message });
  }
});

/**
 * @route   GET /api/issues
 * @desc    Get all issues with pagination, sorting, search, and filtering
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    // 1. Pagination Parameters
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // 2. Build Filter Query Object
    const query = {};

    // Search term (subject, description, readableId)
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { subject: searchRegex },
        { description: searchRegex },
        { readableId: searchRegex },
        { district: searchRegex },
        { place: searchRegex }
      ];
    }

    // Filters
    if (req.query.state) {
      query.state = new RegExp(`^${req.query.state}$`, 'i');
    }
    if (req.query.district) {
      query.district = new RegExp(`^${req.query.district}$`, 'i');
    }
    if (req.query.status) {
      query.status = req.query.status;
    } else {
      // By default, exclude archived unless specified
      if (req.query.includeArchived !== 'true') {
        query.status = { $ne: 'Archived' };
      }
    }
    if (req.query.issueType) {
      query.issueType = req.query.issueType;
    }
    if (req.query.severity) {
      query.severity = req.query.severity;
    }

    // 3. Sorting Parameters
    let sort = { createdAt: -1 }; // default: newest first
    if (req.query.sortBy) {
      if (req.query.sortBy === 'oldest') {
        sort = { createdAt: 1 };
      } else if (req.query.sortBy === 'most-reported') {
        sort = { reportCount: -1 };
      } else if (req.query.sortBy === 'severity') {
        // Map string to order in query or do basic sort on severity
        sort = { severity: -1, createdAt: -1 };
      }
    }

    // 4. Execute Query with pagination and count
    const issues = await Issue.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const totalResults = await Issue.countDocuments(query);
    const totalPages = Math.ceil(totalResults / limit);

    res.json({
      issues,
      pagination: {
        totalResults,
        totalPages,
        currentPage: page,
        limit
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving issues', error: error.message });
  }
});

/**
 * @route   POST /api/issues
 * @desc    Report a new community issue (with image, duplicate detection, and AI analysis)
 * @access  Public
 */
router.post('/', (req, res) => {
  upload.single('image')(req, res, async function (err) {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading.
      return res.status(400).json({ message: `Image upload error: ${err.message}` });
    } else if (err) {
      // An unknown error occurred.
      return res.status(400).json({ message: err.message });
    }

    // Check if file is uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'An image of the issue is required.' });
    }

    const { subject, issueType, description, state, district, place, latitude, longitude } = req.body;

    // Validate required fields
    if (!subject || !issueType || !description || !state || !district || !place || !latitude || !longitude) {
      // Remove uploaded file since request was invalid
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'All fields (subject, type, description, state, district, place, lat, lng, image) are required.' });
    }

    const parsedLat = parseFloat(latitude);
    const parsedLng = parseFloat(longitude);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Latitude and Longitude must be valid numbers.' });
    }

    const localImagePath = `/uploads/${req.file.filename}`;
    const absoluteImagePath = req.file.path;

    try {
      // 1. Duplicate Detection Check
      // Look for active issues of the same type within a grid of +/- 0.001 degrees latitude and longitude (~111 meters)
      const latDiff = 0.001;
      const lngDiff = 0.001;

      const existingDuplicate = await Issue.findOne({
        issueType: issueType,
        status: { $in: ['Pending', 'Under Review', 'In Progress'] },
        latitude: { $gte: parsedLat - latDiff, $lte: parsedLat + latDiff },
        longitude: { $gte: parsedLng - lngDiff, $lte: parsedLng + lngDiff }
      });

      // 1. Upload to Cloudinary if configured (with local fallback)
      let finalImageUrl = localImagePath;
      let isUploadedToCloudinary = false;

      if (isCloudinaryConfigured) {
        try {
          console.log('Uploading image to Cloudinary...');
          const uploadFolder = process.env.CLOUDINARY_FOLDER || 'CivicOS_AI_v2';
          const uploadResult = await cloudinary.uploader.upload(absoluteImagePath, {
            folder: uploadFolder
          });
          finalImageUrl = uploadResult.secure_url;
          isUploadedToCloudinary = true;
          console.log('Image uploaded to Cloudinary successfully:', finalImageUrl);
        } catch (cloudinaryError) {
          console.error('Cloudinary upload failed, falling back to local server storage:', cloudinaryError.message);
        }
      }

      if (existingDuplicate) {
        console.log(`Duplicate detected for issue type '${issueType}' at [${parsedLat}, ${parsedLng}]. Merging reports.`);

        // Add report to existing issue duplicate log and increment reportCount
        existingDuplicate.reportCount += 1;
        existingDuplicate.duplicateReports.push({
          description: description,
          imageUrl: finalImageUrl,
          latitude: parsedLat,
          longitude: parsedLng
        });

        // Clean up temporary local file if uploaded to Cloudinary
        if (isUploadedToCloudinary && fs.existsSync(absoluteImagePath)) {
          fs.unlinkSync(absoluteImagePath);
        }

        // Save and return
        const updatedIssue = await existingDuplicate.save();
        return res.status(200).json({
          message: 'This issue was already reported in this immediate area. Your report has been merged with the existing issue.',
          isDuplicate: true,
          issue: updatedIssue
        });
      }

      // 2. AI Analysis Call (Mulitmodal evaluation)
      const aiResults = await analyzeIssueImage(
        absoluteImagePath,
        req.file.mimetype,
        subject,
        issueType,
        description
      );

      // 3. Create and Save New Issue
      const newIssue = new Issue({
        subject,
        issueType,
        description,
        imageUrl: finalImageUrl,
        state,
        district,
        place,
        latitude: parsedLat,
        longitude: parsedLng,
        status: 'Pending',
        severity: aiResults.severity,
        aiConfidence: aiResults.confidence,
        aiDetectedIssue: aiResults.detectedIssue,
        aiAnalysis: aiResults.analysis
      });

      // Clean up temporary local file if uploaded to Cloudinary
      if (isUploadedToCloudinary && fs.existsSync(absoluteImagePath)) {
        fs.unlinkSync(absoluteImagePath);
      }

      const savedIssue = await newIssue.save();
      res.status(201).json({
        message: 'Your report was successfully submitted. AI has analyzed the image.',
        isDuplicate: false,
        issue: savedIssue
      });

    } catch (error) {
      // Clean up uploaded image if exception occurs
      if (fs.existsSync(absoluteImagePath)) {
        fs.unlinkSync(absoluteImagePath);
      }
      res.status(500).json({ message: 'Error processing report', error: error.message });
    }
  });
});

/**
 * @route   PATCH /api/issues/:id/status
 * @desc    Admin: Update issue status (Under Review, In Progress, Resolved, Rejected, Archived)
 * @access  Private (Admin Only)
 */
router.patch('/:id/status', authMiddleware, async (req, res) => {
  const { status } = req.body;
  const allowedStatuses = ['Pending', 'Under Review', 'In Progress', 'Resolved', 'Rejected', 'Archived'];

  if (!status || !allowedStatuses.includes(status)) {
    return res.status(400).json({ message: `Invalid status. Choose from: ${allowedStatuses.join(', ')}` });
  }

  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found' });
    }

    issue.status = status;
    if (status === 'Resolved') {
      issue.resolvedAt = new Date();
    } else {
      issue.resolvedAt = undefined;
    }
    const updatedIssue = await issue.save();

    res.json({
      message: `Issue status successfully updated to ${status}`,
      issue: updatedIssue
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating status', error: error.message });
  }
});

module.exports = router;
