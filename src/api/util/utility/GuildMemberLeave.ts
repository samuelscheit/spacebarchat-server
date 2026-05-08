import { getRights, Member } from "@spacebar/util";

export function memberRequiresSelfLeaveRight(member: Pick<Member, "joined_by"> | null | undefined) {
    return !member?.joined_by;
}

export async function assertCanSelfLeaveGuild(userId: string, guildId: string) {
    const member = await Member.findOneOrFail({
        where: { id: userId, guild_id: guildId },
        select: { joined_by: true },
    });

    if (memberRequiresSelfLeaveRight(member)) {
        const rights = await getRights(userId);
        rights.hasThrow("SELF_LEAVE_GROUPS");
    }
}
