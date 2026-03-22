const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateToken } = require('../middlewares/auth');
const { asyncHandler, AppError, ValidationError, UnauthorizedError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

/**
 * Register a new user
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role = 'passenger' } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ValidationError('Email already registered');
  }

  // Check if phone already exists
  const existingPhone = await User.findOne({ phone });
  if (existingPhone) {
    throw new ValidationError('Phone number already registered');
  }

  // Create new user
  const user = new User({
    name,
    email,
    password,
    phone,
    role
  });

  await user.save();

  // Generate token
  const token = generateToken(user._id);

  logger.info(`New user registered: ${email} (${role})`);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: user.toPublicJSON(),
      token
    }
  });
});

/**
 * User login
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user with password
  const user = await User.findByEmailWithPassword(email);
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Check if user is active
  if (!user.isActive) {
    throw new UnauthorizedError('Account is deactivated');
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate token
  const token = generateToken(user._id);

  logger.info(`User logged in: ${email} (${user.role})`);

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: user.toPublicJSON(),
      token
    }
  });
});

/**
 * Get current user profile
 */
const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  res.json({
    success: true,
    data: {
      user: user.toPublicJSON()
    }
  });
});

/**
 * Update user profile
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, role } = req.body;
  const updateData = {};

  if (name) updateData.name = name;
  if (phone) {
    // Check if phone is already used by another user
    const existingPhone = await User.findOne({ 
      phone, 
      _id: { $ne: req.userId } 
    });
    if (existingPhone) {
      throw new ValidationError('Phone number already registered');
    }
    updateData.phone = phone;
  }
  if (role && req.user.role === 'admin') {
    // Only admins can change roles
    updateData.role = role;
  }

  const user = await User.findByIdAndUpdate(
    req.userId,
    updateData,
    { new: true, runValidators: true }
  );

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  logger.info(`User profile updated: ${user.email}`);

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: user.toPublicJSON()
    }
  });
});

/**
 * Change password
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const user = await User.findById(req.userId).select('+password');
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Verify current password
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);
  if (!isCurrentPasswordValid) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  // Check if new password is same as current
  const isSamePassword = await user.comparePassword(newPassword);
  if (isSamePassword) {
    throw new ValidationError('New password must be different from current password');
  }

  // Update password
  user.password = newPassword;
  await user.save();

  logger.info(`Password changed for user: ${user.email}`);

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
});

/**
 * Deactivate user account
 */
const deactivateAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  user.isActive = false;
  await user.save();

  logger.info(`Account deactivated: ${user.email}`);

  res.json({
    success: true,
    message: 'Account deactivated successfully'
  });
});

/**
 * Reactivate user account (admin only)
 */
const reactivateAccount = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  user.isActive = true;
  await user.save();

  logger.info(`Account reactivated by admin: ${user.email}`);

  res.json({
    success: true,
    message: 'Account reactivated successfully',
    data: {
      user: user.toPublicJSON()
    }
  });
});

/**
 * Get all users (admin only)
 */
const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, role, search } = req.query;
  const skip = (page - 1) * limit;

  // Build query
  const query = {};
  if (role) query.role = role;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }

  const users = await User.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await User.countDocuments(query);

  res.json({
    success: true,
    data: {
      users: users.map(user => user.toPublicJSON()),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

/**
 * Update user status (admin only)
 */
const updateUserStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { isActive } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  user.isActive = isActive;
  await user.save();

  logger.info(`User status updated by admin: ${user.email} -> ${isActive ? 'active' : 'inactive'}`);

  res.json({
    success: true,
    message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
    data: {
      user: user.toPublicJSON()
    }
  });
});

/**
 * Delete user account (admin only)
 */
const deleteUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Prevent admin from deleting themselves
  if (userId === req.userId) {
    throw new AppError('Cannot delete your own account', 400, 'SELF_DELETE');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  await User.findByIdAndDelete(userId);

  logger.warn(`User deleted by admin: ${user.email}`);

  res.json({
    success: true,
    message: 'User deleted successfully'
  });
});

/**
 * Get user statistics (admin only)
 */
const getUserStats = asyncHandler(async (req, res) => {
  const stats = await User.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 },
        active: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        inactive: {
          $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] }
        }
      }
    }
  ]);

  const totalUsers = await User.countDocuments();
  const activeUsers = await User.countDocuments({ isActive: true });
  const recentUsers = await User.countDocuments({
    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
  });

  res.json({
    success: true,
    data: {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      recentUsers,
      byRole: stats
    }
  });
});

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  deactivateAccount,
  reactivateAccount,
  getAllUsers,
  updateUserStatus,
  deleteUser,
  getUserStats
};
