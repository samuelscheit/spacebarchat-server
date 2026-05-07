import { createHashImageRouter } from "../util/ImageRoute";

export default createHashImageRouter({
    pathPrefix: "discover-splashes",
    resourceParam: "guild_id",
});
