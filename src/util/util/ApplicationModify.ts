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

import type { ApplicationModifySchema } from "@spacebar/schemas";

interface ApplicationModifyTarget {
    install_params?: ApplicationModifySchema["install_params"];
    assign(props: object): unknown;
}

function cloneInstallParams(installParams: ApplicationModifySchema["install_params"]) {
    if (installParams == null) return installParams;

    return {
        permissions: installParams.permissions,
        scopes: [...installParams.scopes],
    };
}

export function applyApplicationModifySchema<T extends ApplicationModifyTarget>(app: T, body: ApplicationModifySchema) {
    const hasInstallParams = Object.prototype.hasOwnProperty.call(body, "install_params");

    if (hasInstallParams) {
        const { install_params: _installParams, ...bodyWithoutInstallParams } = body;

        app.assign(bodyWithoutInstallParams);
        app.install_params = cloneInstallParams(body.install_params);
    } else {
        app.assign(body);
    }

    return app;
}
