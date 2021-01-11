import 'source-map-support/register';
import * as AWS from 'aws-sdk';
import {groupExists} from "../getOrders/handler";
import * as uuid from 'uuid';
import * as middy from 'middy';
import { cors } from 'middy/middlewares';

const docClient = new AWS.DynamoDB.DocumentClient();

const imagesTable = process.env.IMAGES_TABLE;
const bucketName = process.env.IMAGES_S3_BUCKET;
const urlExpiration = Number(process.env.SIGNED_URL_EXPIRATION);

const s3 = new AWS.S3({
  signatureVersion: 'v4'
});

export const main = middy(async (event) => {
  const groupId = event.pathParameters.groupId;
  const validGroupId = await groupExists(groupId)

  if (!validGroupId) {
    return {
      statusCode: 404,
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
    body: JSON.stringify({
      newItem,
      uploadUrl: url
    })
  }
})

function getUploadUrl(imageId: string) {
  return s3.getSignedUrl('putObject', {
    Bucket: bucketName,
    Key: imageId,
    Expires: urlExpiration
  });
}

main.use(
  cors({
    credentials: true,
  })
)
