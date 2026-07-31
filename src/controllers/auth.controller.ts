import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { SuccessResponse } from '../utils/ApiResponse.js';
import { AuthRequest } from '../types/index.js';
import { HTTP_STATUS } from '../constants/index.js';
import * as authService from '../services/auth.service.js';
import ApiError from '../utils/ApiError.js';
import { REFRESH_COOKIE_NAME, refreshCookieOptions } from '../utils/cookies.js';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken, ...result } = await authService.registerUser(req.body);
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
  res
    .status(HTTP_STATUS.CREATED)
    .json(new SuccessResponse(HTTP_STATUS.CREATED, 'User registered', result));
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken, ...result } = await authService.loginUser(req.body);
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
  res.status(HTTP_STATUS.OK).json(new SuccessResponse(HTTP_STATUS.OK, 'Login successful', result));
});

export const getMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await authService.getUserById(req.user!.id);
  res.status(HTTP_STATUS.OK).json(new SuccessResponse(HTTP_STATUS.OK, 'OK', user));
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.requestPasswordReset(req.body.email);
  res
    .status(HTTP_STATUS.OK)
    .json(
      new SuccessResponse(
        HTTP_STATUS.OK,
        'If that email is registered, a reset link has been sent.',
        null,
      ),
    );
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.resetPassword(req.body.token, req.body.newPassword);
  res
    .status(HTTP_STATUS.OK)
    .json(new SuccessResponse(HTTP_STATUS.OK, 'Password reset successful', null));
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const presentedToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (typeof presentedToken !== 'string') {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired refresh token');
  }

  const result = await authService.refreshAccessToken(presentedToken);
  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions);
  res
    .status(HTTP_STATUS.OK)
    .json(
      new SuccessResponse(HTTP_STATUS.OK, 'Token refreshed', { accessToken: result.accessToken }),
    );
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const presentedToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (typeof presentedToken === 'string') {
    await authService.logoutUser(presentedToken);
  }
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions);
  res.status(HTTP_STATUS.OK).json(new SuccessResponse(HTTP_STATUS.OK, 'Logged out', null));
});
