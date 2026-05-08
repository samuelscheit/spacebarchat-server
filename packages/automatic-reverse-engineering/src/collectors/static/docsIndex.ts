import { GatewayCatalog, GatewayEventCatalogEntry, GatewayOpcodeCatalogEntry, RouteCatalogEntry } from "../../types.js";

export interface DocsIndexEntry {
    kind: "route" | "gateway_event" | "gateway_opcode";
    key: string;
    refs: Record<string, string>;
}

export interface DocsIndexInput {
    routes?: RouteCatalogEntry[];
    gateway?: GatewayCatalog;
}

const officialApiReference = "https://docs.discord.com/developers/reference";
const officialGatewayReference = "https://docs.discord.com/developers/events/gateway";
const userdoccersReference = "https://docs.discord.food/reference";
const userdoccersGatewayEvents = "https://docs.discord.food/gateway/gateway-events";

export function buildDocsIndex(input: DocsIndexInput): DocsIndexEntry[] {
    return [
        ...(input.routes ?? []).map(routeDocsEntry),
        ...(input.gateway?.events ?? []).map(gatewayEventDocsEntry),
        ...(input.gateway?.opcodes ?? []).map(gatewayOpcodeDocsEntry),
    ].sort((a, b) => `${a.kind}:${a.key}`.localeCompare(`${b.kind}:${b.key}`));
}

function routeDocsEntry(route: RouteCatalogEntry): DocsIndexEntry {
    return {
        kind: "route",
        key: `${route.method} ${route.route}`,
        refs: {
            official_api_reference: officialApiReference,
            userdoccers_reference: userdoccersReference,
        },
    };
}

function gatewayEventDocsEntry(event: GatewayEventCatalogEntry): DocsIndexEntry {
    return {
        kind: "gateway_event",
        key: event.event,
        refs: {
            official_gateway_reference: officialGatewayReference,
            userdoccers_gateway_events: userdoccersGatewayEvents,
        },
    };
}

function gatewayOpcodeDocsEntry(opcode: GatewayOpcodeCatalogEntry): DocsIndexEntry {
    return {
        kind: "gateway_opcode",
        key: `${opcode.opcode} ${opcode.name}`,
        refs: {
            official_gateway_reference: officialGatewayReference,
            userdoccers_gateway_events: userdoccersGatewayEvents,
        },
    };
}
