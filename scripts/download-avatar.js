import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// GitHub 用戶名（可以從環境變數或配置讀取）
const GITHUB_USERNAME = 'Alan-Cheng';
const AVATAR_URL = `https://github.com/${GITHUB_USERNAME}.png`;
const OUTPUT_PATH = path.join(__dirname, '../public/avatar.png');

// Instagram 大頭貼 URL
const INSTAGRAM_AVATAR_URL = 'https://instagram.ftpe8-1.fna.fbcdn.net/v/t51.2885-19/598031989_18549994441033172_2387731707164595462_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=instagram.ftpe8-1.fna.fbcdn.net&_nc_cat=108&_nc_oc=Q6cZ2QFg_N7H5CakZIgWafurMfVK4NmOLglELf6jfgZ3EyEAr6HHXlnqvEOWJKD7_YBRfRU&_nc_ohc=jkaeolFnbasQ7kNvwFJaITX&_nc_gid=XrgSsgoFFCS7PAKLan61nQ&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_AfnIIMTx1VUCdbfHs0fXc6-8R1IEneo2NOxuDaW-zEsERA&oe=694CAC0D&_nc_sid=8b3546';
const INSTAGRAM_OUTPUT_PATH = path.join(__dirname, '../public/avatar-ig.png');

// 確保 public 目錄存在
const publicDir = path.dirname(OUTPUT_PATH);
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 下載大頭貼（處理重定向）
function downloadAvatar(url = AVATAR_URL, redirectCount = 0, outputPath = OUTPUT_PATH) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error('Too many redirects'));
      return;
    }

    console.log(`📥 Downloading avatar from ${url}...`);
    
    https.get(url, (response) => {
      // 處理重定向
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          reject(new Error('Redirect location not found'));
          return;
        }
        console.log(`↪️  Redirecting to ${redirectUrl}...`);
        return downloadAvatar(redirectUrl, redirectCount + 1, outputPath).then(resolve).catch(reject);
      }

      // 處理錯誤狀態碼
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download avatar: ${response.statusCode}`));
        return;
      }

      // 下載檔案
      const fileStream = fs.createWriteStream(outputPath);
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        const stats = fs.statSync(outputPath);
        if (stats.size === 0) {
          fs.unlinkSync(outputPath);
          reject(new Error('Downloaded file is empty'));
          return;
        }
        console.log(`✅ Avatar downloaded successfully (${(stats.size / 1024).toFixed(2)} KB)`);
        resolve();
      });
      
      fileStream.on('error', (err) => {
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// 執行下載
async function main() {
  try {
    // 下載 GitHub 大頭貼
    console.log('📥 Starting GitHub avatar download...');
    await downloadAvatar();
    
    // 下載 Instagram 大頭貼
    console.log('\n📸 Starting Instagram avatar download...');
    await downloadAvatar(INSTAGRAM_AVATAR_URL, 0, INSTAGRAM_OUTPUT_PATH);
    
    console.log('\n✨ All downloads completed!');
  } catch (error) {
    console.error('❌ Error downloading avatar:', error.message);
    process.exit(1);
  }
}

main();

