import { Request } from "express";
import type { Message } from "../../../util/entities/Message";
import { NewUrlUserSignatureData } from "../../../util/Signing";

export function messageToResponse(message: Message, req: Request) {
    return message.withSignedAttachments(
        new NewUrlUserSignatureData({
            ip: req.ip,
            userAgent: req.headers["user-agent"] as string,
        }),
    );
}
