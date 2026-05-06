export class UpdateCheckConfiguration {
    enabled: boolean = true;
    repository: string = "spacebarchat/server";
    branch: string = "master";
    intervalSeconds: number = 6 * 60 * 60;
    requestTimeoutSeconds: number = 15;
    lastNotifiedCommit: string | null = null;
}
