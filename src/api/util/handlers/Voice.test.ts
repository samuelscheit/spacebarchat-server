import assert from "node:assert/strict";
import { test } from "node:test";
import type { Region } from "@spacebar/schemas";
import { Config, ConfigValue, IpDataClient } from "@spacebar/util";
import { getVoiceRegions } from "./Voice";

function region(overrides: Partial<Region>): Region {
    return {
        id: "region",
        name: "Region",
        endpoint: "region.example:443",
        vip: false,
        custom: false,
        deprecated: false,
        ...overrides,
    };
}

function ipInfo(latitude: number, longitude: number) {
    return {
        latitude,
        longitude,
    } as Awaited<ReturnType<typeof IpDataClient.getIpInfo>>;
}

test("getVoiceRegions uses configured region locations without looking up endpoints", async (t) => {
    const config = new ConfigValue();
    config.regions.useDefaultAsOptimal = false;
    config.regions.default = "far";
    config.regions.available = [
        region({ id: "near", name: "Near", endpoint: "near.example:443", location: { latitude: 0, longitude: 0 } }),
        region({ id: "far", name: "Far", endpoint: "far.example:443", location: { latitude: 80, longitude: 0 } }),
    ];

    t.mock.method(Config, "get", () => config);
    const setMock = t.mock.method(Config, "set", async () => config);
    const ipInfoMock = t.mock.method(IpDataClient, "getIpInfo", async (ip: string) => {
        assert.equal(ip, "203.0.113.1");
        return ipInfo(1, 0);
    });

    const response = await getVoiceRegions("203.0.113.1", false);

    assert.equal(ipInfoMock.mock.callCount(), 1);
    assert.equal(setMock.mock.callCount(), 0);
    assert.deepEqual(
        response.map((r) => ({ id: r.id, optimal: r.optimal })),
        [
            { id: "near", optimal: true },
            { id: "far", optimal: false },
        ],
    );
});

test("getVoiceRegions persists missing endpoint locations before returning optimal region", async (t) => {
    const config = new ConfigValue();
    config.regions.useDefaultAsOptimal = false;
    config.regions.default = "fallback";
    config.regions.available = [
        region({ id: "fallback", name: "Fallback", endpoint: "fallback.example:443", location: { latitude: 80, longitude: 0 } }),
        region({ id: "resolved", name: "Resolved", endpoint: "resolved.example:443" }),
    ];

    t.mock.method(Config, "get", () => config);
    const setMock = t.mock.method(Config, "set", async () => config);
    const calls: string[] = [];
    t.mock.method(IpDataClient, "getIpInfo", async (ip: string) => {
        calls.push(ip);
        if (ip === "203.0.113.1") return ipInfo(0, 0);
        if (ip === "resolved.example:443") return ipInfo(1, 0);
        throw new Error(`unexpected ipdata lookup: ${ip}`);
    });

    const response = await getVoiceRegions("203.0.113.1", false);

    assert.deepEqual(calls, ["203.0.113.1", "resolved.example:443"]);
    assert.deepEqual(config.regions.available[1].location, { latitude: 1, longitude: 0 });
    assert.equal(setMock.mock.callCount(), 1);
    const firstSetCall = setMock.mock.calls.at(0);
    assert(firstSetCall);
    const [configUpdate] = firstSetCall.arguments as [Partial<ConfigValue>];
    assert(configUpdate);
    assert.equal(configUpdate.regions, config.regions);
    assert.deepEqual(
        response.map((r) => ({ id: r.id, optimal: r.optimal })),
        [
            { id: "fallback", optimal: false },
            { id: "resolved", optimal: true },
        ],
    );
});

test("getVoiceRegions only resolves endpoint locations for regions available to the caller", async (t) => {
    const config = new ConfigValue();
    config.regions.useDefaultAsOptimal = false;
    config.regions.default = "public";
    config.regions.available = [
        region({ id: "public", name: "Public", endpoint: "public.example:443" }),
        region({ id: "vip", name: "VIP", endpoint: "vip.example:443", vip: true }),
    ];

    t.mock.method(Config, "get", () => config);
    t.mock.method(Config, "set", async () => config);
    const calls: string[] = [];
    t.mock.method(IpDataClient, "getIpInfo", async (ip: string) => {
        calls.push(ip);
        if (ip === "203.0.113.1") return ipInfo(0, 0);
        if (ip === "public.example:443") return ipInfo(1, 0);
        if (ip === "vip.example:443") return ipInfo(2, 0);
        throw new Error(`unexpected ipdata lookup: ${ip}`);
    });

    const response = await getVoiceRegions("203.0.113.1", false);

    assert.deepEqual(calls, ["203.0.113.1", "public.example:443"]);
    assert.deepEqual(
        response.map((r) => r.id),
        ["public"],
    );
    assert.deepEqual(config.regions.available[0].location, { latitude: 1, longitude: 0 });
    assert.equal(config.regions.available[1].location, undefined);
});

test("getVoiceRegions falls back to the configured default when ipdata is unavailable", async (t) => {
    const config = new ConfigValue();
    config.regions.useDefaultAsOptimal = false;
    config.regions.default = "fallback";
    config.regions.available = [
        region({ id: "fallback", name: "Fallback", endpoint: "fallback.example:443" }),
        region({ id: "other", name: "Other", endpoint: "other.example:443" }),
    ];

    t.mock.method(Config, "get", () => config);
    const setMock = t.mock.method(Config, "set", async () => config);
    const ipInfoMock = t.mock.method(IpDataClient, "getIpInfo", async () => null);

    const response = await getVoiceRegions("203.0.113.1", false);

    assert.equal(ipInfoMock.mock.callCount(), 1);
    assert.equal(setMock.mock.callCount(), 0);
    assert.deepEqual(
        response.map((r) => ({ id: r.id, optimal: r.optimal })),
        [
            { id: "fallback", optimal: true },
            { id: "other", optimal: false },
        ],
    );
});

test("getVoiceRegions skips regions whose endpoint location cannot be resolved", async (t) => {
    const config = new ConfigValue();
    config.regions.useDefaultAsOptimal = false;
    config.regions.default = "fallback";
    config.regions.available = [
        region({ id: "fallback", name: "Fallback", endpoint: "fallback.example:443", location: { latitude: 80, longitude: 0 } }),
        region({ id: "unresolved", name: "Unresolved", endpoint: "unresolved.example:443" }),
    ];

    t.mock.method(Config, "get", () => config);
    const setMock = t.mock.method(Config, "set", async () => config);
    const calls: string[] = [];
    t.mock.method(IpDataClient, "getIpInfo", async (ip: string) => {
        calls.push(ip);
        if (ip === "203.0.113.1") return ipInfo(79, 0);
        if (ip === "unresolved.example:443") return null;
        throw new Error(`unexpected ipdata lookup: ${ip}`);
    });

    const response = await getVoiceRegions("203.0.113.1", false);

    assert.deepEqual(calls, ["203.0.113.1", "unresolved.example:443"]);
    assert.equal(config.regions.available[1].location, undefined);
    assert.equal(setMock.mock.callCount(), 0);
    assert.deepEqual(
        response.map((r) => ({ id: r.id, optimal: r.optimal })),
        [
            { id: "fallback", optimal: true },
            { id: "unresolved", optimal: false },
        ],
    );
});
