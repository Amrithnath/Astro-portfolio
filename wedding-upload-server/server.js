import crypto from 'node:crypto';
import path from 'node:path';

import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { google } from 'googleapis';
import multer from 'multer';

dotenv.config();

const PORT = Number(process.env.PORT || 8787);
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const DEFAULT_ALLOWED_ORIGIN = 'http://localhost:4321,http://127.0.0.1:4321';
const MAX_FILE_BYTES = Number(process.env.MAX_FILE_BYTES || 10 * 1024 * 1024 * 1024);
const MAX_CHUNK_BYTES = Number(process.env.MAX_CHUNK_BYTES || 5 * 1024 * 1024);
const UPLOAD_SESSION_TTL_MS = Number(process.env.UPLOAD_SESSION_TTL_MS || 24 * 60 * 60 * 1000);
const MAX_ACTIVE_UPLOADS_PER_IP = Number(process.env.MAX_ACTIVE_UPLOADS_PER_IP || 12);
const INIT_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const INIT_LIMIT_MAX_REQUESTS = 25;

const allowedOrigins = (process.env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const allowedMimeTypes = new Set([
  'image/avif',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

const uploadSessions = new Map();
const activeUploadsByIp = new Map();
const initRateLimitByIp = new Map();

let cachedDriveContext = null;

function hasDriveConfiguration() {
  return Boolean(
    process.env.GOOGLE_DRIVE_FOLDER_ID &&
      process.env.GOOGLE_APPLICATION_CREDENTIALS &&
      process.env.GOOGLE_APPLICATION_CREDENTIALS.trim()
  );
}

function createError(status, message, details = {}) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function sanitizeFilename(filename) {
  const ext = path.extname(filename || '').slice(0, 12);
  const stem = path
    .basename(filename || 'upload', ext)
    .replace(/[^a-zA-Z0-9()_. -]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'upload';

  const normalizedExt = ext.replace(/[^a-zA-Z0-9.]/g, '').toLowerCase();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = crypto.randomUUID().slice(0, 8);

  return `${timestamp}-${suffix}-${stem}${normalizedExt}`;
}

function extractIp(req) {
  return req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
}

function setActiveUpload(ip, uploadId) {
  const ids = activeUploadsByIp.get(ip) || new Set();
  ids.add(uploadId);
  activeUploadsByIp.set(ip, ids);
}

function clearActiveUpload(ip, uploadId) {
  const ids = activeUploadsByIp.get(ip);
  if (!ids) {
    return;
  }

  ids.delete(uploadId);
  if (ids.size === 0) {
    activeUploadsByIp.delete(ip);
  }
}

function enforceInitRateLimit(ip) {
  const now = Date.now();
  const current = initRateLimitByIp.get(ip);

  if (!current || now - current.windowStart >= INIT_LIMIT_WINDOW_MS) {
    initRateLimitByIp.set(ip, { count: 1, windowStart: now });
    return;
  }

  if (current.count >= INIT_LIMIT_MAX_REQUESTS) {
    throw createError(429, 'Too many upload attempts from this network. Please wait a few minutes and try again.');
  }

  current.count += 1;
}

function cleanupExpiredSessions() {
  const now = Date.now();

  for (const [uploadId, session] of uploadSessions.entries()) {
    if (session.expiresAt <= now) {
      clearActiveUpload(session.ip, uploadId);
      uploadSessions.delete(uploadId);
    }
  }

  for (const [ip, state] of initRateLimitByIp.entries()) {
    if (now - state.windowStart >= INIT_LIMIT_WINDOW_MS) {
      initRateLimitByIp.delete(ip);
    }
  }
}

function parseContentRange(contentRange) {
  const match = /^bytes\s+(\d+)-(\d+)\/(\d+)$/.exec(contentRange || '');
  if (!match) {
    throw createError(400, 'Missing or invalid Content-Range header.');
  }

  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = Number(match[3]);

  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(total) || end < start) {
    throw createError(400, 'Invalid byte range in Content-Range header.');
  }

  return { start, end, total };
}

function parseUploadedRange(rangeHeader) {
  const match = /^bytes=0-(\d+)$/.exec(rangeHeader || '');
  if (!match) {
    return null;
  }

  return Number(match[1]);
}

function sniffMimeType(buffer) {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }

  const asciiHeader = buffer.subarray(0, 12).toString('ascii');
  if (asciiHeader.startsWith('GIF87a') || asciiHeader.startsWith('GIF89a')) {
    return 'image/gif';
  }

  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }

  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii').trim().toLowerCase();

    if (brand === 'qt') {
      return 'video/quicktime';
    }

    if (brand.startsWith('hei') || brand === 'mif1' || brand === 'msf1') {
      return 'image/heic';
    }

    return 'video/mp4';
  }

  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return 'video/webm';
  }

  return null;
}

function validateFirstChunk(upload, buffer) {
  const sniffedMimeType = sniffMimeType(buffer);
  if (!sniffedMimeType) {
    throw createError(400, 'The file could not be verified as a supported image or video.');
  }

  const allowedByClaim = upload.mimeType.startsWith('image/')
    ? sniffedMimeType.startsWith('image/')
    : sniffedMimeType.startsWith('video/');

  if (!allowedByClaim) {
    throw createError(400, 'The uploaded bytes do not match the declared media type.');
  }
}

async function ensureDriveContext() {
  if (cachedDriveContext) {
    return cachedDriveContext;
  }

  if (!hasDriveConfiguration()) {
    throw createError(503, 'Upload server is not configured yet. Add the Google Drive environment variables first.');
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: [DRIVE_SCOPE],
  });

  const authClient = await auth.getClient();
  const drive = google.drive({ version: 'v3', auth: authClient });

  try {
    await drive.files.get({
      fileId: process.env.GOOGLE_DRIVE_FOLDER_ID,
      fields: 'id,name,mimeType',
      supportsAllDrives: true,
    });
  } catch (error) {
    throw createError(
      503,
      'Google Drive folder access failed. Share the folder with the service account email and verify the folder ID.'
    );
  }

  cachedDriveContext = { authClient, drive };
  return cachedDriveContext;
}

async function getAccessToken() {
  const { authClient } = await ensureDriveContext();
  const tokenResponse = await authClient.getAccessToken();
  const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;

  if (!token) {
    throw createError(503, 'Could not obtain a Google Drive access token.');
  }

  return token;
}

async function createResumableSession({ filename, mimeType }) {
  const token = await getAccessToken();
  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
      },
      body: JSON.stringify({
        name: filename,
        mimeType,
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
      }),
    }
  );

  if (!response.ok) {
    const bodyText = await response.text();
    throw createError(502, `Google Drive rejected the upload session: ${bodyText || response.statusText}`);
  }

  const sessionUri = response.headers.get('location');
  if (!sessionUri) {
    throw createError(502, 'Google Drive did not return a resumable session location.');
  }

  return sessionUri;
}

const app = express();
app.set('trust proxy', true);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(createError(403, 'Origin is not allowed for uploads.'));
    },
    methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Content-Range'],
    optionsSuccessStatus: 204,
  })
);
app.use(express.json({ limit: '32kb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_CHUNK_BYTES,
    files: 1,
    fields: 8,
  },
});

app.get('/api/health', async (_req, res) => {
  cleanupExpiredSessions();

  if (!hasDriveConfiguration()) {
    res.status(503).json({
      ok: false,
      configured: false,
      message: 'Missing Google Drive environment variables.',
    });
    return;
  }

  try {
    await ensureDriveContext();
    res.json({
      ok: true,
      configured: true,
      activeUploads: Array.from(uploadSessions.values()).filter((session) => !session.complete).length,
    });
  } catch (error) {
    res.status(error.status || 503).json({
      ok: false,
      configured: true,
      message: error.message,
    });
  }
});

app.post('/api/upload/init', async (req, res, next) => {
  try {
    cleanupExpiredSessions();

    const ip = extractIp(req);
    enforceInitRateLimit(ip);

    const activeCount = activeUploadsByIp.get(ip)?.size || 0;
    if (activeCount >= MAX_ACTIVE_UPLOADS_PER_IP) {
      throw createError(429, 'Too many active uploads from this network. Please finish one before starting another.');
    }

    const { filename, mimeType, fileSize } = req.body || {};
    if (!filename || typeof filename !== 'string') {
      throw createError(400, 'A filename is required.');
    }

    if (!mimeType || typeof mimeType !== 'string' || !allowedMimeTypes.has(mimeType)) {
      throw createError(400, 'Only supported image and video uploads are allowed.');
    }

    const normalizedFileSize = Number(fileSize);
    if (!Number.isFinite(normalizedFileSize) || normalizedFileSize <= 0) {
      throw createError(400, 'A valid file size is required.');
    }

    if (normalizedFileSize > MAX_FILE_BYTES) {
      throw createError(413, `Files above ${Math.round(MAX_FILE_BYTES / (1024 * 1024 * 1024))} GB are not accepted.`);
    }

    const storedName = sanitizeFilename(filename);
    const sessionUri = await createResumableSession({ filename: storedName, mimeType });
    const uploadId = crypto.randomUUID();
    const expiresAt = Date.now() + UPLOAD_SESSION_TTL_MS;

    uploadSessions.set(uploadId, {
      uploadId,
      ip,
      originalName: filename,
      storedName,
      mimeType,
      totalBytes: normalizedFileSize,
      nextOffset: 0,
      sessionUri,
      createdAt: Date.now(),
      expiresAt,
      complete: false,
      validatedMagicBytes: false,
    });
    setActiveUpload(ip, uploadId);

    res.status(201).json({
      uploadId,
      chunkBytes: MAX_CHUNK_BYTES,
      maxFileBytes: MAX_FILE_BYTES,
      acceptedTypes: Array.from(allowedMimeTypes),
      expiresAt,
    });
  } catch (error) {
    next(error);
  }
});

app.put('/api/upload/chunk', upload.single('chunk'), async (req, res, next) => {
  try {
    cleanupExpiredSessions();

    const uploadId = String(req.body?.uploadId || '');
    const offset = Number(req.body?.offset);
    const chunk = req.file;
    const contentRange = req.get('Content-Range');

    if (!uploadId) {
      throw createError(400, 'uploadId is required.');
    }

    if (!chunk?.buffer?.length) {
      throw createError(400, 'A chunk file is required.');
    }

    if (!Number.isFinite(offset) || offset < 0) {
      throw createError(400, 'A valid upload offset is required.');
    }

    const session = uploadSessions.get(uploadId);
    if (!session) {
      throw createError(410, 'This upload session has expired. Start the file again.');
    }

    if (session.complete) {
      res.json({ nextOffset: session.totalBytes, complete: true });
      return;
    }

    if (session.expiresAt <= Date.now()) {
      clearActiveUpload(session.ip, uploadId);
      uploadSessions.delete(uploadId);
      throw createError(410, 'This upload session has expired. Start the file again.');
    }

    if (offset !== session.nextOffset) {
      res.status(409).json({
        error: 'Chunk offset is out of sync.',
        nextOffset: session.nextOffset,
      });
      return;
    }

    const range = parseContentRange(contentRange);
    if (range.total !== session.totalBytes) {
      throw createError(400, 'Chunk total size does not match the initialized file size.');
    }

    if (range.start !== session.nextOffset) {
      res.status(409).json({
        error: 'Chunk range is out of sync.',
        nextOffset: session.nextOffset,
      });
      return;
    }

    const expectedLength = range.end - range.start + 1;
    if (expectedLength !== chunk.size) {
      throw createError(400, 'Chunk size does not match Content-Range.');
    }

    if (!session.validatedMagicBytes) {
      validateFirstChunk(session, chunk.buffer);
      session.validatedMagicBytes = true;
    }

    const token = await getAccessToken();
    const driveResponse = await fetch(session.sessionUri, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Length': String(chunk.size),
        'Content-Type': session.mimeType,
        'Content-Range': contentRange,
      },
      body: chunk.buffer,
    });

    if (driveResponse.status === 308) {
      const uploadedRange = parseUploadedRange(driveResponse.headers.get('range'));
      session.nextOffset = uploadedRange !== null ? uploadedRange + 1 : range.end + 1;

      res.json({
        nextOffset: session.nextOffset,
        complete: false,
      });
      return;
    }

    if (driveResponse.status === 200 || driveResponse.status === 201) {
      session.nextOffset = session.totalBytes;
      session.complete = true;
      clearActiveUpload(session.ip, uploadId);

      const payload = await driveResponse.json().catch(() => ({}));
      res.json({
        nextOffset: session.totalBytes,
        complete: true,
        fileId: payload.id,
      });
      return;
    }

    if (driveResponse.status === 404 || driveResponse.status === 410) {
      throw createError(410, 'Google Drive upload session expired. Restart this file upload.');
    }

    if (driveResponse.status >= 500) {
      res.set('Retry-After', '2');
      throw createError(503, 'Google Drive is temporarily unavailable. Retry the current chunk shortly.');
    }

    const bodyText = await driveResponse.text();
    throw createError(502, `Google Drive rejected the upload chunk: ${bodyText || driveResponse.statusText}`);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: `Chunk exceeded the ${MAX_CHUNK_BYTES} byte limit.` });
      return;
    }

    res.status(400).json({ error: error.message });
    return;
  }

  const status = error.status || 500;
  const payload = { error: error.message || 'Unexpected upload server error.' };
  res.status(status).json(payload);
});

setInterval(cleanupExpiredSessions, 60 * 1000).unref();

app.listen(PORT, () => {
  console.log(`Wedding upload server listening on http://127.0.0.1:${PORT}`);
});
