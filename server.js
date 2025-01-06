const express = require('express');
const mysql = require('mysql2/promise');
const AWS = require('aws-sdk');
const app = express();

// Configure AWS
AWS.config.update({region: 'us-west-2'});

// Create SQS service object
const sqs = new AWS.SQS({apiVersion: '2012-11-05'});

// Aurora connection configuration
const dbConfig = {
  host: ‘greer-demo-1-database-1.cluster-cor4ewwyi3ds.us-east-1.rds.amazonaws.com’,
  user: ‘admin’,
  password: ‘demopassword!’,
  database: ‘greer-demo-1-database-1’,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};


// Create a connection pool
const pool = mysql.createPool(dbConfig);

app.use(express.json());

// Fetch transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Transactions ORDER BY transactionDate DESC LIMIT 10');
    res.json(rows);
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Fetch card info
app.get('/api/card', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Cards WHERE userId = ? AND status = "ACTIVE" LIMIT 1', ['demo-user']);
    res.json(rows[0] || null);
  } catch (error) {
    console.error('Failed to fetch card info:', error);
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
    console.error('Failed to submit card issuance request:', error);
    res.status(500).json({ error: 'Failed to submit card issuance request' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
