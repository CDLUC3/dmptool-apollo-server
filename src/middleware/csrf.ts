import { Response, Request, NextFunction } from "express";
import { generateCSRFToken, verifyCSRFToken } from '../services/tokenService.js';

export async function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only worry about the CSRF token if the caller is performing a POST, PUT, PATCH, DELETE
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    const token = req.headers['x-csrf-token'] as string;
    if (!token || !(await verifyCSRFToken(req.cache, token))) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
  }

  // Generate a new CSRF token (every request)
  const newToken = await generateCSRFToken(req.cache);
  if (newToken) {
    res.setHeader('X-CSRF-Token', newToken);
    // Needed to expose 'x-csrf-token' header to the client side
    res.setHeader('Access-Control-Expose-Headers', 'X-CSRF-Token');
  }
  next();
}
