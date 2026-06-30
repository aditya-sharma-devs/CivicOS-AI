const mongoose = require('mongoose');
const Counter = require('./Counter');


const duplicateReportSchema = new mongoose.Schema({
  description: String,
  imageUrl: String,
  latitude: Number,
  longitude: Number,
  reportedAt: {
    type: Date,
    default: Date.now
  }
});

const issueSchema = new mongoose.Schema({
  readableId: {
    type: String,
    unique: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  issueType: {
    type: String,
    required: true,
    enum: ['Pothole', 'Water Leakage', 'Damaged Streetlight', 'Waste Management', 'Public Infrastructure', 'Other']
  },
  description: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  district: {
    type: String,
    required: true
  },
  place: {
    type: String,
    required: true
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Under Review', 'In Progress', 'Resolved', 'Rejected', 'Archived'],
    default: 'Pending'
  },
  severity: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Low'
  },
  aiConfidence: {
    type: Number,
    default: 0
  },
  aiDetectedIssue: {
    type: String
  },
  aiAnalysis: {
    type: String
  },
  reportCount: {
    type: Number,
    default: 1
  },
  duplicateReports: [duplicateReportSchema],
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: {
    type: Date
  }
}, { timestamps: true });

// Pre-save hook to generate readable ID like ISS-0001
issueSchema.pre('save', async function(next) {
  if (this.isNew && !this.readableId) {
    const Counter = mongoose.model('Counter');
    try {
      const doc = await Counter.findOneAndUpdate(
        { id: 'issueId' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      const paddedSeq = String(doc.seq).padStart(4, '0');
      this.readableId = `ISS-${paddedSeq}`;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

module.exports = mongoose.model('Issue', issueSchema);
