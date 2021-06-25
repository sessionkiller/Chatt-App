const mongoose = require('mongoose');

const ticketsSchema = mongoose.Schema({
    _id : String,
    name : String,
    status : String,
    userId : String,
    userName : String,
    companyId : String,
    companyName : String,
    origine : String,
    dateCreation : Date,
    dateLastMessage : Date,
    lastViewedMessages : {},
    messages : [
        {
            _id : String,
            userId : String,
            userName : String,
            ticketId : String,
            text : String,
            dateCreation : Date
        }
    ]

});

module.exports = mongoose.model('tickets', ticketsSchema);