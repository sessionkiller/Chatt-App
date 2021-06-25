const express = require('express')
const app = express()
const http = require('http');
const server = http.createServer(app);
const port = 9000
const { v4: uuidv4 } = require('uuid');
//const { Server } = require("socket.io");
const io = require("socket.io")(server, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  });
const cors = require('cors');
const mongoose = require('mongoose');
const modelTickets = require('./modelTickets');

app.use(express.json());

app.use(cors());

const connection_url = 'mongodb://localhost/support';
mongoose.connect(connection_url, {
  useCreateIndex: true,
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify : false
});

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback () {
  console.log("mongodb connected");
});

const tickets = [];

const createTicket = (userId, userName,companyId, companyName, origine) => {
  let ticket = {};

  ticket.userId = userId;
  ticket.userName = userName;
  ticket.companyId = companyId;
  ticket.companyName = companyName;
  ticket.origine = origine;
  ticket.dateCreation = new Date();
  ticket._id = uuidv4();
  ticket.status = 'In Progress';
  ticket.messages = [];

  return ticket;
}

const createMessage = (userId,userName, ticketId, text) => {
  let message = {};

  message._id = uuidv4();
  message.userId = userId;
  message.userName = userName;
  message.ticketId = ticketId;
  message.text = text;
  message.dateCreation = new Date();

  return message;
}

let users = [];

app.use(express.static('public'));

app.get('/data', (req, res) => {
  //res.json(tickets)

  modelTickets.find((err, data) => {
      if(err){
          res.status(500).send(err)
      }else{
          res.status(200).send(data)
      }
  })
})

app.get('/data/:param', (req, res) => {
  var param = req.params.param;

  var obj_filter = {};

  if (param && param != 'all') {
    if (param.indexOf('[') == 0) {
      obj_filter.companyId = JSON.parse(param);
    }else{
      obj_filter.companyId = param;
    }
  }

  modelTickets.find(obj_filter, (err, data) => {
    if(err){
        res.status(500).send(err)
    }else{
        res.status(200).send(data)
    }
})

  //res.json(tickets.filter(item => item.userId == userId));
})

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('join', (data) => {
    data.socketId = socket.id;
    users.push(data);

    io.emit('connected users', users);
  });

  socket.on('disconnect', () => {
    users = users.filter(item => item.socketId != socket.id);
    
    io.emit('connected users', users);
  });

  socket.on('new message', (data) => {
    var response;
    if(data.ticketId == 'new'){
      var ticket = createTicket(data.userId, data.userName, data.companyId, data.companyName, data.origine);
      var message = createMessage(data.userId, data.userName, ticket.id, data.message);
      ticket.messages.push(message);

      ticket.dateLastMessage = message.dateCreation;
      ticket.lastViewedMessages = {};
      ticket.lastViewedMessages[data.userId] = message._id;
      
      response = {type: 'ticket', data : ticket};
    }else{
      var message = createMessage(data.userId, data.userName, data.ticketId, data.message);

      response = {type: 'message', data : message};
    }

    if(data.ticketId == 'new'){
        modelTickets.estimatedDocumentCount({}, (err, count) => {
            ticket.name = 'Ticket #'+(count+1);

            modelTickets.create(ticket, (err, data) => {
              if(err){
                  console.log(err)
              }else{
                response.data.owner = ticket.companyId;
                  io.emit('data received', response);
              }
            })
        });
        
    }else{
        var obj_update = {};
        obj_update.dateLastMessage = message.dateCreation;
        obj_update.lastViewedMessages = data.lastViewedMessages;
        obj_update.lastViewedMessages[data.userId] = message._id;

        modelTickets.findOneAndUpdate({_id: data.ticketId}, {$push:{messages : message}, $set:obj_update}, {new: true}, (err, doc) => {
            if (err) {
                console.log("Something wrong when updating data!");
            }else{
                response.data.owner = doc.companyId;
                response.infos_ticket = {
                  dateLastMessage : doc.dateLastMessage,
                  lastViewedMessages : doc.lastViewedMessages
                }
                io.emit('data received', response);
            }
            
            
            //console.log(doc);
        });
    }
    
  });

  socket.on('change status', (data) => {
    var response;

    var status = {
      _id : data.ticketId,
      status : data.status
    }

    response = {type: 'status', data : status};
    
    modelTickets.findOneAndUpdate({_id: data.ticketId}, {$set:{status : data.status}}, {new: true}, (err, doc) => {
        if (err) {
            console.log("Something wrong when updating data!");
        }else{
            response.data.owner = doc.companyId;
            io.emit('data received', response);
        }
        
    });
  });

  socket.on('update last viewed messages', (data) => {

    var response = {type: 'lastViewedMessages'};
    
    var obj_update = {};
    obj_update.lastViewedMessages = data.lastViewedMessages;
    obj_update.lastViewedMessages[data.userId] = data.messageId;

    modelTickets.findOneAndUpdate({_id: data.ticketId}, {$set:obj_update}, {new: true}, (err, doc) => {
        if (err) {
            console.log("Something wrong when updating data!");
        }else{
            response.data = {
              _id : data.ticketId,
              lastViewedMessages : doc.lastViewedMessages,
              owner : doc.companyId
            };
            io.emit('data received', response);
        }
        
    });
  });

});

server.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})