import { StageInstancePrivacyLevel } from "../responses/StageInstanceResponse";

export interface StageInstanceModifySchema {
    privacy_level?: StageInstancePrivacyLevel;
}
