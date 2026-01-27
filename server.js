require('dotenv').config();

const app = require('./src/app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 5000;

// Required environment variables
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

// Warning for production security
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_REFRESH_SECRET) {
    console.warn('WARNING: JWT_REFRESH_SECRET not set, using JWT_SECRET for refresh tokens');
  }
  if (!process.env.SMTP_HOST) {
    console.warn('WARNING: SMTP not configured, emails will be mocked');
  }
}

const startServer = async () => {
  try {
    await connectDB();
    
    app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
