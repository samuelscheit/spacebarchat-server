import { Rights } from "@spacebar/util";

export function withoutSelfLeaveRight(rights: string) {
    return (BigInt(rights) & ~Rights.FLAGS.SELF_LEAVE_GROUPS).toString();
}
