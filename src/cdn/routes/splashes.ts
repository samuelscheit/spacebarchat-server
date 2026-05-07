import { createHashImageRouter } from "../util/ImageRoute";

export default createHashImageRouter({
    pathPrefix: "splashes",
    resourceParam: "guild_id",
});
