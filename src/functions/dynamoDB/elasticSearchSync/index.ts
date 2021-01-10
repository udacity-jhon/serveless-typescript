
export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  environment: {
     ES_ENDPOINT: { 'Fn::GetAtt': [ 'ImagesSearch', 'DomainEndpoint'] },
  },
  events: [
    {
      stream: {
        type: "dynamodb",
        arn: { 'Fn::GetAtt': [ 'ImagesDynamoDBTable', 'StreamArn'] },
      },
    },
  ],
}
