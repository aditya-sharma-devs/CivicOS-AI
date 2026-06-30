const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  // Expect Bearer <token>
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7, authHeader.length) : authHeader;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecurecivicosjwtsecretkey99887766');
    
    // Ensure the token belongs to a citizen/user role (not admin)
    if (decoded.role !== 'citizen') {
      return res.status(403).json({ message: 'Authorization denied. Access restricted to citizens.' });
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid or has expired' });
  }
};
