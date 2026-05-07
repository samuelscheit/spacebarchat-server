import { createHashImageRouter } from "../util/ImageRoute";

export default createHashImageRouter({
    pathPrefix: "channel-icons",
    resourceParam: "guild_id",
});
