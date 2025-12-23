import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 動態導入 sharp（如果未安裝會給出友好提示）
let sharp;
try {
  sharp = (await import('sharp')).default;
} catch (error) {
  console.error('❌ 錯誤：未安裝 sharp 套件');
  console.error('請執行：npm install --save-dev sharp');
  process.exit(1);
}

// 圖片優化配置
const OPTIMIZATION_CONFIG = {
  maxWidth: 1920,        // 最大寬度（像素）
  maxHeight: 1920,       // 最大高度（像素）
  quality: 85,           // JPEG/WebP 質量（1-100）
  pngQuality: 90,        // PNG 質量（1-100）
  webpQuality: 85,       // WebP 質量（1-100）
};

// 支援的圖片格式
const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

// Metadata 文件路徑
const METADATA_FILE = path.join(__dirname, '../public/images-optimization-metadata.json');

// 讀取優化 metadata
function loadOptimizationMetadata() {
  try {
    if (fs.existsSync(METADATA_FILE)) {
      const content = fs.readFileSync(METADATA_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn('⚠️  讀取優化 metadata 失敗，將重新建立:', error.message);
  }
  return {};
}

// 儲存優化 metadata
function saveOptimizationMetadata(metadata) {
  try {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf-8');
  } catch (error) {
    console.error('❌ 儲存優化 metadata 失敗:', error.message);
  }
}

// 計算文件的 hash（用於驗證文件是否改變）
function calculateFileHash(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
  } catch (error) {
    return null;
  }
}

// 獲取文件的相對路徑（相對於 public 目錄）
function getRelativePath(filePath) {
  const publicDir = path.join(__dirname, '../public');
  return path.relative(publicDir, filePath).replace(/\\/g, '/');
}

// 遞迴讀取目錄中的所有圖片
function getAllImageFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllImageFiles(filePath, fileList);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (SUPPORTED_FORMATS.includes(ext)) {
        fileList.push(filePath);
      }
    }
  });
  
  return fileList;
}

// 檢查圖片是否已經被優化過（使用 metadata）
async function isAlreadyOptimized(imagePath, optimizationMetadata) {
  try {
    const relativePath = getRelativePath(imagePath);
    const record = optimizationMetadata[relativePath];
    
    // 如果沒有記錄，需要優化
    if (!record) {
      return false;
    }
    
    // 檢查文件是否存在
    if (!fs.existsSync(imagePath)) {
      // 文件不存在，移除記錄
      delete optimizationMetadata[relativePath];
      return false;
    }
    
    const stats = fs.statSync(imagePath);
    const currentMtime = stats.mtime.getTime();
    const currentSize = stats.size;
    
    // 如果文件修改時間或大小改變，需要重新優化
    if (record.mtime !== currentMtime || record.size !== currentSize) {
      return false;
    }
    
    // 驗證文件 hash（可選，但更可靠）
    if (record.hash) {
      const currentHash = calculateFileHash(imagePath);
      if (currentHash !== record.hash) {
        return false;
      }
    }
    
    // 所有檢查都通過，認為已經優化過
    return true;
  } catch (error) {
    // 如果讀取失敗，返回 false，讓它嘗試優化
    return false;
  }
}

// 優化單張圖片
async function optimizeImage(inputPath, optimizationMetadata, skipIfOptimized = true) {
  const tempPath = inputPath + '.tmp';
  
  try {
    // 檢查是否已經優化過
    if (skipIfOptimized && await isAlreadyOptimized(inputPath, optimizationMetadata)) {
      const stats = fs.statSync(inputPath);
      console.log(`⏭️  ${path.relative(process.cwd(), inputPath)} (已優化，跳過)`);
      return {
        path: inputPath,
        originalSize: stats.size,
        newSize: stats.size,
        savedBytes: 0,
        savedPercent: 0,
        resized: false,
        skipped: true,
      };
    }
    
    const stats = fs.statSync(inputPath);
    const originalSize = stats.size;
    
    // 讀取圖片
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    // 計算新尺寸（保持長寬比）
    let width = metadata.width;
    let height = metadata.height;
    let needsResize = false;
    
    if (width > OPTIMIZATION_CONFIG.maxWidth || height > OPTIMIZATION_CONFIG.maxHeight) {
      needsResize = true;
      const ratio = Math.min(
        OPTIMIZATION_CONFIG.maxWidth / width,
        OPTIMIZATION_CONFIG.maxHeight / height
      );
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    
    // 準備優化選項
    let pipeline = image;
    
    if (needsResize) {
      pipeline = pipeline.resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
    
    // 根據格式應用不同的優化
    const ext = path.extname(inputPath).toLowerCase();
    const format = ext === '.jpg' || ext === '.jpeg' ? 'jpeg' : 
                   ext === '.png' ? 'png' : 
                   ext === '.webp' ? 'webp' : 
                   ext === '.gif' ? 'gif' : null;
    
    if (format === 'jpeg') {
      pipeline = pipeline.jpeg({ quality: OPTIMIZATION_CONFIG.quality, mozjpeg: true });
    } else if (format === 'png') {
      pipeline = pipeline.png({ 
        quality: OPTIMIZATION_CONFIG.pngQuality,
        compressionLevel: 9,
      });
    } else if (format === 'webp') {
      pipeline = pipeline.webp({ quality: OPTIMIZATION_CONFIG.webpQuality });
    } else if (format === 'gif') {
      // GIF 保持原樣或轉換為其他格式（這裡保持原樣）
      pipeline = pipeline.gif();
    }
    
    // 寫入優化後的圖片到臨時文件
    await pipeline.toFile(tempPath);
    
    // 獲取新文件大小
    const newStats = fs.statSync(tempPath);
    const newSize = newStats.size;
    
    // 用臨時文件替換原文件
    fs.renameSync(tempPath, inputPath);
    
    // 更新優化 metadata
    const finalStats = fs.statSync(inputPath);
    const relativePath = getRelativePath(inputPath);
    optimizationMetadata[relativePath] = {
      mtime: finalStats.mtime.getTime(),
      size: finalStats.size,
      hash: calculateFileHash(inputPath),
      optimizedAt: new Date().toISOString(),
      originalSize: originalSize,
      optimizedSize: finalStats.size,
      dimensions: {
        original: `${metadata.width}x${metadata.height}`,
        optimized: needsResize ? `${width}x${height}` : `${metadata.width}x${metadata.height}`,
      },
    };
    
    const savedBytes = originalSize - newSize;
    const savedPercent = ((savedBytes / originalSize) * 100).toFixed(1);
    
    const sizeInfo = needsResize 
      ? `${metadata.width}x${metadata.height} → ${width}x${height}`
      : `${metadata.width}x${metadata.height}`;
    
    console.log(`✅ ${path.relative(process.cwd(), inputPath)}`);
    console.log(`   ${sizeInfo} | ${(originalSize / 1024).toFixed(2)} KB → ${(newSize / 1024).toFixed(2)} KB (節省 ${savedPercent}%)`);
    
    return {
      path: inputPath,
      originalSize,
      newSize,
      savedBytes,
      savedPercent,
      resized: needsResize,
      skipped: false,
    };
  } catch (error) {
    // 清理臨時文件（如果存在）
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    console.error(`❌ 處理圖片失敗: ${inputPath}`);
    console.error(`   錯誤: ${error.message}`);
    return null;
  }
}

// 主函數
async function optimizeImages() {
  const imagesDir = path.join(__dirname, '../public/posts-images');
  
  // 檢查目錄是否存在
  if (!fs.existsSync(imagesDir)) {
    console.log('ℹ️  posts-images 目錄不存在，跳過圖片優化');
    return;
  }
  
  console.log('🖼️  開始優化圖片...\n');
  
  // 載入優化 metadata
  const optimizationMetadata = loadOptimizationMetadata();
  
  // 獲取所有圖片文件
  const imageFiles = getAllImageFiles(imagesDir);
  
  if (imageFiles.length === 0) {
    console.log('ℹ️  未找到需要優化的圖片');
    return;
  }
  
  console.log(`找到 ${imageFiles.length} 張圖片\n`);
  
  // 優化所有圖片
  const results = [];
  for (const imagePath of imageFiles) {
    const result = await optimizeImage(imagePath, optimizationMetadata);
    if (result) {
      results.push(result);
    }
  }
  
  // 清理不存在的圖片記錄
  const existingFiles = new Set(imageFiles.map(f => getRelativePath(f)));
  for (const relativePath in optimizationMetadata) {
    if (!existingFiles.has(relativePath)) {
      delete optimizationMetadata[relativePath];
    }
  }
  
  // 儲存更新後的 metadata
  saveOptimizationMetadata(optimizationMetadata);
  
  // 統計信息
  if (results.length > 0) {
    const processedResults = results.filter(r => !r.skipped);
    const skippedCount = results.filter(r => r.skipped).length;
    const totalOriginalSize = results.reduce((sum, r) => sum + r.originalSize, 0);
    const totalNewSize = results.reduce((sum, r) => sum + r.newSize, 0);
    const totalSaved = totalOriginalSize - totalNewSize;
    const totalSavedPercent = totalOriginalSize > 0 ? ((totalSaved / totalOriginalSize) * 100).toFixed(1) : '0';
    const resizedCount = results.filter(r => r.resized).length;
    
    console.log(`\n📊 優化完成！`);
    console.log(`   總共 ${results.length} 張圖片`);
    if (processedResults.length > 0) {
      console.log(`   新處理: ${processedResults.length} 張`);
    }
    if (skippedCount > 0) {
      console.log(`   已優化（跳過）: ${skippedCount} 張`);
    }
    if (resizedCount > 0) {
      console.log(`   調整大小: ${resizedCount} 張`);
    }
    if (processedResults.length > 0) {
      const processedOriginalSize = processedResults.reduce((sum, r) => sum + r.originalSize, 0);
      const processedNewSize = processedResults.reduce((sum, r) => sum + r.newSize, 0);
      const processedSaved = processedOriginalSize - processedNewSize;
      const processedSavedPercent = processedOriginalSize > 0 ? ((processedSaved / processedOriginalSize) * 100).toFixed(1) : '0';
      console.log(`   新處理圖片大小: ${(processedOriginalSize / 1024).toFixed(2)} KB → ${(processedNewSize / 1024).toFixed(2)} KB (節省 ${processedSavedPercent}%)`);
    }
    console.log(`   總大小: ${(totalOriginalSize / 1024).toFixed(2)} KB → ${(totalNewSize / 1024).toFixed(2)} KB`);
    if (totalSaved > 0) {
      console.log(`   總共節省: ${(totalSaved / 1024).toFixed(2)} KB (${totalSavedPercent}%)`);
    }
  }
}

// 執行優化
optimizeImages().catch((error) => {
  console.error('❌ 圖片優化過程發生錯誤:', error.message);
  process.exit(1);
});
