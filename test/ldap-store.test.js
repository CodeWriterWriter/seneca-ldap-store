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
    dn: 'cn=root'
  })
  return si
}

test('Write entity to ldap', function(t) {
  setup({}, function(err, server, db) {
    var si = initSeneca()
    var e = si.make$()
    var dn = 'cn=foo, ou=users, o=example'
    e.dn = dn 
    e.objectclass= 'unixUser'
    e.cn = 'ldapjs'
    e.description = 'Created via ldapadd'

    e.save$(function(error, entity) {
      t.equal(error, null, 'There should be no error')
      var saved = db[dn]
      // t.equal(saved.objectclass[0], 'unixUser', 'Property should match what was saved')
      si.close(function(err) {
        server.close()
        t.end()
      })
    })
  })
})

test('Delete an entity from ldap', function(t) {
  setup({}, function(err, server, db) {
    var si = initSeneca()
    var e = si.make$()
    var dn = 'cn=foo, ou=users, o=example'

    // add an entry to the db match the dn
    db[dn] = {msg: 'This should be deleted!'}

    e.remove$(dn, function(err){
      t.equal(err, null, 'There should be no error')
      t.equal(db[dn], undefined, 'The entry should nolong exist')
      si.close(function(err) {
        server.close()
        t.end()
      })
    })
  })
})

test('Load an entity from LDAP', function(t) {
  setup({}, function(err, server, db) {
    var si = initSeneca()
    var e = si.make$()
    var dn = 'cn=foo, ou=users, o=example'
    var message = 'entity read from LAP'

    // add an entry to the db match the dn
    db[dn] = {msg: message }

    e.load$(dn, function(err, entity){
      t.equal(entity.msg, message, 'Message in entity should match what is in LDAP')
      si.close(function(err) {
        server.close()
        t.end()
      })
    })
  })
})
