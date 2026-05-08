const OPTIONAL_PREFIX = "$";
const EMAIL_REGEX = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

export class Tuple {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public types: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...types: any[]) {
        this.types = types;
    }
}

export class ExactArray {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public types: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...types: any[]) {
        this.types = types;
    }
}

export class Email {
    constructor(public email: string) {}
    check() {
        return !!this.email.match(EMAIL_REGEX);
    }
}

function parseSchemaKey(key: string) {
    const optional = key.startsWith(OPTIONAL_PREFIX);
    let name = optional ? key.slice(OPTIONAL_PREFIX.length) : key;
    let aliases: string[] = [];

    if (name.startsWith("[") && name.includes("]")) {
        const end = name.indexOf("]");
        aliases = name.slice(1, end).split("|").filter(Boolean);
        name = aliases[0] ?? name.slice(end + 1);
    }

    return { optional, name, aliases: aliases.length ? aliases : [name] };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function instanceOf(type: any, value: any, { path = "", optional = false }: { path?: string; optional?: boolean } = {}): boolean {
    if (type == null) return true; // no type was specified

    if (value == null) {
        if (optional) return true;
        throw `${path} is required`;
    }

    switch (type) {
        case String:
            if (typeof value === "string") return true;
            throw `${path} must be a string`;
        case Number:
            value = Number(value);
            if (typeof value === "number" && !isNaN(value)) return true;
            throw `${path} must be a number`;
        case BigInt:
            try {
                value = BigInt(value);
                if (typeof value === "bigint") return true;
            } catch (error) {
                //Ignore BigInt error
            }
            throw `${path} must be a bigint`;
        case Boolean:
            if (value == "true") value = true;
            if (value == "false") value = false;
            if (typeof value === "boolean") return true;
            throw `${path} must be a boolean`;
        case Object:
            if (typeof value === "object" && value !== null) return true;
            throw `${path} must be a object`;
        default:
            break;
    }

    if (typeof type === "object") {
        if (Array.isArray(type)) {
            if (!Array.isArray(value)) throw `${path} must be an array`;
            if (!type.length) return true; // type array didn't specify any type

            return value.every((val, i) => instanceOf(type[0], val, { path: `${path}[${i}]` }));
        }
        if (type?.constructor?.name != "Object") {
            if (type instanceof Tuple) {
                if (
                    (<Tuple>type).types.some((x) => {
                        try {
                            return instanceOf(x, value, { path, optional });
                        } catch (error) {
                            return false;
                        }
                    })
                ) {
                    return true;
                }
                throw `${path} must be one of ${type.types}`;
            }
            if (type instanceof ExactArray) {
                if (!Array.isArray(value)) throw `${path} must be an array`;
                if (value.length !== type.types.length) throw `${path} must have exactly ${type.types.length} items`;

                return (<ExactArray>type).types.every((x, i) => instanceOf(x, value[i], { path: `${path}[${i}]` }));
            }
            if (type instanceof Email) {
                if ((<Email>type).check()) return true;
                throw `${path} is not a valid E-Mail`;
            }
            if (value instanceof type) return true;
            throw `${path} must be an instance of ${type}`;
        }
        if (typeof value !== "object") throw `${path} must be a object`;

        const schemaEntries = Object.keys(type).map((key) => ({ key, ...parseSchemaKey(key) }));
        const filterset = new Set(schemaEntries.flatMap(({ aliases }) => aliases));
        const diff = Object.keys(value).filter((_) => !filterset.has(_));

        if (diff.length) throw `Unknown key ${diff}`;

        return schemaEntries.every(({ key, name, aliases, optional: OPTIONAL }) => {
            const matchingKeys = aliases.filter((alias) => Object.prototype.hasOwnProperty.call(value, alias));

            if (matchingKeys.length > 1) throw `${path}.${name} must only use one of ${aliases.join(", ")}`;

            const newKey = matchingKeys[0] ?? name;

            return instanceOf(type[key], value[newKey], {
                path: `${path}.${newKey}`,
                optional: OPTIONAL,
            });
        });
    } else if (typeof type === "number" || typeof type === "string" || typeof type === "boolean") {
        if (value === type) return true;
        throw `${path} must be ${value}`;
    } else if (typeof type === "bigint") {
        if (BigInt(value) === type) return true;
        throw `${path} must be ${value}`;
    }

    return type == value;
}
