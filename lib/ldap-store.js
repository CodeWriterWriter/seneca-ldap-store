/* Copyright (c) 2014 Alan Bradley, MIT License */
"use strict"

var name = 'ldap-store'
var ldap = require('ldapjs')

module.exports = function(opts) {
  var seneca = this
  var desc
  var ldapClient = ldap.createClient({
    url: opts.url || 'ldap://localhost:1389'
  })

  function configure(opts, done) {
    var dn = opts.dn || 'cn=root'
    var password = opts.password || ''
    ldapClient.bind(dn, password, done)
  }

  var store = {
    name: name,

    close: function(opts, done) {
      ldapClient.unbind(done)
    },

    save: function(args, done) {
      var ent = args.ent

      ldapClient.search(ent.dn, {}, function(e1, res){
        res.on('error', function(err) {
          if(err.name === 'NoSuchObjectError') {
            var attributes = {}

            var fields = ent.fields$().forEach(function(field) {
              if(field !== 'id')
                attributes[field] = ent[field]
            })

            ldapClient.add(ent.dn, attributes, function(err) {
              ent.id = ent.dn
              seneca.log.debug('save/insert',ent, desc)
              return done(err, ent)
            })
          } else {
            done(err, null)
          }
        })

        res.on('searchEntry', function(entry) {
          var ldapEntry = entry.object
          var changes = []
          var fields = ent.fields$()
          
          for(var i = 0; i < fields.length; i++) {
            var field = fields[i]
            var change = {operation: undefined, modification: {}}

            if(!ldapEntry[field]) {
              change.operation = 'add'
            } else if(ldapEntry[field] !== ent[field]) {
              change.operation = 'replace'
            }

            if(change.operation) {
              if(ent[field])
                change.modification[field] = ent[field]
              else
                delete ent[field]

              changes.push(change)
            }
          }

          ldapClient.modify(ent.dn, changes, function(err) {
            seneca.log.debug('save/insert',ent, desc)
            return done(err, ent)
          })
        })
      })
    },

    load: function(args, done) {
      var q = args.q
      var qent = args.qent
      var entp = {}

      ldapClient.search(q.id, {}, function(err, res) {
        
        res.on('searchEntry', function(entry) {
          var ldapEntity = entry.object
          for(var prop in ldapEntity) {
            entp[prop]  = ldapEntity[prop]
          }

          entp.id = entp.dn
          var fent = qent.make$(entp)
          seneca.log.debug('load', fent, desc)
          done(null,fent)
        })

        res.on('error', function(e) {
          seneca.log.debug('load', desc)
          return done(e, null)
        })
      })
    },

    list: function(args, done) {
      var qent = args.qent
      var q = args.q
      var base = q.base
      delete q.base
      var list = []

      ldapClient.search(base, q, function(err, res) {

        res.on('searchEntry', function(entry) {
          var fent = qent.make$(entry) 
          fent.id = fent.dn
          list.push(fent)
        })

        res.on('error', function(e) {
          seneca.log.debug('list',q,list.length, desc)
          return done(e, null) 
        })

        res.on('end', function(result) {
          seneca.log.debug('list',q,list.length, desc)
          return done(null, list) 
        })

      })
    },

    remove: function(args, done) {
      ldapClient.del(args.q.id, function(err) {
        return done(err)
      })
    },

    native: function(args, done) {
      done(null, ldapClient)
    }
  }

  var meta = seneca.store.init(seneca, opts, store)
  desc = meta.desc

  seneca.add({init:store.name, tag:meta.tag}, function(args, done){
    configure(opts, function(err){
      if(err) {
        return seneca.fail({code:'entity/configure', store:store.name, error:err, desc:desc}, done)
      }
      else done()
    })
  })

  return {name:store.name, tag:meta.tag}
}
