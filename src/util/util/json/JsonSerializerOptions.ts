export type JsonSerializerReplacer = ((this: unknown, key: string, value: unknown) => unknown) | (number | string)[] | null;
export type JsonSerializerReviver = (this: unknown, key: string, value: unknown) => unknown;

export class JsonSerializerOptions {
    public replacer?: JsonSerializerReplacer;
    public reviver?: JsonSerializerReviver;
    public space?: string | number;

    public constructor(options?: Partial<JsonSerializerOptions>) {
        Object.assign(this, options);
    }
}
