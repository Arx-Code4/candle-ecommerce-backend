import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import { verifyAccessToken } from '../utils/jwt.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';

import { env } from '../config/env.js';

const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'No token provided');
    }

    const token = authHeader.split(' ')[1];
    // In test environment, accept a fake token for testing
    if (
      env.NODE_ENV === 'test' &&
      env.ALLOW_TEST_AUTH_BYPASS === 'true' &&
      token === 'fake-valid-token'
    ) {
      req.user = { id: 'test-user-id', role: 'customer' };
      return next();
    }
    const payload = verifyAccessToken(token);

    //this is where the type claim actually gets enforced.
    //  Without this check, a leaked refresh token — which is signed with a different secret so it'd fail here anyway in this design — would still be worth checking explicitly, because it's the one place in the whole app that decides "is this request authenticated."
    // If this route ever changes to accept either secret for convenience, this line is what stops a refresh token from doubling as an access token.
    if (payload.type !== 'access') {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired token');
    }

    req.user = { id: payload.id, role: payload.role };
    next();
  } catch (error) {
    next(new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired token'));
  }
};

export default authMiddleware;
