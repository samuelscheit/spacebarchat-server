import { constants as zlibConstants, createInflate, Inflate } from "node:zlib";

const zlibStreamFlushMarker = Buffer.from([0x00, 0x00, 0xff, 0xff]);

export class GatewayZlibStreamDecoder {
    private readonly inflate: Inflate = createInflate({
        flush: zlibConstants.Z_SYNC_FLUSH,
        finishFlush: zlibConstants.Z_SYNC_FLUSH,
    });
    private buffered = Buffer.alloc(0);
    private queue = Promise.resolve();
    private closed = false;

    decodeBase64(payloadData: string): Promise<string | undefined> {
        return this.decodeBuffer(Buffer.from(payloadData, "base64"));
    }

    decodeBuffer(frame: Buffer): Promise<string | undefined> {
        const next = this.queue.then(() => this.decodeFrame(frame));
        this.queue = next.then(
            () => undefined,
            () => undefined,
        );
        return next;
    }

    close(): void {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this.inflate.close();
    }

    private async decodeFrame(frame: Buffer): Promise<string | undefined> {
        if (this.closed || frame.length === 0) {
            return undefined;
        }

        this.buffered = this.buffered.length === 0 ? Buffer.from(frame) : Buffer.concat([this.buffered, frame]);
        if (!endsWithBuffer(this.buffered, zlibStreamFlushMarker)) {
            return undefined;
        }

        const compressed = this.buffered;
        this.buffered = Buffer.alloc(0);
        try {
            return await this.inflatePayload(compressed);
        } catch {
            return undefined;
        }
    }

    private inflatePayload(payload: Buffer): Promise<string> {
        const chunks: Buffer[] = [];
        return new Promise((resolve, reject) => {
            let settled = false;
            const cleanup = () => {
                this.inflate.off("data", onData);
                this.inflate.off("error", onError);
            };
            const rejectOnce = (error: Error) => {
                if (settled) {
                    return;
                }
                settled = true;
                cleanup();
                reject(error);
            };
            const resolveOnce = () => {
                if (settled) {
                    return;
                }
                settled = true;
                cleanup();
                resolve(Buffer.concat(chunks).toString("utf8"));
            };
            const onData = (chunk: Buffer) => {
                chunks.push(Buffer.from(chunk));
            };
            const onError = (error: Error) => {
                rejectOnce(error);
            };

            this.inflate.on("data", onData);
            this.inflate.once("error", onError);
            this.inflate.write(payload, (writeError) => {
                if (writeError) {
                    rejectOnce(writeError);
                    return;
                }
                this.inflate.flush(zlibConstants.Z_SYNC_FLUSH, () => {
                    resolveOnce();
                });
            });
        });
    }
}

function endsWithBuffer(value: Buffer, suffix: Buffer): boolean {
    if (value.length < suffix.length) {
        return false;
    }

    return suffix.every((byte, index) => value[value.length - suffix.length + index] === byte);
}
