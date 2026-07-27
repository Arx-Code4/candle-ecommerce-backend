import express, { Express, Request, Response } from 'express';
import request from 'supertest';
import productPhotosUpload from '../../src/middlewares/upload.middleware.js';
import errorMiddleware from '../../src/middlewares/error.middleware.js';

const buildApp = (): Express => {
  const app = express();

  app.post('/upload-test', productPhotosUpload, (req: Request, res: Response) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    res.status(200).json({
      fileCount: files.length,
      mimetypes: files.map((f) => f.mimetype),
      hasBuffer: files.every((f) => Buffer.isBuffer(f.buffer)),
      hasDiskPath: files.some((f) => Boolean((f as { path?: string }).path)),
      body: req.body,
    });
  });

  app.use(errorMiddleware);
  return app;
};

describe('upload.middleware (productPhotosUpload)', () => {
  let app: Express;

  beforeEach(() => {
    app = buildApp();
  });

  it('accepts a valid image file and buffers it in memory (no disk write)', async () => {
    const res = await request(app)
      .post('/upload-test')
      .attach('photos', Buffer.from('fake-jpeg-bytes'), {
        filename: 'candle.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(200);
    expect(res.body.fileCount).toBe(1);
    expect(res.body.mimetypes).toEqual(['image/jpeg']);
    expect(res.body.hasBuffer).toBe(true);
    expect(res.body.hasDiskPath).toBe(false);
  });

  it('accepts png and webp in addition to jpeg', async () => {
    const res = await request(app)
      .post('/upload-test')
      .attach('photos', Buffer.from('fake-png-bytes'), {
        filename: 'candle.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(200);
    expect(res.body.mimetypes).toEqual(['image/png']);
  });

  it('accepts multiple files up to the configured max (6)', async () => {
    let req = request(app).post('/upload-test');
    for (let i = 0; i < 6; i += 1) {
      req = req.attach('photos', Buffer.from(`fake-image-${i}`), {
        filename: `photo-${i}.png`,
        contentType: 'image/png',
      });
    }
    const res = await req;

    expect(res.status).toBe(200);
    expect(res.body.fileCount).toBe(6);
  });

  it('rejects a disallowed file type with a 400 ApiError naming the mimetype', async () => {
    const res = await request(app)
      .post('/upload-test')
      .attach('photos', Buffer.from('not-an-image'), {
        filename: 'malware.exe',
        contentType: 'application/x-msdownload',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Unsupported file type/);
    expect(res.body.message).toMatch(/application\/x-msdownload/);
  });

  it('rejects a file over the size limit as a normalized 400, not a raw MulterError', async () => {
    const oversized = Buffer.alloc(6 * 1024 * 1024, 'a'); // > 5MB limit

    const res = await request(app)
      .post('/upload-test')
      .attach('photos', oversized, { filename: 'huge.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(typeof res.body.message).toBe('string');
  });

  it('rejects more files than the configured max (6) with a 400', async () => {
    let req = request(app).post('/upload-test');
    for (let i = 0; i < 7; i += 1) {
      req = req.attach('photos', Buffer.from(`fake-image-${i}`), {
        filename: `photo-${i}.png`,
        contentType: 'image/png',
      });
    }
    const res = await req;

    expect(res.status).toBe(400);
  });

  it('passes through with an empty file list when the request has no files', async () => {
    const res = await request(app).post('/upload-test').field('name', 'Vanilla Bliss');

    expect(res.status).toBe(200);
    expect(res.body.fileCount).toBe(0);
    expect(res.body.body.name).toBe('Vanilla Bliss');
  });
});
