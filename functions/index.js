const functions = require('firebase-functions');
const admin = require('firebase-admin');
var _ = require('underscore');
var geodist = require('geodist')

admin.initializeApp(functions.config().firebase);

exports.userLocationUpdate = functions.database.ref('/users/{userId}/location')
    .onWrite(event => {
      const userCord = event.data.val();
      const uid = event.params.userId;
      const dataBase = admin.database()

      admin.database().ref('/chatrooms').once("value", function(data) {
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

          console.log('userId: ', uid);

          if(roomToJoin !== "") {
              const aroundMeRef = dataBase.ref('/users/' + uid +'/aroundMe')
              aroundMeRef.once("value", function(data) {
                   roomToLeave = data.val()
				    if(roomToLeave != "") {
					    console.log('Leavinglocal room: ', roomToLeave);
                        nodeToRemove = dataBase.ref('/chatrooms/' + roomToLeave + '/localUsers').child(uid)
                        const updates = {}
                        updates[nodeToRemove.key] = null
                        nodeToRemove.parent.update(updates)
					}
					console.log('Joining local room: ', roomToJoin);
                    dataBase.ref('/chatrooms/' + roomToJoin + '/localUsers').child(uid).set(true)
                    aroundMeRef.set(roomToJoin)
              })
          }
      });

      return event.data.ref.parent.child('location').set(event.data.val());
});
