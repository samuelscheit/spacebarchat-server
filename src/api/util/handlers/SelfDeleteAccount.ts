import { Guild, Member, User, UserSettingsProtos } from "@spacebar/util";
import { HTTPError } from "lambert-server";

export async function deleteSelfUserAccount(userId: string) {
    const ownedGuilds = await Guild.findOne({ where: { owner_id: userId } });
    if (ownedGuilds) {
        throw new HTTPError("User owns guilds and cannot be deleted", 403);
    }

    const memberships = await Member.find({ where: { id: userId } });
    await UserSettingsProtos.delete({ user_id: userId });
    await Promise.all(memberships.map((member) => Member.removeFromGuild(member.id, member.guild_id)));
    await User.delete({ id: userId });
}
