export class UpdateCheckConfiguration {
    enabled: boolean = true;
    repository: string = "spacebarchat/server";
    branch: string = "mistress";
    intervalSeconds: number = 6 * 60 * 60;
    requestTimeoutSeconds: number = 15;
    lastNotifiedCommit: string | null = null;
}
