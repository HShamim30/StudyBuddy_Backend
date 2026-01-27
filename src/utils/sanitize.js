/**
 * Lightweight sanitization for user input to prevent injection and ReDoS.
 * Used only in existing endpoints; does not change API contracts.
 */

const MONGO_ID = /^[a-f0-9]{24}$/i;

/** Escape special regex chars in a string to prevent ReDoS / $regex injection */
function escapeRegex(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Return str if it is a non-empty string and a valid 24-char hex Mongo ID; otherwise null */
function asMongoId(str) {
  return typeof str === 'string' && MONGO_ID.test(str) ? str : null;
}

module.exports = { escapeRegex, asMongoId };
