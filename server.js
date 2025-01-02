// server.js
const express = require('express');
const AWS = require('aws-sdk');
const app = express();

// Configure AWS
AWS.config.update({region: 'us-west-2'});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const sqs = new AWS.SQS({apiVersion: '2012-11-05'});

app.use(express.json());

// Fetch transactions
app.get('/api/transactions', async (req, res) => {
  const params = {
    TableName: 'Transactions',
    Limit: 10
  };

  try {
    const result = await dynamodb.scan(params).promise();
    res.json(result.Items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Fetch card info
app.get('/api/card', async (req, res) => {
  const params = {
    TableName: 'Cards',
    Key: {
      userId: 'demo-user'
    }
  };

  try {
    const result = await dynamodb.get(params).promise();
    res.json(result.Item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch card info' });
  }
});

// Issue new card
app.post('/api/card/issue', async (req, res) => {
  const message = {
    userId: 'demo-user',
    action: 'ISSUE_CARD'
  };

  const params = {
    MessageBody: JSON.stringify(message),
    QueueUrl: 'https://sqs.us-west-2.amazonaws.com/your-account-id/card-issuance-queue'
  };

  try {
    await sqs.sendMessage(params).promise();
    res.json({ message: 'Card issuance request submitted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit card issuance request' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));