/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { route } from "@spacebar/api";
import { TeamMemberState, type ApplicationInstallParams, type TeamMemberRole } from "@spacebar/schemas";
import { Application, DiscordApiErrors, FieldErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { canAccessApplicationBranches } from "../../../util/utility/ApplicationAuthorization";

export type ApplicationVerificationUser = {
    id?: string | null;
    verified?: boolean | null;
    mfa_enabled?: boolean | null;
};

export type ApplicationVerificationTeamMember = {
    user_id?: string | null;
    membership_state: TeamMemberState;
    role: TeamMemberRole;
    user?: ApplicationVerificationUser | null;
};

export type ApplicationVerificationTarget = {
    owner?: { id?: string | null } | null;
    team?: {
        owner_user_id?: string | null;
        owner_user?: ApplicationVerificationUser | null;
        members?: ApplicationVerificationTeamMember[] | null;
    } | null;
    terms_of_service_url?: string | null;
    privacy_policy_url?: string | null;
    install_params?: ApplicationInstallParams | null;
    custom_install_url?: string | null;
};

export type ApplicationVerificationRepository = {
    findOne(options: unknown): Promise<ApplicationVerificationTarget | null>;
};

export type ApplicationVerificationRepositories = {
    applicationRepository?: ApplicationVerificationRepository;
};

type VerificationFieldErrors = Record<string, { code: string; message: string }>;

export const APPLICATION_VERIFICATION_MISSING_TEAM_MESSAGE = "Application verification requires the application to belong to a team.";
export const APPLICATION_VERIFICATION_MISSING_TOS_MESSAGE = "Application verification requires a Terms of Service URL.";
export const APPLICATION_VERIFICATION_MISSING_PRIVACY_POLICY_MESSAGE = "Application verification requires a Privacy Policy URL.";
export const APPLICATION_VERIFICATION_MISSING_INSTALL_LINK_MESSAGE = "Application verification requires install parameters or a custom install URL.";
export const APPLICATION_VERIFICATION_TEAM_MEMBERS_MESSAGE = "Accepted team members must have verified email and MFA enabled.";

function getApplicationRepository(repository?: ApplicationVerificationRepository): ApplicationVerificationRepository {
    return repository ?? (Application as unknown as ApplicationVerificationRepository);
}

function hasNonEmptyString(value: unknown) {
    return typeof value === "string" && value.trim().length > 0;
}

export function hasApplicationInstallLink(application: ApplicationVerificationTarget) {
    if (hasNonEmptyString(application.custom_install_url)) return true;

    const installParams = application.install_params;
    return !!installParams && Array.isArray(installParams.scopes) && installParams.scopes.length > 0 && hasNonEmptyString(installParams.permissions);
}

function hasVerifiedEmailAndMfa(user?: ApplicationVerificationUser | null) {
    return !!user?.verified && !!user.mfa_enabled;
}

export function buildApplicationVerificationEligibilityErrors(application: ApplicationVerificationTarget): VerificationFieldErrors {
    const errors: VerificationFieldErrors = {};

    if (!application.team) {
        errors.team_id = {
            code: "BASE_TYPE_REQUIRED",
            message: APPLICATION_VERIFICATION_MISSING_TEAM_MESSAGE,
        };
    }

    if (!hasNonEmptyString(application.terms_of_service_url)) {
        errors.terms_of_service_url = {
            code: "BASE_TYPE_REQUIRED",
            message: APPLICATION_VERIFICATION_MISSING_TOS_MESSAGE,
        };
    }

    if (!hasNonEmptyString(application.privacy_policy_url)) {
        errors.privacy_policy_url = {
            code: "BASE_TYPE_REQUIRED",
            message: APPLICATION_VERIFICATION_MISSING_PRIVACY_POLICY_MESSAGE,
        };
    }

    if (!hasApplicationInstallLink(application)) {
        errors.install_params = {
            code: "BASE_TYPE_REQUIRED",
            message: APPLICATION_VERIFICATION_MISSING_INSTALL_LINK_MESSAGE,
        };
    }

    const team = application.team;
    if (team) {
        const acceptedMembers = team.members?.filter((member) => member.membership_state === TeamMemberState.ACCEPTED) ?? [];
        const acceptedMembersMeetAccountRequirements = acceptedMembers.every((member) => hasVerifiedEmailAndMfa(member.user));

        if (!hasVerifiedEmailAndMfa(team.owner_user) || !acceptedMembersMeetAccountRequirements) {
            errors.team_members = {
                code: "BASE_TYPE_INVALID",
                message: APPLICATION_VERIFICATION_TEAM_MEMBERS_MESSAGE,
            };
        }
    }

    return errors;
}

export async function getApplicationVerificationEligibility(applicationId: string, userId: string, repositories: ApplicationVerificationRepositories = {}) {
    const applicationRepository = getApplicationRepository(repositories.applicationRepository);
    const application = await applicationRepository.findOne({
        where: { id: applicationId },
        relations: {
            owner: true,
            team: {
                owner_user: true,
                members: {
                    user: true,
                },
            },
        },
        select: {
            owner: {
                id: true,
            },
            team: {
                owner_user_id: true,
                owner_user: {
                    id: true,
                    verified: true,
                    mfa_enabled: true,
                },
                members: {
                    user_id: true,
                    membership_state: true,
                    role: true,
                    user: {
                        id: true,
                        verified: true,
                        mfa_enabled: true,
                    },
                },
            },
            terms_of_service_url: true,
            privacy_policy_url: true,
            install_params: true,
            custom_install_url: true,
        },
    });

    if (!application) throw DiscordApiErrors.UNKNOWN_APPLICATION;
    if (!canAccessApplicationBranches(application, userId)) throw DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION;

    const eligibilityErrors = buildApplicationVerificationEligibilityErrors(application);
    if (Object.keys(eligibilityErrors).length) throw FieldErrors(eligibilityErrors);
}

export function createApplicationVerificationRouter(repositories: ApplicationVerificationRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Application Verification Eligibility",
            description: "Checks if an application is eligible to apply for verification. This endpoint is deprecated.",
            responses: {
                204: {},
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            await getApplicationVerificationEligibility(req.params.application_id as string, req.user_id, repositories);

            return res.sendStatus(204);
        },
    );

    return router;
}

export default createApplicationVerificationRouter();
