import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

type OpenApiDocument = {
    paths: Record<
        string,
        Record<
            string,
            {
                responses: Record<
                    string,
                    {
                        content: {
                            "application/json": {
                                schema: { $ref: string };
                            };
                        };
                    }
                >;
            }
        >
    >;
    components: {
        schemas: Record<string, { required?: string[] }>;
    };
};

describe("user invite route metadata", () => {
    test("declares the create user invite route", () => {
        const openapi = JSON.parse(readFileSync("assets/openapi.json", "utf8")) as OpenApiDocument;

        assert.deepEqual(Object.keys(openapi.paths["/users/@me/invites/"]).sort(), ["post"]);
        assert.equal(openapi.paths["/users/@me/invites/"].post.responses["201"].content["application/json"].schema.$ref, "#/components/schemas/UserInviteResponse");

        const userInviteResponse = openapi.components.schemas.UserInviteResponse;
        assert.ok(userInviteResponse);
        assert.equal(userInviteResponse.required?.includes("guild"), false);
        assert.equal(userInviteResponse.required?.includes("guild_id"), false);
        assert.equal(userInviteResponse.required?.includes("channel"), false);
        assert.equal(userInviteResponse.required?.includes("channel_id"), false);
        assert.ok(openapi.paths["/invites/{invite_code}"].delete);
        assert.equal(openapi.paths["/invites/{invite_code}"].delete.responses["200"].content["application/json"].schema.$ref, "#/components/schemas/Invite");
        assert.equal(openapi.paths["/invites/{invite_code}"].post.responses["200"].content["application/json"].schema.$ref, "#/components/schemas/InviteResponse");
    });
});
