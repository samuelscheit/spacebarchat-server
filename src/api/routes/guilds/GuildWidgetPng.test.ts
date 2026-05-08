/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import assert from "node:assert/strict";
import test from "node:test";
import { HTTPError } from "lambert-server";
import {
    escapeSvgText,
    getGuildWidgetIconStoragePath,
    getImageMimeType,
    imageBufferToDataUri,
    parseWidgetImageStyle,
    renderGuildWidgetPng,
    renderGuildWidgetSvg,
    stripInvalidXmlCharacters,
    truncateText,
} from "./GuildWidgetPngRenderer";

test("guild widget PNG accepts only documented styles", () => {
    assert.equal(parseWidgetImageStyle("shield"), "shield");
    assert.equal(parseWidgetImageStyle("banner4"), "banner4");

    assert.throws(
        () => parseWidgetImageStyle("unknown"),
        (error) => {
            assert.ok(error instanceof HTTPError);
            assert.equal(error.code, 400);
            return true;
        },
    );
});

test("guild widget SVG renderer uses inline templates for every supported style", () => {
    const expectedSizes = {
        shield: { width: 138, height: 20 },
        banner1: { width: 170, height: 90 },
        banner2: { width: 170, height: 70 },
        banner3: { width: 170, height: 70 },
        banner4: { width: 170, height: 190 },
    } as const;

    for (const [style, expected] of Object.entries(expectedSizes)) {
        const template = renderGuildWidgetSvg({
            style: parseWidgetImageStyle(style),
            name: "Spacebar Guild",
            presence: "12 ONLINE",
        });

        assert.equal(template.width, expected.width);
        assert.equal(template.height, expected.height);
        assert.match(template.svg, /^<svg /);
        assert.match(template.svg, /SPACEBAR|Spacebar Guild/);
        assert.doesNotMatch(template.svg, /assets\/widget|createCanvas|canvas/);
    }
});

test("guild widget SVG renderer escapes dynamic text and truncates banner names", () => {
    const template = renderGuildWidgetSvg({
        style: "banner2",
        name: '<script>alert("&") and a very long guild name',
        presence: "5 < 6 & 7 > 3 ONLINE",
    });

    assert.match(template.svg, /&lt;script&gt;alert\(&quot;\.\.\./);
    assert.match(template.svg, /5 &lt; 6 &amp; 7 &gt; 3 ONLINE/);
    assert.doesNotMatch(template.svg, /<script>/);
    assert.equal(truncateText("abcdefghijklmnop", 15), "abcdefghijklmno...");
    assert.equal(escapeSvgText('a&b<c>d"'), "a&amp;b&lt;c&gt;d&quot;");
});

test("guild widget SVG renderer strips XML-invalid dynamic text", async () => {
    const template = renderGuildWidgetSvg({
        style: "banner1",
        name: "bad\u0001guild",
        presence: "1\u0000 ONLINE",
    });

    assert.equal(template.svg.includes("\u0000"), false);
    assert.equal(template.svg.includes("\u0001"), false);
    assert.equal(stripInvalidXmlCharacters("bad\u0001guild\u0000"), "badguild");
    await assert.doesNotReject(renderGuildWidgetPng({ style: "banner1", name: "bad\u0001guild", presence: "1\u0000 ONLINE" }));
});

test("guild widget SVG renderer embeds icons only when provided", () => {
    const withoutIcon = renderGuildWidgetSvg({ style: "banner1", name: "Guild", presence: "1 ONLINE" });
    assert.doesNotMatch(withoutIcon.svg, /<image /);
    assert.match(withoutIcon.svg, />S<\/text>/);

    const withIcon = renderGuildWidgetSvg({
        style: "banner1",
        name: "Guild",
        presence: "1 ONLINE",
        iconDataUri: 'data:image/png;base64,abc"def',
    });
    assert.match(withIcon.svg, /<image /);
    assert.match(withIcon.svg, /abc&quot;def/);
});

test("guild widget PNG renderer produces PNG bytes from the SVG template", async () => {
    const png = await renderGuildWidgetPng({ style: "shield", name: "Guild", presence: "12 ONLINE" });

    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
});

test("guild widget PNG renderer rasterizes embedded PNG icon data URIs", async () => {
    const iconDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVR4nGP4z8DwH4QZYAwAR8oH+WdZbrcAAAAASUVORK5CYII=";
    const png = await renderGuildWidgetPng({ style: "banner2", name: "Guild", presence: "1 ONLINE", iconDataUri });
    const { default: sharp } = await import("sharp");
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const centerPixelOffset = (37 * info.width + 31) * info.channels;
    const [red, green, blue, alpha] = data.subarray(centerPixelOffset, centerPixelOffset + 4);

    assert.equal(info.width, 170);
    assert.equal(info.height, 70);
    assert.ok(red > 200);
    assert.ok(green < 50);
    assert.ok(blue < 50);
    assert.equal(alpha, 255);
});

test("guild widget PNG renderer uses guild icon storage paths and SVG data URI MIME types", async () => {
    const icon = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="red"/></svg>');
    const png = await renderGuildWidgetPng({ style: "banner2", name: "Guild", presence: "1 ONLINE", iconDataUri: imageBufferToDataUri(icon) });
    const { default: sharp } = await import("sharp");
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const centerPixelOffset = (37 * info.width + 31) * info.channels;
    const [red, green, blue, alpha] = data.subarray(centerPixelOffset, centerPixelOffset + 4);

    assert.equal(getGuildWidgetIconStoragePath("123", "icon-hash.png"), "icons/123/icon-hash");
    assert.equal(getImageMimeType(icon), "image/svg+xml");
    assert.ok(red > 200);
    assert.ok(green < 50);
    assert.ok(blue < 50);
    assert.equal(alpha, 255);
});
