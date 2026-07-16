import { app, nativeImage } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.whenReady().then(async () => {
  const svgPath = path.join(__dirname, 'src/logo.svg');
  const buildDir = path.join(__dirname, 'build');
  const iconPath = path.join(buildDir, 'icon.png');

  try {
    const source = nativeImage.createFromPath(svgPath);
    if (source.isEmpty()) throw new Error('Electron could not decode src/logo.svg.');
    const pngBuffer = source.resize({ width: 512, height: 512, quality: 'best' }).toPNG();
    fs.mkdirSync(buildDir, { recursive: true });
    fs.writeFileSync(iconPath, pngBuffer);
    console.log('Successfully generated build/icon.png from SVG!');
  } catch (error) {
    if (fs.existsSync(iconPath) && fs.statSync(iconPath).size > 0) {
      console.warn(`Icon regeneration failed; reusing build/icon.png: ${error.message}`);
    } else {
      console.error(`Icon generation failed: ${error.message}`);
      process.exitCode = 1;
    }
  } finally {
    app.quit();
  }
});
