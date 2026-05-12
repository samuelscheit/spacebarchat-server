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

import type { JsonValue } from "./JsonValue";

export interface GooglePlayValidatePurchaseSchema {
    [key: string]: JsonValue | undefined;

    /**
     * @minLength 1
     * @maxLength 4096
     */
    purchase_token: string;
    /**
     * @minLength 1
     * @maxLength 256
     */
    sku_id?: string;
    /**
     * @minLength 1
     * @maxLength 256
     */
    product_id?: string;
    /**
     * @minLength 1
     * @maxLength 256
     */
    package_name?: string;
    /**
     * @minLength 1
     * @maxLength 65536
     */
    purchase_data?: string;
    /**
     * @minLength 1
     * @maxLength 8192
     */
    signature?: string;
    /**
     * @minLength 1
     * @maxLength 256
     */
    subscription_id?: string;
    /**
     * @minLength 1
     * @maxLength 256
     */
    subscription_plan_id?: string;
}
