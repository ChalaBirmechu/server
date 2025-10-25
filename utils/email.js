// utils/email.js
const nodemailer = require('nodemailer');

// Cache the transporter to avoid recreating it for every request
let cachedTransporter = null;
let lastTransporterCreation = 0;
const TRANSPORTER_CACHE_TIME = 5 * 60 * 1000; // 5 minutes cache

const createTransporter = async () => {
  try {
    // Return cached transporter if it's still valid
    if (cachedTransporter && (Date.now() - lastTransporterCreation) < TRANSPORTER_CACHE_TIME) {
      console.log('✅ Using cached email transporter');
      return cachedTransporter;
    }

    // FIX: Add timeout for transporter creation
    const transporterPromise = (async () => {
      if (process.env.NODE_ENV === 'production') {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
          throw new Error('EMAIL_USER or EMAIL_PASS not set for production');
        }
        
        console.log('📧 Creating production email transporter...');
        
        // FIX: Use different email services based on availability
        const transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST || 'smtp.gmail.com',
          port: process.env.EMAIL_PORT || 465,
          secure: true,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
          // FIX: Add connection timeout settings
          connectionTimeout: 10000, // 10 seconds
          greetingTimeout: 10000,   // 10 seconds
          socketTimeout: 15000,     // 15 seconds
          // FIX: Better error handling and retries
          debug: process.env.NODE_ENV !== 'production',
          logger: process.env.NODE_ENV !== 'production',
        });

        // FIX: Verify connection before returning
        await transporter.verify();
        console.log('✅ Production email transporter verified and ready');
        
        return transporter;
      } else {
        // Development - use Ethereal with timeout
        console.log('📧 Creating development email transporter (Ethereal)...');
        const testAccount = await nodemailer.createTestAccount();
        
        const transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
          connectionTimeout: 8000,
          greetingTimeout: 8000,
          socketTimeout: 10000,
        });

        await transporter.verify();
        console.log('✅ Development email transporter verified and ready');
        console.log('📧 Ethereal credentials:', {
          user: testAccount.user,
          pass: testAccount.pass,
          web: 'https://ethereal.email'
        });
        
        return transporter;
      }
    })();

    // FIX: Add timeout for the entire transporter creation process
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Email transporter creation timeout (15s)'));
      }, 15000);
    });

    const transporter = await Promise.race([transporterPromise, timeoutPromise]);
    
    // Cache the successful transporter
    cachedTransporter = transporter;
    lastTransporterCreation = Date.now();
    
    return transporter;

  } catch (error) {
    console.error('❌ Email transporter creation failed:', error.message);
    
    // Clear cache on failure
    cachedTransporter = null;
    lastTransporterCreation = 0;
    
    throw error;
  }
};

// FIX: Add method to send email with built-in timeout and retry logic
const sendEmailWithTimeout = async (transporter, mailOptions, timeoutMs = 15000) => {
  try {
    const sendPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Email sending timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const result = await Promise.race([sendPromise, timeoutPromise]);
    
    // Log email info (without sensitive data)
    if (process.env.NODE_ENV !== 'production') {
      console.log('📧 Email sent:', {
        to: mailOptions.to,
        subject: mailOptions.subject,
        preview: nodemailer.getTestMessageUrl(result)
      });
    } else {
      console.log('📧 Email sent successfully to:', mailOptions.to);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    throw error;
  }
};

// FIX: Add method to check if email credentials are configured
const isEmailConfigured = () => {
  if (process.env.NODE_ENV === 'production') {
    return !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
  }
  return true; // Always true for development (Ethereal)
};

// FIX: Add method to get email configuration status
const getEmailStatus = () => {
  return {
    isProduction: process.env.NODE_ENV === 'production',
    isConfigured: isEmailConfigured(),
    service: process.env.NODE_ENV === 'production' 
      ? (process.env.EMAIL_HOST || 'Gmail')
      : 'Ethereal (Development)',
    user: process.env.NODE_ENV === 'production' 
      ? process.env.EMAIL_USER 
      : 'ethereal.user'
  };
};

module.exports = { 
  createTransporter, 
  sendEmailWithTimeout,
  isEmailConfigured,
  getEmailStatus 
};