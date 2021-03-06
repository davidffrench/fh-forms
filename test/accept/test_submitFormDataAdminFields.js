require('./../Fixtures/env.js');
var forms = require('../../lib/forms.js');
var mongoose = require('mongoose');
var models = require('../../lib/common/models.js')();
var logger = require('../../lib/common/logger').getLogger();
var async = require('async');
var assert = require('assert');
var util = require('util');
var _ = require('underscore');
var simpleForm = require('../Fixtures/simple');
var fieldData = require('../Fixtures/formSubmissions');
var baseSubmission = require('../Fixtures/baseSubmission');
var options = {'uri': process.env.FH_DOMAIN_DB_CONN_URL, userEmail: "testUser@example.com"};


var createdFormId, textFieldId, adminTextFieldId;

module.exports.test = {}; module.exports.test.before = function(done) {

  var testFormWithAdminFields = simpleForm.getBaseForm();

  //adding a non-admin field

  var textField = fieldData.textFieldData;
  var adminTextField = fieldData.adminTextFieldData;

  //Adding the fields to the form
  testFormWithAdminFields.pages[0].fields.push(textField);
  testFormWithAdminFields.pages[0].fields.push(adminTextField);


  forms.updateForm(options, testFormWithAdminFields, function(err, createdForm) {
    assert.ok(!err, "Expected no error " + util.inspect(err));

    assert.ok(createdForm._id, "Expected a created form ID");
    assert.equal(textField.name, createdForm.pages[0].fields[0].name, "Expected the text field as the first field");
    assert.equal(adminTextField.name, createdForm.pages[0].fields[1].name, "Expected the admin text field as the second field");
    assert.equal(true, createdForm.pages[0].fields[1].adminOnly, "Expected the admin text field to be adminOnly");


    createdFormId = createdForm._id;
    textFieldId = createdForm.pages[0].fields[0]._id;
    adminTextFieldId = createdForm.pages[0].fields[1]._id;

    done();
  });

};


/**
 * Utility function to submit a JSON submission
 * @param {object}  full submission JSON definition
 * @param cb
 */
function submitFormData(submission, cb) {
  forms.submitFormData(_.extend({
    submission: submission
  }, options), function(err, submissionResult) {
    assert.ok(!err, "Expected no error " + util.inspect(err));
    assert.ok(!submissionResult.error, "Expected No Submission Error " + util.inspect(submissionResult.error));
    assert.ok(submissionResult.submissionId, "Expected A Submission ID");

    cb(undefined, submissionResult.submissionId);
  });
}

function completeSubmission(submissionId, cb) {
  forms.completeFormSubmission({"uri": process.env.FH_DOMAIN_DB_CONN_URL, "submission": {"submissionId" : submissionId}}, function(err, completionResult) {
    assert.ok(!err, "Expected no error " + util.inspect(err));

    assert.strictEqual(completionResult.formSubmission.status, "complete", "should be COMPLETE submission: " + util.inspect(completionResult.formSubmission));

    cb(undefined, submissionId);
  });
}

module.exports.test.after = function(done) {

  //Closing the mongo connection
  forms.tearDownConnection(options, function(err) {
    assert.ok(!err, "Expected no error " + util.inspect(err));
    done();
  });
};


//Testing that when a submission is made with an admin field, the admin field should be included in the submission JSON
module.exports.test.testSubmitFormDataWithAdminFields = function(done) {
  var submission = baseSubmission();

  submission.formId = createdFormId;

  submission.formFields = [{
    "fieldId": textFieldId,
    "fieldValues": ["Some Text Value1", "Some Text Value2"]
  }];

  async.waterfall([

    //Submitting the submission JSON
    async.apply(submitFormData, submission),

    //verifying and marking the submission as complete
    completeSubmission,

    //Verifying that the stored submission has the admin field.
    function verifySubmissionAdminField(submissionId, cb) {
      var connection = mongoose.createConnection(options.uri);

      //Set up the connection
      models.init(connection);

      var Submission = models.get(connection, models.MODELNAMES.FORM_SUBMISSION);

      //Find the submission model
      Submission.findOne({_id: submissionId}, function(err, submission) {
        assert.ok(!err, "Expected No Error " + util.inspect(err));
        assert.ok(submission, "Expected a submission");

        assert.strictEqual(textFieldId, submission.formSubmittedAgainst.pages[0].fields[0]._id.toString(), "Expected the text field as the first field");

        //The submission should have the admin fields.
        assert.strictEqual(adminTextFieldId, submission.formSubmittedAgainst.pages[0].fields[1]._id.toString(), "Expected the admin text field as the second field");
        assert.strictEqual(true, submission.formSubmittedAgainst.pages[0].fields[1].adminOnly, "Expected the admin text field to be adminOnly");

        connection.close(cb);
      });
    }
  ], done);
};

//Testing that updating admin fields is persisted to the submission
module.exports.test.testUpdateSubmissionWithAdminFields = function(done) {
  var submission = baseSubmission();

  submission.formId = createdFormId;

  submission.formFields = [{
    "fieldId": textFieldId,
    "fieldValues": ["Some Text Value1", "Some Text Value2"]
  }];

  async.waterfall([

    //Submitting the submission JSON
    async.apply(submitFormData, submission),

    //verifying and marking the submission as complete
    completeSubmission,

    //Verifying that the stored submission has the admin field.
    function getSubmission(submissionId, cb) {
      forms.getSubmission(options, {_id: submissionId}, function(err, submission) {
        assert.ok(!err, "Expected No Error " + util.inspect(err));
        assert.ok(submission, "Expected a submission");

        cb(err, submission);
      });
    },
    function updateCompletedSubmissionAdminField(submission, cb) {
      var adminText = "SOME ADMIN TEXT FOR THE WIN!!";
      submission.formFields = _.map(submission.formFields, function(formField) {
        var returnVal = {
          fieldId: formField.fieldId._id
        };

        if (formField.fieldId._id.toString() === adminTextFieldId) {
          returnVal.fieldValues = [adminText];
        } else {
          returnVal.fieldValues = formField.fieldValues;
        }

        return returnVal;
      });

      logger.debug("*** Updating submission", submission);

      //Now update the submission
      forms.submitFormData(_.extend({
        submission: submission,
        skipValidation: true
      }, options), function(err, submissionResult) {
        assert.ok(!err, "Expected no error " + util.inspect(err));
        assert.ok(!submissionResult.error, "Expected No Submission Error " + util.inspect(submissionResult.error));
        assert.ok(submissionResult.submissionId, "Expected A Submission ID");

        logger.debug("*** Finished Updating submission", submissionResult.formSubmission.formFields);

        assert.strictEqual(adminText, submissionResult.formSubmission.formFields[1].fieldValues[0]);

        cb();
      });
    }
  ], done);
};

