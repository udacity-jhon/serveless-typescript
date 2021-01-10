import 'source-map-support/register';

import * as AWS from 'aws-sdk';
import {APIGatewayProxyHandler} from "aws-lambda";
import {groupExists} from "../getOrders/handler";
import * as uuid from 'uuid';

const docClient = new AWS.DynamoDB.DocumentClient();

const imagesTable = process.env.IMAGES_TABLE;
const bucketName = process.env.IMAGES_S3_BUCKET;
const urlExpiration = Number(process.env.SIGNED_URL_EXPIRATION);

const s3 = new AWS.S3({
  signatureVersion: 'v4'
});

export const main: APIGatewayProxyHandler = async (event) => {
  const groupId = event.pathParameters.groupId;
  const validGroupId = await groupExists(groupId)

  if (!validGroupId) {
    return {
      statusCode: 404,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Group does not exist'
      })
    }
  }

  const parsedBody = JSON.parse(event.body);
  const imageId = String(uuid.v4());

  const newItem = {
    groupId,
    imageId,
    timestamp: new Date().toISOString(),
    ...parsedBody,
    imageUrl: `https://${bucketName}.s3.amazonaws.com/${imageId}`,
  };

  const url = getUploadUrl(imageId)

  await docClient.put({
    TableName: imagesTable,
    Item: newItem
  }).promise();

  return {
    statusCode: 201,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      newItem,
      uploadUrl: url
    })
  }
}

function getUploadUrl(imageId: string) {
  return s3.getSignedUrl('putObject', {
    Bucket: bucketName,
    Key: imageId,
    Expires: urlExpiration
  });
}
