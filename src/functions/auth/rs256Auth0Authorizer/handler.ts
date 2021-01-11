import { CustomAuthorizerEvent, CustomAuthorizerResult } from 'aws-lambda'
import 'source-map-support/register';
import {JwtToken} from "../aut0Authorizer/JwtToken";
import {verify} from 'jsonwebtoken';

const cert = `-----BEGIN CERTIFICATE-----
MIIDDTCCAfWgAwIBAgIJRDj/IhBbmmVAMA0GCSqGSIb3DQEBCwUAMCQxIjAgBgNV
BAMTGWRldi00a2FzY3BhOC51cy5hdXRoMC5jb20wHhcNMjEwMTEwMjA1NDM4WhcN
MzQwOTE5MjA1NDM4WjAkMSIwIAYDVQQDExlkZXYtNGthc2NwYTgudXMuYXV0aDAu
Y29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzFAI98mMeMz+zLNR
SgSAx2vAJklwsGIYCW0Zd2mjERJUq9MEai5dF3DDqrDaU4utthdyIRinAzb3+rsK
+pAUZgb5pgPq0br9ZbAnDhLIXYNw/Cau0l8/oVpNeThqViJZNSydMtgt4xn5f1CJ
XSBxdzUGHnRVAhViURKkuifBb4btOt3L1chIzpzg27c8cdQ2tKFVn3vDX/0Ns/wX
KoSTHW/0ImRvkHEj6Lo030+g7nRXmTtn9MBHOUp9058/+CHzdduAc+7XVOBE2jEW
sp8QgEXce1jW+pguYsJO40DIt+DIjFl1Tu2U0pQo9AWllo2DbpNr92mugdCsHmH6
ElFdewIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBT1m+14JEiB
Uj4a90EEcfQQnFcj4jAOBgNVHQ8BAf8EBAMCAoQwDQYJKoZIhvcNAQELBQADggEB
AHQ9L5sjIo6vHTAGLWwnFRhNZvkf44CpQjtDzjClfGxEm8tH+CsKo1snNX0Qu38C
yYIPLfWoD7Fd1fv08IGfdlCprc/4Lup63F7Br/Dop1Y4/xojNGbNBYUI/XHCyPNy
izhUYl2EEFnV61Sm7pJXMIC+wyLiDmcAcpG16bC3JAxGRWG4tluAG8SVYEaDMLhl
Jg9D3agFY/PHI48D54AHWTBksgYOCG65eFnDyT9qenGzoCTx1ieywKJ/7yAbMHRR
Z1ecg7HcAe+phRU+g4m2VY98DVpv7PhwlOlgF767F3Sk1JVnI7w88gUoflfxNFIT
4JrWsdZzwLRL/TSUSOwqtqY=
-----END CERTIFICATE-----`

async function verifyToken(authorizationToken: string) {
  if (!authorizationToken) {
    throw new Error("No authorization header");
  }

  if (!authorizationToken.toLocaleLowerCase().startsWith("bearer ")) {
    throw new Error("Invalid authorization header");
  }

  const split = authorizationToken.split(" ");
  const token = split[1];

  console.log("Doing the verification", token, cert.toString());
  return verify(
    token,           // Token from an HTTP header to validate
    cert,            // A certificate copied from Auth0 website
    {algorithms: ['RS256']} // We need to specify that we use the RS256 algorithm
  ) as JwtToken
}

export const main = async (event: CustomAuthorizerEvent): Promise<CustomAuthorizerResult> => {
  try {
    const decodedToken = await verifyToken(event.authorizationToken)
    console.log('User was authorized', decodedToken.sub)

    return {
      principalId: decodedToken.sub,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: '*'
          }
        ]
      }
    }
  } catch (e) {
    console.log('User was not authorized', e.message)

    return {
      principalId: 'user',
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Deny',
            Resource: '*'
          }
        ]
      }
    }
  }
}
