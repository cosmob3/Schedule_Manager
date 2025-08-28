import multer from "multer";

export const config = {
  runtime: "nodejs",
  api: { bodyParser: false },
};

// In-memory storage + basic image-only filter
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    // accept image/* only
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      // Use MulterError so it shows cleanly in Vercel logs
      return cb(
        new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname)
      );
    }
    cb(null, true);
  },
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

// Allow either 'file' or 'image' field names
const acceptEitherField = upload.fields([
  { name: "file", maxCount: 1 },
  { name: "image", maxCount: 1 },
]);

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await runMiddleware(req, res, acceptEitherField);

    const file =
      (req.files?.file && req.files.file[0]) ||
      (req.files?.image && req.files.image[0]);

    if (!file || !file.buffer) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    // Dynamically import so it's only loaded in Node
    const { createWorker } = await import("tesseract.js");

    const worker = await createWorker();
    await worker.load();
    await worker.loadLanguage("eng");
    await worker.initialize("eng");

    const { data } = await worker.recognize(file.buffer);
    await worker.terminate();

    return res.status(200).json({ text: (data?.text || "").trim() });
  } catch (err) {
    console.error("OCR Error:", err);
    // Surface Multer errors clearly
    if (err?.name === "MulterError") {
      return res.status(400).json({ error: err.code || "Upload error" });
    }
    return res.status(500).json({ error: "OCR failed" });
  }
}
