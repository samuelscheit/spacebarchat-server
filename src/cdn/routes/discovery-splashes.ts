import { createHashImageRouter } from "../util/ImageRoute";

export default createHashImageRouter({
    pathPrefix: "discovery-splashes",
    resourceParam: "guild_id",
});
