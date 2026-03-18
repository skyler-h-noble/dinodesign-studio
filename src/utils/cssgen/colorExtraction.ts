import chroma from 'chroma-js';

export interface ExtractedColor {
  hex: string;
  dominance: number; // 0-1, percentage of image
  isSwatchColor: boolean;
}

export interface SwatchRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  shape: 'circle' | 'rectangle' | 'square';
  pixelCount: number;
  confidence: number; // 0-1, how confident this is actually a swatch
}

/**
 * Extract colors from an image with swatch detection
 */
export async function extractColorsFromImage(
  imageUrl: string,
  maxColors: number = 10
): Promise<ExtractedColor[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    // Only set crossOrigin if it's not a data URL
    if (!imageUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    
    img.onload = () => {
      try {
        // Create canvas at full resolution for accurate color extraction
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Step 1: Detect color swatches with improved algorithm
        const swatchRegions = detectSwatchesImproved(imageData, canvas.width, canvas.height);
        
        console.log('Detected swatches:', swatchRegions);
        
        // Step 2: Calculate confidence scores for all swatches
        const swatchesWithConfidence = calculateSwatchConfidence(swatchRegions, canvas.width, canvas.height);
        
        // Step 3: Sort by confidence and filter to only high-confidence swatches
        const highConfidenceSwatches = swatchesWithConfidence
          .filter(swatch => swatch.confidence > 0.5) // Only keep swatches with >50% confidence
          .sort((a, b) => {
            // Sort by position: top-to-bottom, then left-to-right
            // First compare y positions
            const yDiff = a.y - b.y;
            if (Math.abs(yDiff) > 20) { // If y difference is significant (more than 20px)
              return yDiff; // Sort by y (top to bottom)
            }
            // If y positions are similar, sort by x (left to right)
            return a.x - b.x;
          });
        
        console.log('High confidence swatches:', highConfidenceSwatches);
        
        // Step 4: Extract colors from high-confidence swatches
        const swatchColors = highConfidenceSwatches.map(swatch => ({
          hex: swatch.color,
          dominance: swatch.pixelCount / (canvas.width * canvas.height),
          isSwatchColor: true,
        }));
        
        // No need to re-sort - we want to maintain the position-based order
        
        // Step 5: Extract dominant colors from the entire image
        const allDominantColors = extractDominantColors(imageData, maxColors * 3);
        
        // Step 6: Remove swatch colors from dominant colors to avoid duplicates
        const swatchHexes = swatchColors.map(s => s.hex);
        const nonSwatchColors = allDominantColors
          .filter(color => !isColorSimilar(color.hex, swatchHexes, 40))
          .map(color => ({
            ...color,
            isSwatchColor: false,
          }));
        
        // Step 7: Combine swatch colors (priority) with dominant colors
        const allColors = [...swatchColors, ...nonSwatchColors];
        
        // Step 8: Sort by dominance and limit to maxColors
        allColors.sort((a, b) => {
          // Prioritize swatch colors
          if (a.isSwatchColor && !b.isSwatchColor) return -1;
          if (!a.isSwatchColor && b.isSwatchColor) return 1;
          // Then sort by dominance
          return b.dominance - a.dominance;
        });
        
        resolve(allColors.slice(0, maxColors));
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = (event) => {
      console.error('Image failed to load:', event);
      console.error('Image URL:', imageUrl);
      reject(new Error(`Failed to load image. Please ensure the image is valid and accessible.`));
    };
    
    img.src = imageUrl;
  });
}

/**
 * Calculate confidence scores for detected swatches
 */
function calculateSwatchConfidence(
  swatches: SwatchRegion[],
  imageWidth: number,
  imageHeight: number
): SwatchRegion[] {
  if (swatches.length === 0) return swatches;
  
  // Calculate median size for consistency scoring
  const sizes = swatches.map(s => s.width * s.height).sort((a, b) => a - b);
  const medianSize = sizes[Math.floor(sizes.length / 2)];
  
  // Find aligned groups (swatches that form rows or columns)
  const alignmentBonus = calculateAlignmentBonuses(swatches);
  
  return swatches.map((swatch, index) => {
    let confidence = 0;
    
    // 1. Shape regularity score (0-0.4)
    const aspectRatio = swatch.width / swatch.height;
    const fillRatio = swatch.pixelCount / (swatch.width * swatch.height);
    
    if (swatch.shape === 'circle') {
      // Perfect circle has fill ratio ~0.785
      const circleScore = 1 - Math.abs(fillRatio - 0.785) / 0.785;
      const aspectScore = 1 - Math.abs(aspectRatio - 1);
      confidence += (circleScore * 0.25 + aspectScore * 0.15);
    } else if (swatch.shape === 'square') {
      // Perfect square has fill ratio >0.9 and aspect ratio ~1
      const squareScore = Math.min(fillRatio / 0.9, 1);
      const aspectScore = 1 - Math.abs(aspectRatio - 1);
      confidence += (squareScore * 0.25 + aspectScore * 0.15);
    } else {
      // Rectangle - should have high fill ratio
      const rectScore = Math.min(fillRatio / 0.85, 1);
      confidence += rectScore * 0.3;
    }
    
    // 2. Size consistency score (0-0.25)
    // Swatches tend to be similar in size to each other
    const sizeRatio = (swatch.width * swatch.height) / medianSize;
    const sizeScore = 1 - Math.min(Math.abs(1 - sizeRatio), 1);
    confidence += sizeScore * 0.25;
    
    // 3. Size appropriateness score (0-0.2)
    // Not too large (likely photo background) or too small
    const imageArea = imageWidth * imageHeight;
    const swatchArea = swatch.width * swatch.height;
    const swatchPercentage = swatchArea / imageArea;
    
    if (swatchPercentage > 0.002 && swatchPercentage < 0.04) {
      // Ideal size range for swatches (0.2% - 4% of image)
      confidence += 0.2;
    } else if (swatchPercentage >= 0.04 && swatchPercentage < 0.08) {
      // Acceptable but on the larger side
      confidence += 0.1;
    } else if (swatchPercentage >= 0.0008 && swatchPercentage <= 0.002) {
      // Small but possible
      confidence += 0.05;
    }
    
    // 4. Alignment bonus (0-0.15)
    // Swatches arranged in rows or columns get bonus points
    confidence += alignmentBonus[index];
    
    return {
      ...swatch,
      confidence: Math.min(confidence, 1),
    };
  });
}

/**
 * Calculate alignment bonuses for swatches that form rows or columns
 */
function calculateAlignmentBonuses(swatches: SwatchRegion[]): number[] {
  const bonuses = new Array(swatches.length).fill(0);
  const alignmentTolerance = 0.15; // 15% tolerance for alignment
  
  for (let i = 0; i < swatches.length; i++) {
    const swatch = swatches[i];
    let horizontalAligned = 0;
    let verticalAligned = 0;
    let similarSize = 0;
    
    for (let j = 0; j < swatches.length; j++) {
      if (i === j) continue;
      
      const other = swatches[j];
      
      // Check horizontal alignment (same Y position)
      const yDiff = Math.abs(swatch.y - other.y);
      const maxHeight = Math.max(swatch.height, other.height);
      if (yDiff / maxHeight < alignmentTolerance) {
        horizontalAligned++;
      }
      
      // Check vertical alignment (same X position)
      const xDiff = Math.abs(swatch.x - other.x);
      const maxWidth = Math.max(swatch.width, other.width);
      if (xDiff / maxWidth < alignmentTolerance) {
        verticalAligned++;
      }
      
      // Check size similarity
      const area1 = swatch.width * swatch.height;
      const area2 = other.width * other.height;
      const sizeRatio = Math.min(area1, area2) / Math.max(area1, area2);
      if (sizeRatio > 0.7) { // Within 30% of each other
        similarSize++;
      }
    }
    
    // Award bonus for being part of an aligned group
    const maxAligned = Math.max(horizontalAligned, verticalAligned);
    
    if (maxAligned >= 2) {
      // 3+ swatches aligned
      bonuses[i] = 0.15;
    } else if (maxAligned === 1) {
      // 2 swatches aligned
      bonuses[i] = 0.10;
    }
    
    // Additional bonus if aligned swatches are similar in size
    if (maxAligned >= 1 && similarSize >= 1) {
      bonuses[i] += 0.05;
    }
  }
  
  return bonuses;
}

/**
 * Improved swatch detection using flood fill algorithm
 */
function detectSwatchesImproved(
  imageData: ImageData,
  width: number,
  height: number
): SwatchRegion[] {
  const swatches: SwatchRegion[] = [];
  const visited = new Set<string>();
  
  // Calculate minimum and maximum swatch sizes
  const imageArea = width * height;
  const minSwatchPixels = imageArea * 0.0005; // 0.05% of image
  const maxSwatchPixels = imageArea * 0.08; // 8% of image
  
  // Use a finer grid for better detection
  const gridSize = Math.max(6, Math.floor(Math.min(width, height) / 60));
  
  for (let y = 0; y < height; y += gridSize) {
    for (let x = 0; x < width; x += gridSize) {
      const key = `${x},${y}`;
      if (visited.has(key)) continue;
      
      const color = getColorAt(imageData, x, y, width);
      if (!color) continue;
      
      // Skip very light colors (likely white background)
      if (isVeryLight(color)) continue;
      
      // Skip very dark colors (likely black text/shadows)
      if (isVeryDark(color)) continue;
      
      // Try flood fill from this point
      const region = floodFillRegion(imageData, x, y, width, height, color, visited);
      
      if (region && 
          region.pixelCount >= minSwatchPixels && 
          region.pixelCount <= maxSwatchPixels) {
        
        // Check if region has a regular shape (circle, square, or rectangle)
        const aspectRatio = region.width / region.height;
        const fillRatio = region.pixelCount / (region.width * region.height);
        
        // Determine if it's a valid swatch based on shape regularity
        let isValidSwatch = false;
        let shape: 'circle' | 'rectangle' | 'square' = 'rectangle';
        
        // Check for circular shape (high fill ratio ~0.785 for perfect circle)
        if (Math.abs(aspectRatio - 1) < 0.35 && fillRatio > 0.6 && fillRatio < 0.95) {
          shape = 'circle';
          isValidSwatch = true;
        }
        // Check for square shape
        else if (Math.abs(aspectRatio - 1) < 0.25 && fillRatio > 0.8) {
          shape = 'square';
          isValidSwatch = true;
        }
        // Check for rectangle shape
        else if ((aspectRatio > 1.4 || aspectRatio < 0.71) && fillRatio > 0.8) {
          shape = 'rectangle';
          isValidSwatch = true;
        }
        
        if (isValidSwatch) {
          swatches.push({
            ...region,
            shape,
            confidence: 0, // Will be calculated later
          });
        }
      }
    }
  }
  
  // Remove overlapping swatches, keeping the larger ones
  const filtered = removeOverlappingSwatches(swatches);
  
  return filtered;
}

/**
 * Flood fill algorithm to find connected regions of similar color
 */
function floodFillRegion(
  imageData: ImageData,
  startX: number,
  startY: number,
  width: number,
  height: number,
  targetColor: string,
  globalVisited: Set<string>,
  tolerance: number = 30
): SwatchRegion | null {
  const queue: Array<[number, number]> = [[startX, startY]];
  const visited = new Set<string>();
  const pixels: Array<[number, number]> = [];
  
  let minX = startX, maxX = startX;
  let minY = startY, maxY = startY;
  
  const maxPixels = width * height * 0.1; // Limit to 10% of image
  
  while (queue.length > 0 && pixels.length < maxPixels) {
    const [x, y] = queue.shift()!;
    const key = `${x},${y}`;
    
    if (visited.has(key) || globalVisited.has(key)) continue;
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    
    const color = getColorAt(imageData, x, y, width);
    if (!color || !areColorsSimilar(color, targetColor, tolerance)) continue;
    
    visited.add(key);
    globalVisited.add(key);
    pixels.push([x, y]);
    
    // Update bounds
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    
    // Add neighbors to queue
    queue.push([x + 1, y]);
    queue.push([x - 1, y]);
    queue.push([x, y + 1]);
    queue.push([x, y - 1]);
  }
  
  if (pixels.length < 10) return null;
  
  // Calculate average color from all pixels in the region
  const avgColor = calculateAverageColor(imageData, pixels, width);
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    color: avgColor,
    shape: 'rectangle',
    pixelCount: pixels.length,
    confidence: 0,
  };
}

/**
 * Calculate average color from a set of pixels
 */
function calculateAverageColor(
  imageData: ImageData,
  pixels: Array<[number, number]>,
  width: number
): string {
  let totalR = 0, totalG = 0, totalB = 0;
  
  for (const [x, y] of pixels) {
    const index = (y * width + x) * 4;
    totalR += imageData.data[index];
    totalG += imageData.data[index + 1];
    totalB += imageData.data[index + 2];
  }
  
  const count = pixels.length;
  const avgR = Math.round(totalR / count);
  const avgG = Math.round(totalG / count);
  const avgB = Math.round(totalB / count);
  
  return rgbToHex(avgR, avgG, avgB);
}

/**
 * Check if color is very light (likely background)
 */
function isVeryLight(hex: string): boolean {
  try {
    const c = chroma(hex);
    const [r, g, b] = c.rgb();
    return r > 240 && g > 240 && b > 240;
  } catch {
    return false;
  }
}

/**
 * Check if color is very dark (likely text/shadow)
 */
function isVeryDark(hex: string): boolean {
  try {
    const c = chroma(hex);
    const [r, g, b] = c.rgb();
    return r < 20 && g < 20 && b < 20;
  } catch {
    return false;
  }
}

/**
 * Remove overlapping swatches, keeping larger ones
 */
function removeOverlappingSwatches(swatches: SwatchRegion[]): SwatchRegion[] {
  const sorted = [...swatches].sort((a, b) => b.pixelCount - a.pixelCount);
  const result: SwatchRegion[] = [];
  
  for (const swatch of sorted) {
    let overlaps = false;
    for (const existing of result) {
      if (regionsOverlap(swatch, existing)) {
        // Allow some overlap for adjacent swatches
        const overlapArea = calculateOverlapArea(swatch, existing);
        const minArea = Math.min(
          swatch.width * swatch.height,
          existing.width * existing.height
        );
        
        // If overlap is more than 30% of the smaller region, skip it
        if (overlapArea / minArea > 0.3) {
          overlaps = true;
          break;
        }
      }
    }
    if (!overlaps) {
      result.push(swatch);
    }
  }
  
  return result;
}

/**
 * Calculate overlap area between two regions
 */
function calculateOverlapArea(a: SwatchRegion, b: SwatchRegion): number {
  const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return xOverlap * yOverlap;
}

/**
 * Check if two regions overlap
 */
function regionsOverlap(a: SwatchRegion, b: SwatchRegion): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

/**
 * Extract dominant colors from the entire image using color quantization
 */
function extractDominantColors(
  imageData: ImageData,
  maxColors: number
): ExtractedColor[] {
  const colorCounts = new Map<string, number>();
  const data = imageData.data;
  const totalPixels = imageData.width * imageData.height;
  
  // Sample pixels (every 3rd pixel for better coverage)
  for (let i = 0; i < data.length; i += 12) { // RGBA = 4 bytes, skip 3 pixels
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    // Skip transparent pixels
    if (a < 128) continue;
    
    // Skip very light colors (likely white/background)
    if (r > 240 && g > 240 && b > 240) continue;
    
    // Skip very dark colors (likely black/shadows)
    if (r < 20 && g < 20 && b < 20) continue;
    
    // Quantize color with finer granularity for more variety
    const qr = Math.round(r / 12) * 12;
    const qg = Math.round(g / 12) * 12;
    const qb = Math.round(b / 12) * 12;
    
    const hex = rgbToHex(qr, qg, qb);
    colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
  }
  
  // Convert to array and sort by frequency
  const colors = Array.from(colorCounts.entries())
    .map(([hex, count]) => ({
      hex,
      dominance: count / (totalPixels / 3), // Adjust for sampling (every 3rd pixel)
      isSwatchColor: false,
    }))
    .sort((a, b) => b.dominance - a.dominance);
  
  // Group similar colors and pick the most dominant from each group
  const groupedColors: ExtractedColor[] = [];
  const used = new Set<number>();
  
  for (let i = 0; i < colors.length && groupedColors.length < maxColors; i++) {
    if (used.has(i)) continue;
    
    const color = colors[i];
    let totalDominance = color.dominance;
    
    // Find similar colors and merge them (with tighter tolerance for more variety)
    for (let j = i + 1; j < colors.length; j++) {
      if (used.has(j)) continue;
      
      if (areColorsSimilar(color.hex, colors[j].hex, 20)) {
        totalDominance += colors[j].dominance;
        used.add(j);
      }
    }
    
    groupedColors.push({
      hex: color.hex,
      dominance: totalDominance,
      isSwatchColor: false,
    });
  }
  
  return groupedColors;
}

/**
 * Get color at specific coordinates
 */
function getColorAt(
  imageData: ImageData,
  x: number,
  y: number,
  width: number
): string | null {
  if (x < 0 || x >= width || y < 0 || y >= imageData.height) {
    return null;
  }
  
  const index = (y * width + x) * 4;
  const r = imageData.data[index];
  const g = imageData.data[index + 1];
  const b = imageData.data[index + 2];
  const a = imageData.data[index + 3];
  
  if (a < 128) return null; // Skip transparent pixels
  
  return rgbToHex(r, g, b);
}

/**
 * Check if two colors are similar within tolerance
 */
function areColorsSimilar(color1: string, color2: string, tolerance: number = 25): boolean {
  try {
    const c1 = chroma(color1);
    const c2 = chroma(color2);
    
    // Calculate Euclidean distance in RGB space
    const [r1, g1, b1] = c1.rgb();
    const [r2, g2, b2] = c2.rgb();
    
    const distance = Math.sqrt(
      Math.pow(r1 - r2, 2) +
      Math.pow(g1 - g2, 2) +
      Math.pow(b1 - b2, 2)
    );
    
    return distance < tolerance;
  } catch {
    return false;
  }
}

/**
 * Check if a color is similar to any color in an array
 */
function isColorSimilar(color: string, colors: string[], tolerance: number = 30): boolean {
  return colors.some(c => areColorsSimilar(color, c, tolerance));
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    })
    .join('');
}

/**
 * Check if a color is grey or beige
 */
function isGreyOrBeige(hex: string): boolean {
  try {
    const c = chroma(hex);
    const [r, g, b] = c.rgb();
    const [h, s, l] = c.hsl();
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    
    // Grey if all channels are similar
    if (diff < 30) return true;
    
    // Low saturation colors (beige, grey-green, etc.)
    if (s < 0.25) return true;
    
    // Beige if light and not too saturated
    if (max > 200 && diff < 50) return true;
    
    // Very light colors with low saturation
    if (l > 0.75 && s < 0.35) return true;
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Adjust extracted colors to be more vibrant and suitable for design
 */
export function enhanceColors(colors: ExtractedColor[]): ExtractedColor[] {
  return colors.map(color => {
    try {
      const c = chroma(color.hex);
      const saturation = c.get('hsl.s');
      
      // Only boost saturation for colors that aren't already very saturated
      if (saturation < 0.8) {
        const enhanced = c.saturate(0.3);
        return {
          ...color,
          hex: enhanced.hex(),
        };
      }
      return color;
    } catch {
      return color;
    }
  });
}