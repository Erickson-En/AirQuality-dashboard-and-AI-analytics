// backend/middleware/requireAdmin.js
// Lightweight role guard for admin-only routes.
// Usage: router.use(requireAdmin)  OR  router.get('/path', requireAdmin, handler)
//
// The client sends the userId in the X-User-Id header (set by the frontend api
// helper). We look the user up in MongoDB and reject non-admins with 403.

const User = require('../models/user');

module.exports = async function requireAdmin(req, res, next) {
  try {
    // Accept userId from header, query param, or body (flexible for both
    // browser XHR and the admin panel's axios calls)
    const userId =
      req.headers['x-user-id'] ||
      req.query.userId ||
      req.body?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findById(userId).select('role').lean();

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.adminUser = user; // available to downstream handlers
    next();
  } catch (err) {
    console.error('[requireAdmin]', err.message);
    res.status(500).json({ error: 'Auth check failed' });
  }
};
