import type { Channel } from "../../src/util/entities/Channel";

type ChannelConstructor = typeof import("../../src/util/entities/Channel").Channel;

function assertRepositoryCreateInfersChannel(ChannelClass: ChannelConstructor, payload: Partial<Channel>) {
    const created = ChannelClass.getRepository().create(payload);

    // This assignment is the regression check: Repository<Channel>.create must
    // return Channel without the explicit generic that BaseEntity.create needed.
    const channel: Channel = created;
    channel.threadOnly();
}

void assertRepositoryCreateInfersChannel;
