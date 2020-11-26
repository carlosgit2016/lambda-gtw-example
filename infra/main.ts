import { Construct } from 'constructs';
import { App, TerraformStack, TerraformOutput } from 'cdktf';

import { LambdaFunction } from './.gen/providers/aws/lambda-function';
import { LambdaPermission } from './.gen/providers/aws/lambda-permission';

import { ApiGatewayRestApi } from './.gen/providers/aws/api-gateway-rest-api';
import { ApiGatewayResource } from './.gen/providers/aws/api-gateway-resource';
import { ApiGatewayMethod } from './.gen/providers/aws/api-gateway-method';
import { ApiGatewayIntegration } from './.gen/providers/aws/api-gateway-integration'
import { ApiGatewayDeployment } from './.gen/providers/aws/api-gateway-deployment'


import { IamRole } from './.gen/providers/aws/iam-role';
import { DataAwsIamPolicyDocument } from './.gen/providers/aws/data-aws-iam-policy-document'


class MyStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    const iamRole = new IamRole(this, 'role', {
      assumeRolePolicy: new DataAwsIamPolicyDocument(this, 'Document', {
        statement: [
          {
            actions: ["sts:AssumeRole"],
            principals: [
              {
                type: "Service",
                identifiers: ["lambda.amazonaws.com"]
              }
            ],
            effect: "Allow"
          }
        ]
      }).json
    })

    const lambda = new LambdaFunction(this, 'lambda', {
      functionName: 'trimble_cdk_presentation_example',
      handler: 'hello.handler',
      filename: "/home/cflor/git/personal/lambda-gtw-example/src/hello.zip",
      role: iamRole.arn,
      runtime: 'nodejs12.x',
      dependsOn: [
        iamRole
      ]
    })

    const apiLambda = new ApiGatewayRestApi(this, 'api', {
      name: 'trimble_cdk_api_example'
    })

    const proxy = new ApiGatewayResource(this, 'api_gtw_res', {
      restApiId: apiLambda.id,
      parentId: apiLambda.rootResourceId,
      pathPart: '{proxy+}'
    })

    const authHttpMethod = {
      authorization: 'NONE',
      httpMethod: 'ANY'
    }

    const proxyMethod = new ApiGatewayMethod(this, 'api_gtw_method', {
      restApiId: apiLambda.id,
      resourceId: proxy.id,
      ...authHttpMethod
    })

    const integrationConf = {
      type: "AWS_PROXY",
      integrationHttpMethod: "POST",
      uri: lambda.invokeArn
    }

    const integrationLambda = new ApiGatewayIntegration(this, 'api_gtw_integration', {
      httpMethod: proxyMethod.httpMethod,
      resourceId: proxy.id,
      restApiId: apiLambda.id,

      ...integrationConf
    })

    const proxyRoot = new ApiGatewayMethod(this, 'api_gtw_method_root', {
      restApiId: apiLambda.id,
      resourceId: apiLambda.rootResourceId,
      ...authHttpMethod
    })

    const integrationLambdaRoot = new ApiGatewayIntegration(this, 'api_gtw_integration_root', {
      restApiId: apiLambda.id,
      resourceId: proxyRoot.resourceId,
      httpMethod: proxyRoot.httpMethod,

      ...integrationConf
    })    

    const apiDeploy = new ApiGatewayDeployment(this, 'api_gtw_deploy', {
      restApiId: apiLambda.id,
      stageName: "trimble_test",
      dependsOn: [
        integrationLambda,
        integrationLambdaRoot
      ]
    })

    new LambdaPermission(this, "lambda_gtw_permission", {
      statementId: "AllowAPIGatewayInvoke",
      action: "lambda:InvokeFunction",
      functionName: lambda.functionName,
      principal: "apigateway.amazonaws.com",
      sourceArn: `${apiLambda.executionArn}/*/*`
    })

    new TerraformOutput(this, 'base_url', {
      value: apiDeploy.invokeUrl
    })

  }
}

const app = new App();
new MyStack(app, 'lambda-gtw-example');
app.synth();