import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const widgetAssetsPath = path.join(repoRoot, "assets", "widget");
const widgetSourcePath = path.join(repoRoot, "src", "api", "util", "utility", "WidgetPng.ts");
const spacebarBlue = [1, 133, 255, 255];
const discordBlurples = new Set(["88,101,242,255", "114,137,218,255", "88,101,242,255"]);

const templates = {
    shield: {
        width: 119,
        height: 20,
        bluePixel: [1, 1],
        logoPixel: [11, 10],
        minBluePixels: 800,
        pixelHash: "84d6b123fba68afa8022ba1e362643791a5294ff5da072b4bd78869e867118fa",
    },
    banner1: {
        width: 300,
        height: 160,
        bluePixel: [1, 1],
        logoPixel: [260, 140],
        minBluePixels: 3000,
        pixelHash: "f2bbc4ba58d0374f0e79abb3ecf9e5b5191035f8350f79d41303eebee67da1fb",
    },
    banner2: {
        width: 320,
        height: 76,
        bluePixel: [1, 1],
        logoPixel: [294, 58],
        minBluePixels: 2000,
        pixelHash: "dee485bf2f2a3b06bf10235ad136ab0e8d543db6a5a6082ea4d5d1cbb9f3e867",
    },
    banner3: {
        width: 320,
        height: 140,
        bluePixel: [1, 1],
        logoPixel: [283, 120],
        minBluePixels: 3000,
        pixelHash: "beb7996291160cf100cc727df0a7793d5e98e842c343715f9b8c23613fb0f887",
    },
    banner4: {
        width: 320,
        height: 270,
        bluePixel: [1, 1],
        logoPixel: [272, 76],
        minBluePixels: 4500,
        pixelHash: "458ea5d41d67d2ae07cf39807db7f44b29d3f11aed9dabddfd5114556d17d071",
    },
};

test("widget.png styles have Spacebar-branded template assets", () => {
    assert.deepEqual(readWidgetStyles(), Object.keys(templates), "asset test should cover every route-supported widget.png style in order");

    for (const [style, expected] of Object.entries(templates)) {
        const asset = path.join(widgetAssetsPath, `${style}.png`);
        assert.equal(fs.existsSync(asset), true, `${style} template must exist`);

        const png = readPng(asset);
        assert.equal(png.width, expected.width, `${style} width should match widget route drawing coordinates`);
        assert.equal(png.height, expected.height, `${style} height should match widget route drawing coordinates`);
        assert.deepEqual(png.pixel(expected.bluePixel[0], expected.bluePixel[1]), spacebarBlue, `${style} should use Spacebar blue branding`);
        assert.deepEqual(png.pixel(expected.logoPixel[0], expected.logoPixel[1]), spacebarBlue, `${style} should include the Spacebar icon mark`);
        assert.equal(png.pixelHash, expected.pixelHash, `${style} pixel content should match the reviewed Spacebar template`);
        assert.ok(png.spacebarBluePixels >= expected.minBluePixels, `${style} should include enough Spacebar blue branding`);
        assert.deepEqual(png.discordBlurplePixels, [], `${style} should not contain common Discord blurple brand pixels`);
    }
});

function readWidgetStyles() {
    const source = fs.readFileSync(widgetSourcePath, "utf8");
    const match = source.match(/export const WIDGET_STYLES = \[([^\]]+)\] as const;/m);
    assert.notEqual(match, null, "WidgetPng.ts should export WIDGET_STYLES as a literal tuple");
    return [...match[1].matchAll(/"([^"]+)"/g)].map((style) => style[1]);
}

function readPng(file) {
    const data = fs.readFileSync(file);
    assert.deepEqual([...data.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], `${file} is a PNG`);

    let offset = 8;
    let width = 0;
    let height = 0;
    let colorType = 0;
    let sawHeader = false;
    let sawImageData = false;
    let sawEnd = false;
    const idat = [];

    while (offset < data.length) {
        assert.ok(offset + 12 <= data.length, `${file} chunk header should fit in file`);
        const length = data.readUInt32BE(offset);
        const typeStart = offset + 4;
        const chunkStart = offset + 8;
        const chunkEnd = chunkStart + length;
        const crcEnd = chunkEnd + 4;
        assert.ok(crcEnd <= data.length, `${file} ${data.subarray(typeStart, typeStart + 4).toString("ascii")} chunk should fit in file`);

        const type = data.subarray(typeStart, typeStart + 4).toString("ascii");
        const chunk = data.subarray(chunkStart, chunkEnd);
        const expectedCrc = data.readUInt32BE(chunkEnd);
        const actualCrc = crc32(data.subarray(typeStart, chunkEnd));
        assert.equal(actualCrc, expectedCrc, `${file} ${type} chunk CRC should be valid`);
        offset = crcEnd;

        if (!sawHeader) assert.equal(type, "IHDR", `${file} first PNG chunk should be IHDR`);

        if (type === "IHDR") {
            assert.equal(sawHeader, false, `${file} should contain exactly one IHDR chunk`);
            sawHeader = true;
            width = chunk.readUInt32BE(0);
            height = chunk.readUInt32BE(4);
            assert.equal(chunk[8], 8, `${file} should use 8-bit color depth`);
            colorType = chunk[9];
            assert.equal(colorType, 6, `${file} should use RGBA color`);
            assert.equal(chunk[10], 0, `${file} should use PNG deflate compression`);
            assert.equal(chunk[11], 0, `${file} should use standard PNG filters`);
            assert.equal(chunk[12], 0, `${file} should not be interlaced`);
        } else if (type === "IDAT") {
            sawImageData = true;
            idat.push(chunk);
        } else if (type === "IEND") {
            assert.equal(length, 0, `${file} IEND chunk should be empty`);
            sawEnd = true;
            break;
        }
    }

    assert.equal(sawHeader, true, `${file} should contain IHDR`);
    assert.equal(sawImageData, true, `${file} should contain IDAT`);
    assert.equal(sawEnd, true, `${file} should contain IEND`);
    assert.equal(offset, data.length, `${file} should not contain trailing bytes after IEND`);
    assert.equal(colorType, 6, `${file} should declare RGBA color`);

    const raw = zlib.inflateSync(Buffer.concat(idat));
    const channels = 4;
    const stride = width * channels;
    assert.equal(raw.length, (stride + 1) * height, `${file} inflated scanlines should match dimensions`);

    const rows = [];
    const pixels = Buffer.alloc(stride * height);
    let rawOffset = 0;
    let pixelOffset = 0;
    let previous = new Array(stride).fill(0);
    let spacebarBluePixels = 0;
    const discordBlurplePixels = new Set();

    for (let y = 0; y < height; y++) {
        const filter = raw[rawOffset++];
        const scanline = [...raw.subarray(rawOffset, rawOffset + stride)];
        rawOffset += stride;
        const row = new Array(stride);

        for (let i = 0; i < scanline.length; i++) {
            const left = i >= channels ? row[i - channels] : 0;
            const up = previous[i];
            const upLeft = i >= channels ? previous[i - channels] : 0;
            row[i] = (scanline[i] + filterPredictor(filter, left, up, upLeft)) & 0xff;
        }

        for (let x = 0; x < width; x++) {
            const pixel = row.slice(x * channels, x * channels + channels);
            const key = pixel.join(",");
            if (key === spacebarBlue.join(",")) spacebarBluePixels++;
            if (discordBlurples.has(key)) discordBlurplePixels.add(key);
        }

        rows.push(row);
        Buffer.from(row).copy(pixels, pixelOffset);
        pixelOffset += stride;
        previous = row;
    }

    return {
        width,
        height,
        pixelHash: crypto.createHash("sha256").update(pixels).digest("hex"),
        spacebarBluePixels,
        discordBlurplePixels: [...discordBlurplePixels].sort(),
        pixel(x, y) {
            assert.ok(x >= 0 && x < width, `x coordinate ${x} should be inside ${file}`);
            assert.ok(y >= 0 && y < height, `y coordinate ${y} should be inside ${file}`);
            const offset = x * channels;
            return rows[y].slice(offset, offset + channels);
        },
    };
}

function filterPredictor(filter, left, up, upLeft) {
    switch (filter) {
        case 0:
            return 0;
        case 1:
            return left;
        case 2:
            return up;
        case 3:
            return Math.floor((left + up) / 2);
        case 4:
            return paeth(left, up, upLeft);
        default:
            throw new Error(`Unsupported PNG filter ${filter}`);
    }
}

function paeth(left, up, upLeft) {
    const estimate = left + up - upLeft;
    const distanceLeft = Math.abs(estimate - left);
    const distanceUp = Math.abs(estimate - up);
    const distanceUpLeft = Math.abs(estimate - upLeft);

    if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) return left;
    if (distanceUp <= distanceUpLeft) return up;
    return upLeft;
}

const crcTable = new Uint32Array(256);
for (let i = 0; i < crcTable.length; i++) {
    let crc = i;
    for (let bit = 0; bit < 8; bit++) {
        crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    crcTable[i] = crc >>> 0;
}

function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}
