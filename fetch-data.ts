import https from 'https';
import fs from 'fs';
import AdmZip from 'adm-zip';

const url = 'https://a.openbible.info/data/cross-references.zip';
https.get(url, (res) => {
  const chunks: Buffer[] = [];
  res.on('data', (d) => chunks.push(d));
  res.on('end', () => {
    const buffer = Buffer.concat(chunks);
    const zip = new AdmZip(buffer);
    const entry = zip.getEntries()[0];
    const text = zip.readAsText(entry);
    console.log(text.substring(0, 500));
  });
});
