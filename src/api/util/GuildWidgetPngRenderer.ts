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
import { HTTPError } from "lambert-server";

export const WIDGET_STYLES = ["shield", "banner1", "banner2", "banner3", "banner4"] as const;
export type WidgetImageStyle = (typeof WIDGET_STYLES)[number];

type WidgetTemplate = {
    width: number;
    height: number;
    svg: string;
};

export type WidgetImageData = {
    style: WidgetImageStyle;
    name: string;
    presence: string;
    iconDataUri?: string;
};

type WidgetTextOptions = {
    x: number;
    y: number;
    fontSize: number;
    fill?: string;
    fontWeight?: number;
    maxcharacters?: number;
    textAnchor?: "start" | "middle";
};

type WidgetTemplateOptions = {
    width: number;
    height: number;
    icon?: { x: number; y: number; size: number };
    name?: WidgetTextOptions;
    presence: WidgetTextOptions;
};

const WIDGET_TEMPLATE_OPTIONS: Record<WidgetImageStyle, WidgetTemplateOptions> = {
    shield: {
        width: 119,
        height: 20,
        presence: { x: 79, y: 14, fontSize: 10, textAnchor: "middle" },
    },
    banner1: {
        width: 300,
        height: 160,
        icon: { x: 20, y: 27, size: 50 },
        name: { x: 83, y: 51, maxcharacters: 22, fontSize: 12, fontWeight: 600 },
        presence: { x: 83, y: 66, fontSize: 10, fill: "#c9d2f0" },
    },
    banner2: {
        width: 320,
        height: 76,
        icon: { x: 13, y: 19, size: 36 },
        name: { x: 62, y: 34, maxcharacters: 15, fontSize: 12, fontWeight: 600 },
        presence: { x: 62, y: 49, fontSize: 10, fill: "#c9d2f0" },
    },
    banner3: {
        width: 320,
        height: 140,
        icon: { x: 20, y: 20, size: 50 },
        name: { x: 83, y: 44, maxcharacters: 27, fontSize: 12, fontWeight: 600 },
        presence: { x: 83, y: 58, fontSize: 10, fill: "#c9d2f0" },
    },
    banner4: {
        width: 320,
        height: 270,
        icon: { x: 21, y: 136, size: 50 },
        name: { x: 84, y: 156, maxcharacters: 27, fontSize: 14, fontWeight: 600 },
        presence: { x: 84, y: 171, fontSize: 12, fill: "#c9d2f0" },
    },
};

export const WIDGET_STYLE_ERROR = `Value must be one of (${WIDGET_STYLES.map((style) => `'${style}'`).join(", ")}).`;
const widgetStyleSet = new Set<string>(WIDGET_STYLES);
const templateDataUriCache = new Map<WidgetImageStyle, string>();

export function isWidgetImageStyle(style: string): style is WidgetImageStyle {
    return widgetStyleSet.has(style);
}

export function parseWidgetImageStyle(style: string): WidgetImageStyle {
    if (isWidgetImageStyle(style)) return style;
    throw new HTTPError(WIDGET_STYLE_ERROR, 400);
}

export function renderGuildWidgetSvg(data: WidgetImageData): WidgetTemplate {
    const options = WIDGET_TEMPLATE_OPTIONS[data.style];
    const icon = options.icon ? renderIcon(data.iconDataUri, options.icon.x, options.icon.y, options.icon.size) : "";
    const name = options.name ? renderText(data.name, options.name) : "";
    const presence = renderText(data.presence, options.presence);

    return {
        width: options.width,
        height: options.height,
        svg: svgDocument(
            options.width,
            options.height,
            `
                <image href="${escapeSvgAttribute(getWidgetTemplateDataUri(data.style))}" x="0" y="0" width="${options.width}" height="${options.height}" preserveAspectRatio="none"/>
                ${icon}
                ${name}
                ${presence}
            `,
        ),
    };
}

export async function renderGuildWidgetPng(data: WidgetImageData): Promise<Buffer> {
    const { svg } = renderGuildWidgetSvg(data);
    const { default: sharp } = await import("sharp");
    return sharp(Buffer.from(svg)).png().toBuffer();
}

export function getGuildWidgetIconStoragePath(guild_id: string, icon: string) {
    return `icons/${guild_id}/${stripFileExtension(icon)}`;
}

export function getWidgetAssetsPath() {
    const candidates = [
        path.join(process.cwd(), "assets", "widget"),
        path.join(__dirname, "..", "..", "..", "assets", "widget"),
        path.join(__dirname, "..", "..", "..", "..", "assets", "widget"),
    ];

    return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

export function getWidgetTemplatePath(style: WidgetImageStyle, assetsPath = getWidgetAssetsPath()) {
    return path.join(assetsPath, `${style}.png`);
}

export function imageBufferToDataUri(buffer: Buffer) {
    return `data:${getImageMimeType(buffer)};base64,${buffer.toString("base64")}`;
}

export function getImageMimeType(buffer: Buffer) {
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
    if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
    if (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a") return "image/gif";
    if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
    if (isSvgImage(buffer)) return "image/svg+xml";
    return "image/png";
}

function getWidgetTemplateDataUri(style: WidgetImageStyle) {
    const cached = templateDataUriCache.get(style);
    if (cached) return cached;

    const dataUri = imageBufferToDataUri(fs.readFileSync(getWidgetTemplatePath(style)));
    templateDataUriCache.set(style, dataUri);
    return dataUri;
}

function renderText(text: string, options: WidgetTextOptions) {
    return `<text x="${options.x}" y="${options.y}" text-anchor="${options.textAnchor ?? "start"}" fill="${options.fill ?? "#fff"}" font-family="Verdana,Arial,sans-serif" font-size="${
        options.fontSize
    }" font-weight="${options.fontWeight ?? 400}">${escapeSvgText(truncateText(text, options.maxcharacters ?? 0))}</text>`;
}

function renderIcon(iconDataUri: string | undefined, x: number, y: number, size: number) {
    if (!iconDataUri) {
        const centerX = x + size / 2;
        const centerY = y + size / 2;
        const fontSize = Math.round(size * 0.46);
        return `
            <circle cx="${centerX}" cy="${centerY}" r="${size / 2}" fill="#0185ff"/>
            <text x="${centerX}" y="${centerY + fontSize / 3}" text-anchor="middle" fill="#fff" font-family="Verdana,Arial,sans-serif" font-size="${fontSize}" font-weight="700">S</text>
        `;
    }

    return `
        <clipPath id="iconClip${x}${y}${size}"><circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size / 2}"/></clipPath>
        <image href="${escapeSvgAttribute(iconDataUri)}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#iconClip${x}${y}${size})"/>
    `;
}

function svgDocument(width: number, height: number, body: string) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
}

export function truncateText(text: string, maxcharacters: number) {
    if (maxcharacters && text.length > maxcharacters) return `${text.slice(0, maxcharacters)}...`;
    return text;
}

export function escapeSvgText(value: string) {
    return stripInvalidXmlCharacters(value).replace(/[&<>"]/g, (character) => {
        switch (character) {
            case "&":
                return "&amp;";
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case '"':
                return "&quot;";
            default:
                return character;
        }
    });
}

export function stripInvalidXmlCharacters(value: string) {
    let stripped = "";
    for (const character of value) {
        const codePoint = character.codePointAt(0);
        if (codePoint && isValidXmlCharacter(codePoint)) stripped += character;
    }
    return stripped;
}

function escapeSvgAttribute(value: string) {
    return escapeSvgText(value).replace(/'/g, "&apos;");
}

function stripFileExtension(value: string) {
    return value.split(".")[0];
}

function isSvgImage(buffer: Buffer) {
    const sample = buffer.subarray(0, 512).toString("utf8").trimStart();
    return sample.startsWith("<svg") || (sample.startsWith("<?xml") && sample.includes("<svg"));
}

function isValidXmlCharacter(codePoint: number) {
    return codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d || (codePoint >= 0x20 && codePoint <= 0xd7ff) || (codePoint >= 0xe000 && codePoint <= 0x10ffff);
}
