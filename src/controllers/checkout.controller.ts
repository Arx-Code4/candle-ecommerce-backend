import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import * as checkoutService from '../services/checkout.service.js';
import * as chapa from '../utils/chapa.js';
import { SuccessResponse } from '../utils/ApiResponse.js';
import { HTTP_STATUS } from '../constants/index.js';
import ApiError from '../utils/ApiError.js';

export const initiateCheckout = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await checkoutService.createChapaSession(req.user!.id, req.body);
    return res
      .status(HTTP_STATUS.OK)
      .json(new SuccessResponse(HTTP_STATUS.OK, 'Checkout session created', result));
  } catch (error) {
    next(error);
  }
};

export const handleChapaWebhook = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // req.body is a raw Buffer at this point — see app.ts's raw-body
    // exception for this exact path.
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body ?? '');

    // TODO: confirm exact header name against Chapa's current docs.
    const signatureHeader = req.headers['x-chapa-signature'] as string | undefined;

    if (!chapa.verifyWebhookSignature(rawBody, signatureHeader)) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid webhook signature');
    }

    let parsedBody: { tx_ref?: string };
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid webhook payload');
    }

    const txRef = parsedBody.tx_ref;
    if (!txRef) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Missing tx_ref in webhook payload');
    }

    // Never trust body.status directly — confirmChapaPayment gets its
    // status from this independently-verified server-to-server call.
    const verification = await chapa.verifyTransaction(txRef);

    await checkoutService.confirmChapaPayment(txRef, verification.status);

    return res
      .status(HTTP_STATUS.OK)
      .json(new SuccessResponse(HTTP_STATUS.OK, 'Webhook processed', { received: true }));
  } catch (error) {
    // Signature/lookup failures propagate as non-200 on purpose; every
    // other outcome (including failed/cancelled payments) returns 200 so
    // Chapa doesn't retry indefinitely.
    next(error);
  }
};
