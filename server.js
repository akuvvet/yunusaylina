const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const ftp = require('basic-ftp');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(cookieParser());
app.use(
  express.urlencoded({
    extended: false,
  }),
);

const publicDir = path.join(__dirname, 'public');
const uploadDir = path.join(__dirname, 'uploads');
const metadataFile = path.join(uploadDir, 'metadata.json');

const ACCESS_USERNAME = process.env.ACCESS_USERNAME || 'yunusandaylina@klick-und-fertig.de';
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || 'yunusaylina2026';
const ACCESS_LINK_TOKEN =
  process.env.ACCESS_LINK_TOKEN || 'aanbacsdteafsgmhuimjskaltmsnaon3apXrXsXtXu240v2w6';

// FTP-Konfiguration – ACHTUNG: sensible Daten
// Für ein öffentliches GitHub-Repo solltest du diese Werte später in Umgebungsvariablen auslagern.
const FTP_HOST = process.env.FTP_HOST || 'okay.ddnss.org';
const FTP_USER = process.env.FTP_USER || 'strato-ftp';
const FTP_PASSWORD = process.env.FTP_PASSWORD || '-ASeee08+';
const FTP_BASE_DIR = process.env.FTP_BASE_DIR || '/backup/backup/yunusaylina';

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function loadMetadata() {
  try {
    if (!fs.existsSync(metadataFile)) return {};
    const raw = fs.readFileSync(metadataFile, 'utf8');
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Fehler beim Laden der Metadaten', error);
    return {};
  }
}

function saveMetadata(data) {
  try {
    fs.writeFileSync(metadataFile, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Fehler beim Speichern der Metadaten', error);
  }
}

function getUploadedAtFromName(name) {
  const ts = Number(String(name).split('-')[0]);
  if (!Number.isFinite(ts) || ts <= 0) return null;
  return new Date(ts).toISOString();
}

async function uploadFileToFtp(file) {
  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASSWORD,
      secure: false,
    });

    await client.ensureDir(FTP_BASE_DIR);
    await client.cd(FTP_BASE_DIR);
    await client.uploadFrom(file.path, file.filename);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Fehler beim FTP-Upload', error);
  } finally {
    client.close();
  }
}

function isAuthenticated(req) {
  return req.cookies && req.cookies.authToken === ACCESS_LINK_TOKEN;
}

function authMiddleware(req, res, next) {
  const publicPaths = ['/login'];

  if (publicPaths.includes(req.path)) {
    return next();
  }

  if (req.query && req.query.key && req.query.key === ACCESS_LINK_TOKEN) {
    res.cookie('authToken', ACCESS_LINK_TOKEN, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });

    const cleanUrl = req.path && req.path !== '/login' ? req.path : '/';
    return res.redirect(cleanUrl);
  }

  if (isAuthenticated(req)) {
    return next();
  }

  const nextUrl = encodeURIComponent(req.originalUrl || '/');
  return res.redirect(`/login?next=${nextUrl}`);
}

app.use(authMiddleware);

app.use(express.static(publicDir));
app.use('/uploads', express.static(uploadDir));

app.get('/login', (req, res) => {
  const { error } = req.query || {};

  res.send(`<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <title>Login · Media Upload Galerie</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: dark;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
        background: radial-gradient(circle at 0 0, rgba(56, 189, 248, 0.12), transparent 60%),
          radial-gradient(circle at 100% 0, rgba(139, 92, 246, 0.12), transparent 55%),
          #050816;
        color: #e5e7eb;
      }
      .card {
        width: 100%;
        max-width: 360px;
        padding: 24px 22px 22px;
        border-radius: 18px;
        background: radial-gradient(circle at top left, rgba(129, 140, 248, 0.1), transparent 60%),
          rgba(15, 23, 42, 0.95);
        border: 1px solid rgba(148, 163, 184, 0.55);
        box-shadow: 0 18px 45px rgba(15, 23, 42, 0.9);
      }
      h1 {
        margin: 0 0 4px;
        font-size: 1.25rem;
      }
      p {
        margin: 0 0 16px;
        font-size: 0.9rem;
        color: #9ca3af;
      }
      label {
        display: block;
        font-size: 0.8rem;
        color: #9ca3af;
        margin-bottom: 4px;
      }
      input[type="text"],
      input[type="password"] {
        width: 100%;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.7);
        background: rgba(15, 23, 42, 0.9);
        color: #e5e7eb;
        padding: 7px 12px;
        font-size: 0.9rem;
        outline: none;
        margin-bottom: 10px;
      }
      input::placeholder {
        color: rgba(148, 163, 184, 0.9);
      }
      input:focus {
        border-color: rgba(191, 219, 254, 0.95);
        box-shadow: 0 0 0 1px rgba(191, 219, 254, 0.7);
      }
      .error {
        margin: 0 0 10px;
        font-size: 0.8rem;
        color: #fecaca;
      }
      button {
        width: 100%;
        border: none;
        border-radius: 999px;
        padding: 8px 14px;
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        background: linear-gradient(135deg, #4f46e5, #6366f1);
        color: #eef2ff;
        box-shadow:
          0 10px 30px rgba(79, 70, 229, 0.7),
          0 0 0 1px rgba(191, 219, 254, 0.4);
      }
      .hint {
        margin-top: 10px;
        font-size: 0.75rem;
        color: #6b7280;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Login</h1>
      <p>Diese Seite ist mit Benutzername und Passwort geschützt.</p>
      ${error === '1' ? '<p class="error">Benutzername oder Passwort falsch.</p>' : ''}
      <form method="post" action="/login">
        <label for="username">Benutzername</label>
        <input id="username" name="username" type="text" autocomplete="username" required />
        <label for="password">Passwort</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required />
        <input type="hidden" name="next" value="${encodeURIComponent(
          (req.query && req.query.next) || '/',
        )}" />
        <button type="submit">Anmelden</button>
      </form>
      <p class="hint">Oder öffne den geheimen Link mit eingebautem Zugang.</p>
    </main>
  </body>
</html>`);
});

app.post('/login', (req, res) => {
  const { username, password, next: nextRaw } = req.body || {};

  if (username === ACCESS_USERNAME && password === ACCESS_PASSWORD) {
    res.cookie('authToken', ACCESS_LINK_TOKEN, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });

    let redirectTo = '/';
    if (nextRaw && typeof nextRaw === 'string') {
      try {
        redirectTo = decodeURIComponent(nextRaw);
      } catch {
        redirectTo = '/';
      }
    }

    return res.redirect(redirectTo);
  }

  const nextSafe =
    nextRaw && typeof nextRaw === 'string' ? encodeURIComponent(nextRaw) : encodeURIComponent('/');
  return res.redirect(`/login?error=1&next=${nextSafe}`);
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({ storage });

function detectType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
  const videoExts = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];

  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  return 'other';
}

app.post('/api/upload', upload.array('files', 50), async (req, res) => {
  const metadata = loadMetadata();
  const uploader = (req.body && req.body.uploader) || null;

  const uploadTasks = [];

  const files = (req.files || []).map((file) => {
    metadata[file.filename] = {
      uploader,
    };

    uploadTasks.push(uploadFileToFtp(file));

    return {
      id: file.filename,
      originalName: file.originalname,
      size: file.size,
      type: detectType(file.filename),
      url: `/uploads/${file.filename}`,
      uploadedAt: getUploadedAtFromName(file.filename),
      uploader,
    };
  });

  if (uploadTasks.length > 0) {
    await Promise.all(uploadTasks);
  }

  saveMetadata(metadata);

  res.json({ files });
});

app.get('/api/files', (_req, res) => {
  const metadata = loadMetadata();

  fs.readdir(uploadDir, (err, entries) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      return res.status(500).json({ error: 'Konnte Upload-Verzeichnis nicht lesen.' });
    }

    const files = entries
      .filter((name) => !name.startsWith('.') && name !== 'metadata.json')
      .map((name) => {
        const uploadedAt = getUploadedAtFromName(name);
        const meta = metadata[name] || {};
        let size = null;
        try {
          size = fs.statSync(path.join(uploadDir, name)).size;
        } catch {
          size = null;
        }

        return {
          id: name,
          originalName: name.split('-').slice(1).join('-') || name,
          type: detectType(name),
          url: `/uploads/${name}`,
          uploadedAt,
          uploader: meta.uploader || null,
          size,
        };
      });

    return res.json({ files });
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server läuft auf http://localhost:${PORT}`);
});

