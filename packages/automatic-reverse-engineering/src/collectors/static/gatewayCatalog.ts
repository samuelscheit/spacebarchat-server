import { GatewayCatalog, GatewayEventCatalogEntry, GatewayOpcodeCatalogEntry } from "../../types.js";

export interface GatewaySourceImportOptions {
    source?: string;
}

export interface GatewaySourceFiles {
    constants?: string;
    opcodeHandlers?: string;
    events?: string;
    schemasIndex?: string;
}

export function importGatewayCatalogFromSources(sources: GatewaySourceFiles, options: GatewaySourceImportOptions = {}): GatewayCatalog {
    const source = options.source ?? "spacebar-source";
    const opcodes = sources.constants ? parseOpcodes(sources.constants, source) : [];
    const handlers = sources.opcodeHandlers ? parseOpcodeHandlers(sources.opcodeHandlers) : new Map<number, string>();
    const events = sources.events ? parseEvents(sources.events, source) : [];
    const schemaRefs = sources.schemasIndex ? parseSchemaExports(sources.schemasIndex) : new Set<string>();

    return {
        opcodes: opcodes.map((opcode) => ({
            ...opcode,
            handler: handlers.get(opcode.opcode),
            direction: directionForOpcode(opcode.opcode, handlers),
        })),
        events: events.map((event) => ({
            ...event,
            payload_schema_ref: schemaRefs.has(toPascalCase(event.event)) ? toPascalCase(event.event) : undefined,
        })),
    };
}

export function parseOpcodes(sourceText: string, source: string): GatewayOpcodeCatalogEntry[] {
    const enumBody = bodyForEnum(sourceText, "OPCODES");
    if (!enumBody) {
        return [];
    }

    const entries: GatewayOpcodeCatalogEntry[] = [];
    for (const match of enumBody.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(\d+)/g)) {
        entries.push({
            opcode: Number(match[2]),
            name: match[1],
            direction: "unknown",
            source,
        });
    }

    return entries.sort((a, b) => a.opcode - b.opcode);
}

export function parseOpcodeHandlers(sourceText: string): Map<number, string> {
    const handlers = new Map<number, string>();
    for (const match of sourceText.matchAll(/(?:^|[,{])\s*(\d+)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/g)) {
        handlers.set(Number(match[1]), match[2]);
    }

    return handlers;
}

export function parseEvents(sourceText: string, source: string): GatewayEventCatalogEntry[] {
    const enumBody = bodyForEnum(sourceText, "EVENTEnum");
    if (!enumBody) {
        return [];
    }

    const entries: GatewayEventCatalogEntry[] = [];
    for (const match of enumBody.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"([^"]+)"/g)) {
        entries.push({
            event: match[2],
            name: match[1],
            direction: "received",
            source,
        });
    }

    return entries.sort((a, b) => a.event.localeCompare(b.event));
}

function parseSchemaExports(sourceText: string): Set<string> {
    const names = new Set<string>();
    for (const match of sourceText.matchAll(/export\s+\*\s+from\s+["']\.\/([^"']+)["']/g)) {
        names.add(match[1].replace(/Schema$/, ""));
    }

    return names;
}

function bodyForEnum(sourceText: string, enumName: string): string | undefined {
    const match = new RegExp(`enum\\s+${enumName}\\s*\\{([\\s\\S]*?)\\}`, "m").exec(sourceText);
    return match?.[1];
}

function directionForOpcode(opcode: number, handlers: Map<number, string>): "sent" | "received" | "both" | "unknown" {
    if (opcode === 0 || opcode === 7 || opcode === 9 || opcode === 10 || opcode === 11) {
        return "received";
    }

    if (handlers.has(opcode)) {
        return "sent";
    }

    return "unknown";
}

function toPascalCase(event: string): string {
    return event
        .toLowerCase()
        .split("_")
        .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
        .join("");
}
