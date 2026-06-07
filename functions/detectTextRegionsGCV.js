// Google Cloud Vision text detection — an alternative to the in-browser
// Tesseract path. GCV reads display fonts, scripts, and stylized typography
// far more reliably than Tesseract.
//
// Implemented as onRequest (not onCall) because v2 onCall + cors:true has
// been unreliable from localhost; raw onRequest with explicit preflight is
// bulletproof and the client just uses fetch.
//
// To enable on the GCP project: enable Vision API (one-time console click),
// then deploy. Auth uses the Cloud Functions default service account.

const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const vision = require('@google-cloud/vision');

let _client = null;
function getClient() {
  if (!_client) {
    _client = new vision.ImageAnnotatorClient();
  }
  return _client;
}

function bboxFromPoly(poly) {
  const verts = (poly && poly.vertices) || [];
  if (verts.length === 0) return { x0: 0, y0: 0, x1: 0, y1: 0 };
  const xs = verts.map((v) => v.x || 0);
  const ys = verts.map((v) => v.y || 0);
  return {
    x0: Math.min(...xs),
    y0: Math.min(...ys),
    x1: Math.max(...xs),
    y1: Math.max(...ys),
  };
}

function applyCors(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '3600');
}

exports.detectTextRegionsGCV = onRequest(
  {
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  async (req, res) => {
    applyCors(res);
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { imageUrl } = req.body || {};
    if (!imageUrl) {
      res.status(400).json({ error: 'imageUrl is required' });
      return;
    }

    const t0 = Date.now();
    logger.info('detectTextRegionsGCV start', { imageUrl });

    let imageBytes;
    try {
      const r = await fetch(imageUrl);
      if (!r.ok) {
        throw new Error(`fetch ${imageUrl} → ${r.status} ${r.statusText}`);
      }
      const buffer = Buffer.from(await r.arrayBuffer());
      imageBytes = buffer.toString('base64');
    } catch (err) {
      logger.error('image fetch failed', { message: err.message });
      res.status(500).json({ error: `image fetch failed: ${err.message}` });
      return;
    }

    try {
      const client = getClient();
      const [result] = await client.documentTextDetection({
        image: { content: imageBytes },
      });

      const annotations = result.textAnnotations || [];
      const fullText = annotations[0] ? annotations[0].description : '';
      const words = annotations.slice(1).map((a) => ({
        text: a.description || '',
        confidence: 100,
        bbox: bboxFromPoly(a.boundingPoly),
      }));

      const elapsedMs = Date.now() - t0;
      logger.info('detectTextRegionsGCV done', {
        wordCount: words.length,
        fullTextChars: fullText.length,
        elapsedMs,
      });

      res.json({ words, fullText, elapsedMs });
    } catch (err) {
      logger.error('vision call failed', {
        message: err.message,
        code: err.code,
        details: err.details,
      });
      res.status(500).json({
        error: `GCV: ${err.message || `code ${err.code}` || 'unknown'}`,
      });
    }
  }
);
