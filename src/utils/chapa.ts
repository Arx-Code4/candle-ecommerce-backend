import axios from 'axios';
import crypto from 'crypto';
import { env } from '../config/env.js';
import ApiError from './ApiError.js';
import logger from './logger.js';

const CHAPA_BASE_URL = 'https://api.chapa.co/v1';
const REQUEST_TIMEOUT_MS = 10_000;

interface InitializeTransactionInput {
  amount: string;
  email: string;
  txRef: string;
  returnUrl: string;
}

interface InitializeTransactionResult {
  checkoutUrl: string;
}

export const initializeTransaction = async (
  input: InitializeTransactionInput,
): Promise<InitializeTransactionResult> => {
  try {
    const response = await axios.post(
      `${CHAPA_BASE_URL}/transaction/initialize`,
      {
        amount: input.amount,
        currency: 'ETB',
        email: input.email,
        tx_ref: input.txRef,
        return_url: input.returnUrl,
      },
      {
        headers: { Authorization: `Bearer ${env.CHAPA_SECRET_KEY}` },
        timeout: REQUEST_TIMEOUT_MS,
      },
    );

    const checkoutUrl = response.data?.data?.checkout_url;
    if (!checkoutUrl) {
      throw new Error('Missing checkout_url in Chapa response');
    }

    return { checkoutUrl };
  } catch (error) {
    logger.error(error, 'Chapa initializeTransaction failed');
    // NOTE: HTTP_STATUS has no BAD_GATEWAY entry today — using the literal
    // per the spec. Consider adding BAD_GATEWAY: 502 to constants/index.ts.
    throw new ApiError(502, 'Unable to reach payment provider, please try again');
  }
};

interface VerifyTransactionResult {
  status: 'success' | 'failed';
  amount: string;
}

export const verifyTransaction = async (txRef: string): Promise<VerifyTransactionResult> => {
  try {
    const response = await axios.get(`${CHAPA_BASE_URL}/transaction/verify/${txRef}`, {
      headers: { Authorization: `Bearer ${env.CHAPA_SECRET_KEY}` },
      timeout: REQUEST_TIMEOUT_MS,
    });

    const data = response.data?.data;
    const status: 'success' | 'failed' = data?.status === 'success' ? 'success' : 'failed';

    return { status, amount: String(data?.amount ?? '') };
  } catch (error) {
    logger.error(error, 'Chapa verifyTransaction failed');
    throw new ApiError(502, 'Unable to verify payment with provider');
  }
};

export const verifyWebhookSignature = (
  rawBody: string,
  signatureHeader: string | undefined,
): boolean => {
  if (!signatureHeader) return false;

  try {
    const expected = crypto
      .createHmac('sha256', env.CHAPA_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const providedBuffer = Buffer.from(signatureHeader, 'utf8');

    if (expectedBuffer.length !== providedBuffer.length) return false;

    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  } catch {
    return false;
  }
};
