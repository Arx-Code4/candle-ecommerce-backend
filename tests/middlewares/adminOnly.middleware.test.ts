import { Response, NextFunction } from 'express';
import adminOnly from '../../src/middlewares/adminOnly.middleware.js';
import { AuthRequest } from '../../src/types/index.js';
import ApiError from '../../src/utils/ApiError.js';

describe.skip('adminOnly.middleware', () => {
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    res = {} as Response;
    next = vi.fn();
  });

  it('allows request when role is ADMIN', () => {
    const req = { user: { id: 'user-1', role: 'ADMIN' } } as AuthRequest;

    adminOnly(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('blocks request when role is CUSTOMER', () => {
    const req = { user: { id: 'user-1', role: 'CUSTOMER' } } as AuthRequest;

    adminOnly(req, res, next);

    const calledWith = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as ApiError;
    expect(calledWith).toBeInstanceOf(ApiError);
    expect(calledWith.statusCode).toBe(403);
    expect(calledWith.message).toBe('Forbidden');
  });

  it('blocks request when req.user is missing entirely', () => {
    const req = { user: undefined } as AuthRequest;

    adminOnly(req, res, next);

    const calledWith = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as ApiError;
    expect(calledWith).toBeInstanceOf(ApiError);
    expect(calledWith.statusCode).toBe(403);
    expect(calledWith.message).toBe('Forbidden');
  });

  it('treats missing req.user identically to wrong role', () => {
    const missingUserReq = { user: undefined } as AuthRequest;
    const wrongRoleReq = { user: { id: 'user-1', role: 'CUSTOMER' } } as AuthRequest;
    const nextA = vi.fn();
    const nextB = vi.fn();

    adminOnly(missingUserReq, res, nextA);
    adminOnly(wrongRoleReq, res, nextB);

    const errorA = nextA.mock.calls[0][0] as ApiError;
    const errorB = nextB.mock.calls[0][0] as ApiError;
    expect(errorA.statusCode).toBe(errorB.statusCode);
    expect(errorA.message).toBe(errorB.message);
  });

  it('does not throw synchronously on malformed req.user', () => {
    const req = { user: {} } as unknown as AuthRequest;

    expect(() => adminOnly(req, res, next)).not.toThrow();

    const calledWith = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as ApiError;
    expect(calledWith).toBeInstanceOf(ApiError);
    expect(calledWith.statusCode).toBe(403);
    expect(calledWith.message).toBe('Forbidden');
  });
});
