import { CurrentTokenFormatVersion, type Session, type User } from "@spacebar/util";
import type { TokenPayload } from "../../src/util/util/TokenPayload";
import { makeSession, makeUser } from "./entities";

export interface AuthContext {
    user: User;
    session: Session;
    tokenPayload: TokenPayload;
    authorization: string;
}

export function makeTokenPayload(user: User, session: Session = makeSession(user), overrides: Partial<TokenPayload> = {}): TokenPayload {
    return {
        sub: user.id,
        iat: Math.floor(Date.now() / 1000),
        kid: "fixture-key",
        ver: CurrentTokenFormatVersion,
        did: session.session_id,
        ...overrides,
    };
}

export function expiredLikeTokenPayload(user: User, session: Session = makeSession(user), overrides: Partial<TokenPayload> = {}): TokenPayload {
    return makeTokenPayload(user, session, {
        iat: 0,
        ...overrides,
    });
}

export function makeAuthorization(token: string = invalidToken()) {
    return `Bearer ${token}`;
}

export function invalidToken() {
    return "not-a-valid-jwt";
}

export function makeAuthContext(overrides: Partial<AuthContext> = {}): AuthContext {
    const user = overrides.user ?? makeUser();
    const session = overrides.session ?? makeSession(user);
    const tokenPayload = overrides.tokenPayload ?? makeTokenPayload(user, session);

    return {
        user,
        session,
        tokenPayload,
        authorization: overrides.authorization ?? makeAuthorization(),
    };
}
