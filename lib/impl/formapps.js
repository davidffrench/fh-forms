var async = require('async');
var util = require('util');
var models = require('../common/models.js')();
var validation = require('./../common/validate');

exports.getFormApps = getFormApps;

/*
 * getFormApps(connections, options, appId, cb)
 *
 *    connections: {
 *       mongooseConnection: ...
 *    }
 *
 *    options: {
 *       uri:       db connection string,
 *       userEmail: user email address string
 *       appId: id of the App
 *    }
 *
 *    cb  - callback function (err)
 *
 */

function getFormApps(connections, options, cb) {
  var validate = validation(options);
  function validateParams(cb) {
    validate.has("formId",cb);
  }
  validateParams(function(err) {
    if (err) return cb(err);
    var conn = connections.mongooseConnection;
    var formModel = models.get(conn, models.MODELNAMES.FORM);
    var appFormsModel = models.get(conn, models.MODELNAMES.APP_FORMS);
    var formId = options.formId;

    appFormsModel.find({forms: formId}).exec(function (err, apps) {
      if (err) return cb(err);
      return cb(null, apps);
    });
  });
};