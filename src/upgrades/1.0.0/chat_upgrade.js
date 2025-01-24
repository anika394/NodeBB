'use strict';

const async = require('async');
const winston = require('winston');
const db = require('../../database');

module.exports = {
    name: 'Upgrading chats',
    timestamp: Date.UTC(2015, 11, 15),
    method: function (callback) {
        db.getObjectFields('global', ['nextMid', 'nextChatRoomId'], (err, globalData) => {
            if (err) {
                return callback(err);
            }

            const rooms = {};
            let roomId = globalData.nextChatRoomId || 1;
            let currentMid = 1;

			console.log('Anika Sharma')

            function addMessageToUids(message, roomId, msgTime, currentMid, callback) {
                async.parallel([
                    function (next) { db.sortedSetAdd(`uid:${message.fromuid}:chat:room:${roomId}:mids`, msgTime, currentMid, next); },
                    function (next) { db.sortedSetAdd(`uid:${message.touid}:chat:room:${roomId}:mids`, msgTime, currentMid, next); },
                ], callback);
            }

            function createNewRoom(message, roomId, msgTime, currentMid, rooms, callback) {
				console.log('Anika Sharma')
                async.parallel([
                    function (next) { db.sortedSetAdd(`uid:${message.fromuid}:chat:rooms`, msgTime, roomId, next); },
                    function (next) { db.sortedSetAdd(`uid:${message.touid}:chat:rooms`, msgTime, roomId, next); },
                    function (next) { db.sortedSetAdd(`chat:room:${roomId}:uids`, [msgTime, msgTime + 1], [message.fromuid, message.touid], next); },
                    function (next) { addMessageToUids(message, roomId, msgTime, currentMid, next); },
                ], (err) => {
                    if (!err) {
                        rooms[[message.fromuid, message.touid].sort().join(':')] = roomId;
                        roomId += 1;
                        db.setObjectField('global', 'nextChatRoomId', roomId, callback);
                    } else {
                        callback(err);
                    }
                });
            }

            function processMessage(message, currentMid, roomId, rooms, callback) {
                if (!message) {
                    winston.verbose('skipping chat message ', currentMid);
                    return callback();
                }

                const pairID = [parseInt(message.fromuid, 10), parseInt(message.touid, 10)].sort().join(':');
                const msgTime = parseInt(message.timestamp, 10);

                if (rooms[pairID]) {
                    winston.verbose(`adding message ${currentMid} to existing roomID ${rooms[pairID]}`);
                    addMessageToUids(message, rooms[pairID], msgTime, currentMid, callback);
                } else {
                    winston.verbose(`adding message ${currentMid} to new roomID ${roomId}`);
                    createNewRoom(message, roomId, msgTime, currentMid, rooms, callback);
                }
            }

            function processMessages(currentMid, globalData, callback) {
                async.whilst(
                    function (next) { next(null, currentMid <= globalData.nextMid); },
                    function (next) {
                        db.getObject(`message:${currentMid}`, (err, message) => {
                            if (err) {
                                return next(err);
                            }

                            processMessage(message, currentMid, roomId, rooms, (err) => {
                                if (!err) {
                                    currentMid += 1;
                                }
                                next(err);
                            });
                        });
                    },
                    callback
                );
            }

            processMessages(currentMid, globalData, callback);

			console.log('Anika Sharma')
        });
    },
};