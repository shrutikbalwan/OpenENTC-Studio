import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePcap, parsePcapNg } from '../packages/packets/src/index.mjs';

function fixturePcap() {
  const bytes = new Uint8Array(24 + 16 + 3); const view = new DataView(bytes.buffer);
  bytes.set([0xd4, 0xc3, 0xb2, 0xa1]); view.setUint16(4, 2, true); view.setUint16(6, 4, true); view.setUint32(16, 65535, true); view.setUint32(20, 1, true);
  view.setUint32(24, 10, true); view.setUint32(28, 500000, true); view.setUint32(32, 3, true); view.setUint32(36, 3, true); bytes.set([1, 2, 3], 40); return bytes;
}

test('PCAP parser reads bounded packet metadata and payloads', () => {
  const trace = parsePcap(fixturePcap());
  assert.equal(trace.kind, 'packet-trace');
  assert.equal(trace.linkType, 1);
  assert.equal(trace.packets[0].timestamp, 10.5);
  assert.deepEqual(Array.from(trace.packets[0].data), [1, 2, 3]);
});

test('PCAP parser rejects unsupported magic and truncated payloads', () => {
  assert.throws(() => parsePcap(new Uint8Array(24)), /magic/);
  const truncated = fixturePcap().slice(0, -1);
  assert.throws(() => parsePcap(truncated), /truncated/);
});

test('PCAPNG parser reads bounded interface and enhanced packet blocks', () => {
  const block = (type, body) => {
    const length = body.length + 12; const bytes = new Uint8Array(length); const view = new DataView(bytes.buffer);
    view.setUint32(0, type, true); view.setUint32(4, length, true); bytes.set(body, 8); view.setUint32(length - 4, length, true); return bytes;
  };
  const section = block(0x0a0d0d0a, Uint8Array.from([0x4d, 0x3c, 0x2b, 0x1a, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
  const iface = block(1, Uint8Array.from([1, 0, 0, 0, 0xff, 0xff, 0, 0]));
  const packetBody = new Uint8Array(28); const packetView = new DataView(packetBody.buffer);
  packetView.setUint32(0, 0, true); packetView.setUint32(4, 0, true); packetView.setUint32(8, 0, true); packetView.setUint32(12, 4, true); packetView.setUint32(16, 4, true); packetBody.set([1, 2, 3, 4], 20);
  const packet = block(6, packetBody); const all = new Uint8Array(section.length + iface.length + packet.length);
  all.set(section); all.set(iface, section.length); all.set(packet, section.length + iface.length);
  const result = parsePcapNg(all); assert.equal(result.format, 'pcapng'); assert.equal(result.linkType, 1); assert.equal(result.packets[0].capturedLength, 4); assert.deepEqual(Array.from(result.packets[0].data), [1, 2, 3, 4]);
});

test('PCAPNG enhanced packets honor their interface identifier and snaplen', () => {
  const block = (type, body) => { const length = body.length + 12; const bytes = new Uint8Array(length); const view = new DataView(bytes.buffer); view.setUint32(0, type, true); view.setUint32(4, length, true); bytes.set(body, 8); view.setUint32(length - 4, length, true); return bytes; };
  const section = block(0x0a0d0d0a, Uint8Array.from([0x4d, 0x3c, 0x2b, 0x1a, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
  const first = block(1, Uint8Array.from([1, 0, 0, 0, 4, 0, 0, 0])); const second = block(1, Uint8Array.from([101, 0, 0, 0, 0xff, 0, 0, 0]));
  const body = new Uint8Array(28); const view = new DataView(body.buffer); view.setUint32(0, 1, true); view.setUint32(4, 0, true); view.setUint32(8, 0, true); view.setUint32(12, 4, true); view.setUint32(16, 4, true); body.set([9, 8, 7, 6], 20); const packet = block(6, body);
  const all = new Uint8Array(section.length + first.length + second.length + packet.length); all.set(section); all.set(first, section.length); all.set(second, section.length + first.length); all.set(packet, section.length + first.length + second.length);
  const result = parsePcapNg(all); assert.equal(result.packets[0].interfaceId, 1); assert.equal(result.packets[0].linkType, 101); assert.deepEqual(Array.from(result.packets[0].data), [9, 8, 7, 6]);
});
