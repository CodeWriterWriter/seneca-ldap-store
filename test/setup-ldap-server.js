"use strict"

var ldap = require('ldapjs')
var port = 1389
var suffix = 'o=example'
var db = {}

module.exports.PORT = port

module.exports.setupTestLdapServer = function(opts, done) {
  db = opts.initialDB || db
  port = opts.suffix || port
  suffix = opts.suffix || suffix

  var server = buildLdapServer() 

  server.listen(port, function() {
    done(null, db)
  })
}

// authorization function to be used by all server handlers
function authorize(req, res, next) {
  if (!req.connection.ldap.bindDN.equals('cn=root'))
    return next(new ldap.InsufficientAccessRightsError())

  return next()
}

function buildLdapServer() {
  var server = ldap.createServer()

  server.bind('cn=root', function(req, res, next) {
    if(req.dn.toString() !== 'cn=root' || req.credentials !== 'secret')
      return next(new ldap.InvalidCredentialsError())

    res.end()
    return next()
  })

  server.bind(suffix, function(req, res, next) {
    var dn = req.dn.toString()
    if (!db[dn])
      return next(new ldap.NoSuchObjectError(dn))

    if (!dn[dn].userpassword)
      return next(new ldap.NoSuchAttributeError('userPassword'))

    if (db[dn].userpassword !== req.credentials)
      return next(new ldap.InvalidCredentialsError())

    res.end()
    return next()
  })

  server.search(suffix, authorize, function(req, res, next) {
    var dn = req.dn.toString()
    if (!db[dn])
      return next(new ldap.NoSuchObjectError(dn))

    if (!dn[dn].userpassword)
      return next(new ldap.NoSuchAttributeError('userPassword'))

    if (db[dn].userpassword !== req.credentials)
      return next(new ldap.InvalidCredentialsError())

    res.end()
    return next()
  })

  server.compare(suffix, authorize, function(req, res, next) {
    var dn = req.dn.toString()
    if (!db[dn])
      return next(new ldap.NoSuchObjectError(dn))

    if (!db[dn][req.attribute])
      return next(new ldap.NoSuchAttributeError(req.attribute))

    var matches = false
    var vals = db[dn][req.attribute]
    for (var i = 0; i < vals.length; i++) {
      if (vals[i] === req.value) {
        matches = true
        break
      }
    }

    res.end(matches)
    return next()
  })

  server.add(suffix, authorize, function(req, res, next) {
    var dn = req.dn.toString()

    if (db[dn])
      return next(new ldap.EntryAlreadyExistsError(dn))

    db[dn] = req.toObject().attributes

    res.end()
    return next()
  })

  server.del(suffix, authorize, function(req, res, next) {
    var dn = req.dn.toString()
    if (!db[dn])
      return next(new ldap.NoSuchObjectError(dn))

    delete db[dn]

    res.end()
    return next()
  })

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

