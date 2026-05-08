import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { imageSize } from "image-size";
import { getWidgetTemplatePath, isWidgetStyle, renderWidgetPng, type WidgetStyle, WIDGET_STYLES, WIDGET_STYLE_ERROR } from "../../src/api/util/utility/WidgetPng";

const expectedDimensions: Record<WidgetStyle, { width: number; height: number }> = {
    shield: { width: 119, height: 20 },
    banner1: { width: 300, height: 160 },
    banner2: { width: 320, height: 76 },
    banner3: { width: 320, height: 140 },
    banner4: { width: 320, height: 270 },
};

test("widget PNG renderer supports every declared style without requiring a guild icon", async () => {
    assert.deepEqual(WIDGET_STYLES, ["shield", "banner1", "banner2", "banner3", "banner4"]);
    assert.equal(WIDGET_STYLE_ERROR, "Value must be one of ('shield', 'banner1', 'banner2', 'banner3', 'banner4').");

    for (const style of WIDGET_STYLES) {
        assert.equal(isWidgetStyle(style), true);
        const png = await renderWidgetPng({ style, name: "No Icon Guild", presenceCount: null });
        assertPngDimensions(png, expectedDimensions[style]);
    }

    assert.equal(isWidgetStyle("invalid"), false);
});

test("widget PNG renderer composites an optional icon when one is available", async () => {
    const icon = await readFile(getWidgetTemplatePath("shield"));
    const withoutIcon = await renderWidgetPng({ style: "banner1", name: "Icon Guild", presenceCount: 7 });
    const withIcon = await renderWidgetPng({ style: "banner1", name: "Icon Guild", presenceCount: 7, icon });

    assertPngDimensions(withIcon, expectedDimensions.banner1);
    assert.notEqual(sha256(withIcon), sha256(withoutIcon), "icon input should change the rendered banner image");
});

function assertPngDimensions(buffer: Buffer, expected: { width: number; height: number }) {
    assert.deepEqual([...buffer.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.deepEqual(imageSize(buffer), { ...expected, type: "png" });
}

function sha256(buffer: Buffer) {
    return crypto.createHash("sha256").update(buffer).digest("hex");
}
