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

import { HTTPError } from "lambert-server";

const validWidgetStyles = ["shield", "banner1", "banner2", "banner3", "banner4"] as const;
export type WidgetImageStyle = (typeof validWidgetStyles)[number];

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

const invalidStyleMessage = "Value must be one of ('shield', 'banner1', 'banner2', 'banner3', 'banner4').";

export function parseWidgetImageStyle(style: string): WidgetImageStyle {
    if (validWidgetStyles.includes(style as WidgetImageStyle)) return style as WidgetImageStyle;
    throw new HTTPError(invalidStyleMessage, 400);
}

export function renderGuildWidgetSvg(data: WidgetImageData): WidgetTemplate {
    switch (data.style) {
        case "shield":
            return renderShieldTemplate(data);
        case "banner1":
            return renderBannerTemplate(data, {
                width: 170,
                height: 90,
                icon: { x: 20, y: 27, size: 50 },
                name: { x: 83, y: 51, maxcharacters: 22, fontSize: 12 },
                presence: { x: 83, y: 66, fontSize: 11 },
            });
        case "banner2":
            return renderBannerTemplate(data, {
                width: 170,
                height: 70,
                icon: { x: 13, y: 19, size: 36 },
                name: { x: 62, y: 34, maxcharacters: 15, fontSize: 12 },
                presence: { x: 62, y: 49, fontSize: 11 },
            });
        case "banner3":
            return renderBannerTemplate(data, {
                width: 170,
                height: 70,
                icon: { x: 20, y: 20, size: 50 },
                name: { x: 83, y: 44, maxcharacters: 27, fontSize: 12 },
                presence: { x: 83, y: 58, fontSize: 11 },
            });
        case "banner4":
            return renderBannerTemplate(data, {
                width: 170,
                height: 190,
                icon: { x: 21, y: 136, size: 50 },
                name: { x: 84, y: 156, maxcharacters: 27, fontSize: 13 },
                presence: { x: 84, y: 171, fontSize: 12 },
                tall: true,
            });
        default:
            return assertNever(data.style);
    }
}

export async function renderGuildWidgetPng(data: WidgetImageData): Promise<Buffer> {
    const { svg } = renderGuildWidgetSvg(data);
    const { default: sharp } = await import("sharp");
    return sharp(Buffer.from(svg)).png().toBuffer();
}

export function getGuildWidgetIconStoragePath(guild_id: string, icon: string) {
    return `icons/${guild_id}/${stripFileExtension(icon)}`;
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

function renderShieldTemplate(data: WidgetImageData): WidgetTemplate {
    const label = "SPACEBAR";
    const value = truncateText(data.presence, 0);
    const labelWidth = 62;
    const valueWidth = Math.max(76, value.length * 6 + 18);
    const width = labelWidth + valueWidth;
    const height = 20;
    const valueCenter = labelWidth + valueWidth / 2;

    return {
        width,
        height,
        svg: svgDocument(
            width,
            height,
            `
                <linearGradient id="shieldLabel" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stop-color="#555"/>
                    <stop offset="1" stop-color="#333"/>
                </linearGradient>
                <linearGradient id="shieldValue" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stop-color="#0a97ff"/>
                    <stop offset="1" stop-color="#0074d9"/>
                </linearGradient>
                <clipPath id="shieldClip"><rect width="${width}" height="${height}" rx="3"/></clipPath>
                <g clip-path="url(#shieldClip)">
                    <rect width="${labelWidth}" height="${height}" fill="url(#shieldLabel)"/>
                    <rect x="${labelWidth}" width="${valueWidth}" height="${height}" fill="url(#shieldValue)"/>
                </g>
                <text x="31" y="14" text-anchor="middle" fill="#fff" font-family="Verdana,Arial,sans-serif" font-size="10" font-weight="700">${escapeSvgText(label)}</text>
                <text x="${valueCenter}" y="14" text-anchor="middle" fill="#fff" font-family="Verdana,Arial,sans-serif" font-size="10">${escapeSvgText(value)}</text>
            `,
        ),
    };
}

type BannerOptions = {
    width: number;
    height: number;
    icon: { x: number; y: number; size: number };
    name: { x: number; y: number; maxcharacters: number; fontSize: number };
    presence: { x: number; y: number; fontSize: number };
    tall?: boolean;
};

function renderBannerTemplate(data: WidgetImageData, options: BannerOptions): WidgetTemplate {
    const icon = renderIcon(data.iconDataUri, options.icon.x, options.icon.y, options.icon.size);
    const background = options.tall
        ? `
            <linearGradient id="bannerBg" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stop-color="#5865f2"/>
                <stop offset="0.55" stop-color="#404eed"/>
                <stop offset="1" stop-color="#23272a"/>
            </linearGradient>
            <rect width="${options.width}" height="${options.height}" rx="4" fill="url(#bannerBg)"/>
            <circle cx="135" cy="45" r="52" fill="#ffffff" opacity="0.08"/>
            <text x="20" y="32" fill="#fff" opacity="0.96" font-family="Verdana,Arial,sans-serif" font-size="15" font-weight="700">SPACEBAR</text>
            <text x="20" y="51" fill="#c9d2f0" font-family="Verdana,Arial,sans-serif" font-size="11">COMMUNITY</text>
        `
        : `
            <linearGradient id="bannerBg" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stop-color="#5865f2"/>
                <stop offset="1" stop-color="#23272a"/>
            </linearGradient>
            <rect width="${options.width}" height="${options.height}" rx="4" fill="url(#bannerBg)"/>
            <circle cx="148" cy="10" r="44" fill="#ffffff" opacity="0.07"/>
        `;

    return {
        width: options.width,
        height: options.height,
        svg: svgDocument(
            options.width,
            options.height,
            `
                ${background}
                ${icon}
                <text x="${options.name.x}" y="${options.name.y}" fill="#fff" font-family="Verdana,Arial,sans-serif" font-size="${options.name.fontSize}" font-weight="600">${escapeSvgText(
                    truncateText(data.name, options.name.maxcharacters),
                )}</text>
                <text x="${options.presence.x}" y="${options.presence.y}" fill="#c9d2f0" font-family="Verdana,Arial,sans-serif" font-size="${options.presence.fontSize}">${escapeSvgText(data.presence)}</text>
            `,
        ),
    };
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

function assertNever(value: never): never {
    throw new Error(`Unhandled widget image style: ${value}`);
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
