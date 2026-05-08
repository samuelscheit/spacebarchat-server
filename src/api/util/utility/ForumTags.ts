import { Channel, ErrorList, makeObjectErrorContent, Tag } from "@spacebar/util";
import { TagCreateSchema } from "@spacebar/schemas";
import type { EntityManager } from "typeorm";

export type ForumTagModifyPayload = TagCreateSchema & { id?: string };

type ForumTagChannel = Pick<Channel, "available_tags" | "isForum">;
export type ForumTagPersistenceManager = Pick<EntityManager, "save" | "remove">;

export function getAvailableTagsModifyError(channel: ForumTagChannel, payload: readonly ForumTagModifyPayload[]): ErrorList | undefined {
    if (!channel.isForum()) {
        return {
            available_tags: makeObjectErrorContent("BASE_TYPE_BAD_VALUE", "Available tags can only be set on forum channels"),
        };
    }

    const seenIds = new Set<string>();
    for (const tag of payload) {
        if (tag.id === undefined) continue;
        if (seenIds.has(tag.id)) {
            return {
                available_tags: makeObjectErrorContent("BASE_TYPE_BAD_VALUE", `Duplicate tag id ${tag.id}`),
            };
        }
        seenIds.add(tag.id);
    }

    const currentTagsById = new Set((channel.available_tags ?? []).map((tag) => tag.id));
    const unknownTag = payload.find((tag) => tag.id !== undefined && !currentTagsById.has(tag.id));
    if (unknownTag?.id !== undefined) {
        return {
            available_tags: makeObjectErrorContent("BASE_TYPE_BAD_VALUE", `Unknown tag ${unknownTag.id}`),
        };
    }
}

function assignTagPayload(tag: Tag, payload: ForumTagModifyPayload) {
    tag.name = payload.name;
    tag.moderated = payload.moderated ?? false;
    tag.emoji_id = payload.emoji_id ?? undefined;
    tag.emoji_name = payload.emoji_name ?? undefined;
}

export async function replaceForumAvailableTags(channel: Channel, payload: readonly ForumTagModifyPayload[], manager: ForumTagPersistenceManager): Promise<void> {
    const currentTags = channel.available_tags ?? [];
    const currentTagsById = new Map(currentTags.map((tag) => [tag.id, tag]));
    const nextTags: Tag[] = [];
    const tagsToSave: Tag[] = [];
    const payloadIds = new Set<string>();

    for (const tagPayload of payload) {
        let tag: Tag;

        if (tagPayload.id !== undefined) {
            const existingTag = currentTagsById.get(tagPayload.id);
            if (!existingTag) {
                throw new Error(`Unknown tag ${tagPayload.id}`);
            }
            tag = existingTag;
            payloadIds.add(tagPayload.id);
        } else {
            tag = Tag.create({ channel, channel_id: channel.id });
        }

        assignTagPayload(tag, tagPayload);
        nextTags.push(tag);
        tagsToSave.push(tag);
    }

    const tagsToRemove = currentTags.filter((tag) => !payloadIds.has(tag.id));

    for (const tag of tagsToSave) {
        await manager.save(tag);
    }

    for (const tag of tagsToRemove) {
        await manager.remove(tag);
    }

    channel.available_tags = nextTags;
}
