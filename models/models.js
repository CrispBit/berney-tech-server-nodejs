const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const saltRounds = 10;

const TicketSchema = new mongoose.Schema({
    categories: [String],
    author: {
        type: String,
        ref: "User",
        required: true,
    },
    messages: [{
        type: String,
        ref: "Message",
        required: true,
    }],
})

const Ticket = mongoose.model("Ticket", TicketSchema);

const UserSchema = new mongoose.Schema({
    _id: String, // email
    firstName: String,
    lastName: String,
    passwordHash: String,
    stripeId: String,
    accessLevel: Number,
    tickets: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Ticket",
        required: true,
    }],
});

UserSchema.methods.verifyPassword = function (password) {
    return bcrypt.compare(password, this.passwordHash);
}

UserSchema.statics.hashPassword = function (password) {
    return bcrypt.hash(password, saltRounds);
}

const User = mongoose.model("User", UserSchema);

const MessageSchema = new mongoose.Schema({
    ticketRef: {
        type: String,
        ref: "Ticket",
        required: true,
    },
    author: {
        type: String,
        ref: "User",
        required: true,
    },
    body: String,
});

const Message = mongoose.model("Message", MessageSchema);

module.exports = {
    User,
    Ticket,
    Message,
};
