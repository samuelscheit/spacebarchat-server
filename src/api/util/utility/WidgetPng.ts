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

import fs from "node:fs";
import path from "node:path";
import { HorizontalAlign, Jimp, JimpMime, loadFont } from "jimp";
import { SANS_10_BLACK, SANS_12_BLACK, SANS_14_BLACK } from "jimp/fonts";

export const WIDGET_STYLES = ["shield", "banner1", "banner2", "banner3", "banner4"] as const;
export type WidgetStyle = (typeof WIDGET_STYLES)[number];

export const WIDGET_STYLE_ERROR = `Value must be one of (${WIDGET_STYLES.map((style) => `'${style}'`).join(", ")}).`;

type FontSize = 10 | 12 | 14;
type Rgba = readonly [red: number, green: number, blue: number, alpha: number];
type JimpImage = Awaited<ReturnType<typeof Jimp.read>>;
type JimpFont = Awaited<ReturnType<typeof loadFont>>;

export interface RenderWidgetPngOptions {
    style: WidgetStyle;
    name: string;
    presenceCount?: number | null;
    icon?: Buffer | null;
    assetsPath?: string;
}

const widgetStyleSet = new Set<string>(WIDGET_STYLES);
const white: Rgba = [255, 255, 255, 255];
const onlineText: Rgba = [201, 210, 240, 255];
const fontCache = new Map<string, Promise<JimpFont>>();

export function isWidgetStyle(style: string): style is WidgetStyle {
    return widgetStyleSet.has(style);
}

export function getWidgetAssetsPath() {
    const candidates = [
        path.join(process.cwd(), "assets", "widget"),
        path.join(__dirname, "..", "..", "..", "..", "assets", "widget"),
        path.join(__dirname, "..", "..", "..", "..", "..", "assets", "widget"),
    ];

    return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

export function getWidgetTemplatePath(style: WidgetStyle, assetsPath = getWidgetAssetsPath()) {
    return path.join(assetsPath, `${style}.png`);
}

export async function renderWidgetPng(options: RenderWidgetPngOptions) {
    const image = await Jimp.read(getWidgetTemplatePath(options.style, options.assetsPath));
    const presence = `${options.presenceCount ?? 0} ONLINE`;

    switch (options.style) {
        case "shield":
            await drawText(image, 40, 3, white, 10, presence, undefined, 78, HorizontalAlign.CENTER);
            break;
        case "banner1":
            await drawOptionalIcon(image, 20, 27, 50, options.icon);
            await drawText(image, 83, 39, white, 12, options.name, 22);
            await drawText(image, 83, 55, onlineText, 10, presence);
            break;
        case "banner2":
            await drawOptionalIcon(image, 13, 19, 36, options.icon);
            await drawText(image, 62, 22, white, 12, options.name, 15);
            await drawText(image, 62, 39, onlineText, 10, presence);
            break;
        case "banner3":
            await drawOptionalIcon(image, 20, 20, 50, options.icon);
            await drawText(image, 83, 32, white, 12, options.name, 27);
            await drawText(image, 83, 47, onlineText, 10, presence);
            break;
        case "banner4":
            await drawOptionalIcon(image, 21, 136, 50, options.icon);
            await drawText(image, 84, 142, white, 14, options.name, 27);
            await drawText(image, 84, 159, onlineText, 12, presence);
            break;
        default:
            assertNever(options.style);
    }

    return image.getBuffer(JimpMime.png);
}

async function drawOptionalIcon(image: JimpImage, x: number, y: number, scale: number, icon?: Buffer | null) {
    if (!icon) return;

    const iconImage = await Jimp.read(icon);
    iconImage.resize({ w: scale, h: scale });
    iconImage.circle();
    image.composite(iconImage, x, y);
}

async function drawText(
    image: JimpImage,
    x: number,
    y: number,
    color: Rgba,
    size: FontSize,
    text: string,
    maxCharacters?: number,
    maxWidth = Number.POSITIVE_INFINITY,
    alignmentX = HorizontalAlign.LEFT,
) {
    const font = await getTintedFont(size, color);
    const printableText = maxCharacters && text.length > maxCharacters ? `${text.slice(0, maxCharacters)}...` : text;

    image.print({
        font,
        x,
        y,
        text: {
            text: printableText,
            alignmentX,
        },
        maxWidth,
    });
}

function getTintedFont(size: FontSize, color: Rgba) {
    const key = `${size}:${color.join(",")}`;
    const existing = fontCache.get(key);
    if (existing) return existing;

    const font = loadTintedFont(size, color);
    fontCache.set(key, font);
    return font;
}

async function loadTintedFont(size: FontSize, color: Rgba): Promise<JimpFont> {
    const font = await loadFont(getFontPath(size));
    const [red, green, blue, alpha] = color;

    return {
        ...font,
        pages: font.pages.map((page) => {
            const tinted = page.clone();
            tinted.scan((_, __, index) => {
                if (tinted.bitmap.data[index + 3] === 0) return;

                tinted.bitmap.data[index] = red;
                tinted.bitmap.data[index + 1] = green;
                tinted.bitmap.data[index + 2] = blue;
                tinted.bitmap.data[index + 3] = Math.round((tinted.bitmap.data[index + 3] * alpha) / 255);
            });
            return tinted;
        }),
    };
}

function getFontPath(size: FontSize) {
    switch (size) {
        case 10:
            return SANS_10_BLACK;
        case 12:
            return SANS_12_BLACK;
        case 14:
            return SANS_14_BLACK;
        default:
            return assertNever(size);
    }
}

function assertNever(value: never): never {
    throw new Error(`Unsupported widget value ${value}`);
}
