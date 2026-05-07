import { Router } from "express";
import { API_PREFIXES } from "../../util/util/ApiVersions";

export { API_PREFIXES };

interface ApiMountTarget {
    use(path: string, router: Router): unknown;
}

export function mountApiRouter(app: ApiMountTarget, api: Router) {
    for (const prefix of API_PREFIXES) {
        app.use(prefix, api);
    }
}
