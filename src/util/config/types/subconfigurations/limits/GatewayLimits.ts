export class GatewayLimits {
    maxMessageSize: number = 15 * 1024;
    rateLimitCount: number = 120;
    rateLimitWindow: number = 60_000;
}
