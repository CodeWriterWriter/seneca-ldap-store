/* Copyright (c) 2014 Alan Bradley, MIT License */
"use strict"

var name = "ldap-store"
var ldap = require('ldapjs')

module.exports = function(opts) {
  var seneca = this
  var ldapClient = ldap.createClient({
    url: opts.url
  })

  function configure(opts, done) {
    return done(null)
  }

  var store = {
    name: name,

    close: function(done) {
      ldapClient.unbind(function(err) { 
        return done(err)
      })
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
              seneca.log.debug('save/insert',ent)
              return done(err, ent)
            })
          } else {
            done(err, null)
          }
        })

        res.on('searchEntry', function(entry) {
          var changes = []
          var fields = ent.fields$()
          
          for(var i = 0; i < fields.length; i++) {
            var field = fields[i]
            var change = {operation: undefined, modification: {}}

            if(!entry[field]) {
              change.operation = 'add'
            } else if(entry[field] !== ent[field]) {
              change.operation = 'replace'
            }

            if(change.operation) {
              change.modification[field] = ent[field]
              changes.push(change)
            }
          }

          ldapClient.modify(ent.dn, changes, function(err) {
            seneca.log.debug('save/insert',ent)
            return done(err, ent)
          })
        })
      })
    },

    load: function(args, done) {
      var qent = args.qent
      var entp = {}

      ldapClient.search(entq.dn, {}, function(err, res) {
        
        res.on('searchEntry', function(entry) {
          for(prop in entry) {
            entp[prop]  = entry[prop]
          }
          entp.id = entp.dn
          var fent = qent.make$(entp)

          seneca.log.debug('load', fent)
          done(null,fent)
        })

        res.on('error', function(e) {
          seneca.log.debug('load', fent)
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
          seneca.log.debug('list',q,list.length)
          return done(e, null) 
        })

        res.on('end', function(result) {
          seneca.log.debug('list',q,list.length)
          return done(null, list) 
        })

      })
    },

    remove: function(args, done) {
      ldapClient.del(args.ent.id, function(err) {
        return done(err)
      })
    },

    native: function(args, done) {
      done(null, ldapClient)
    }
  }

  var meta = seneca.init(seneca, opts, store)

  seneca.add({init:store.name,tag:meta.tag},function(args,done){
    configure(opts, function(err){
      if(err) {
        return seneca.fail({code:'entity/configure',store:store.name,error:err,desc:desc},done)
      }
      else done()
    })
  })

  return {name:store.name, tag:meta.tag}
}
