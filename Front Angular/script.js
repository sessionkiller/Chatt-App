angular.module('ChatApp', [])
.controller('ChatAppCtrl', function($scope){
    $scope.infosChat = {
        origine : 'Home',
        userId : 1,
        userName : 'Najib',
        companyId : 1,
        companyName : 'COPAG'
    };

    $scope.setOrigine = function(origine){
        $scope.infosChat.origine = origine;
    }
})
.factory('chatAppFactory', function($http){
    var chatAppFactory = {

        getData : function(id){

			return $http.get('/data/'+id);
        }
    }

    return chatAppFactory;
})
.directive('chatAppDir', function(){
    return {
        restrict : 'E',
        scope : {
            infosChat : '='
        },
        templateUrl : 'chat-app-dir.html',
        link : function(scope, elem, attrs){
        },
        controller : function($scope, $filter, chatAppFactory){
            $scope.tickets = [];

            $scope.showTickets = true;

            chatAppFactory.getData($scope.infosChat.companyId).then(function(response){
                $scope.tickets = response.data;

                /*if ($scope.tickets.length) {
                    $scope.selectTicket($scope.tickets[0]);
                }*/
            })

            $scope.message = '';

            $scope.disponibilite = false;

            $scope.msgAdditionalInfos = function(msg, otherMsg, type){
                var resBool = false;

                switch(type){
                    case 'owner':
                        if (!otherMsg || msg.userId != otherMsg.userId ) { 
                            resBool = true;
                        }
                        break;

                    case 'date':
                        
                        if (!otherMsg || $filter('date')(msg.dateCreation, 'yyyy-MM-dd') != $filter('date')(otherMsg.dateCreation, 'yyyy-MM-dd')) { 
                            resBool = true;
                        }
                        break;

                    case 'hour':
                        if (!otherMsg || $filter('date')(msg.dateCreation, 'yyyy-MM-ddTHH:mm') != $filter('date')(otherMsg.dateCreation, 'yyyy-MM-ddTHH:mm') ) { 
                            resBool = true;
                        }
                        break;
                }

                return resBool;
            }

            $scope.sendMessage = function(){
                if($scope.message != ''){
                    var ticketId = 'new';
                    if($scope.selectedTicket){
                        ticketId = $scope.selectedTicket._id;
                    }

                    var data = {
                        ticketId : ticketId,
                        userId : $scope.infosChat.userId,
                        userName : $scope.infosChat.userName,
                        companyId : $scope.infosChat.companyId,
                        companyName : $scope.infosChat.companyName,
                        origine : $scope.infosChat.origine,
                        message : $scope.message,
                        lastViewedMessages : (($scope.selectedTicket)? $scope.selectedTicket.lastViewedMessages : null)
                    }

                    socket.emit('new message', data);

                    $scope.message = '';
                }
            }

            $scope.selectedTicket = null;

            $scope.selectTicket = function(ticket){
                $scope.selectedTicket = ticket;
                $scope.showTickets = false;

                $scope.updateLastViewedMessages();

                scrollToBottom();
            }

            $scope.calcUnreadMessages = function(ticket){
                var length = ticket.messages.length;
                var result = 0;

                if (length > 0) {
                    if (!ticket.lastViewedMessages[$scope.infosChat.userId]) {
                        result = length;
                    }
                    var ind = ticket.messages.findIndex(function(item){
                        return item._id == ticket.lastViewedMessages[$scope.infosChat.userId];
                    })

                    if (ind != -1) {
                        result = (length-1 - ind);
                    }
                }

                return (result > 0)? result : '';
            }

            $scope.updateLastViewedMessages = function(){
                var ticket = $scope.selectedTicket;

                if (ticket) {
                    var length = $scope.selectedTicket.messages.length;

                    if (length > 0 && ticket.lastViewedMessages[$scope.infosChat.userId] != $scope.selectedTicket.messages[length-1]._id) {
                        var data = {
                            ticketId : ticket._id,
                            lastViewedMessages : ticket.lastViewedMessages,
                            userId : $scope.infosChat.userId,
                            messageId : $scope.selectedTicket.messages[length-1]._id
                        }
                        socket.emit('update last viewed messages', data);
                    }
                }
                
            }

            function playSound(){
                var audio = new Audio('facebook_chat_2016.mp3');
                audio.play();
            }

            function scrollToBottom(){
                setTimeout(() => {
                    var elem = document.getElementsByClassName('chatApp__messages');
                    elem[0].scrollTop = elem[0].scrollHeight;
                }, 10);
            }

            socket.emit('join', $scope.infosChat);

            socket.on('data received', function(response) {
                console.log(response);

                if (response.data.owner == $scope.infosChat.companyId) {
                    switch(response.type){
                        case 'ticket':
                            var ticket = response.data;
                            $scope.tickets.push(ticket);
                            $scope.selectTicket(ticket);
                            $scope.$apply();
                            break;

                        case 'message':
                            var ticket = $scope.tickets.find(function(item){ return item._id == response.data.ticketId})
                            ticket.messages.push(response.data);

                            for (var i in response.infos_ticket) {
                                ticket[i] = response.infos_ticket[i]; 
                            }
                            
                            $scope.$apply();
                            if (response.data.userId != $scope.infosChat.userId) {
                                playSound();
                            }
                            scrollToBottom();
                            break;

                        case 'status':
                            var ticket = $scope.tickets.find(function(item){ return item._id == response.data._id})
                            ticket.status = response.data.status;
                            $scope.$apply();
                            break;

                        case 'lastViewedMessages':
                            var ticket = $scope.tickets.find(function(item){ return item._id == response.data._id})
                            ticket.lastViewedMessages = response.data.lastViewedMessages;
                            $scope.$apply();
                            break;
                    
                        default:
                            break;
                    }
                }
            });

            socket.on('connected users', function(users){
                var admins = users.filter(function(item){ return item.role == 'admin'});

                var adminDispo = false;

                if (admins.length) {
                    for (var i = 0; i < admins.length; i++) {
                        if (isCompanyAdmin(admins[i].companyId)) {
                            adminDispo = true;
                            break;
                        }
                        
                    }
                }

                $scope.disponibilite = adminDispo;
                $scope.$apply();
            })

            function isCompanyAdmin(companyId){
                var owner = $scope.infosChat.companyId;

                var bool = false;
            
                var type = typeof companyId;
            
                switch(type){
                    case 'number':
                    bool = (companyId == owner)? true : false;
                    break;
            
                    case 'object':
                    let ind = companyId.findIndex(item => item == owner);
                    if (ind !== -1) {
                        bool = true;
                    }
                    break;
            
                    case 'string':
                    if (companyId == 'all') {
                        bool = true;
                    }else{
                        bool = (companyId == owner)? true : false;
                    }
                    break;
                    default:
                    break;
                }
            
                return bool;
            }
        }
    }
})
.filter('lastMessageDateFilter', function($filter){
    return function(date){

        var today = new Date();
        var str_date = '';

        if ($filter('date')(date, 'yyyy-MM-dd') == $filter('date')(today, 'yyyy-MM-dd')) {
            str_date = $filter('date')(date, 'HH:mm');
        }else{
            str_date = $filter('date')(date, 'dd/MM/yyyy');
        }

        return str_date;
    }
})