/**
 * Remove undefined values from an object
 * This is useful when working with exactOptionalPropertyTypes
 * where optional properties cannot be explicitly set to undefined
 */
export function removeUndefined(obj) {
    const result = {};
    for (const key in obj) {
        if (obj[key] !== undefined) {
            result[key] = obj[key];
        }
    }
    return result;
}
//# sourceMappingURL=object.js.map