import { getRights, Member } from "@spacebar/util";

export function memberRequiresSelfLeaveRight(member: Pick<Member, "joined_by"> | null | undefined) {
    return !member?.joined_by;
}

export async function assertCanSelfLeaveGuild(userId: string, guildId: string) {
    const member = await Member.findOneOrFail({
        where: { id: userId, guild_id: guildId },
        // TypeORM cannot hydrate a Member from a partial select unless the
        // generated primary key is included. Without this field, existing
        // memberships are reported as missing and self-leave denial returns 404
        // before the SELF_LEAVE_GROUPS right can be checked.
        select: { index: true, joined_by: true },
    });

    if (memberRequiresSelfLeaveRight(member)) {
        const rights = await getRights(userId);
        rights.hasThrow("SELF_LEAVE_GROUPS");
    }
}
