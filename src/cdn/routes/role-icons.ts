import { STATIC_IMAGE_MIME_TYPES } from "../util/ImageRouteHelpers";
import { createHashImageRouter } from "../util/ImageRoute";

// TODO: check user rights and perks and animated pfp are allowed in the policies
// TODO: generate different sizes of icon

export default createHashImageRouter({
    pathPrefix: "role-icons",
    resourceParam: "role_id",
    allowedMimeTypes: STATIC_IMAGE_MIME_TYPES,
    legacyHashExtensions: ["png", "jpg", "jpeg", "webp", "svg"],
});
