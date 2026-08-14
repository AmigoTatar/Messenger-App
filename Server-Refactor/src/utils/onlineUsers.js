/**
 * userId -> Set<socketId>
 * Поддержка нескольких устройств (web + APK) одновременно.
 */
const onlineUsers = new Map();

function addOnlineUser(userId, socketId) {
    const id = Number(userId);
    if (!id || !socketId) return;
    if (!onlineUsers.has(id)) {
        onlineUsers.set(id, new Set());
    }
    onlineUsers.get(id).add(socketId);
}

function removeOnlineUser(userId, socketId) {
    const id = Number(userId);
    const set = onlineUsers.get(id);
    if (!set) return false;
    set.delete(socketId);
    if (set.size === 0) {
        onlineUsers.delete(id);
        return true; // полностью оффлайн
    }
    return false;
}

function getOnlineSockets(userId) {
    const set = onlineUsers.get(Number(userId));
    return set ? [...set] : [];
}

function isUserOnline(userId) {
    return getOnlineSockets(userId).length > 0;
}

/** Отправить событие на все устройства пользователя */
function emitToUser(io, userId, event, data) {
    for (const sid of getOnlineSockets(userId)) {
        io.to(sid).emit(event, data);
    }
}

/** Подписать все сокеты пользователя на комнату */
function joinUserToRoom(io, userId, roomName) {
    for (const sid of getOnlineSockets(userId)) {
        const sock = io.sockets.sockets.get(sid);
        if (sock) sock.join(roomName);
    }
}

/** Отписать все сокеты пользователя от комнаты */
function leaveUserFromRoom(io, userId, roomName) {
    for (const sid of getOnlineSockets(userId)) {
        const sock = io.sockets.sockets.get(sid);
        if (sock) sock.leave(roomName);
    }
}

module.exports = {
    onlineUsers,
    addOnlineUser,
    removeOnlineUser,
    getOnlineSockets,
    isUserOnline,
    emitToUser,
    joinUserToRoom,
    leaveUserFromRoom,
};
