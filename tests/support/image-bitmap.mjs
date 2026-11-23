/** Node-only image-header stand-in. Exercises glTF embedded-image plumbing,
 * not pixel decoding or WebGL rendering; those remain manual browser checks. */
export function imageSize(bytes) {
  if (bytes.readUInt32BE(0) === 0x89504e47) return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes.readUInt16BE(0) !== 0xffd8) throw new Error('Unknown embedded image format');
  for (let i = 2; i < bytes.length;) {
    if (bytes[i++] !== 0xff) throw new Error('Invalid JPEG marker');
    while (bytes[i] === 0xff) i++;
    const marker = bytes[i++], length = bytes.readUInt16BE(i);
    if ([0xc0,0xc1,0xc2].includes(marker)) return { width: bytes.readUInt16BE(i + 5), height: bytes.readUInt16BE(i + 3) };
    i += length;
  }
  throw new Error('JPEG dimensions missing');
}
export function installImageBitmapStandIn() {
  globalThis.self = globalThis;
  globalThis.createImageBitmap = async blob => ({ ...imageSize(Buffer.from(await blob.arrayBuffer())), close() {} });
}
