const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const https = require('https');
const Admin = require('../models/Admin');
const User = require('../models/User');

// Helper function to verify Google OAuth ID Token without third-party libraries
const verifyGoogleToken = (idToken) => {
  return new Promise((resolve, reject) => {
    https.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`, (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        if (response.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Failed to parse Google API response JSON'));
          }
        } else {
          reject(new Error(`Google OAuth API rejected token (status: ${response.statusCode})`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new admin (Protected or initial setup)
 * @access  Public
 */
router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Please enter all fields' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }

  try {
    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Admin username already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newAdmin = new Admin({
      username,
      password: hashedPassword
    });

    const savedAdmin = await newAdmin.save();

    res.status(201).json({
      message: 'Admin registered successfully',
      admin: {
        id: savedAdmin._id,
        username: savedAdmin.username
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate admin & get token
 * @access  Public
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Please enter all fields' });
  }

  try {
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(400).json({ message: 'Invalid admin credentials' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid admin credentials' });
    }

    const token = jwt.sign(
      { id: admin._id, username: admin.username, role: 'admin' },
      process.env.JWT_SECRET || 'supersecurecivicosjwtsecretkey99887766',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      admin: {
        id: admin._id,
        username: admin.username
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/auth/user/register
 * @desc    Register a new citizen/user
 * @access  Public
 */
router.post('/user/register', async (req, res) => {
  const { name, email, password, securityQuestion, securityAnswer } = req.body;

  if (!name || !email || !password || !securityQuestion || !securityAnswer) {
    return res.status(400).json({ message: 'Please enter all fields, including security question and answer' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const hashedAnswer = await bcrypt.hash(securityAnswer.toLowerCase().trim(), salt);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      securityQuestion,
      securityAnswer: hashedAnswer
    });

    const savedUser = await newUser.save();

    const token = jwt.sign(
      { id: savedUser._id, name: savedUser.name, email: savedUser.email, role: 'citizen' },
      process.env.JWT_SECRET || 'supersecurecivicosjwtsecretkey99887766',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/auth/user/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
router.post('/user/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please enter all fields' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user || !user.password) {
      return res.status(400).json({ message: 'Invalid user credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid user credentials' });
    }

    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email, role: 'citizen' },
      process.env.JWT_SECRET || 'supersecurecivicosjwtsecretkey99887766',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/auth/user/google
 * @desc    Sign in or Register via Google OAuth
 * @access  Public
 */
router.post('/user/google', async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ message: 'Google ID token is required' });
  }

  try {
    const payload = await verifyGoogleToken(idToken);
    const { email, name, sub: googleId, picture: avatar } = payload;

    if (!email) {
      return res.status(400).json({ message: 'Google account lacks email verification' });
    }

    let user = await User.findOne({ email });
    if (!user) {
      // Auto-register new social user
      user = new User({
        name,
        email,
        googleId,
        avatar
      });
      await user.save();
    } else if (!user.googleId) {
      // Link Google credentials to existing email profile
      user.googleId = googleId;
      if (avatar) user.avatar = avatar;
      await user.save();
    }

    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email, role: 'citizen' },
      process.env.JWT_SECRET || 'supersecurecivicosjwtsecretkey99887766',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      }
    });
  } catch (error) {
    res.status(400).json({ message: 'Social authentication failed', error: error.message });
  }
});

const adminAuth = require('../middleware/authMiddleware');
const userAuth = require('../middleware/userAuthMiddleware');

/**
 * @route   PUT /api/auth/user/change-password
 * @desc    Change logged-in citizen password
 * @access  Private (User)
 */
router.put('/user/change-password', userAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters long' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Only verify current password if the user already has a password set (i.e. not purely Google login)
    if (user.password) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required to verify identity' });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Incorrect current password' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Password updated successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   PUT /api/auth/admin/change-password
 * @desc    Change logged-in admin password
 * @access  Private (Admin)
 */
router.put('/admin/change-password', adminAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Please enter all fields' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters long' });
  }

  try {
    const admin = await Admin.findById(req.admin.id);
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);
    await admin.save();

    res.json({ message: 'Admin password updated successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/auth/user/forgot-password
 * @desc    Get user's security question by email
 * @access  Public
 */
router.post('/user/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Please enter your email address' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User with this email not found' });
    }

    if (!user.securityQuestion) {
      return res.status(400).json({ message: 'No security question set for this account (Google OAuth users do not require security questions)' });
    }

    res.json({ securityQuestion: user.securityQuestion });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/auth/user/reset-password
 * @desc    Reset password via security question answer
 * @access  Public
 */
router.post('/user/reset-password', async (req, res) => {
  const { email, securityAnswer, newPassword } = req.body;

  if (!email || !securityAnswer || !newPassword) {
    return res.status(400).json({ message: 'Please enter all fields' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters long' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    if (!user.securityAnswer) {
      return res.status(400).json({ message: 'This account does not support password recovery' });
    }

    const isAnswerMatch = await bcrypt.compare(securityAnswer.toLowerCase().trim(), user.securityAnswer);
    if (!isAnswerMatch) {
      return res.status(400).json({ message: 'Incorrect answer to security question' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Password has been reset successfully! You can now log in.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
