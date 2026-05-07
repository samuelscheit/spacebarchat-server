export interface MfaRequiredResponse {
    message: string;
    code: 60003;
    mfa: {
        ticket: string;
        methods: { type: "password" }[];
    };
}
