import { idleSession } from "./bootstrap/idleSession.js";
import { channelPermissionEdit } from "./channels/channelPermissionEdit.js";
import { experimentContext } from "./experiments/experimentContext.js";
import { expressionPickerBasic } from "./expressions/expressionPickerBasic.js";
import { FeatureScenario } from "./feature.js";
import { roleEditBasic } from "./guilds/roleEditBasic.js";
import { messageSendBasic } from "./messages/messageSendBasic.js";
import { messageDeleteBasic } from "./messages/messageDeleteBasic.js";
import { messageEditBasic } from "./messages/messageEditBasic.js";
import { messagePinBasic } from "./messages/messagePinBasic.js";
import { messageReactionAdd } from "./messages/messageReactionAdd.js";
import { messageReplyBasic } from "./messages/messageReplyBasic.js";
import { messageUploadAttachment } from "./messages/messageUploadAttachment.js";
import { channelSwitch } from "./navigation/channelSwitch.js";
import { dmSwitch } from "./navigation/dmSwitch.js";
import { guildSwitch } from "./navigation/guildSwitch.js";
import { markUnread } from "./readState/markUnread.js";
import { messageAck } from "./readState/messageAck.js";
import { recentMentions } from "./readState/recentMentions.js";
import { memberSearchBasic } from "./search/memberSearchBasic.js";
import { messageSearchBasic } from "./search/messageSearchBasic.js";
import { guildNotificationSettings } from "./settings/guildNotificationSettings.js";
import { threadCreateBasic } from "./threads/threadCreateBasic.js";
import { voiceDeafenToggle } from "./voice/voiceDeafenToggle.js";
import { voiceDisconnectBasic } from "./voice/voiceDisconnectBasic.js";
import { voiceJoinBasic } from "./voice/voiceJoinBasic.js";
import { voiceMuteToggle } from "./voice/voiceMuteToggle.js";

export const builtInScenarios = [
    idleSession,
    channelSwitch,
    guildSwitch,
    dmSwitch,
    messageSendBasic,
    messageEditBasic,
    messageDeleteBasic,
    messageReactionAdd,
    messageReplyBasic,
    messagePinBasic,
    messageUploadAttachment,
    messageAck,
    markUnread,
    recentMentions,
    threadCreateBasic,
    messageSearchBasic,
    memberSearchBasic,
    expressionPickerBasic,
    roleEditBasic,
    channelPermissionEdit,
    guildNotificationSettings,
    voiceJoinBasic,
    voiceDisconnectBasic,
    voiceMuteToggle,
    voiceDeafenToggle,
    experimentContext,
] as const satisfies readonly FeatureScenario[];

export function getBuiltInScenario(id: string): FeatureScenario | undefined {
    return builtInScenarios.find((scenario) => scenario.id === id);
}
