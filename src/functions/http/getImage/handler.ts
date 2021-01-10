import 'source-map-support/register';

import * as AWS from 'aws-sdk';
import {APIGatewayProxyHandler} from "aws-lambda";

const docClient = new AWS.DynamoDB.DocumentClient();

const imagesTable = process.env.IMAGES_TABLE;
const imageIdIndex = process.env.IMAGE_ID_INDEX;

export const main: APIGatewayProxyHandler = async (event) => {
  const imageId = event.pathParameters.imageId;

  const result = await docClient.query({
    TableName : imagesTable,
    IndexName : imageIdIndex,
    KeyConditionExpression: 'imageId = :imageId',
    ExpressionAttributeValues: {
      ':imageId': imageId
    }
  }).promise()

  if (result.Count !== 0) {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result.Items[0])
    }
  }

  return {
    statusCode: 404,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    body: ''
  }
}
