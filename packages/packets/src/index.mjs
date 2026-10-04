// Bounded PCAP and PCAPNG capture parsers.
const MAX_CAPTURE_BYTES = 256 * 1024 * 1024;
const MAX_PACKETS = 1_000_000;

export function parsePcap(input) {
  const bytes = input instanceof Uint8Array ? input : input instanceof ArrayBuffer ? new Uint8Array(input) : null;
  if (!bytes || bytes.byteLength < 24 || bytes.byteLength > MAX_CAPTURE_BYTES) throw new TypeError('PCAP input is missing, too small or exceeds the capture limit.');
  const magic = bytes.slice(0, 4); const little = magic[0] === 0xd4 && magic[1] === 0xc3 && magic[2] === 0xb2 && magic[3] === 0xa1; const big = magic[0] === 0xa1 && magic[1] === 0xb2 && magic[2] === 0xc3 && magic[3] === 0xd4;
  if (!little && !big) throw new TypeError('Unsupported PCAP magic.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); const read32 = (offset) => view.getUint32(offset, little); const linkType = read32(20); const snaplen = read32(16);
  if (!snaplen || snaplen > MAX_CAPTURE_BYTES) throw new TypeError('PCAP snaplen is invalid.');
  const packets = []; let offset = 24;
  while (offset < bytes.length) {
    if (offset + 16 > bytes.length) throw new TypeError('PCAP packet header is truncated.');
    const seconds = read32(offset); const microseconds = read32(offset + 4); const capturedLength = read32(offset + 8); const originalLength = read32(offset + 12); offset += 16;
    if (capturedLength > snaplen || capturedLength > bytes.length - offset) throw new TypeError('PCAP packet payload is truncated or exceeds snaplen.');
    packets.push(Object.freeze({ index: packets.length, timestamp: seconds + microseconds / 1e6, capturedLength, originalLength, data: bytes.slice(offset, offset + capturedLength) })); offset += capturedLength;
    if (packets.length > MAX_PACKETS) throw new RangeError('PCAP packet count exceeds the limit.');
  }
  return Object.freeze({ kind: 'packet-trace', linkType, snaplen, packets: Object.freeze(packets) });
}

export function parsePcapNg(input) {
  const bytes = input instanceof Uint8Array ? input : input instanceof ArrayBuffer ? new Uint8Array(input) : null;
  if (!bytes || bytes.byteLength < 28 || bytes.byteLength > MAX_CAPTURE_BYTES) throw new TypeError('PCAPNG input is missing, too small or exceeds the capture limit.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x0a0d0d0a) throw new TypeError('Unsupported PCAPNG section header.');
  const little = view.getUint32(8, true) === 0x1a2b3c4d;
  if (!little && view.getUint32(8, false) !== 0x1a2b3c4d) throw new TypeError('PCAPNG byte-order magic is invalid.');
  const read32 = (offset) => view.getUint32(offset, little); const packets = []; const interfaces = new Map(); let firstLinkType = null; let firstSnaplen = null; let offset = 0;
  while (offset + 12 <= bytes.length) {
    const blockType = read32(offset); const blockLength = read32(offset + 4);
    if (blockLength < 12 || blockLength % 4 || offset + blockLength > bytes.length || read32(offset + blockLength - 4) !== blockLength) throw new TypeError('PCAPNG block is truncated or has an invalid length.');
    if (blockType === 0x0a0d0d0a && blockLength < 28) throw new TypeError('PCAPNG section header is truncated.');
    if (blockType === 0x0a0d0d0a && offset !== 0) throw new TypeError('PCAPNG multiple sections are unsupported by this bounded reader.');
    if (blockType === 1) {
      if (blockLength < 20) throw new TypeError('PCAPNG interface block is truncated.');
      const interfaceId = interfaces.size; const interfaceLinkType = view.getUint16(offset + 8, little); const interfaceSnaplen = read32(offset + 12);
      if (!interfaceSnaplen || interfaceSnaplen > MAX_CAPTURE_BYTES) throw new TypeError('PCAPNG interface snaplen is invalid.');
      interfaces.set(interfaceId, { linkType: interfaceLinkType, snaplen: interfaceSnaplen });
      if (firstLinkType === null) { firstLinkType = interfaceLinkType; firstSnaplen = interfaceSnaplen; }
    }
    if (blockType === 6) {
      if (blockLength < 32) throw new TypeError('PCAPNG enhanced packet block is invalid.');
      const interfaceId = read32(offset + 8); const descriptor = interfaces.get(interfaceId);
      if (!descriptor) throw new TypeError('PCAPNG packet references an unknown interface.');
      const capturedLength = read32(offset + 20); const originalLength = read32(offset + 24); const dataOffset = offset + 28; const paddedLength = (capturedLength + 3) & ~3;
      if (capturedLength > descriptor.snaplen || dataOffset + paddedLength > offset + blockLength - 4) throw new TypeError('PCAPNG packet payload is truncated or exceeds snaplen.');
      const high = read32(offset + 12); const low = read32(offset + 16); packets.push(Object.freeze({ index: packets.length, interfaceId, linkType: descriptor.linkType, timestamp: (high * 0x100000000 + low) / 1e6, capturedLength, originalLength, data: bytes.slice(dataOffset, dataOffset + capturedLength) }));
      if (packets.length > MAX_PACKETS) throw new RangeError('PCAPNG packet count exceeds the limit.');
    }
    offset += blockLength;
  }
  if (offset !== bytes.length || firstLinkType === null || firstSnaplen === null) throw new TypeError('PCAPNG capture has no interface description.');
  return Object.freeze({ kind: 'packet-trace', format: 'pcapng', linkType: firstLinkType, snaplen: firstSnaplen, packets: Object.freeze(packets) });
}
