import { filterAccessibleActiveGuildThreads, serializeActiveGuildThreads, route } from "@spacebar/api";
import { Channel, Member, ThreadMember, getPermission } from "@spacebar/util";
import { ChannelType } from "@spacebar/schemas";
import { Request, Response, Router } from "express";
import { In } from "typeorm";

const router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        responses: {
            200: {
                body: "ActiveThreadsResponse",
            },
            403: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { guild_id } = req.params as Record<string, string>;

        await Member.IsInGuildOrFail(req.user_id, guild_id);
        const member = await Member.findOneOrFail({
            where: { id: req.user_id, guild_id },
            select: { index: true },
        });

        const activeThreads = await Channel.find({
            where: {
                guild_id,
                type: In([ChannelType.GUILD_NEWS_THREAD, ChannelType.GUILD_PUBLIC_THREAD, ChannelType.GUILD_PRIVATE_THREAD]),
                thread_metadata: {
                    archived: false,
                },
            },
            order: {
                id: "DESC",
            },
        });

        const activeThreadIds = activeThreads.map((thread) => thread.id);
        const threadMembers = activeThreadIds.length
            ? await ThreadMember.find({
                  where: {
                      member_idx: member.index,
                      id: In(activeThreadIds),
                  },
                  order: {
                      id: "DESC",
                  },
              })
            : [];

        const parentIds = [...new Set(activeThreads.flatMap((thread) => (thread.parent_id ? [thread.parent_id] : [])))];
        const parents = parentIds.length ? await Channel.find({ where: { id: In(parentIds) } }) : [];
        const parentPermissions = new Map(await Promise.all(parents.map(async (parent) => [parent.id, await getPermission(req.user_id, guild_id, parent)] as const)));

        const returnedThreads = filterAccessibleActiveGuildThreads(activeThreads, guild_id, new Set(threadMembers.map((threadMember) => threadMember.id)), parentPermissions);

        return res.json(serializeActiveGuildThreads(returnedThreads, threadMembers));
    },
);

export default router;
