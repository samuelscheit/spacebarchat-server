import { createHashImageRouter } from "../util/ImageRoute";

export default createHashImageRouter({
    pathPrefix: "app-assets",
    resourceParam: "guild_id",
});
