const functions = require('firebase-functions');
const admin = require('firebase-admin');
var _ = require('underscore');
var geodist = require('geodist')

admin.initializeApp(functions.config().firebase);

function joinRoom(userIdToJoin, roomId, roomName) {
    var leaveRoomPromise = false;
    const dataBase = admin.database()

    const aroundMeRef = dataBase.ref('/users/' + userIdToJoin +'/aroundMe')
    return aroundMeRef.once("value").then(function(data) {
        roomToLeave = data.val()
        if (roomToLeave == roomId) {
            console.log('Already in room: ', roomId);
            return
        }
        leaveRoomPromise = false
        if(roomToLeave != "") {
            console.log('Leaving local room: ', roomToLeave);
            nodeToRemove = dataBase.ref('/chatrooms/' + roomToLeave + '/localUsers').child(userIdToJoin)
            const updates = {}
            updates[nodeToRemove.key] = null
            leaveRoomPromise = nodeToRemove.parent.update(updates)
        } else {
            console.log('No room to leave')
        }
        console.log('Joining local room: ', roomId, roomName);
        dataBase.ref('/chatrooms/' + roomId + '/localUsers').child(userIdToJoin).set(true)
        joinRoomPromise = aroundMeRef.set(roomId)

        console.log('Writing system message', roomName);
        var newMessageRef = dataBase.ref('aroundme/'+userIdToJoin).push()
        systemMessagePromise = newMessageRef.set ({
            message: roomName,
            system: true
        });

        return Promise.all([joinRoomPromise, leaveRoomPromise, systemMessagePromise])
    });
}

exports.userLocationUpdate = functions.database.ref('/users/{userId}/location')
.onWrite(event => {
    const dataBase = admin.database()
    const userCord = event.data.val();
    const uid = event.params.userId;
    console.log('userId: ', uid);

    return dataBase.ref('/chatrooms').once("value").then(function(data) {
        var rooms = data.val();
        var maxDist = 1; // some very very large number
        var roomGuidToJoin = "";
        var roomToJoin;
        _.map(rooms, function(roomObj, roomId) {
            var dist = geodist({lat:userCord.lat , lon: userCord.long},
                {lat:roomObj.latitude, lon: roomObj.longitude},
                {unit: 'mi'});

                if(dist < maxDist) {
                    maxDist = dist;
                    roomGuidToJoin = roomId;
                    roomToJoin = roomObj
                }

                console.log('distance: ', roomId, dist);
            });



            if(roomGuidToJoin !== "") {
                return joinRoom(uid, roomGuidToJoin, roomToJoin.name)
            } else {
                console.log('No room near by, checking users')
                var userIdToJoin = "";
                var userToJoin;

                // check for other users
                return dataBase.ref('/users').once("value").then(function(data) {
                    var users = data.val()
                    _.map(users, function(userObj, userId) {
                        if (uid == userId || typeof userObj.location == 'undefined' || typeof userObj.location.lat == 'undefined') {
                            console.log('Ignoring ', userId)
                        } else {
                            console.log('User ', userObj.location.lat, userObj.location.long)
                            var dist = geodist({lat:userCord.lat , lon: userCord.long},
                                {lat:userObj.location.lat, lon: userObj.location.long},
                                {unit: 'mi'});
                            console.log('Distance ',userId, dist)

                            if(dist < maxDist) {
                                maxDist = dist;
                                userIdToJoin = userId;
                                userToJoin = userObj
                            }
                        }
                    });
                    console.log('Joining ', userIdToJoin, userToJoin)
                    if (userIdToJoin != "") {
                        // create the room
                        newRoomRef = dataBase.ref("chatrooms").push()
                        newRoomDetail = {}
                        newRoomDetail.name = "Halfmoon Bay" // to do find good name
                        newRoomDetail.banner = "https://firebasestorage.googleapis.com/v0/b/chatspot-ab2bf.appspot.com/o/chatRoomBanners%2Fhalfmoonbay%20small.jpeg?alt=media&token=846b7619-70be-434a-8bc0-9f0bc6e8ec12"
                        newRoomDetail.localUsers = {}
                        newRoomDetail.localUsers[uid] = true
                        newRoomDetail.localUsers[userIdToJoin] = true
                        newRoomDetail.longitude = userCord.long
                        newRoomDetail.latitude = userCord.lat
                        console.log('New Room ', newRoomRef.key, newRoomDetail)
                        newRoomPromise = newRoomRef.set(newRoomDetail)

                        user1Promise = joinRoom(uid, newRoomRef.key, newRoomDetail.name)
                        user2Promise = joinRoom(userIdToJoin, newRoomRef.key, newRoomDetail.name)
                        return Promise.all([newRoomPromise, user1Promise, user2Promise])
                    }
                })
            }
        });
    });

exports.newMessage = functions.database.ref('/messages/{roomId}/{messageId}')
.onCreate(event => {
    const dataBase = admin.database()
    const message = event.data.val();
    // const uid = event.params.userId;
    const roomId = event.params.roomId
    const messageId = event.params.messageId

    console.log('roomId: ' + roomId + ' messageId ', messageId);
    console.log('message: ', message);

    // write message to around me stream of other localUsers in that room
    return dataBase.ref('/chatrooms/'+roomId+'/localUsers').once("value").then(function(localUsers) {
        console.log('localUsers: ', localUsers.val());
        if (!localUsers.exists() || localUsers.numChildren()==0) {
            console.log('No local users')
            return;
        }

        const updates = []
        localUsers.forEach(function(localUser){
            console.log('Adding to : ', localUser.key);
            updates.push(dataBase.ref('aroundme/'+localUser.key).child(messageId).set(message))
        });
        return Promise.all(updates)
    });
});
