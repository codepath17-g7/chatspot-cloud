const functions = require('firebase-functions');
const admin = require('firebase-admin');
var _ = require('underscore');
var geodist = require('geodist')

admin.initializeApp(functions.config().firebase);

exports.userLocationUpdate = functions.database.ref('/users/{userId}/location')
    .onWrite(event => {
      const userCord = event.data.val();
      const uid = event.params.userId;
      console.log('userId: ', uid);

      admin.database().ref('/chatrooms').once("value", function(data) {
          var rooms = data.val();
          var maxDist = 1000000; // some very very large number
          var roomToJoin = nil;
          _.map(rooms, function(roomObj, roomId) {
              var dist = geodist({lat:userCord.lat , lon: userCord.long},
                                 {lat:roomObj.latitude, lon: roomObj.longitude},
                                 {unit: 'mi'});

              if(dist < maxDist) {
                  maxDist = dist;
                  roomsToJoin = roomId;
              }

              console.log('distance: ', roomId, dist);
          });

          if(roomToJoin != nil) {
              console.log('joining room: ', roomToJoin);
              admin.database().ref('/chatrooms' + roomToJoin).child('users').set({uid: true});
          }
      });

      return event.data.ref.parent.child('location').set(event.data.val());
});
