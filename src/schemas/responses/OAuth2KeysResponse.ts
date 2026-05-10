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

export type OAuth2JsonWebKeyUse = "sig" | "enc";

export type OAuth2JsonWebKeyOperation = "sign" | "verify" | "encrypt" | "decrypt" | "wrapKey" | "unwrapKey" | "deriveKey" | "deriveBits";

export interface OAuth2JsonWebKey {
    kty: string;
    use?: OAuth2JsonWebKeyUse;
    key_ops?: OAuth2JsonWebKeyOperation[];
    alg?: string;
    kid?: string;
    x5u?: string;
    x5c?: string[];
    x5t?: string;
    "x5t#S256"?: string;
    crv?: string;
    x?: string;
    y?: string;
    n?: string;
    e?: string;
}

export interface OAuth2KeysResponse {
    keys: OAuth2JsonWebKey[];
}
