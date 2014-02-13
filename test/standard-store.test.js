/* Copyright (c) 2013 Alan Bradley, MIT License */
"use strict";

var test = require('tap').test
var seneca = require('seneca')
var setup = require('./setup-ldap-server.js').setupTestLdapServer
var PORT =  require('./setup-ldap-server.js').PORT

var shared = seneca.test.store.shared

var si = seneca()
si.use('..', {
  url: 'ldap://127.0.0.1:' + PORT,
  password: 'secret',
  dn: 'cn=root'
})

si.__testcount = 0
var testcount = 0

test('Shared basic tests', function(t) {
  setup(function(err, server, db) {
    testcount++
      shared.basictest(si, function() {
        t.end()
      })
  })
})

test('close test', function(t) {
  setup(function(err, server, db) {
      shared.closetest(si, function() {
        t.end()
      })
  })
})
