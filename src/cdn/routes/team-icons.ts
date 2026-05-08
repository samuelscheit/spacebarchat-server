import { createHashImageRouter } from "../util/ImageRoute";

export default createHashImageRouter({
    pathPrefix: "team-icons",
    resourceParam: "guild_id",
});
