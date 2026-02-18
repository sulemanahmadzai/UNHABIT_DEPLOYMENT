/**
 * Validation utilities
 */
/**
 * Check if a string is a valid UUID format
 */
export function isValidUUID(str) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
}
/**
 * Validate UUID and throw error if invalid
 */
export function validateUUID(id, fieldName = 'ID') {
    if (!id || !isValidUUID(id)) {
        throw new Error(`Invalid ${fieldName} format`);
    }
}
//# sourceMappingURL=validation.js.map