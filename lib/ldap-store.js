/* Copyright (c) 2014 Alan Bradley, MIT License */
"use strict";

var name = "ldap-store"

module.exports = function(opts) {
  var seneca = this

  var store = {
    name: name,

    close: function(done) {},

    save: function(args, done) {},

    load: function(args, done) {},

    list: function(args, done) {},

    remove: function(args, done) {},

    native: function(args, done) {}
  }

  var meta = seneca.init(seneca, opts, store)

  seneca.add({init:store.name,tag:meta.tag},function(args,done){
    configure(opts,function(err){
      if( err ) {
        return seneca.fail({code:'entity/configure',store:store.name,error:err,desc:desc},done)
      }
      else done()
    })
  })

  return {name:store.name,tag:meta.tag}
}
