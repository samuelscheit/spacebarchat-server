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

import amqp, { Channel, ChannelModel } from "amqplib";
import { Config } from "./Config";
import EventEmitter from "node:events";

export class RabbitMQ {
    public static connection: ChannelModel | null = null;
    public static channel: Channel | null = null;

    // Event emitter for connection state changes
    private static events = new EventEmitter();

    // Reconnection state
    private static isReconnecting = false;
    private static reconnectAttempts = 0;
    private static readonly BASE_RECONNECT_DELAY_MS = 500; // reconnect after 500 milliseconds delay
    private static reconnectTimer: NodeJS.Timeout | null = null;

    /**
     * Subscribe to connection events.
     * - 'reconnected': Fired after successful reconnection. Consumers should re-establish subscriptions.
     * - 'disconnected': Fired when connection is lost.
     */
    static on(event: "reconnected" | "disconnected", listener: () => void) {
        this.events.on(event, listener);
    }

    static off(event: "reconnected" | "disconnected", listener: () => void) {
        this.events.off(event, listener);
    }

    static async init() {
        const host = Config.get().rabbitmq.host;
        if (!host) return;

        await this.connect(host);
    }

    private static async connect(host: string): Promise<void> {
        let connection: ChannelModel | null = null;

        try {
            console.log(`[RabbitMQ] Connecting to: ${host}`);
            connection = await amqp.connect(host, {
                timeout: 1000 * 60,
            });

            this.connection = connection;
            this.channel = null;
            this.attachConnectionListeners(connection, host);

            // Pre-create the shared channel
            await this.getSafeChannel();

            console.log(`[RabbitMQ] Connected successfully`);

            // Reset reconnection state on successful connect
            this.reconnectAttempts = 0;
            this.isReconnecting = false;

            // Notify subscribers that connection is (re-)established
            this.events.emit("reconnected");
        } catch (error) {
            console.error("[RabbitMQ] Connection failed:", error);
            if (connection) {
                this.cleanupFailedConnection(connection);
            }
            this.scheduleReconnect(host);
        }
    }

    private static attachConnectionListeners(connection: ChannelModel, host: string) {
        connection.on("error", (err) => {
            console.error("[RabbitMQ] Connection error:", err);
            // Don't reconnect here - wait for 'close' event
        });

        connection.on("close", () => {
            if (this.connection !== connection) {
                console.log("[RabbitMQ] Stale connection closed");
                return;
            }

            console.error("[RabbitMQ] Connection closed");
            this.channel = null;
            this.connection = null;

            // Notify subscribers that connection is lost
            this.events.emit("disconnected");

            // Schedule reconnection
            this.scheduleReconnect(host);
        });
    }

    private static cleanupFailedConnection(connection: ChannelModel): void {
        if (this.connection === connection) {
            this.channel = null;
            this.connection = null;
        }

        void connection.close().catch((e) => console.error("[RabbitMQ] Failed to close incomplete connection:", e));
    }

    private static scheduleReconnect(host: string): void {
        if (this.isReconnecting) {
            console.log("[RabbitMQ] Reconnection already in progress, skipping");
            return;
        }

        this.isReconnecting = true;
        this.reconnectAttempts++;

        console.log(`[RabbitMQ] Scheduling reconnection attempt ${this.reconnectAttempts} in ${this.BASE_RECONNECT_DELAY_MS}ms`);

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.isReconnecting = false;

            this.connect(host).catch((e) => console.error("[RabbitMQ] Reconnection attempt failed:", e));
        }, this.BASE_RECONNECT_DELAY_MS);
        this.reconnectTimer.unref?.();
    }

    static async getSafeChannel(): Promise<Channel> {
        if (!this.connection) {
            return Promise.reject(new Error("[RabbitMQ] No connection available"));
        }

        // Check if cached channel is still usable
        if (this.channel) {
            // amqplib channels have a 'closed' property when closed
            const isClosed = (this.channel as unknown as { closed?: boolean }).closed;
            if (!isClosed) {
                return this.channel;
            }
            console.log("[RabbitMQ] Cached channel is closed, creating new one");
            this.channel = null;
        }

        try {
            this.channel = await this.connection.createChannel();
            console.log("[RabbitMQ] Channel created");

            this.channel.on("error", (err) => {
                console.error("[RabbitMQ] Channel error:", err);
            });

            this.channel.on("close", () => {
                console.log("[RabbitMQ] Channel closed");
                this.channel = null;
            });

            return this.channel;
        } catch (e) {
            console.error("[RabbitMQ] Failed to create channel:", e);
            this.channel = null;
            throw e;
        }
    }

    /**
     * Check if RabbitMQ is currently connected and ready.
     */
    static isConnected(): boolean {
        return this.connection !== null && !this.isReconnecting;
    }
}
