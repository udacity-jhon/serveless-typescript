import 'source-map-support/register';
import {APIGatewayProxyHandler} from "aws-lambda";
import {createGroup} from "../../../businessLogic/groups";
import {CreateGroupRequest} from "@libs/requests/CreateGroupRequest";

export const main: APIGatewayProxyHandler = async (event) => {
  const authorization = event.headers.Authorization;
  const split = authorization.split(' ');
  const jwtToken = split[1];
  const parsedBody = JSON.parse(event.body) as CreateGroupRequest;

  const newItem = await createGroup(parsedBody, jwtToken);

  return {
    statusCode: 201,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      newItem
    })
  }
}
