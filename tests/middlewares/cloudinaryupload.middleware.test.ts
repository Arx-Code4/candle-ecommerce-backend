import { Request, Response, NextFunction } from 'express';
import attachProductPhotos from '../../src/middlewares/cloudinaryupload.middleware.js';
import { uploadBufferToCloudinary } from '../../src/config/cloudinary.js';
import ApiError from '../../src/utils/ApiError.js';

vi.mock('../../src/config/cloudinary.js', () => ({
  uploadBufferToCloudinary: vi.fn(),
}));

function buildFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'photos',
    originalname: 'candle.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('fake-image-bytes'),
    size: 1024,
    destination: '',
    filename: '',
    path: '',
    stream: undefined,
    ...overrides,
  } as Express.Multer.File;
}

describe('cloudinaryUpload.middleware (attachProductPhotos)', () => {
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    res = {} as Response;
    next = vi.fn();
  });

  it('is a no-op when req.files is undefined', async () => {
    const req = { body: { name: 'Vanilla Bliss' }, files: undefined } as unknown as Request;

    await attachProductPhotos(req, res, next);

    expect(uploadBufferToCloudinary).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
    expect(req.body.photos).toBeUndefined();
  });

  it('is a no-op when req.files is an empty array', async () => {
    const req = { body: { name: 'Vanilla Bliss' }, files: [] } as unknown as Request;

    await attachProductPhotos(req, res, next);

    expect(uploadBufferToCloudinary).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
    expect(req.body.photos).toBeUndefined();
  });

  it('uploads each file to Cloudinary and rewrites req.body.photos as { url, sortOrder }[]', async () => {
    vi.mocked(uploadBufferToCloudinary)
      .mockResolvedValueOnce({ secure_url: 'https://cdn.example.com/a.jpg' } as never)
      .mockResolvedValueOnce({ secure_url: 'https://cdn.example.com/b.jpg' } as never);

    const files = [buildFile({ originalname: 'a.jpg' }), buildFile({ originalname: 'b.jpg' })];
    const req = { body: { name: 'Vanilla Bliss' }, files } as unknown as Request;

    await attachProductPhotos(req, res, next);

    expect(uploadBufferToCloudinary).toHaveBeenCalledTimes(2);
    expect(uploadBufferToCloudinary).toHaveBeenNthCalledWith(1, files[0].buffer, {
      folder: 'products',
    });
    expect(uploadBufferToCloudinary).toHaveBeenNthCalledWith(2, files[1].buffer, {
      folder: 'products',
    });
    expect(req.body.photos).toEqual([
      { url: 'https://cdn.example.com/a.jpg', sortOrder: 0 },
      { url: 'https://cdn.example.com/b.jpg', sortOrder: 1 },
    ]);
    expect(req.body.name).toBe('Vanilla Bliss'); // other fields left untouched
    expect(next).toHaveBeenCalledWith();
  });

  it('keeps sortOrder matching upload order regardless of which promise resolves first', async () => {
    vi.mocked(uploadBufferToCloudinary).mockImplementation(
      (buffer: unknown) =>
        new Promise((resolve) => {
          const label = (buffer as Buffer).toString();
          const delay = label === 'first' ? 20 : 0; // "first" resolves last on purpose
          setTimeout(() => resolve({ secure_url: `https://cdn.example.com/${label}.jpg` }), delay);
        }) as never,
    );

    const files = [
      buildFile({ buffer: Buffer.from('first') }),
      buildFile({ buffer: Buffer.from('second') }),
    ];
    const req = { body: {}, files } as unknown as Request;

    await attachProductPhotos(req, res, next);

    expect(req.body.photos).toEqual([
      { url: 'https://cdn.example.com/first.jpg', sortOrder: 0 },
      { url: 'https://cdn.example.com/second.jpg', sortOrder: 1 },
    ]);
  });

  it('converts a Cloudinary failure into a 422 ApiError without leaking the raw error message', async () => {
    vi.mocked(uploadBufferToCloudinary).mockRejectedValue(new Error('Cloudinary network timeout'));

    const req = { body: {}, files: [buildFile()] } as unknown as Request;

    await attachProductPhotos(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(422);
    expect(error.message).toBe('Failed to upload product photos');
    expect(error.message).not.toMatch(/Cloudinary network timeout/);
  });

  it('fails the whole request if any single file upload rejects, even if others succeed', async () => {
    vi.mocked(uploadBufferToCloudinary)
      .mockResolvedValueOnce({ secure_url: 'https://cdn.example.com/a.jpg' } as never)
      .mockRejectedValueOnce(new Error('upload failed'));

    const files = [buildFile({ originalname: 'a.jpg' }), buildFile({ originalname: 'b.jpg' })];
    const req = { body: {}, files } as unknown as Request;

    await attachProductPhotos(req, res, next);

    const error = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(422);
    expect(req.body.photos).toBeUndefined();
  });
});
