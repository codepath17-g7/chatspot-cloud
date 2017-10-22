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

    return admin.database().ref('/chatrooms').once("value").then(function(data) {
        var rooms = data.val();
        var maxDist = 1000000; // some very very large number
        var roomToJoin = "";
        _.map(rooms, function(roomObj, roomId) {
            var dist = geodist({lat:userCord.lat , lon: userCord.long},
                {lat:roomObj.latitude, lon: roomObj.longitude},
                {unit: 'mi'});

                if(dist < maxDist) {
                    maxDist = dist;
                    roomToJoin = roomId;
                }

                console.log('distance: ', roomId, dist);
            });

            if(roomToJoin !== "") {

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

                    console.log('Joining local room: ', roomToJoin);
                    dataBase.ref('/chatrooms/' + roomToJoin + '/localUsers').child(uid).set(true)
                    joinRoomPromise = aroundMeRef.set(roomToJoin)

                    return Promise.all([leaveRoomPromise, joinRoomPromise])
                })
            }
        });
        // return event.data.ref.parent.child('location').set(event.data.val());
    });

exports.newMessage = functions.database.ref('/messages/{roomId}')
.onCreate(event => {
    const message = event.data.val();
    console.log('roomId: ', roomId);
    console.log('message: ', message);
    console.log('ref: ', event.data.ref);

    // write message to around me stream of other localUsers in that room

    //return event.data.ref.parent.child(roomId).set(event.data.val());
});
