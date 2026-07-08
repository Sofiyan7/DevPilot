const fs = require('fs');
const path = require('path');

function pad(num, size, radix = 8) {
  let s = num.toString(radix);
  while (s.length < size - 1) s = '0' + s;
  return s + '\0';
}

function computeChecksum(header) {
  let sum = 0;
  for (let i = 0; i < 512; i++) {
    if (i >= 148 && i < 156) {
      sum += 32;
    } else {
      sum += header[i];
    }
  }
  return sum;
}

function packDir(dirPath, baseDir, writeStream) {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const header = Buffer.alloc(512);
      header.write(relPath + '/', 0, 100, 'utf8');
      header.write('0000755\0', 100);
      header.write('0000000\0', 108);
      header.write('0000000\0', 116);
      header.write(pad(0, 12), 124);
      header.write(pad(Math.floor(stat.mtimeMs / 1000), 12), 136);
      header.write('5', 156);
      header.write('ustar\0', 257);
      header.write('00', 263);

      const chk = computeChecksum(header);
      header.write(pad(chk, 8), 148);

      writeStream.write(header);
      packDir(fullPath, baseDir, writeStream);
    } else if (stat.isFile()) {
      const header = Buffer.alloc(512);
      header.write(relPath, 0, 100, 'utf8');
      header.write('0000644\0', 100);
      header.write('0000000\0', 108);
      header.write('0000000\0', 116);
      header.write(pad(stat.size, 12), 124);
      header.write(pad(Math.floor(stat.mtimeMs / 1000), 12), 136);
      header.write('0', 156);
      header.write('ustar\0', 257);
      header.write('00', 263);

      const chk = computeChecksum(header);
      header.write(pad(chk, 8), 148);

      writeStream.write(header);

      const content = fs.readFileSync(fullPath);
      writeStream.write(content);

      const remainder = stat.size % 512;
      if (remainder > 0) {
        writeStream.write(Buffer.alloc(512 - remainder));
      }
    }
  }
}

function pack(srcDir, tarPath) {
  const writeStream = fs.createWriteStream(tarPath);
  packDir(srcDir, path.dirname(srcDir), writeStream);
  writeStream.write(Buffer.alloc(1024));
  writeStream.end();
}

function unpack(tarPath, destDir) {
  const buffer = fs.readFileSync(tarPath);
  let offset = 0;

  while (offset < buffer.length) {
    const header = buffer.slice(offset, offset + 512);
    offset += 512;

    if (header.every(b => b === 0)) {
      break;
    }

    const name = header.toString('utf8', 0, 100).replace(/\0+$/, '');
    if (!name) continue;

    const size = parseInt(header.toString('utf8', 124, 136).replace(/\0+$/, '').trim(), 8);
    const typeflag = header.toString('utf8', 156, 157);

    const fullPath = path.join(destDir, name);

    if (typeflag === '5' || name.endsWith('/')) {
      fs.mkdirSync(fullPath, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      const fileData = buffer.slice(offset, offset + size);
      fs.writeFileSync(fullPath, fileData);

      const blocks = Math.ceil(size / 512);
      offset += blocks * 512;
    }
  }
}

const mode = process.argv[2];
const folder = process.argv[3];
const tarFile = process.argv[4];

if (mode === 'pack') {
  pack(folder, tarFile);
} else if (mode === 'unpack') {
  unpack(tarFile, folder);
}
