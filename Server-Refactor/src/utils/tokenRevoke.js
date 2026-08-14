// In-memory blacklist JWT до истечения срока (logout / revoke)
const revoked = new Map(); // token -> expMs

function revokeToken(token, expiresInSec = 30 * 24 * 60 * 60) {
    if (!token) return;
    const exp = Date.now() + expiresInSec * 1000;
    revoked.set(token, exp);
    prune();
}

function isTokenRevoked(token) {
    if (!token) return false;
    const exp = revoked.get(token);
    if (!exp) return false;
    if (Date.now() > exp) {
        revoked.delete(token);
        return false;
    }
    return true;
}

function prune() {
    if (revoked.size < 200) return;
    const now = Date.now();
    for (const [t, exp] of revoked) {
        if (now > exp) revoked.delete(t);
    }
}

module.exports = { revokeToken, isTokenRevoked };
