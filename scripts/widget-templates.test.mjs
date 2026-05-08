import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const widgetAssetsPath = path.join(__dirname, "..", "assets", "widget");
const spacebarBlue = [1, 133, 255, 255];

const templates = {
    shield: { width: 119, height: 20, bluePixel: [1, 1], logoPixel: [11, 10] },
    banner1: { width: 300, height: 160, bluePixel: [1, 1], logoPixel: [260, 140] },
    banner2: { width: 320, height: 76, bluePixel: [1, 1], logoPixel: [294, 58] },
    banner3: { width: 320, height: 140, bluePixel: [1, 1], logoPixel: [283, 120] },
    banner4: { width: 320, height: 270, bluePixel: [1, 1], logoPixel: [272, 76] },
};

test("widget.png styles have Spacebar-branded template assets", () => {
    for (const [style, expected] of Object.entries(templates)) {
        const asset = path.join(widgetAssetsPath, `${style}.png`);
        assert.equal(fs.existsSync(asset), true, `${style} template must exist`);

        const png = readPng(asset);
        assert.equal(png.width, expected.width, `${style} width should match widget route drawing coordinates`);
        assert.equal(png.height, expected.height, `${style} height should match widget route drawing coordinates`);
        assert.deepEqual(png.pixel(expected.bluePixel[0], expected.bluePixel[1]), spacebarBlue, `${style} should use Spacebar blue branding`);
        assert.deepEqual(png.pixel(expected.logoPixel[0], expected.logoPixel[1]), spacebarBlue, `${style} should include the Spacebar icon mark`);
    }
});

function readPng(file) {
    const data = fs.readFileSync(file);
    assert.deepEqual([...data.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], `${file} is a PNG`);

    let offset = 8;
    let width = 0;
    let height = 0;
    let colorType = 0;
    const idat = [];

    while (offset < data.length) {
        const length = data.readUInt32BE(offset);
        const type = data.subarray(offset + 4, offset + 8).toString("ascii");
        const chunk = data.subarray(offset + 8, offset + 8 + length);
        offset += length + 12;

        if (type === "IHDR") {
            width = chunk.readUInt32BE(0);
            height = chunk.readUInt32BE(4);
            assert.equal(chunk[8], 8, `${file} should use 8-bit color depth`);
            colorType = chunk[9];
            assert.equal(colorType, 6, `${file} should use RGBA color`);
        } else if (type === "IDAT") {
            idat.push(chunk);
        } else if (type === "IEND") {
            break;
        }
    }

    assert.equal(colorType, 6, `${file} should declare RGBA color`);
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const channels = 4;
    const stride = width * channels;
    const rows = [];
    let rawOffset = 0;
    let previous = new Array(stride).fill(0);

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

        rows.push(row);
        previous = row;
    }

    return {
        width,
        height,
        pixel(x, y) {
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
