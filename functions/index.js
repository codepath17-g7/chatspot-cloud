const functions = require('firebase-functions');
const admin = require('firebase-admin');
var _ = require('underscore');
var geodist = require('geodist')

admin.initializeApp(functions.config().firebase);

exports.userLocationUpdate = functions.database.ref('/users/{userId}/location')
.onWrite(event => {
    const dataBase = admin.database()
    const userCord = event.data.val();
    const uid = event.params.userId;
    console.log('userId: ', uid);

    return dataBase.ref('/chatrooms').once("value").then(function(data) {
        var rooms = data.val();
        var maxDist = 1000000; // some very very large number
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

                const aroundMeRef = dataBase.ref('/users/' + uid +'/aroundMe')
                aroundMeRef.once("value").then(function(data) {
                    var leaveRoomPromise = false;

                    roomToLeave = data.val()
                    if(roomToLeave != "") {
                        console.log('Leaving local room: ', roomToLeave);
                        nodeToRemove = dataBase.ref('/chatrooms/' + roomToLeave + '/localUsers').child(uid)
                        const updates = {}
                        updates[nodeToRemove.key] = null
                        leaveRoom = nodeToRemove.parent.update(updates)
                    }

                    console.log('Joining local room: ', roomGuidToJoin, roomToJoin.name);
                    dataBase.ref('/chatrooms/' + roomGuidToJoin + '/localUsers').child(uid).set(true)
                    joinRoomPromise = aroundMeRef.set(roomGuidToJoin)


                    console.log('Writing system message', roomToJoin.name);
                    var newMessageRef = dataBase.ref('aroundme/'+uid).push()
                    systemMessagePromise = newMessageRef.set ({
                        message: "You are now in " + roomToJoin.name,
                        system: true
                    })

                    return Promise.all([leaveRoomPromise, joinRoomPromise, systemMessagePromise])
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
