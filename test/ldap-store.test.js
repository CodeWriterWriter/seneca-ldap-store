/* Copyright (c) 2013 Alan Bradley, MIT License */
"use strict"

var test = require('tap').test
var ldap = require('ldapjs')
var setup = require('./setup-ldap-server.js').setupTestLdapServer
var PORT =  require('./setup-ldap-server.js').PORT
var seneca = require('seneca')

function initSeneca() {
  var si = seneca()
  si.use('..', {
    url: 'ldap://127.0.0.1:' + PORT,
    password: 'secret',
    cn: 'cn=root'
  })
  return si
}


test('Write entity to ldap', function(t) {
  setup({}, function(err, server, db) {
    var si = initSeneca()
    var e = si.make$()
    e.dn = 'cn=foo, ou=users, o=example'
    e.objectClass= 'unixUser'
    e.cn = 'ldapjs'
    e.description = 'Created via ldapadd'
    e.save$(function(error, entity) {
      si.close(function(err) {
      })
      server.close()
      t.end()
    })
  })
})

