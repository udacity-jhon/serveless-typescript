export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [
    {
      "sns": {
        "arn": {
          "Fn::Join": [
            ":",
            [
              "arn:aws:sns",
              {
                "Ref": "AWS::Region"
              },
              {
                "Ref": "AWS::AccountId"
              },
              "${self:custom.topicName}"
            ]
          ]
        },
        "topicName": "${self:custom.topicName}"
      }
    }
  ]
}
