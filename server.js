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
  host: 'greer-demo-1-database-1.cluster-cor4ewwyi3ds.us-east-1.rds.amazonaws.com',
  user: 'admin',
  password: 'demopassword!',
  database: 'greer-demo-1-database-1',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};


// Create a connection pool
const pool = mysql.createPool(dbConfig);

// Database operations
const insertCard = async (userId, cardNumber, expirationDate, cvv, cardType, status) => {
  const [result] = await pool.execute(
    'INSERT INTO Cards (userId, cardNumber, expirationDate, cvv, cardType, status) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, cardNumber, expirationDate, cvv, cardType, status]
  );
  return result.insertId;
};

const getTransactions = async (userId, limit = 10) => {
  const [rows] = await pool.execute(
    'SELECT * FROM Transactions WHERE userId = ? ORDER BY transactionDate DESC LIMIT ?',
    [userId, limit]
  );
  return rows;
};

const fetchCardInfo = async (userId) => {
  const [rows] = await pool.execute(
    'SELECT id, cardNumber, expirationDate, cardType, status FROM Cards WHERE userId = ? AND status = "ACTIVE" LIMIT 1',
    [userId]
  );
  return rows[0] || null;
};

app.use(express.json());

// Fetch card info
app.get('/api/card', async (req, res) => {
  try {
    const userId = 'demo-user'; // In a real app, you'd get this from authentication
    const cardInfo = await fetchCardInfo(userId);
    if (cardInfo) {
      // Mask the card number for security
      cardInfo.cardNumber = cardInfo.cardNumber.replace(/\d(?=\d{4})/g, "*");
    }
    res.json(cardInfo);
  } catch (error) {
    console.error('Failed to fetch card info:', error);
    res.status(500).json({ error: 'Failed to fetch card info' });
  }
});

// Fetch transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const userId = 'demo-user'; // In a real app, you'd get this from authentication
    const transactions = await getTransactions(userId);
    res.json(transactions);
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Issue new card
app.post('/api/card/issue', async (req, res) => {
  try {
    const userId = 'demo-user'; // In a real app, you'd get this from authentication
    const cardNumber = generateCardNumber(); // You need to implement this function
    const expirationDate = generateExpirationDate(); // You need to implement this function
    const cvv = generateCVV(); // You need to implement this function
    const cardType = 'Visa'; // This could be determined based on the card number
    const status = 'ACTIVE';

    const cardId = await insertCard(userId, cardNumber, expirationDate, cvv, cardType, status);

    // Send message to SQS
    const message = {
      userId: userId,
      action: 'ISSUE_CARD',
      cardId: cardId
    };

    const params = {
      MessageBody: JSON.stringify(message),
      QueueUrl: 'https://sqs.us-west-2.amazonaws.com/your-account-id/card-issuance-queue'
    };

    await sqs.sendMessage(params).promise();
    res.json({ message: 'Card issuance request submitted', cardId: cardId });
  } catch (error) {
    console.error('Failed to issue new card:', error);
    res.status(500).json({ error: 'Failed to issue new card' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
