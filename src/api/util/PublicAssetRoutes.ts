import { Request, Response } from "express";
import path from "node:path";

type RouteRegistrar = {
    get(path: string, handler: (req: Request, res: Response) => unknown): unknown;
};

export function registerPublicAssetRoutes(app: RouteRegistrar, publicAssetsFolder: string) {
    app.get("/", (req, res) => {
        res.set("Cache-Control", "public, max-age=21600");
        return res.sendFile(path.join(publicAssetsFolder, "index.html"));
    });

    app.get("/verify-email", (req, res) => {
        res.set("Cache-Control", "public, max-age=21600");
        return res.sendFile(path.join(publicAssetsFolder, "verify.html"));
    });

    app.get("/verify-response.js", (req, res) => {
        res.set("Cache-Control", "public, max-age=21600");
        return res.sendFile(path.join(publicAssetsFolder, "verify-response.js"));
    });

    app.get("/widget", (req, res) => {
        res.set("Cache-Control", "public, max-age=21600");
        return res.sendFile(path.join(publicAssetsFolder, "widget.html"));
    });
}
