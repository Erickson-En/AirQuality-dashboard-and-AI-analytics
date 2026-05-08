// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { sendWelcomeEmail } = require('../utils/emailService');

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const user = new User({ name, email, password });
    await user.save();

    // Send welcome email (fire-and-forget — don't let mail failure break signup)
    sendWelcomeEmail({ to: user.email, name: user.name }).catch(err =>
      console.error('[Auth] Welcome email failed:', err.message)
    );

    return res.status(201).json({
      message: 'Signup successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ message: 'Server error creating user' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const ok = await user.comparePassword(password);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    return res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,   // ← included so frontend knows if user is admin
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error logging in' });
  }
});

// PUT /api/auth/profile/:id   – update display name / email
router.put('/profile/:id', async (req, res) => {
  try {
    const { name, email } = req.body;
    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { name, email },
      { new: true }
    ).select('-password');
    if (!updated) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'Profile updated', user: updated });
  } catch (err) {
    res.status(500).json({ message: 'Error updating profile' });
  }
});

// PUT /api/auth/password/:id  – change password
router.put('/password/:id', async (req, res) => {
  try {
    const { current, next } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const ok = await user.comparePassword(current);
    if (!ok) return res.status(401).json({ message: 'Current password is incorrect' });

    user.password = next;
    await user.save(); // pre-save hook re-hashes

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error changing password' });
  }
});

module.exports = router;
