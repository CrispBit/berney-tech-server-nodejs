"use strict";

const mongoose = require('mongoose');
const models = require('../models/models');

const express = require('express');
const router = express.Router();

const { check, validationResult } = require('express-validator/check');

function checkAccessLevel(req, res, next) {
    if (!req.user || !req.user.accessLevel) {
        res.status(401).send("Not Authorized");
    } else {
        next();
    }
}

router.use(checkAccessLevel);

module.exports = function (app, passport, stripe) {
    router.get('/getUsers', function (req, res) {
        models.User.find(function (err, docs) {
            res.status(200).json(docs);
        });
    });

    return router;
};
