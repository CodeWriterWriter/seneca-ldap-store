/* Copyright (c) 2013 Alan Bradley, MIT License */
"use strict"

var ldap = require('ldapjs')
var port = 1389

module.exports.PORT = port

module.exports.setupTestLdapServer = function(baseDN, done) {
  var db = {}
  var server = buildLdapServer(db, baseDN) 
  server.listen(port, function() {
    done(null, server, db)
  })
}

// authorization function to be used by all server handlers
function authorize(req, res, next) {
  return next()
}

function buildLdapServer(db, suffix) {
  var server = ldap.createServer()

  server.bind(suffix, function(req, res, next) {
    res.end();
  })

  server.add(suffix, authorize, function(req, res, next) {
    var dn = req.dn.toString()
    db[dn] = req.toObject().attributes
    res.end()
    return next()
  })

  server.del(suffix, authorize, function(req, res, next) {
    var dn = req.dn.toString()

    delete db[dn]

    res.end()
    return next()
  })

  server.search(suffix, authorize, function(req, res, next) {
    var dn = req.dn.toString()

    for(var key in db) {
      if(key.indexOf(dn) != -1) {
        var result = {
          dn: key,
          attributes: db[key]
        }
        res.send(result)
      }
    }

    res.end()
    return next()
  })

  server.modify(suffix, authorize, function(req, res, next) {
    var dn = req.dn.toString()

    if (!req.changes.length)
      return next(new ldap.ProtocolError('changes required'))

    for(var i = 0; i < req.changes.length; i++) {
      var change = req.changes[i]
      var mod = change.modification

      switch(change.operation) {
        case 'replace' :
          if (!db[dn][mod.type])
            return next(new ldap.NoSuchAttributeError(mod.type));

          if (!mod.vals || !mod.vals.length) {
            delete db[dn][mod.type];
          } else {
            db[dn][mod.type] = mod.vals;
          }

          break

        case 'add':
          if (!db[dn][mod.type]) {
            db[dn][mod.type] = mod.vals;
          } else {
            mod.vals.forEach(function(v) {
              db[dn][mod.type] = v
            });
          }
          break

      }
    }
    res.end()
    return next()

  })

  return server
}

