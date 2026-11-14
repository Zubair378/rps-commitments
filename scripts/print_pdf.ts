import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [input, output, kind = 'report'] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: print_pdf.ts input.html output.pdf [report|slides]');
const browser = await chromium.launch({ channel: 'chromium' });
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(resolve(input)).toString(), { waitUntil: 'load' });
  await page.evaluate(() =>
    Promise.all(Array.from(document.images).map((image) => image.decode().catch(() => undefined))),
  );
  await page.pdf({
    path: output,
    printBackground: true,
    ...(kind === 'slides'
      ? {
          width: '13.333in',
          height: '7.5in',
          margin: { top: '0', right: '0', bottom: '0', left: '0' },
        }
      : { format: 'A4', margin: { top: '0', right: '0', bottom: '0', left: '0' } }),
  });
  console.log(`Wrote ${output}`);
} finally {
  await browser.close();
}
