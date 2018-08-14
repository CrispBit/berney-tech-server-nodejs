"use strict";

const mongoose = require('mongoose');
const models = require('../models/models');

const express = require('express');
const router = express.Router();

const { check, validationResult } = require('express-validator/check');

module.exports = function (app, passport) {
    passport.use(new passport.Strategy({
            usernameField: 'email',
            passwordField: 'password',
            session: true,
    },
        function (email, password, done) {
            models.User.findById(email, (err, user) => {
                if (err) {
                    return done(err);
                }
                if (!user) {
                    return done(null, false);
                }
                user.verifyPassword(password).then((success) => {
                    if (success) {
                        return done(null, user);
                    } else {
                        return done("wrong password");
                    }
                }).catch((err) => {
                    return done(err);
                });
            });
        })
    );

    passport.serializeUser(function (user, done) {
        return done(null, user._id);
    });

    passport.deserializeUser(function (_id, done) {
        console.log()
        models.User.findById(_id, function (err, user) {
            delete user.passwordHash;
            done(err, user);
        });
    });

    router.post('/login', function (req, res, next) {
        passport.authenticate('local', function (err, user) {
            if (err) {
                res.status(500).json([err]);
            } else if (!user) {
                res.status(401).json(['user doesn\'t exist']);
            } else {
                req.logIn(user, function (err) {
                    if (err) {
                        return next(err);
                    }
                    return res.status(200).json("OK");
                })
            }
        })(req, res, next);
    });

    router.post('/signup', [
        check('email', 'Email not valid').isEmail(),
        check('firstName', 'First name must be at least length one').isLength({ min: 1 }),
        check('lastName', 'Last name must be at least length one').isLength({ min: 1 }),
        check('password', 'Password must be at least length 6').isLength({ min: 6 })
                        .custom(function (val, { req, loc, path }) {
                            if (val != req.body.confirmPassword) {
                                throw new Error('Passwords don\'t match');
                            } else {
                                return val;
                            }
                        }),
    ], function (req, res) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }
        models.User.hashPassword(req.body.password).then(function (hash) {
            const user = {
                _id: req.body.email,
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                passwordHash: hash,
            };
            models.User.create(user).then((doc) => {
                res.status(200).json("OK");
            });
        });
    });

    router.get('/get', function (req, res) {
        if (req.user) {
            res.status(200).send(req.user);
        } else {
            res.status(200).send("null");
        }
    });

    router.post('/logout', function (req, res, next) {
        req.logOut();
        req.session.destroy(function(err) {
            if (err) {
                res.status(500).json("error logging out");
            } else {
                res.status(200).json("OK");
            }
        });
    });

    return router;
};
