async function parseVerificationResponse(response) {
    if (response.status === 204) {
        return null;
    }

    return response.json();
}

globalThis.parseVerificationResponse = parseVerificationResponse;

if (typeof module !== "undefined") {
    module.exports = { parseVerificationResponse };
}
