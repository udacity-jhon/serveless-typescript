import 'source-map-support/register';

import * as AWS from 'aws-sdk';
import {middyfy} from '@libs/lambda';
import {APIGatewayProxyHandler} from "aws-lambda";

const docClient = new AWS.DynamoDB.DocumentClient()

const groupsTable = process.env.GROUPS_TABLE;

const getGroups: APIGatewayProxyHandler = async () => {

  const result = await docClient.scan({
    TableName: groupsTable,
  }).promise();

  const items = result.Items;

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      items,
    })
  }
}

export const main = middyfy(getGroups);
