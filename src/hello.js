'use strict'

exports.handler = function (event, context, callback) {
  const response = {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
    body: '<h2>Testing...Trimble...Terraform CDK...</h2>',
  }
  callback(null, response)
}