import { app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    frame: false,
    useContentSize: true,
    webPreferences: {
      offscreen: true
    }
  });

  win.setContentSize(512, 512);

  const svgPath = path.join(__dirname, 'src/logo.svg');
  await win.loadFile(svgPath);

  // Wait for rendering
  await new Promise(resolve => setTimeout(resolve, 500));

  const image = await win.webContents.capturePage();
  const pngBuffer = image.toPNG();
  
  const buildDir = path.join(__dirname, 'build');
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir);
  }
  
  fs.writeFileSync(path.join(buildDir, 'icon.png'), pngBuffer);
  console.log('Successfully generated build/icon.png from SVG!');
  
  app.quit();
});
