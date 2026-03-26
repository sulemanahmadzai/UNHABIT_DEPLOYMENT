/**
 * Remove undefined values from an object
 * This is useful when working with exactOptionalPropertyTypes
 * where optional properties cannot be explicitly set to undefined
 */
export function removeUndefined<T extends Record<string, any>>(obj: T): T {
    const result: any = {};
    for (const key in obj) {
        if (obj[key] !== undefined) {
            result[key] = obj[key];
        }
    }
    return result as T;
}
