/**
 * A synthetic demo photo so the Hero Generator works before any upload —
 * from the text-over-image experiment: a sky with a bright sun and dark
 * hills, which makes the worst-pixel solving visibly matter.
 */
export function makeSampleImage(w = 1200, h = 640): string {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#0b1e3f');
  g.addColorStop(0.5, '#3a6ea5');
  g.addColorStop(1, '#f4d58d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const sun = ctx.createRadialGradient(w * 0.78, h * 0.28, 10, w * 0.78, h * 0.28, 180);
  sun.addColorStop(0, 'rgba(255,255,255,0.95)');
  sun.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(8,10,20,0.85)';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h * 0.7);
  ctx.quadraticCurveTo(w * 0.3, h * 0.55, w * 0.55, h * 0.72);
  ctx.quadraticCurveTo(w * 0.8, h * 0.9, w, h * 0.68);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  return c.toDataURL('image/jpeg', 0.85);
}
