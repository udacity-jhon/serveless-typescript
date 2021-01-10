import type {AWS} from '@serverless/typescript';

import GetGroups from './src/functions/http/getGroups';
import CreateGroup from './src/functions/http/createGroup';
import CreateImage from './src/functions/http/createImage';
import GetOrders from './src/functions/http/getOrders';
import GetImage from './src/functions/http/getImage';
import SendUploadNotifications from './src/functions/s3/sendUploadNotifications';
import ConnectHandler from './src/functions/websocket/connectHandler';
import DisconnectHandler from './src/functions/websocket/disconnectHandler';
import SyncWithElasticsearch from './src/functions/dynamoDB/elasticSearchSync';

const serverlessConfiguration: AWS = {
  service: 'service-10-udagram-app',
  frameworkVersion: '2',
  custom: {
    webpack: {
      webpackConfig: './webpack.config.js',
      includeModules: true
    }
  },
  plugins: ['serverless-webpack'],
  provider: {
    name: 'aws',
    runtime: 'nodejs12.x',
    apiGateway: {
      minimumCompressionSize: 1024,
      shouldStartNameWithService: true,
    },
    environment: {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      GROUPS_TABLE: "Groups-${self:provider.stage}",
      IMAGES_TABLE: "Images-${self:provider.stage}",
      IMAGE_ID_INDEX: 'ImageIdIndex',
      IMAGES_S3_BUCKET: 'jhon-serverless-udagram-images-${self:provider.stage}',
      SIGNED_URL_EXPIRATION: '300',
      CONNECTIONS_TABLE: 'Connections-${self:provider.stage}'
    },
    lambdaHashingVersion: '20201221',
    region: "us-east-1",
    stage: "${opt:stage, 'dev'}",
    iamRoleStatements: [
      {
        Effect: 'Allow',
        Action: [
          'dynamodb:Scan',
          'dynamodb:PutItem',
          'dynamodb:GetItem',
        ],
        Resource: "arn:aws:dynamodb:${self:provider.region}:*:table/${self:provider.environment.GROUPS_TABLE}",
      },
      {
        Effect: 'Allow',
        Action: [
          'dynamodb:Query',
          'dynamodb:PutItem',
        ],
        Resource: "arn:aws:dynamodb:${self:provider.region}:*:table/${self:provider.environment.IMAGES_TABLE}",
      },
      {
        Effect: 'Allow',
        Action: [
          'dynamodb:Query'
        ],
        Resource: "arn:aws:dynamodb:${self:provider.region}:*:table/${self:provider.environment.IMAGES_TABLE}/index/${self:provider.environment.IMAGE_ID_INDEX}",
      },
      {
        Effect: 'Allow',
        Action: [ 's3:PutObject', 's3:GetObject' ],
        Resource: 'arn:aws:s3:::${self:provider.environment.IMAGES_S3_BUCKET}/*'
      },
      {
        "Effect": "Allow",
        "Action": [
          "dynamodb:Scan",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem"
        ],
        "Resource": "arn:aws:dynamodb:${opt:region, self:provider.region}:*:table/${self:provider.environment.CONNECTIONS_TABLE}"
      },
    ],
  },
  resources: {
    Resources: {
      "GroupsDynamoDBTable": {
        "Type": "AWS::DynamoDB::Table",
        "Properties": {
          "AttributeDefinitions": [
            {
              "AttributeName": "id",
              "AttributeType": "S"
            }
          ],
          "KeySchema": [
            {
              "AttributeName": "id",
              "KeyType": "HASH"
            }
          ],
          "BillingMode": "PAY_PER_REQUEST",
          "TableName": "${self:provider.environment.GROUPS_TABLE}"
        }
      },
      "WebSocketConnectionsDynamoDBTable": {
        "Type": "AWS::DynamoDB::Table",
        "Properties": {
          "AttributeDefinitions": [
            {
              "AttributeName": "id",
              "AttributeType": "S"
            }
          ],
          "KeySchema": [
            {
              "AttributeName": "id",
              "KeyType": "HASH"
            }
          ],
          "BillingMode": "PAY_PER_REQUEST",
          "TableName": "${self:provider.environment.CONNECTIONS_TABLE}"
        }
      },
      ImagesDynamoDBTable: {
        "Type": "AWS::DynamoDB::Table",
        "Properties": {
          "AttributeDefinitions": [
            {
              "AttributeName": "groupId",
              "AttributeType": "S"
            },
            {
              "AttributeName": "timestamp",
              "AttributeType": "S"
            },
            {
              "AttributeName": "imageId",
              "AttributeType": "S"
            }
          ],
          "KeySchema": [
            {
              "AttributeName": "groupId",
              "KeyType": "HASH"
            },
            {
              "AttributeName": "timestamp",
              "KeyType": "RANGE"
            }
          ],
          "BillingMode": "PAY_PER_REQUEST",
          StreamSpecification: {
            StreamViewType: 'NEW_IMAGE',
          },
          "TableName": "${self:provider.environment.IMAGES_TABLE}",
          "GlobalSecondaryIndexes": [
            {
              "IndexName": "${self:provider.environment.IMAGE_ID_INDEX}",
              "KeySchema": [
                {
                  "AttributeName": "imageId",
                  "KeyType": "HASH"
                }
              ],
              "Projection": {
                "ProjectionType": "ALL"
              }
            }
          ]
        }
      },
      SendUploadNotificationsPermission: {
        Type: "AWS::Lambda::Permission",
        Properties: {
          FunctionName: { Ref: 'SendUploadNotificationsLambdaFunction' },
          Principal: "s3.amazonaws.com",
          Action: "lambda:InvokeFunction",
          SourceAccount: { Ref: 'AWS::AccountId' },
          SourceArn: "arn:aws:s3:::${self:provider.environment.IMAGES_S3_BUCKET}"
        }
      },
      "AttachmentsBucket": {
        "Type": "AWS::S3::Bucket",
        "Properties": {
          BucketName: "${self:provider.environment.IMAGES_S3_BUCKET}",
          NotificationConfiguration: {
            LambdaConfigurations: [{
              Event: 's3:ObjectCreated:*',
              Function: {"Fn::GetAtt": ["SendUploadNotificationsLambdaFunction", "Arn"]},
            }],
          },
          "CorsConfiguration": {
            "CorsRules": [
              {
                "AllowedOrigins": [
                  "*"
                ],
                "AllowedHeaders": [
                  "*"
                ],
                "AllowedMethods": [
                  "GET",
                  "PUT",
                  "POST",
                  "DELETE",
                  "HEAD"
                ],
                "MaxAge": 3000
              }
            ]
          }
        }
      },
      "BucketPolicy": {
        "Type": "AWS::S3::BucketPolicy",
        "Properties": {
          "PolicyDocument": {
            "Id": "MyPolicy",
            "Version": "2012-10-17",
            "Statement": [
              {
                "Sid": "PublicReadForGetBucketObjects",
                "Effect": "Allow",
                "Principal": "*",
                "Action": "s3:GetObject",
                "Resource": "arn:aws:s3:::${self:provider.environment.IMAGES_S3_BUCKET}/*"
              }
            ]
          },
          "Bucket": { Ref: "AttachmentsBucket" },
        },
      },
      // ImagesSearch: {
      //   "Type": "AWS::Elasticsearch::Domain",
      //   "Properties": {
      //     "ElasticsearchVersion": "6.3",
      //     "DomainName": "images-search-${self:provider.stage}",
      //     "ElasticsearchClusterConfig": {
      //       "DedicatedMasterEnabled": false,
      //       "InstanceCount": "1",
      //       "ZoneAwarenessEnabled": false,
      //       "InstanceType": "t2.small.elasticsearch"
      //     },
      //     "EBSOptions": {
      //       "EBSEnabled": true,
      //       "Iops": 0,
      //       "VolumeSize": 10,
      //       "VolumeType": "gp2"
      //     },
      //     "AccessPolicies": {
      //       "Version": "2012-10-17",
      //       "Statement": [
      //         {
      //           "Effect": "Allow",
      //           "Principal": {
      //             "AWS": "*"
      //           },
      //           "Action": "es:ESHttp*",
      //           "Resource": { 'Fn::Sub': 'arn:aws:es:${self:provider.region}:${AWS::AccountId}:domain/images-search-${self:provider.stage}/*' },
      //         }
      //       ]
      //     }
      //   }
      // }
    }
  },
  functions: {
    GetGroups,
    CreateGroup,
    GetOrders,
    GetImage,
    CreateImage,
    SendUploadNotifications,
    ConnectHandler,
    DisconnectHandler,
    // SyncWithElasticsearch,
  },
}

module.exports = serverlessConfiguration;
