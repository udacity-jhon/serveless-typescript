import * as uuid from 'uuid'

import {Group} from '../libs/models/Group';
import {GroupAccess} from '../dataLayer/groupsAccess';
import {getUserId} from "../functions/auth/rs256Auth0Authorizer/utils";
import {CreateGroupRequest} from "@libs/requests/CreateGroupRequest";


const groupAccess = new GroupAccess()

export async function getAllGroups(): Promise<Group[]> {
  return groupAccess.getAllGroups()
}

export async function createGroup(
  createGroupRequest: CreateGroupRequest,
  jwtToken: string
): Promise<Group> {

  const itemId = uuid.v4()
  const userId = getUserId(jwtToken)

  return await groupAccess.createGroup({
    id: itemId,
    userId: userId,
    name: createGroupRequest.name,
    description: createGroupRequest.description,
  })
}
