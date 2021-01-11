import type {AWS} from '@serverless/typescript';

import GetGroups from './src/functions/http/getGroups';
import CreateGroup from './src/functions/http/createGroup';
import CreateImage from './src/functions/http/createImage';
import GetOrders from './src/functions/http/getOrders';
import GetImage from './src/functions/http/getImage';
import SendUploadNotifications from './src/functions/s3/sendUploadNotifications';
import ConnectHandler from './src/functions/websocket/connectHandler';
import DisconnectHandler from './src/functions/websocket/disconnectHandler';
// import SyncWithElasticsearch from './src/functions/dynamoDB/elasticSearchSync';
import ResizeImage from './src/functions/s3/resizeImage';
import Auth from './src/functions/auth/aut0Authorizer';
import RS256Auth from './src/functions/auth/rs256Auth0Authorizer';

const serverlessConfiguration: AWS = {
  service: 'service-10-udagram-app',
  frameworkVersion: '2',
  custom: {
    webpack: {
      webpackConfig: './webpack.config.js',
      includeModules: true
    },
    topicName: 'imagesTopic-${self:provider.stage}',
    'serverless-offline': {port: 3003},
    dynamodb: {
      stages: ['dev'],
      start: {
        "port": 8000,
        "inMemory": true,
        "migrate": true
      }
    },
  },
  plugins: [
    'serverless-webpack',
    'serverless-plugin-canary-deployments',
    'serverless-iam-roles-per-function',
    'serverless-dynamodb-local',
    'serverless-offline',
  ],
  package: {
    individually: true,
  },
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
      CONNECTIONS_TABLE: 'Connections-${self:provider.stage}',
      THUMBNAILS_S3_BUCKET: 'jhon-torres-serverless-udagram-thumbnail-${self:provider.stage}',
      AUTH_0_SECRET_ID: 'Auth0Secret-${self:provider.stage}',
      AUTH_0_SECRET_FIELD: 'auth0Secret',
    },
    tracing: {
      lambda: true,
      apiGateway: true,
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
        Action: ['s3:PutObject', 's3:GetObject'],
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
      {
        Effect: 'Allow',
        Action: ['secretsmanager:GetSecretValue'],
        Resource: {Ref: 'Auth0Secret'},
      },
      {
        Effect: 'Allow',
        Action: ['kms:Decrypt'],
        Resource: {"Fn::GetAtt": ["KMSKey", "Arn"]},
      },
      {
        "Effect": "Allow",
        "Action": [ "codedeploy:*" ],
        "Resource": [ "*" ],
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
          FunctionName: {Ref: 'SendUploadNotificationsLambdaFunction'},
          Principal: "s3.amazonaws.com",
          Action: "lambda:InvokeFunction",
          SourceAccount: {Ref: 'AWS::AccountId'},
          SourceArn: "arn:aws:s3:::${self:provider.environment.IMAGES_S3_BUCKET}"
        }
      },
      "AttachmentsBucket": {
        "Type": "AWS::S3::Bucket",
        "Properties": {
          BucketName: "${self:provider.environment.IMAGES_S3_BUCKET}",
          NotificationConfiguration: {
            TopicConfigurations: [{
              Event: 's3:ObjectCreated:Put',
              Topic: {Ref: 'ImagesTopic'},
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
          "Bucket": {Ref: "AttachmentsBucket"},
        },
      },
      ImagesTopic: {
        "Type": "AWS::SNS::Topic",
        "Properties": {
          "DisplayName": "Image bucket topic",
          "TopicName": "${self:custom.topicName}"
        }
      },
      ThumbnailsBucket: {
        "Type": "AWS::S3::Bucket",
        "Properties": {
          "BucketName": "${self:provider.environment.THUMBNAILS_S3_BUCKET}"
        }
      },
      "SNSTopicPolicy": {
        "Type": "AWS::SNS::TopicPolicy",
        "Properties": {
          "PolicyDocument": {
            "Version": "2012-10-17",
            "Statement": [
              {
                "Effect": "Allow",
                "Principal": {
                  "AWS": "*"
                },
                "Action": "sns:Publish",
                "Resource": {
                  "Ref": "ImagesTopic"
                },
                "Condition": {
                  "ArnLike": {
                    "AWS:SourceArn": "arn:aws:s3:::${self:provider.environment.IMAGES_S3_BUCKET}"
                  }
                }
              }
            ]
          },
          "Topics": [
            {
              "Ref": "ImagesTopic"
            }
          ]
        }
      },
      "GatewayResponseDefault4XX": {
        "Type": "AWS::ApiGateway::GatewayResponse",
        "Properties": {
          "ResponseParameters": {
            "gatewayresponse.header.Access-Control-Allow-Origin": "'*'",
            "gatewayresponse.header.Access-Control-Allow-Headers": "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
            "gatewayresponse.header.Access-Control-Allow-Methods": "'GET,OPTIONS,POST'"
          },
          "ResponseType": "DEFAULT_4XX",
          "RestApiId": {
            "Ref": "ApiGatewayRestApi"
          }
        }
      },
      "KMSKey": {
        "Type": "AWS::KMS::Key",
        "Properties": {
          "Description": "KMS key to encrypt Auth0 secret",
          "KeyPolicy": {
            "Version": "2012-10-17",
            "Id": "key-default-1",
            "Statement": [
              {
                "Sid": "Allow administration of the key",
                "Effect": "Allow",
                "Principal": {
                  "AWS": {
                    "Fn::Join": [
                      ":",
                      [
                        "arn:aws:iam:",
                        {
                          "Ref": "AWS::AccountId"
                        },
                        "root"
                      ]
                    ]
                  }
                },
                "Action": [
                  "kms:*"
                ],
                "Resource": "*"
              }
            ]
          }
        }
      },
      KMSKeyAlias: {
        "Type": "AWS::KMS::Alias",
        "Properties": {
          "AliasName": "alias/auth0Key-${self:provider.stage}",
          "TargetKeyId": {Ref: 'KMSKey'},
        }
      },
      "Auth0Secret": {
        "Type": "AWS::SecretsManager::Secret",
        "Properties": {
          "Name": "${self:provider.environment.AUTH_0_SECRET_ID}",
          "Description": "Auth0 secret",
          "KmsKeyId": {Ref: 'KMSKey'}
        }
      }
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
    ResizeImage,
    Auth,
    RS256Auth,
  },
}

module.exports = serverlessConfiguration;
