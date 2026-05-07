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

import dotenv from "dotenv";
dotenv.config({ quiet: true });
import {
    checkToken,
    closeDatabase,
    getProcessMetricSamples,
    initEvent,
    initStartupConfigAndDatabase,
    type MetricSample,
    parseHttpRequestUrl,
    Rights,
    writePrometheusMetricsResponse,
} from "@spacebar/util";
import ws from "ws";
import { Connection, openConnections } from "./events/Connection";
import http from "node:http";
import { cleanupOnStartup } from "./util";
import { randomString } from "@spacebar/api";
import { setInterval } from "node:timers";
import { Duplex } from "node:stream";
import { closeGatewayServer } from "./util/Shutdown";

export class Server {
    public ws: ws.Server;
    public port: number;
    public server: http.Server;
    public production: boolean;
    private ownsHttpServer: boolean;
    private stopping = false;
    private stopPromise?: Promise<void>;
    private readonly upgradeHandler: (request: http.IncomingMessage, socket: Duplex, head: Buffer) => void;

    constructor({ port, server, production }: { port: number; server?: http.Server; production?: boolean }) {
        this.port = port;
        this.production = production || false;

        this.ownsHttpServer = !server;
        if (server) this.server = server;
        else {
            const elu = [1, 5, 15].map(() => performance.eventLoopUtilization());
            const eluP = [1, 5, 15].map(() => performance.eventLoopUtilization());
            const cpu = [1, 5, 15].map(() => process.cpuUsage());
            let sec = 0;
            const statsInterval = setInterval(() => {
                sec += 1;
                // for some reason this behaves differently from cpuUsage, so we need an absolute reference as "previous"
                const eluC = performance.eventLoopUtilization();

                cpu[0] = process.cpuUsage(cpu[0]);
                elu[0] = performance.eventLoopUtilization(eluP[0]);
                eluP[0] = eluC;
                if (sec % 5 === 0) {
                    cpu[1] = process.cpuUsage(cpu[1]);
                    elu[1] = performance.eventLoopUtilization(eluP[1]);
                    eluP[1] = eluC;
                }
                if (sec % 15 === 0) {
                    cpu[2] = process.cpuUsage(cpu[2]);
                    elu[2] = performance.eventLoopUtilization(eluP[2]);
                    eluP[2] = eluC;
                }
            }, 1000);
            statsInterval.unref();

            this.server = http.createServer(async (req, res) => {
                const requestUrl = parseHttpRequestUrl(req.url);
                if (requestUrl.pathname === "/-/metrics") {
                    writePrometheusMetricsResponse(res, () => this.getMetricSamples());
                    return;
                }

                if (!req.headers.cookie?.split("; ").find((x) => x.startsWith("__sb_sessid="))) {
                    res.setHeader("Set-Cookie", `__sb_sessid=${randomString(32)}; Secure; HttpOnly; SameSite=None; Path=/`);
                }

                if (requestUrl.pathname === "/_spacebar/gateway/admin/introspect") {
                    if (!req.headers.authorization) {
                        return res.writeHead(401).end("Unauthorized");
                    } else {
                        const auth = req.headers.authorization.split(" ");
                        const sess = await checkToken(auth[1]);
                        if ((BigInt(sess.user.rights) & BigInt(Rights.FLAGS.OPERATOR)) === BigInt(0)) {
                            return res.writeHead(401).end("Unauthorized");
                        }
                    }
                    const useFullWsObj = requestUrl.searchParams.get("fullWs") === "true";
                    res.setHeader("Content-Type", "application/json")
                        .writeHead(200)
                        .end(
                            JSON.stringify(
                                {
                                    uptime: process.uptime(),
                                    resourceUsage: process.resourceUsage(),
                                    eventLoop: elu,
                                    cpu: cpu.map((x) => ({
                                        user: x.user / 1000,
                                        system: x.system / 1000,
                                    })),
                                    socketStates: {
                                        open: openConnections.length,
                                        sessions: openConnections.map((x) =>
                                            // console.log(x);
                                            useFullWsObj
                                                ? {
                                                      ...x,
                                                      ...{
                                                          _events: undefined,
                                                          _closeTimer: undefined,
                                                          accessToken: x.accessToken?.split(".")[0] + "." + x.accessToken?.split(".")[1] + ".***",
                                                      },
                                                  }
                                                : {
                                                      wsReadystate: x.readyState,
                                                      version: x.version,
                                                      user_id: x.user_id,
                                                      session_id: x.session_id,
                                                      accessToken: x.accessToken?.split(".")[0] + "." + x.accessToken?.split(".")[1] + +".***",
                                                      encoding: x.encoding,
                                                      compress: x.compress,
                                                      ipAddress: x.ipAddress,
                                                      userAgent: x.userAgent,
                                                      fingerprint: x.fingerprint,
                                                      shard_count: x.shard_count,
                                                      shard_id: x.shard_id,
                                                      deflate: x.deflate != null,
                                                      inflate: x.inflate != null,
                                                      zstdEncoder: x.zstdEncoder != null,
                                                      zstdDecoder: x.zstdDecoder != null,
                                                      heartbeatTimeout: x.heartbeatTimeout,
                                                      readyTimeout: x.readyTimeout,
                                                      intents: x.intents,
                                                      sequence: x.sequence,
                                                      permissions: x.permissions,
                                                      events: x.events,
                                                      member_events: x.member_events,
                                                      guild_event_ids: x.guild_event_ids,
                                                      guild_member_event_ids: x.guild_member_event_ids,
                                                      member_event_guild_ids: x.member_event_guild_ids,
                                                      listen_options: x.listen_options,
                                                      capabilities: x.capabilities,
                                                      large_threshold: x.large_threshold,
                                                      qos: x.qos,
                                                      session: x.session,
                                                  },
                                        ),
                                    },
                                },
                                (key, value) => {
                                    if (value === null || value === undefined) return value;
                                    if (Object.getPrototypeOf(value)?.constructor?.name === "Timeout") return `[Timeout] ${value._idleTimeout}ms, repeat: ${value._repeat}`;
                                    if (Object.getPrototypeOf(value)?.constructor?.name === "BigInt") return value.toString() + "n";
                                    return value;
                                },
                                2,
                            ),
                        );
                    return;
                }

                res.writeHead(200).end("Online");
            });
        }

        this.ws = new ws.Server({
            maxPayload: 4096,
            noServer: true,
        });
        this.ws.on("connection", Connection);
        this.ws.on("error", console.error);

        this.upgradeHandler = (request, socket, head) => {
            if (this.stopping) {
                socket.destroy();
                return;
            }

            try {
                this.ws.handleUpgrade(request, socket, head, (websocket) => {
                    if (this.stopping) {
                        websocket.close(1001, "Gateway shutdown");
                        return;
                    }

                    this.ws.emit("connection", websocket, request);
                });
            } catch (error) {
                if (!this.stopping) console.error("[Gateway] WebSocket upgrade failed", error);
                socket.destroy();
            }
        };
        this.server.on("upgrade", this.upgradeHandler);
    }

    getExtraMetricSamples(): MetricSample[] {
        return [
            {
                name: "spacebar_gateway_open_connections",
                help: "Number of authenticated gateway connection records.",
                type: "gauge",
                value: openConnections.length,
                labels: { service: "gateway" },
            },
            {
                name: "spacebar_gateway_websocket_clients",
                help: "Number of websocket clients attached to the gateway server.",
                type: "gauge",
                value: this.ws?.clients.size ?? 0,
                labels: { service: "gateway" },
            },
        ];
    }

    getMetricSamples(): MetricSample[] {
        return getProcessMetricSamples("gateway", this.getExtraMetricSamples());
    }

    async start(): Promise<void> {
        await initStartupConfigAndDatabase();
        await initEvent();
        // temporary fix
        await cleanupOnStartup();

        if (!this.server.listening) {
            await listenHttpServer(this.server, this.port);
            this.ownsHttpServer = true;
            console.log(`[Gateway] online on 0.0.0.0:${this.port}`);
        }
    }

    async stop() {
        this.stopPromise ??= this.stopGateway();
        await this.stopPromise;
    }

    private async stopGateway() {
        this.stopping = true;
        this.server.off("upgrade", this.upgradeHandler);

        await closeGatewayServer(this.ws);

        if (this.ownsHttpServer) {
            if (this.server.listening) await closeHttpServer(this.server);
            await closeDatabase();
        }
    }
}

function listenHttpServer(server: http.Server, port: number) {
    return new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
            server.off("error", onError);
            reject(error);
        };

        server.once("error", onError);
        server.listen(port, () => {
            server.off("error", onError);
            resolve();
        });
    });
}

function closeHttpServer(server: http.Server) {
    return new Promise<void>((resolve, reject) => {
        server.close((error) => {
            if (error) reject(error);
            else resolve();
        });
    });
}
