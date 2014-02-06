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
  if (!req.connection.ldap.bindDN.equals('cn=root'))
    return next(new ldap.InsufficientAccessRightsError())

  return next()
}

function buildLdapServer(db, suffix) {
  var server = ldap.createServer()

  server.bind('cn=root', function(req, res, next) {
    if(req.dn.toString() !== 'cn=root' || req.credentials !== 'secret')
      return next(new ldap.InvalidCredentialsError())

    res.end()
    return next()
  })

  server.add(suffix, authorize, function(req, res, next) {
    var dn = req.dn.toString()
    var path = dn.split(',')
    var index = path.length -1
    var node = db 

    while(index >= 0) {
      var key = path[index].trim()
      if(!node[key] && index > 0)
        node[key] = []
      else if(index === 0)
        node[key] = req.toObject().attributes

      node = node[key]
      index--
    }
    res.end()
    return next()
  })

  server.del(suffix, authorize, function(req, res, next) {
    var dn = req.dn.toString()
    var path = dn.split(',')
    var index = path.length -1
    var node = db

    while(index > 0) {
      var key = path[index].trim()
      node = node[key]

      if(!node)
        return next(new ldap.NoSuchObjectError(dn))

      if(index === 1) {
        delete node[path[0].trim()]
      }

      node = node[key]

      index--
    }

    res.end()
    return next()
  })

  server.search(suffix, authorize, function(req, res, next) {
    var dn = req.dn.toString()
    var path = dn.split(',')
    var index = path.length -1
    var node = db 

    while(index >= 0) {
      var key = path[index].trim()

      if(!node){
        return next(new ldap.NoSuchObjectError(dn))
      }

      if(index === 0) {
        var result = {
          dn: dn,
          attributes: node[path[0].trim()]
        }
        res.send(result)
      }

      node = node[key]

      index--
    }

    res.end()
    return next()
  })

  // server.compare(suffix, authorize, function(req, res, next) {
  //   var dn = req.dn.toString()
  //   if (!db[dn])
  //     return next(new ldap.NoSuchObjectError(dn))

  //   if (!db[dn][req.attribute])
  //     return next(new ldap.NoSuchAttributeError(req.attribute))

  //   var matches = false
  //   var vals = db[dn][req.attribute]
  //   for (var i = 0; i < vals.length; i++) {
  //     if (vals[i] === req.value) {
  //       matches = true
  //       break
  //     }
  //   }

  //   res.end(matches)
  //   return next()
  // })

  server.modify(suffix, authorize, function(req, res, next) {
    var dn = req.dn.toString()
    if (!req.changes.length)
      return next(new ldap.ProtocolError('changes required'))
    if (!db[dn])
      return next(new ldap.NoSuchObjectError(dn))

    var entry = db[dn]

    for (var i = 0; i < req.changes.length; i++) {
      mod = req.changes[i].modification
      switch (req.changes[i].operation) {
        case 'replace':
          if (!entry[mod.type])
            return next(new ldap.NoSuchAttributeError(mod.type))

          if (!mod.vals || !mod.vals.length) {
            delete entry[mod.type]
          } else {
            entry[mod.type] = mod.vals
          }

          break

        case 'add':
          if (!entry[mod.type]) {
            entry[mod.type] = mod.vals
          } else {
            mod.vals.forEach(function(v) {
              if (entry[mod.type].indexOf(v) === -1)
                entry[mod.type].push(v)
            })
          }

          break

        case 'delete':
          if (!entry[mod.type])
            return next(new ldap.NoSuchAttributeError(mod.type))

          delete entry[mod.type]

          break
      }
    }

    res.end()
    return next()
  })


  return server
}

