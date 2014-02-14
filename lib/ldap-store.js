/* Copyright (c) 2014 Alan Bradley, MIT License */
"use strict"

var name = 'ldap-store'
var ldap = require('ldapjs')
var uuid = require('uuid')

module.exports = function(opts) {
  var seneca = this
  var baseDN = opts.baseDN
  var desc

  var ldapClient = ldap.createClient({
    url: opts.url || 'ldap://localhost:1389'
  })

  function configure(opts, done) {
    var password = opts.password || ''

    ldapClient.bind(baseDN, password, done)
  }

  function constructDN(id, ent) {
    return 'cn=' + id + ', ' + baseDN
  }

  var store = {
    name: name,

    close: function(opts, done) {
      ldapClient.unbind(done)
    },

    save: function(args, done) {
      var ent = args.ent

      if(ent.id) {
        // modify
        var dn = constructDN(ent.id, ent) 
        ldapClient.search(dn, {}, function(e1, res){
          res.on('error', function(err) {
            done(err, null)
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

            ldapClient.modify(dn, changes, function(err) {
              seneca.log.debug('save/insert',ent, desc)
              return done(err, ent)
            })
          })
        })
      } else {
        // add
        ent.id = uuid()
        ent.cn = ent.id
        var attributes = {}

        var fields = ent.fields$().forEach(function(field) {
          attributes[field] = ent[field]
        })

        ldapClient.add(baseDN, attributes, function(err) {
          seneca.log.debug('save/insert',ent, desc)
          return done(err, ent)
        })
      }
    },

    load: function(args, done) {
      var q = args.q
      var qent = args.qent
      var entp = {}

      ldapClient.search(constructDN(q.id), {}, function(err, res) {
        
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
      delete q.base
      var searchOpts = {
        filter: '',
        scope: 'sub'
      }
      var list = []

      searchOpts.filter = '('
      for(var prop in q) {
        searchOpts.filter += '(' + prop + '=' + q[prop]+')'
      }
      searchOpts.filter += ')'


      ldapClient.search(baseDN, searchOpts, function(err, res) {

        res.on('searchEntry', function(entry) {
          var fent = qent.make$(entry.object) 
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
      ldapClient.del(constructDN(args.q.id), function(err) {
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
