// Text detection and classification utility
import Tesseract from 'tesseract.js';
import * as tf from '@tensorflow/tfjs';

// Suppress TensorFlow.js duplicate registration warnings
// These occur during hot module replacement and are harmless
(function suppressTensorFlowWarnings() {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const message = args[0]?.toString() || '';
    // Filter out TensorFlow.js backend/kernel registration warnings
    if (
      message.includes('already registered') ||
      message.includes('Overwriting the platform') ||
      message.includes('backend was already registered')
    ) {
      return; // Suppress these specific warnings
    }
    originalWarn.apply(console, args);
  };
})();

// Teachable Machine model URLs (replace with your actual model URLs)
const STYLE_MODEL_URL = 'https://lwnoble.github.io/figma-typography-models/style/';
const WEIGHT_MODEL_URL = 'https://lwnoble.github.io/figma-typography-models/weight/';

// Model cache to prevent reloading
let styleModelCache: any = null;
let weightModelCache: any = null;
let styleMetadataCache: any = null;
let weightMetadataCache: any = null;

export interface TextRegion {
  text: string;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  confidence: number;
  className?: string;
  probability?: number;
  detectedWeight?: number;
  isAllCaps?: boolean;
}

export interface DetectedTypography {
  headerStyle: string;
  decorativeStyle: string | null;
  bodyStyle: string;
  headerWeight: number;
  decorativeWeight: number;
  bodyWeight: number;
  headerLetterSpacing: number;
  decorativeLetterSpacing: number;
  bodyLetterSpacing: number;
  headerIsAllCaps: boolean;
  decorativeIsAllCaps: boolean;
  hasText: boolean;
}

/**
 * Enhance image for better OCR results
 */
function enhanceImageForOCR(canvas: HTMLCanvasElement): HTMLCanvasElement {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    console.log('🔧 Preprocessing image for OCR...');
    
    // Mild brightness and contrast enhancement
    const brightness = 1.1;
    const contrast = 1.3;
    const intercept = 128 * (1 - contrast) / 2;
    
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];
      
      // Apply brightness
      r = Math.min(255, r * brightness);
      g = Math.min(255, g * brightness);
      b = Math.min(255, b * brightness);
      
      // Apply contrast
      r = Math.min(255, Math.max(0, r * contrast + intercept));
      g = Math.min(255, Math.max(0, g * contrast + intercept));
      b = Math.min(255, Math.max(0, b * contrast + intercept));
      
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
    
    ctx.putImageData(imageData, 0, 0);
    console.log('✅ Image preprocessed');
    return canvas;
  } catch (err) {
    console.warn('⚠️ OCR preprocessing failed:', err);
    return canvas;
  }
}

/**
 * Group nearby text regions that are likely part of the same word/phrase
 */
function groupTextRegions(words: TextRegion[], maxGapRatio = 1.5): TextRegion[][] {
  if (words.length === 0) return [];
  
  // Sort by vertical position, then horizontal
  const sorted = [...words].sort((a, b) => {
    const yDiff = a.bbox.y0 - b.bbox.y0;
    if (Math.abs(yDiff) < 20) {
      return a.bbox.x0 - b.bbox.x0;
    }
    return yDiff;
  });
  
  const groups: TextRegion[][] = [];
  let currentGroup = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const previous = sorted[i - 1];
    
    const prevHeight = previous.bbox.y1 - previous.bbox.y0;
    const currHeight = current.bbox.y1 - current.bbox.y0;
    const avgHeight = (prevHeight + currHeight) / 2;
    
    // Check if on same line
    const prevMidY = (previous.bbox.y0 + previous.bbox.y1) / 2;
    const currMidY = (current.bbox.y0 + current.bbox.y1) / 2;
    const verticalGap = Math.abs(currMidY - prevMidY);
    const onSameLine = verticalGap < avgHeight * 0.5;
    
    // Check horizontal gap
    const horizontalGap = current.bbox.x0 - previous.bbox.x1;
    const averageCharWidth = avgHeight * 0.6;
    const isClose = horizontalGap < averageCharWidth * maxGapRatio;
    
    if (onSameLine && isClose) {
      currentGroup.push(current);
    } else {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [current];
    }
  }
  
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  
  return groups;
}

/**
 * Merge a group of words into a single region
 */
function mergeWordGroup(wordGroup: TextRegion[]): TextRegion | null {
  if (wordGroup.length === 0) return null;
  if (wordGroup.length === 1) return wordGroup[0];
  
  const minX = Math.min(...wordGroup.map(w => w.bbox.x0));
  const minY = Math.min(...wordGroup.map(w => w.bbox.y0));
  const maxX = Math.max(...wordGroup.map(w => w.bbox.x1));
  const maxY = Math.max(...wordGroup.map(w => w.bbox.y1));
  
  const mergedText = wordGroup.map(w => w.text).join('');
  const avgConfidence = wordGroup.reduce((sum, w) => sum + w.confidence, 0) / wordGroup.length;
  
  return {
    text: mergedText,
    confidence: avgConfidence,
    bbox: { x0: minX, y0: minY, x1: maxX, y1: maxY }
  };
}

/**
 * Merge horizontally adjacent text fragments (very aggressive)
 */
function mergeHorizontallyAdjacentText(predictions: TextRegion[]): TextRegion[] {
  if (!predictions || predictions.length === 0) return predictions;
  
  const sorted = [...predictions].sort((a, b) => a.bbox.x0 - b.bbox.x0);
  const merged: TextRegion[] = [];
  let current = { ...sorted[0] };
  
  console.log(`\n📦 Merging ${sorted.length} predictions (AGGRESSIVE MODE)...`);
  
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const gap = next.bbox.x0 - current.bbox.x1;
    
    const textLength = current.text ? current.text.length : 1;
    const currentWidth = current.bbox.x1 - current.bbox.x0;
    const charWidth = currentWidth / textLength;
    
    const heightA = current.bbox.y1 - current.bbox.y0;
    const heightB = next.bbox.y1 - next.bbox.y0;
    const heightDiff = Math.abs(heightA - heightB);
    const avgHeight = (heightA + heightB) / 2;
    const heightSimilar = heightDiff < avgHeight * 0.5;
    
    // Very aggressive merge threshold
    if (heightSimilar && gap < charWidth * 3.0 && gap > -charWidth) {
      const beforeText = current.text || '';
      const afterText = next.text || '';
      
      current.text = beforeText + afterText;
      current.bbox.x1 = next.bbox.x1;
      current.bbox.y0 = Math.min(current.bbox.y0, next.bbox.y0);
      current.bbox.y1 = Math.max(current.bbox.y1, next.bbox.y1);
      
      if (!current.className && next.className) current.className = next.className;
      if (!current.probability || (next.probability && next.probability > current.probability)) {
        current.probability = next.probability;
      }
      if (!current.detectedWeight && next.detectedWeight) {
        current.detectedWeight = next.detectedWeight;
      }
      
      console.log(`  ✅ MERGED: "${beforeText}" + "${afterText}" = "${current.text}"`);
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  
  merged.push(current);
  console.log(`✅ Merge complete: ${predictions.length} → ${merged.length} elements\n`);
  return merged;
}

/**
 * Detect text regions using Tesseract.js OCR
 */
export async function detectTextRegions(imageElement: HTMLImageElement): Promise<TextRegion[]> {
  console.log('🔍 Starting OCR text detection...');
  
  try {
    // Create worker
    const worker = await Tesseract.createWorker('eng');
    console.log('✅ Tesseract worker created');
    
    // Recognize image
    let result = await worker.recognize(imageElement);
    
    console.log('📦 TSV data type:', typeof result.data?.tsv);
    console.log('📦 TSV sample:', result.data?.tsv ? String(result.data.tsv).substring(0, 200) : 'null');
    
    // DEBUG: Log the actual structure we received
    console.log('📦 Raw Tesseract result:', result);
    console.log('📦 Result keys:', Object.keys(result || {}));
    console.log('📦 Result.data:', result?.data);
    console.log('📦 Result.data keys:', result?.data ? Object.keys(result.data) : 'no data');
    console.log('📦 Result.data.words:', result?.data?.words);
    console.log('📦 Result.data.blocks:', result?.data?.blocks);
    console.log('📦 Result.data.lines:', result?.data?.lines);
    
    // Safety check for result data
    if (!result || !result.data) {
      console.error('❌ OCR returned invalid data structure - no result.data');
      console.log('Full result object:', JSON.stringify(result, null, 2));
      await worker.terminate();
      return [];
    }
    
    // DEBUG: Show all available properties
    console.log('📦 Available properties on result.data:', Object.keys(result.data));
    
    // Check for different Tesseract.js API versions
    let words: any[] = [];
    
    // OPTION 1: Try to use TSV format which includes bounding boxes
    if (result.data?.tsv && typeof result.data.tsv === 'string') {
      console.log('✅ Using TSV format to extract word bounding boxes');
      words = parseTesseractTSV(result.data.tsv);
      console.log(`✅ Extracted ${words.length} words from TSV format`);
    }
    // OPTION 2: Try different possible structures
    else if (result.data.words && Array.isArray(result.data.words)) {
      words = result.data.words;
      console.log('✅ Using result.data.words');
    } else if (result.data.blocks && Array.isArray(result.data.blocks)) {
      // Tesseract.js v5+ structure: blocks -> paragraphs -> lines -> words
      console.log('✅ Using result.data.blocks (Tesseract v5 structure)');
      console.log(`📦 Found ${result.data.blocks.length} blocks`);
      
      for (const block of result.data.blocks) {
        if (block.paragraphs && Array.isArray(block.paragraphs)) {
          for (const paragraph of block.paragraphs) {
            if (paragraph.lines && Array.isArray(paragraph.lines)) {
              for (const line of paragraph.lines) {
                if (line.words && Array.isArray(line.words)) {
                  words.push(...line.words);
                }
              }
            }
          }
        }
      }
      console.log(`✅ Extracted ${words.length} words from block hierarchy`);
    } else if (result.data.lines && Array.isArray(result.data.lines)) {
      console.log('✅ Using result.data.lines');
      // Extract words from lines
      words = [];
      for (const line of result.data.lines) {
        if (line.words && Array.isArray(line.words)) {
          words.push(...line.words);
        }
      }
      console.log(`Extracted ${words.length} words from ${result.data.lines.length} lines`);
    } else if (result.data.symbols && Array.isArray(result.data.symbols)) {
      words = result.data.symbols;
      console.log('✅ Using result.data.symbols');
    }
    
    if (words.length === 0 && result.data.text && result.data.text.trim().length > 0) {
      console.log('⚠️ Found text but no structured word data. Text content:', result.data.text);
      console.log('📦 Blocks structure:', result.data.blocks);
      console.log('🔧 Attempting manual text region estimation...');
      
      // Fall back to manual region detection using canvas and pixel analysis
      words = await estimateTextRegionsFromImage(imageElement, result.data.text);
      console.log(`📊 Estimated ${words.length} text regions from pixel analysis`);
      
      if (words.length === 0) {
        await worker.terminate();
        return [];
      }
    }
    
    console.log(`Initial OCR: Found ${words.length} word regions, confidence: ${Math.round(result.data.confidence || 0)}%`);
    
    // If low confidence, try with enhanced image
    if (words.length < 3 || (result.data.confidence || 0) < 20) {
      console.log('⚠️ Low confidence. Trying enhanced image...');
      
      const canvas = document.createElement('canvas');
      canvas.width = imageElement.width;
      canvas.height = imageElement.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(imageElement, 0, 0);
        enhanceImageForOCR(canvas);
        
        result = await worker.recognize(canvas);
        
        // Re-parse from TSV if available
        if (result.data?.tsv && typeof result.data.tsv === 'string') {
          words = parseTesseractTSV(result.data.tsv);
        } else {
          words = result.data?.words || result.data?.lines || [];
        }
        console.log(`Enhanced OCR: Found ${words.length} regions`);
      }
    }
    
    await worker.terminate();
    
    if (words.length === 0) {
      console.log('No text detected');
      return [];
    }
    
    // Pre-filter noise
    const preFiltered = words.filter(word => {
      const width = word.bbox.x1 - word.bbox.x0;
      const height = word.bbox.y1 - word.bbox.y0;
      return width >= 3 && height >= 3 && word.confidence > 5;
    });
    
    console.log(`Pre-filtered: ${preFiltered.length} regions`);
    
    // Group nearby text
    const textGroups = groupTextRegions(preFiltered as any, 1.8);
    console.log(`Grouped into ${textGroups.length} text groups`);
    
    // Merge groups and filter
    const validWords = textGroups
      .map(group => mergeWordGroup(group as any))
      .filter((region): region is TextRegion => {
        if (!region) return false;
        const width = region.bbox.x1 - region.bbox.x0;
        const height = region.bbox.y1 - region.bbox.y0;
        return width >= 12 && height >= 10 && region.confidence > 15;
      });
    
    console.log(`✅ Final: ${validWords.length} valid text regions`);
    
    // Sort by height for debugging
    const sorted = [...validWords].sort((a, b) => {
      const heightA = a.bbox.y1 - a.bbox.y0;
      const heightB = b.bbox.y1 - b.bbox.y0;
      return heightB - heightA;
    });
    
    sorted.forEach((region, i) => {
      const height = region.bbox.y1 - region.bbox.y0;
      console.log(`  ${i+1}. "${region.text}" (height: ${height}px)`);
    });
    
    return validWords;
    
  } catch (error) {
    console.error('OCR error:', error);
    return [];
  }
}

/**
 * Classify text regions using Teachable Machine models
 */
export async function classifyTextRegions(
  imageElement: HTMLImageElement,
  regions: TextRegion[]
): Promise<DetectedTypography> {
  console.log('🤖 Loading Teachable Machine models...');
  
  try {
    // Clear any existing variables to prevent conflicts
    if (!styleModelCache && !weightModelCache) {
      console.log('🧹 Clearing TensorFlow backend...');
      try {
        // Dispose all tensors and clear the backend
        tf.disposeVariables();
        await tf.ready();
      } catch (e) {
        console.warn('⚠️ Backend cleanup warning:', e);
      }
    }
    
    // Load style model
    if (!styleModelCache) {
      console.log('📥 Loading style model...');
      styleModelCache = await tf.loadLayersModel(STYLE_MODEL_URL + 'model.json');
      const styleMetaResponse = await fetch(STYLE_MODEL_URL + 'metadata.json');
      styleMetadataCache = await styleMetaResponse.json();
      console.log('✅ Style model loaded');
    } else {
      console.log('♻️ Using cached style model');
    }
    
    // Load weight model
    if (!weightModelCache) {
      console.log('📥 Loading weight model...');
      weightModelCache = await tf.loadLayersModel(WEIGHT_MODEL_URL + 'model.json');
      const weightMetaResponse = await fetch(WEIGHT_MODEL_URL + 'metadata.json');
      weightMetadataCache = await weightMetaResponse.json();
      console.log('✅ Weight model loaded');
    } else {
      console.log('♻️ Using cached weight model');
    }
    
    console.log('✅ Models ready');
    
    // Sort regions by height (tallest first)
    const sortedByHeight = [...regions].sort((a, b) => {
      const heightA = a.bbox.y1 - a.bbox.y0;
      const heightB = b.bbox.y1 - b.bbox.y0;
      return heightB - heightA;
    });
    
    console.log('\n📏 Text regions sorted by height:');
    sortedByHeight.forEach((region, i) => {
      const height = region.bbox.y1 - region.bbox.y0;
      console.log(`  ${i+1}. "${region.text}" (height: ${height}px)`);
    });
    
    if (sortedByHeight.length === 0) {
      throw new Error('No text regions to classify');
    }
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    
    canvas.width = 224;
    canvas.height = 224;
    
    // CLASSIFY ONLY THE TALLEST (HEADER)
    console.log('\n🎯 Classifying HEADER (tallest text)...');
    const headerRegion = sortedByHeight[0];
    const headerResult = await classifySingleRegion(
      tf, 
      imageElement, 
      headerRegion, 
      canvas, 
      ctx
    );
    
    console.log(`✅ HEADER: "${headerRegion.text}"`);
    console.log(`   Style: ${headerResult.style} (${(headerResult.styleConfidence*100).toFixed(0)}%)`);
    console.log(`   Weight: ${headerResult.weight} (${(headerResult.weightConfidence*100).toFixed(0)}%)`);
    console.log(`   All Caps: ${headerResult.isAllCaps}`);
    
    // CLASSIFY ONLY THE 2ND TALLEST (DECORATIVE) if it exists
    let decorativeResult: any = null;
    if (sortedByHeight.length > 1) {
      console.log('\n🎯 Classifying DECORATIVE (2nd tallest text)...');
      const decorativeRegion = sortedByHeight[1];
      decorativeResult = await classifySingleRegion(
        tf,
        imageElement,
        decorativeRegion,
        canvas,
        ctx
      );
      
      console.log(`✅ DECORATIVE: "${decorativeRegion.text}"`);
      console.log(`   Style: ${decorativeResult.style} (${(decorativeResult.styleConfidence*100).toFixed(0)}%)`);
      console.log(`   Weight: ${decorativeResult.weight} (${(decorativeResult.weightConfidence*100).toFixed(0)}%)`);
      console.log(`   All Caps: ${decorativeResult.isAllCaps}`);
    }
    
    // BODY: Default readable style (no classification needed)
    const bodyStyle = 'Serif, Transitional';
    const bodyWeight = 400;
    
    console.log('\n🎯 Font Role Assignment:');
    console.log(`  Header: ${headerResult.style} (weight: ${headerResult.weight}) ${headerResult.isAllCaps ? '[ALL CAPS]' : ''}`);
    console.log(`  Decorative: ${decorativeResult?.style || 'None'} (weight: ${decorativeResult?.weight || 400}) ${decorativeResult?.isAllCaps ? '[ALL CAPS]' : ''}`);
    console.log(`  Body: ${bodyStyle} (weight: ${bodyWeight}) [Default readable]`);
    
    return {
      headerStyle: headerResult.style,
      decorativeStyle: decorativeResult?.style || null,
      bodyStyle,
      headerWeight: headerResult.weight,
      decorativeWeight: decorativeResult?.weight || 400,
      bodyWeight,
      headerLetterSpacing: 0.05,
      decorativeLetterSpacing: 0.15,
      bodyLetterSpacing: 0,
      headerIsAllCaps: headerResult.isAllCaps,
      decorativeIsAllCaps: decorativeResult?.isAllCaps || false,
      hasText: true
    };
    
  } catch (error) {
    console.error('Classification error:', error);
    throw error;
  }
}

/**
 * Classify a single text region using Teachable Machine models
 */
async function classifySingleRegion(
  tf: any,
  imageElement: HTMLImageElement,
  region: TextRegion,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): Promise<{
  style: string;
  styleConfidence: number;
  weight: number;
  weightConfidence: number;
  isAllCaps: boolean;
}> {
  const bbox = region.bbox;
  
  // Add padding around the text
  const padding = 15;
  const x = Math.max(0, bbox.x0 - padding);
  const y = Math.max(0, bbox.y0 - padding);
  const width = (bbox.x1 - bbox.x0) + (padding * 2);
  const height = (bbox.y1 - bbox.y0) + (padding * 2);
  
  // Clear canvas and draw cropped region
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 224, 224);
  ctx.drawImage(imageElement, x, y, width, height, 0, 0, 224, 224);
  
  // Create tensor from canvas
  const tensor = tf.browser.fromPixels(canvas).toFloat().div(255.0).expandDims();
  
  // Get style prediction
  const stylePrediction = await styleModelCache.predict(tensor as any).data() as Float32Array;
  const styleResults = styleMetadataCache.labels.map((label: string, j: number) => ({
    className: label,
    probability: stylePrediction[j]
  })).sort((a: any, b: any) => b.probability - a.probability);
  
  // Log top 3 style predictions
  console.log('  📊 Style predictions:');
  styleResults.slice(0, 3).forEach((result: any, i: number) => {
    console.log(`     ${i+1}. ${result.className}: ${(result.probability*100).toFixed(1)}%`);
  });
  
  // Get weight prediction
  const weightPrediction = await weightModelCache.predict(tensor as any).data() as Float32Array;
  const weightResults = weightMetadataCache.labels.map((label: string, j: number) => ({
    weight: parseInt(label.replace(/\D/g, '')) || 400,
    probability: weightPrediction[j]
  })).sort((a: any, b: any) => b.probability - a.probability);
  
  // Log top 3 weight predictions
  console.log('  📊 Weight predictions:');
  weightResults.slice(0, 3).forEach((result: any, i: number) => {
    console.log(`     ${i+1}. ${result.weight}: ${(result.probability*100).toFixed(1)}%`);
  });
  
  tensor.dispose();
  
  // Detect ALL CAPS
  const textIsAllCaps = region.text === region.text.toUpperCase() && /[A-Z]/.test(region.text);
  console.log(`  🔤 OCR text: "${region.text}"`);
  console.log(`  🔤 Text is all caps (from OCR): ${textIsAllCaps}`);
  console.log(`  🔤 Top style: "${styleResults[0].className}"`);
  
  let isAllCaps = false;
  let styleToUse = styleResults[0];
  
  // Check if Teachable Machine detected ALL CAPS
  if (styleResults[0].className === 'ALL CAPS') {
    isAllCaps = true;
    console.log('  ✅ ALL CAPS detected by Teachable Machine!');
    // Use the 2nd style result as the actual style
    if (styleResults.length > 1) {
      styleToUse = styleResults[1];
      console.log(`  📝 Using 2nd style result as actual style: "${styleToUse.className}"`);
    }
  } else if (textIsAllCaps) {
    isAllCaps = true;
    console.log('  ✅ ALL CAPS detected from OCR text case!');
  }
  
  console.log(`  🎯 Final: style="${styleToUse.className}", weight=${weightResults[0].weight}, allCaps=${isAllCaps}`);
  
  return {
    style: styleToUse.className,
    styleConfidence: styleToUse.probability,
    weight: weightResults[0].weight,
    weightConfidence: weightResults[0].probability,
    isAllCaps
  };
}

/**
 * Parse Tesseract.js TSV output to extract word bounding boxes
 */
function parseTesseractTSV(tsv: string): TextRegion[] {
  const lines = tsv.split('\n');
  const words: TextRegion[] = [];
  
  console.log(`📋 Parsing TSV with ${lines.length} lines...`);
  
  // TSV format: level, page_num, block_num, par_num, line_num, word_num, left, top, width, height, conf, text
  for (let i = 1; i < lines.length; i++) { // Skip header row
    const parts = lines[i].split('\t');
    if (parts.length < 12) continue; // Skip incomplete lines
    
    const level = parseInt(parts[0]);
    const text = parts[11];
    const conf = parseFloat(parts[10]);
    const left = parseInt(parts[6]);
    const top = parseInt(parts[7]);
    const width = parseInt(parts[8]);
    const height = parseInt(parts[9]);
    
    // DEBUG: Log first few entries
    if (i <= 5) {
      console.log(`  Line ${i}: level=${level}, text="${text}", conf=${conf}, bbox=[${left},${top},${width},${height}]`);
    }
    
    // Only include word-level entries (level 5) with actual text
    if (level === 5 && text && text.trim().length > 0 && conf > 0) {
      words.push({
        text: text.trim(),
        confidence: conf,
        bbox: { 
          x0: left, 
          y0: top, 
          x1: left + width, 
          y1: top + height 
        }
      });
    }
  }
  
  console.log(`📋 Parsed ${words.length} words from TSV format`);
  if (words.length === 0) {
    console.log('⚠️ No level-5 (word) entries found. Checking other levels...');
    // Try to find any text at any level
    for (let i = 1; i < Math.min(lines.length, 20); i++) {
      const parts = lines[i].split('\t');
      if (parts.length >= 12) {
        const level = parseInt(parts[0]);
        const text = parts[11];
        const conf = parseFloat(parts[10]);
        if (text && text.trim().length > 0) {
          console.log(`  Found at level ${level}: "${text}" (conf: ${conf})`);
        }
      }
    }
  }
  
  return words;
}

/**
 * Estimate text regions from image using pixel analysis
 */
async function estimateTextRegionsFromImage(imageElement: HTMLImageElement, textContent: string): Promise<TextRegion[]> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  
  canvas.width = imageElement.width;
  canvas.height = imageElement.height;
  ctx.drawImage(imageElement, 0, 0);
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  const regions: TextRegion[] = [];
  const visited = new Set<string>();
  
  // Simple thresholding to detect text pixels
  const threshold = 150;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const index = (y * canvas.width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const a = data[index + 3];
      
      if (a > 0 && (r < threshold || g < threshold || b < threshold)) {
        const key = `${x},${y}`;
        if (!visited.has(key)) {
          const region = findTextRegion(data, canvas.width, canvas.height, x, y, threshold);
          if (region) {
            regions.push(region);
            for (let ry = region.bbox.y0; ry <= region.bbox.y1; ry++) {
              for (let rx = region.bbox.x0; rx <= region.bbox.x1; rx++) {
                visited.add(`${rx},${ry}`);
              }
            }
          }
        }
      }
    }
  }
  
  // Assign text content to regions (simple heuristic)
  const words = textContent.split(/\s+/);
  let wordIndex = 0;
  
  for (const region of regions) {
    if (wordIndex < words.length) {
      region.text = words[wordIndex++];
    } else {
      region.text = '';
    }
    region.confidence = 100; // Placeholder confidence
  }
  
  return regions;
}

/**
 * Find a text region starting from a given pixel
 */
function findTextRegion(data: Uint8ClampedArray, width: number, height: number, startX: number, startY: number, threshold: number): TextRegion | null {
  const queue: [number, number][] = [[startX, startY]];
  const visited = new Set<string>();
  let minX = startX;
  let minY = startY;
  let maxX = startX;
  let maxY = startY;
  
  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    const key = `${x},${y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    
    const index = (y * width + x) * 4;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];
    
    if (a > 0 && (r < threshold || g < threshold || b < threshold)) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      
      // Add neighbors to queue
      if (x > 0) queue.push([x - 1, y]);
      if (x < width - 1) queue.push([x + 1, y]);
      if (y > 0) queue.push([x, y - 1]);
      if (y < height - 1) queue.push([x, y + 1]);
    }
  }
  
  if (maxX - minX < 3 || maxY - minY < 3) return null;
  
  return {
    text: '',
    confidence: 0,
    bbox: { x0: minX, y0: minY, x1: maxX, y1: maxY }
  };
}