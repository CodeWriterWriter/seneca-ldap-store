/* Copyright (c) 2013 Alan Bradley, MIT License */
"use strict"

var ldap = require('ldapjs')
var port = 1389

module.exports.PORT = port

module.exports.setupTestLdapServer = function(opts, done) {
  port = opts.suffix || port
  var db = opts.initialDB || {}
  var suffix = opts.suffix || 'o=example'

  var server = buildLdapServer(db, suffix) 
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

  server.bind('cn=root', function(req, res, next) {
    if(req.dn.toString() !== 'cn=root' || req.credentials !== 'secret') {
      return next(new ldap.InvalidCredentialsError())
    }

    res.end()
    return next()
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
    if(!db[dn]) 
      return next(new ldap.NoSuchObjectError(dn))
    
    var result = {
      dn: dn,
      attributes: db[dn]
    }
    res.send(result)

    res.end()
    return next()
  })

  server.modify(suffix, authorize, function(req, res, next) {
    var dn = req.dn.toString()
    var path = dn.split(',')
    var index = path.length -1
    var node = db 

    if (!req.changes.length)
      return next(new ldap.ProtocolError('changes required'))

    while(index >= 0) {
      var key = path[index].trim()
      node = node[key]

      if(!node)
        return next(new ldap.NoSuchObjectError(dn))

      if(index === 0) {
        for(var i = 0; i < req.changes.length; i++) {
          var change = req.changes[i]
          var mod = change.modification

          switch(change.operation) {
            case 'replace' :
              if (!node[mod.type])
                return next(new ldap.NoSuchAttributeError(mod.type));

              if (!mod.vals || !mod.vals.length) {
                delete node[mod.type];
              } else {
                node[mod.type] = mod.vals;
              }

              break

            case 'add':
              if (!node[mod.type]) {
                node[mod.type] = mod.vals;
              } else {
                mod.vals.forEach(function(v) {
                  if (node[mod.type].indexOf(v) === -1)
                    node[mod.type].push(v);
                });
              }
              break

            case 'delete':
              if (!entry[mod.type])
                return next(new ldap.NoSuchAttributeError(mod.type));

              delete entry[mod.type];

              break
          }
        }
      }
      index--
    }

    res.end()
    return next()

  })

  return server
}

