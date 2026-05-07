import { LocationMetadataResponse } from "@spacebar/schemas";

export function buildLocationMetadataResponse(countryCode?: string | null): LocationMetadataResponse {
    return {
        consent_required: false,
        country_code: countryCode ?? null,
        promotional_email_opt_in: { required: true, pre_checked: false },
    };
}
