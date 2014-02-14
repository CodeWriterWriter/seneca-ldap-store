/* Copyright (c) 2013 Alan Bradley, MIT License */
"use strict"

var test = require('tap').test
var ldap = require('ldapjs')
var setup = require('./setup-ldap-server.js').setupTestLdapServer
var PORT =  require('./setup-ldap-server.js').PORT
var seneca = require('seneca')
var baseDN = 'cn=foo, ou=users, o=example'

function initSeneca() {
  var si = seneca()
  si.use('..', {
    url: 'ldap://127.0.0.1:' + PORT,
    baseDN: baseDN
  })
  return si
}

test('Write entity to ldap', function(t) {
  setup(baseDN, function(err, server, db) {
    var si = initSeneca()
    var e = si.make$('somezone')
    e.objectclass= 'unixUser'
    e.cn = 'ldapjs'
    e.description = 'Created via ldapadd'

    e.save$(function(error, entity) {
      t.equal(error, null, 'There should be no error')
      si.close(function(err) {
        server.close()
        t.end()
      })
    })
  })
})

test('Delete an entity from ldap', function(t) {
  setup(baseDN, function(err, server, db) {
    var si = initSeneca()
    var e = si.make$()
    var dn = 'cn=12, ' + baseDN

    // add an entry to the db match the dn
    db[dn] = {msg: 'This should be deleted!'}

    e.remove$(dn, function(err){
      t.equal(err, null, 'There should be no error')
      // t.equal(db[dn], undefined, 'The entry should nolong exist')
      si.close(function(err) {
        server.close()
        t.end()
      })
    })
  })
})

test('Load an entity from LDAP', function(t) {
  setup(baseDN, function(err, server, db) {
    var si = initSeneca()
    var e = si.make$()
    var dn = 'cn=12, ' + baseDN
    var message = 'entity read from LAP'

    // add an entry to the db match the dn
    db[dn] = {msg: message }

    e.load$('12', function(err, entity){
      t.equal(entity.msg, message, 'Message in entity should match what is in LDAP')
      si.close(function(err) {
        server.close()
        t.end()
      })
    })
  })
})

test('Test modify entity', function(t) {
  setup(baseDN, function(err, server, db) {
    var si = initSeneca()
    var dn = 'cn=12, ' + baseDN

    db[dn] = {message: 'Old message', propToDelete: 'Should be gone'}

    var e = si.make$()
    e.id = '12'
    e.message = 'Changed'
    e.newProp = 'NewProp msg'
    e.propToDelete = null 

    e.save$(function(error, entity) {
      t.equal(error, null, 'There should be no error')
      t.equal(entity.message, 'Changed', 'Message should have been updated')
      t.equal(entity.newProp, 'NewProp msg', 'New property should have been added')
      t.equal(entity.propToDelete, undefined, 'Property should no longer exist')
      si.close(function(err) {
        server.close()
        t.end()
      })
    })
  })
})

test('List entities from LDAP', function(t) {
  setup(baseDN, function(err, server, db) {
    var si = initSeneca()
    var e = si.make$()
    var dn1 = 'cn=11, ' + baseDN
    var dn2 = 'cn=12, ' + baseDN
    var message = 'entity read from LAP'

    // add an entry to the db match the dn
    db[dn1] = {msg: message }
    db[dn2] = {msg: message }

    e.list$({id:'12', name:'testing'}, function(err, list){
      t.equal(err, null, 'There should be no error')
      t.equal(2, list.length, 'Should have two entities in the list')
      t.equal(list[0].msg, message, 'First Entity Message should match what is in LDAP')
      t.equal(list[1].msg, message, 'Second Entity Message should match what is in LDAP')
      si.close(function(err) {
        server.close()
        t.end()
      })
    })
  })
})
