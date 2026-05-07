import { createHashImageRouter } from "../util/ImageRoute";

export default createHashImageRouter({
    pathPrefix: "app-icons",
    resourceParam: "guild_id",
});
