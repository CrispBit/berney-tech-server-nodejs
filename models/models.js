const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const saltRounds = 10;

const UserSchema = new mongoose.Schema({
    _id: String, // email
    firstName: String,
    lastName: String,
    passwordHash: String,
});

UserSchema.methods.verifyPassword = function (password) {
    return bcrypt.compare(password, this.passwordHash);
}

UserSchema.statics.hashPassword = function (password) {
    return bcrypt.hash(password, saltRounds);
}

const User = mongoose.model("User", UserSchema);

module.exports = {
    User: User,
};